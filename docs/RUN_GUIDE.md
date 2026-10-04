# How to run SmartReview AI (demo guide)

## Fastest: one double-click
Double-click **`start_app.bat`** in the project folder. It opens two windows (backend and frontend), waits about
12 seconds, then opens the app at http://127.0.0.1:5173.
Close the two black windows to stop the app.

## Manual (two terminals, from the project folder)
```bash
# Terminal 1: API  (loads both BERT models, takes a few seconds)
venv\Scripts\python.exe -m uvicorn backend.app.main:app --port 8000

# Terminal 2: web app
cd frontend
npm run dev
```
Open http://127.0.0.1:5173. Interactive API docs: http://127.0.0.1:8000/docs

## Before the demo: 60-second checklist
1. Top right of the app should say **"Models ready"** (green dot). If it says "API offline", start the backend.
2. Open **Analyzer**, click **Mixed laptop**, then **Analyze review**. You should see MIXED with ✓ and ✕ highlights.
3. Open **Analytics** and **History**; they fill up as you analyze reviews.
4. Press **Alt + Shift + M** (or go to `/model`) to open the hidden **Model** page with the measured test results and confusion matrix.

## New pages worth showing
* **Batch**: click *Load sample reviews*, then *Analyze 10 reviews*. Shows a feature-level report; *Export CSV* downloads it. You can also upload a `.txt` or `.csv` (a `review` / `text` column is used).
* **Compare**: click *Load sample reviews*, then *Compare products*. Shows which product wins on each shared feature.
* **Analyzer > Play demo**: runs every example one after another (about 4 seconds each), good for a hands-free demo. *Stop demo* ends it.
* **Analyzer > Show probability breakdown** on any aspect card: the model's probabilities for positive / neutral / negative.
* **Analytics**: click a bar to jump to the reviews that mention that feature.

## Suggested 5-minute demo flow
1. **Splash and landing**: the problem (one score hides which feature customers dislike).
2. **Analyzer**: run "Mixed laptop", hover a highlighted aspect (tooltip with confidence), point out the ⚠ low-confidence flag if one appears.
3. Run the **Headphones** or **Smartphone** example and say honestly: *trained on laptops, so other products are less accurate*.
4. **Analytics**: most praised / most criticised feature, sentiment distribution.
5. **Model page (Alt + Shift + M)**: pipeline, BIO tagging, measured metrics, confusion matrix, limitations.

## Retraining (optional)
```bash
python -m ml.preprocessing.prepare_data
python -m ml.train_ate --epochs 5
python -m ml.train_atsc --mark-aspect --epochs 4     # aspect-marked input (see docs/EXPERIMENTS.md)
python -m ml.evaluate_ate
python -m ml.evaluate_atsc
```
A GPU (or Colab, `notebooks/train_colab.ipynb`) is much faster than CPU.

## Troubleshooting
| Problem | Fix |
|---|---|
| Header says "API offline" | Start the backend (`start_backend.bat`) and refresh |
| Header says "Models not loaded" | `models/ate` and `models/atsc` must contain `model.safetensors` and `config.json` |
| Port already in use | Close old server windows, or change the port in the `.bat` files |
| `npm` not found | Install Node.js (v22 LTS or newer) |
| First analysis is slow | Only the first request warms up the model; later ones take about 0.2 s |
| Want a clean history for the demo | Stop the backend, delete `backend/smartreview.db`, start again |
