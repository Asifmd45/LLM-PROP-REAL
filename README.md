<!-- Improved README: project overview, architecture, quickstart, and troubleshooting -->
# TRANS-PROP (LLM-PROP)

Modern, local inference stack for crystal/material property prediction.
The project exposes a React frontend that talks to an Express middleware which forwards requests to a FastAPI ML backend that runs model inference.

[![License](https://img.shields.io/github/license/Asifmd45/TRANS-PROP)](https://github.com/Asifmd45/TRANS-PROP/blob/main/LICENSE) [![Last commit](https://img.shields.io/github/last-commit/Asifmd45/TRANS-PROP)](https://github.com/Asifmd45/TRANS-PROP/commits/main) [![Repo size](https://img.shields.io/github/repo-size/Asifmd45/TRANS-PROP)](https://github.com/Asifmd45/TRANS-PROP) [![Stars](https://img.shields.io/github/stars/Asifmd45/TRANS-PROP?style=social)](https://github.com/Asifmd45/TRANS-PROP/stargazers)

--

**Project description**
- TRANS-PROP is a local research and prototyping toolkit that converts free-form crystal/material descriptions into quantitative property predictions (e.g., band gap, energy per atom, formation energy, volume, stability indicators). It provides an end-to-end developer workflow so researchers and engineers can test prompts, compare model checkpoints, and persist prediction history for analysis.

**Primary components**
- `frontend/` — React + Vite UI for entering descriptions, viewing predictions, and inspecting per-user history.
- `express-server/` — Node + Express middleware providing authentication, per-user prediction history (MongoDB), and a proxy to the ML backend.
- `LLM-Prop/models_deployment/` — FastAPI service that loads tokenizers and checkpoints and runs the inference pipeline.

**Target users & use cases**
- Materials researchers who want quick, reproducible local inference without cloud deployments.
- Engineers integrating property prediction into downstream tooling or dashboards.
- Use cases: exploratory prompt engineering, batch-evaluation of candidate materials, or recording predictions for human curation.

**Example input & output**
Input (free-text):

```json
{
  "text": "Rb2NaPrCl6 is perovskite-derived and crystallizes in the cubic Fm-3m space group."
}
```

Example output (unified JSON):

```json
{
  "is_gap_direct": true,
  "energy_per_atom": -3.142,
  "formation_energy_per_atom": -0.153,
  "band_gap": 1.25,
  "e_above_hull": 0.05,
  "volume": 214.3
}
```

Field meanings & quick interpretation
- `is_gap_direct` (bool): whether the model predicts a direct band gap. Use as a categorical indicator.
- `band_gap` (eV): estimated band gap energy. Compare to experimental ranges and treat as approximate.
- `energy_per_atom` & `formation_energy_per_atom` (eV): lower (more negative) typically indicates more stable structures.
- `e_above_hull` (eV): distance above the convex hull — values near zero suggest potential thermodynamic stability; >0.1 eV often indicates metastability.
- `volume` (Å^3): predicted unit-cell volume. Useful for sanity checks and downstream geometry expectations.

Important: the model's numeric outputs are approximate; validate with DFT or experiments for final decisions.

**Recommended workflows**
- Quick prompt test: use the `frontend` to iterate on a single description and observe how numeric outputs change.
- Batch evaluation: POST multiple descriptions via the Express API and store results for statistical analysis.
- Checkpoint comparison: swap checkpoint files in `LLM-Prop/checkpoints/` and re-run identical inputs to compare model behavior.

**Limitations & caveats**
- Model uncertainty: predictions are not ground truth; use them for triage, not final validation.
- Input sensitivity: phrasing and missing structural details can change predictions; prefer consistent, descriptive inputs.
- Data & checkpoint dependence: different checkpoints produce different biases — always document which checkpoint produced results.

**Quick architecture & flow**

React (UI) ↔ Express (API + auth + history) ↔ FastAPI (ML inference)

- Frontend: user types a material description and hits Predict.
- Express: performs auth, rate-limits, persists per-user prediction history in MongoDB, and proxies prediction requests to FastAPI.
- FastAPI: loads tokenizer/checkpoints at startup and runs the inference pipeline, returning unified JSON responses.

Ports (defaults):
- Frontend: 8080 (Vite dev)
- Express: 5000
- FastAPI: 8000

--

Table of contents
- Features
- Quickstart (one-page)
- Full setup (detailed)
- ML assets
- Env & MongoDB Atlas
- Running the stack
- Health checks & testing
- Troubleshooting
- Contributing

## Features
- End-to-end local dev stack for inference
- Per-user persistent prediction history (MongoDB)
- FastAPI ML inference using local model checkpoints
- Lightweight Express middleware for auth and request orchestration

## Quickstart (one-page)
See `README_QUICKSTART.md` for a minimal set of commands to get started.

## Full setup (detailed)

Prerequisites
- Python 3.10+ (create virtualenv)
- Node.js 18+ and npm 9+

Verify:

```powershell
python --version
node --version
npm --version
```

Clone

```bash
git clone <your-repo-url>
cd <repo-folder-name>
```

Python environment

```bash
python -m venv .venv
```

Activate (PowerShell):

```powershell
(Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned) ; .\.venv\Scripts\Activate.ps1
```

Install Python deps

```bash
pip install -r LLM-Prop/requirements.txt
```

Install Node deps

```bash
cd express-server && npm install && cd ..
cd frontend && npm install && cd ..
```

## ML assets (checkpoints & data)
This repo excludes large model artifacts. Download the required assets and place them exactly as below.

- `LLM-Prop/data/samples/train_data.csv`
- `LLM-Prop/checkpoints/samples/classification/best_checkpoint_for_is_gap_direct.pt`
- `LLM-Prop/checkpoints/samples/regression/best_checkpoint_for_energy_per_atom.pt`
- `LLM-Prop/checkpoints/samples/regression/best_checkpoint_for_fepa.pt`
- `LLM-Prop/checkpoints/samples/regression/best_checkpoint_for_band_gap.pt`
- `LLM-Prop/checkpoints/samples/regression/best_checkpoint_for_e_above_hull.pt`
- `LLM-Prop/checkpoints/samples/regression/best_checkpoint_for_volume.pt`

Verify on Windows PowerShell:

```powershell
Test-Path "LLM-Prop/data/samples/train_data.csv"
```

## Env variables & MongoDB Atlas
Create `express-server/.env` from the template `express-server/.env.example`.

Required variables:

- `MONGODB_URI` — your MongoDB Atlas connection string (mongodb+srv://...)
- `JWT_SECRET` — random string used to sign JWTs
- `FASTAPI_URL` — e.g. `http://127.0.0.1:8000`
- `PORT` — port for Express (default `5000`)

Atlas quick steps:
1. Create a free cluster at https://www.mongodb.com/atlas
2. Add a Database User (save username/password)
3. Add network access: add your public IP or `0.0.0.0/0` for quick local testing
4. Copy the connection string and paste into `MONGODB_URI` in your `.env`

**Warning:** do NOT commit secrets. Add `.env` to `.gitignore`.

## Run the stack (three terminals)

PowerShell (recommended) — open three terminals and run:

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

Open the UI: `http://localhost:8080/predict`

## Health checks & API tests

FastAPI:

```bash
curl http://127.0.0.1:8000/health
```

Express:

```bash
curl http://127.0.0.1:5000/health
```

Quick predict test (Express proxy):

```bash
curl -X POST http://127.0.0.1:5000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"text":"Rb2NaPrCl6 is perovskite-derived and crystallizes in the cubic Fm-3m space group."}'
```

## Troubleshooting (common issues)

- `Failed to fetch` (frontend): ensure Express and FastAPI are running and `FASTAPI_URL` in `.env` is correct.
- MongoDB connection errors: ensure Atlas IP is whitelisted and `MONGODB_URI` credentials are valid.
- Slow FastAPI health: model loading can take time; wait for `model_loaded: true` in `/health`.
- PowerShell activation blocked: run `(Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned)`.

## Contributing
- Fork, create a feature branch, and open a PR. Keep ML checkpoints and secrets out of VCS.

## License
- See `LICENSE` in the repo root.

---
