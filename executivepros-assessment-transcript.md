# Executiveros assessment
_Exported on 12/11/2026 at 23:19:38 GMT+1 from Cursor (3.23.23)_

---

**User**

I am working on a Node.js Microservice – Payment Processing Simulation					
Overview:					
Node.js microservice that simulates payment processing. This service will expose a RESTful API for creating, retrieving, and updating payment statuses.					
Objectives:					
					
Showcase your ability to build a robust microservice using Node.js and Express.					
Emphasize error handling and logging.					
Demonstrate asynchronous programming concepts in a realistic setting.					
					
Requirements:					
					
Set up an Express server with endpoints for:					
Creating a payment (POST).					
Retrieving payment information by ID (GET).					
Updating the status of a payment (PUT/PATCH).					
Simulate payment processing logic with asynchronous operations.					
Provide in-memory or file-based (JSON) persistence for simplicity.					
Implement proper error responses (e.g., invalid input or service errors).					
Include unit tests and basic API documentation (Swagger or markdown).					
					
Deliverables:					
					
Source code in a Git repository.					
README with setup instructions, API details, and testing instructions.					
Test scripts demonstrating your testing approach (e.g., using Mocha/Chai or Jest).		

What are the steps to get this done correctly considering the following criterias:

Ownership and problem-solving: Demonstrate your ability to take ownership of the task, make sound technical decisions, and deliver a complete, reliable solution.
Failure handling: Identify potential points of failure and demonstrate how you would handle errors and unexpected scenarios.
Background processing: Where applicable, consider the reliability and appropriate handling of background tasks.
Security and code quality: Follow secure coding practices and ensure your solution is maintainable, well-structured, and free of critical bugs.
Project completeness: Treat the assessment as a real-world project, paying attention to implementation details, edge cases, and overall solution quality.

No coding.		

---

**Cursor**

This is a planning question with no code. I’ll switch to Plan mode and lay out the technical decisions, failure points, and delivery steps against those assessment criteria.

Treat this as a small production service, not a CRUD demo. The reviewers will look for **sound defaults, explicit failure modes, and a payment lifecycle that can fail mid-flight**.

## What to build

A single Express service that:

1. Accepts a payment create request and returns immediately with `pending`.
2. Processes the payment **asynchronously** (simulated processor delay + random success/failure).
3. Lets clients poll `GET /payments/:id` and optionally `PATCH` status (with rules).
4. Persists to a JSON file so restarts do not wipe data.
5. Logs structured events and returns consistent error bodies.

That mapping is how you hit every criterion: ownership (you chose the model), background processing (async worker), failure handling (validation, processor failure, concurrency), security/quality (validation, no secrets in logs, layered code), completeness (tests + README + Swagger).

## Technical decisions (ownership)

| Decision | Choice | Why |
|---|---|---|
| Runtime | Node.js + Express, CommonJS or ESM consistently | Matches the brief; keep it simple |
| Logger | **Pino** (or Winston) + HTTP request log | JSON logs, levels, request IDs |
| Validation | **Zod** or Joi at the HTTP boundary | Fail fast on bad input |
| Persistence | JSON file via a repository, **not** a global array in routes | Swappable; file I/O is a real failure point |
| IDs | `crypto.randomUUID()` | Unpredictable; no sequential IDs |
| Money | Integer **minor units** (kobo/cents) + ISO currency | Avoid float rounding bugs |
| Status machine | `pending → processing → succeeded \| failed`; optional `cancelled` | Updates are not free-form strings |
| Async work | In-process queue + `setTimeout` simulator, **idempotent** jobs | Background processing without Redis |
| Tests | **Jest** + Supertest | Unit + HTTP; matches “Mocha/Chai or Jest” |
| Docs | OpenAPI (`swagger-jsdoc` + UI) **and** README | Brief asks for Swagger or markdown; do both |

Do **not** add Postgres, Redis, Docker Compose, or auth unless you have spare time. Completeness here means depth on payments, not extra products.

## Domain model

```text
Payment {
  id: uuid
  amount: integer >= 1          // minor units
  currency: "NGN" | "USD" | ...
  merchantRef: string           // client idempotency key
  customerEmail?: string
  status: pending | processing | succeeded | failed | cancelled
  failureReason?: string
  processorRef?: string
  createdAt, updatedAt
}
```

**Lifecycle**

1. `POST` → persist `pending`, enqueue job, return `202` or `201` with `pending`.
2. Worker sets `processing`, waits (e.g. 1–3s), then `succeeded` (~80%) or `failed` (timeout / declined).
3. `PATCH` only for allowed transitions, e.g. `pending → cancelled`. Reject `succeeded → failed` with `409`.
4. Same `merchantRef` returns the **existing** payment (`200`), does not create a duplicate. That is real-world payment hygiene.

## API shape

