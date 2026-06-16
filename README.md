# PadPick - Premium Rental Homes Platform

PadPick is a sleek, modern, full-stack rental homes platform. It provides a visual gallery of rental properties that users can search and filter. Registered users can log in and list new rental homes.

## 🚀 Technology Stack

- **Backend**: Python & FastAPI
- **Database**: Neon PostgreSQL (SQLAlchemy ORM)
- **Frontend**: Premium Vanilla HTML5, CSS3 (Custom Variables, Glassmorphism, Animations), and ES6 JavaScript
- **Auth**: Secure JWT tokens with native BCrypt password hashing

## 📂 Folder Structure

```text
Chatbot/
├── index.html                   # Pure Landing page explaining PadPick (Root)
├── frontend/                    # Consolidated Frontend Assets
│   ├── dashboard.html           # Main application view (Explore listings, search, list homes)
│   ├── login.html               # Login screen
│   ├── signup.html              # Signup screen
│   ├── css/
│   │   └── style.css            # Stylesheet (indigo/emerald accent, dark theme)
│   ├── js/
│   │   ├── auth.js              # Token management & API auth fetch requests
│   │   └── app.js               # Listings loading, filters, and modals JS
│   └── images/
│       └── luxury_villa_banner.png # Generated high-res banner image of a modern luxury villa
├── backend/                     # FastAPI backend application
│   ├── main.py                  # Server endpoints & static mounts
│   ├── database.py              # Neon database SQLAlchemy connection
│   ├── models.py                # SQL models (User & Property tables)
│   ├── schemas.py               # Pydantic schemas
│   ├── auth.py                  # Password hashing & JWT generation
│   ├── seed.py                  # Seed script for initial properties
│   └── requirements.txt         # Backend Python packages
├── .env                         # Environment variables (DB URL, JWT Secret)
├── .gitignore                   # Exclude virtualenvs & secrets from Git
└── README.md                    # This instructions file
```

## ⚡ How to Run Locally

### 1. Set up a virtual environment and install dependencies
```bash
# Create a virtual environment
python -m venv .venv

# Activate it (Windows)
.venv\Scripts\activate

# Install requirements
pip install -r backend/requirements.txt
```

### 2. Configure Environment Variables
Create a `.env` file in the root folder:
```env
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_jwt_secret_key
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### 3. Seed the Database
Populate the database with sample properties and a default admin user:
```bash
python backend/seed.py
```
- Default Admin: `admin@padpick.com`
- Default Password: `admin123`

### 4. Start the Application
Start the Uvicorn server:
```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser!

---

## 🔒 Security Practices

1. **Native Hashing**: Password storage is secured using standard salting and hashing with the native Python `bcrypt` library.
2. **Environment Isolation**: Database connection secrets and JWT signing keys are stored exclusively in the local `.env` configuration, which is listed in `.gitignore` to prevent leaks.
3. **Stateless JWT**: Authentication relies on client-side JWT tokens passed in the `Authorization: Bearer <token>` header, verified dynamically.
