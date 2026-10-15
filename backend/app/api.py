import os
import tempfile
import hashlib
import json
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse


import google.generativeai as genai


from langchain_google_genai import (
    GoogleGenerativeAIEmbeddings,
    ChatGoogleGenerativeAI
)

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document



app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


def force_api_key(api_key: str):
    """Ensure Gemini uses only API key (no ADC)."""

    os.environ["GOOGLE_API_KEY"] = api_key

    for bad in [
        "GOOGLE_APPLICATION_CREDENTIALS",
        "GOOGLE_CLOUD_PROJECT",
        "GCLOUD_PROJECT",
    ]:
        os.environ.pop(bad, None)

    genai.configure(api_key=api_key)


def hash_text(text: str):
    return hashlib.md5(text.encode()).hexdigest()


def sanitize_collection_name(filename: str) -> str:
    """Convert filename to valid Chroma collection name."""
   
    name = os.path.splitext(filename)[0]
    
    name = ''.join(c if c.isalnum() or c in '_-' else '_' for c in name)
    
    name = name[:63].strip('_-')
    if len(name) < 3:
        name = name + '_pdf'
    return name.lower()


def get_vectorstore_path(pdf_name: str) -> str:
    """Get unique path for PDF's vectorstore."""
    collection_name = sanitize_collection_name(pdf_name)
    return os.path.join("chroma_stores", collection_name)


def create_vectorstore_for_pdf(chunks, embeddings, pdf_name: str):
    """Create a separate vectorstore for this PDF."""
    ids = [hash_text(doc.page_content) for doc in chunks]

    seen, uniq_docs, uniq_ids = set(), [], []

    for doc, id_ in zip(chunks, ids):
        if id_ not in seen:
            seen.add(id_)
            uniq_docs.append(doc)
            uniq_ids.append(id_)

    collection_name = sanitize_collection_name(pdf_name)
    persist_path = get_vectorstore_path(pdf_name)

    vectorstore = Chroma.from_documents(
        documents=uniq_docs,
        embedding=embeddings,
        ids=uniq_ids,
        collection_name=collection_name,
        persist_directory=persist_path
    )
    
    return collection_name


def get_pdf_metadata(path="chroma_stores/metadata.json"):
    """Get list of indexed PDFs from metadata."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return {}


def save_pdf_metadata(pdf_name: str, collection_name: str, page_count: int, path="chroma_stores/metadata.json"):
    """Save PDF metadata."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    
    metadata = get_pdf_metadata(path)
    metadata[pdf_name] = {
        "collection_name": collection_name,
        "page_count": page_count,
        "path": get_vectorstore_path(pdf_name)
    }
    
    with open(path, 'w') as f:
        json.dump(metadata, f, indent=2)


def delete_pdf_metadata(pdf_name: str, path="chroma_stores/metadata.json"):
    """Remove PDF from metadata."""
    metadata = get_pdf_metadata(path)
    if pdf_name in metadata:
        del metadata[pdf_name]
        with open(path, 'w') as f:
            json.dump(metadata, f, indent=2)


def format_answer(text):
    if not text:
        return ""
    text = text.replace("•", "-")
    text = text.replace("\r\n", "\n")
    return text.strip()



@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...), api_key: str = Form(...)):
    if not api_key:
        return {"error": "API key missing"}

    force_api_key(api_key)

   
    existing = get_pdf_metadata()
    if file.filename in existing:
        return {"error": f"PDF '{file.filename}' already indexed. Delete it first or upload with a different name."}

  
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        pdf_path = tmp.name

  
    try:
        loader = PyPDFLoader(pdf_path)
        pages = loader.load()
        page_count = len(pages)
        
        
        for page in pages:
            page.metadata["source_file"] = file.filename
    finally:
        try:
            os.remove(pdf_path)
        except:
            pass

  
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500, chunk_overlap=200
    )
    chunks = splitter.split_documents(pages)

   
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",
        task_type="retrieval_document",
        api_key=api_key
    )


    collection_name = create_vectorstore_for_pdf(chunks, embeddings, file.filename)
    
   
    save_pdf_metadata(file.filename, collection_name, page_count)

    return {
        "message": f"PDF '{file.filename}' indexed successfully.",
        "collection_name": collection_name,
        "pages": page_count,
        "chunks": len(chunks)
    }




