import os
import sys

# Add root folder to sys.path so we can import backend module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app
