"""Compatibility entry point; the maintained FastAPI implementation is api_test2.py."""
from api_test2 import app

if __name__ == "__main__":
    import os
    import uvicorn

    uvicorn.run(
        "api:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        reload=False,
    )
