"""
Workflow Executor Service using LangGraph
Executes workflow configurations from the frontend and returns AI responses.
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from workflow_executor import WorkflowExecutor, DocumentEmbeddingService

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global instances
executor: Optional[WorkflowExecutor] = None
embedding_service: Optional[DocumentEmbeddingService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    global executor, embedding_service
    logger.info("Starting AI Workflow Service...")
    executor = WorkflowExecutor()
    embedding_service = DocumentEmbeddingService()
    yield
    logger.info("Shutting down AI Workflow Service...")


app = FastAPI(
    title="MANJU AI Workflow Service",
    description="LangGraph-based workflow execution service for voice chatbot workflows",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Request/Response Models
# =============================================================================

class NodePort(BaseModel):
    id: str
    label: str
    position: Optional[str] = None


class WorkflowNode(BaseModel):
    id: str
    type: str
    position: Dict[str, float]
    data: Dict[str, Any] = Field(default_factory=dict)
    inputs: List[NodePort] = Field(default_factory=list)
    outputs: List[NodePort] = Field(default_factory=list)


class Connection(BaseModel):
    id: str
    sourceNodeId: str
    sourcePortId: str
    targetNodeId: str
    targetPortId: str


class WorkflowConfig(BaseModel):
    """Workflow configuration from frontend."""
    nodes: List[WorkflowNode]
    connections: List[Connection]


class ChatRequest(BaseModel):
    """Request for chat interaction."""
    message: str
    workflow: WorkflowConfig
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    """Response from chat interaction."""
    response: str
    model_used: Optional[str] = None
    processing_time_ms: float
    nodes_executed: List[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    models_available: List[str]


class WorkflowTypeResponse(BaseModel):
    """Response for workflow type detection."""
    input_type: str  # "text" or "voice"
    output_type: str  # "text" or "voice"
    workflow_type: str  # "text-to-text", "text-to-voice", "voice-to-text", "voice-to-voice"
    has_rag: bool
    has_sheets: bool
    has_condition: bool


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    models = []
    if os.getenv("OPENAI_API_KEY"):
        models.append("openai")
    if os.getenv("TOGETHER_API_KEY"):
        models.append("together")
    if os.getenv("OPENROUTER_API_KEY"):
        models.append("openrouter")
    
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        models_available=models if models else ["none - configure API keys"],
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Execute a chat interaction using the provided workflow configuration.
    
    The workflow is converted to a LangGraph and executed with the user's message.
    """
    if executor is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        start_time = datetime.now()
        
        # Execute the workflow
        result = await executor.execute(
            message=request.message,
            workflow=request.workflow,
            conversation_history=request.conversation_history,
            session_id=request.session_id,
        )
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return ChatResponse(
            response=result.get("response", "No response generated"),
            model_used=result.get("model_used"),
            processing_time_ms=processing_time,
            nodes_executed=result.get("nodes_executed", []),
        )
    
    except Exception as e:
        logger.exception("Error executing workflow")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/validate")
async def validate_workflow(workflow: WorkflowConfig):
    """
    Validate a workflow configuration without executing it.
    Returns information about the workflow structure.
    """
    if executor is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        validation = executor.validate_workflow(workflow)
        return validation
    except Exception as e:
        logger.exception("Error validating workflow")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/workflow-type", response_model=WorkflowTypeResponse)
async def get_workflow_type(workflow: WorkflowConfig):
    """
    Detect the workflow input/output modalities.
    
    Returns whether the workflow expects text or voice input,
    and whether it produces text or voice output.
    """
    if executor is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        workflow_type = executor.get_workflow_type(workflow)
        return WorkflowTypeResponse(**workflow_type)
    except Exception as e:
        logger.exception("Error detecting workflow type")
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# Document Embedding Endpoints
# =============================================================================

class EmbedDocumentsRequest(BaseModel):
    """Request to embed documents from a directory."""
    documents_path: str
    user_id: str
    project_id: str


class EmbedDocumentsResponse(BaseModel):
    """Response from document embedding."""
    success: bool
    documents_count: Optional[int] = None
    chunks_count: Optional[int] = None
    index_path: Optional[str] = None
    error: Optional[str] = None


class QueryDocumentsRequest(BaseModel):
    """Request to query embedded documents."""
    query: str
    user_id: str
    project_id: str
    top_k: int = 3


class QueryDocumentsResponse(BaseModel):
    """Response from document query."""
    success: bool
    results: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None


class DeleteIndexRequest(BaseModel):
    """Request to delete a document index."""
    user_id: str
    project_id: str


@app.post("/embed-documents", response_model=EmbedDocumentsResponse)
async def embed_documents(request: EmbedDocumentsRequest):
    """
    Embed documents from a directory into a FAISS vector store.
    
    This endpoint is called by the Go backend after documents are uploaded.
    """
    if embedding_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        result = embedding_service.embed_documents(
            documents_path=request.documents_path,
            user_id=request.user_id,
            project_id=request.project_id,
        )
        return EmbedDocumentsResponse(**result)
    except Exception as e:
        logger.exception("Error embedding documents")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query-documents", response_model=QueryDocumentsResponse)
async def query_documents(request: QueryDocumentsRequest):
    """
    Query embedded documents for similar content.
    """
    if embedding_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        result = embedding_service.query_documents(
            query=request.query,
            user_id=request.user_id,
            project_id=request.project_id,
            top_k=request.top_k,
        )
        return QueryDocumentsResponse(**result)
    except Exception as e:
        logger.exception("Error querying documents")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/delete-index")
async def delete_index(request: DeleteIndexRequest):
    """
    Delete a FAISS index for a project.
    """
    if embedding_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        result = embedding_service.delete_index(
            user_id=request.user_id,
            project_id=request.project_id,
        )
        return result
    except Exception as e:
        logger.exception("Error deleting index")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("AI_SERVICE_PORT", "8000"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info",
    )
