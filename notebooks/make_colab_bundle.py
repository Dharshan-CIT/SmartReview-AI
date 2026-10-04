"""Build colab_bundle.zip (code + processed data) and the Colab notebook.

Run from the project root:  python notebooks/make_colab_bundle.py
Upload colab_bundle.zip (the file ending in .zip) when the notebook asks for it.
"""
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

with zipfile.ZipFile(ROOT / "colab_bundle.zip", "w", zipfile.ZIP_DEFLATED) as z:
    files = list((ROOT / "ml").rglob("*.py"))
    files += list((ROOT / "data" / "processed").glob("*.json"))
    files += list((ROOT / "data" / "processed_md").glob("*.json"))
    for p in files:
        if "__pycache__" not in p.parts:
            z.write(p, p.relative_to(ROOT).as_posix())
print("Wrote colab_bundle.zip")


def code(src: str) -> dict:
    return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [],
            "source": src.strip("\n").splitlines(keepends=True)}


def md(src: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": src.strip("\n").splitlines(keepends=True)}


cells = [
    md("# SmartReview AI: multi-domain training (laptop + phone + camera/DVD/phone reviews) on a Colab GPU\n"
       "**Before running:** Runtime > Change runtime type > **T4 GPU**. "
       "Run every cell top to bottom (about 15 minutes)."),
    code("import torch\n"
         "print('GPU available:', torch.cuda.is_available())\n"
         "print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NO GPU - change the runtime type!')"),
    code("!pip -q install transformers==5.17.0"),
    md("## Upload `colab_bundle.zip` (the file ending in .zip)"),
    code("from google.colab import files\n"
         "files.upload()\n"
         "!unzip -o -q colab_bundle.zip\n"
         "!ls data/processed_md"),
    md("## 1. Train ATE on all domains"),
    code("!python -m ml.train_ate --data-dir data/processed_md --epochs 4 --out-dir models/ate_md"),
    md("## 2. Train ATSC on all domains (aspect-marked input)"),
    code("!python -m ml.train_atsc --data-dir data/processed_md --mark-aspect --epochs 4 --out-dir models/atsc_md"),
    md("## 3. Evaluate on 5 test sets (laptop, phone, seen products, and 2 products never seen in training)"),
    code("!python -m ml.eval_cross_domain --name multi_domain --ate models/ate_md --atsc models/atsc_md"),
    md("## 4. Download the results (about 900 MB)"),
    code("!zip -r -q multi_domain.zip models/ate_md models/atsc_md docs/results\n"
         "files.download('multi_domain.zip')"),
]
nb = {"cells": cells,
      "metadata": {"accelerator": "GPU", "kernelspec": {"name": "python3", "display_name": "Python 3"}},
      "nbformat": 4, "nbformat_minor": 5}
(ROOT / "notebooks" / "train_colab.ipynb").write_text(json.dumps(nb, indent=1), encoding="utf-8")
print("Wrote notebooks/train_colab.ipynb")
