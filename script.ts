import { Network } from "@lib/components/neuralNetwork";
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

const layerSizes = [1, 1];
const network = new Network(layerSizes);
const randomInput = Array.from({ length: layerSizes[0]! }, () => Math.random());
const wbLength = network.weightsAndBiases.length;

const sliders: HTMLInputElement[] = [];
let graphRotationY = 0;

for (let i = 0; i < wbLength; i++) {
    const sliderClone = sliderTemplateElement.content.cloneNode(true) as DocumentFragment;
    const sliderInput = sliderClone.querySelector("input") as HTMLInputElement;
    sliderInput.id = `weight-${i}`;
    sliderInput.name = `weight-${i}`;
    sliderInput.value = network.weightsAndBiases[i]!.toString();
    mainContainerElement.appendChild(sliderClone);
    sliders.push(sliderInput);

    sliderInput.addEventListener("input", updateScore);
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

function updateScore() {
    network.weightsAndBiases = sliders.map(slider => parseFloat(slider.value));
    const output = network.predict(randomInput);
    scoreElement.textContent = `Score: ${output.toFixed(10)}`;
    renderOutputScoreGraph();
}

function generateOutputScoreMatrix(network: Network, range: [number, number], step: number): Vertex[] {
    const outputScoreMatrix: Vertex[] = [];
    const numSteps = Math.floor((range[1] - range[0]) / step) + 1;
    const currentWeightsAndBiases = network.weightsAndBiases.slice();
    for (let i = 0; i < numSteps; i++) {
        for (let j = 0; j < numSteps; j++) {
            const weightsAndBiases = currentWeightsAndBiases.slice();
            weightsAndBiases[0] = range[0]! + i * step;
            weightsAndBiases[1] = range[0]! + j * step;
            network.weightsAndBiases = weightsAndBiases;
            const output = network.predict(randomInput);
            outputScoreMatrix.push(new Vertex(weightsAndBiases[0]!, weightsAndBiases[1]!, output));
        }
    }
    network.weightsAndBiases = currentWeightsAndBiases;
    return outputScoreMatrix;
}

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(1.8, 1.8, 1.8);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
const canvasWidth = Math.min(400, Math.floor(window.innerWidth * 0.65));
const canvasHeight = Math.min(400, Math.floor(window.innerHeight * 0.65));
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
    shininess: 30,
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
let currentPoint: THREE.Mesh | null = null;
let graphGroup: THREE.Group | null = null;
const currentPointMaterial = new THREE.MeshBasicMaterial({
    color: 0xff3b3b,
});

function renderOutputScoreGraph() {
    const range: [number, number] = [-10, 10];
    const step = 0.5;
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

    const currentWeightsAndBiases = network.weightsAndBiases;
    const currentOutput = network.predict(randomInput);
    const currentPointGeometry = new THREE.SphereGeometry(0.035, 18, 18);

    currentPoint = new THREE.Mesh(currentPointGeometry, currentPointMaterial);
    currentPoint.position.set(currentWeightsAndBiases[0]!, currentOutput, currentWeightsAndBiases[1]!);

    graphGroup = new THREE.Group();
    graphGroup.rotation.y = graphRotationY;
    graphGroup.add(graphMesh);
    graphGroup.add(graphGridLines);
    graphGroup.add(currentPoint);
    scene.add(graphGroup);

    renderer.render(scene, camera);
}

updateScore();
renderOutputScoreGraph();