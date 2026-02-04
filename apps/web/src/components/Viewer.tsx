import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type ViewerStats = {
  triangles: number;
  bboxSize: { x: number; y: number; z: number };
};

export type ViewerHandle = {
  fitToView: () => void;
  resetView: () => void;
  setWireframe: (enabled: boolean) => void;
  setGridVisible: (visible: boolean) => void;
  setAxesVisible: (visible: boolean) => void;
  setMatcapEnabled: (enabled: boolean) => void;
  setMeasureMode: (enabled: boolean) => void;
  takeScreenshot: () => void;
};

type ViewerProps = {
  modelUrl: string | null;
  onProgress: (progress: number) => void;
  onStats: (stats: ViewerStats | null) => void;
  onMeasurement: (distance: number | null) => void;
};

const MATCAP_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAQCAYAAABAfUpqAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAs0lEQVR4nO2UMQ6DMAxFf0kzHk5yJ5hL0NnJ3MS0V7YyI1b9n8dT2qVb2o8B9jG8yYwYDD1Tq8s+8U8b+I8cD2Rj8jYz0sN0i6x5z1n8F2QwB1t6M7c6l2N+QnYh4y0u1Oawx8H2y2o6Xk0Y0g3P3Aq2qSxVxV3T2eR+oLJ1+K5mQ2T8s2H4p9eQ1xZbZs5p0xgAAAABJRU5ErkJggg==";

