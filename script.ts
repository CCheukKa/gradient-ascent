import { Network } from "@lib/components/neuralNetwork";
import { MathExtra } from "@lib/utils/mathExtra";
import { createWeightAxisControls } from "@lib/components/graphControls";
import { SurfaceMode, NetworkSurfaceGraph } from "@lib/components/networkSurfaceGraph";
import { createRandomGaussianSurface } from "@lib/utils/graphSurface";

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
const gaussianInput: [number, number] = [0, 0];
const gaussianSurface = createRandomGaussianSurface();

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

const graph = new NetworkSurfaceGraph({
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
    gaussianInput[0] = parseFloat(gaussianXSliderElement.value);
    gaussianInput[1] = parseFloat(gaussianYSliderElement.value);
    gaussianXValueElement.textContent = MathExtra.formatNumber(gaussianInput[0], 5, 9);
    gaussianYValueElement.textContent = MathExtra.formatNumber(gaussianInput[1], 5, 9);
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
        graph.render({
            kind: SurfaceMode.Network,
            network,
            randomInput,
            selectedParameterIndices,
        });
        return;
    }

    const output = gaussianSurface.reduce((sum, bump) => {
        const dx = gaussianInput[0] - bump.centerX;
        const dy = gaussianInput[1] - bump.centerY;
        const distanceSquared = dx * dx + dy * dy;
        const sigmaSquared = bump.sigma * bump.sigma;
        return sum + bump.amplitude * Math.exp(-distanceSquared / (2 * sigmaSquared));
    }, 0);

    scoreElement.textContent = `Score: ${MathExtra.formatNumber(output * 1000, 0, 6)}`;
    graph.render({
        kind: SurfaceMode.Gaussian,
        input: gaussianInput,
        bumps: gaussianSurface,
    });
}

syncGaussianInputFromSliders();
setSurfaceMode(surfaceMode);
updateScore();
