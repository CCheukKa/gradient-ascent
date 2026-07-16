import { Network } from "@lib/components/neuralNetwork";
import * as THREE from "three";
import {
    evaluateGaussianSurface,
    generateGaussianSurfaceMatrix,
    generateOutputScoreMatrix,
    getHeightColor,
    type GaussianBump,
} from "@lib/utils/graphSurface";

export enum SurfaceMode {
    Network = "network",
    Gaussian = "gaussian"
}

export type SurfaceRenderMode =
    | {
        kind: SurfaceMode.Network;
        network: Network;
        randomInput: number[];
        selectedParameterIndices: [number, number];
    }
    | {
        kind: SurfaceMode.Gaussian;
        input: [number, number];
        bumps: GaussianBump[];
    };

export interface NetworkSurfaceGraphOptions {
    container: HTMLElement;
    initialRotationY?: number;
    initialCameraDistance?: number;
}

export class NetworkSurfaceGraph {
    private readonly scene: THREE.Scene;
    private readonly camera: THREE.PerspectiveCamera;
    private readonly renderer: THREE.WebGLRenderer;
    private readonly graphMaterial: THREE.MeshPhongMaterial;
    private readonly graphLineMaterial: THREE.LineBasicMaterial;
    private readonly currentPointMaterial: THREE.MeshBasicMaterial;
    private readonly cameraDirection = new THREE.Vector3(1, 1, 1).normalize();
    private readonly currentPointBaseRadius = 0.035;
    private readonly currentPointScreenRadius = 5;
    private readonly currentPointWorldPosition = new THREE.Vector3();

    private graphGroup: THREE.Group | null = null;
    private currentPointAnchor: THREE.Group | null = null;
    private currentPointVisual: THREE.Group | null = null;

    private graphRotationY: number;
    private cameraDistance: number;

