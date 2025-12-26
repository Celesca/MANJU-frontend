"""
Workflow Executor using LangGraph
Converts frontend workflow JSON to executable LangGraph and runs it.
Includes FAISS + OpenAI Embeddings for RAG functionality.
Includes Google Sheets integration via gspread.
"""

import os
import logging
from typing import Any, Dict, List, Literal, Optional, TypedDict
from datetime import datetime
from pathlib import Path
import json

from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI


# FAISS and embedding imports
try:
    import faiss
    from langchain_openai import OpenAIEmbeddings
    from langchain_community.vectorstores import FAISS
    from langchain_community.document_loaders import (
        PyPDFLoader,
        TextLoader,
        Docx2txtLoader,
    )
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    FAISS_AVAILABLE = True
except ImportError as e:
    FAISS_AVAILABLE = False
    logging.warning(f"FAISS/LangChain imports failed: {e}")

# Google Sheets imports
try:
    import gspread
    from oauth2client.service_account import ServiceAccountCredentials
    import pandas as pd
    GSPREAD_AVAILABLE = True
except ImportError as e:
    GSPREAD_AVAILABLE = False
    logging.warning(f"gspread imports failed: {e}")

logger = logging.getLogger(__name__)


# =============================================================================
# Workflow Type Detection
# =============================================================================

WorkflowType = Literal["text-to-text", "text-to-voice", "voice-to-text", "voice-to-voice"]
InputType = Literal["text", "voice"]
OutputType = Literal["text", "voice"]


def detect_workflow_type(nodes: List) -> Dict[str, Any]:
    """
    Detect the workflow input/output modalities based on node types.
    
    Returns:
        Dict with input_type, output_type, workflow_type
    """
    node_types = [n.type if hasattr(n, 'type') else n.get('type', '') for n in nodes]
    
    # Detect input type
    has_text_input = "text-input" in node_types
    has_voice_input = "voice-input" in node_types
    
    # Detect output type
    has_text_output = "text-output" in node_types
    has_voice_output = "voice-output" in node_types
    
    # Determine input type (prefer voice if both exist)
    input_type: InputType = "voice" if has_voice_input else "text"
    
    # Determine output type (prefer voice if both exist)
    output_type: OutputType = "voice" if has_voice_output else "text"
    
    # Determine workflow type
    workflow_type: WorkflowType = f"{input_type}-to-{output_type}"  # type: ignore
    
    return {
        "input_type": input_type,
        "output_type": output_type,
        "workflow_type": workflow_type,
        "has_rag": "rag-documents" in node_types,
        "has_sheets": "google-sheets" in node_types,
        "has_condition": "if-condition" in node_types,
    }


# =============================================================================
# State Definition
# =============================================================================

class WorkflowState(TypedDict):
    """State passed through the workflow graph."""
    # Input
    user_message: str
    conversation_history: List[Dict[str, str]]
    
    # Processing
    current_context: str
    rag_context: Optional[str]
    sheets_data: Optional[str]
    
    # Conditions
    condition_results: Dict[str, bool]
    
    # Output
    response: str
    nodes_executed: List[str]
    model_used: Optional[str]
    
    # Output tracking for conditions
    output_variables: Dict[str, str]
    
    # User-provided API key
    openai_api_key: Optional[str]


# =============================================================================
# Document Loading Helpers
# =============================================================================

def load_documents_from_directory(directory_path: str) -> List:
    """Load documents from a directory, supporting PDF, DOCX, and TXT files."""
    documents = []
    path = Path(directory_path)
    
    if not path.exists():
        logger.warning(f"Directory not found: {directory_path}")
        return documents
    
    for file_path in path.iterdir():
        if file_path.is_file():
            try:
                ext = file_path.suffix.lower()
                if ext == ".pdf":
                    loader = PyPDFLoader(str(file_path))
                    documents.extend(loader.load())
                elif ext == ".txt":
                    loader = TextLoader(str(file_path))
                    documents.extend(loader.load())
                elif ext in [".docx", ".doc"]:
                    loader = Docx2txtLoader(str(file_path))
                    documents.extend(loader.load())
                else:
                    logger.debug(f"Skipping unsupported file: {file_path}")
            except Exception as e:
                logger.warning(f"Failed to load {file_path}: {e}")
    
    logger.info(f"Loaded {len(documents)} documents from {directory_path}")
    return documents


# =============================================================================
# Document Embedding Service
# =============================================================================

