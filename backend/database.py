import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

# Load .env file from the root directory (parent of backend/)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
engine = None
SessionLocal = None

if DATABASE_URL:
    # Neon Postgres requires SSL, SQLAlchemy handles this fine via the sslmode parameter in the connection string
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    if SessionLocal is None:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail="DATABASE_URL is not set in environment variables. Please set it in Vercel settings."
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
