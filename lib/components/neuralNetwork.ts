class LNodes {
    public weights: number[];
    public bias: number;

    constructor(numInputs: number) {
        this.weights = Array.from({ length: numInputs }).map(() => Math.random() * 10 - 5);
        this.bias = Math.random() * 10 - 5;
    }
}
class Layer {
    public nodes: LNodes[];

    constructor(numInputs: number, numNodes: number) {
        this.nodes = Array.from({ length: numNodes }, () => new LNodes(numInputs));
    }
}
export class Network {
    //! use the most chaotic function possible
    // public static activationFunction = (x: number): number => x * x * x * (Math.exp(-x * x) + 0.002);
    public static activationFunction = (x: number): number => 1 * Math.sin(x) * Math.exp(-Math.pow(x / 8, 2));
    public layers: Layer[];

    constructor(layerSizes: number[]) {
        if (layerSizes[layerSizes.length - 1] !== 1) {
            throw new Error("The last layer must have exactly one node.");
        }
        const inputNodes = layerSizes[0]!;
        this.layers = layerSizes.slice(1).map((numNodes, index) => {
            const numInputs = index === 0 ? inputNodes : layerSizes[index]!;
            return new Layer(numInputs, numNodes);
        });
    }

    get weights(): number[] {
        const weights: number[] = [];
        for (const layer of this.layers) {
            for (const node of layer.nodes) {
                weights.push(...node.weights);
            }
        }
        return weights;
    }
    set weights(values: number[]) {
        let index = 0;
        for (const layer of this.layers) {
            for (const node of layer.nodes) {
                for (let i = 0; i < node.weights.length; i++) {
                    node.weights[i] = values[index++]!;
                }
            }
        }
    }

    get biases(): number[] {
        const biases: number[] = [];
        for (const layer of this.layers) {
            for (const node of layer.nodes) {
                biases.push(node.bias);
            }
        }
        return biases;
    }
    set biases(values: number[]) {
        let index = 0;
        for (const layer of this.layers) {
            for (const node of layer.nodes) {
                node.bias = values[index++]!;
            }
        }
    }

    public predict(inputs: number[]): number {
        if (inputs.length !== this.layers[0]!.nodes[0]!.weights.length) {
            throw new Error(`Expected ${this.layers[0]!.nodes[0]!.weights.length} inputs, but got ${inputs.length}`);
        }

        let output = inputs;
        for (const layer of this.layers) {
            output = layer.nodes.map(node => {
                const weightedSum = node.weights.reduce((sum, weight, index) => sum + weight * output[index]!, 0);
                return Network.activationFunction(weightedSum + node.bias);
            });
        }
        if (output.length !== 1) {
            throw new Error(`Expected 1 output, but got ${output.length}`);
        }
        return output[0]!;
    }
}