class DocumentEmbeddingService:
    """Service for embedding documents into FAISS vector store."""
    
    def __init__(self):
        self.embeddings = None
        if os.getenv("OPENAI_API_KEY"):
            self.embeddings = OpenAIEmbeddings(
                model="text-embedding-3-small",
                openai_api_key=os.getenv("OPENAI_API_KEY")
            )
    
    def embed_documents(
        self,
        documents_path: str,
        user_id: str,
        project_id: str,
    ) -> Dict[str, Any]:
        """
        Embed documents from a directory into a FAISS index.
        
        Args:
            documents_path: Path to the directory containing documents
            user_id: User ID for organizing indexes
            project_id: Project ID for organizing indexes
            
        Returns:
            Dict with status and number of documents embedded
        """
        if not FAISS_AVAILABLE:
            return {"success": False, "error": "FAISS not available"}
        
        if not self.embeddings:
            return {"success": False, "error": "OpenAI API key not configured"}
        
        try:
            # Load documents
            documents = load_documents_from_directory(documents_path)
            if not documents:
                return {"success": False, "error": f"No documents found at {documents_path}"}
            
            # Split documents
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
            )
            splits = text_splitter.split_documents(documents)
            
            # Create FAISS index
            vectorstore = FAISS.from_documents(splits, self.embeddings)
            
            # Save index
            index_base = os.getenv("FAISS_INDEX_PATH", "./faiss_indexes")
            index_path = Path(index_base) / user_id / project_id
            index_path.mkdir(parents=True, exist_ok=True)
            vectorstore.save_local(str(index_path))
            
            logger.info(f"Embedded {len(documents)} documents ({len(splits)} chunks) to {index_path}")
            
            return {
                "success": True,
                "documents_count": len(documents),
                "chunks_count": len(splits),
                "index_path": str(index_path),
            }
            
        except Exception as e:
            logger.exception("Error embedding documents")
            return {"success": False, "error": str(e)}
    
    def query_documents(
        self,
        query: str,
        user_id: str,
        project_id: str,
        top_k: int = 3,
    ) -> Dict[str, Any]:
        """
        Query the FAISS index for similar documents.
        
        Args:
            query: The query string
            user_id: User ID
            project_id: Project ID
            top_k: Number of results to return
            
        Returns:
            Dict with results and scores
        """
        if not FAISS_AVAILABLE:
            return {"success": False, "error": "FAISS not available"}
        
        if not self.embeddings:
            return {"success": False, "error": "OpenAI API key not configured"}
        
        try:
            # Load index
            index_base = os.getenv("FAISS_INDEX_PATH", "./faiss_indexes")
            index_path = Path(index_base) / user_id / project_id
            
            if not (index_path / "index.faiss").exists():
                return {"success": False, "error": "Index not found. Please embed documents first."}
            
            vectorstore = FAISS.load_local(
                str(index_path),
                self.embeddings,
                allow_dangerous_deserialization=True
            )
            
            # Query
            docs_and_scores = vectorstore.similarity_search_with_score(query, k=top_k)
            
            results = []
            for doc, score in docs_and_scores:
                results.append({
                    "content": doc.page_content,
                    "source": doc.metadata.get("source", "Unknown"),
                    "score": float(score),
                })
            
            return {"success": True, "results": results}
            
        except Exception as e:
            logger.exception("Error querying documents")
            return {"success": False, "error": str(e)}
    
    def delete_index(self, user_id: str, project_id: str) -> Dict[str, Any]:
        """Delete a FAISS index for a project."""
        try:
            index_base = os.getenv("FAISS_INDEX_PATH", "./faiss_indexes")
            index_path = Path(index_base) / user_id / project_id
            
            if index_path.exists():
                import shutil
                shutil.rmtree(index_path)
                return {"success": True, "message": f"Deleted index at {index_path}"}
            
            return {"success": True, "message": "Index did not exist"}
            
        except Exception as e:
            logger.exception("Error deleting index")
            return {"success": False, "error": str(e)}


# =============================================================================
# Node Processors
# =============================================================================

