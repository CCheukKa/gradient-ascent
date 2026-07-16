import { type Vertex } from "@lib/utils/graphSurface";

interface GaussianBump {
    centerX: number;
    centerY: number;
    amplitude: number;
    sigma: number;
}

export function createRandomGaussianSurface(): GaussianBump[] {
    return Array.from({ length: 80 }, () => ({
        centerX: Math.random() * 24 - 10,
        centerY: Math.random() * 24 - 10,
        amplitude: Math.random() * 5 - 2,
        sigma: Math.random() * 2 + 0.5,
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