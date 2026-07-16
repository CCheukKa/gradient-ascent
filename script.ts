import { Network } from "@lib/components/neuralNetwork";
import { MathExtra } from "@lib/utils/mathExtra";
import { createRangeSlider, createWeightAxisControls } from "@lib/components/graphControls";
import { WeightSurfaceGraph } from "@lib/components/weightSurfaceGraph";

const mainContainerElement = document.getElementById("mainContainer") as HTMLDivElement;
const scoreElement = document.getElementById("score") as HTMLDivElement;
const sliderTemplateElement = document.getElementById("sliderTemplate") as HTMLTemplateElement;

const network = new Network([2, 4, 2, 1]);
const randomInput = Array.from({ length: 2 }, () => Math.random());

function createDistinctWeightIndices(totalWeights: number): [number, number] {
    const firstIndex = Math.floor(Math.random() * totalWeights);
    let secondIndex: number;

    do {
        secondIndex = Math.floor(Math.random() * totalWeights);
    } while (secondIndex === firstIndex);

    return [firstIndex, secondIndex];
}

let selectedWeightIndices: [number, number] = createDistinctWeightIndices(network.weights.length);

const graph = new WeightSurfaceGraph({
    container: document.body,
    initialRotationY: 0,
    initialCameraDistance: 10,
});

const controls = createWeightAxisControls({
    container: mainContainerElement,
    template: sliderTemplateElement,
    weights: network.weights,
    initialSelectedWeightIndices: selectedWeightIndices,
    onWeightsChanged: weights => {
        network.weights = weights;
        updateScore();
    },
    onSelectedWeightIndicesChanged: indices => {
        selectedWeightIndices = indices;
        updateScore();
    },
});

createRangeSlider({
    container: mainContainerElement,
    label: "Rotate:",
    id: "rotation-y",
    min: -180,
    max: 180,
    step: 1,
    value: 0,
    onInput: value => graph.setRotationY((value * Math.PI) / 180),
});

createRangeSlider({
    container: mainContainerElement,
    label: "Zoom:",
    id: "zoom-distance",
    min: 10,
    max: 20,
    step: 0.01,
    value: 10,
    onInput: value => graph.setCameraDistance(value),
});

function updateScore() {
    network.weights = controls.getWeights();
    const output = network.predict(randomInput);
    scoreElement.textContent = `Score: ${MathExtra.formatNumber(output * 10000, 0, 6)}`;
    graph.render(network, randomInput, selectedWeightIndices);
}

updateScore();
