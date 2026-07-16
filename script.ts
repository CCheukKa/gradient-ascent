import { Network } from "@lib/components/neuralNetwork";
import { MathExtra } from "@lib/utils/mathExtra";
import * as THREE from "three";

class Vertex {
    public x: number;
    public y: number;
    public z: number;
    constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

function getHeightColor(normalizedZ: number): THREE.Color {
    const clampedZ = THREE.MathUtils.clamp(normalizedZ, 0, 1);
    const blue = new THREE.Color(0x1e3a8a);
    const yellow = new THREE.Color(0xfde047);
    const red = new THREE.Color(0xef4444);

    if (clampedZ <= 0.5) {
        return blue.clone().lerp(yellow, clampedZ * 2);
    }

    return yellow.clone().lerp(red, (clampedZ - 0.5) * 2);
}

const mainContainerElement = document.getElementById("mainContainer") as HTMLDivElement;
const scoreElement = document.getElementById("score") as HTMLDivElement;
const sliderTemplateElement = document.getElementById("sliderTemplate") as HTMLTemplateElement;

const layerSizes = [2, 4, 2, 1];
const network = new Network(layerSizes);
const randomInput = Array.from({ length: layerSizes[0]! }, () => Math.random());
const weightsLength = network.weights.length;

const sliders: HTMLInputElement[] = [];
const axisCheckboxes: HTMLInputElement[] = [];

// randomly choose two distinct weight indices to be selected initially
let selectedWeightIndices: [number, number] = (() => {
    const firstIndex = Math.floor(Math.random() * weightsLength);
    let secondIndex: number;
    do {
        secondIndex = Math.floor(Math.random() * weightsLength);
    } while (secondIndex === firstIndex);
    return [firstIndex, secondIndex];
})();

let graphRotationY = 0;
let cameraDistance = 10;
const cameraDirection = new THREE.Vector3(1, 1, 1).normalize();

for (let i = 0; i < weightsLength; i++) {
    const sliderClone = sliderTemplateElement.content.cloneNode(true) as DocumentFragment;
    const sliderLabel = sliderClone.querySelector("label") as HTMLLabelElement;
    const sliderInput = sliderClone.querySelector("input") as HTMLInputElement;
    const sliderValueDisplay = sliderClone.querySelector("#value") as HTMLSpanElement;
    sliderInput.id = `weight-${i}`;
    sliderInput.name = `weight-${i}`;
    sliderInput.value = network.weights[i]!.toString();

    sliderLabel.textContent = `Weight ${i}`;
    const axisCheckbox = document.createElement("input");
    axisCheckbox.type = "checkbox";
    axisCheckbox.checked = selectedWeightIndices.includes(i);
    axisCheckbox.style.marginLeft = "8px";
    axisCheckbox.title = "Use as graph axis";
    axisCheckbox.ariaLabel = `Use weight ${i} as graph axis`;

    axisCheckbox.addEventListener("change", () => {
        selectedWeightIndices = getNextSelectedWeightIndices(i, axisCheckbox.checked);
        syncAxisCheckboxes();
        renderOutputScoreGraph();
    });

    axisCheckboxes.push(axisCheckbox);
    sliderLabel.appendChild(axisCheckbox);

    mainContainerElement.appendChild(sliderClone);
    sliders.push(sliderInput);

    sliderInput.addEventListener("input", () => {
        updateDisplay();
        updateScore();
    });

    updateDisplay();
    function updateDisplay() {
        sliderValueDisplay.textContent = MathExtra.formatNumber(parseFloat(sliderInput.value), 5, 9);
    }
}

function syncAxisCheckboxes() {
    for (let i = 0; i < axisCheckboxes.length; i++) {
        axisCheckboxes[i]!.checked = selectedWeightIndices.includes(i);
    }
}

function getNextSelectedWeightIndices(changedIndex: number, isChecked: boolean): [number, number] {
    const nextSelection = selectedWeightIndices.filter(index => index !== changedIndex);

    if (isChecked) {
        if (nextSelection.length >= 2) {
            nextSelection.shift();
        }
        nextSelection.push(changedIndex);
    }

    while (nextSelection.length < 2) {
        const fallbackIndex = Array.from({ length: weightsLength }, (_, index) => index).find(index => !nextSelection.includes(index));
        if (fallbackIndex === undefined) {
            break;
        }
        nextSelection.push(fallbackIndex);
    }

    return [nextSelection[0]!, nextSelection[1] ?? nextSelection[0]!];
}

const rotationSliderWrapper = document.createElement("div");
rotationSliderWrapper.className = "slider";

const rotationLabel = document.createElement("label");
rotationLabel.htmlFor = "rotation-y";
rotationLabel.textContent = "Rotate:";

const rotationSlider = document.createElement("input");
rotationSlider.type = "range";
rotationSlider.id = "rotation-y";
rotationSlider.name = "rotation-y";
rotationSlider.min = "-180";
rotationSlider.max = "180";
rotationSlider.step = "1";
rotationSlider.value = "0";

rotationSlider.addEventListener("input", () => {
    graphRotationY = (parseFloat(rotationSlider.value) * Math.PI) / 180;
    renderOutputScoreGraph();
});

rotationSliderWrapper.append(rotationLabel, rotationSlider);
mainContainerElement.appendChild(rotationSliderWrapper);

const zoomSliderWrapper = document.createElement("div");
zoomSliderWrapper.className = "slider";

const zoomLabel = document.createElement("label");
zoomLabel.htmlFor = "zoom-distance";
zoomLabel.textContent = "Zoom:";

const zoomSlider = document.createElement("input");
zoomSlider.type = "range";
zoomSlider.id = "zoom-distance";
zoomSlider.name = "zoom-distance";
zoomSlider.min = "10";
zoomSlider.max = "20";
zoomSlider.step = "0.01";
zoomSlider.value = cameraDistance.toString();

zoomSlider.addEventListener("input", () => {
    cameraDistance = parseFloat(zoomSlider.value);
    updateCameraPosition();
    renderOutputScoreGraph();
});

zoomSliderWrapper.append(zoomLabel, zoomSlider);
mainContainerElement.appendChild(zoomSliderWrapper);

function updateCameraPosition() {
    camera.position.copy(cameraDirection).multiplyScalar(cameraDistance);
    camera.lookAt(0, 0, 0);
}

function updateScore() {
    network.weights = sliders.map(slider => parseFloat(slider.value));
    const output = network.predict(randomInput);
    scoreElement.textContent = `Score: ${MathExtra.formatNumber(output * 10000, 0, 6)}`;
    renderOutputScoreGraph();
}

function generateOutputScoreMatrix(network: Network, range: [number, number], step: number): Vertex[] {
    const outputScoreMatrix: Vertex[] = [];
    const numSteps = Math.floor((range[1] - range[0]) / step) + 1;
    const currentWeights = network.weights.slice();
    for (let i = 0; i < numSteps; i++) {
        for (let j = 0; j < numSteps; j++) {
            const weights = currentWeights.slice();
            weights[selectedWeightIndices[0]] = range[0]! + i * step;
            weights[selectedWeightIndices[1]] = range[0]! + j * step;
            network.weights = weights;
            const output = network.predict(randomInput);
            outputScoreMatrix.push(new Vertex(weights[selectedWeightIndices[0]]!, weights[selectedWeightIndices[1]]!, output));
        }
    }
    network.weights = currentWeights;
    return outputScoreMatrix;
}

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
updateCameraPosition();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
const canvasWidth = Math.ceil(window.innerWidth);
const canvasHeight = Math.ceil(window.innerHeight);
renderer.setSize(canvasWidth, canvasHeight);
renderer.domElement.classList.add("three-graph");
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(3, 4, 5);
scene.add(directionalLight);

const graphMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    specular: 0xffffff,
    shininess: 1,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    vertexColors: true,
});

