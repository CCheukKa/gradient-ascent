import { MathExtra } from "@lib/utils/mathExtra";
import type { Network } from "./neuralNetwork";
import { redrawNeuralNetworkDiagram } from "@/script";
import { getNetworkParametersInNodeOrder, type NetworkParameter } from "@lib/utils/networkSurface";

export interface WeightAxisControlsOptions {
    container: HTMLElement;
    template: HTMLTemplateElement;
    network: Network;
    initialSelectedParameterIndices?: [number, number];
    onWeightsChanged: (weights: number[]) => void;
    onBiasesChanged: (biases: number[]) => void;
    onSelectedParameterIndicesChanged: (indices: [number, number]) => void;
}

export interface WeightAxisControls {
    sliders: HTMLInputElement[];
    getWeights: () => number[];
    getBiases: () => number[];
    getSelectedParameterIndices: () => [number, number];
}

export interface RangeSliderOptions {
    container: HTMLElement;
    label: string;
    id: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onInput: (value: number) => void;
}

export function createRangeSlider(options: RangeSliderOptions): HTMLInputElement {
    const wrapper = document.createElement("div");
    wrapper.className = "slider";

    const label = document.createElement("label");
    label.htmlFor = options.id;
    label.textContent = options.label;

    const input = document.createElement("input");
    input.type = "range";
    input.id = options.id;
    input.name = options.id;
    input.min = options.min.toString();
    input.max = options.max.toString();
    input.step = options.step.toString();
    input.value = options.value.toString();

    input.addEventListener("input", () => {
        options.onInput(parseFloat(input.value));
    });

    wrapper.append(label, input);
    options.container.appendChild(wrapper);
    return input;
}

export function createWeightAxisControls(options: WeightAxisControlsOptions): WeightAxisControls {
    while (options.container.firstChild) {
        if (options.container.firstChild !== options.template) {
            options.container.removeChild(options.container.firstChild);
        } else {
            break;
        }
    }

    const sliders: HTMLInputElement[] = [];
    const axisCheckboxes: HTMLInputElement[] = [];
    let selectedParameterIndices: [number, number] = options.initialSelectedParameterIndices ?? [0, 1];
    const parameters: NetworkParameter[] = getNetworkParametersInNodeOrder(options.network);
    const totalParameters = parameters.length;

    function getWeightsFromSliders(): number[] {
        const weights: number[] = [];
        for (let i = 0; i < parameters.length; i++) {
            if (parameters[i]!.kind === "weight") {
                weights.push(parseFloat(sliders[i]!.value));
            }
        }
        return weights;
    }

    function getBiasesFromSliders(): number[] {
        const biases: number[] = [];
        for (let i = 0; i < parameters.length; i++) {
            if (parameters[i]!.kind === "bias") {
                biases.push(parseFloat(sliders[i]!.value));
            }
        }
        return biases;
    }

    for (let i = 0; i < parameters.length; i++) {
        const parameter = parameters[i]!;
        const sliderClone = options.template.content.cloneNode(true) as DocumentFragment;
        const sliderLabelText = sliderClone.querySelector(".parameterLabelText") as HTMLSpanElement;
        const sliderCheckbox = sliderClone.querySelector(".parameterAxisCheckbox") as HTMLInputElement;
        const sliderInput = sliderClone.querySelector(".parameterControlSlider") as HTMLInputElement;
        const sliderValueDisplay = sliderClone.querySelector(".parameterControlValue") as HTMLSpanElement;

        const parameterId = `${parameter.kind}-${parameter.layerIndex}-${parameter.nodeIndex}${parameter.kind === "weight" ? `-${parameter.weightIndex}` : ""}`;
        sliderInput.id = parameterId;
        sliderInput.name = parameterId;
        sliderInput.value = parameter.value.toString();

        const layerCode = parameter.kind === "weight" && parameter.weightIndex === 0 ? `L${(parameter.layerIndex + 1).toString().padStart(2, "0")}` : "   ";
        const nodeCode = parameter.kind === "weight" && parameter.weightIndex === 0 ? `N${(parameter.nodeIndex + 1).toString().padStart(2, "0")}` : "   ";
        const lineSymbol =
            parameter.kind === "bias"
                ? "└"
                : parameter.weightIndex === 0
                    ? "┬"
                    : "├";

        // sliderLabelText.textContent = `${parameter.kind === "weight" ? "Weight" : "Bias"} ${layerCode} ${nodeCode} ${parameter.kind === "weight" ? `W${(parameter.weightIndex + 1).toString().padStart(2, "0")}` : "B  "}`;
        sliderLabelText.textContent = `${layerCode} ${nodeCode} ${lineSymbol} ${parameter.kind === "weight" ? `W${(parameter.weightIndex + 1).toString().padStart(2, "0")}` : "B  "}`;

        sliderCheckbox.checked = selectedParameterIndices.includes(i);
        sliderCheckbox.title = "Use as graph axis";
        sliderCheckbox.ariaLabel = `Use ${sliderLabelText.textContent} as graph axis`;

        sliderCheckbox.addEventListener("change", () => {
            selectedParameterIndices = getNextSelectedParameterIndices(selectedParameterIndices, i, sliderCheckbox.checked, totalParameters);
            applyAxisCheckboxState(axisCheckboxes, selectedParameterIndices);
            options.onSelectedParameterIndicesChanged(selectedParameterIndices);
        });

        axisCheckboxes.push(sliderCheckbox);

        sliderInput.addEventListener("input", () => {
            if (sliderValueDisplay) {
                sliderValueDisplay.textContent = MathExtra.formatNumber(parseFloat(sliderInput.value), 5, 9);
            }
            options.onWeightsChanged(getWeightsFromSliders());
            options.onBiasesChanged(getBiasesFromSliders());
            redrawNeuralNetworkDiagram();
        });

        if (sliderValueDisplay) {
            sliderValueDisplay.textContent = MathExtra.formatNumber(parseFloat(sliderInput.value), 5, 9);
        }

        options.container.insertBefore(sliderClone, options.template);
        sliders.push(sliderInput);
    }

    function syncAxisCheckboxes(): void {
        applyAxisCheckboxState(axisCheckboxes, selectedParameterIndices);
    }

    syncAxisCheckboxes();

    return {
        sliders,
        getWeights: getWeightsFromSliders,
        getBiases: getBiasesFromSliders,
        getSelectedParameterIndices: () => selectedParameterIndices,
    };
}

function applyAxisCheckboxState(axisCheckboxes: HTMLInputElement[], selectedParameterIndices: [number, number]) {
    for (let i = 0; i < axisCheckboxes.length; i++) {
        axisCheckboxes[i]!.checked = selectedParameterIndices.includes(i);
    }
}

function getNextSelectedParameterIndices(
    currentSelection: [number, number],
    changedIndex: number,
    isChecked: boolean,
    totalParameters: number,
): [number, number] {
    const nextSelection = currentSelection.filter(index => index !== changedIndex);

    if (isChecked) {
        if (nextSelection.length >= 2) {
            nextSelection.shift();
        }
        nextSelection.push(changedIndex);
    }

    while (nextSelection.length < 2) {
        const fallbackIndex = Array.from({ length: totalParameters }, (_, index) => index).find(index => !nextSelection.includes(index));
        if (fallbackIndex === undefined) {
            break;
        }
        nextSelection.push(fallbackIndex);
    }

    return [nextSelection[0]!, nextSelection[1] ?? nextSelection[0]!];
}