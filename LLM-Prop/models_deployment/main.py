import os
import shutil
from pathlib import Path
from typing import Callable, Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from huggingface_hub import hf_hub_download
from pydantic import BaseModel, Field

THRESHOLD = 0.33
predict_all_fn: Optional[Callable[..., Dict[str, object]]] = None
PROJECT_DIR = Path(__file__).resolve().parent.parent
HF_REPO_ID = "asif45/LLM-PROP"
HF_TOKEN = os.getenv("HF_TOKEN")
CHECKPOINT_FILES = {
    "checkpoints/samples/classification/best_checkpoint_for_is_gap_direct.pt": "checkpoints/best_checkpoint_for_is_gap_direct.pt",
    "checkpoints/samples/regression/best_checkpoint_for_energy_per_atom.pt": "checkpoints/best_checkpoint_for_energy_per_atom.pt",
    "checkpoints/samples/regression/best_checkpoint_for_fepa.pt": "checkpoints/best_checkpoint_for_fepa.pt",
    "checkpoints/samples/regression/best_checkpoint_for_band_gap.pt": "checkpoints/best_checkpoint_for_band_gap.pt",
    "checkpoints/samples/regression/best_checkpoint_for_e_above_hull.pt": "checkpoints/best_checkpoint_for_e_above_hull.pt",
    "checkpoints/samples/regression/best_checkpoint_for_volume.pt": "checkpoints/best_checkpoint_for_volume.pt",
}


class PredictRequest(BaseModel):
    text: str = Field(..., description="Crystal description text")


class PredictResponse(BaseModel):
    is_gap_direct: str
    energy_per_atom: float
    formation_energy_per_atom: float
    band_gap: float
    e_above_hull: float
    volume: float


app = FastAPI(title="Crystal Property Predictor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def ensure_checkpoint_files() -> None:
    for local_relative_path, repo_file_path in CHECKPOINT_FILES.items():
        local_path = PROJECT_DIR / local_relative_path
        if local_path.exists():
            continue

        local_path.parent.mkdir(parents=True, exist_ok=True)
        downloaded_path = hf_hub_download(
            repo_id=HF_REPO_ID,
            filename=repo_file_path,
            repo_type="model",
            token=HF_TOKEN,
        )
        shutil.copy2(downloaded_path, local_path)


@app.on_event("startup")
def load_model_once() -> None:
    # Download missing checkpoints first, then import the predictor so it loads the local files once.
    ensure_checkpoint_files()

    global predict_all_fn
    from predict_all import predict_all

    predict_all_fn = predict_all


@app.get("/health")
def health() -> Dict[str, object]:
    return {"status": "ok", "model_loaded": predict_all_fn is not None}


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    if predict_all_fn is None:
        raise HTTPException(status_code=503, detail="Model is not loaded yet")

    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text input cannot be empty")

    predictions = predict_all_fn(text, threshold=THRESHOLD)
    filtered_predictions = {
        "is_gap_direct": predictions["is_gap_direct"],
        "energy_per_atom": predictions["energy_per_atom"],
        "formation_energy_per_atom": predictions["formation_energy_per_atom"],
        "band_gap": predictions["band_gap"],
        "e_above_hull": predictions["e_above_hull"],
        "volume": predictions["volume"],
    }
    return PredictResponse(**filtered_predictions)
