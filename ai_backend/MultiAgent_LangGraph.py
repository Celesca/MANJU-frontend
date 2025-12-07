"""
Voice Chatbot Call Center Multi-Agent System with LangGraph
Fast hierarchical architecture with RAG and Google Sheets integration

Migrated from CrewAI to LangGraph for better control flow and state management.
"""

import concurrent.futures
from functools import lru_cache
import os
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, TypedDict, Annotated
import pytz
from collections import OrderedDict

# LangGraph and LangChain imports
try:
    from langgraph.graph import StateGraph, END
    from langgraph.prebuilt import ToolNode
    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
    from langchain_core.tools import tool
    from langchain_openai import ChatOpenAI
    from langchain_community.chat_models import ChatOllama
except ImportError as e:
    raise ImportError("langgraph and langchain are required. Install with: pip install langgraph langchain langchain-openai langchain-community") from e

# Optional imports for full functionality
try:
    import gspread
    from oauth2client.service_account import ServiceAccountCredentials
    SHEETS_AVAILABLE = True
except ImportError:
    SHEETS_AVAILABLE = False
    print("Warning: Google Sheets integration not available. Install: pip install gspread oauth2client")

try:
    import PyPDF2
    import faiss
    import numpy as np
    from sentence_transformers import SentenceTransformer
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False
    print("Warning: RAG functionality not available. Install: pip install PyPDF2 faiss-cpu sentence-transformers")

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Configuration constants
TOGETHER_MODEL = "together_ai/Qwen/Qwen2.5-7B-Instruct-Turbo"
OPENROUTER_MODEL = "openrouter/qwen/qwen3-4b:free"

# Mock Product Database
MOCK_PRODUCTS = [
    {
        "sku": "TEL001",
        "product_name": "สมาร์ทโฟน Galaxy A54",
        "category": "โทรศัพท์",
        "owner_name": "นายสมชาย ใจดี",
        "returned_location": "ร้านค้า Central",
        "returned_date": "2024-12-01"
    },
    {
        "sku": "INT002", 
        "product_name": "แพ็กเกจอินเทอร์เน็ต Fiber 100/30",
        "category": "อินเทอร์เน็ต",
        "owner_name": "นางสาวมณี สีทอง",
        "returned_location": "สาขาเซ็นทรัล",
        "returned_date": "2024-11-28"
    },
    {
        "sku": "TV003",
        "product_name": "Smart TV Samsung 55 นิ้ว",
        "category": "เครื่องใช้ไฟฟ้า",
        "owner_name": "นายประชา รักดี",
        "returned_location": "โลตัส สาขา 2",
        "returned_date": "2024-12-05"
    }
]

def _late_env_hydrate():
    """Load .env file if API keys not found."""
    if os.getenv("TOGETHER_API_KEY") or os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY"):
        return
    
    current = os.path.dirname(__file__)
    search_paths = [current, os.path.dirname(current)]
    
    for base_path in search_paths:
        for _ in range(6):
            env_path = os.path.join(base_path, '.env')
            if os.path.exists(env_path):
                try:
                    with open(env_path, 'r', encoding='utf-8') as f:
                        for line in f:
                            line = line.strip()
                            if line and not line.startswith('#') and '=' in line:
                                key, value = line.split('=', 1)
                                key = key.strip()
                                value = value.strip().strip('"').strip("'")
                                if key and value and not os.getenv(key):
                                    os.environ[key] = value
                    logger.info(f"Loaded environment from {env_path}")
                    return
                except Exception as e:
                    logger.warning(f"Failed to load {env_path}: {e}")
            parent = os.path.dirname(base_path)
            if parent == base_path:
                break
            base_path = parent


# =============================================================================
# STATE DEFINITIONS
# =============================================================================

class AgentState(TypedDict):
    """State for the multi-agent system"""
    # Input
    user_input: str
    conversation_history: Optional[List[Dict[str, Any]]]
    
    # Processing state
    intent: Optional[str]  # PRODUCT, KNOWLEDGE, GENERAL
    intent_reason: Optional[str]
    
    # Intermediate results
    information: Optional[str]
    tool_outputs: List[str]
    
    # Final output
    response: str
    
    # Metadata
    processing_start: float
    model_used: Optional[str]
    route_taken: List[str]


