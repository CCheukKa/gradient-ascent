import { Network } from "@lib/components/neuralNetwork";
import { MathExtra } from "@lib/utils/mathExtra";
import { createWeightAxisControls } from "@lib/components/graphControls";
import { SurfaceMode, SurfaceGraph, type SurfacePoint } from "@lib/components/graphSurfaceRenderer";
import { createRandomGaussianSurface, evaluateGaussianSurface, generateGaussianSurfaceMatrix } from "@lib/utils/gaussianSurface";
import { generateNetworkSurfaceMatrix, getNetworkParametersInNodeOrder } from "@lib/utils/networkSurface";
import { redrawNeuralNetwork } from "@lib/components/neuralNetworkDiagram";

const networkViewElement = document.getElementById("networkView") as HTMLDivElement;
const networkDiagramCanvas = document.getElementById("networkDiagram") as HTMLCanvasElement;
const networkLayerControlsElement = document.getElementById("networkLayerControls") as HTMLTextAreaElement;
const networkControlsElement = document.getElementById("networkControls") as HTMLDivElement;
const gaussianControlsElement = document.getElementById("gaussianControls") as HTMLDivElement;
const scoreElement = document.getElementById("score") as HTMLDivElement;
const sliderTemplateElement = document.getElementById("parameterControlTemplate") as HTMLTemplateElement | null;
const modeToggleButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".modeToggleButton"));
const gaussianXSliderElement = document.getElementById("gaussian-x") as HTMLInputElement;
const gaussianYSliderElement = document.getElementById("gaussian-y") as HTMLInputElement;
const gaussianXValueElement = document.getElementById("gaussian-x-value") as HTMLSpanElement;
const gaussianYValueElement = document.getElementById("gaussian-y-value") as HTMLSpanElement;
const rotationSliderElement = document.getElementById("rotation-y") as HTMLInputElement;
const zoomSliderElement = document.getElementById("zoom-distance") as HTMLInputElement;
const ZOOM_SMOOTHING = 0.2;
const ZOOM_EPSILON = 0.001;

// const network = new Network([2, 4, 1]);
let network = new Network([2, 4, 4, 4, 1]);
const randomInput = Array.from({ length: 2 }, () => Math.random());
const gaussianInput: SurfacePoint = { x: 0, y: 0, z: 0 };
const gaussianSurface = createRandomGaussianSurface();
const networkSurfaceRange: [number, number] = [-10, 10];
const gaussianSurfaceRange: [number, number] = [-10, 10];
const surfaceStep = 0.2;

let surfaceMode: SurfaceMode = SurfaceMode.Gaussian;
let lastOrbitTheta: number | null = null;
let currentZoomSliderValue = parseFloat(zoomSliderElement.value);
let targetZoomSliderValue = currentZoomSliderValue;
let zoomAnimationFrameId: number | null = null;

function normaliseRotationDegrees(rotationDegrees: number): number {
    return (((rotationDegrees + 180) % 360) + 360) % 360 - 180;
}

function sliderValueToCameraDistance(sliderValue: number): number {
    return parseFloat(zoomSliderElement.max) - sliderValue + parseFloat(zoomSliderElement.min);
}

function applySmoothedZoom(): void {
    const delta = targetZoomSliderValue - currentZoomSliderValue;
    if (Math.abs(delta) < ZOOM_EPSILON) {
        currentZoomSliderValue = targetZoomSliderValue;
        graph.setCameraDistance(sliderValueToCameraDistance(currentZoomSliderValue));
        zoomAnimationFrameId = null;
        return;
    }

    currentZoomSliderValue += delta * ZOOM_SMOOTHING;
    graph.setCameraDistance(sliderValueToCameraDistance(currentZoomSliderValue));
    zoomAnimationFrameId = requestAnimationFrame(applySmoothedZoom);
}

function queueSmoothZoomTo(sliderValue: number): void {
    targetZoomSliderValue = Math.min(
        parseFloat(zoomSliderElement.max),
        Math.max(parseFloat(zoomSliderElement.min), sliderValue),
    );

    if (zoomAnimationFrameId === null) {
        zoomAnimationFrameId = requestAnimationFrame(applySmoothedZoom);
    }
}

function createDistinctParameterIndices(totalParameters: number): [number, number] {
    const firstIndex = Math.floor(Math.random() * totalParameters);
    let secondIndex: number;

    do {
        secondIndex = Math.floor(Math.random() * totalParameters);
    } while (secondIndex === firstIndex);

    return [firstIndex, secondIndex];
}

let selectedParameterIndices: [number, number] = createDistinctParameterIndices(network.weights.length + network.biases.length);

if (!sliderTemplateElement) {
    throw new Error("Missing parameterControlTemplate element");
}

const graph = new SurfaceGraph({
    container: document.body,
    initialRotationY: 0,
    initialCameraDistance: parseFloat(zoomSliderElement.max) - parseFloat(zoomSliderElement.value) + parseFloat(zoomSliderElement.min),
    onOrbitChanged: rotationY => {
        if (lastOrbitTheta === null) {
            lastOrbitTheta = rotationY;
            return;
        }

        const deltaRadians = Math.atan2(Math.sin(rotationY - lastOrbitTheta), Math.cos(rotationY - lastOrbitTheta));
        lastOrbitTheta = rotationY;
        const nextRotation = normaliseRotationDegrees(parseFloat(rotationSliderElement.value) + (deltaRadians * 180) / Math.PI);
        rotationSliderElement.value = String(nextRotation);
    },
});

window.addEventListener("resize", () => {
    graph.resize();
});

