# LLM-PROP Quickstart

Minimal commands to get the project running locally. Use PowerShell on Windows or Bash on macOS/Linux.

Prereqs
- Python 3.10+
- Node.js 18+, npm 9+

1) Clone and install

```bash
git clone <your-repo-url>
cd <repo-folder-name>
```

2) Python venv

PowerShell:
```powershell
python -m venv .venv
(Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned) ; .\.venv\Scripts\Activate.ps1
pip install -r LLM-Prop/requirements.txt
```

macOS / Linux:
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r LLM-Prop/requirements.txt
```

3) Install Node deps

```bash
cd express-server && npm install && cd ..
cd frontend && npm install && cd ..
```

4) Create `express-server/.env` from `express-server/.env.example` and fill values (MONGODB_URI, JWT_SECRET, FASTAPI_URL).

5) Start services (three terminals):

Terminal A — FastAPI
```powershell
cd LLM-Prop/models_deployment
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Terminal B — Express
```powershell
cd express-server
npm run dev
```

Terminal C — Frontend
```powershell
cd frontend
npm run dev
```

6) Open UI: http://localhost:8080/predict

Health checks
```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:5000/health
```

That's it — reach out if you want this committed to a branch and a sample `.env` committed to `.env.example` (placeholders only).