class NodeProcessors:
    """Processors for different node types."""
    
    def __init__(self):
        self.llm = self._create_llm()
    
    def _create_llm(self):
        """Create the LLM based on available API keys."""
        # Try OpenAI first
        if os.getenv("OPENAI_API_KEY"):
            return ChatOpenAI(
                model="gpt-4o-mini",
                temperature=0.7,
            )
        
        # Try Together AI via LiteLLM
        if os.getenv("TOGETHER_API_KEY"):
            return ChatOpenAI(
                model="together_ai/Qwen/Qwen2.5-7B-Instruct-Turbo",
                api_key=os.getenv("TOGETHER_API_KEY"),
                base_url="https://api.together.xyz/v1",
            )
        
        # Try OpenRouter
        if os.getenv("OPENROUTER_API_KEY"):
            return ChatOpenAI(
                model="qwen/qwen-2.5-7b-instruct",
                api_key=os.getenv("OPENROUTER_API_KEY"),
                base_url="https://openrouter.ai/api/v1",
            )
        
        logger.warning("No API key found, using mock responses")
        return None
    
    def process_text_input(self, state: WorkflowState, node_data: Dict) -> WorkflowState:
        """Process text-input node - captures user input."""
        state["nodes_executed"].append("text-input")
        # Initialize output_variables if not present
        if "output_variables" not in state:
            state["output_variables"] = {}
        # User message is already in state
        return state
    
    def process_ai_model(self, state: WorkflowState, node_data: Dict) -> WorkflowState:
        """Process ai-model node - generates AI response with OpenAI."""
        state["nodes_executed"].append("ai-model")
        
        # Initialize output_variables if not present
        if "output_variables" not in state:
            state["output_variables"] = {}
        
        # Get configuration from node data
        model_name = node_data.get("modelName", "gpt-4o-mini")
        system_prompt = node_data.get("systemPrompt", "You are a helpful assistant.")
        temperature = node_data.get("temperature", 0.7)
        expected_output = node_data.get("expectedOutput", "")
        # Frontend uses `outputVariable` (see AIModelConfigPanel.tsx / types). Accept both keys for safety.
        output_variable_name = node_data.get("outputVariable", node_data.get("outputVariableName", ""))
        
        # Get API key: STRICTLY use user-provided key. Do NOT fall back to environment variable!
        api_key = state.get("openai_api_key")
        
        # Create LLM if key is provided
        llm = None
        if api_key:
            llm = ChatOpenAI(
                model=model_name,
                temperature=temperature,
                openai_api_key=api_key,
            )
        
        # Build system prompt with expected output format if specified
        full_system_prompt = system_prompt
        if expected_output:
            full_system_prompt += f"\n\nIMPORTANT: Your response MUST follow this format: {expected_output}"
        
        # Build messages
        messages = [SystemMessage(content=full_system_prompt)]
        
        # Add conversation history
        for msg in state.get("conversation_history", []):
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg.get("content", "")))
            elif msg.get("role") == "assistant":
                messages.append(AIMessage(content=msg.get("content", "")))
        
        # Add RAG context if available
        context_parts = []
        if state.get("rag_context"):
            context_parts.append(f"Relevant context from documents:\n{state['rag_context']}")
        if state.get("sheets_data"):
            context_parts.append(f"Data from spreadsheet:\n{state['sheets_data']}")
        
        # Add current message with context
        user_content = state["user_message"]
        if context_parts:
            user_content = f"{chr(10).join(context_parts)}\n\nUser query: {user_content}"
        
        # Debug: log whether rag context is present and a short preview
        try:
            rag_present = bool(state.get("rag_context"))
            rag_preview = (state.get("rag_context") or "").replace("\n", " ")[:400]
            user_preview = user_content.replace("\n", " ")[:400]
            logger.info("AI Model call: rag_present=%s, rag_preview=%s", rag_present, rag_preview)
            logger.debug("AI Model final user_content (truncated): %s", user_preview)
        except Exception:
            logger.exception("Error logging AI call debug info")

        messages.append(HumanMessage(content=user_content))
        
        # Generate response
        if llm:
            try:
                response = llm.invoke(messages)
                state["response"] = response.content
                state["model_used"] = model_name
                
                # Store output in variable if name specified (for use in conditions)
                if output_variable_name:
                    state["output_variables"][output_variable_name] = response.content
                    logger.info(f"Stored AI output in variable '{output_variable_name}'")
                    
            except Exception as e:
                logger.exception("LLM error")
                state["response"] = f"Error generating response: {str(e)}"
        else:
            # Mock response for demo when no key is provided
            state["response"] = f"[Demo Mode - No OpenAI API Key configured in Settings] Message received: {state['user_message']}"
            state["model_used"] = "none (mock)"
            if output_variable_name:
                state["output_variables"][output_variable_name] = state["response"]
        
        return state
    
    def process_rag_documents(self, state: WorkflowState, node_data: Dict) -> WorkflowState:
        """Process rag-documents node - retrieves relevant context using FAISS + OpenAI."""
        state["nodes_executed"].append("rag-documents")

        if not FAISS_AVAILABLE:
            state["rag_context"] = "[FAISS not installed] Install faiss-cpu and langchain-community."
            return state

        # Get API key: STRICTLY use user-provided key.
        api_key = state.get("openai_api_key")

        if not api_key:
            state["rag_context"] = "[OpenAI API key required for embeddings - Configure in Settings]"
            return state

        try:
            # Resolve documents path
            # Priority: node data -> ENV DOCUMENTS_STORAGE_PATH -> ../backend/uploads/documents (relative to this file)
            base_documents_dir = Path(os.getenv("DOCUMENTS_STORAGE_PATH", "")).resolve() if os.getenv("DOCUMENTS_STORAGE_PATH") else (Path(__file__).resolve().parent.parent / "backend" / "uploads" / "documents")
            project_id = node_data.get("projectId", "")
            user_id = node_data.get("userId", "")
            top_k = node_data.get("topK", 3)
            
            # Build the full documents path including user_id/project_id to match Go backend layout
            # Go backend stores documents at: uploads/documents/<userId>/<projectId>/
            if node_data.get("documentsPath"):
                # Use explicit path if provided
                documents_path = node_data.get("documentsPath")
            elif user_id and project_id:
                # Build path with user_id and project_id
                documents_path = str(base_documents_dir / user_id / project_id)
            elif project_id:
                # Fallback to project_id only
                documents_path = str(base_documents_dir / project_id)
            else:
                documents_path = str(base_documents_dir)
            
            # Build index path. Prefer per-user/per-project index when both user_id and project_id present.
            index_base = os.getenv("FAISS_INDEX_PATH", str(Path(__file__).resolve().parent / "faiss_indexes"))
            if project_id:
                if user_id:
                    index_persist_dir = os.path.join(index_base, user_id, project_id)
                else:
                    # Fallback to project-only index path if user_id is not provided
                    index_persist_dir = os.path.join(index_base, project_id)
            else:
                index_persist_dir = os.path.join(index_base, "default")

            # Get user query
            query = state["user_message"]

            # Initialize OpenAI embeddings with user key
            embeddings = OpenAIEmbeddings(
                model="text-embedding-3-small",
                openai_api_key=api_key
            )

            # Try to load existing FAISS index. Support multiple possible index layouts
            # Candidate order: (1) index_base/user_id/project_id, (2) index_base/project_id, (3) index_base/project_id (legacy)
            vectorstore = None
            state.setdefault("rag_debug", {})
            tried_index_paths = []

            candidates = []
            # Prefer user/project if both provided
            if user_id and project_id:
                candidates.append(os.path.join(index_base, user_id, project_id))
            # Project-only path
            if project_id:
                candidates.append(os.path.join(index_base, project_id))
            # Fallback: index_base/default
            candidates.append(os.path.join(index_base, "default"))

            # Try each candidate until we find an index.faiss
            index_loaded = False
            for cand in candidates:
                cand_path = Path(cand)
                tried_index_paths.append(str(cand_path))
                cand_index_file = cand_path / "index.faiss"
                exists = cand_path.exists() and cand_index_file.exists()
                state["rag_debug"].setdefault("index_candidates", [])
                state["rag_debug"]["index_candidates"].append({"path": str(cand_path), "exists": exists})
                if exists:
                    try:
                        vectorstore = FAISS.load_local(str(cand_path), embeddings, allow_dangerous_deserialization=True)
                        logger.info("Loaded existing FAISS index from %s", cand_path)
                        index_loaded = True
                        state["rag_debug"]["index_loaded_from"] = str(cand_path)
                        break
                    except Exception as e:
                        logger.warning("Failed to load FAISS index at %s: %s", cand_path, e)
                        state["rag_debug"].setdefault("index_load_errors", []).append({"path": str(cand_path), "error": str(e)})

            # Record what we tried
            state["rag_debug"]["index_paths_tried"] = tried_index_paths
            state["rag_debug"]["index_exists_any"] = index_loaded
            state["rag_debug"]["user_id"] = user_id
            state["rag_debug"]["project_id"] = project_id
            state["rag_debug"]["documents_path"] = documents_path
            logger.info("RAG: user_id=%s project_id=%s | index_candidates=%s | loaded=%s | documents_path=%s", user_id, project_id, tried_index_paths, index_loaded, documents_path)

            if vectorstore is None:
                # Try to create index from documents
                docs_path = Path(documents_path)
                if docs_path.exists():
                    documents = load_documents_from_directory(str(docs_path))
                    state["rag_debug"]["documents_found"] = len(documents)
                    logger.info("RAG embedding: documents_found=%s at %s", len(documents), docs_path)
                    if documents:
                        # Split documents
                        text_splitter = RecursiveCharacterTextSplitter(
                            chunk_size=1000,
                            chunk_overlap=200,
                        )
                        splits = text_splitter.split_documents(documents)

                        # Create FAISS index
                        vectorstore = FAISS.from_documents(splits, embeddings)

                        # Save for future use
                        # Save to the preferred candidate (first in our candidates list)
                        try:
                            index_path = Path(candidates[0]) if candidates else Path(index_base) / "default"
                        except Exception:
                            index_path = Path(index_base) / "default"
                        index_path.mkdir(parents=True, exist_ok=True)
                        vectorstore.save_local(str(index_path))
                        logger.info(f"Created and saved FAISS index to {index_path}")
                        state["rag_debug"]["index_created"] = True
                        state["rag_debug"]["chunks_count"] = len(splits)
                    else:
                            # No documents to embed - record debug and avoid injecting error text
                            state.setdefault("rag_debug", {})
                            state["rag_debug"]["error"] = "no_documents_found"
                            state["rag_debug"]["error_message"] = f"No documents found at {documents_path}"
                            state["rag_debug"]["index_created"] = False
                            logger.warning("No documents found at %s", documents_path)
                            state["rag_context"] = None
                            return state
                else:
                        # Record error in debug but do not inject error text into rag_context
                        state.setdefault("rag_debug", {})
                        state["rag_debug"]["error"] = "documents_directory_not_found"
                        state["rag_debug"]["error_message"] = f"Documents directory not found: {documents_path}"
                        logger.warning("Documents directory not found: %s", documents_path)
                        # Leave rag_context as None so AI model won't receive an error string as context
                        state["rag_context"] = None
                        return state

            # Query the vector store
            docs_and_scores = vectorstore.similarity_search_with_score(query, k=top_k)
            state["rag_debug"]["results_requested"] = top_k

            # Format context
            context_parts = []
            for i, (doc, score) in enumerate(docs_and_scores, 1):
                text = doc.page_content[:500] + "..." if len(doc.page_content) > 500 else doc.page_content
                source = doc.metadata.get("source", "Unknown")
                context_parts.append(f"[Source {i}: {Path(source).name} (score: {score:.3f})]\n{text}")

            if context_parts:
                state["rag_context"] = "\n\n".join(context_parts)
                state["rag_debug"]["results_count"] = len(context_parts)
                # Log a short preview of the retrieved context
                try:
                    preview = state["rag_context"].replace("\n", " ")[:800]
                    logger.info("RAG provided context: results_count=%s preview=%s", len(context_parts), preview)
                except Exception:
                    logger.exception("Error logging RAG context preview")
            else:
                    # No relevant documents found - don't set an error string into rag_context
                    state["rag_debug"]["results_count"] = 0
                    state["rag_debug"]["note"] = "no_relevant_documents"
                    state["rag_context"] = None

        except Exception as e:
            logger.exception("Error in RAG processing")
            state["rag_context"] = f"[RAG Error: {str(e)}]"

        return state
    
    def process_google_sheets(self, state: WorkflowState, node_data: Dict) -> WorkflowState:
        """Process google-sheets node - fetches data from sheets using gspread."""
        state["nodes_executed"].append("google-sheets")
        
        spreadsheet_id = node_data.get("spreadsheetId", "")
        sheet_name = node_data.get("sheetName", "Sheet1")
        
        if not GSPREAD_AVAILABLE:
            logger.warning("gspread not available, returning mock data")
            state["sheets_data"] = f"[Google Sheets not available] Could not fetch data from {sheet_name}"
            return state
        
        if not spreadsheet_id:
            logger.warning("No spreadsheet ID provided")
            state["sheets_data"] = "[Error] No spreadsheet ID configured"
            return state
        
        try:
            # Define the scope for Google Sheets API
            scope = [
                'https://spreadsheets.google.com/feeds',
                'https://www.googleapis.com/auth/drive'
            ]
            
            # Look for credentials file in the ai_backend directory
            credentials_file = os.path.join(os.path.dirname(__file__), 'client_secret.json')
            
            if not os.path.exists(credentials_file):
                logger.warning(f"Credentials file not found at {credentials_file}")
                state["sheets_data"] = "[Error] Google Sheets credentials not configured"
                return state
            
            # Authorize and create client
            credentials = ServiceAccountCredentials.from_json_keyfile_name(credentials_file, scope)
            client = gspread.authorize(credentials)
            
            # Open spreadsheet by ID
            try:
                spreadsheet = client.open_by_key(spreadsheet_id)
            except gspread.SpreadsheetNotFound:
                logger.warning(f"Spreadsheet not found: {spreadsheet_id}")
                state["sheets_data"] = f"[Error] Spreadsheet not found. Make sure it's shared with the service account."
                return state
            
            # Get the specific worksheet
            try:
                worksheet = spreadsheet.worksheet(sheet_name)
            except gspread.WorksheetNotFound:
                logger.warning(f"Worksheet not found: {sheet_name}")
                # Try to get the first sheet as fallback
                worksheet = spreadsheet.sheet1
                logger.info(f"Using first sheet: {worksheet.title}")
            
            # Get all records as a list of dictionaries
            records = worksheet.get_all_records()
            
            if not records:
                # Try getting all values if no headers
                all_values = worksheet.get_all_values()
                if all_values:
                    # Convert to markdown table format
                    headers = all_values[0] if all_values else []
                    rows = all_values[1:] if len(all_values) > 1 else []
                    
                    if headers and rows:
                        # Create markdown table
                        df = pd.DataFrame(rows, columns=headers)
                        sheets_context = f"Data from Google Sheet '{sheet_name}':\n\n{df.to_markdown(index=False)}"
                    else:
                        sheets_context = f"Google Sheet '{sheet_name}' appears to be empty."
                else:
                    sheets_context = f"Google Sheet '{sheet_name}' is empty."
            else:
                # Convert records to DataFrame and then to markdown
                df = pd.DataFrame(records)
                
                # Limit to first 50 rows for context (to avoid token limits)
                if len(df) > 50:
                    df_preview = df.head(50)
                    sheets_context = f"Data from Google Sheet '{sheet_name}' (showing first 50 of {len(df)} rows):\n\n{df_preview.to_markdown(index=False)}"
                else:
                    sheets_context = f"Data from Google Sheet '{sheet_name}' ({len(df)} rows):\n\n{df.to_markdown(index=False)}"
            
            logger.info(f"Successfully fetched data from sheet '{sheet_name}': {len(records)} records")
            state["sheets_data"] = sheets_context
            
        except Exception as e:
            logger.error(f"Error fetching Google Sheets data: {str(e)}")
            state["sheets_data"] = f"[Error] Failed to fetch data from Google Sheets: {str(e)}"
        
        return state
    
    def process_if_condition(self, state: WorkflowState, node_data: Dict) -> WorkflowState:
        """Process if-condition node - evaluates condition against message or output variables."""
        state["nodes_executed"].append("if-condition")
        
        condition_type = node_data.get("conditionType", "contains")
        field = node_data.get("field", "response")  # Can be "message", "response", or a variable name
        # Frontend sends conditionValue, but also check for value as fallback
        value = node_data.get("conditionValue", node_data.get("value", ""))
        
        # Get the field to check - supports checking output variables
        check_value = ""
        if field == "message":
            check_value = state.get("user_message", "")
        elif field == "response":
            check_value = state.get("response", "")
        elif field in state.get("output_variables", {}):
            # Check output variable by name
            check_value = state["output_variables"].get(field, "")
        else:
            # Try to find in output_variables as fallback
            check_value = state.get("output_variables", {}).get(field, state.get("response", ""))
        
        # Truncate for logging
        log_check_value = check_value[:50] + "..." if len(check_value) > 50 else check_value
        logger.info(f"If-condition checking '{field}' ({condition_type}) against '{value}': check_value='{log_check_value}'")
        
        # Evaluate condition
        result = False
        if condition_type == "contains":
            result = value.lower() in check_value.lower() if value else False
        elif condition_type == "equals":
            result = check_value.lower().strip() == value.lower().strip()
        elif condition_type == "startsWith":
            result = check_value.lower().strip().startswith(value.lower().strip()) if value else False
        elif condition_type == "endsWith":
            result = check_value.lower().strip().endswith(value.lower().strip()) if value else False
        elif condition_type == "regex":
            import re
            try:
                result = bool(re.search(value, check_value, re.IGNORECASE)) if value else False
            except:
                result = False
        elif condition_type == "isYes":
            # Check if response is affirmative
            affirmatives = ["yes", "y", "true", "1", "correct", "affirmative", "yeah", "yep"]
            result = check_value.lower().strip() in affirmatives
        elif condition_type == "isNo":
            # Check if response is negative
            negatives = ["no", "n", "false", "0", "incorrect", "negative", "nope", "nah"]
            result = check_value.lower().strip() in negatives
        
        logger.info(f"If-condition result: {result}")
        state["condition_results"][node_data.get("id", "condition")] = result
        return state
    
    def process_text_output(self, state: WorkflowState, node_data: Dict) -> WorkflowState:
        """Process text-output node - formats final output."""
        state["nodes_executed"].append("text-output")
        # Response is already in state from AI model
        return state