# =============================================================================
# TOOLS IMPLEMENTATION
# =============================================================================

@tool
def get_current_time(query: str = "") -> str:
    """Get current date and time in Thailand timezone.
    
    Args:
        query: Optional query string (unused)
        
    Returns:
        Current time in Thailand timezone
    """
    thailand_tz = pytz.timezone('Asia/Bangkok')
    current_time = datetime.now(thailand_tz).strftime("%Y-%m-%d %H:%M:%S")
    return f"เวลาปัจจุบันในประเทศไทย: {current_time}"


@tool
def query_product_database(
    query_type: str,
    search_term: Optional[str] = None,
    sku: Optional[str] = None,
    owner_name: Optional[str] = None
) -> str:
    """Query product database for SKU, product names, categories, owners, and return information.
    
    Args:
        query_type: Type of query - 'search', 'get_by_sku', 'get_by_owner', 'list_all'
        search_term: Search term for product name, category, or owner
        sku: Product SKU to lookup
        owner_name: Owner name to search by
        
    Returns:
        Product information as string
    """
    if query_type == "list_all":
        return f"พบสินค้าทั้งหมด {len(MOCK_PRODUCTS)} รายการ:\n" + \
               "\n".join([f"- {p['sku']}: {p['product_name']} ({p['category']})" 
                         for p in MOCK_PRODUCTS])
    
    elif query_type == "get_by_sku" and sku:
        for product in MOCK_PRODUCTS:
            if product['sku'].lower() == sku.lower():
                return (f"สินค้า {product['product_name']}\n"
                       f"รหัส: {product['sku']}\n"
                       f"หมวดหมู่: {product['category']}\n"
                       f"เจ้าของ: {product['owner_name']}\n"
                       f"สถานที่คืน: {product['returned_location']}\n"
                       f"วันที่คืน: {product['returned_date']}")
        return f"ไม่พบสินค้าที่มีรหัส {sku}"
    
    elif query_type == "get_by_owner" and owner_name:
        results = [p for p in MOCK_PRODUCTS if owner_name.lower() in p['owner_name'].lower()]
        if results:
            return "\n\n".join([f"- {p['product_name']} (รหัส: {p['sku']}, คืนวันที่: {p['returned_date']})" 
                              for p in results])
        return f"ไม่พบสินค้าของ {owner_name}"
    
    elif query_type == "search" and search_term:
        results = []
        term = search_term.lower()
        for product in MOCK_PRODUCTS:
            if (term in product['product_name'].lower() or 
                term in product['category'].lower() or
                term in product['owner_name'].lower()):
                results.append(product)
        
        if results:
            return f"พบ {len(results)} รายการ:\n" + \
                   "\n".join([f"- {p['sku']}: {p['product_name']} ({p['category']})" 
                             for p in results])
        return f"ไม่พบสินค้าที่ตรงกับ '{search_term}'"
    
    return "กรุณาระบุพารามิเตอร์ที่ถูกต้อง"


# Google Sheets Tool with caching
_sheets_cache = OrderedDict()
_sheets_cache_max = 128

@tool
def query_google_sheets(
    spreadsheet_name: str,
    operation: str,
    search_query: Optional[str] = None,
    new_row_data: Optional[str] = None
) -> str:
    """Read, search, and add data to Google Sheets.
    
    Args:
        spreadsheet_name: Name of the Google Sheet
        operation: Operation to perform - 'read', 'search', 'add_row'
        search_query: Search query for finding specific data
        new_row_data: JSON string of data for new row
        
    Returns:
        Result of the operation
    """
    # Cache key for speed
    cache_key = f"sheets:{spreadsheet_name}|{operation}|{search_query}|{new_row_data}"
    if cache_key in _sheets_cache:
        return _sheets_cache[cache_key]
    
    if not SHEETS_AVAILABLE:
        # Mock response for demo purposes
        if operation == "search" and search_query:
            result = (f"Mock: ค้นหา '{search_query}' ใน {spreadsheet_name}\n"
                     f"พบ 2 รายการที่ตรงกับเงื่อนไข")
        elif operation == "add_row" and new_row_data:
            try:
                data = json.loads(new_row_data) if isinstance(new_row_data, str) else new_row_data
                result = f"Mock: เพิ่มข้อมูลสำเร็จใน {spreadsheet_name}"
            except:
                result = "Mock: รูปแบบข้อมูลไม่ถูกต้อง"
        elif operation == "read":
            result = (f"Mock: อ่านข้อมูลจาก {spreadsheet_name}\n"
                     f"แถวที่ 1: SKU001, สินค้า A, ลูกค้า X\n"
                     f"แถวที่ 2: SKU002, สินค้า B, ลูกค้า Y")
        else:
            result = "Mock: Google Sheets ไม่พร้อมใช้งาน"
        
        # Cache result
        _sheets_cache[cache_key] = result
        if len(_sheets_cache) > _sheets_cache_max:
            _sheets_cache.popitem(last=False)
        return result
    
    # Real implementation would go here
    return "Google Sheets integration not fully implemented"


