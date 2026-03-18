# MANJU Architecture Summary

## Academic Paper Ready (High-Level)

### Abstract-Oriented Overview

MANJU is a modular no-code orchestration platform for multimodal AI agents, designed to support rapid construction of text-to-text, text-to-voice, voice-to-text, and voice-to-voice workflows. The architecture separates interaction, orchestration, and inference concerns into independent services, enabling flexible model substitution, reproducible workflow execution, and deployment portability across local and cloud environments. The system combines workflow-graph execution (LangGraph), retrieval-augmented generation (RAG), and configurable speech synthesis backends (OpenAI TTS and Qwen3-TTS) to support domain-adaptive conversational applications.

### Problem Framing

Conventional conversational AI pipelines are often monolithic, tightly coupled to a single model provider, and difficult for non-programmers to adapt. MANJU addresses this by introducing a visual workflow abstraction with explicit node-level composition, while preserving production-oriented requirements such as authentication, API key governance, context injection, and modality-aware output routing.

### Core Contributions

1. **Workflow-as-Data Architecture**: agent logic is represented as persisted graph JSON (`nodes`, `connections`), enabling deterministic reconstruction and execution.
2. **Multimodal Runtime Switching**: a single project can route to text or voice pipelines via workflow-type detection and provider-aware output handling.
3. **Dual-TTS Integration Pattern**: coexistence of hosted API TTS and local model-based TTS (Qwen3) under a unified interface.
4. **RAG + Tool Context Fusion**: workflow execution supports simultaneous document retrieval and structured external context (Google Sheets).
5. **Separation of Concerns for Reproducibility**: frontend UX, backend orchestration, and AI inference are independently deployable and testable.

### Architectural Rationale

- **Frontend (interaction layer)** handles authoring, validation triggers, and demo playback, but does not execute model logic.
- **Go backend (control/orchestration layer)** enforces access control, resolves user-specific credentials, injects project context, and normalizes API contracts.
- **AI backend (reasoning layer)** compiles workflow graphs into executable state graphs and manages model/tool invocation.
- **Qwen TTS runtime (specialized inference layer)** isolates GPU-intensive speech generation and voice-reference handling.

This layered architecture reduces coupling, allows heterogeneous model evolution, and supports incremental extension (new node types, providers, or tool adapters) with minimal cross-layer breakage.

### Research and Evaluation Positioning

For academic reporting, MANJU can be framed as a **systems contribution** in practical LLM orchestration. Typical evaluation dimensions:

- **Functional correctness**: success rate of workflow execution across modality combinations.
- **Latency decomposition**: frontend->backend, backend->AI, graph execution, and TTS synthesis components.
- **Scalability behavior**: concurrent workflow invocations and impact of retrieval/tool nodes.
- **Robustness**: behavior under missing keys, unavailable model providers, and partial node misconfiguration.
- **Usability proxy metrics**: workflow authoring steps/time and configuration error frequency.

### Threats to Validity (Suggested for Paper)

- Performance observations may vary by model provider, GPU type, and document corpus characteristics.
- In-memory voice-reference cache behavior is runtime-dependent and may differ from persistent-store deployments.
- Port and environment mismatches in mixed local/cloud setups can influence measured reliability if not normalized.

### Practical Significance

MANJU demonstrates how a visual workflow representation can bridge experimental AI pipelines and production constraints. The architecture is suitable for educational, SME, and enterprise prototyping contexts where rapid multimodal iteration, provider optionality, and clear service boundaries are more valuable than single-model optimization.

## 1) System Overview

MANJU is a multi-service workflow platform for building and testing AI-powered text/voice pipelines.

Primary layers:

- **Frontend**: React + TypeScript (Vite), workflow builder + demo console
- **Backend API**: Go + Fiber + GORM (PostgreSQL), authentication, project persistence, API orchestration
- **AI Backend**: Python + FastAPI + LangGraph/LangChain, workflow execution, RAG embedding/query, Qwen TTS proxy endpoints
- **Qwen TTS Runtime**: Python + FastAPI + PyTorch, direct Qwen3-TTS model inference and voice-reference caching

High-level runtime flow:

1. User builds a workflow in frontend (nodes + connections)
2. Workflow is saved in Go backend as JSON in PostgreSQL
3. Demo/test requests go to Go backend (`/demo` or `/talk`)
4. Go backend loads workflow JSON, injects context (user/project/API key), forwards to AI backend
5. AI backend executes graph and returns text (or text + streamed voice audio)

---

## 2) Repository / Service Topology

### Root app (frontend web)

