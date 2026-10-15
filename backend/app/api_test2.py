import os
import tempfile
import hashlib
import json
import gzip
from typing import List, Optional
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, Form, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, PlainTextResponse

import warnings
warnings.filterwarnings("ignore")

# disable telemetry/annoying logs for chroma/langchain
os.environ["ANONYMIZED_TELEMETRY"] = "false"
os.environ["LANGCHAIN_CHROMA_TELEMETRY"] = "false"
os.environ["LANGCHAIN_TRACING"] = "false"
os.environ["LANGCHAIN_ENDPOINT"] = ""

import google.generativeai as genai

from langchain_google_genai import (
    GoogleGenerativeAIEmbeddings,
    ChatGoogleGenerativeAI
)

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma

# -----------------------
# App + Globals
# -----------------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
CHROMA_DIR = BASE_DIR / "chroma_stores"
METADATA_PATH = CHROMA_DIR / "metadata.json"
MEMORY_PATH = BASE_DIR / "memory.json"  # semantic memory store
RESPONSE_CACHE = {}  # in-memory cache: key -> text

# Ensure dirs exist
CHROMA_DIR.mkdir(exist_ok=True)
if not METADATA_PATH.exists():
    METADATA_PATH.write_text(json.dumps({}))

if not MEMORY_PATH.exists():
    MEMORY_PATH.write_text(json.dumps({}))


# -----------------------
# Utils
# -----------------------
def force_api_key(api_key: str):
    """Force Gemini API key usage and remove ADC env vars."""
    os.environ["GOOGLE_API_KEY"] = api_key
    for v in ("GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"):
        os.environ.pop(v, None)
    genai.configure(api_key=api_key)


def hash_text(text: str):
    return hashlib.md5(text.encode()).hexdigest()


def sanitize_collection_name(filename: str) -> str:
    name = os.path.splitext(filename)[0]
    name = ''.join(c if c.isalnum() or c in "_-" else "_" for c in name)
    name = name[:63]
    if len(name) < 3:
        name += "_pdf"
    return name.lower()


def get_vectorstore_path(pdf: str) -> str:
    return str(CHROMA_DIR / sanitize_collection_name(pdf))


def get_pdf_metadata(path=METADATA_PATH):
    try:
        return json.loads(Path(path).read_text())
    except Exception:
        return {}


def save_pdf_metadata(pdf, col, pages, path=METADATA_PATH):
    data = get_pdf_metadata(path)
    data[pdf] = {"collection_name": col, "page_count": pages, "path": get_vectorstore_path(pdf)}
    Path(path).write_text(json.dumps(data, indent=2))


def delete_pdf_metadata(pdf, path=METADATA_PATH):
    data = get_pdf_metadata(path)
    if pdf in data:
        del data[pdf]
        Path(path).write_text(json.dumps(data, indent=2))


def clean_answer(text: str) -> str:
    if not text:
        return ""
    text = text.replace("•", "-")
    text = text.replace("\r\n", "\n")
    # Trim repeating spaces
    return text.strip()


# -----------------------
# PDF text sanitization (remove polluted fallback strings)
# -----------------------
POLLUTED_PHRASES = [
    "The provided PDF does not contain relevant information for this question, so I am using general knowledge.",
    "The provided PDF does not contain relevant information",
    "I am using general knowledge"
]

def sanitize_page_text(text: str) -> str:
    """Remove known polluted sentences and normalize whitespace."""
    if not text:
        return ""
    for p in POLLUTED_PHRASES:
        text = text.replace(p, "")
    # remove repetitive blank lines
    lines = [ln.rstrip() for ln in text.splitlines()]
    # remove lines that are empty or like "No relevant information found"
    filtered = []
    for ln in lines:
        ln_strip = ln.strip()
        if not ln_strip:
            continue
        # remove obvious fallback-like lines
        if "no relevant information" in ln_strip.lower():
            continue
        filtered.append(ln_strip)
    return "\n".join(filtered).strip()


# -----------------------
# Semantic memory (simple JSON store)
# -----------------------
def load_memory():
    try:
        return json.loads(MEMORY_PATH.read_text())
    except Exception:
        return {}


def save_memory_store(store):
    MEMORY_PATH.write_text(json.dumps(store, indent=2))


def add_memory_entry(session_id: str, role: str, text: str):
    store = load_memory()
    if session_id not in store:
        store[session_id] = []
    # keep only last 50 entries max
    store[session_id].append({"role": role, "text": text, "ts": datetime.utcnow().isoformat()})
    store[session_id] = store[session_id][-50:]
    save_memory_store(store)


