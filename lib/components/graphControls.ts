import { MathExtra } from "@lib/utils/mathExtra";

export interface WeightAxisControlsOptions {
    container: HTMLElement;
    template: HTMLTemplateElement;
    weights: number[];
    initialSelectedWeightIndices?: [number, number];
    onWeightsChanged: (weights: number[]) => void;
    onSelectedWeightIndicesChanged: (indices: [number, number]) => void;
}

export interface WeightAxisControls {
    sliders: HTMLInputElement[];
    getWeights: () => number[];
    getSelectedWeightIndices: () => [number, number];
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
    let selectedWeightIndices: [number, number] = options.initialSelectedWeightIndices ?? [0, 1];

    for (let i = 0; i < options.weights.length; i++) {
        const sliderClone = options.template.content.cloneNode(true) as DocumentFragment;
        const sliderLabel = sliderClone.querySelector("label") as HTMLLabelElement;
        const sliderInput = sliderClone.querySelector("input") as HTMLInputElement;
        const sliderValueDisplay = sliderClone.querySelector("#value") as HTMLSpanElement | null;

        sliderInput.id = `weight-${i}`;
        sliderInput.name = `weight-${i}`;
        sliderInput.value = options.weights[i]!.toString();

        sliderLabel.textContent = `Weight ${i}`;

        const axisCheckbox = document.createElement("input");
        axisCheckbox.type = "checkbox";
        axisCheckbox.checked = selectedWeightIndices.includes(i);
        axisCheckbox.style.marginLeft = "8px";
        axisCheckbox.title = "Use as graph axis";
        axisCheckbox.ariaLabel = `Use weight ${i} as graph axis`;

        axisCheckbox.addEventListener("change", () => {
            selectedWeightIndices = getNextSelectedWeightIndices(selectedWeightIndices, i, axisCheckbox.checked, options.weights.length);
            applyAxisCheckboxState(axisCheckboxes, selectedWeightIndices);
            options.onSelectedWeightIndicesChanged(selectedWeightIndices);
        });

        axisCheckboxes.push(axisCheckbox);
        sliderLabel.appendChild(axisCheckbox);

        sliderInput.addEventListener("input", () => {
            if (sliderValueDisplay) {
                sliderValueDisplay.textContent = MathExtra.formatNumber(parseFloat(sliderInput.value), 5, 9);
            }
            options.onWeightsChanged(sliders.map(slider => parseFloat(slider.value)));
        });

        if (sliderValueDisplay) {
            sliderValueDisplay.textContent = MathExtra.formatNumber(parseFloat(sliderInput.value), 5, 9);
        }

        options.container.appendChild(sliderClone);
        sliders.push(sliderInput);
    }

    function syncAxisCheckboxes(): void {
        applyAxisCheckboxState(axisCheckboxes, selectedWeightIndices);
    }

    syncAxisCheckboxes();

    return {
        sliders,
        getWeights: () => sliders.map(slider => parseFloat(slider.value)),
        getSelectedWeightIndices: () => selectedWeightIndices,
    };
}

function applyAxisCheckboxState(axisCheckboxes: HTMLInputElement[], selectedWeightIndices: [number, number]) {
    for (let i = 0; i < axisCheckboxes.length; i++) {
        axisCheckboxes[i]!.checked = selectedWeightIndices.includes(i);
    }
}

function getNextSelectedWeightIndices(
    currentSelection: [number, number],
    changedIndex: number,
    isChecked: boolean,
    totalWeights: number,
): [number, number] {
    const nextSelection = currentSelection.filter(index => index !== changedIndex);

    if (isChecked) {
        if (nextSelection.length >= 2) {
            nextSelection.shift();
        }
        nextSelection.push(changedIndex);
    }

    while (nextSelection.length < 2) {
        const fallbackIndex = Array.from({ length: totalWeights }, (_, index) => index).find(index => !nextSelection.includes(index));
        if (fallbackIndex === undefined) {
            break;
        }
        nextSelection.push(fallbackIndex);
    }

    return [nextSelection[0]!, nextSelection[1] ?? nextSelection[0]!];
}