from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import fitz  # PyMuPDF
import google.generativeai as genai
import os
import tempfile
import speech_recognition as sr
from pydantic import BaseModel
from googletrans import Translator
from gtts import gTTS
import uuid

# Initialize FastAPI app
app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create static folder for audio files if it doesn't exist
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize Translator
translator = Translator()

# Initialize Gemini AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "your-api-key-here")
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-pro')

# Store documents in memory (use a database in production)
documents = {}

# Request Models
class QueryRequest(BaseModel):
    query: str
    language: str = "en"
    voice: bool = False
    document_id: str

@app.post("/upload/")
async def upload_pdf(file: UploadFile = File(...)):
    """Handles PDF file uploads, extracts text, and stores it."""
    try:
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            temp_file.write(await file.read())
            temp_file_path = temp_file.name

        # Extract text from the PDF
        doc = fitz.open(temp_file_path)
        document_text = "\n".join([page.get_text("text") for page in doc])

        # Generate a unique ID for this document
        document_id = str(uuid.uuid4())
        documents[document_id] = document_text

        # Clean up the temporary file
        os.unlink(temp_file_path)

        return {
            "message": "PDF uploaded successfully",
            "document_id": document_id,
            "text_preview": (document_text[:300] + "...") if len(document_text) > 300 else document_text,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

@app.post("/ask/")
async def ask_question(request: QueryRequest):
    """Handles text-based questions on uploaded documents."""
    try:
        if request.document_id not in documents:
            raise HTTPException(status_code=404, detail="Document not found")

        document_text = documents[request.document_id]
        response_text = get_ai_response(request.query, document_text)

        # Translate response if needed
        if request.language != "en":
            response_text = translator.translate(response_text, dest=request.language).text

        result = {"answer": response_text}

        # Generate audio response if requested
        if request.voice:
            audio_filename = f"answer_{uuid.uuid4()}.mp3"
            audio_path = os.path.join("static", audio_filename)

            tts = gTTS(text=response_text, lang=request.language)
            tts.save(audio_path)

            result["audio_url"] = f"/static/{audio_filename}"

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")

def get_ai_response(query, document_text):
    """Generates a response from Gemini AI using document context."""
    try:
        prompt = f"Based on the following document content, answer the question: {query}\n\nDocument Content:\n{document_text[:15000]}"
        response = model.generate_content(prompt)
        return response.text if response else "No response generated."
    except Exception as e:
        return f"Error generating AI response: {str(e)}"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