def get_memory_for_prompt(session_id: str, limit: int = 6) -> str:
    store = load_memory()
    if session_id not in store:
        return ""
    last = store[session_id][-limit:]
    # format as small conversation snippet
    parts = []
    for m in last:
        role = m.get("role", "user")
        text = m.get("text", "")
        parts.append(f"{role.capitalize()}: {text}")
    return "\n".join(parts)


# -----------------------
# Relevance detection (stronger heuristics)
# -----------------------
def filter_relevant(docs):
    """Return up to 8 documents that look meaningful."""
    good = []
    for d in docs:
        txt = sanitize_page_text(d.page_content)
        if not any(c.isalpha() for c in txt):
            continue
        # minimum characters
        if len(txt) < 80:
            continue
        # need multiple words and punctuation (heuristic for sentences)
        if len(txt.split()) < 8:
            continue
        # avoid repetitive short lines (headers)
        if txt.count("\n") > 20 and len(txt) < 500:
            # still allow long pages
            pass
        good.append((d, txt))
        if len(good) >= 8:
            break
    # return documents with sanitized content for prompt building
    return [{"doc": pair[0], "text": pair[1]} for pair in good]


# -----------------------
# Auto-detect PDF mention in the user's question
# -----------------------
PDF_KEYWORDS = ["pdf", "document", "page", "page:", "in the document", "in the pdf", "in the file", "see page", "refer to", "as per", "on page"]

def user_mentions_pdf(question: str, pdf_name: Optional[str]) -> bool:
    q = question.lower()
    if pdf_name and pdf_name.lower() in q:
        return True
    for kw in PDF_KEYWORDS:
        if kw in q:
            return True
    return False


# -----------------------
# Prompt builder with memory + rich formatting instructions
# -----------------------
def build_prompt(context: str, question: str, session_id: Optional[str], prefer_pdf: bool):
    # include small memory block if available
    memory_block = ""
    if session_id:
        mem = get_memory_for_prompt(session_id)
        if mem:
            memory_block = f"\n\nConversation Memory:\n{mem}\n\n"

    # indicate whether we should prefer PDF (useful when user explicitly refers to PDF)
    prefer_note = "Prefer using the PDF context when available." if prefer_pdf else ""

    prompt = f"""
Forget previous ephemeral instructions for this single request.

You are a helpful assistant. Provide the answer in clean Markdown. Use headings, bullet points, numbered lists and code blocks when appropriate. Keep answers concise and well-structured. Do not include internal chain-of-thought.

{prefer_note}

{memory_block}
PDF Context (may be empty):
{context}

User Question:
{question}

Guidelines:
- If PDF context contains relevant information, answer using it and cite filename & page where helpful (short inline citation like: (File.pdf, p.4)).
- If PDF context is empty or irrelevant, answer normally without mentioning "missing context" or "general knowledge" or any fallback sentence.
- Do not output the phrase: "The provided PDF does not contain relevant information for this question, so I am using general knowledge."
- Fix grammar and spelling silently.
- Prefer clear, short bullet points when listing steps or items.
- If the user asked for definitions or explanations, provide a short definition and a short example.
"""
    return prompt


# -----------------------
# PDF upload + indexing (with sanitization)
# -----------------------
@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...), api_key: str = Form(...)):
    """
    Upload a single PDF, split into chunks, sanitize text, and store in Chroma.
    """
    force_api_key(api_key)

    meta = get_pdf_metadata()
    if file.filename in meta:
        return {"error": "PDF already exists"}

    # save temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    # load pages and sanitize text
    loader = PyPDFLoader(tmp_path)
    pages = loader.load()
    for p in pages:
        p.metadata["source_file"] = file.filename
        # sanitize raw page content in place
        p.page_content = sanitize_page_text(p.page_content)

    # remove temp
    try:
        os.remove(tmp_path)
    except:
        pass

    # split and dedupe
    splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=200)
    chunks = splitter.split_documents(pages)

    # filter out empty chunks
    chunks = [c for c in chunks if c.page_content and len(c.page_content.strip()) > 30]

    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",
        task_type="retrieval_document",
        api_key=api_key
    )

    # dedupe by hash
    ids = [hash_text(c.page_content) for c in chunks]
    seen = set()
    uniq_docs, uniq_ids = [], []
    for c, i in zip(chunks, ids):
        if i not in seen:
            seen.add(i)
            uniq_docs.append(c)
            uniq_ids.append(i)

    col = sanitize_collection_name(file.filename)
    persist_dir = get_vectorstore_path(file.filename)

    Chroma.from_documents(
        documents=uniq_docs,
        embedding=embeddings,
        ids=uniq_ids,
        collection_name=col,
        persist_directory=persist_dir
    )

    save_pdf_metadata(file.filename, col, len(pages))
    return {"message": "Indexed", "filename": file.filename, "pages": len(pages), "chunks": len(uniq_docs)}


