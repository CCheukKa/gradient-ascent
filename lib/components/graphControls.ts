import { MathExtra } from "@lib/utils/mathExtra";
import { redrawNeuralNetworkDiagram } from "@/script";

export interface WeightAxisControlsOptions {
    container: HTMLElement;
    template: HTMLTemplateElement;
    weights: number[];
    biases: number[];
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
    const sliders: HTMLInputElement[] = [];
    const axisCheckboxes: HTMLInputElement[] = [];
    let selectedParameterIndices: [number, number] = options.initialSelectedParameterIndices ?? [0, 1];
    const totalWeights = options.weights.length;
    const totalParameters = totalWeights + options.biases.length;

    const parameters = [
        ...options.weights.map((value, index) => ({ kind: "weight" as const, index, value })),
        ...options.biases.map((value, index) => ({ kind: "bias" as const, index, value })),
    ];

    for (let i = 0; i < parameters.length; i++) {
        const parameter = parameters[i]!;
        const sliderClone = options.template.content.cloneNode(true) as DocumentFragment;
        const sliderLabel = sliderClone.querySelector("label") as HTMLLabelElement;
        const sliderInput = sliderClone.querySelector("input") as HTMLInputElement;
        const sliderValueDisplay = sliderClone.querySelector("#value") as HTMLSpanElement | null;

        sliderInput.id = `${parameter.kind}-${parameter.index}`;
        sliderInput.name = `${parameter.kind}-${parameter.index}`;
        sliderInput.value = parameter.value.toString();

        sliderLabel.textContent = `${parameter.kind === "weight" ? "Weight" : "Bias"} ${parameter.index}`;

        const axisCheckbox = document.createElement("input");
        axisCheckbox.type = "checkbox";
        axisCheckbox.checked = selectedParameterIndices.includes(i);
        axisCheckbox.style.marginLeft = "8px";
        axisCheckbox.title = "Use as graph axis";
        axisCheckbox.ariaLabel = `Use ${sliderLabel.textContent} as graph axis`;

        axisCheckbox.addEventListener("change", () => {
            selectedParameterIndices = getNextSelectedParameterIndices(selectedParameterIndices, i, axisCheckbox.checked, totalParameters);
            applyAxisCheckboxState(axisCheckboxes, selectedParameterIndices);
            options.onSelectedParameterIndicesChanged(selectedParameterIndices);
        });

        axisCheckboxes.push(axisCheckbox);
        sliderLabel.appendChild(axisCheckbox);

        sliderInput.addEventListener("input", () => {
            if (sliderValueDisplay) {
                sliderValueDisplay.textContent = MathExtra.formatNumber(parseFloat(sliderInput.value), 5, 9);
            }
            if (parameter.kind === "weight") {
                options.onWeightsChanged(sliders.slice(0, totalWeights).map(slider => parseFloat(slider.value)));
            } else {
                options.onBiasesChanged(sliders.slice(totalWeights).map(slider => parseFloat(slider.value)));
            }
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
        getWeights: () => sliders.slice(0, totalWeights).map(slider => parseFloat(slider.value)),
        getBiases: () => sliders.slice(totalWeights).map(slider => parseFloat(slider.value)),
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