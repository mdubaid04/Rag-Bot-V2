# rag_agent_app/backend/main.py

import os
import uuid
import traceback
from typing import List, Dict, Any, Optional
import tempfile

from fastapi import FastAPI, HTTPException, status, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr

from langchain_core.messages import HumanMessage, AIMessage
from langgraph.checkpoint.memory import MemorySaver
from langchain_community.document_loaders import PyPDFLoader,Docx2txtLoader
from contextlib import asynccontextmanager

from agent import rag_agent
from vector_store import upload_doc

# ── Auth & DB imports ─────────────────────────────────────────
from database import (
    init_db,
    create_user,
    get_user_by_email,
    create_or_update_session,
    update_session_title,
    get_user_sessions,
    delete_session,
    save_message,
    get_session_messages,
)
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_optional_user,
)



SUPPORTED_EXTENSIONS = {".pdf", ".docx"}
EXTENSION_LABELS = {
    ".pdf": "PDF",
    ".docx": "Word Document",
}

# ── App setup ─────────────────────────────────────────────────



memory = MemorySaver()
@asynccontextmanager
async def lifespan(app:FastAPI):
    init_db()
    yield

app = FastAPI(
    title="LangGraph RAG Agent API",
    description="RAG agent with Pinecone, Groq, Auth & Chat History.",
    version="2.0.0",
    lifespan=lifespan
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",          # local dev
        "https://ragminds.vercel.app",  # deployed frontend ka URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




# ═══════════════════════════════════════════════════════════════
# Pydantic Schemas
# ═══════════════════════════════════════════════════════════════

class SignupRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(..., min_length=6)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    email: str

class UserProfile(BaseModel):
    user_id: int
    username: str
    email: str

class ChatSessionOut(BaseModel):
    session_id: str
    title: str
    created_at: str
    updated_at: str

class MessageOut(BaseModel):
    role: str
    content: str
    created_at: str

class TraceEvent(BaseModel):
    step: int
    node_name: str
    description: str
    details: Dict[str, Any] = Field(default_factory=dict)
    event_type: str

class QueryRequest(BaseModel):
    session_id: str
    query: str
    enable_web_search: bool = True

class AgentResponse(BaseModel):
    response: str
    trace_events: List[TraceEvent] = Field(default_factory=list)

class DocumentUploadResponse(BaseModel):
    message: str
    filename: str
    processed_chunks: int

class DeleteSessionResponse(BaseModel):
    message: str

# ═══════════════════════════════════════════════════════════════
# Helper: Document Text Extraction
# ═══════════════════════════════════════════════════════════════

def extract_text_from_file(tmp_path: str, extension: str) -> str:
    """
    Extracts plain text from a file based on its extension.
    Supports: .pdf, .docx, 
    Returns the full extracted text as a single string.
    """
    if extension == ".pdf":
        loader = PyPDFLoader(tmp_path)
        documents = loader.load()
        return "\n\n".join(d.page_content for d in documents) if documents else ""

    elif extension == ".docx":
        loader = Docx2txtLoader(tmp_path)
        documents = loader.load()
        return "\n\n".join(d.page_content for d in documents) if documents else ""

    else:
        raise ValueError(f"Unsupported file type: {extension}")



# ═══════════════════════════════════════════════════════════════
# Health / Root
# ═══════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"status": "hello", "version": "2.0.0"}

@app.get("/health")
def health():
    return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════
# Auth Endpoints
# ═══════════════════════════════════════════════════════════════

@app.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(req: SignupRequest):
    """Register a new user."""
    # Check duplicate email
    if get_user_by_email(req.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists."
        )

    pw_hash = hash_password(req.password)
    try:
        user_id = create_user(req.username, req.email, pw_hash)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username already taken: {e}"
        )

    token = create_access_token(user_id, req.username)
    return AuthResponse(
        access_token=token,
        user_id=user_id,
        username=req.username,
        email=req.email
    )


