# ⚡ RAGmind — Intelligent RAG Agent

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![LangGraph](https://img.shields.io/badge/LangGraph-FF6B6B?style=flat-square)](https://langchain-ai.github.io/langgraph/)
[![Pinecone](https://img.shields.io/badge/Pinecone-00A67E?style=flat-square)](https://pinecone.io)
[![Tailwind v4](https://img.shields.io/badge/Tailwind_v4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

A full-stack AI chat app with a LangGraph RAG agent, optional web search, JWT auth, multi-session history, and a modern dark-themed React frontend.

---

## 🏗 How It Works

```
User Query → Router (LLM) → RAG Lookup → Judge (sufficient?)
                                              ├── Yes → Answer
                                              └── No  → Web Search → Answer
```

Every response includes `trace_events` — step-by-step agent decisions visible in the UI via the **Trace Panel**.

---

## 🛠 Stack

| Side | Tech |
|---|---|
| Backend | FastAPI, LangGraph, Groq (`llama-3.3-70b`), Pinecone, Tavily, SQLite, PyJWT |
| Frontend | React 19, Vite 6, Tailwind v4, Redux Toolkit, React Router v7, React Hook Form |

---

## 🚀 Setup

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
PINECONE_API_KEY=your_key
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=langgraph-rag-index
GROQ_API_KEY=your_key
TAVILY_API_KEY=your_key
JWT_SECRET_KEY=your_random_32char_secret
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # runs on http://localhost:5173
```

> Vite proxies `/api/*` → `http://localhost:8000` automatically.

---

## 📡 Key API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/auth/signup` | Register | ❌ |
| `POST` | `/auth/login` | Login → JWT | ❌ |
| `GET` | `/auth/me` | Current user | ✅ |
| `GET` | `/history/sessions` | All chat sessions | ✅ |
| `GET` | `/history/sessions/{id}/messages` | Session messages | ✅ |
| `DELETE` | `/history/sessions/{id}` | Delete session | ✅ |
| `POST` | `/chat/` | `{session_id, query, enable_web_search}` | Optional |
| `POST` | `/upload-document/` | Upload PDF/DOCX to knowledge base | ✅ |

> Sessions are created **implicitly** on first `/chat/` call — no separate create endpoint.

---

## 📁 Project Structure

```
ragmind/
├── backend/
│   ├── main.py          # FastAPI app + all endpoints
│   ├── agent.py         # LangGraph agent (router, RAG, web, answer nodes)
│   ├── auth.py          # JWT + password hashing
│   ├── database.py      # SQLite (users, sessions, messages)
│   ├── vector_store.py  # Pinecone init + document upload
│   ├── config.py        # Env var loading
│   └── .env             # ← create this
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── auth/ProtectedRoute.jsx
    │   │   ├── chat/         # ChatMessage, ChatInput, TracePanel, TypingIndicator, EmptyState
    │   │   └── layout/       # Sidebar, AppLayout
    │   ├── pages/            # LoginPage, RegisterPage, ChatPage, UploadPage
    │   ├── store/slices/     # authSlice, chatSlice (Redux Toolkit)
    │   └── lib/api.js        # Axios client + JWT interceptor
    ├── vite.config.js
    └── .env.local            # ← create this
```

---

## ⚠️ Notes

- Add `.env` and `.env.local` to `.gitignore` — never commit secrets
- Set a fixed `JWT_SECRET_KEY` in production (random default invalidates tokens on restart)
- CORS is `allow_origins=["*"]` — restrict to your domain in production
- Pinecone index (384-dim, cosine) is auto-created on first backend start

---

