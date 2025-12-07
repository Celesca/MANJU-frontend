"""
Workflow Executor using LangGraph
Converts frontend workflow JSON to executable LangGraph and runs it.
Includes FAISS + OpenAI Embeddings for RAG functionality.
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
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    FAISS_AVAILABLE = True
except ImportError as e:
    FAISS_AVAILABLE = False
    logging.warning(f"FAISS/LangChain imports failed: {e}")

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
        output_variable_name = node_data.get("outputVariableName", "")
        
        # Create LLM with specific model and temperature
        llm = None
        if os.getenv("OPENAI_API_KEY"):
            llm = ChatOpenAI(
                model=model_name,
                temperature=temperature,
                openai_api_key=os.getenv("OPENAI_API_KEY"),
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
            # Mock response for demo
            state["response"] = f"[Demo Mode - No OpenAI API Key] Received: {state['user_message']}"
            state["model_used"] = "mock"
            if output_variable_name:
                state["output_variables"][output_variable_name] = state["response"]
        
        return state
    
    def process_rag_documents(self, state: WorkflowState, node_data: Dict) -> WorkflowState:
        """Process rag-documents node - retrieves relevant context using FAISS + OpenAI."""
        state["nodes_executed"].append("rag-documents")

        if not FAISS_AVAILABLE:
            state["rag_context"] = "[FAISS not installed] Install faiss-cpu and langchain-community."
            return state

        if not os.getenv("OPENAI_API_KEY"):
            state["rag_context"] = "[OpenAI API key required for embeddings]"
            return state

        try:
            # Get configuration from node data
            documents_path = node_data.get("documentsPath", "./documents")
            project_id = node_data.get("projectId", "")
            user_id = node_data.get("userId", "")
            top_k = node_data.get("topK", 3)
            
            # Build index path
            index_base = os.getenv("FAISS_INDEX_PATH", "./faiss_indexes")
            if project_id:
                index_persist_dir = os.path.join(index_base, user_id, project_id)
            else:
                index_persist_dir = os.path.join(index_base, "default")

            # Get user query
            query = state["user_message"]

            # Initialize OpenAI embeddings
            embeddings = OpenAIEmbeddings(
                model="text-embedding-3-small",
                openai_api_key=os.getenv("OPENAI_API_KEY")
            )

            # Try to load existing FAISS index
            index_path = Path(index_persist_dir)
            vectorstore = None

            if index_path.exists() and (index_path / "index.faiss").exists():
                try:
                    vectorstore = FAISS.load_local(
                        str(index_path),
                        embeddings,
                        allow_dangerous_deserialization=True
                    )
                    logger.info(f"Loaded existing FAISS index from {index_path}")
                except Exception as e:
                    logger.warning(f"Failed to load FAISS index: {e}")

            if vectorstore is None:
                # Try to create index from documents
                docs_path = Path(documents_path)
                if docs_path.exists():
                    documents = load_documents_from_directory(str(docs_path))
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
                        index_path.mkdir(parents=True, exist_ok=True)
                        vectorstore.save_local(str(index_path))
                        logger.info(f"Created and saved FAISS index to {index_path}")
                    else:
                        state["rag_context"] = f"[No documents found at {documents_path}]"
                        return state
                else:
                    state["rag_context"] = f"[Documents directory not found: {documents_path}]"
                    return state

            # Query the vector store
            docs_and_scores = vectorstore.similarity_search_with_score(query, k=top_k)

            # Format context
            context_parts = []
            for i, (doc, score) in enumerate(docs_and_scores, 1):
                text = doc.page_content[:500] + "..." if len(doc.page_content) > 500 else doc.page_content
                source = doc.metadata.get("source", "Unknown")
                context_parts.append(f"[Source {i}: {Path(source).name} (score: {score:.3f})]\n{text}")

            if context_parts:
                state["rag_context"] = "\n\n".join(context_parts)
            else:
                state["rag_context"] = "[No relevant documents found]"

        except Exception as e:
            logger.exception("Error in RAG processing")
            state["rag_context"] = f"[RAG Error: {str(e)}]"

        return state
    
    def process_google_sheets(self, state: WorkflowState, node_data: Dict) -> WorkflowState:
        """Process google-sheets node - fetches data from sheets."""
        state["nodes_executed"].append("google-sheets")
        
        spreadsheet_id = node_data.get("spreadsheetId", "")
        sheet_name = node_data.get("sheetName", "Sheet1")
        
        # For demo, return mock data
        state["sheets_data"] = f"[Demo] Data from {sheet_name}: Sample row 1, Sample row 2"
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
        """Build a LangGraph from workflow configuration."""
        
        # Create state graph
        graph = StateGraph(WorkflowState)
        
        # Parse nodes and connections
        nodes = {n.id: n for n in workflow.nodes}
        connections = workflow.connections
        
        # Build adjacency list with port info for conditional routing
        # Structure: {source_id: [(target_id, source_port_id), ...]}
        adjacency_with_ports: Dict[str, List[tuple]] = {n.id: [] for n in workflow.nodes}
        for conn in connections:
            adjacency_with_ports[conn.sourceNodeId].append((conn.targetNodeId, conn.sourcePortId))
        
        # Find entry nodes (nodes with no incoming connections)
        incoming = {n.id: 0 for n in workflow.nodes}
        for conn in connections:
            incoming[conn.targetNodeId] += 1
        
        entry_nodes = [nid for nid, count in incoming.items() if count == 0]
        exit_nodes = [nid for nid, targets in adjacency_with_ports.items() if not targets]
        
        # Identify if-condition nodes for conditional routing
        if_condition_nodes = {nid for nid, node in nodes.items() if node.type == "if-condition"}
        
        # Add nodes to graph
        for node_id, node in nodes.items():
            processor = self._get_processor(node.type)
            if processor:
                # Create a closure to capture node data and node_id
                def make_node_fn(proc, data, nid):
                    def node_fn(state: WorkflowState) -> WorkflowState:
                        # Pass node_id in data for condition tracking
                        data_with_id = {**data, "id": nid} if isinstance(data, dict) else {"id": nid}
                        return proc(state, data_with_id)
                    return node_fn
                
                node_data = node.data if hasattr(node, 'data') else {}
                graph.add_node(node_id, make_node_fn(processor, node_data, node_id))
        
        # Add edges - handle if-condition nodes specially
        for source_id, targets_with_ports in adjacency_with_ports.items():
            if not targets_with_ports:
                continue
                
            if source_id in if_condition_nodes:
                # For if-condition nodes, use conditional edges
                # Find true and false targets based on port IDs
                true_targets = [t for t, port in targets_with_ports if "true" in port.lower()]
                false_targets = [t for t, port in targets_with_ports if "false" in port.lower()]
                
                # Create conditional router function
                def make_condition_router(node_id, true_tgts, false_tgts):
                    def router(state: WorkflowState) -> str:
                        # Get the condition result for this node
                        result = state.get("condition_results", {}).get(node_id, False)
                        logger.info(f"Routing from {node_id}: condition={result}, true_targets={true_tgts}, false_targets={false_tgts}")
                        if result and true_tgts:
                            return true_tgts[0]  # Return first true target
                        elif not result and false_tgts:
                            return false_tgts[0]  # Return first false target
                        elif true_tgts:
                            return true_tgts[0]  # Fallback to true
                        elif false_tgts:
                            return false_tgts[0]  # Fallback to false
                        return END
                    return router
                
                # Build the mapping of possible destinations
                route_map = {}
                for target, port in targets_with_ports:
                    if target in nodes:
                        route_map[target] = target
                route_map[END] = END
                
                if route_map:
                    graph.add_conditional_edges(
                        source_id,
                        make_condition_router(source_id, true_targets, false_targets),
                        route_map
                    )
            else:
                # For regular nodes, add normal edges
                # If multiple targets, just use the first one (shouldn't happen in normal workflows)
                for target_id, _ in targets_with_ports:
                    if target_id in nodes:
                        graph.add_edge(source_id, target_id)
                        break  # Only add one edge for non-conditional nodes
        
        # Set entry point
        if entry_nodes:
            graph.set_entry_point(entry_nodes[0])
        
        # Set finish points for nodes with no outgoing edges
        for exit_node in exit_nodes:
            if exit_node not in if_condition_nodes:  # Conditional edges already handle END
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
        }
        
        # Execute the graph
        try:
            final_state = compiled.invoke(initial_state)
            return {
                "response": final_state.get("response", "No response generated"),
                "nodes_executed": final_state.get("nodes_executed", []),
                "model_used": final_state.get("model_used"),
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
