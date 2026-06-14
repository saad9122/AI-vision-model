# AI Description Service

A standalone Node.js/TypeScript microservice that generates two types of
descriptions for room items (windows, walls, doors, etc.) from one or more
photos, using a local vision LLM served by **Ollama** (`qwen2.5vl:3b`).

It is designed to sit between your existing **Next.js** frontend / **NestJS**
backend and Ollama, so neither of those apps needs to know anything about
image preprocessing or prompt engineering.

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
                         │ 1. POST /api/v1/jobs              ▲
                         │    { roomName, itemName,          │ 3. download images
                         │      imageKeys, descriptionTypes} │    by key
                         │                                    │
                         │ 2. jobId          ┌────────────────┴───────────┐
                         │                   │   AI Description Service   │
                         │ 4. GET            │  ┌───────────┐ ┌─────────┐ │
                         │   /api/v1/jobs/:id│  │  Express  │ │ BullMQ  │ │
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
                                                     │   Ollama    │
                                                     │ qwen2.5vl:3b│
                                                     └─────────────┘
```

### Flow

1. NestJS backend calls `POST /api/v1/jobs` with the known `roomName`,
   `itemName`, the S3 **keys** of all images for that item, and which
   description types it wants. The API immediately stores a `PENDING` job
   in Postgres, enqueues it in Redis/BullMQ, and returns a `jobId`.
2. A separate **worker process** picks up the job:
   - Downloads each image from S3 by key.
   - Resizes/normalizes it with `sharp` (keeps payload size and inference
     time reasonable).
   - Sends all images for that item, together with a tailored prompt, to
     Ollama's `/api/generate` endpoint.
   - Repeats for each requested description type (`GENERAL`, `ISSUES`).
   - Writes the result back to Postgres (`COMPLETED` or `FAILED`).
3. NestJS polls `GET /api/v1/jobs/:id` until `status` is `COMPLETED` or
   `FAILED`, then stores the result (`result.general`, `result.issues`)
   against the room item in its own database.

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

### `POST /api/v1/jobs`

Create a new description job.

**Request body:**
```json
{
  "roomName": "Living Room",
  "itemName": "Window",
  "imageKeys": ["rooms/123/window/img1.jpg", "rooms/123/window/img2.jpg"],
  "descriptionTypes": ["GENERAL", "ISSUES"]
}
```
- `descriptionTypes` is optional, defaults to `["GENERAL", "ISSUES"]`.
- `imageKeys`: 1-10 S3 object keys.

**Response: `202 Accepted`**
```json
{ "jobId": "a1b2c3d4-...", "status": "PENDING" }
```

### `GET /api/v1/jobs/:id`

Poll for status/result.

**Response:**
```json
{
  "jobId": "a1b2c3d4-...",
  "status": "COMPLETED",
  "roomName": "Living Room",
  "itemName": "Window",
  "descriptionTypes": ["GENERAL", "ISSUES"],
  "result": {
    "general": "The window is a white PVC sliding window...",
    "issues": "There is a visible crack running diagonally across..."
  },
  "error": null,
  "createdAt": "2026-06-14T10:00:00.000Z",
  "updatedAt": "2026-06-14T10:00:12.000Z"
}
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

# Start Postgres, Redis, Ollama
docker compose up -d postgres redis ollama

# Pull the model into the Ollama container (one-time)
docker compose exec ollama ollama pull qwen2.5vl:3b

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
curl -X POST http://localhost:4000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -H "x-api-key: change-me-super-secret-key" \
  -d '{
    "roomName": "Living Room",
    "itemName": "Window",
    "imageKeys": ["test/window1.jpg"],
    "descriptionTypes": ["GENERAL", "ISSUES"]
  }'

# -> { "jobId": "...", "status": "PENDING" }

curl http://localhost:4000/api/v1/jobs/<jobId> \
  -H "x-api-key: change-me-super-secret-key"
```

If you don't have Ollama running locally with the model pulled, the worker
will fail the job with an error message visible in `GET /api/v1/jobs/:id`.

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
     `GET /api/v1/jobs/:id` (recommended — keeps the AI service's API key
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
  point for CPU inference with `qwen2.5vl:3b`. If you need faster/parallel
  inference later, Hetzner's GEX line (GPU servers) work well with Ollama
  + the NVIDIA Container Toolkit.
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
docker compose -f docker-compose.prod.yml up -d postgres redis ollama

# Pull the model (one-time, persisted in the ollama_data volume)
docker compose -f docker-compose.prod.yml exec ollama ollama pull qwen2.5vl:3b

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
Keep `WORKER_CONCURRENCY=1` per worker if Ollama is CPU-bound on the same
host, so you don't oversubscribe the CPU. If you move Ollama to a
dedicated GPU server, you can raise concurrency and/or worker count
significantly.

### Backups

The `pg_data` volume contains your full job history (every description
ever generated, with timestamps and source image keys) — include it in
your regular Hetzner volume/snapshot backup routine.

---

## 7. Project structure

```
ai-description-service/
├── prisma/
│   └── schema.prisma        # DescriptionJob model
├── src/
│   ├── config/               # env, db, logger
│   ├── controllers/           # jobs.controller.ts (create/get)
│   ├── middleware/            # auth, error handling
│   ├── queue/                 # BullMQ queue + worker
│   ├── routes/                 # jobs.routes.ts
│   ├── services/               # s3, image (sharp), ollama, prompts
│   ├── validators/             # zod schemas
│   └── index.ts                # Express app entry point
├── examples/
│   └── nestjs-integration.example.ts
├── docker-compose.yml          # local dev stack
├── docker-compose.prod.yml     # Hetzner production stack
├── Dockerfile
├── .env.example
└── .env.prod.example
```

---

## 8. Tuning & next steps

- **Prompt tuning**: edit `src/services/prompt.service.ts`. Test changes
  via the `curl` flow above before redeploying.
- **Larger model**: if `qwen2.5vl:3b` accuracy isn't sufficient, pull a
  larger variant (e.g. `qwen2.5vl:7b`) and change `OLLAMA_MODEL` — no code
  changes needed.
- **Rate limiting**: add `express-rate-limit` to `src/index.ts` if needed.
- **Observability**: `pino` logs to stdout in JSON in production — pipe
  these into your existing log aggregation (e.g. via Docker logging
  driver).