# =============================================================================
# Workflow Executor
# =============================================================================

class WorkflowExecutor:
    """Executes workflow configurations using LangGraph."""
    
    def __init__(self):
        self.processors = NodeProcessors()
    
    def _build_graph(self, workflow) -> StateGraph:
        """Build a LangGraph from workflow configuration.
        
        Special handling for RAG nodes:
        - RAG nodes provide context to AI models
        - When RAG connects to AI model's context port, RAG runs first
        - RAG populates state["rag_context"] which AI model consumes
        
        IMPORTANT: LangGraph requires sequential execution - no parallel branches
        that write to the same state keys. We must build a linear chain.
        """
        
        # Create state graph
        graph = StateGraph(WorkflowState)
        
        # Parse nodes and connections
        nodes = {n.id: n for n in workflow.nodes}
        connections = workflow.connections
        
        # Build adjacency list with port info
        # Structure: {source_id: [(target_id, source_port_id, target_port_id), ...]}
        adjacency: Dict[str, List[tuple]] = {n.id: [] for n in workflow.nodes}
        incoming: Dict[str, List[tuple]] = {n.id: [] for n in workflow.nodes}
        
        for conn in connections:
            source_port = conn.sourcePortId if hasattr(conn, 'sourcePortId') else getattr(conn, 'source_port_id', '')
            target_port = conn.targetPortId if hasattr(conn, 'targetPortId') else getattr(conn, 'target_port_id', '')
            adjacency[conn.sourceNodeId].append((conn.targetNodeId, source_port, target_port))
            incoming[conn.targetNodeId].append((conn.sourceNodeId, source_port, target_port))
        
        # Identify node types
        if_condition_nodes = {nid for nid, node in nodes.items() if node.type == "if-condition"}
        rag_nodes = {nid for nid, node in nodes.items() if node.type == "rag-documents"}
        sheets_nodes = {nid for nid, node in nodes.items() if node.type == "google-sheets"}
        ai_model_nodes = {nid for nid, node in nodes.items() if node.type == "ai-model"}
        input_nodes = {nid for nid, node in nodes.items() if node.type in ("text-input", "voice-input")}
        
        # Find which RAG nodes connect to which AI models (via context port)
        rag_to_ai: Dict[str, str] = {}  # rag_id -> ai_id
        ai_from_rag: Dict[str, str] = {}  # ai_id -> rag_id
        for rag_id in rag_nodes:
            for target_id, source_port, target_port in adjacency.get(rag_id, []):
                if target_id in ai_model_nodes:
                    rag_to_ai[rag_id] = target_id
                    ai_from_rag[target_id] = rag_id
        
        # Find which Google Sheets nodes connect to which AI models (via context port)
        sheets_to_ai: Dict[str, str] = {}  # sheets_id -> ai_id
        ai_from_sheets: Dict[str, str] = {}  # ai_id -> sheets_id
        for sheets_id in sheets_nodes:
            for target_id, source_port, target_port in adjacency.get(sheets_id, []):
                if target_id in ai_model_nodes:
                    sheets_to_ai[sheets_id] = target_id
                    ai_from_sheets[target_id] = sheets_id
        
        logger.info(f"RAG to AI mappings: {rag_to_ai}")
        logger.info(f"Sheets to AI mappings: {sheets_to_ai}")
        
        # Add all nodes to graph
        for node_id, node in nodes.items():
            processor = self._get_processor(node.type)
            if processor:
                def make_node_fn(proc, data, nid):
                    def node_fn(state: WorkflowState) -> WorkflowState:
                        data_with_id = {**data, "id": nid} if isinstance(data, dict) else {"id": nid}
                        return proc(state, data_with_id)
                    return node_fn
                
                node_data = node.data if hasattr(node, 'data') else {}
                graph.add_node(node_id, make_node_fn(processor, node_data, node_id))
        
        # Build edges - must be LINEAR to avoid concurrent updates
        # Strategy: For each AI model that has a RAG connection, ensure:
        #   input → RAG → AI model (not input → AI model AND RAG → AI model in parallel)
        
        added_edges = set()
        
        for source_id, targets in adjacency.items():
            if not targets:
                continue
            
            source_node = nodes[source_id]
            
            if source_id in if_condition_nodes:
                # Conditional routing for if-condition nodes
                true_targets = [t for t, sport, _ in targets if "true" in sport.lower()]
                false_targets = [t for t, sport, _ in targets if "false" in sport.lower()]
                
                def make_router(node_id, true_tgts, false_tgts):
                    def router(state: WorkflowState) -> str:
                        result = state.get("condition_results", {}).get(node_id, False)
                        logger.info(f"Routing from {node_id}: condition={result}")
                        if result and true_tgts:
                            return true_tgts[0]
                        elif not result and false_tgts:
                            return false_tgts[0]
                        return END
                    return router
                
                route_map = {t: t for t, _, _ in targets if t in nodes}
                route_map[END] = END
                
                if route_map:
                    graph.add_conditional_edges(
                        source_id,
                        make_router(source_id, true_targets, false_targets),
                        route_map
                    )
                    for t, _, _ in targets:
                        added_edges.add((source_id, t))
                        
            elif source_id in input_nodes:
                # Input node: check if any target AI model has a RAG or Sheets feeding into it
                for target_id, _, target_port in targets:
                    if target_id in ai_model_nodes and target_id in ai_from_rag:
                        # This AI model has RAG - route input → RAG instead of input → AI
                        rag_id = ai_from_rag[target_id]
                        if (source_id, rag_id) not in added_edges:
                            graph.add_edge(source_id, rag_id)
                            added_edges.add((source_id, rag_id))
                            logger.info(f"Redirected input→AI to input→RAG: {source_id} → {rag_id}")
                    elif target_id in ai_model_nodes and target_id in ai_from_sheets:
                        # This AI model has Sheets - route input → Sheets instead of input → AI
                        sheets_id = ai_from_sheets[target_id]
                        if (source_id, sheets_id) not in added_edges:
                            graph.add_edge(source_id, sheets_id)
                            added_edges.add((source_id, sheets_id))
                            logger.info(f"Redirected input→AI to input→Sheets: {source_id} → {sheets_id}")
                    elif target_id in rag_nodes:
                        # Direct input → RAG connection
                        if (source_id, target_id) not in added_edges:
                            graph.add_edge(source_id, target_id)
                            added_edges.add((source_id, target_id))
                    elif target_id in sheets_nodes:
                        # Direct input → Sheets connection
                        if (source_id, target_id) not in added_edges:
                            graph.add_edge(source_id, target_id)
                            added_edges.add((source_id, target_id))
                    else:
                        # Normal connection
                        if (source_id, target_id) not in added_edges:
                            graph.add_edge(source_id, target_id)
                            added_edges.add((source_id, target_id))
                            
            elif source_id in rag_nodes:
                # RAG node: connect to its AI model target
                for target_id, _, _ in targets:
                    if (source_id, target_id) not in added_edges:
                        graph.add_edge(source_id, target_id)
                        added_edges.add((source_id, target_id))
                        logger.info(f"Added RAG→target edge: {source_id} → {target_id}")
            elif source_id in sheets_nodes:
                # Sheets node: connect to its AI model target
                for target_id, _, _ in targets:
                    if (source_id, target_id) not in added_edges:
                        graph.add_edge(source_id, target_id)
                        added_edges.add((source_id, target_id))
                        logger.info(f"Added Sheets→target edge: {source_id} → {target_id}")
            else:
                # Other nodes: add edges normally
                for target_id, _, _ in targets:
                    if (source_id, target_id) not in added_edges:
                        graph.add_edge(source_id, target_id)
                        added_edges.add((source_id, target_id))
        
        # Find entry nodes (no incoming edges after our modifications)
        # An entry node is one with no incoming connections in the ORIGINAL graph
        original_incoming_count = {n.id: 0 for n in workflow.nodes}
        for conn in connections:
            original_incoming_count[conn.targetNodeId] += 1
        
        entry_candidates = [nid for nid, count in original_incoming_count.items() if count == 0]
        
        # Prefer input nodes as entry, then RAG/Sheets if no input
        input_entries = [nid for nid in entry_candidates if nid in input_nodes]
        rag_entries = [nid for nid in entry_candidates if nid in rag_nodes]
        sheets_entries = [nid for nid in entry_candidates if nid in sheets_nodes]
        
        if input_entries:
            graph.set_entry_point(input_entries[0])
            logger.info(f"Entry point: {input_entries[0]} (input node)")
        elif rag_entries:
            graph.set_entry_point(rag_entries[0])
            logger.info(f"Entry point: {rag_entries[0]} (RAG node)")
        elif sheets_entries:
            graph.set_entry_point(sheets_entries[0])
            logger.info(f"Entry point: {sheets_entries[0]} (Sheets node)")
        elif entry_candidates:
            graph.set_entry_point(entry_candidates[0])
            logger.info(f"Entry point: {entry_candidates[0]}")
        
        # Find exit nodes (no outgoing edges)
        exit_nodes = [nid for nid, targets in adjacency.items() if not targets]
        for exit_node in exit_nodes:
            if exit_node not in if_condition_nodes:
                graph.add_edge(exit_node, END)
        
        return graph
    
    def _get_processor(self, node_type: str):
        """Get the processor function for a node type."""
        processors = {
            "text-input": self.processors.process_text_input,
            "ai-model": self.processors.process_ai_model,
            "rag-documents": self.processors.process_rag_documents,
            "google-sheets": self.processors.process_google_sheets,
            "if-condition": self.processors.process_if_condition,
            "text-output": self.processors.process_text_output,
            "voice-input": self.processors.process_text_input,  # Same as text for now
            "voice-output": self.processors.process_text_output,  # Same as text for now
        }
        return processors.get(node_type)
    
    async def execute(
        self,
        message: str,
        workflow,
        conversation_history: List[Dict[str, str]],
        session_id: Optional[str] = None,
        openai_api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute a workflow with the given message."""
        
        # Build the graph
        try:
            graph = self._build_graph(workflow)
            compiled = graph.compile()
        except Exception as e:
            logger.exception("Error building graph")
            return {
                "response": f"Error building workflow: {str(e)}",
                "nodes_executed": [],
                "model_used": None,
            }
        
        # Initialize state
        initial_state: WorkflowState = {
            "user_message": message,
            "conversation_history": conversation_history,
            "current_context": "",
            "rag_context": None,
            "sheets_data": None,
            "condition_results": {},
            "response": "",
            "nodes_executed": [],
            "model_used": None,
            "output_variables": {},  # Track AI outputs for conditions
            "openai_api_key": openai_api_key,  # User-provided API key
        }
        
        # Execute the graph
        try:
            final_state = compiled.invoke(initial_state)
            return {
                "response": final_state.get("response", "No response generated"),
                "nodes_executed": final_state.get("nodes_executed", []),
                "model_used": final_state.get("model_used"),
                # Expose rag debug info to help troubleshooting RAG connectivity
                "rag_debug": final_state.get("rag_debug", {}),
            }
        except Exception as e:
            logger.exception("Error executing workflow")
            return {
                "response": f"Error executing workflow: {str(e)}",
                "nodes_executed": [],
                "model_used": None,
            }
    
    def validate_workflow(self, workflow) -> Dict[str, Any]:
        """Validate a workflow configuration."""
        nodes = workflow.nodes
        connections = workflow.connections
        
        # Check for required nodes
        node_types = [n.type for n in nodes]
        has_input = "text-input" in node_types or "voice-input" in node_types
        has_output = "text-output" in node_types or "voice-output" in node_types
        has_ai = "ai-model" in node_types
        
        issues = []
        if not has_input:
            issues.append("Workflow needs an input node (text-input or voice-input)")
        if not has_output:
            issues.append("Workflow needs an output node (text-output or voice-output)")
        if not has_ai:
            issues.append("Workflow needs an AI model node")
        
        # Check for orphan nodes
        connected_nodes = set()
        for conn in connections:
            connected_nodes.add(conn.sourceNodeId)
            connected_nodes.add(conn.targetNodeId)
        
        orphans = [n.id for n in nodes if n.id not in connected_nodes and len(nodes) > 1]
        if orphans:
            issues.append(f"Orphan nodes (not connected): {orphans}")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "node_count": len(nodes),
            "connection_count": len(connections),
            "node_types": list(set(node_types)),
        }
    
    def get_workflow_type(self, workflow) -> Dict[str, Any]:
        """
        Get the workflow type based on input/output nodes.
        
        Returns:
            Dict with input_type, output_type, workflow_type, and feature flags
        """
        return detect_workflow_type(workflow.nodes)