| Method | Path | Behavior |
|---|---|---|
| `POST /payments` | Create (idempotent on `merchantRef`) |
| `GET /payments/:id` | Fetch one; `404` if missing |
| `GET /payments` | Optional list + `status` filter (nice completeness, not required) |
| `PATCH /payments/:id` | Restricted status updates |
| `PUT /payments/:id` | Full replace **or** same as PATCH documented clearly; prefer PATCH for status |
| `GET /health` | Liveness |
| `GET /docs` | Swagger UI |

**Error body (always):**

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

HTTP: `400` validation, `404` missing, `409` illegal transition / conflict, `500` unexpected, `503` if persistence is down.

## Background processing (what they want to see)

Do not `await` the 3-second processor inside the HTTP handler. That couples request latency to payment time and drops work if the client disconnects.

**In-process job runner**

- On create: write payment, push `{ paymentId }` onto a queue, `res.json` immediately.
- Worker: one-at-a-time or small concurrency (e.g. 2).
- Each job: load payment → if already terminal, **no-op** (idempotent) → mark `processing` → `simulateProcessor()` Promise → persist terminal status.
- On process crash: on startup, **re-queue** payments stuck in `pending`/`processing` (simple recovery; mention in README that a real system would use a broker + retries).
- Cap retries (e.g. 2) then `failed` with `PROCESSOR_UNAVAILABLE`.
- Never let an unhandled worker error kill the process; log and fail that payment.

This is the strongest “background processing” signal you can give without extra infrastructure.

## Failure points and how to handle them

| Failure | Handling |
|---|---|
| Missing/invalid body, negative amount, bad currency | `400` + field details; never persist |
| Unknown ID | `404` |
| Illegal status transition | `409` + current status |
| Duplicate `merchantRef` | Return original payment; do not double-charge |
| Concurrent PATCH vs worker | Optimistic lock: `updatedAt` or version field; last write checks expected status |
| JSON file write failure / disk full | Log error, `503`, do not half-update (write temp file then `rename`) |
| Processor timeout / throw | Catch, mark `failed`, structured log with `paymentId` |
| Uncaught exceptions / unhandled rejections | Process-level handlers: log, fail health if you want, do not leak stack to clients |
| Malformed JSON | Express JSON parser error middleware → `400` |
| Oversized payload | `limit` on `express.json` |

Log **requestId**, `paymentId`, status transitions. Never log full PAN/CVV (you should not even accept card numbers; accept a fake `paymentMethodToken` only).

## Security and code quality

- **Do not store card data.** Token + amount + currency is enough for a simulation.
- Helmet, disable `x-powered-by`, JSON body limit (e.g. 16kb).
- Validate UUID params.
- Correlation ID middleware (`x-request-id`).
- Config from env: `PORT`, `LOG_LEVEL`, `DATA_FILE`, `PROCESSOR_FAILURE_RATE`.
- Layered layout:

```text
src/
  app.js              # express app, no listen (testable)
  server.js           # listen + graceful shutdown
  config/
  routes/
  controllers/
  services/           # paymentService, processor simulator
  repositories/       # file store with atomic writes
  middleware/         # errors, request id
  jobs/               # queue + worker
  schemas/
tests/
```

- Graceful shutdown: stop accepting, wait for in-flight jobs with a timeout, flush logs.
- `.env.example`, `.gitignore` (`node_modules`, `data/`, `.env`).
- No `try/catch` swallowed empty; wrap async route handlers.

## Tests (must prove the story)

**Unit:** status machine, amount validation, idempotency key, processor result mapping.

**API (Supertest, in-memory or temp JSON file):**

- Create → `pending` + id
- Get by id
- Invalid create → `400`
- Missing id → `404`
- Idempotent create
- PATCH illegal transition → `409`
- After processing (fake timer or inject processor): `succeeded` or `failed`

Inject a fake processor in tests so you do not wait 3 seconds. That shows you designed for testability.

## README (treat as a product)

Include: purpose, decisions (why file + in-process queue), setup (`npm i`, `npm test`, `npm start`), env vars, endpoint table, status diagram, how to try a payment in Swagger, how background jobs recover on restart, known limitations (single instance, no durable broker).

## Order of work (when you say go)

1. Project skeleton: `app.js` / `server.js`, config, Pino logger, health route.
2. Payment schema + file repository (atomic write).
3. Service + status machine + POST/GET/PATCH.
4. Job queue + simulated processor + startup recovery.
5. Error middleware + request IDs + security headers.
6. Jest + Supertest covering happy path and the table above.
7. OpenAPI + README.
8. Manual pass: invalid payloads, duplicate refs, kill process mid-`processing`, restart, confirm recovery.

## What “complete” looks like to a reviewer

A stranger clones the repo, runs tests, starts the server, creates a payment, watches logs move `pending → processing → succeeded|failed`, and reads the README for why PATCH cannot resurrect a succeeded payment.

When you want this implemented in the repo, say so and we start with Express + logger scaffolding, then the payment domain.

---

**User**

I have implemented Service + status machine + POST/GET/PATCH + idempontency. Review and suggest fixes.

