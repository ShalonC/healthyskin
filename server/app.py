from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
import numpy as np
from skimage.color import rgb2lab
from skimage.filters import sobel

from server.ml.peptide_flags import flags_from_list  # NEW

app = FastAPI(title="Derm Peptide App (Step 4)", version="0.0.4")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "step": 4}

# ---------- helpers (same as Step 3) ----------
def melanin_index_rgb(arr: np.ndarray) -> float:
    lab = rgb2lab(arr / 255.0)
    L = lab[..., 0]
    mi = float(np.clip(100.0 - L.mean(), 0.0, 100.0))
    return mi

def erythema_index_rgb(arr: np.ndarray) -> float:
    r = arr[..., 0].astype(np.float32)
    g = arr[..., 1].astype(np.float32)
    ratio = (r + 1.0) / (g + 1.0)
    ei = float(np.clip(100.0 * (ratio.mean() - 1.0), 0.0, 100.0))
    return ei

def texture_roughness(arr: np.ndarray) -> float:
    gray = (0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]).astype(np.float32) / 255.0
    edges = sobel(gray)
    return float(100.0 * edges.mean())

def brightness_mean(arr: np.ndarray) -> float:
    gray = (0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]).astype(np.float32)
    return float(gray.mean())

def pih_risk_proxy(mi: float, ei: float, fitz: int) -> float:
    base = 0.4 * mi + 0.2 * ei + 10.0 * (fitz - 1)
    return float(max(0.0, min(100.0, base)))

def safety_calibration(mi: float, fitz: int, site: str):
    flags = []
    params = {"mn_length_mm": 0.4, "spf_prompt": 0}

    if mi > 35.0 or fitz >= 4:
        params["mn_length_mm"] = 0.2
        params["spf_prompt"] = 1
        flags.append({"code":"LOWER_MN","message":"Higher pigmentation index / Fitzpatrick — use ≤0.2 mm microneedles.","severity":"caution"})

    if site.lower() in ("eye", "periorbital"):
        params["mn_length_mm"] = min(params["mn_length_mm"], 0.2)
        flags.append({"code":"SITE_LIMIT","message":"Peri-orbital area: keep microneedles ≤0.2 mm.","severity":"info"})

    if params["spf_prompt"]:
        flags.append({"code":"SPF","message":"Strict daily SPF recommended to reduce PIH risk.","severity":"info"})

    return flags, params

# ---------- endpoint ----------
@app.post("/analyze")
async def analyze(
    image: UploadFile = File(...),
    age: int = Form(...),
    fitzpatrick: int = Form(...),
    site: str = Form(...),                     # "face", "forearm", "periorbital"
    peptide_list: str = Form(default=""),      # NEW: comma-separated, e.g. "palmitoyl-pentapeptide-4, ghk-cu"
):
    raw = await image.read()
    pil = Image.open(io.BytesIO(raw)).convert("RGB")
    arr = np.array(pil)

    h, w = arr.shape[:2]
    mi = melanin_index_rgb(arr)
    ei = erythema_index_rgb(arr)
    tr = texture_roughness(arr)
    bright = brightness_mean(arr)
    pih = pih_risk_proxy(mi, ei, fitzpatrick)

    safety_flags, params = safety_calibration(mi, fitzpatrick, site)

    # --- NEW: peptide flags + smarter recs ---
    pep_flags = flags_from_list(peptide_list)
    any_over500 = any(p.get("over_500_Da", True) for p in pep_flags.values())
    any_charged  = any(p.get("charged") is True for p in pep_flags.values())
    any_lipidated = any(p.get("lipidated") for p in pep_flags.values())

    recs = []
    # 1) Microneedles recommended when large peptides are present
    if any_over500:
        recs.append({
            "category": "Microneedle",
            "rationale": "Bypass stratum corneum for larger peptides (>500 Da).",
            "parameters": {"length_mm_suggested": params["mn_length_mm"], "frequency": "1x/week"},
            "priority": 1
        })
    # 2) Iontophoresis when any peptide is charged
    if any_charged:
        recs.append({
            "category": "Iontophoresis",
            "rationale": "Drive charged peptides with mild current.",
            "parameters": {"duration_min": 15, "sessions_per_week": 1},
            "priority": 2
        })
    # 3) Vesicular carriers are useful for large or non-lipidated peptides
    if any_over500 or not any_lipidated:
        recs.append({
            "category": "Vesicular Carrier",
            "rationale": "Improve partitioning using ethosomes/niosomes/transferosomes.",
            "parameters": {"daily_use": True},
            "priority": 3
        })
    # 4) Hydration/occlusion if roughness high
    if tr > 8.0:
        recs.append({
            "category": "Hydration & Occlusion",
            "rationale": "Increase SC water content to loosen lipid order slightly.",
            "parameters": {"occlusion_nights_per_week": 2},
            "priority": 4
        })

    return {
        "user_profile": {"age": age, "fitzpatrick": fitzpatrick, "site": site},
        "image_info": {"width": int(w), "height": int(h)},
        "metrics": {
            "melanin_index": round(mi, 2),
            "erythema_index": round(ei, 2),
            "texture_roughness": round(tr, 2),
            "brightness_mean_0_255": round(bright, 2),
            "pih_risk_proxy_0_100": round(pih, 2),
        },
        "peptide_feature_flags": pep_flags,   # NEW
        "safety": safety_flags,
        "ranked_recommendations": recs,
        "message": "shalon metrics + peptide flags + safety calibration computed."
    }
