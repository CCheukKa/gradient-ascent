import * as THREE from "three";

export interface Vertex {
    x: number;
    y: number;
    z: number;
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
