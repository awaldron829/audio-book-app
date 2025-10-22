from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class Book(BaseModel):
    id: str
    title: str
    path: str
    duration: float = 0.0
    is_series: bool = False
    series_name: Optional[str] = None
    file_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PlaybackProgress(BaseModel):
    book_id: str
    position: float = 0.0
    duration: float = 0.0
    current_file_index: int = 0
    last_played: datetime = Field(default_factory=datetime.utcnow)
    completed: bool = False

class PlaybackProgressUpdate(BaseModel):
    book_id: str
    position: float
    duration: float
    current_file_index: int

class BookCreate(BaseModel):
    id: str
    title: str
    path: str
    duration: float = 0.0
    is_series: bool = False
    series_name: Optional[str] = None
    file_count: int = 0

# Routes
@api_router.get("/")
async def root():
    return {"message": "Smart Audiobook Player API"}

@api_router.post("/books")
async def create_book(book: BookCreate):
    """Create or update a book entry"""
    existing = await db.books.find_one({"id": book.id})
    book_dict = book.dict()
    book_dict["created_at"] = datetime.utcnow()
    
    if existing:
        await db.books.update_one(
            {"id": book.id},
            {"$set": book_dict}
        )
    else:
        await db.books.insert_one(book_dict)
    
    return {"status": "success", "book_id": book.id}

@api_router.get("/books", response_model=List[Book])
async def get_books():
    """Get all books"""
    books = await db.books.find().to_list(1000)
    return [Book(**book) for book in books]

@api_router.get("/books/{book_id}", response_model=Book)
async def get_book(book_id: str):
    """Get a specific book"""
    book = await db.books.find_one({"id": book_id})
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return Book(**book)

@api_router.post("/progress")
async def save_progress(progress: PlaybackProgressUpdate):
    """Save playback progress for a book"""
    existing = await db.progress.find_one({"book_id": progress.book_id})
    
    progress_dict = progress.dict()
    progress_dict["last_played"] = datetime.utcnow()
    progress_dict["completed"] = False
    
    if existing:
        await db.progress.update_one(
            {"book_id": progress.book_id},
            {"$set": progress_dict}
        )
    else:
        await db.progress.insert_one(progress_dict)
    
    return {"status": "success"}

@api_router.get("/progress/{book_id}")
async def get_progress(book_id: str):
    """Get playback progress for a book"""
    progress = await db.progress.find_one({"book_id": book_id})
    if not progress:
        return {
            "book_id": book_id,
            "position": 0.0,
            "duration": 0.0,
            "current_file_index": 0,
            "completed": False
        }
    return PlaybackProgress(**progress)

@api_router.get("/progress", response_model=List[PlaybackProgress])
async def get_all_progress():
    """Get all playback progress"""
    progress_list = await db.progress.find().to_list(1000)
    return [PlaybackProgress(**p) for p in progress_list]

@api_router.delete("/progress/{book_id}")
async def reset_progress(book_id: str):
    """Reset playback progress for a book"""
    result = await db.progress.delete_one({"book_id": book_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Progress not found")
    return {"status": "success", "message": "Progress reset"}

@api_router.post("/progress/complete/{book_id}")
async def mark_complete(book_id: str):
    """Mark a book as completed"""
    result = await db.progress.update_one(
        {"book_id": book_id},
        {"$set": {"completed": True, "last_played": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Progress not found")
    return {"status": "success"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
