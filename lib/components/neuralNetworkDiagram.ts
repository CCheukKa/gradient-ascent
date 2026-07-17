import { MathExtra } from "@lib/utils/mathExtra";
import type { Network } from "./neuralNetwork";
import { drawCircle, drawLine, interpolateColour } from "@lib/utils/canvasUtils";

const LOW_COLOUR = '#3968e8';
// const MID_COLOUR = '#f147fd';
const HIGH_COLOUR = '#ff4d4d';

export function redrawNeuralNetwork(network: Network, canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // calculate node positions
    if (network.layers.length === 0 || network.layers[0]!.nodes.length === 0) {
        return;
    }

    const inputLayerSize = network.layers[0]!.nodes[0]!.weights.length;
    const layerSizes = [inputLayerSize, ...network.layers.map(layer => layer.nodes.length)];

    const layerCount = layerSizes.length;
    const maxLayerSize = Math.max(...layerSizes);
    const nodeRadius = Math.min(
        canvas.height / maxLayerSize / 2 - 2,
        canvas.width / layerCount / 2 - 3,
        40,
    );
    const nodeHeight = canvas.height / maxLayerSize;
    const layerWidth = (canvas.width - nodeRadius * 2) / (layerCount - 1);
    const nodePositions: { x: number; y: number; }[][] = [];
    for (let i = 0; i < layerCount; i++) {
        const layerSize = layerSizes[i]!;
        const layerX = nodeRadius + i * layerWidth;
        nodePositions[i] = [];
        const totalNodesHeight = layerSize * nodeHeight;
        const verticalOffset = (canvas.height - totalNodesHeight) / 2;
        for (let j = 0; j < layerSize; j++) {
            const nodeY = verticalOffset + j * nodeHeight + nodeHeight / 2;
            nodePositions[i]!.push({ x: layerX, y: nodeY });
        }
    }

    // draw connections
    for (let i = 0; i < layerCount - 1; i++) {
        const previousLayerSize = layerSizes[i]!;
        const thisLayerSize = layerSizes[i + 1]!;
        for (let j = 0; j < thisLayerSize; j++) {
            const { x: x1, y: y1 } = nodePositions[i + 1]![j]!;
            for (let k = 0; k < previousLayerSize; k++) {
                const { x: x2, y: y2 } = nodePositions[i]![k]!;

                const weight = network.layers[i]!.nodes[j]!.weights[k]!;
                const absoluteWeight = Math.abs(weight);
                const alpha = MathExtra.interpolate(absoluteWeight, [0, 8], [0.5, 0.8]);
                const width = MathExtra.interpolate(absoluteWeight, [0, 8], [0.5, 5]);
                const { r, g, b } = interpolateColour(LOW_COLOUR, HIGH_COLOUR, MathExtra.interpolate(weight, [-6, 6], [0, 1]));
                drawLine(ctx, x1, y1, x2, y2, width, `rgba(${r}, ${g}, ${b}, ${alpha})`);
            }
        }
    }

    // draw nodes
    for (let i = 0; i < layerCount; i++) {
        const layerSize = layerSizes[i]!;
        for (let j = 0; j < layerSize; j++) {
            const { x, y } = nodePositions[i]![j]!;
            if (i === 0 || i === layerCount - 1) {
                drawCircle(ctx, x, y, nodeRadius, '#ffffff');
            } else {
                const bias = network.layers[i - 1]!.nodes[j]!.bias;
                const { r, g, b } = interpolateColour(LOW_COLOUR, HIGH_COLOUR, MathExtra.interpolate(bias, [-8, 8], [0, 1]));
                // const { r, g, b } = bias < 0
                //     ? interpolateColour(LOW_COLOUR, MID_COLOUR, MathExtra.interpolate(bias, [-8, 2], [0, 1]))
                //     : interpolateColour(MID_COLOUR, HIGH_COLOUR, MathExtra.interpolate(bias, [-2, 8], [0, 1]));
                drawCircle(ctx, x, y, nodeRadius, `rgba(${r}, ${g}, ${b}, 1)`);
                drawCircle(ctx, x, y, nodeRadius, '#ffffff', true);
            }
        }
    }
    return;
}