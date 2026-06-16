import os
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .database import engine, Base, get_db
from .models import User, Property, Review, Message
from .schemas import UserCreate, UserOut, Token, PropertyCreate, PropertyOut, ReviewCreate, ReviewOut, MessageCreate, MessageOut
from .auth import get_password_hash, verify_password, create_access_token, get_current_user

# Create tables in the Neon PostgreSQL database on startup
Base.metadata.create_all(bind=engine)

import cloudinary
import cloudinary.uploader

app = FastAPI(title="PadPick Rental Platform")

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME", "du8wwd1nm"),
    api_key=os.getenv("CLOUDINARY_API_KEY", "172758556737718"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET", "2RkUhojKh70KRFejSbzuLmW4i6Q")
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root directory path (parent of backend/)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Custom login request model for JSON bodies
class LoginRequest(BaseModel):
    email: str
    password: str

# Serve frontend pages
@app.get("/")
def get_index():
    index_path = os.path.join(ROOT_DIR, "index.html")
    if not os.path.exists(index_path):
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(index_path)

@app.get("/login")
def get_login():
    login_path = os.path.join(ROOT_DIR, "frontend", "login.html")
    if not os.path.exists(login_path):
        raise HTTPException(status_code=404, detail="login.html not found")
    return FileResponse(login_path)

@app.get("/signup")
def get_signup():
    signup_path = os.path.join(ROOT_DIR, "frontend", "signup.html")
    if not os.path.exists(signup_path):
        raise HTTPException(status_code=404, detail="signup.html not found")
    return FileResponse(signup_path)

@app.get("/dashboard")
def get_dashboard():
    dashboard_path = os.path.join(ROOT_DIR, "frontend", "dashboard.html")
    if not os.path.exists(dashboard_path):
        raise HTTPException(status_code=404, detail="dashboard.html not found")
    return FileResponse(dashboard_path)

# Authentication endpoints
@app.post("/api/auth/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    hashed_pwd = get_password_hash(user.password)
    new_user = User(
        email=user.email,
        hashed_password=hashed_pwd,
        full_name=user.full_name,
        mobile_number=user.mobile_number
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/auth/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user

# Property listing endpoints
@app.get("/api/properties", response_model=List[PropertyOut])
def get_properties(
    location: Optional[str] = None,
    max_price: Optional[float] = None,
    bedrooms: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Property)
    if location:
        query = query.filter(Property.location.ilike(f"%{location}%"))
    if max_price:
        query = query.filter(Property.price_per_month <= max_price)
    if bedrooms:
        query = query.filter(Property.bedrooms == bedrooms)
    return query.order_by(Property.created_at.desc()).all()

@app.post("/api/properties", response_model=PropertyOut, status_code=status.HTTP_201_CREATED)
def create_property(
    property_in: PropertyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Determine the primary image_url from the first item in media_urls if not explicitly set
    primary_image = property_in.image_url
    if not primary_image and property_in.media_urls:
        urls = [url.strip() for url in property_in.media_urls.split(",") if url.strip()]
        if urls:
            primary_image = urls[0]

    new_property = Property(
        title=property_in.title,
        description=property_in.description,
        price_per_month=property_in.price_per_month,
        location=property_in.location,
        bedrooms=property_in.bedrooms,
        bathrooms=property_in.bathrooms,
        image_url=primary_image,
        owner_name=property_in.owner_name,
        furnished_status=property_in.furnished_status,
        amenities=property_in.amenities,
        address=property_in.address,
        contact_number=property_in.contact_number,
        media_urls=property_in.media_urls,
        owner_id=current_user.id
    )
    db.add(new_property)
    db.commit()
    db.refresh(new_property)
    return new_property

@app.put("/api/properties/{property_id}", response_model=PropertyOut)
def update_property(
    property_id: int,
    property_in: PropertyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_property = db.query(Property).filter(Property.id == property_id).first()
    if not db_property:
        raise HTTPException(status_code=404, detail="Property not found")
    if db_property.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this property")
        
    primary_image = property_in.image_url
    if not primary_image and property_in.media_urls:
        urls = [url.strip() for url in property_in.media_urls.split(",") if url.strip()]
        if urls:
            primary_image = urls[0]
            
    db_property.title = property_in.title
    db_property.description = property_in.description
    db_property.price_per_month = property_in.price_per_month
    db_property.location = property_in.location
    db_property.bedrooms = property_in.bedrooms
    db_property.bathrooms = property_in.bathrooms
    db_property.image_url = primary_image
    db_property.owner_name = property_in.owner_name
    db_property.furnished_status = property_in.furnished_status
    db_property.amenities = property_in.amenities
    db_property.address = property_in.address
    db_property.contact_number = property_in.contact_number
    db_property.media_urls = property_in.media_urls
    
    db.commit()
    db.refresh(db_property)
    return db_property

@app.delete("/api/properties/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_property(
    property_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_property = db.query(Property).filter(Property.id == property_id).first()
    if not db_property:
        raise HTTPException(status_code=404, detail="Property not found")
    if db_property.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this property")
        
    db.delete(db_property)
    db.commit()
    return None

@app.post("/api/users/profile-image", response_model=UserOut)
def upload_profile_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
        
    avatar_dir = os.path.join(ROOT_DIR, "frontend", "images", "avatars")
    os.makedirs(avatar_dir, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1]
    if not file_ext:
        file_ext = ".png"
        
    filename = f"user_{current_user.id}{file_ext}"
    file_path = os.path.join(avatar_dir, filename)
    
    contents = file.file.read()
    with open(file_path, "wb") as buffer:
        buffer.write(contents)
        
    avatar_url = f"/frontend/images/avatars/{filename}"
    current_user.avatar_url = avatar_url
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post("/api/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review(
    review_in: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if review_in.rating < 1 or review_in.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    if not review_in.feedback.strip():
        raise HTTPException(status_code=400, detail="Feedback cannot be empty")
        
    existing = db.query(Review).filter(Review.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already submitted a review. You cannot submit multiple reviews.")
        
    new_review = Review(
        user_id=current_user.id,
        rating=review_in.rating,
        feedback=review_in.feedback
    )
    db.add(new_review)
    db.commit()
    db.refresh(new_review)
    return new_review

@app.get("/api/reviews/me", response_model=Optional[ReviewOut])
def get_my_review(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Review).filter(Review.user_id == current_user.id).first()

@app.get("/api/reviews", response_model=List[ReviewOut])
def get_reviews(db: Session = Depends(get_db)):
    return db.query(Review).order_by(Review.created_at.desc()).all()

@app.post("/api/properties/upload-images")
def upload_property_images(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user)
):
    uploaded_urls = []
    for file in files:
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="All uploaded files must be images")
            
        try:
            # Read file bytes to avoid stream seeking issues
            contents = file.file.read()
            # Upload raw file bytes directly to Cloudinary under 'padpick' folder
            upload_result = cloudinary.uploader.upload(contents, folder="padpick")
            secure_url = upload_result.get("secure_url")
            if not secure_url:
                raise HTTPException(status_code=500, detail="Cloudinary upload did not return secure URL")
            uploaded_urls.append(secure_url)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Cloudinary upload failed: {str(e)}")
            
    return {"urls": uploaded_urls}

@app.post("/api/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send_message(
    msg_in: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    receiver = db.query(User).filter(User.id == msg_in.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver user not found")
        
    db_msg = Message(
        sender_id=current_user.id,
        receiver_id=msg_in.receiver_id,
        property_id=msg_in.property_id,
        text=msg_in.text
    )
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)
    return db_msg

@app.get("/api/messages/chats")
def get_user_chats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    messages = db.query(Message).filter(
        (Message.sender_id == current_user.id) | (Message.receiver_id == current_user.id)
    ).order_by(Message.created_at.asc()).all()

    chats = {}
    for m in messages:
        other_id = m.receiver_id if m.sender_id == current_user.id else m.sender_id
        key = (other_id, m.property_id)
        if key not in chats:
            other_user = db.query(User).filter(User.id == other_id).first()
            other_name = other_user.full_name if other_user else "Unknown User"
            other_avatar = other_user.avatar_url if other_user else None
            
            prop_title = ""
            if m.property_id:
                prop = db.query(Property).filter(Property.id == m.property_id).first()
                if prop:
                    prop_title = prop.title

            chats[key] = {
                "other_user_id": other_id,
                "other_user_name": other_name,
                "other_user_avatar": other_avatar,
                "property_id": m.property_id,
                "property_title": prop_title,
                "last_message": m.text,
                "last_message_time": m.created_at,
                "messages": []
            }
        
        chats[key]["messages"].append({
            "id": m.id,
            "sender_id": m.sender_id,
            "receiver_id": m.receiver_id,
            "property_id": m.property_id,
            "text": m.text,
            "created_at": m.created_at
        })
        chats[key]["last_message"] = m.text
        chats[key]["last_message_time"] = m.created_at

    return sorted(chats.values(), key=lambda x: x["last_message_time"], reverse=True)

# Mount frontend folder for serving stylesheet, images, and client-side JS
frontend_path = os.path.join(ROOT_DIR, "frontend")
if not os.path.exists(frontend_path):
    os.makedirs(frontend_path, exist_ok=True)
app.mount("/frontend", StaticFiles(directory=frontend_path), name="frontend")