@app.post("/auth/login", response_model=AuthResponse)
def login(req: LoginRequest):
    """Login with email + password, returns JWT."""
    user = get_user_by_email(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    token = create_access_token(user["id"], user["username"])
    return AuthResponse(
        access_token=token,
        user_id=user["id"],
        username=user["username"],
        email=user["email"]
    )


@app.get("/auth/me", response_model=UserProfile)
def me(current_user: dict = Depends(get_current_user)):
    """Returns the logged-in user's profile."""
    return UserProfile(
        user_id=current_user["id"],
        username=current_user["username"],
        email=current_user["email"]
    )


# ═══════════════════════════════════════════════════════════════
# Chat History Endpoints
# ═══════════════════════════════════════════════════════════════

@app.get("/history/sessions", response_model=List[ChatSessionOut])
def list_sessions(current_user: dict = Depends(get_current_user)):
    """
    Returns all chat sessions of the logged-in user (newest first).
    Empty list if user has no sessions yet.
    """
    sessions = get_user_sessions(current_user["id"])
    return [
        ChatSessionOut(
            session_id=s["session_id"],
            title=s["title"],
            created_at=s["created_at"],
            updated_at=s["updated_at"]
        )
        for s in sessions
    ]


@app.get("/history/sessions/{session_id}/messages", response_model=List[MessageOut])
def get_messages(session_id: str, current_user: dict = Depends(get_current_user)):
    """
    Returns all messages for a specific session.
    Returns 403 if the session doesn't belong to this user.
    """
    # Verify ownership
    user_sessions = get_user_sessions(current_user["id"])
    owned_ids = {s["session_id"] for s in user_sessions}
    if session_id not in owned_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this session."
        )

    messages = get_session_messages(session_id)
    return [
        MessageOut(role=m["role"], content=m["content"], created_at=m["created_at"])
        for m in messages
    ]


