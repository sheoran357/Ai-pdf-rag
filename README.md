# AI PDF RAG

A React interface for uploading PDFs, indexing their text in Chroma, asking questions with Gemini, and keeping chat history in MongoDB. The Python service handles PDF indexing and retrieval; the Node service stores chat sessions and messages.

## Requirements

- Windows 10/11 (commands below use PowerShell)
- Python 3.11
- Node.js 20 or newer
- MongoDB Community Server running locally, or a MongoDB connection URI
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## 1. Configure MongoDB

In PowerShell:

```powershell
cd D:\Pdf-Brain-Next\node-backend
Copy-Item .env.example .env
```

By default, `.env` points to `mongodb://127.0.0.1:27017/pdfchat`. Start MongoDB before starting the Node backend. If MongoDB is hosted elsewhere, update `MONGO_URI` in `node-backend\.env`.

## 2. Install and start the Python RAG backend

Open a new PowerShell terminal:

```powershell
cd D:\Pdf-Brain-Next\backend
py -3.11 -m venv myenv
.\myenv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r .\app\req.txt
cd .\app
python .\api.py
```

The API should be available at `http://127.0.0.1:8000`. Open `http://127.0.0.1:8000/docs` to inspect the existing API routes.

If PowerShell blocks environment activation, run the interpreter directly instead:

```powershell
D:\Pdf-Brain-Next\backend\myenv\Scripts\python.exe -m pip install -r D:\Pdf-Brain-Next\backend\app\req.txt
D:\Pdf-Brain-Next\backend\myenv\Scripts\python.exe D:\Pdf-Brain-Next\backend\app\api.py
```

## 3. Install and start the Node chat backend

Open another PowerShell terminal:

```powershell
cd D:\Pdf-Brain-Next\node-backend
npm ci
npm run dev
```

The API listens at `http://127.0.0.1:5000`. It will wait for MongoDB to connect before listening.

## 4. Start the React frontend

Open another PowerShell terminal:

```powershell
cd D:\Pdf-Brain-Next\frontend
npm ci
npm run dev
```

Open the local URL Vite prints (normally `http://localhost:5173`). Open **Settings**, enter your Gemini API key, upload a PDF, and ask a question.

## 5. Run checks

```powershell
cd D:\Pdf-Brain-Next\frontend
npm run lint
npm run build
```

For the Node backend:

```powershell
cd D:\Pdf-Brain-Next\node-backend
npm run start
```

For Python syntax validation:

```powershell
cd D:\Pdf-Brain-Next
backend\myenv\Scripts\python.exe -m py_compile backend\app\api.py backend\app\api_test2.py
```

## Existing index compatibility

The app now uses `gemini-embedding-001` for text embeddings and `gemini-3.8-flash` for answer generation. Older indexes created with `text-embedding-004` cannot be queried with the new embedding model. If an older PDF is reported as requiring re-indexing, select that PDF in the sidebar, delete it, and upload it again. Your original PDF file is not deleted from your computer.

## Important notes

- The Gemini key is stored in browser local storage by the existing Settings flow. Avoid using the app on shared computers; clear the key from Settings/browser storage when finished.
- Do not commit `.env` files, API keys, local PDFs, `backend/app/chroma_stores/`, or `backend/app/memory.json`.
- The Electron desktop packaging configuration is still a work in progress. Run the three services above separately for the most reliable development setup.

## Optional: run the Electron development shell

After installing the root, frontend, and Node backend npm dependencies and creating `backend\myenv`, open a fourth terminal:

```powershell
cd D:\Pdf-Brain-Next
npm ci
npm run dev
```

This starts Vite, the Node chat API, and Electron together. MongoDB must already be running. For troubleshooting, the three separate-terminal workflow above is easier because each service's logs remain visible.
