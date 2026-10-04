"""Central configuration for the ML pipeline. No paths or hyper-parameters are hard-coded elsewhere."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

RAW_FILE = ROOT / "data" / "raw" / "Laptop_Train_v2.xml"
PROCESSED_DIR = ROOT / "data" / "processed"
ATE_MODEL_DIR = ROOT / "models" / "ate"
ATSC_MODEL_DIR = ROOT / "models" / "atsc"

SEED = 42
BASE_MODEL = "bert-base-uncased"
MAX_LEN = 128

# 80 / 10 / 10 sentence-level split (10-fold grouped: 1 fold test, 1 fold val)
N_SPLITS = 10

# ATE labels (BIO)
ATE_LABELS = ["O", "B-ASP", "I-ASP"]
# ATSC labels; 'conflict' is excluded (see prepare_data.py)
ATSC_LABELS = ["negative", "neutral", "positive"]