export const Viewer = forwardRef<ViewerHandle, ViewerProps>(
  ({ modelUrl, onProgress, onStats, onMeasurement }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<THREE.Scene>();
    const cameraRef = useRef<THREE.PerspectiveCamera>();
    const rendererRef = useRef<THREE.WebGLRenderer>();
    const controlsRef = useRef<OrbitControls>();
    const modelRef = useRef<THREE.Object3D | null>(null);
    const gridRef = useRef<THREE.GridHelper>();
    const axesRef = useRef<THREE.AxesHelper>();
    const raycasterRef = useRef(new THREE.Raycaster());
    const pointerRef = useRef(new THREE.Vector2());
    const measureGroupRef = useRef(new THREE.Group());
    const measurePointsRef = useRef<THREE.Vector3[]>([]);
    const measureModeRef = useRef(false);
    const matcapRef = useRef<THREE.Texture>();
    const originalMaterialsRef = useRef(new Map<THREE.Mesh, THREE.Material | THREE.Material[]>());

    const resetView = () => {
      if (!cameraRef.current || !controlsRef.current) return;
      cameraRef.current.position.set(3, 3, 6);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    };

    const fitToView = () => {
      if (!cameraRef.current || !controlsRef.current || !modelRef.current) return;
      const box = new THREE.Box3().setFromObject(modelRef.current);
      if (box.isEmpty()) return;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = cameraRef.current.fov * (Math.PI / 180);
      const distance = maxDim / (2 * Math.tan(fov / 2));

      cameraRef.current.position.set(center.x, center.y + distance * 0.35, center.z + distance * 1.5);
      cameraRef.current.near = Math.max(distance / 100, 0.01);
      cameraRef.current.far = distance * 100;
      cameraRef.current.updateProjectionMatrix();

      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    };

    const updateStats = (object: THREE.Object3D | null) => {
      if (!object) {
        onStats(null);
        return;
      }
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      let triangles = 0;
      object.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const geometry = mesh.geometry;
          if (geometry.index) triangles += geometry.index.count / 3;
          else triangles += geometry.attributes.position.count / 3;
        }
      });

      onStats({
        triangles: Math.round(triangles),
        bboxSize: { x: size.x, y: size.y, z: size.z }
      });
    };

    const clearMeasurement = () => {
      measurePointsRef.current = [];
      measureGroupRef.current.clear();
      onMeasurement(null);
    };

    const addMeasurementPoint = (point: THREE.Vector3) => {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 16, 16),
        new THREE.MeshStandardMaterial({ color: "#f97316" })
      );
      sphere.position.copy(point);
      measureGroupRef.current.add(sphere);
      measurePointsRef.current.push(point.clone());

      if (measurePointsRef.current.length === 2) {
        const [a, b] = measurePointsRef.current;
        const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
        const line = new THREE.Line(
          geometry,
          new THREE.LineBasicMaterial({ color: "#f97316" })
        );
        measureGroupRef.current.add(line);
        onMeasurement(a.distanceTo(b));
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!measureModeRef.current || !rendererRef.current || !cameraRef.current || !modelRef.current) {
        return;
      }

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = raycasterRef.current;
      raycaster.setFromCamera(pointerRef.current, cameraRef.current);
      const intersects = raycaster.intersectObject(modelRef.current, true);

      if (intersects.length > 0) {
        if (measurePointsRef.current.length >= 2) {
          clearMeasurement();
        }
        addMeasurementPoint(intersects[0].point);
      }
    };

    useImperativeHandle(ref, () => ({
      fitToView,
      resetView,
      setWireframe: (enabled) => {
        if (!modelRef.current) return;
        modelRef.current.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((material) => {
              if (material && "wireframe" in material) {
                (material as THREE.MeshStandardMaterial).wireframe = enabled;
                material.needsUpdate = true;
              }
            });
          }
        });
      },
      setGridVisible: (visible) => {
        if (gridRef.current) gridRef.current.visible = visible;
      },
      setAxesVisible: (visible) => {
        if (axesRef.current) axesRef.current.visible = visible;
      },
      setMatcapEnabled: (enabled) => {
        if (!modelRef.current) return;
        if (enabled) {
          if (!matcapRef.current) {
            matcapRef.current = new THREE.TextureLoader().load(MATCAP_DATA_URL);
          }
          modelRef.current.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              if (!originalMaterialsRef.current.has(mesh)) {
                originalMaterialsRef.current.set(mesh, mesh.material);
              }
              mesh.material = new THREE.MeshMatcapMaterial({ matcap: matcapRef.current! });
            }
          });
        } else {
          modelRef.current.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              const original = originalMaterialsRef.current.get(mesh);
              if (original) {
                mesh.material = original;
              }
            }
          });
        }
      },
      setMeasureMode: (enabled) => {
        measureModeRef.current = enabled;
        if (!enabled) clearMeasurement();
      },
      takeScreenshot: () => {
        if (!rendererRef.current) return;
        const dataUrl = rendererRef.current.domElement.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "screenshot.png";
        link.click();
      }
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#0b0f1f");
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
      camera.position.set(3, 3, 6);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      rendererRef.current = renderer;
      containerRef.current.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.screenSpacePanning = false;
      controlsRef.current = controls;

      const ambient = new THREE.AmbientLight("#ffffff", 0.6);
      scene.add(ambient);
      const directional = new THREE.DirectionalLight("#ffffff", 1.2);
      directional.position.set(6, 10, 8);
      scene.add(directional);

      const environment = new RoomEnvironment(renderer);
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(environment).texture;

      const grid = new THREE.GridHelper(10, 20, "#3b82f6", "#334155");
      grid.material.opacity = 0.35;
      grid.material.transparent = true;
      scene.add(grid);
      gridRef.current = grid;

      const axes = new THREE.AxesHelper(2);
      scene.add(axes);
      axesRef.current = axes;

      scene.add(measureGroupRef.current);

      const resizeObserver = new ResizeObserver(() => {
        if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
        const { clientWidth, clientHeight } = containerRef.current;
        cameraRef.current.aspect = clientWidth / clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(clientWidth, clientHeight);
      });
      resizeObserver.observe(containerRef.current);

      renderer.domElement.addEventListener("pointerdown", onPointerDown);

      const animate = () => {
        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
      };
      animate();

      return () => {
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        resizeObserver.disconnect();
        renderer.dispose();
        pmrem.dispose();
        environment.dispose();
        scene.clear();
        containerRef.current?.removeChild(renderer.domElement);
      };
    }, []);

    useEffect(() => {
      if (!sceneRef.current || !rendererRef.current || !modelUrl) {
        if (!modelUrl) {
          if (modelRef.current) {
            sceneRef.current?.remove(modelRef.current);
            modelRef.current = null;
            updateStats(null);
          }
        }
        return;
      }

      const loader = new GLTFLoader();
      const manager = loader.manager;

      manager.onProgress = (_url, loaded, total) => {
        if (total > 0) {
          onProgress(Math.min(100, Math.round((loaded / total) * 100)));
        }
      };

      onProgress(0);

      loader.load(
        modelUrl,
        (gltf) => {
          if (modelRef.current) {
            sceneRef.current?.remove(modelRef.current);
          }
          modelRef.current = gltf.scene;
          sceneRef.current?.add(gltf.scene);
          updateStats(gltf.scene);
          fitToView();
          onProgress(100);
        },
        (event) => {
          if (event.total) {
            onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
          }
        },
        (error) => {
          console.error("Failed to load model", error);
          onProgress(0);
        }
      );
    }, [modelUrl]);

    return <div ref={containerRef} className="viewer-canvas" />;
  }
);

Viewer.displayName = "Viewer";
