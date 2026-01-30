import early_patch
import uvicorn
from fastapi import FastAPI
from dotenv import load_dotenv
from api.routes import process

# Load env
load_dotenv()

app = FastAPI(title="AI Meeting Summarizer")

app.include_router(process.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Welcome to AI Meeting Summarizer API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)