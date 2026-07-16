import { Network } from "@lib/components/neuralNetwork";
import { type Vertex } from "@lib/utils/graphSurface";

export function generateNetworkSurfaceMatrix(
    network: Network,
    randomInput: number[],
    selectedParameterIndices: [number, number],
    range: [number, number],
    step: number,
): Vertex[] {
    const outputScoreMatrix: Vertex[] = [];
    const numSteps = Math.floor((range[1] - range[0]) / step) + 1;
    const currentWeights = network.weights.slice();
    const currentBiases = network.biases.slice();
    const weightCount = currentWeights.length;
    const currentParameters = [...currentWeights, ...currentBiases];

    for (let i = 0; i < numSteps; i++) {
        for (let j = 0; j < numSteps; j++) {
            const parameters = currentParameters.slice();
            parameters[selectedParameterIndices[0]] = range[0]! + i * step;
            parameters[selectedParameterIndices[1]] = range[0]! + j * step;
            network.weights = parameters.slice(0, weightCount);
            network.biases = parameters.slice(weightCount);
            const output = network.predict(randomInput);
            outputScoreMatrix.push({
                x: parameters[selectedParameterIndices[0]]!,
                y: parameters[selectedParameterIndices[1]]!,
                z: output,
            });
        }
    }

    network.weights = currentWeights;
    network.biases = currentBiases;
    return outputScoreMatrix;
}