const graphLineMaterial = new THREE.LineBasicMaterial({
    color: 0xc7d2ff,
    transparent: true,
    opacity: 0.35,
});

let graphMesh: THREE.Mesh | null = null;
let graphGridLines: THREE.LineSegments | null = null;
let currentPointAnchor: THREE.Group | null = null;
let currentPointVisual: THREE.Group | null = null;
let graphGroup: THREE.Group | null = null;
const currentPointBaseRadius = 0.035;
const currentPointScreenRadius = 5;
const currentPointWorldPosition = new THREE.Vector3();
const currentPointMaterial = new THREE.MeshBasicMaterial({
    color: 0xff3b3b,
});

function updateCurrentPointScreenSize() {
    if (!currentPointAnchor || !currentPointVisual) {
        return;
    }

    currentPointAnchor.getWorldPosition(currentPointWorldPosition);
    const distance = camera.position.distanceTo(currentPointWorldPosition);
    const viewportHeight = renderer.getSize(new THREE.Vector2()).height;
    const worldRadius = (currentPointScreenRadius * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 2) / viewportHeight;
    currentPointVisual.scale.setScalar(worldRadius / currentPointBaseRadius);
}

function renderOutputScoreGraph() {
    const range: [number, number] = [-10, 10];
    const step = 0.2;
    const vertices = generateOutputScoreMatrix(network, range, step);
    const numSteps = Math.floor((range[1] - range[0]) / step) + 1;
    const positions = new Float32Array(vertices.length * 3);
    const colors = new Float32Array(vertices.length * 3);
    const indices: number[] = [];
    const linePositions: number[] = [];
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < vertices.length; i++) {
        minZ = Math.min(minZ, vertices[i]!.z);
        maxZ = Math.max(maxZ, vertices[i]!.z);

        positions[i * 3 + 0] = vertices[i]!.x;
        positions[i * 3 + 1] = vertices[i]!.z;
        positions[i * 3 + 2] = vertices[i]!.y;
    }

    const zRange = Math.max(maxZ - minZ, 0.0001);

    for (let i = 0; i < vertices.length; i++) {
        const normalizedZ = (vertices[i]!.z - minZ) / zRange;
        const vertexColor = getHeightColor(normalizedZ);
        colors[i * 3 + 0] = vertexColor.r;
        colors[i * 3 + 1] = vertexColor.g;
        colors[i * 3 + 2] = vertexColor.b;
    }

    for (let x = 0; x < numSteps - 1; x++) {
        for (let y = 0; y < numSteps - 1; y++) {
            const topLeft = x * numSteps + y;
            const topRight = topLeft + 1;
            const bottomLeft = (x + 1) * numSteps + y;
            const bottomRight = bottomLeft + 1;

            indices.push(topLeft, bottomLeft, topRight);
            indices.push(topRight, bottomLeft, bottomRight);
        }
    }

    for (let x = 0; x < numSteps; x++) {
        for (let y = 0; y < numSteps - 1; y++) {
            const start = x * numSteps + y;
            const end = start + 1;

            linePositions.push(
                positions[start * 3 + 0]!,
                positions[start * 3 + 1]!,
                positions[start * 3 + 2]!,
                positions[end * 3 + 0]!,
                positions[end * 3 + 1]!,
                positions[end * 3 + 2]!,
            );
        }
    }

    for (let y = 0; y < numSteps; y++) {
        for (let x = 0; x < numSteps - 1; x++) {
            const start = x * numSteps + y;
            const end = (x + 1) * numSteps + y;

            linePositions.push(
                positions[start * 3 + 0]!,
                positions[start * 3 + 1]!,
                positions[start * 3 + 2]!,
                positions[end * 3 + 0]!,
                positions[end * 3 + 1]!,
                positions[end * 3 + 2]!,
            );
        }
    }

    if (graphGroup) {
        scene.remove(graphGroup);
        graphGroup.traverse(object => {
            if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points) {
                object.geometry.dispose();
            }
        });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    graphMesh = new THREE.Mesh(geometry, graphMaterial);

    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(linePositions), 3));

    graphGridLines = new THREE.LineSegments(gridGeometry, graphLineMaterial);

    const currentWeights = network.weights;
    const currentOutput = network.predict(randomInput);
    const currentPointSphere = new THREE.Mesh(new THREE.SphereGeometry(currentPointBaseRadius, 18, 18), currentPointMaterial);
    const currentPointStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.28, 14),
        currentPointMaterial,
    );
    currentPointStem.position.y = currentPointBaseRadius + 0.14;

    const currentPointHead = new THREE.Mesh(
        new THREE.ConeGeometry(0.04, 0.16, 14),
        currentPointMaterial,
    );
    currentPointHead.rotation.x = Math.PI;
    currentPointHead.position.y = currentPointBaseRadius + 0.36;

    currentPointVisual = new THREE.Group();
    currentPointVisual.add(currentPointSphere);
    currentPointVisual.add(currentPointStem);
    currentPointVisual.add(currentPointHead);

    currentPointAnchor = new THREE.Group();
    currentPointAnchor.position.set(currentWeights[selectedWeightIndices[0]]!, currentOutput, currentWeights[selectedWeightIndices[1]]!);
    currentPointAnchor.add(currentPointVisual);

    graphGroup = new THREE.Group();
    graphGroup.rotation.y = graphRotationY;
    graphGroup.add(graphMesh);
    graphGroup.add(graphGridLines);
    graphGroup.add(currentPointAnchor);
    scene.add(graphGroup);

    updateCurrentPointScreenSize();

    renderer.render(scene, camera);
}

updateScore();
renderOutputScoreGraph();