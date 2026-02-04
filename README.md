<<<<<<< HEAD
# TLG_apps
Utilitky pre TLG
=======
# 3D Web Viewer

Production-ready monorepo for viewing 3D models in the browser. GLB/GLTF are loaded directly. STEP/STP files are converted to GLB via a converter adapter (HTTP service or local CLI).

## Fast Install (LAN Dev)

```bash
git clone https://github.com/carl65455-ai/TLG_apps.git
cd 3D_WebViewer
npm install
cp .env.example .env
./appctl.sh start
```

Open:

`http://<LAN_IP>:<WEB_PORT>`

STEP/STP requires the converter:

```bash
docker compose up -d converter
```

## Structure

- `apps/web` React + Vite + TypeScript client
- `apps/api` Node + Express + TypeScript API
- `docker/converter` STEP → GLB converter service (OpenCascade via `opencascade-tools`)
- `uploads` local file storage (created automatically)

## Requirements

- Node.js 20+
- Docker (optional, for converter service)

## Setup (Any PC)

```bash
npm install
```

Create a `.env` (recommended) from the template:

```bash
cp .env.example .env
```

Edit `.env` and set `LAN_IP` to the IP of the machine running the app.

## Run (Dev, LAN-friendly)

Use the included controller script:

```bash
./appctl.sh start
./appctl.sh status
```

Open from any device on the LAN:

`http://<LAN_IP>:<WEB_PORT>`

Stop:

```bash
./appctl.sh stop
```

### Notes

- If `WEB_PORT` / `API_PORT` are already in use, change them in `.env` and restart.
- STEP/STP requires the converter. If you only want GLB/GLTF, set `USE_CONVERTER=0` in `.env`.

## Run (Production Build)

1. Build:

```bash
npm run build
```

2. (Optional) Start converter:

```bash
docker compose up -d converter
```

```bash
PORT=4200 SERVE_WEB_DIST=1 npm run start:prod
```

This serves the built web app from the API process.

## STEP Conversion Options

### Option A: Run the converter service (recommended)

```bash
docker compose up --build converter
```

Then start the API with:

```bash
CONVERTER_URL=http://localhost:7070 npm run dev:api
```

### Option B: Use a local CLI converter

Install a STEP → GLB CLI (example: `opencascade-tools`). Then start the API with:

```bash
CONVERTER_CLI=opencascade-tools \
CONVERTER_CLI_ARGS="--format glb --input {input} --output {output}" \
npm run dev:api
```

The adapter replaces `{input}` and `{output}` with file paths.

## API Endpoints

- `POST /api/upload` multipart/form-data with `file`
- `GET /models/:id` serve stored models

Response example:

```json
{
  "id": "uuid",
  "originalName": "part.step",
  "size": 102400,
  "format": "step",
  "converted": true,
  "converter": "http-service",
  "url": "/models/uuid.glb"
}
```

## Notes

- GLTF uploads are expected to be self-contained (embedded textures). External texture files are not uploaded in this MVP.
- File names are sanitized and stored by UUID.
- Upload endpoint is rate-limited (configurable via env vars).
- If Docker commands fail with “permission denied”, add your user to the `docker` group and re-login, or use rootless Docker.

## Environment Variables (API)

- `PORT` (default `4000`)
- `UPLOAD_DIR` (default `./uploads`)
- `MAX_UPLOAD_BYTES` (default `200MB`)
- `CORS_ORIGIN` (default `http://localhost:5173`)
- `SERVE_WEB_DIST` (`1` to serve `apps/web/dist` from the API)
- `WEB_DIST_DIR` (default `./apps/web/dist`)
- `CONVERTER_URL` (optional)
- `CONVERTER_CLI` (optional)
- `CONVERTER_CLI_ARGS` (optional, supports `{input}` `{output}`)
- `RATE_LIMIT_WINDOW_MS` (default `300000`)
- `RATE_LIMIT_MAX` (default `20`)
>>>>>>> 687aba5 (Initial commit)
