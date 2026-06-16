import os
import sys
from sqlalchemy.orm import Session

# Add current directory to path if run from root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, engine, Base
from backend.models import User, Property
from backend.auth import get_password_hash

def seed_database():
    print("Connecting to database and creating tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if we already have an admin user
        admin = db.query(User).filter(User.email == "admin@padpick.com").first()
        if not admin:
            print("Creating default admin account (admin@padpick.com)...")
            hashed_pwd = get_password_hash("admin123")
            admin = User(
                email="admin@padpick.com",
                hashed_password=hashed_pwd,
                full_name="PadPick Admin"
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
        else:
            print("Admin account already exists.")

        # Check if we have properties
        count = db.query(Property).count()
        if count == 0:
            print("Seeding sample property listings...")
            samples = [
                Property(
                    title="Luxury Beachfront Villa with Pool",
                    description="Stunning 4-bedroom villa right on the coast. Features private infinity pool, custom floor-to-ceiling glass windows, high-end kitchen, and a private path down to the sandy Malibu shores.",
                    price_per_month=6500.0,
                    location="Malibu, California",
                    bedrooms=4,
                    bathrooms=4,
                    image_url="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80",
                    owner_id=admin.id
                ),
                Property(
                    title="Charming A-Frame Mountain Cottage",
                    description="Cozy alpine retreat surrounded by towering pines. Perfect for weekend ski getaways or summer hiking. Features wood-burning fireplace, hot tub, and rustic wood finishes throughout.",
                    price_per_month=2200.0,
                    location="Aspen, Colorado",
                    bedrooms=2,
                    bathrooms=1,
                    image_url="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80",
                    owner_id=admin.id
                ),
                Property(
                    title="Elegant Midtown Manhattan Penthouse",
                    description="Experience high-rise living with sweeping views of Central Park. Highlights include private terrace access, concierge service, elegant marble bathrooms, and a modern open-concept layout.",
                    price_per_month=4800.0,
                    location="New York City, NY",
                    bedrooms=3,
                    bathrooms=2.5,
                    image_url="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80",
                    owner_id=admin.id
                ),
                Property(
                    title="Minimalist Studio Loft in Shibuya",
                    description="Sleek, modern compact living right in the heart of Tokyo. Short walk to the station, featuring smart home lighting, high-speed fibre internet, and custom space-saving design.",
                    price_per_month=1750.0,
                    location="Tokyo, Shibuya",
                    bedrooms=1,
                    bathrooms=1,
                    image_url="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=80",
                    owner_id=admin.id
                ),
                Property(
                    title="Classic Victorian Townhouse",
                    description="Spacious historical home featuring high ceilings, period fireplaces, and a gorgeous private rear garden. Situated on a quiet, tree-lined residential street in prestigious Kensington.",
                    price_per_month=3900.0,
                    location="London, Kensington",
                    bedrooms=3,
                    bathrooms=3,
                    image_url="https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=600&q=80",
                    owner_id=admin.id
                )
            ]
            db.add_all(samples)
            db.commit()
            print("Successfully seeded 5 sample listings!")
        else:
            print(f"Database already contains {count} property listings. Skipping seed.")
            
    except Exception as e:
        print(f"An error occurred during database seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