- Vite app served in dev on `5173`
- Production build served by Nginx (root `Dockerfile`)
- Central API helper attaches:
  - `X-API-Key` (from `VITE_MANJU_API_KEY`)
  - `Authorization: Bearer <JWT>`

### `backend/` (Go API service)

- Fiber app listens on `:8080`
- CORS enabled for configured frontend origin
- Global API key guard middleware
- JWT auth middleware for `/api/*` routes (unless `DISABLE_AUTH=true`)
- GORM connects to PostgreSQL and auto-migrates core models

### `ai_backend/` (AI workflow service)

- FastAPI service (default `:8000` in code/docs; compose currently maps as `:5000` in one profile)
- Converts workflow JSON into executable LangGraph state graph
- Supports:
  - Chat execution (`/chat`)
  - Workflow validation/type detection (`/validate`, `/workflow-type`)
  - OpenAI TTS (`/tts`)
  - Combined workflow + Qwen3 audio streaming (`/talk`)
  - Voice reference cache APIs
  - Document embedding/query APIs (`/embed-documents`, `/query-documents`, `/delete-index`)

### `ai_backend/qwen3_tts.py` (dedicated TTS runtime)

- Separate FastAPI app for Qwen3 model inference
- Preloads configurable default model on startup (`QWEN_TTS_PRELOAD_MODEL`)
- Supports 3 generation modes:
  - `custom` voice preset
  - `voice-clone` from reference audio
  - `voice-design` from textual style description
- Maintains in-memory voice reference cache and temp file lifecycle cleanup

---

## 3) Frontend Architecture

Core app behavior:

- Route-based SPA (`src/App.tsx`)
- Public pages: home, features, pricing, about, login
- Auth-protected pages: voice studio, demo, settings
- Workflow editor page: `ModelConfig`
- Demo runner page: `DemoPage`

Workflow editor (`ModelConfig`) responsibilities:

- Drag/drop node creation
- Connection management
- Node-specific config panels
- Save/load workflow to backend project APIs
- Launch demo page for execution testing

Node model:

- Nodes + connections are stored as JSON arrays
- Includes node templates for input, processing, data, and output nodes
- `voice-output` node supports both OpenAI and Qwen3 settings:
  - provider, mode, preset voice, instruction, voice-description,
  - reference voice ID/transcript, fast mode toggle

Demo page (`DemoPage`) execution strategy:

- Detects workflow type via backend `/workflow-type`
- For standard text flow: uses `/projects/:id/demo`
- For Qwen3 voice output: uses `/projects/:id/talk` (single request returns audio + metadata headers)
- Supports replay behavior with direct `/qwen-tts/text-to-voice`

---

## 4) Backend (Go) Architecture

### App bootstrap

`backend/main.go` wires:

- env loading
- DB connection
- CORS + API key guard
- optional dev auth bypass
- OAuth auth routes
- protected `/api` route group
- route modules: users, voices, projects, Qwen TTS

### Route groups

- `/auth/*` (Google OAuth + JWT issuance/introspection)
- `/api/users/*` (user CRUD + API key management)
- `/api/voices/*` (voice metadata CRUD + upload/serve + cloning)
- `/api/projects/*`:
  - project CRUD
  - demo execution (`/:id/demo`)
  - workflow validation/type (`/:id/validate`, `/:id/workflow-type`)
  - OpenAI TTS (`/:id/tts`)
  - documents CRUD + embedding trigger
  - Qwen talk (`/:id/talk`)
- `/api/qwen-tts/*`:
  - health
  - text-to-voice
  - voice reference CRUD proxy

### Service layer behavior

`demoService.go`:

- Loads project workflow JSON from DB
- Injects user/project metadata into RAG nodes
- Resolves user API key (selected key -> default key -> legacy key fallback)
- Proxies execution to AI backend `/chat`

`qwenTTSService.go`:

- Proxies workflow+voice requests to AI backend `/talk`
- Extracts `voice-output` node settings from stored workflow when frontend omits fields
- Streams WAV back to frontend and forwards metadata headers:
  - `X-Text-Response`
  - `X-Model-Used`
  - `X-Processing-Time-Ms`
  - `X-Nodes-Executed`
- Proxies voice-reference cache operations

`documentService.go`:

- Stores uploaded docs under user/project folder
- Updates project node data metadata
- Triggers embedding job on AI backend (`/embed-documents`)

### Persistence model (PostgreSQL via GORM)

Auto-migrated entities:

- `User`
- `Session`
- `Project` (workflow JSON in `nodes` and `connections` as `jsonb`)
- `UserAPIKey` (encrypted key + default selection)
- `Voice`

---

## 5) AI Backend (Python) Architecture

### Workflow execution engine

`workflow_executor.py`:

- Detects workflow modality (`text/voice` input/output)
- Detects TTS provider from `voice-output` node (`openai` or `qwen3`)
- Builds and executes LangGraph state machine
- Supports conditional branching (`if-condition`)
- Supports data context enrichment from:
  - RAG (FAISS index)
  - Google Sheets (gspread)
- Returns model used, response text, nodes executed, timing

### AI API (`main.py`) endpoint responsibilities

Core endpoints:

- `/health`
- `/chat`
- `/validate`
- `/workflow-type` (includes `tts_provider`)
- `/tts` (OpenAI TTS)

Qwen-integrated endpoints:

- `/talk` (run workflow then synthesize voice; returns audio stream + metadata headers)
- `/talk/text-to-voice`
- `/voice-references/*` CRUD (cache proxy)
- `/qwen-tts/health`

RAG endpoints:

- `/embed-documents`
- `/query-documents`
- `/delete-index`

---

## 6) Authentication & Security Model

- Google OAuth login via `/auth/login/google` and callback
- Backend issues JWT (7-day expiry)
- Frontend stores JWT from URL fragment (`#token=...`)
- Protected API routes require Bearer token (`RequireAuth` middleware)
- Additional request-level API key guard (`X-API-Key`) for service access
- User LLM keys are encrypted in DB and resolved at request time for AI calls

---

## 7) Voice / TTS Subsystem

Two TTS paths coexist:

1. **OpenAI TTS path**
   - Backend project endpoint: `/projects/:id/tts`
   - Suitable for standard text-to-speech in existing workflows

2. **Qwen3 TTS path**
   - Combined flow endpoint: `/projects/:id/talk`
   - Executes workflow + TTS in one call
   - Supports custom preset, clone, and voice design
   - Supports cached voice-reference upload/list/update/delete

Qwen pipeline ownership:

- Frontend defines voice-output config
- Go backend hydrates missing voice settings from stored node data
- AI backend executes workflow and delegates synthesis to Qwen service
- Audio is streamed back as `audio/wav`

---

## 8) Document/RAG Subsystem

- User uploads docs via Go API per project
- Files are stored in filesystem by user/project folder
- Embedding trigger calls AI backend, which:
  - loads docs (`pdf`, `txt`, `docx`)
  - chunks with recursive splitter
  - embeds with OpenAI embeddings
  - stores FAISS index under configurable index path
- Query endpoint returns relevant chunks/context for workflow execution

---

## 9) Deployment Topology

Current repository supports multiple runtime modes:

- **Frontend container**: Nginx serving built Vite static assets
- **Go backend container**: Fiber API service (`8080`)
- **AI backend container**: FastAPI workflow service
- **PostgreSQL container**: persistent DB volume

`docker-compose.yml` expresses this multi-container setup.

Note: There are mixed references to AI backend ports (`5000` in compose vs `8000` defaults in some code/docs). Aligning these environment values is important for consistent deployments.

---

## 10) End-to-End Request Flows

### A) Text demo flow

1. Frontend `DemoPage` -> `POST /api/projects/:id/demo`
2. Go backend loads workflow + user key context
3. Go backend -> AI backend `/chat`
4. AI backend executes LangGraph and returns text response
5. Frontend renders message

### B) Qwen voice output flow

1. Frontend `DemoPage` detects `output_type=voice` and `tts_provider=qwen3`
2. Frontend -> `POST /api/projects/:id/talk`
3. Go backend loads workflow, infers voice settings from `voice-output` node
4. Go backend -> AI backend `/talk`
5. AI backend runs workflow, synthesizes Qwen speech, streams WAV back
6. Go forwards stream + metadata headers to frontend
7. Frontend plays audio and displays text from headers

### C) Document embedding flow

1. Frontend uploads document to `/api/projects/:id/documents`
2. Go stores file under user/project directory and updates project metadata
3. Frontend/Go triggers `/api/projects/:id/documents/embed`
4. Go calls AI `/embed-documents`
5. AI builds FAISS index for that user/project

---

## 11) Main Strengths of Current Architecture

- Clear separation of concerns between UI, orchestration API, and AI execution
- Workflow persisted as JSON for no-code editing flexibility
- Hybrid TTS support (OpenAI + Qwen3) with unified UX
- User-specific API key handling and project-level context injection
- Extensible node architecture for future workflow capabilities

## 12) Key Operational Considerations

- Keep AI service URL/port variables consistent across compose and code defaults
- Ensure Qwen runtime GPU environment is available for production inference
- Consider persistent/object storage for voice-reference files if cache should survive restarts
- Monitor end-to-end timeout settings for long workflow + TTS calls
- Align CORS origins and auth token handling across all deployed domains