---

**Cursor**

I'll review the payment service, status transitions, and POST/GET/PATCH with `merchantRef` idempotency and suggest fixes.

POST, GET, and PATCH are live, with idempotency on create. Background processing is still not wired; new payments stay `pending` until that step.

**Status machine**
- `pending → processing | cancelled`
- `processing → succeeded | failed`
- Terminal states do not move
- Clients may only `PATCH`/`PUT` `{ "status": "cancelled" }`
- Repeat cancel is a no-op (`200`)
- Cancel after success is `409 ILLEGAL_STATUS_TRANSITION`

**Idempotency**
- Key is `merchantRef`, or the `Idempotency-Key` header (they must match if both are sent)
- Same key + same payload → `200` and the original payment (also under a create race)
- Same key + different amount/currency/email/token → `409 IDEMPOTENCY_CONFLICT`

**Routes**

| Method | Path | Result |
|---|---|---|
| `POST /payments` | `201` create, `200` replay |
| `GET /payments/:id` | `200` / `404` / `400` bad UUID |
| `GET /payments?status=` | list |
| `PATCH` / `PUT /payments/:id` | cancel only |

Example:

```bash
curl -s http://127.0.0.1:4000/payments \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: order-42' \
  -d '{"amount":2500,"currency":"NGN","merchantRef":"order-42"}'
```

---

**User**

Review the Job queue + simulated processor + startup recovery implementation and make updates.

---

**Cursor**

I'll review the in-process job queue, a simulated processor, and startup recovery implementation for payments left in `pending` or `processing` and make updates.

Background processing is in place. `POST /payments` still returns immediately as `pending`; a worker finishes the payment afterward.

**Queue** (`src/jobs/payment-job-queue.ts`)
- In-process queue, concurrency 2
- Jobs are idempotent: terminal payments are skipped
- Processor errors retry (default 3 attempts), then `failed` with `PROCESSOR_UNAVAILABLE`
- Duplicate enqueue of the same id is ignored
- Shutdown drains in-flight jobs; leftover `pending`/`processing` are recovered on the next boot

**Processor** (`src/jobs/processor.ts`)
- Simulated delay, then success or `PROCESSOR_DECLINED`
- Failure rate and delay are env-configurable

**Recovery**
- On listen, unfinished `pending` and `processing` payments are re-queued

**Flow:** `pending → processing → succeeded | failed`. Cancel while still queued stays `cancelled` and is not charged.

```bash
# deterministic local run
PROCESSOR_FAILURE_RATE=0 PROCESSOR_DELAY_MS=500 npm start
```

Poll `GET /payments/:id` until status leaves `pending`.

---

**User**

Review the added Jest + Supertest test I have written and add more for uncovered codes.

---

**Cursor**

I'll review and update the Jest and Supertest with unit tests for the status machine and API tests that inject a fake processor so we don't wait on the simulator.

Jest + Supertest are in place. `npm test` currently passes **29 tests** in 7 suites.

**Run:** `npm test` (Jest `--runInBand`)

**Unit**
- Status machine (legal/illegal transitions)
- Payment schema (amount, currency, `buildPayment`)
- File repository (persist, duplicate `merchantRef`, stale version)
- Idempotent create vs payload conflict
- Simulated processor success/decline

**API (Supertest, temp JSON store, fake processor)**
- Create stays `pending`, then GET by id
- Idempotent replay `200` / conflict `409`
- Validation `400`, unknown id `404`
- Cancel pending; reject `succeeded` from the client
- Background success and decline
- Illegal cancel after success `409`
- Health, Helmet headers, `x-request-id`

Tests inject a processor so they do not wait on the real delay. Missing data files are treated as an empty store (Jest was surfacing `ENOENT` differently than a raw Node run).

---

**User**

Add OpenAPI + README

---

**Cursor**

I'll add OpenAPI (Swagger UI) and a README that covers setup, the API, and how to run tests.

OpenAPI and the README are in place. All **31** tests pass.

**Docs**
- Swagger UI: `http://127.0.0.1:4000/docs`
- Spec: `http://127.0.0.1:4000/docs/openapi.json`

The spec covers health, create/list/get/cancel, idempotency, request IDs, and the error envelope.

**README** covers setup, env vars, the status machine, idempotency, background jobs/recovery, how to run tests, layout, and known limits (single process, simulated processor, no auth).

```bash
npm start
# open http://127.0.0.1:4000/docs
```

That completes the planned delivery order. I have not committed; say if you want a commit (or several, matching each step).

---

**User**

Simplify the README so that even a non-tech person can understand it. Make it more human understandable

---

**Cursor**

The README is rewritten in plain language. It now explains the service like a checkout: you place an order, it stays pending, then it succeeds, fails, or you cancel in time.

Technical tables (env vars, error codes, folder map, status machine) are gone. What’s left is how to start it, the docs link, a short walkthrough, and what it will not do.


