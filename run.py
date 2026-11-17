from pathlib import Path
from dotenv import load_dotenv
import os

_dotenv_path = Path(__file__).resolve().parent / ".env"
if _dotenv_path.is_file():
    load_dotenv(dotenv_path=_dotenv_path, override=False)

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
    )