graph.getDomElement().addEventListener("wheel", event => {
    event.preventDefault();
    const nextValue = Math.min(
        parseFloat(zoomSliderElement.max),
        Math.max(parseFloat(zoomSliderElement.min), parseFloat(zoomSliderElement.value) - event.deltaY * 0.02),
    );
    zoomSliderElement.value = String(nextValue);
    zoomSliderElement.dispatchEvent(new Event("input", { bubbles: true }));
}, { passive: false });

let controls = createWeightAxisControls({
    container: networkControlsElement,
    template: sliderTemplateElement,
    network,
    initialSelectedParameterIndices: selectedParameterIndices,
    onWeightsChanged: weights => {
        network.weights = weights;
        updateScore();
    },
    onBiasesChanged: biases => {
        network.biases = biases;
        updateScore();
    },
    onSelectedParameterIndicesChanged: indices => {
        selectedParameterIndices = indices;
        updateScore();
    },
});

function setSurfaceMode(nextMode: SurfaceMode): void {
    surfaceMode = nextMode;
    networkViewElement.classList.toggle("hidden", surfaceMode === SurfaceMode.Gaussian);
    networkControlsElement.classList.toggle("hidden", surfaceMode === SurfaceMode.Gaussian);
    gaussianControlsElement.classList.toggle("hidden", surfaceMode === SurfaceMode.Network);
    for (const button of modeToggleButtons) {
        const isActive = button.dataset["mode"] === surfaceMode;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
    updateScore();
}

for (const button of modeToggleButtons) {
    button.addEventListener("click", () => {
        const nextMode = button.dataset["mode"] as SurfaceMode;
        setSurfaceMode(nextMode);
    });
}

rotationSliderElement.addEventListener("input", () => {
    const normalisedRotation = normaliseRotationDegrees(parseFloat(rotationSliderElement.value));
    lastOrbitTheta = null;
    rotationSliderElement.value = String(normalisedRotation);
    graph.setRotationY(normalisedRotation * Math.PI / 180);
});

zoomSliderElement.addEventListener("input", () => {
    queueSmoothZoomTo(parseFloat(zoomSliderElement.value));
});

function syncGaussianInputFromSliders(): void {
    gaussianInput.x = parseFloat(gaussianXSliderElement.value);
    gaussianInput.y = parseFloat(gaussianYSliderElement.value);
    gaussianXValueElement.textContent = MathExtra.formatNumber(gaussianInput.x, 5, 9);
    gaussianYValueElement.textContent = MathExtra.formatNumber(gaussianInput.y, 5, 9);
}

gaussianXSliderElement.addEventListener("input", () => {
    syncGaussianInputFromSliders();
    updateScore();
});

gaussianYSliderElement.addEventListener("input", () => {
    syncGaussianInputFromSliders();
    updateScore();
});

function updateScore() {
    if (surfaceMode === SurfaceMode.Network) {
        network.weights = controls.getWeights();
        network.biases = controls.getBiases();
        const output = network.predict(randomInput);
        scoreElement.textContent = `Score: ${MathExtra.formatNumber(output * 10000, 0, 6)}`;
        const vertices = generateNetworkSurfaceMatrix(network, randomInput, selectedParameterIndices, networkSurfaceRange, surfaceStep);
        const parameters = getNetworkParametersInNodeOrder(network);
        const currentPoint: SurfacePoint = {
            x: parameters[selectedParameterIndices[0]]!.value,
            y: parameters[selectedParameterIndices[1]]!.value,
            z: output,
        };
        graph.render({ vertices, currentPoint, range: networkSurfaceRange, step: surfaceStep });
        return;
    }

    const vertices = generateGaussianSurfaceMatrix(gaussianSurface, gaussianSurfaceRange, surfaceStep);
    const output = evaluateGaussianSurface(gaussianInput.x, gaussianInput.y, gaussianSurface);
    const currentPoint: SurfacePoint = {
        x: gaussianInput.x,
        y: gaussianInput.y,
        z: output,
    };

    scoreElement.textContent = `Score: ${MathExtra.formatNumber(output * 1000, 0, 6)}`;
    graph.render({ vertices, currentPoint, range: gaussianSurfaceRange, step: surfaceStep });
}

networkLayerControlsElement.addEventListener('input', () => {
    networkLayerControlsElement.value = networkLayerControlsElement.value.replace(/[^0-9 ]/g, '');
    const input = networkLayerControlsElement.value.trim();
    const newLayerSizes = input.split(' ').map(size => parseInt(size.trim(), 10)).filter(size => !isNaN(size) && size > 0);
    if (newLayerSizes.some(size => size > 50)) {
        alert("Layer size cannot be larger than 50");
        return;
    }
    network = new Network([...newLayerSizes, 1]);
    selectedParameterIndices = createDistinctParameterIndices(network.weights.length + network.biases.length);
    controls = createWeightAxisControls({
        container: networkControlsElement,
        template: sliderTemplateElement,
        network,
        initialSelectedParameterIndices: selectedParameterIndices,
        onWeightsChanged: weights => {
            network.weights = weights;
            updateScore();
        },
        onBiasesChanged: biases => {
            network.biases = biases;
            updateScore();
        },
        onSelectedParameterIndicesChanged: indices => {
            selectedParameterIndices = indices;
            updateScore();
        },
    });
    updateScore();
    redrawNeuralNetworkDiagram();
});

syncGaussianInputFromSliders();
setSurfaceMode(surfaceMode);
graph.resize();
updateScore();
redrawNeuralNetworkDiagram();
export function redrawNeuralNetworkDiagram() {
    redrawNeuralNetwork(network, networkDiagramCanvas);
};