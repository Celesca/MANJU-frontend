# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint
npm run test         # Jest (run all tests)
npm run test:watch   # Jest in watch mode
npm run preview      # Preview production build locally
```

## Environment

Copy `.env` and set:
- `VITE_API_URL` — backend base URL (default: `http://localhost:8080`)
- `VITE_MANJU_API_KEY` — shared API key sent as `X-API-Key` header on every request

## Architecture

**MANJU** is a Thai-language AI Agent Builder — a React 19 + Vite SPA where users compose drag-and-drop workflow nodes and test them live in a chat interface.

### Auth flow

1. User clicks "Login with Google" → redirect to backend `/auth/login/google`
2. Backend redirects back with JWT in URL hash: `#token=<JWT>`
3. `src/main.tsx` extracts the token before React mounts and stores it via `src/stores/authStore.ts` (localStorage key `manju_token`)
4. Every API call goes through `src/utils/api.ts:apiFetch`, which injects both `X-API-Key` and `Authorization: Bearer <token>` headers automatically
5. `src/components/PrivateRoute.tsx` guards protected routes; unauthenticated users are redirected to `/login`

### Routing (`src/App.tsx`)

Public: `/`, `/about`, `/features`, `/pricing`, `/login`
Protected (behind `PrivateRoute`):
- `/console/*` — dashboard layout with sidebar; sub-routes for projects and voices
- `/model-config/:projectId` — workflow builder
- `/demo/:projectId` — interactive chat/demo
- `/settings`, `/voice`

### Workflow builder (`src/pages/ModelConfig.tsx`)

The builder is a canvas of `WorkflowNode` components connected by ports. Node types: `ai-model`, `rag-documents`, `google-sheets`, `voice-input`, `voice-output`, `text-input`, `text-output`, `if-condition`. All domain types live in `src/types/workflow.ts`. Each node type has a dedicated config panel under `src/components/workflow/config/`.

### Demo page (`src/pages/DemoPage.tsx`)

The most complex page. It:
1. Fetches workflow metadata via `/api/projects/:id/workflow-type` to determine I/O mode
2. Determines TTS provider (`openai` vs `qwen3`) and branches accordingly
3. **Qwen3 path**: calls `/api/projects/:id/talk` → returns sentences → streams audio sentence-by-sentence via `playTTSPipeline`
4. **OpenAI path**: calls `/api/projects/:id/demo` for LLM, then `/api/projects/:id/tts` for audio
5. Caches audio blobs in IndexedDB via `src/utils/audioCache.ts` (key pattern: `openai-tts-<messageId>`)
6. Measures LLM and TTS time on the frontend (wrapping each API call with `Date.now()`); uses backend-provided values when returned, otherwise falls back to frontend measurements

Verbose mode shows per-message timing: `Time (ASR)`, `Time (LLM)`, `Time (TTS)`.

### State management

No global state library. State is:
- **Auth**: singleton `authStore.ts` (plain module with localStorage)
- **Everything else**: `useState` / `useEffect` inside each page component
- `useAuth` hook wraps `authStore` for React consumption

### Key files

| File | Purpose |
|---|---|
| `src/utils/api.ts` | `apiFetch` wrapper — always use this instead of `fetch` directly |
| `src/stores/authStore.ts` | JWT token read/write |
| `src/types/workflow.ts` | All workflow domain types |
| `src/types/nodeTemplates.ts` | Node template definitions (labels, ports, defaults) |
| `src/utils/audioCache.ts` | IndexedDB helpers: `getCachedAudio`, `setCachedAudio`, `concatenateWavBlobs` |
| `src/pages/DemoPage.tsx` | Chat interface with voice pipeline — most complex page |
| `src/pages/ModelConfig.tsx` | Drag-and-drop workflow builder |
