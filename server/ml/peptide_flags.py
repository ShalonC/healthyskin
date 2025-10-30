from dataclasses import dataclass
from typing import Dict

@dataclass
class PeptideInfo:
    name: str
    lipidated: bool
    net_charge: str      # "positive" | "negative" | "neutral" | "unknown"
    is_skp: bool         # skin-penetrating peptide
    approx_mw: int       # Daltons (rough; for demo rules)

# Seed knowledge base (expand later)
PEPTIDE_KB: Dict[str, PeptideInfo] = {
    "palmitoyl-pentapeptide-4": PeptideInfo("palmitoyl-pentapeptide-4", True,  "neutral", False, 802),
    "ghk-cu":                   PeptideInfo("ghk-cu",                   False, "positive", False, 403),
    "acetyl-hexapeptide-8":     PeptideInfo("acetyl-hexapeptide-8",     False, "neutral", False, 889),
    "matrixyl-3000":            PeptideInfo("matrixyl-3000",            True,  "neutral", False, 1000),
    # Example skin-penetrating peptide placeholder (for future expansion)
    "td-1":                     PeptideInfo("td-1",                     False, "neutral", True,  1200),
}

def flags_from_list(csv_names: str) -> Dict[str, dict]:
    """
    Parse a comma-separated list and produce feature flags for each peptide.
    Unknown peptides get cautious defaults (assume >500 Da).
    """
    out: Dict[str, dict] = {}
    names = [s.strip().lower() for s in csv_names.split(",") if s.strip()]
    for raw in names:
        info = PEPTIDE_KB.get(raw)
        if info:
            out[raw] = {
                "lipidated": info.lipidated,
                "charged": info.net_charge in ("positive", "negative"),
                "net_charge": info.net_charge,
                "is_skp": info.is_skp,
                "over_500_Da": info.approx_mw > 500,
                "approx_mw": info.approx_mw
            }
        else:
            out[raw] = {
                "lipidated": False,
                "charged": "unknown",
                "net_charge": "unknown",
                "is_skp": False,
                "over_500_Da": True,   # cautious default
                "approx_mw": 600
            }
    return out