# RAG Tool with caching
_rag_cache = OrderedDict()
_rag_cache_max = 128
_rag_embedder = None
_rag_index = None
_rag_chunks = []

def _initialize_rag():
    """Initialize RAG components"""
    global _rag_embedder, _rag_index, _rag_chunks
    
    if not RAG_AVAILABLE or _rag_embedder is not None:
        return
    
    try:
        _rag_embedder = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
        
        # Load PDFs from documents folder
        docs_path = os.path.join(os.path.dirname(__file__), "documents")
        if os.path.exists(docs_path):
            texts = []
            for filename in os.listdir(docs_path):
                if filename.endswith('.pdf'):
                    filepath = os.path.join(docs_path, filename)
                    try:
                        with open(filepath, 'rb') as f:
                            pdf_reader = PyPDF2.PdfReader(f)
                            for page in pdf_reader.pages:
                                text = page.extract_text()
                                if text:
                                    texts.append(text)
                    except Exception as e:
                        logger.warning(f"Failed to read {filename}: {e}")
            
            # Create chunks and index
            if texts:
                _rag_chunks = texts
                embeddings = _rag_embedder.encode(_rag_chunks)
                _rag_index = faiss.IndexFlatL2(embeddings.shape[1])
                _rag_index.add(np.array(embeddings).astype('float32'))
                logger.info(f"RAG initialized with {len(_rag_chunks)} chunks")
    except Exception as e:
        logger.error(f"RAG initialization failed: {e}")


@tool
def search_documents(query: str, top_k: int = 3) -> str:
    """Search and retrieve information from PDF documents using RAG.
    
    Args:
        query: Natural language query to search in PDF documents
        top_k: Number of top results to return
        
    Returns:
        Relevant information from documents
    """
    # Cache check
    cache_key = f"rag:{query}|{top_k}"
    if cache_key in _rag_cache:
        return _rag_cache[cache_key]
    
    if not RAG_AVAILABLE:
        result = (f"Mock: ค้นหาเอกสารด้วยคำว่า '{query}'\n"
                 f"พบข้อมูลเกี่ยวกับนโยบายการคืนสินค้าภายใน 7 วัน")
        _rag_cache[cache_key] = result
        if len(_rag_cache) > _rag_cache_max:
            _rag_cache.popitem(last=False)
        return result
    
    _initialize_rag()
    
    if _rag_embedder is None or _rag_index is None:
        return "ระบบค้นหาเอกสารยังไม่พร้อม กรุณาลองใหม่ภายหลัง"
    
    try:
        query_embedding = _rag_embedder.encode([query])
        distances, indices = _rag_index.search(np.array(query_embedding).astype('float32'), top_k)
        
        results = []
        for idx in indices[0]:
            if idx < len(_rag_chunks):
                results.append(_rag_chunks[idx][:500])
        
        result = "\n\n".join(results) if results else "ไม่พบข้อมูลที่เกี่ยวข้อง"
        
        # Cache result
        _rag_cache[cache_key] = result
        if len(_rag_cache) > _rag_cache_max:
            _rag_cache.popitem(last=False)
        
        return result
    except Exception as e:
        return f"เกิดข้อผิดพลาดในการค้นหา: {str(e)}"


# Tool list for LangGraph
ALL_TOOLS = [get_current_time, query_product_database, query_google_sheets, search_documents]


# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class VoiceCallCenterConfig:
    """Configuration for voice call center system."""
    model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", TOGETHER_MODEL))
    temperature: float = 0.2
    max_tokens: int = 128
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    request_timeout: int = 30
    speed_mode: bool = True
    fast_model: Optional[str] = None
    
    def resolve(self):
        """Resolve configuration from environment"""
        # Try OpenRouter first
        if not self.api_key:
            self.api_key = os.getenv("OPENROUTER_API_KEY")
            if self.api_key:
                self.base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
                if self.model == TOGETHER_MODEL:
                    self.model = OPENROUTER_MODEL
        
        # Then Together AI
        if not self.api_key:
            self.api_key = os.getenv("TOGETHER_API_KEY")
            if self.api_key:
                self.base_url = os.getenv("TOGETHER_BASE_URL", "https://api.together.xyz/v1")
        
        # Then OpenAI
        if not self.api_key:
            self.api_key = os.getenv("OPENAI_API_KEY")
            if self.api_key:
                self.base_url = None  # Use default OpenAI endpoint
                self.model = os.getenv("LLM_MODEL", "gpt-3.5-turbo")
        
        # Try loading from .env
        if not self.api_key:
            _late_env_hydrate()
            self.api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("TOGETHER_API_KEY") or os.getenv("OPENAI_API_KEY")
            if os.getenv("OPENROUTER_API_KEY"):
                self.base_url = "https://openrouter.ai/api/v1"
                if self.model == TOGETHER_MODEL:
                    self.model = OPENROUTER_MODEL
            elif os.getenv("OPENAI_API_KEY"):
                self.base_url = None
                self.model = os.getenv("LLM_MODEL", "gpt-3.5-turbo")
            else:
                self.base_url = "https://api.together.xyz/v1"
        
        # Fallback to Ollama
        if not self.api_key:
            self.model = "qwen2.5:7b"
            self.base_url = "http://localhost:11434"
            self.api_key = None
        
        return self
    
    def refresh(self):
        """Refresh configuration from environment"""
        return self.resolve()


# =============================================================================
# GRAPH NODES
# =============================================================================

def supervisor_node(state: AgentState, llm) -> AgentState:
    """Supervisor node that classifies intent"""
    user_input = state["user_input"]
    
    # Build context from history
    history_context = ""
    if state.get("conversation_history"):
        history_items = state["conversation_history"][-3:]  # Last 3 turns
        history_context = "\n".join([
            f"{item.get('role', 'user')}: {item.get('content', '')}"
            for item in history_items
        ])
    
    # Create classification prompt
    prompt = f"""คุณเป็น Call Center Supervisor ที่ต้องจัดประเภทคำถามของลูกค้า

คำถามลูกค้า: "{user_input}"

{f"ประวัติการสนทนา:{chr(10)}{history_context}" if history_context else ""}

จัดประเภทคำถามเป็น:
- PRODUCT: เกี่ยวกับสินค้า SKU การคืนสินค้า ข้อมูลเจ้าของสินค้า แพ็กเกจ ราคา
- KNOWLEDGE: เกี่ยวกับนโยบาย การรับประกัน ขั้นตอน คู่มือ
- GENERAL: คำทักทาย ขอบคุณ คำถามทั่วไป

ตอบเฉพาะ: PRODUCT, KNOWLEDGE, หรือ GENERAL ตามด้วยเหตุผลสั้นๆ 1 ประโยค

รูปแบบ: [ประเภท] - [เหตุผล]"""

    try:
        messages = [SystemMessage(content="คุณเป็นผู้เชี่ยวชาญในการจัดประเภทคำถามอย่างรวดเร็วและแม่นยำ"), 
                   HumanMessage(content=prompt)]
        response = llm.invoke(messages)
        
        # Parse response
        content = response.content.strip()
        intent = "GENERAL"
        reason = "ไม่สามารถระบุได้"
        
        if "PRODUCT" in content.upper():
            intent = "PRODUCT"
            reason = content.split("-", 1)[1].strip() if "-" in content else "คำถามเกี่ยวกับสินค้า"
        elif "KNOWLEDGE" in content.upper():
            intent = "KNOWLEDGE"
            reason = content.split("-", 1)[1].strip() if "-" in content else "คำถามเกี่ยวกับนโยบาย"
        else:
            intent = "GENERAL"
            reason = content.split("-", 1)[1].strip() if "-" in content else "คำถามทั่วไป"
        
        state["intent"] = intent
        state["intent_reason"] = reason
        state["route_taken"].append(f"supervisor -> {intent}")
        
        logger.info(f"Intent classified: {intent} - {reason}")
        
    except Exception as e:
        logger.error(f"Supervisor node error: {e}")
        state["intent"] = "GENERAL"
        state["intent_reason"] = "เกิดข้อผิดพลาดในการจัดประเภท"
        state["route_taken"].append("supervisor -> GENERAL (error)")
    
    return state


