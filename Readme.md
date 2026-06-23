# AI Agent Service

A standalone Node.js/TypeScript microservice that runs multiple AI capabilities
for property inspection workflows. The first capability is **description-generator**
(room item descriptions and issue reports from photos), with more capabilities
planned behind a unified agent-jobs API.

---

## 1. Architecture

```
                 ┌──────────────┐
                 │   Next.js    │
                 │   Frontend   │
                 └──────┬───────┘
                         │ (uploads images, shows results)
                         ▼
                 ┌──────────────┐         ┌─────────────────────┐
                 │   NestJS     │         │   S3 / Hetzner       │
                 │   Backend    │◄───────►│   Object Storage     │
                 └──────┬───────┘         └─────────┬───────────┘
                         │ 1. POST /api/v1/agent-jobs        ▲
                         │    { capability, payload }       │ 3. download images    by key
                         │                                    │
                         │ 2. jobId          ┌────────────────┴───────────┐
                         │                   │   AI Agent Service         │
                         │ 4. GET            │  ┌───────────┐ ┌─────────┐ │
                         │   /api/v1/agent-jobs/:id│  │  Express  │ │ BullMQ  │ │
                         └──────────────────►│  │  API      │ │ Worker  │ │
                                              │  └─────┬─────┘ └────┬────┘ │
                                              │        │            │      │
                                              │   ┌────▼────┐  ┌────▼───┐  │
                                              │   │ Postgres│  │ Redis  │  │
                                              │   │ (jobs)  │  │(queue) │  │
                                              │   └─────────┘  └────────┘  │
                                              └────────────┬───────────────┘
                                                            │ 5. base64 images + prompt
                                                            ▼
                                                     ┌─────────────┐
                                                     │ Vision LLM  │
                                                     │ (LM Studio / │
                                                     │ OpenAI /    │
                                                     │ Gemini /    │
                                                     │ ATXP)       │
                                                     └─────────────┘
```

### Flow

1. NestJS backend calls `POST /api/v1/agent-jobs` with a `capability` slug
   (e.g. `description-generator`) and capability-specific `payload`. The API
   stores a `PENDING` job in Postgres, enqueues it in Redis/BullMQ, and returns
   a `jobId`.
2. A separate **worker process** picks up the job:
   - Downloads each image from S3 by key.
   - Resizes/normalizes it with `sharp` (keeps payload size and inference
     time reasonable).
   - Sends all images for that item, together with a tailored prompt, to
     the configured vision provider via the Vercel AI SDK.
   - Repeats for each requested description type (`GENERAL`, `ISSUES`).
   - Writes the result back to Postgres (`COMPLETED` or `FAILED`).
3. NestJS polls `GET /api/v1/agent-jobs/:id` until `status` is `COMPLETED` or
   `FAILED`, then stores the capability result against the room item.

### Why this shape?

- **Separate API and worker processes** — vision inference is slow and
  CPU-heavy. Keeping it out of the request/response cycle of the API
  (and out of NestJS entirely) means the API stays fast and you can scale
  the worker independently (e.g. run 1 worker per CPU core, or move it to
  a GPU box later).
- **Postgres for jobs** — gives you a full audit trail of every
  generation (what was requested, what was returned, when, and any
  errors), which is useful for debugging prompt quality over time.
- **S3 keys instead of raw uploads** — the AI service never needs direct
  upload handling; it just needs read access to your existing bucket.
- **API key auth** — this service should NOT be publicly exposed. It's
  meant to be called only by your NestJS backend over an internal Docker
  network (see `docker-compose.prod.yml`).

---

## 2. Two description types

For each room item, you can request either or both:

| Type      | Purpose | Example output |
|-----------|---------|-----------------|
| `GENERAL` | Neutral factual description of the item | "The window is a white PVC sliding window with a single large glass pane and a frosted bottom panel..." |
| `ISSUES`  | Defect / condition report | "There is a visible crack running diagonally across the lower left pane. The frame shows minor paint peeling near the bottom edge." |

Prompts are defined in `src/services/prompt.service.ts` — tune the wording
there as you iterate on output quality. Both prompts explicitly tell the
model to combine information from **all** images of the same item.

---

## 3. API Reference

All endpoints require header: `x-api-key: <API_KEY>`

### `POST /api/v1/agent-jobs`

Create a new agent job.

**Request body:**
```json
{
  "capability": "description-generator",
  "payload": {
    "roomName": "Living Room",
    "itemName": "Window",
    "imageKeys": ["rooms/123/window/img1.jpg", "rooms/123/window/img2.jpg"],
    "descriptionTypes": ["GENERAL", "ISSUES"]
  }
}
```
- `descriptionTypes` inside `payload` is optional, defaults to `["GENERAL", "ISSUES"]`.
- `imageKeys`: 1-10 S3 object keys.

