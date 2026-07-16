import { Network } from "@lib/components/neuralNetwork";
import { MathExtra } from "@lib/utils/mathExtra";
import { createWeightAxisControls } from "@lib/components/graphControls";
import { SurfaceMode, SurfaceGraph, type SurfacePoint } from "@lib/components/graphSurfaceRenderer";
import { createRandomGaussianSurface, evaluateGaussianSurface, generateGaussianSurfaceMatrix } from "@lib/utils/gaussianSurface";
import { generateNetworkSurfaceMatrix } from "@lib/utils/networkSurface";

const networkControlsElement = document.getElementById("networkControls") as HTMLDivElement;
const gaussianControlsElement = document.getElementById("gaussianControls") as HTMLDivElement;
const scoreElement = document.getElementById("score") as HTMLDivElement;
const sliderTemplateElement = document.getElementById("sliderTemplate") as HTMLTemplateElement;
const modeToggleButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".modeToggleButton"));
const gaussianXSliderElement = document.getElementById("gaussian-x") as HTMLInputElement;
const gaussianYSliderElement = document.getElementById("gaussian-y") as HTMLInputElement;
const gaussianXValueElement = document.getElementById("gaussian-x-value") as HTMLSpanElement;
const gaussianYValueElement = document.getElementById("gaussian-y-value") as HTMLSpanElement;
const rotationSliderElement = document.getElementById("rotation-y") as HTMLInputElement;
const zoomSliderElement = document.getElementById("zoom-distance") as HTMLInputElement;

const network = new Network([2, 4, 1]);
const randomInput = Array.from({ length: 2 }, () => Math.random());
const gaussianInput: SurfacePoint = { x: 0, y: 0, z: 0 };
const gaussianSurface = createRandomGaussianSurface();
const networkSurfaceRange: [number, number] = [-10, 10];
const gaussianSurfaceRange: [number, number] = [-10, 10];
const surfaceStep = 0.2;

let surfaceMode: SurfaceMode = SurfaceMode.Gaussian;

function createDistinctParameterIndices(totalParameters: number): [number, number] {
    const firstIndex = Math.floor(Math.random() * totalParameters);
    let secondIndex: number;

    do {
        secondIndex = Math.floor(Math.random() * totalParameters);
    } while (secondIndex === firstIndex);

    return [firstIndex, secondIndex];
}

let selectedParameterIndices: [number, number] = createDistinctParameterIndices(network.weights.length + network.biases.length);

const graph = new SurfaceGraph({
    container: document.body,
    initialRotationY: 0,
    initialCameraDistance: 10,
});

const controls = createWeightAxisControls({
    container: networkControlsElement,
    template: sliderTemplateElement,
    weights: network.weights,
    biases: network.biases,
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
    networkControlsElement.hidden = surfaceMode === SurfaceMode.Gaussian;
    gaussianControlsElement.hidden = surfaceMode === SurfaceMode.Network;
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
    graph.setRotationY((parseFloat(rotationSliderElement.value) * Math.PI) / 180);
});

zoomSliderElement.addEventListener("input", () => {
    graph.setCameraDistance(parseFloat(zoomSliderElement.value));
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
        const currentPoint: SurfacePoint = {
            x: [...network.weights, ...network.biases][selectedParameterIndices[0]]!,
            y: [...network.weights, ...network.biases][selectedParameterIndices[1]]!,
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

syncGaussianInputFromSliders();
setSurfaceMode(surfaceMode);
updateScore();
