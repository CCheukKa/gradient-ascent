import { Network } from "@lib/components/neuralNetwork";
import * as THREE from "three";

export interface Vertex {
    x: number;
    y: number;
    z: number;
}

export interface GaussianBump {
    centerX: number;
    centerY: number;
    amplitude: number;
    sigma: number;
}

export function getHeightColor(normalizedZ: number): THREE.Color {
    const clampedZ = THREE.MathUtils.clamp(normalizedZ, 0, 1);
    const blue = new THREE.Color(0x1e3a8a);
    const yellow = new THREE.Color(0xfde047);
    const red = new THREE.Color(0xef4444);

    if (clampedZ <= 0.5) {
        return blue.clone().lerp(yellow, clampedZ * 2);
    }

    return yellow.clone().lerp(red, (clampedZ - 0.5) * 2);
}

export function generateOutputScoreMatrix(
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

export function createRandomGaussianSurface(): GaussianBump[] {
    return Array.from({ length: 10 }, () => ({
        centerX: Math.random() * 12 - 6,
        centerY: Math.random() * 12 - 6,
        amplitude: Math.random() * 1.5 + 0.5,
        sigma: Math.random() * 1.5 + 0.5,
    }));
}

export function evaluateGaussianSurface(x: number, y: number, bumps: GaussianBump[]): number {
    return bumps.reduce((sum, bump) => {
        const dx = x - bump.centerX;
        const dy = y - bump.centerY;
        const distanceSquared = dx * dx + dy * dy;
        const sigmaSquared = bump.sigma * bump.sigma;
        return sum + bump.amplitude * Math.exp(-distanceSquared / (2 * sigmaSquared));
    }, 0);
}

export function generateGaussianSurfaceMatrix(
    bumps: GaussianBump[],
    range: [number, number],
    step: number,
): Vertex[] {
    const surface: Vertex[] = [];
    const numSteps = Math.floor((range[1] - range[0]) / step) + 1;

    for (let i = 0; i < numSteps; i++) {
        for (let j = 0; j < numSteps; j++) {
            const x = range[0]! + i * step;
            const y = range[0]! + j * step;
            surface.push({
                x,
                y,
                z: evaluateGaussianSurface(x, y, bumps),
            });
        }
    }

    return surface;
}