**Response: `202 Accepted`**
```json
{ "jobId": "a1b2c3d4-...", "capability": "description-generator", "status": "PENDING" }
```

### `GET /api/v1/agent-jobs/:id`

Poll for status/result.

**Response:**
```json
{
  "jobId": "a1b2c3d4-...",
  "capability": "description-generator",
  "status": "COMPLETED",
  "payload": {
    "roomName": "Living Room",
    "itemName": "Window",
    "imageKeys": ["rooms/123/window/img1.jpg"],
    "descriptionTypes": ["GENERAL", "ISSUES"]
  },
  "result": {
    "general": "The window is a white PVC sliding window...",
    "issues": "There is a visible crack running diagonally across..."
  },
  "error": null,
  "created_at": "2026-06-14T10:00:00.000Z",
  "updated_at": "2026-06-14T10:00:12.000Z"
}
```

### `GET /api/v1/capabilities`

List registered capability slugs.

**Response:**
```json
{ "capabilities": ["description-generator"] }
```

`status` is one of `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`.
If `FAILED`, `error` contains a message and `result` is `null`.

### `GET /health`

Public, unauthenticated. Returns `{ "status": "ok" }`. Used for Docker
healthchecks / load balancer probes.

---

## 4. Local development setup

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- An S3-compatible bucket you can read from (can be a test bucket on
  Hetzner Object Storage or MinIO running locally)

### Steps

```bash
cp .env.example .env
# edit .env: set API_KEY, S3_* credentials, etc.

# Start Postgres and Redis
docker compose up -d postgres redis

# Install deps and generate Prisma client
npm install
npm run prisma:generate

# Create the DescriptionJob table
npm run prisma:migrate:dev

# Run the API and worker in two terminals
npm run dev          # API on http://localhost:4000
npm run dev:worker   # background worker
```

### Test it

```bash
curl -X POST http://localhost:4000/api/v1/agent-jobs \
  -H "Content-Type: application/json" \
  -H "x-api-key: change-me-super-secret-key" \
  -d '{
    "capability": "description-generator",
    "payload": {
      "roomName": "Living Room",
      "itemName": "Window",
      "imageKeys": ["test/window1.jpg"],
      "descriptionTypes": ["GENERAL", "ISSUES"]
    }
  }'

curl http://localhost:4000/api/v1/agent-jobs/<jobId> \
  -H "x-api-key: change-me-super-secret-key"
```

If the vision provider is not reachable or misconfigured, the worker will fail
the job with an error message visible in `GET /api/v1/agent-jobs/:id`.

---

## 5. NestJS integration

See `examples/nestjs-integration.example.ts` for a reference
`AiDescriptionService` you can drop into your NestJS app. Summary:

1. When a user finishes uploading images for a room item, your NestJS
   backend calls `createDescriptionJob(roomName, itemName, imageKeys)`.
2. Store the returned `jobId` against that room item.
3. Either:
   - Poll from a background job/cron (`pollUntilDone`), or
   - Have the frontend poll a NestJS endpoint that proxies
     `GET /api/v1/agent-jobs/:id` (recommended — keeps the AI service's API key
     off the frontend).
4. When `status === "COMPLETED"`, persist `result.general` and
   `result.issues` against the room item.

Set these env vars in NestJS:
```
AI_SERVICE_URL=http://ai-service-api:4000   # internal Docker network name
AI_SERVICE_API_KEY=<same as API_KEY in the AI service .env>
```

---

## 6. Deploying on Hetzner

### Recommended setup

- **Server**: A CPX31/CPX41 (4-8 vCPU, 8-16GB RAM) is a reasonable starting
  point if you run **LM Studio** locally for CPU inference. For cloud providers
  (OpenAI, Gemini, ATXP), worker CPU requirements are lower.
- **Storage**: Hetzner Object Storage (S3-compatible) for images — set
  `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE=true`, and your access keys.
- **Networking**: Run this service on the **same Docker host/network** as
  your NestJS backend (or a private network between servers via Hetzner
  Cloud Networks), so the AI service is never exposed to the public
  internet. Only your NestJS backend should be able to reach
  `ai-service-api:4000`.

### Steps

```bash
# On the Hetzner server
git clone <your-repo> ai-description-service
cd ai-description-service

cp .env.prod.example .env
# edit .env: set strong POSTGRES_PASSWORD, API_KEY, S3 credentials, etc.

docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d postgres redis

# Run Prisma migrations against the prod DB
docker compose -f docker-compose.prod.yml run --rm ai-service-api npx prisma migrate deploy

# Start the API and worker
docker compose -f docker-compose.prod.yml up -d ai-service-api ai-service-worker
```

### Connecting NestJS

