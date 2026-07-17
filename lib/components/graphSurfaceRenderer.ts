import * as THREE from "three";
import { getHeightColor, type Vertex } from "@lib/utils/graphSurface";

const ORBIT_SENSITIVITY = 0.0035;

export enum SurfaceMode {
    Network = "network",
    Gaussian = "gaussian"
}

export interface SurfacePoint {
    x: number;
    y: number;
    z: number;
}

export interface SurfaceGeometryOptions {
    vertices: Vertex[];
    range: [number, number];
    step: number;
}

export interface SurfaceRenderOptions {
    vertices: Vertex[];
    currentPoint: SurfacePoint;
    range: [number, number];
    step: number;
}

export interface SurfaceGraphOptions {
    container: HTMLElement;
    initialRotationY?: number;
    initialCameraDistance?: number;
    onOrbitChanged?: (rotationY: number) => void;
}

export class SurfaceGraph {
    private readonly scene: THREE.Scene;
    private readonly camera: THREE.PerspectiveCamera;
    private readonly renderer: THREE.WebGLRenderer;
    private readonly graphMaterial: THREE.MeshPhongMaterial;
    private readonly graphLineMaterial: THREE.LineBasicMaterial;
    private readonly currentPointMaterial: THREE.MeshBasicMaterial;
    private readonly currentPointBaseRadius = 0.035;
    private readonly currentPointScreenRadius = 5;
    private readonly currentPointWorldPosition = new THREE.Vector3();
    private readonly orbitMinPhi = 0.12;
    private readonly orbitMaxPhi = Math.PI - 0.12;
    private readonly orbitTarget = new THREE.Vector3(0, 0, 0);

    private graphGroup: THREE.Group | null = null;
    private currentPointAnchor: THREE.Group | null = null;
    private currentPointVisual: THREE.Group | null = null;

    private graphRotationY: number;
    private cameraDistance: number;
    private cameraOrbitTheta: number;
    private cameraOrbitPhi: number;
    private isDragging = false;
    private lastPointerX = 0;
    private lastPointerY = 0;
    private readonly onOrbitChanged: ((rotationY: number) => void) | undefined;

    constructor(options: SurfaceGraphOptions) {
        this.graphRotationY = options.initialRotationY ?? 0;
        this.cameraDistance = options.initialCameraDistance ?? 10;
        this.onOrbitChanged = options.onOrbitChanged;
        this.cameraOrbitTheta = Math.atan2(1, 1);
        this.cameraOrbitPhi = Math.acos(1 / Math.sqrt(3));

        this.scene = new THREE.Scene();
        this.scene.background = null;

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setSize(Math.ceil(window.innerWidth), Math.ceil(window.innerHeight));
        this.renderer.domElement.classList.add("three-graph");
        this.renderer.domElement.style.touchAction = "none";
        this.renderer.domElement.style.cursor = "grab";
        this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
        this.renderer.domElement.addEventListener("pointermove", this.handlePointerMove);
        this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
        this.renderer.domElement.addEventListener("pointerleave", this.handlePointerUp);
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

    public getDomElement(): HTMLCanvasElement {
        return this.renderer.domElement;
    }

    public resize(width = window.innerWidth, height = window.innerHeight): void {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(Math.ceil(width), Math.ceil(height));
        this.renderScene();
    }

    public render(options: SurfaceRenderOptions): void {
        const numSteps = Math.floor((options.range[1] - options.range[0]) / options.step) + 1;
        const positions = new Float32Array(options.vertices.length * 3);
        const colors = new Float32Array(options.vertices.length * 3);
        const indices: number[] = [];
        const linePositions: number[] = [];
        let minZ = Number.POSITIVE_INFINITY;
        let maxZ = Number.NEGATIVE_INFINITY;

        for (let i = 0; i < options.vertices.length; i++) {
            minZ = Math.min(minZ, options.vertices[i]!.z);
            maxZ = Math.max(maxZ, options.vertices[i]!.z);

            positions[i * 3 + 0] = options.vertices[i]!.x;
            positions[i * 3 + 1] = options.vertices[i]!.z;
            positions[i * 3 + 2] = options.vertices[i]!.y;
        }

        const zRange = Math.max(maxZ - minZ, 0.0001);
        for (let i = 0; i < options.vertices.length; i++) {
            const normalisedZ = (options.vertices[i]!.z - minZ) / zRange;
            const vertexColor = getHeightColor(normalisedZ);
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

        const currentPointSphere = new THREE.Mesh(new THREE.SphereGeometry(this.currentPointBaseRadius, 18, 18), this.currentPointMaterial);
        const currentPointHead = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 14), this.currentPointMaterial);
        currentPointHead.rotation.x = Math.PI;
        currentPointHead.position.y = this.currentPointBaseRadius + 0.14;
        const currentPointStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 14), this.currentPointMaterial);
        currentPointStem.position.y = this.currentPointBaseRadius + 0.4;


        this.currentPointVisual = new THREE.Group();
        this.currentPointVisual.add(currentPointSphere);
        this.currentPointVisual.add(currentPointStem);
        this.currentPointVisual.add(currentPointHead);

        this.currentPointAnchor = new THREE.Group();
        this.currentPointAnchor.position.set(options.currentPoint.x, options.currentPoint.z, options.currentPoint.y);
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
        const sinPhi = Math.sin(this.cameraOrbitPhi);
        this.camera.position.set(
            this.cameraDistance * sinPhi * Math.cos(this.cameraOrbitTheta),
            this.cameraDistance * Math.cos(this.cameraOrbitPhi),
            this.cameraDistance * sinPhi * Math.sin(this.cameraOrbitTheta),
        );
        this.camera.lookAt(this.orbitTarget);
    }

    private renderScene(): void {
        this.updateCurrentPointScreenSize();
        this.renderer.render(this.scene, this.camera);
    }

    private readonly handlePointerDown = (event: PointerEvent): void => {
        this.isDragging = true;
        this.lastPointerX = event.clientX;
        this.lastPointerY = event.clientY;
        this.renderer.domElement.setPointerCapture(event.pointerId);
        this.renderer.domElement.style.cursor = "grabbing";
    };

    private readonly handlePointerMove = (event: PointerEvent): void => {
        if (!this.isDragging) {
            return;
        }

        const deltaX = event.clientX - this.lastPointerX;
        const deltaY = event.clientY - this.lastPointerY;
        this.lastPointerX = event.clientX;
        this.lastPointerY = event.clientY;

        this.cameraOrbitTheta += deltaX * ORBIT_SENSITIVITY;
        this.cameraOrbitPhi = THREE.MathUtils.clamp(
            this.cameraOrbitPhi - deltaY * ORBIT_SENSITIVITY,
            this.orbitMinPhi,
            this.orbitMaxPhi,
        );

        this.updateCameraPosition();
        this.onOrbitChanged?.(this.cameraOrbitTheta);
        this.renderScene();
    };

    private readonly handlePointerUp = (event: PointerEvent): void => {
        if (!this.isDragging) {
            return;
        }

        this.isDragging = false;
        if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
            this.renderer.domElement.releasePointerCapture(event.pointerId);
        }
        this.renderer.domElement.style.cursor = "grab";
    };
}