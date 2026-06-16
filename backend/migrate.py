import os
import sys
from sqlalchemy import text

# Add current directory to path if run from root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, engine

def run_migration():
    print("Running migration to add mobile_number and advanced property columns...")
    db = SessionLocal()
    try:
        # User migrations
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR;"))
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR;"))
        db.commit()
        print("Migrated users table.")

        # Reviews table migration
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS reviews (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                rating INTEGER NOT NULL,
                feedback VARCHAR NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        db.commit()
        print("Migrated reviews table.")

        # Property migrations
        print("Migrating properties table...")
        db.execute(text("ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_name VARCHAR;"))
        db.execute(text("ALTER TABLE properties ADD COLUMN IF NOT EXISTS furnished_status VARCHAR;"))
        db.execute(text("ALTER TABLE properties ADD COLUMN IF NOT EXISTS amenities VARCHAR;"))
        db.execute(text("ALTER TABLE properties ADD COLUMN IF NOT EXISTS address VARCHAR;"))
        db.execute(text("ALTER TABLE properties ADD COLUMN IF NOT EXISTS contact_number VARCHAR;"))
        db.execute(text("ALTER TABLE properties ADD COLUMN IF NOT EXISTS media_urls VARCHAR;"))
        db.commit()
        print("Successfully migrated database: added advanced property columns, avatar_url, and reviews!")
    except Exception as e:
        print(f"Migration error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
