import { useMemo, useRef, useState } from "react";
import type React from "react";
import "./styles.css";
import { Viewer, ViewerHandle, ViewerStats } from "./components/Viewer";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

const formatNumber = (value: number) => Intl.NumberFormat().format(value);

const formatSize = (bytes: number) => {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
};

export default function App() {
  const viewerRef = useRef<ViewerHandle>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);
  const [modelFormat, setModelFormat] = useState<string | null>(null);
  const [modelSize, setModelSize] = useState<number | null>(null);
  const [stats, setStats] = useState<ViewerStats | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [gridVisible, setGridVisible] = useState(true);
  const [axesVisible, setAxesVisible] = useState(true);
  const [matcapEnabled, setMatcapEnabled] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurement, setMeasurement] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const modelInfo = useMemo(
    () => ({
      name: modelName ?? "—",
      format: modelFormat ?? "—",
      size: modelSize ? formatSize(modelSize) : "—"
    }),
    [modelName, modelFormat, modelSize]
  );

  const updateViewer = (action: () => void) => {
    action();
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setMessage(null);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Upload failed");
      }

      setModelUrl(`${API_BASE}${payload.url}`);
      setModelName(payload.originalName);
      setModelFormat(payload.format);
      setModelSize(payload.size ?? file.size);
      setMessage(payload.converted ? "STEP converted to GLB" : "Model loaded");
    } catch (error) {
      const fallback = `Upload failed. Check API: ${API_BASE}`;
      const message = error instanceof Error ? error.message : fallback;
      // Some browsers surface connectivity/CORS issues as generic network errors.
      const maybeNetworkError =
        message.toLowerCase().includes("networkerror") ||
        message.toLowerCase().includes("failed to fetch");
      setMessage(maybeNetworkError ? fallback : message);
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    uploadFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    handleFile(file ?? null);
  };

  return (
    <div className="app">
      <aside className="panel">
        <header>
          <p className="eyebrow">3D Web Viewer</p>
          <h1>Inspect CAD & GLTF models in the browser.</h1>
          <p className="subtitle">
            Drag a file in or upload. STEP/STP files are converted to GLB on the server.
          </p>
        </header>

        <div
          className="dropzone"
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
        >
          <input
            type="file"
            id="file-input"
            accept=".glb,.gltf,.step,.stp"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
          <label htmlFor="file-input">
            <span>{uploading ? "Uploading..." : "Choose file"}</span>
            <small>GLB, GLTF, STEP, STP up to 200MB</small>
          </label>
        </div>

        {message && <div className="status">{message}</div>}

        <section className="section">
          <h2>Viewer</h2>
          <div className="button-grid">
            <button onClick={() => updateViewer(() => viewerRef.current?.fitToView())}>Fit to view</button>
            <button onClick={() => updateViewer(() => viewerRef.current?.resetView())}>Reset view</button>
            <button
              className={wireframe ? "active" : ""}
              onClick={() => {
                const next = !wireframe;
                setWireframe(next);
                updateViewer(() => viewerRef.current?.setWireframe(next));
              }}
            >
              Wireframe
            </button>
            <button
              className={gridVisible ? "active" : ""}
              onClick={() => {
                const next = !gridVisible;
                setGridVisible(next);
                updateViewer(() => viewerRef.current?.setGridVisible(next));
              }}
            >
              Grid
            </button>
            <button
              className={axesVisible ? "active" : ""}
              onClick={() => {
                const next = !axesVisible;
                setAxesVisible(next);
                updateViewer(() => viewerRef.current?.setAxesVisible(next));
              }}
            >
              Axes
            </button>
            <button
              className={matcapEnabled ? "active" : ""}
              onClick={() => {
                const next = !matcapEnabled;
                setMatcapEnabled(next);
                updateViewer(() => viewerRef.current?.setMatcapEnabled(next));
              }}
            >
              Matcap
            </button>
            <button
              className={measureMode ? "active" : ""}
              onClick={() => {
                const next = !measureMode;
                setMeasureMode(next);
                updateViewer(() => viewerRef.current?.setMeasureMode(next));
              }}
            >
              Measure
            </button>
            <button onClick={() => updateViewer(() => viewerRef.current?.takeScreenshot())}>
              Screenshot
            </button>
          </div>
        </section>

        <section className="section">
          <h2>Model stats</h2>
          <div className="stats">
            <div>
              <span>File</span>
              <strong>{modelInfo.name}</strong>
            </div>
            <div>
              <span>Format</span>
              <strong>{modelInfo.format}</strong>
            </div>
            <div>
              <span>Size</span>
              <strong>{modelInfo.size}</strong>
            </div>
            <div>
              <span>Triangles</span>
              <strong>{stats ? formatNumber(stats.triangles) : "—"}</strong>
            </div>
            <div>
              <span>Bounds</span>
              <strong>
                {stats
                  ? `${stats.bboxSize.x.toFixed(2)} x ${stats.bboxSize.y.toFixed(2)} x ${
                      stats.bboxSize.z.toFixed(2)
                    }`
                  : "—"}
              </strong>
            </div>
            <div>
              <span>Measurement</span>
              <strong>{measurement ? `${measurement.toFixed(3)} units` : "—"}</strong>
            </div>
          </div>
        </section>
      </aside>

      <main className="viewer">
        <div className="progress">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <Viewer
          ref={viewerRef}
          modelUrl={modelUrl}
          onProgress={setProgress}
          onStats={setStats}
          onMeasurement={setMeasurement}
        />
      </main>
    </div>
  );
}