def product_node(state: AgentState, llm, tools) -> AgentState:
    """Product specialist node - handles product queries"""
    user_input = state["user_input"]
    
    # Fast path: direct tool calls for common patterns
    text_lower = user_input.lower()
    
    # Try to extract SKU
    sku_match = re.search(r'[a-z]{2,3}\d{3}', text_lower, re.IGNORECASE)
    if sku_match:
        sku = sku_match.group().upper()
        result = query_product_database.invoke({"query_type": "get_by_sku", "sku": sku})
        state["information"] = result
        state["tool_outputs"].append(f"product_db[{sku}]: {result[:200]}")
        state["route_taken"].append("product -> direct_sku")
        return state
    
    # Search by keywords
    if any(kw in text_lower for kw in ['แพ็กเกจ', 'อินเทอร์เน็ต', 'fiber', 'โทรศัพท์', 'galaxy', 'samsung']):
        for keyword in ['อินเทอร์เน็ต', 'fiber', 'โทรศัพท์', 'galaxy', 'samsung', 'tv']:
            if keyword.lower() in text_lower:
                result = query_product_database.invoke({"query_type": "search", "search_term": keyword})
                state["information"] = result
                state["tool_outputs"].append(f"product_search[{keyword}]: {result[:200]}")
                state["route_taken"].append(f"product -> search[{keyword}]")
                return state
    
    # LLM-based approach for complex queries
    prompt = f"""คุณเป็น Product Specialist ที่ช่วยค้นหาข้อมูลสินค้า

คำถาม: "{user_input}"

เครื่องมือที่มี:
- query_product_database: ค้นหาสินค้าด้วย SKU, ชื่อสินค้า, เจ้าของ
- query_google_sheets: ดูข้อมูลเพิ่มเติมจาก Google Sheets
- get_current_time: ดูเวลาปัจจุบัน

ตอบสั้นๆ 2-3 ประโยค"""

    try:
        # Bind tools to LLM
        llm_with_tools = llm.bind_tools(tools)
        messages = [SystemMessage(content="คุณเป็น Product Specialist ที่ช่วยหาข้อมูลสินค้าอย่างรวดเร็ว"),
                   HumanMessage(content=prompt)]
        
        response = llm_with_tools.invoke(messages)
        
        # Extract information
        info = response.content if hasattr(response, 'content') else str(response)
        state["information"] = info
        state["tool_outputs"].append(f"product_llm: {info[:200]}")
        state["route_taken"].append("product -> llm")
        
    except Exception as e:
        logger.error(f"Product node error: {e}")
        state["information"] = "ขออภัย ไม่สามารถค้นหาข้อมูลสินค้าได้ในขณะนี้"
        state["route_taken"].append("product -> error")
    
    return state


def knowledge_node(state: AgentState, llm, tools) -> AgentState:
    """Knowledge specialist node - handles policy/procedure queries"""
    user_input = state["user_input"]
    
    # Try RAG search
    try:
        result = search_documents.invoke({"query": user_input, "top_k": 2})
        state["information"] = result[:500]  # Limit length
        state["tool_outputs"].append(f"rag_search: {result[:200]}")
        state["route_taken"].append("knowledge -> rag")
    except Exception as e:
        logger.error(f"Knowledge node RAG error: {e}")
        # Fallback to LLM
        prompt = f"""คุณเป็น Knowledge Specialist ที่ให้ข้อมูลเกี่ยวกับนโยบายและขั้นตอน

คำถาม: "{user_input}"

ตอบสั้นๆ 2-3 ประโยค เกี่ยวกับนโยบายการคืนสินค้าและการรับประกัน"""

        try:
            messages = [SystemMessage(content="คุณเป็น Knowledge Specialist"),
                       HumanMessage(content=prompt)]
            response = llm.invoke(messages)
            info = response.content if hasattr(response, 'content') else str(response)
            state["information"] = info
            state["tool_outputs"].append(f"knowledge_llm: {info[:200]}")
            state["route_taken"].append("knowledge -> llm_fallback")
        except Exception as e2:
            logger.error(f"Knowledge node LLM error: {e2}")
            state["information"] = "ขออภัย ไม่สามารถค้นหาข้อมูลได้ในขณะนี้"
            state["route_taken"].append("knowledge -> error")
    
    return state