    constructor(options: NetworkSurfaceGraphOptions) {
        this.graphRotationY = options.initialRotationY ?? 0;
        this.cameraDistance = options.initialCameraDistance ?? 10;

        this.scene = new THREE.Scene();
        this.scene.background = null;

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setSize(Math.ceil(window.innerWidth), Math.ceil(window.innerHeight));
        this.renderer.domElement.classList.add("three-graph");
        options.container.appendChild(this.renderer.domElement);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(3, 4, 5);
        this.scene.add(directionalLight);

        this.graphMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            specular: 0xffffff,
            shininess: 1,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            vertexColors: true,
        });

        this.graphLineMaterial = new THREE.LineBasicMaterial({
            color: 0xc7d2ff,
            transparent: true,
            opacity: 0.35,
        });

        this.currentPointMaterial = new THREE.MeshBasicMaterial({
            color: 0xff3b3b,
        });

        this.updateCameraPosition();
    }

    public setRotationY(rotationY: number): void {
        this.graphRotationY = rotationY;
        if (this.graphGroup) {
            this.graphGroup.rotation.y = this.graphRotationY;
        }
        this.renderScene();
    }

    public setCameraDistance(cameraDistance: number): void {
        this.cameraDistance = cameraDistance;
        this.updateCameraPosition();
        this.updateCurrentPointScreenSize();
        this.renderScene();
    }

    public render(options: SurfaceRenderMode): void {
        const isNetworkMode = options.kind === SurfaceMode.Network;
        const range: [number, number] = isNetworkMode ? [-10, 10] : [-6, 6];
        const step = 0.2;
        const vertices = isNetworkMode
            ? generateOutputScoreMatrix(options.network, options.randomInput, options.selectedParameterIndices, range, step)
            : generateGaussianSurfaceMatrix(options.bumps, range, step);
        const numSteps = Math.floor((range[1] - range[0]) / step) + 1;
        const positions = new Float32Array(vertices.length * 3);
        const colors = new Float32Array(vertices.length * 3);
        const indices: number[] = [];
        const linePositions: number[] = [];
        let minZ = Number.POSITIVE_INFINITY;
        let maxZ = Number.NEGATIVE_INFINITY;

        for (let i = 0; i < vertices.length; i++) {
            minZ = Math.min(minZ, vertices[i]!.z);
            maxZ = Math.max(maxZ, vertices[i]!.z);

            positions[i * 3 + 0] = vertices[i]!.x;
            positions[i * 3 + 1] = vertices[i]!.z;
            positions[i * 3 + 2] = vertices[i]!.y;
        }

        const zRange = Math.max(maxZ - minZ, 0.0001);
        for (let i = 0; i < vertices.length; i++) {
            const normalizedZ = (vertices[i]!.z - minZ) / zRange;
            const vertexColor = getHeightColor(normalizedZ);
            colors[i * 3 + 0] = vertexColor.r;
            colors[i * 3 + 1] = vertexColor.g;
            colors[i * 3 + 2] = vertexColor.b;
        }

        for (let x = 0; x < numSteps - 1; x++) {
            for (let y = 0; y < numSteps - 1; y++) {
                const topLeft = x * numSteps + y;
                const topRight = topLeft + 1;
                const bottomLeft = (x + 1) * numSteps + y;
                const bottomRight = bottomLeft + 1;

                indices.push(topLeft, bottomLeft, topRight);
                indices.push(topRight, bottomLeft, bottomRight);
            }
        }

        for (let x = 0; x < numSteps; x++) {
            for (let y = 0; y < numSteps - 1; y++) {
                const start = x * numSteps + y;
                const end = start + 1;

                linePositions.push(
                    positions[start * 3 + 0]!,
                    positions[start * 3 + 1]!,
                    positions[start * 3 + 2]!,
                    positions[end * 3 + 0]!,
                    positions[end * 3 + 1]!,
                    positions[end * 3 + 2]!,
                );
            }
        }

        for (let y = 0; y < numSteps; y++) {
            for (let x = 0; x < numSteps - 1; x++) {
                const start = x * numSteps + y;
                const end = (x + 1) * numSteps + y;

                linePositions.push(
                    positions[start * 3 + 0]!,
                    positions[start * 3 + 1]!,
                    positions[start * 3 + 2]!,
                    positions[end * 3 + 0]!,
                    positions[end * 3 + 1]!,
                    positions[end * 3 + 2]!,
                );
            }
        }

        if (this.graphGroup) {
            this.scene.remove(this.graphGroup);
            this.graphGroup.traverse(object => {
                if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points) {
                    object.geometry.dispose();
                }
            });
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const graphMesh = new THREE.Mesh(geometry, this.graphMaterial);

        const gridGeometry = new THREE.BufferGeometry();
        gridGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(linePositions), 3));
        const graphGridLines = new THREE.LineSegments(gridGeometry, this.graphLineMaterial);

        const currentOutput = isNetworkMode
            ? options.network.predict(options.randomInput)
            : evaluateGaussianSurface(options.input[0], options.input[1], options.bumps);
        const currentPointSphere = new THREE.Mesh(new THREE.SphereGeometry(this.currentPointBaseRadius, 18, 18), this.currentPointMaterial);
        const currentPointStem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.28, 14), this.currentPointMaterial);
        currentPointStem.position.y = this.currentPointBaseRadius + 0.14;

        const currentPointHead = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 14), this.currentPointMaterial);
        currentPointHead.rotation.x = Math.PI;
        currentPointHead.position.y = this.currentPointBaseRadius + 0.36;

        this.currentPointVisual = new THREE.Group();
        this.currentPointVisual.add(currentPointSphere);
        this.currentPointVisual.add(currentPointStem);
        this.currentPointVisual.add(currentPointHead);

        this.currentPointAnchor = new THREE.Group();
        if (isNetworkMode) {
            const currentWeights = options.network.weights;
            const currentBiases = options.network.biases;
            const currentParameters = [...currentWeights, ...currentBiases];
            this.currentPointAnchor.position.set(
                currentParameters[options.selectedParameterIndices[0]]!,
                currentOutput,
                currentParameters[options.selectedParameterIndices[1]]!,
            );
        } else {
            this.currentPointAnchor.position.set(options.input[0], currentOutput, options.input[1]);
        }
        this.currentPointAnchor.add(this.currentPointVisual);

        this.graphGroup = new THREE.Group();
        this.graphGroup.rotation.y = this.graphRotationY;
        this.graphGroup.add(graphMesh);
        this.graphGroup.add(graphGridLines);
        this.graphGroup.add(this.currentPointAnchor);
        this.scene.add(this.graphGroup);

        this.updateCurrentPointScreenSize();
        this.renderScene();
    }

    private updateCurrentPointScreenSize(): void {
        if (!this.currentPointAnchor || !this.currentPointVisual) {
            return;
        }

        this.currentPointAnchor.getWorldPosition(this.currentPointWorldPosition);
        const distance = this.camera.position.distanceTo(this.currentPointWorldPosition);
        const viewportHeight = this.renderer.getSize(new THREE.Vector2()).height;
        const worldRadius = (this.currentPointScreenRadius * distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 2) / viewportHeight;
        this.currentPointVisual.scale.setScalar(worldRadius / this.currentPointBaseRadius);
    }

    private updateCameraPosition(): void {
        this.camera.position.copy(this.cameraDirection).multiplyScalar(this.cameraDistance);
        this.camera.lookAt(0, 0, 0);
    }

    private renderScene(): void {
        this.updateCurrentPointScreenSize();
        this.renderer.render(this.scene, this.camera);
    }
}