@app.post("/upload-pdfs")
async def upload_pdfs(files: List[UploadFile] = File(...), api_key: str = Form(...)):
    if not api_key:
        return {"error": "API key missing"}

    force_api_key(api_key)

    if not files:
        return {"error": "No files uploaded"}

    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",
        task_type="retrieval_document",
        api_key=api_key
    )

    indexed_files = []
    errors = []
    existing = get_pdf_metadata()

    for file in files:
        try:
          
            if file.filename in existing:
                errors.append(f"{file.filename}: Already indexed")
                continue

          
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(await file.read())
                pdf_path = tmp.name

           
            try:
                loader = PyPDFLoader(pdf_path)
                pages = loader.load()
                page_count = len(pages)
                
                
                for page in pages:
                    page.metadata["source_file"] = file.filename
                
                
                splitter = RecursiveCharacterTextSplitter(
                    chunk_size=1500, chunk_overlap=200
                )
                chunks = splitter.split_documents(pages)
                
                
                collection_name = create_vectorstore_for_pdf(chunks, embeddings, file.filename)
                
               
                save_pdf_metadata(file.filename, collection_name, page_count)
                
                indexed_files.append({
                    "filename": file.filename,
                    "pages": page_count,
                    "chunks": len(chunks)
                })
                
            finally:
                try:
                    os.remove(pdf_path)
                except:
                    pass
                    
        except Exception as e:
            errors.append(f"{file.filename}: {str(e)}")

    response = {
        "message": f"Successfully indexed {len(indexed_files)} PDF(s)",
        "indexed_files": indexed_files
    }
    
    if errors:
        response["errors"] = errors

    return response



@app.get("/list-pdfs")
async def list_pdfs():
    metadata = get_pdf_metadata()
    pdfs = [
        {
            "filename": name,
            "collection_name": info["collection_name"],
            "page_count": info["page_count"]
        }
        for name, info in metadata.items()
    ]
    return {"pdfs": pdfs, "count": len(pdfs)}



@app.delete("/delete-pdf/{pdf_name}")
async def delete_pdf(pdf_name: str):
    import shutil
    
    metadata = get_pdf_metadata()
    
    if pdf_name not in metadata:
        return {"error": f"PDF '{pdf_name}' not found"}
    
  
    pdf_path = metadata[pdf_name]["path"]
    if os.path.exists(pdf_path):
        shutil.rmtree(pdf_path)
   
    delete_pdf_metadata(pdf_name)
    
    return {"message": f"PDF '{pdf_name}' deleted successfully"}



@app.delete("/clear-pdfs")
async def clear_pdfs():
    import shutil
    path = "chroma_stores"
    
    if os.path.exists(path):
        shutil.rmtree(path)
        return {"message": "All PDFs cleared successfully"}
    
    return {"message": "No PDFs to clear"}




@app.post("/ask")
async def ask_question(
    question: str = Form(...), 
    api_key: str = Form(...),
    pdf_name: Optional[str] = Form(None)  
):
    if not api_key:
        return {"answer": "Please enter your API key in settings."}

    force_api_key(api_key)

    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",
        task_type="retrieval_query",
        api_key=api_key
    )

    metadata = get_pdf_metadata()
    
    if not metadata:
        return {"answer": "No PDFs indexed yet. Please upload a PDF first."}

    if pdf_name:
        if pdf_name not in metadata:
            return {"answer": f"PDF '{pdf_name}' not found."}
        pdfs_to_query = {pdf_name: metadata[pdf_name]}
    else:
        pdfs_to_query = metadata

  
    all_docs = []
    
    for name, info in pdfs_to_query.items():
        try:
            vectorstore = Chroma(
                collection_name=info["collection_name"],
                persist_directory=info["path"],
                embedding_function=embeddings
            )
            
            retriever = vectorstore.as_retriever(
                search_type="similarity",
                search_kwargs={"k": 4}
            )
            docs = retriever.invoke(question)
            all_docs.extend(docs)
            
        except Exception as e:
            continue

    if not all_docs:
        return {"answer": "No relevant information found in the indexed PDFs."}

   
    all_docs = all_docs[:8]

 
    context_parts = []
    for doc in all_docs:
        source = doc.metadata.get("source_file", "Unknown")
        page = doc.metadata.get("page", "?")
        context_parts.append(f"[Source: {source}, Page: {page}]\n{doc.page_content}")
    
    context = "\n\n---\n\n".join(context_parts)


    llm = ChatGoogleGenerativeAI(
        model="models/gemini-2.0-flash",
        temperature=0,
        api_key=api_key
    )

    prompt = f"""
Use ONLY the following context to answer the question. If the answer is not in the context, use your knowledge.

Always cite which document and page number you're referencing.

Context:
{context}

Question:
{question}
"""

    try:
        answer = llm.invoke(prompt)
        answer_text = answer.content if hasattr(answer, 'content') else str(answer)
    except Exception as e:
        return {"answer": f"LLM Error: {e}"}

    return {"answer": format_answer(answer_text)}