- If NestJS runs in its own docker-compose stack on the same host, join
  both stacks to a shared external Docker network (or simply put
  `ai-service-api` and `ai-service-worker` directly in your existing
  NestJS `docker-compose.yml` as additional services using this repo's
  `Dockerfile`).
- `ai-service-api` is published on `127.0.0.1:4000` only — reachable from
  other containers on the host's Docker network, and from the host itself,
  but not from the public internet.

### Scaling the worker

If image volume grows, scale the worker horizontally:
```bash
docker compose -f docker-compose.prod.yml up -d --scale ai-service-worker=3
```
Keep `WORKER_CONCURRENCY=1` per worker if your vision provider is CPU-bound
on the same host. For cloud API providers, you can raise concurrency and/or
worker count significantly.

Both `WORKER_RATE_LIMIT_*` and `VISION_RATE_LIMIT_*` are global Redis-backed
limits shared across all worker replicas — scaling to 3 workers does not
multiply the allowed jobs or API calls per minute.

### Image preprocessing

Before images are base64-encoded and sent to the vision model, the worker
downloads and resizes them **in parallel** with `sharp` so the longest side
does not exceed `MAX_IMAGE_DIMENSION` (default `1024`). Images are
auto-rotated from EXIF, normalized to JPEG, and only then encoded. This
keeps payload size and inference context smaller for cloud providers.

When multiple images are sent, **Gemini** and **ATXP** receive all images
in a single API request with the prompt placed **last** in the content
array (images first). A multi-image evaluator instruction is appended to
the prompt so the model synthesizes across every image.

Set `MAX_IMAGE_DIMENSION=1024` in `.env` (already the default). Worker logs
include `maxDimension` when preparing images so you can confirm the resize
at runtime.

### Rate limiting (avoiding 429 errors)

Two independent env-controlled limits protect against provider rate limits:

| Variable | What it limits | Default |
|----------|----------------|---------|
| `WORKER_RATE_LIMIT_MAX` | Queue jobs **started** per window | `5` (set `0` to disable) |
| `WORKER_RATE_LIMIT_DURATION_MS` | Job limit window in ms | `60000` |
| `VISION_RATE_LIMIT_MAX` | Vision API **calls** per window (every `generateDescription`) | `15` (set `0` to disable) |
| `VISION_RATE_LIMIT_DURATION_MS` | Request limit window in ms | `60000` |

- **Job limiter** (BullMQ Worker `limiter`): caps how many full jobs enter
  processing per minute. Useful when many jobs are enqueued at once.
- **Vision request limiter** (Redis): caps every LLM call across all
  providers and workers. Room overview uses a **single** vision API call
  (not per-item fan-out), which greatly reduces call volume.

Tune `VISION_RATE_LIMIT_MAX` to your provider RPM (e.g. Gemini free tier
~15 RPM). Lower `WORKER_RATE_LIMIT_MAX` when room-overview jobs are common.

When `VISION_RATE_LIMIT_MAX > 0`, the global limiter replaces Gemini's
in-process `GEMINI_REQUEST_GAP_MS` throttle. Gemini 429 retries
(`GEMINI_MAX_RETRIES`) remain as a safety net.

### Backups

The `pg_data` volume contains your full job history (every description
ever generated, with timestamps and source image keys) — include it in
your regular Hetzner volume/snapshot backup routine.

---

## 7. Project structure

```
ai-agent-service/
├── prisma/
│   └── schema.prisma           # AgentJob model
├── src/
│   ├── app/                    # server.ts, worker.ts entrypoints
│   ├── shared/                 # config, middlewares, types
│   ├── platform/               # vision LLM, media, queue framework
│   ├── modules/
│   │   └── description-generator/
│   ├── api/                    # agent-jobs HTTP controllers
│   └── routes/
├── docker-compose.yml
├── docker-compose.prod.yml
├── Dockerfile
└── .env
```

---

## 8. Tuning & next steps

- **Prompt tuning**: edit `src/services/prompt.service.ts`. Test changes
  via the `curl` flow above before redeploying.
- **Provider selection**: set `VISION_PROVIDER` to `lmstudio` (default),
  `openai`, `gemini`, or `atxp` in `.env`. All providers are wired through
  the Vercel AI SDK (`generateText`).
- **Larger model**: for LM Studio, load a larger vision model and update
  `LMSTUDIO_MODEL` — no code changes needed.
- **Rate limiting**: `WORKER_RATE_LIMIT_*` and `VISION_RATE_LIMIT_*` in
  `.env` throttle jobs and vision API calls (see **Rate limiting** under
  Scaling the worker). Set either `*_MAX=0` to disable.
- **Observability**: `pino` logs to stdout in JSON in production — pipe
  these into your existing log aggregation (e.g. via Docker logging
  driver).
