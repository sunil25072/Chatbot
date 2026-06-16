from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional, List

class PropertyBase(BaseModel):
    title: str
    description: Optional[str] = None
    price_per_month: float
    location: str
    bedrooms: int = 1
    bathrooms: int = 1
    image_url: Optional[str] = None
    owner_name: Optional[str] = None
    furnished_status: Optional[str] = None
    amenities: Optional[str] = None
    address: Optional[str] = None
    media_urls: Optional[str] = None
    contact_number: Optional[str] = None

class PropertyCreate(PropertyBase):
    pass

class PropertyOut(PropertyBase):
    id: int
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True # Support for SQLAlchemy model conversion in Pydantic v2

class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    mobile_number: Optional[str] = None
    avatar_url: Optional[str] = None

    @field_validator('email')
    @classmethod
    def validate_padpick_email(cls, v: str) -> str:
        # Enforce that email has to end with @padpick.com
        if not v.lower().endswith("@padpick.com"):
            raise ValueError("Email must end with @padpick.com")
        return v

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class ReviewCreate(BaseModel):
    rating: int
    feedback: str

class ReviewOut(BaseModel):
    id: int
    user_id: int
    rating: int
    feedback: str
    created_at: datetime
    user: UserOut

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    receiver_id: int
    property_id: Optional[int] = None
    text: str

class MessageOut(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    property_id: Optional[int] = None
    text: str
    created_at: datetime

    class Config:
        from_attributes = True