def general_node(state: AgentState, llm) -> AgentState:
    """General conversation node - handles greetings and simple queries"""
    user_input = state["user_input"]
    text_lower = user_input.lower()
    
    # Fast responses for common greetings
    if any(greet in text_lower for greet in ['สวัสดี', 'ดีครับ', 'ดีค่ะ', 'hello', 'hi']):
        state["information"] = "สวัสดีครับ ยินดีต้อนรับสู่ศูนย์บริการลูกค้า มีอะไรให้ช่วยไหมครับ"
        state["route_taken"].append("general -> greeting")
        return state
    
    if any(thx in text_lower for thx in ['ขอบคุณ', 'thank', 'ขอบใจ']):
        state["information"] = "ยินดีครับ หากมีคำถามเพิ่มเติม สามารถสอบถามได้ตลอดเวลาครับ"
        state["route_taken"].append("general -> thanks")
        return state
    
    # Get time if asked
    if any(time_word in text_lower for time_word in ['เวลา', 'กี่โมง', 'time', 'วันที่']):
        time_info = get_current_time.invoke({})
        state["information"] = time_info
        state["tool_outputs"].append(f"time: {time_info}")
        state["route_taken"].append("general -> time")
        return state
    
    # Generic LLM response
    prompt = f"""คุณเป็นพนักงานต้อนรับที่เป็นมิตร

ลูกค้าพูดว่า: "{user_input}"

ตอบสั้นๆ 1-2 ประโยค อย่างสุภาพและเป็นกันเอง"""

    try:
        messages = [SystemMessage(content="คุณเป็นพนักงานต้อนรับที่เป็นมิตร"),
                   HumanMessage(content=prompt)]
        response = llm.invoke(messages)
        info = response.content if hasattr(response, 'content') else str(response)
        state["information"] = info
        state["route_taken"].append("general -> llm")
    except Exception as e:
        logger.error(f"General node error: {e}")
        state["information"] = "สวัสดีครับ มีอะไรให้ช่วยไหมครับ"
        state["route_taken"].append("general -> error")
    
    return state


def response_node(state: AgentState, llm) -> AgentState:
    """Response composer node - creates final customer-facing response"""
    information = state.get("information", "")
    user_input = state["user_input"]
    intent = state.get("intent", "GENERAL")
    
    # If information is already conversational and short, use it directly
    if information and len(information) < 300 and not any(x in information for x in ['Mock:', 'Error:', 'ไม่พบ']):
        state["response"] = information
        state["route_taken"].append("response -> direct")
        return state
    
    # Compose polite response
    prompt = f"""คุณเป็น Customer Response Specialist ที่จัดทำคำตอบสำหรับลูกค้า

คำถามลูกค้า: "{user_input}"

ข้อมูลที่ได้: {information}

จัดทำคำตอบที่:
- สุภาพและเป็นกันเอง
- กระชับ 2-3 ประโยค
- เหมาะสมกับการสนทนาด้วยเสียง
- ตอบตรงประเด็น

ตอบเป็นภาษาไทยเท่านั้น"""

    try:
        messages = [SystemMessage(content="คุณเป็น Customer Response Specialist ที่เชี่ยวชาญในการสื่อสารกับลูกค้า"),
                   HumanMessage(content=prompt)]
        response = llm.invoke(messages)
        final_response = response.content if hasattr(response, 'content') else str(response)
        
        # Clean up response
        final_response = final_response.strip()
        if final_response.startswith('"') and final_response.endswith('"'):
            final_response = final_response[1:-1]
        
        state["response"] = final_response
        state["route_taken"].append("response -> composed")
        
    except Exception as e:
        logger.error(f"Response node error: {e}")
        # Fallback to information directly
        state["response"] = information if information else "ขออภัยครับ ไม่สามารถประมวลผลคำขอได้ในขณะนี้"
        state["route_taken"].append("response -> fallback")
    
    return state


