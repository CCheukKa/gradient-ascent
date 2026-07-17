import { Network } from "@lib/components/neuralNetwork";
import { type Vertex } from "@lib/utils/graphSurface";

export type NetworkParameter =
    | {
        kind: "weight";
        layerIndex: number;
        nodeIndex: number;
        weightIndex: number;
        value: number;
    }
    | {
        kind: "bias";
        layerIndex: number;
        nodeIndex: number;
        value: number;
    };

export function getNetworkParametersInNodeOrder(network: Network): NetworkParameter[] {
    return network.layers.flatMap((layer, layerIndex) =>
        layer.nodes.flatMap((node, nodeIndex) => [
            ...node.weights.map((value, weightIndex) => ({
                kind: "weight" as const,
                layerIndex,
                nodeIndex,
                weightIndex,
                value,
            })),
            {
                kind: "bias" as const,
                layerIndex,
                nodeIndex,
                value: node.bias,
            },
        ])
    );
}

export function setNetworkParametersFromNodeOrder(network: Network, parameterValues: number[]): void {
    let index = 0;
    for (const layer of network.layers) {
        for (const node of layer.nodes) {
            for (let weightIndex = 0; weightIndex < node.weights.length; weightIndex++) {
                node.weights[weightIndex] = parameterValues[index++]!;
            }
            node.bias = parameterValues[index++]!;
        }
    }
}

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
    const currentParameters = getNetworkParametersInNodeOrder(network).map(parameter => parameter.value);

    for (let i = 0; i < numSteps; i++) {
        for (let j = 0; j < numSteps; j++) {
            const parameters = currentParameters.slice();
            parameters[selectedParameterIndices[0]] = range[0]! + i * step;
            parameters[selectedParameterIndices[1]] = range[0]! + j * step;
            setNetworkParametersFromNodeOrder(network, parameters);
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