@app.delete("/history/sessions/{session_id}", response_model=DeleteSessionResponse)
def delete_chat_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Deletes a session and all its messages."""
    deleted = delete_session(session_id, current_user["id"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or access denied."
        )
    return DeleteSessionResponse(message="Session deleted successfully.")


# ═══════════════════════════════════════════════════════════════
# Document Upload Endpoint
# ═══════════════════════════════════════════════════════════════

@app.post("/upload-document/", response_model=DocumentUploadResponse, status_code=status.HTTP_200_OK)
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)   # only logged-in users can upload
):
    """
    Uploads a document (PDF, DOCX, or PPTX) and indexes it into the RAG knowledge base.

    - **PDF**  → parsed via PyPDFLoader
    - **DOCX** → parsed via Docx2txtLoader
    - **PPTX** → parsed via UnstructuredPowerPointLoader (slide text extracted slide-by-slide)
    """
    # ── Validate file extension ───────────────────────────────
    original_name = file.filename or ""
    _, ext = os.path.splitext(original_name.lower())

    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file type '{ext}'. "
                f"Allowed types: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            )
        )

    file_label = EXTENSION_LABELS[ext]
    print(f"[{current_user['username']}] Uploading {file_label}: {original_name}")

    # ── Save to temp file ─────────────────────────────────────
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        # ── Extract text based on file type ───────────────────
        full_text = extract_text_from_file(tmp_path, ext)

        if not full_text.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"No readable text could be extracted from '{original_name}'. "
                       f"Make sure the file is not empty, scanned-only, or password-protected."
            )

        # ── Chunk & index into Pinecone ───────────────────────
        total_chunks = upload_doc(full_text)

        return DocumentUploadResponse(
            message=f"{file_label} '{original_name}' uploaded and indexed successfully.",
            filename=original_name,
            file_type=file_label,
            processed_chunks=total_chunks
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing {file_label}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process {file_label} '{original_name}': {e}"
        )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# ═══════════════════════════════════════════════════════════════
# Chat Endpoint
# ═══════════════════════════════════════════════════════════════

@app.post("/chat/", response_model=AgentResponse)
async def chat_with_agent(
    request: QueryRequest,
    current_user: Optional[dict] = Depends(get_optional_user)
    # Optional: unauthenticated users can still chat, but history won't be saved
):
    trace_events: List[TraceEvent] = []

    try:
        config = {
            "configurable": {
                "thread_id": request.session_id,
                "web_search_enabled": request.enable_web_search
            }
        }
        inputs = {"messages": [HumanMessage(content=request.query)]}
        final_message = " "

        print(f"Session: {request.session_id} | Web search: {request.enable_web_search}")

        s = {}
        for i, s in enumerate(rag_agent.stream(inputs, config=config)):
            if "__end__" in s:
                current_node = "__end__"
                node_state = s["__end__"]
            else:
                current_node = list(s.keys())[0]
                node_state = s[current_node]

            event_description = f"Execution Node: {current_node}"
            event_details: Dict[str, Any] = {}
            event_type = "generic_node_execution"

            if current_node == "router":
                route_decision = node_state.get("route")
                initial_decision = node_state.get("initial_router_decision", route_decision)
                override_reason = node_state.get("router_override_reason")
                if override_reason:
                    event_description = (
                        f"Router initially decided: '{initial_decision}'. "
                        f"Overridden to: '{route_decision}' because {override_reason}."
                    )
                    event_details = {
                        "initial_decision": initial_decision,
                        "final_decision": route_decision,
                        "override_reason": override_reason
                    }
                else:
                    event_description = f"Router decided: '{route_decision}'"
                    event_details = {"decision": route_decision}
                event_type = "router_decision"

            elif current_node == "rag_lookup":
                rag_summary = node_state.get("rag", "")[:200] + "..."
                sufficient = node_state.get("route") == "answer"
                event_description = (
                    "RAG Lookup: content sufficient. Proceeding to answer."
                    if sufficient else
                    "RAG Lookup: content NOT sufficient. Diverting to web search."
                )
                event_details = {
                    "retrieved_content_summary": rag_summary,
                    "sufficiency_verdict": "Sufficient" if sufficient else "Not Sufficient"
                }
                event_type = "rag_action"

            elif current_node == "web_search":
                web_summary = node_state.get("web", "")[:200] + "..."
                event_description = "Web Search performed. Proceeding to answer."
                event_details = {"retrieved_content_summary": web_summary}
                event_type = "web_action"

            elif current_node == "answer":
                event_description = "Generating final answer using gathered context."
                event_type = "answer_generation"

            elif current_node == "__end__":
                event_description = "Agent process completed."
                event_type = "process_end"

            trace_events.append(
                TraceEvent(
                    step=i + 1,
                    node_name=current_node,
                    description=event_description,
                    details=event_details,
                    event_type=event_type
                )
            )
            print(f"Step {i+1} | Node: {current_node} | {event_description}")

        # Extract final AI message
        final_state = None
        if s:
            final_state = s.get("__end__") or s.get(list(s.keys())[0])

        if final_state and "messages" in final_state:
            for msg in reversed(final_state["messages"]):
                if isinstance(msg, AIMessage):
                    final_message = msg.content
                    break

        if not final_message.strip():
            raise HTTPException(
                status_code=500,
                detail="Agent did not return a valid response."
            )

        # ── Save to history if user is logged in ──────────────────
        if current_user:
            user_id = current_user["id"]

            # Create/update the session record
            # Use first 60 chars of first user message as the session title
            session_title = request.query[:60] + ("..." if len(request.query) > 60 else "")
            create_or_update_session(user_id, request.session_id, title=session_title)

            # Save user message
            save_message(request.session_id, "user", request.query)

            # Save assistant message
            save_message(request.session_id, "assistant", final_message)

            print(f"History saved for user '{current_user['username']}', session '{request.session_id}'")
        else:
            print("No user logged in — history not saved.")

        return AgentResponse(response=final_message, trace_events=trace_events)

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