# -----------------------
# List / delete PDFs
# -----------------------
@app.get("/list-pdfs")
async def list_pdfs():
    meta = get_pdf_metadata()
    pdfs = [{"filename": k, "collection_name": v["collection_name"], "page_count": v["page_count"]} for k, v in meta.items()]
    return {"pdfs": pdfs, "count": len(pdfs)}


@app.delete("/delete-pdf/{pdf_name}")
async def delete_pdf(pdf_name: str):
    import shutil
    meta = get_pdf_metadata()
    if pdf_name not in meta:
        return {"error": "Not found"}
    path = meta[pdf_name]["path"]
    if os.path.exists(path):
        shutil.rmtree(path)
    delete_pdf_metadata(pdf_name)
    return {"message": "Deleted"}


# -----------------------
# Helper: build context from retriever results
# -----------------------
def build_context_from_docs(useful, max_chars: int = 4000) -> str:
    parts = []
    total = 0
    for item in useful:
        d = item["doc"]
        text = item["text"]
        src = d.metadata.get("source_file", "Unknown")
        page = d.metadata.get("page", "?")
        excerpt = text.strip()
        if not excerpt:
            continue
        # cut to max_chars budget
        remain = max_chars - total
        if remain <= 0:
            break
        if len(excerpt) > remain:
            excerpt = excerpt[:remain].rsplit("\n", 1)[0] + "…"
        parts.append(f"### {src}, p.{page}\n\n{excerpt}")
        total += len(excerpt)
    return "\n\n---\n\n".join(parts)


# -----------------------
# ASK (non-stream) endpoint — with compression + memory + auto-detect
# -----------------------
@app.post("/ask")
async def ask(request: Request,
              question: str = Form(...),
              api_key: str = Form(...),
              pdf_name: Optional[str] = Form(None),
              session_id: Optional[str] = Form(None),
              enable_memory: Optional[str] = Form(None)):
    """
    Ask a question (non-stream). Returns gzipped text body and header Content-Encoding: gzip.
    enable_memory: "1" to force including memory even if session_id not provided.
    """
    force_api_key(api_key)
    prefer_pdf = user_mentions_pdf(question, pdf_name)
    # session logic: if enable_memory or pdf_name -> derive session_id
    if not session_id:
        if enable_memory == "1":
            session_id = "session_auto"
        elif pdf_name:
            session_id = f"session_pdf_{pdf_name}"
    # cache key
    cache_key = f"{session_id}::{pdf_name}::{question.strip().lower()}"
    if cache_key in RESPONSE_CACHE:
        # return gzipped cached bytes
        cached_text = RESPONSE_CACHE[cache_key]
        gz = gzip.compress(cached_text.encode("utf-8"))
        headers = {"Content-Encoding": "gzip", "Content-Type": "text/plain; charset=utf-8"}
        return Response(content=gz, headers=headers, media_type="text/plain")

    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",
        task_type="retrieval_query",
        api_key=api_key
    )

    meta = get_pdf_metadata()
    selected = {pdf_name: meta[pdf_name]} if pdf_name and meta.get(pdf_name) else meta

    # retrieve docs from all selected pdfs
    docs = []
    for name, v in selected.items():
        try:
            vs = Chroma(collection_name=v["collection_name"], persist_directory=v["path"], embedding_function=embeddings)
            # use similarity_search (works with current langchain-chroma binding in your setup)
            docs.extend(vs.similarity_search(question, k=4))
        except Exception:
            continue

    useful_raw = filter_relevant(docs)
    # if user explicitly mentions PDF, prefer PDF even if useful_raw empty
    if prefer_pdf and not useful_raw and selected:
        # fallback: take top k from retriever even if not passing strong filters
        try:
            for name, v in selected.items():
                vs = Chroma(collection_name=v["collection_name"], persist_directory=v["path"], embedding_function=embeddings)
                docs2 = vs.similarity_search(question, k=6)
                for d in docs2:
                    txt = sanitize_page_text(d.page_content)
                    useful_raw.append({"doc": d, "text": txt})
            # keep unique
            seen_texts = set()
            uniq = []
            for it in useful_raw:
                t = it["text"]
                if t and t not in seen_texts:
                    seen_texts.add(t)
                    uniq.append(it)
            useful_raw = uniq[:8]
        except Exception:
            useful_raw = useful_raw

    context = ""
    if useful_raw:
        context = build_context_from_docs(useful_raw)

    prompt = build_prompt(context, question, session_id, prefer_pdf)

    # include memory in saved store: save user question
    if session_id:
        add_memory_entry(session_id, "user", question)

    llm = ChatGoogleGenerativeAI(model="models/gemini-2.0-flash", temperature=0, api_key=api_key)

    try:
        ans = llm.invoke(prompt)
        text = clean_answer(ans.content if hasattr(ans, "content") else str(ans))
    except Exception as e:
        text = f"Error: {e}"

    # save assistant reply to memory if session enabled
    if session_id:
        add_memory_entry(session_id, "assistant", text)

    RESPONSE_CACHE[cache_key] = text

    gz = gzip.compress(text.encode("utf-8"))
    headers = {"Content-Encoding": "gzip", "Content-Type": "text/plain; charset=utf-8"}
    return Response(content=gz, headers=headers, media_type="text/plain")


