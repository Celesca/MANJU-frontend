# MANJU AI Workflow Service

LangGraph-based workflow execution service for the MANJU Voice Call Center chatbot.

## Features

- Executes workflow configurations from the frontend
- Supports multiple AI providers (OpenAI, Together AI, OpenRouter)
- LangGraph-based orchestration for complex workflows
- RAG document retrieval (optional)
- Google Sheets integration (optional)

## Quick Start

1. **Install dependencies:**
   ```bash
   cd ai_references
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your API key (at least one):
   # - OPENAI_API_KEY for OpenAI
   # - TOGETHER_API_KEY for Together AI
   # - OPENROUTER_API_KEY for OpenRouter
   ```

3. **Run the service:**
   ```bash
   python main.py
   # Or with uvicorn:
   uvicorn main:app --reload --port 8000
   ```

4. **Test the service:**
   ```bash
   curl http://localhost:8000/health
   ```

## API Endpoints

### `GET /health`
Health check endpoint. Returns service status and available models.

### `POST /chat`
Execute a chat interaction using a workflow configuration.

**Request:**
```json
{
  "message": "Hello, how are you?",
  "workflow": {
    "nodes": [...],
    "connections": [...]
  },
  "conversation_history": [],
  "session_id": "optional-session-id"
}
```

**Response:**
```json
{
  "response": "I'm doing great! How can I help you?",
  "model_used": "gpt-4o-mini",
  "processing_time_ms": 1234.56,
  "nodes_executed": ["text-input", "ai-model", "text-output"]
}
```

### `POST /validate`
Validate a workflow configuration without executing it.

## Supported Node Types

| Node Type | Description |
|-----------|-------------|
| `text-input` | Captures user text input |
| `text-output` | Outputs text response |
| `voice-input` | Voice input (STT) |
| `voice-output` | Voice output (TTS) |
| `ai-model` | LLM processing with configurable model |
| `rag-documents` | RAG retrieval from documents |
| `google-sheets` | Google Sheets data integration |
| `if-condition` | Conditional branching |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Frontend       │────▶│  Go Backend     │────▶│  AI Service     │
│  (React)        │     │  (Fiber)        │     │  (FastAPI)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  LangGraph      │
                                                │  Workflow       │
                                                └─────────────────┘
```

## License

MIT
