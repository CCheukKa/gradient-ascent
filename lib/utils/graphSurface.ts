import * as THREE from "three";
import { MathExtra } from "./mathExtra";

export interface Vertex {
    x: number;
    y: number;
    z: number;
}

export function getHeightColor(normalisedZ: number): THREE.Color {
    const clampedZ = THREE.MathUtils.clamp(normalisedZ, 0, 1);
    const blue = new THREE.Color("#1e54ea");
    const green = new THREE.Color("#62da62");
    const yellow = new THREE.Color("#fde047");
    const orange = new THREE.Color("#ff7f00");
    const red = new THREE.Color("#ff0f0f");


    if (clampedZ <= 0.25) { return blue.clone().lerp(green, MathExtra.interpolate(clampedZ, [0, 0.25], [0, 1])); }
    if (clampedZ <= 0.5) { return green.clone().lerp(yellow, MathExtra.interpolate(clampedZ, [0.25, 0.5], [0, 1])); }
    if (clampedZ <= 0.75) { return yellow.clone().lerp(orange, MathExtra.interpolate(clampedZ, [0.5, 0.75], [0, 1])); }
    if (clampedZ <= 1) { return orange.clone().lerp(red, MathExtra.interpolate(clampedZ, [0.75, 1], [0, 1])); }
    throw new Error("normalisedZ must be in the range [0, 1]");
}