# =============================================================================
# ROUTING LOGIC
# =============================================================================

def route_after_supervisor(state: AgentState) -> str:
    """Route to appropriate specialist based on intent"""
    intent = state.get("intent", "GENERAL")
    
    if intent == "PRODUCT":
        return "product"
    elif intent == "KNOWLEDGE":
        return "knowledge"
    else:
        return "general"


# =============================================================================
# MAIN SYSTEM CLASS
# =============================================================================

class VoiceCallCenterMultiAgent:
    """
    Fast hierarchical multi-agent system for voice call center using LangGraph.
    
    Architecture:
    - Supervisor Node: Routes requests to specialized nodes
    - Product Node: Handles product queries via database/sheets
    - Knowledge Node: Handles policy/procedure queries via RAG
    - General Node: Handles greetings and simple queries
    - Response Node: Composes final customer responses
    
    Usage:
        system = VoiceCallCenterMultiAgent()
        result = system.process_voice_input("สวัสดีครับ ขอสอบถามแพ็กเกจอินเทอร์เน็ต")
        print(result["response"])
    """
    
    def __init__(self, config: Optional[VoiceCallCenterConfig] = None):
        _late_env_hydrate()
        
        self.config = (config or VoiceCallCenterConfig()).resolve()
        
        # Initialize LLM based on configuration
        if self.config.base_url and "localhost" in self.config.base_url:
            # Ollama
            self.llm = ChatOllama(
                model=self.config.model,
                base_url=self.config.base_url,
                temperature=self.config.temperature,
            )
        else:
            # OpenAI-compatible API
            self.llm = ChatOpenAI(
                model=self.config.model,
                api_key=self.config.api_key,
                base_url=self.config.base_url,
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                timeout=self.config.request_timeout,
            )
        
        # Initialize tools
        self.tools = ALL_TOOLS
        
        # Caches
        self._product_cache: Dict[str, str] = {}
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)
        
        # Build graph
        self.graph = self._build_graph()
        
        logger.info(f"VoiceCallCenter (LangGraph) initialized | model={self.config.model}")
    
    def _build_graph(self) -> Any:
        """Build the LangGraph state graph"""
        # Create graph
        workflow = StateGraph(AgentState)
        
        # Add nodes with bound parameters
        workflow.add_node("supervisor", lambda state: supervisor_node(state, self.llm))
        workflow.add_node("product", lambda state: product_node(state, self.llm, self.tools))
        workflow.add_node("knowledge", lambda state: knowledge_node(state, self.llm, self.tools))
        workflow.add_node("general", lambda state: general_node(state, self.llm))
        workflow.add_node("response", lambda state: response_node(state, self.llm))
        
        # Set entry point
        workflow.set_entry_point("supervisor")
        
        # Add conditional routing from supervisor
        workflow.add_conditional_edges(
            "supervisor",
            route_after_supervisor,
            {
                "product": "product",
                "knowledge": "knowledge",
                "general": "general"
            }
        )
        
        # All specialist nodes go to response
        workflow.add_edge("product", "response")
        workflow.add_edge("knowledge", "response")
        workflow.add_edge("general", "response")
        
        # Response is the end
        workflow.add_edge("response", END)
        
        # Compile graph
        return workflow.compile()
    
    def _fast_path(self, text: str) -> Optional[Dict[str, Any]]:
        """Ultra-fast path for simple queries without running full graph"""
        start = time.time()
        text_lower = text.lower()
        
        # Greetings
        if any(g in text_lower for g in ['สวัสดี', 'hello', 'hi', 'ดีครับ', 'ดีค่ะ']):
            return {
                "response": "สวัสดีครับ ยินดีต้อนรับสู่ศูนย์บริการลูกค้า มีอะไรให้ช่วยไหมครับ",
                "model": self.config.model,
                "processing_time_seconds": time.time() - start,
                "route": "fast_path_greeting"
            }
        
        # Thanks
        if any(t in text_lower for t in ['ขอบคุณ', 'thank', 'ขอบใจ']):
            return {
                "response": "ยินดีครับ มีอะไรให้ช่วยเพิ่มเติมไหมครับ",
                "model": self.config.model,
                "processing_time_seconds": time.time() - start,
                "route": "fast_path_thanks"
            }
        
        # Direct SKU lookup
        sku_match = re.search(r'(tel|int|tv)\d{3}', text_lower, re.IGNORECASE)
        if sku_match:
            sku = sku_match.group().upper()
            result = query_product_database.invoke({"query_type": "get_by_sku", "sku": sku})
            if "ไม่พบ" not in result:
                return {
                    "response": f"พบข้อมูลสินค้า: {result}",
                    "model": self.config.model,
                    "processing_time_seconds": time.time() - start,
                    "route": f"fast_path_sku_{sku}"
                }
        
        return None
    
    def process_voice_input(self, text: str, conversation_history: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """
        Process voice input through the LangGraph multi-agent system.
        
        Args:
            text: User input from speech-to-text
            conversation_history: Previous conversation context
            
        Returns:
            Dict with response, model used, and processing time
        """
        start_time = time.time()
        
        # Try fast path first
        if self.config.speed_mode:
            fast_result = self._fast_path(text)
            if fast_result:
                logger.info(f"Fast path used: {fast_result['route']}")
                return fast_result
        
        # Initialize state
        initial_state: AgentState = {
            "user_input": text,
            "conversation_history": conversation_history,
            "intent": None,
            "intent_reason": None,
            "information": None,
            "tool_outputs": [],
            "response": "",
            "processing_start": start_time,
            "model_used": self.config.model,
            "route_taken": []
        }
        
        try:
            # Run graph
            final_state = self.graph.invoke(initial_state)
            
            processing_time = time.time() - start_time
            
            return {
                "response": final_state.get("response", "ขออภัยครับ ไม่สามารถประมวลผลได้"),
                "model": self.config.model,
                "processing_time_seconds": processing_time,
                "intent": final_state.get("intent"),
                "route": " -> ".join(final_state.get("route_taken", [])),
                "metadata": {
                    "intent_reason": final_state.get("intent_reason"),
                    "tool_outputs": final_state.get("tool_outputs", [])
                }
            }
            
        except Exception as e:
            logger.error(f"Graph execution error: {e}")
            processing_time = time.time() - start_time
            
            return {
                "response": "ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง",
                "model": self.config.model,
                "processing_time_seconds": processing_time,
                "error": str(e)
            }
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get system status for health checks"""
        return {
            "engine": "langgraph",
            "model": self.config.model,
            "base_url": self.config.base_url,
            "tools": {
                "time": True,
                "product_database": True,
                "google_sheets": SHEETS_AVAILABLE,
                "rag_pdf": RAG_AVAILABLE
            },
            "mock_products_count": len(MOCK_PRODUCTS),
            "ready": True,
            "architecture": "supervisor -> specialists -> response (LangGraph)"
        }


# =============================================================================
# USAGE EXAMPLE
# =============================================================================

if __name__ == "__main__":
    # Example usage
    print("Initializing LangGraph Voice Call Center...")
    system = VoiceCallCenterMultiAgent()
    
    # Test queries
    test_queries = [
        "สวัสดีครับ ขอสอบถามแพ็กเกจอินเทอร์เน็ตหน่อย",
        "มีสินค้ารหัส TEL001 อะไรบ้างครับ",
        "นโยบายการคืนสินค้าเป็นยังไงบ้างครับ",
        "ขอดูข้อมูลของนายสมชาย ใจดี หน่อยครับ"
    ]
    
    for query in test_queries:
        print(f"\n{'='*50}")
        print(f"ลูกค้า: {query}")
        result = system.process_voice_input(query)
        print(f"ระบบ: {result['response']}")
        print(f"Route: {result.get('route', 'N/A')}")
        print(f"เวลาประมวลผล: {result.get('processing_time_seconds', 0):.2f} วินาที")
    
    # System status
    print(f"\n{'='*50}")
    print("สถานะระบบ:")
    status = system.get_system_status()
    for key, value in status.items():
        print(f"  {key}: {value}")