# -----------------------
# ASK-STREAM endpoint — streaming output, auto-detect, memory optionally
# -----------------------
@app.post("/ask-stream")
async def ask_stream(question: str = Form(...),
                     api_key: str = Form(...),
                     pdf_name: Optional[str] = Form(None),
                     session_id: Optional[str] = Form(None),
                     enable_memory: Optional[str] = Form(None)):
    """
    Streaming endpoint. Does not compress streaming output.
    """
    force_api_key(api_key)
    prefer_pdf = user_mentions_pdf(question, pdf_name)

    # session logic
    if not session_id:
        if enable_memory == "1":
            session_id = "session_auto"
        elif pdf_name:
            session_id = f"session_pdf_{pdf_name}"

    cache_key = f"{session_id}::{pdf_name}::{question.strip().lower()}"
    if cache_key in RESPONSE_CACHE:
        async def cached():
            yield RESPONSE_CACHE[cache_key]
        return StreamingResponse(cached(), media_type="text/plain")

    embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004", task_type="retrieval_query", api_key=api_key)
    meta = get_pdf_metadata()
    selected = {pdf_name: meta[pdf_name]} if pdf_name and meta.get(pdf_name) else meta

    docs = []
    for name, v in selected.items():
        try:
            vs = Chroma(collection_name=v["collection_name"], persist_directory=v["path"], embedding_function=embeddings)
            docs.extend(vs.similarity_search(question, k=4))
        except Exception:
            continue

    useful_raw = filter_relevant(docs)
    if prefer_pdf and not useful_raw and selected:
        try:
            for name, v in selected.items():
                vs = Chroma(collection_name=v["collection_name"], persist_directory=v["path"], embedding_function=embeddings)
                docs2 = vs.similarity_search(question, k=6)
                for d in docs2:
                    txt = sanitize_page_text(d.page_content)
                    useful_raw.append({"doc": d, "text": txt})
            seen_texts = set()
            uniq = []
            for it in useful_raw:
                t = it["text"]
                if t and t not in seen_texts:
                    seen_texts.add(t)
                    uniq.append(it)
            useful_raw = uniq[:8]
        except Exception:
            pass

    context = ""
    if useful_raw:
        context = build_context_from_docs(useful_raw)

    prompt = build_prompt(context, question, session_id, prefer_pdf)

    if session_id:
        add_memory_entry(session_id, "user", question)

    llm = ChatGoogleGenerativeAI(model="models/gemini-2.0-flash", temperature=0, streaming=True, api_key=api_key)

    async def generate():
        full = ""
        try:
            async for chunk in llm.astream(prompt):
                if hasattr(chunk, "content") and chunk.content:
                    # sanitize streaming chunk, avoid duplicate small fragments
                    piece = chunk.content.replace("•", "-")
                    # basic dedupe: skip if piece is whitespace or already a substring right at the end
                    if not piece.strip():
                        continue
                    if full.endswith(piece):
                        continue
                    full += piece
                    yield piece
            # store to cache and memory
            RESPONSE_CACHE[cache_key] = full
            if session_id:
                add_memory_entry(session_id, "assistant", full)
        except Exception as e:
            yield f"\n\nError: {e}"

    return StreamingResponse(generate(), media_type="text/plain")


# -----------------------
# Utility endpoints: clear caches / reset vectorstore / memory
# -----------------------
@app.post("/admin/clear-cache")
async def clear_cache():
    RESPONSE_CACHE.clear()
    return {"ok": True}


@app.post("/admin/reset-vectorstore")
async def reset_vectorstore():
    """Completely remove chroma_stores folder (careful)."""
    import shutil
    if CHROMA_DIR.exists():
        shutil.rmtree(CHROMA_DIR)
    CHROMA_DIR.mkdir(exist_ok=True)
    METADATA_PATH.write_text(json.dumps({}))
    return {"ok": True}


@app.post("/admin/clear-memory")
async def clear_memory():
    save_memory_store({})
    return {"ok": True}


# -----------------------
# Run
# -----------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", port=8000, host="0.0.0.0")