@app.post("/ask-stream")
async def ask_question_stream(
    question: str = Form(...), 
    api_key: str = Form(...),
    pdf_name: Optional[str] = Form(None)
):
    if not api_key:
        async def error_stream():
            yield "Please enter your API key in settings."
        return StreamingResponse(error_stream(), media_type="text/plain")

    force_api_key(api_key)

    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",
        task_type="retrieval_query",
        api_key=api_key
    )

    metadata = get_pdf_metadata()
    
    if not metadata:
        async def error_stream():
            yield "No PDFs indexed yet. Please upload a PDF first."
        return StreamingResponse(error_stream(), media_type="text/plain")

   
    if pdf_name:
        if pdf_name not in metadata:
            async def error_stream():
                yield f"PDF '{pdf_name}' not found."
            return StreamingResponse(error_stream(), media_type="text/plain")
        pdfs_to_query = {pdf_name: metadata[pdf_name]}
    else:
        pdfs_to_query = metadata


    all_docs = []
    
    for name, info in pdfs_to_query.items():
        try:
            vectorstore = Chroma(
                collection_name=info["collection_name"],
                persist_directory=info["path"],
                embedding_function=embeddings
            )
            
            retriever = vectorstore.as_retriever(
                search_type="similarity",
                search_kwargs={"k": 4}
            )
            docs = retriever.invoke(question)
            all_docs.extend(docs)
            
        except Exception as e:
            continue

    if not all_docs:
        async def error_stream():
            yield "No relevant information found in the indexed PDFs."
        return StreamingResponse(error_stream(), media_type="text/plain")

 
    all_docs = all_docs[:8]


    context_parts = []
    for doc in all_docs:
        source = doc.metadata.get("source_file", "Unknown")
        page = doc.metadata.get("page", "?")
        context_parts.append(f"[Source: {source}, Page: {page}]\n{doc.page_content}")
    
    context = "\n\n---\n\n".join(context_parts)


    llm = ChatGoogleGenerativeAI(
        model="models/gemini-2.0-flash",
        temperature=0,
        api_key=api_key,
        streaming=True
    )

    prompt = f"""
You are an intelligent hybrid assistant that reads PDF context when available,
and provides high-quality answers using a fallback system.

Your behavior rules:

1. **If the PDF context is EMPTY or missing:**
- Ignore the context section.
- Answer using your general knowledge.
- Do NOT mention any absence of context.
- Ensure the answer is clear and correct.

2. **If PDF context IS provided:**
- First, try your absolute best to answer ONLY using the PDF context.
- If the answer IS found inside the PDF:
    - Answer strictly from the PDF.
    - Cite the PDF filename and page number from metadata.

3. **If the answer is NOT found inside the PDF context:**
- Do NOT hallucinate a PDF source or page.
- Provide the answer using your general knowledge.
- Say this sentence at the beginning:
  "The provided PDF does not contain relevant information for this question, so I am using general knowledge."
- Then continue with a correct, helpful, general-knowledge answer.

4. **Spelling & Grammar Correction:**
- If the user’s question contains spelling or grammar mistakes,
  silently correct them and answer the corrected version.
- You may optionally rephrase the corrected question in your own words.

5. **Tone & Constraints:**
- Never reveal internal reasoning or chain-of-thought.
- Never mention “context” unless referring to the PDF explicitly.
- Keep answers accurate, concise, and helpful.

---------------------------
PDF Context:
{context}

User Question:
{question}
"""


    async def generate():
        try:
            async for chunk in llm.astream(prompt):
                if hasattr(chunk, 'content') and chunk.content:
                    text = chunk.content
                    text = text.replace("•", "-")
                    text = text.replace("\r\n", "\n")
                    yield text
        except Exception as e:
            yield f"\n\nError: {e}"

    return StreamingResponse(generate(), media_type="text/plain")



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000)
