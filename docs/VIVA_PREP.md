# SmartReview AI: Viva Preparation

Answers are written to be *said out loud*. Where a number is needed (F1, accuracy…), quote it from
`models/ate/test_metrics.json` and `models/atsc/test_metrics.json`, never from memory.

---

## 1. Machine learning

**What is sentiment analysis?** Deciding whether text expresses a positive, negative or neutral opinion.

**What is ABSA?** Aspect-Based Sentiment Analysis. Instead of one label for a whole review, it finds each
*aspect* (product feature) and gives *its own* sentiment. "Great screen, awful battery" → screen: positive,
battery: negative. A whole-review classifier would have to pick one and lose information.

**What is ATE?** Aspect Term Extraction: find the words that name a feature ("battery life"). We model it as
token classification: every word gets a BIO tag.

**What is ATSC?** Aspect Term Sentiment Classification: given the review and one aspect, predict
positive / neutral / negative *toward that aspect*.

**What is BIO tagging?** B-ASP = first word of an aspect, I-ASP = continuation, O = not part of an aspect.
"battery life" → B-ASP, I-ASP. Without B/I the model could not tell two adjacent aspects from one long one.

**What is BERT?** A Transformer *encoder* pre-trained on a huge corpus with masked-word prediction. It produces
a context-aware vector for each token: the vector for "cold" differs in "cold coffee" and "cold shoulder".

**Why BERT?** (1) Context-aware representations are exactly what aspect-level sentiment needs. (2) Pre-training
lets us reach good accuracy from only ~2,000 labelled sentences (transfer learning). Alternatives: LSTM/CRF
(needs more data, weaker context), TF-IDF + SVM (no word order, cannot do ATE).

**What is a Transformer / attention?** A network built from self-attention layers. Attention lets every word
weigh every other word when building its representation, so "battery" can "look at" "terrible" several words
away, with no recurrence and full parallelism.

**What is token classification vs sequence classification?** Token classification gives one label per token
(ATE). Sequence classification gives one label for the whole input (ATSC).

**What is fine-tuning / transfer learning?** Start from pre-trained weights and continue training on our small
labelled task with a small learning rate (3e-5 / 2e-5). Knowledge of English is transferred; only the task is learned.

**Why sentence-pair input for ATSC?** `[CLS] review [SEP] aspect [SEP]`. The model must know *which* aspect to
judge; with only the review, "great screen but terrible battery" has no single correct label.

**How are subwords handled?** BERT splits rare words ("touchpad" → "touch", "##pad"). Only the first subword of
each word carries the label; the rest get -100, which the loss ignores. We use the tokenizer's `word_ids()`
and character offsets to align labels; we never guess by string matching.

**What loss / optimizer?** Cross-entropy; AdamW with weight decay, linear warm-up then linear decay, gradient
clipping at 1.0. ATSC uses class weights (inverse frequency) because Neutral is the minority class.

**Why did you pick the best epoch by validation F1?** To avoid over-fitting: we keep the checkpoint that
generalises best to unseen validation data, not the last one.

## 2. Dataset

**Why SemEval-2014 Task 4?** It is the standard academic benchmark for ABSA: human-annotated aspect terms,
character offsets and polarity, so results are comparable to published work.

**Dataset size?** Read from `data/processed/split_report.json`. Raw file: 3,045 sentences, 2,358 aspect
annotations (positive 987, negative 866, neutral 460, conflict 45). We drop `conflict` for ATSC → 2,313 aspects.
(Numbers measured by `ml/explore_data.py`.)

**Classes?** ATSC: negative, neutral, positive. ATE: O, B-ASP, I-ASP.

**Why keep conflict aspects in ATE but drop them in ATSC?** They *are* real aspect terms, so labelling them O
would teach the extractor the wrong thing. They have no clean 3-class polarity, so ATSC excludes them.

**Preprocessing?** Parse XML → normalise whitespace (non-breaking spaces, runs of spaces) *while remapping the
character offsets* → validate every span equals `text[from:to]` → BIO tags → split.

**How did you avoid data leakage?** A sentence can carry several aspects (and 12 sentence texts appear twice).
A random split over aspect rows would put "battery" from a sentence in train and "screen" from the *same
sentence* in test, so the model would have seen the test text. We split by sentence with `StratifiedGroupKFold`,
grouping on the sentence text, and the script asserts no text is shared between splits.

**Why no official test set?** The mirror we used has no gold-labelled test file, so we made our own
80/10/10 sentence-level split (fixed seed). This is stated openly; numbers are not comparable to leaderboard
results that use the official test set.

**Did you train only on laptops? Does it work on all products?** First on laptops, then I added phone reviews (M-ABSA) and camera / phone / DVD
reviews (Hu & Liu 2004). I kept a Nikon camera and an MP3 player completely out of training to test transfer to unseen products. Multi-domain
training improved sentiment accuracy on every non-laptop set by 5 to 7 points and aspect finding by 3 to 14 points, but laptop aspect-finding
fell about 7 points. So the honest claim is "electronics-type products that we tested", not "all products". Numbers: `docs/EXPERIMENTS.md`.

**Why was a special experiment needed for sentiment (aspect marking)?** Testing real sentences showed that in "keyboard is comfortable, but the
battery is terrible" the negative clause leaked onto the keyboard. Wrapping the aspect in `<< >>` tells the model which mention to judge. It fixed
those cases on a small hand-made set but the overall laptop test score was unchanged.

## 3. Evaluation

**Why not just accuracy?** In ATE ~93 % of words are "O": predicting all O would score ~93 % accuracy and find
nothing. In ATSC the classes are imbalanced. So we report P / R / F1.

**Precision / recall / F1?** Precision = of predicted positives, how many were correct. Recall = of true
positives, how many we found. F1 = their harmonic mean.

**Why Macro F1?** It averages F1 over classes with equal weight, so the small Neutral class matters as much as
Positive. Plain (micro) F1 or accuracy would hide poor Neutral performance.

**Exact vs partial match in ATE?** Exact: predicted span identical to gold. Partial: overlaps a gold span.
Exact is the strict standard; partial shows how often we are "nearly right" (boundary errors).

**Confusion matrix?** Rows = true class, columns = predicted class; the diagonal is correct predictions,
off-diagonal cells show *which* classes get confused (typically Neutral ↔ others).

**Where does "confidence" come from?** The softmax probability of the predicted class from the ATSC model. It is a
model probability, not a guarantee of correctness.

**Why is "The keyboard is okay" not Neutral? Did you try to fix it?** Yes. I wrote a rule that forced "okay / average / so-so" to Neutral and it looked great on
sentences I generated myself (49% to 90%). But on real annotated reviews it made things worse (on validation: fixed 0, broke 8; on test: fixed 3, broke 14).
Looking at the human labels showed why: "ok" is labelled positive 67% of the time and neutral only 10%. So I did not ship the rule. The interface keeps the model's
label and adds a note ("mild wording, could also be read as neutral"). The lesson: test a fix on real held-out data, not on data that encodes your own assumption.

**What is calibration and what did you gain?** Fine-tuned BERT is over-confident (about 97% confidence at about 90% accuracy). Temperature scaling divides the
logits by one number T (fitted on the validation set only, T = 1.785). Predictions do not change; the confidence becomes honest. Expected Calibration Error on the
test sets fell from 0.076 to 0.034. It is not perfect (the small camera set got slightly worse).

**How do you stop the system from answering when it cannot?** Non-English text and text without words are rejected with a clear message; reviews that look like clothing or food
get an out-of-scope warning; low-confidence answers are flagged; and a hand-written golden set (72/75 correct) is part of the tests, so a regression fails the build.

## 4. Software

**Why FastAPI?** Async-capable, automatic validation via Pydantic, free interactive docs at `/docs`, and Python
so the same process can run PyTorch directly.

**Why React + TypeScript?** Component reuse for cards/charts/tables; TypeScript catches API-shape mistakes at
compile time. **Tailwind** keeps the design system consistent. **Recharts** for the charts.

**Why SQLite?** Zero setup, a single file, plenty for review history and analytics. SQLAlchemy would let us move
to PostgreSQL by changing one URL.

**How do frontend and backend talk?** The browser calls `POST /api/analyze` with JSON; FastAPI validates it,
runs the pipeline, stores the result and returns JSON. In development Vite proxies `/api` to port 8000.

**How are models loaded?** Once, at server start (lifespan hook), into a singleton, then `model.eval()` and
`torch.no_grad()` for each request. Uses CUDA if present, otherwise CPU. If model files are missing the server
still starts and `/api/analyze` returns a clear 503.

**How is the UI kept accessible?** Semantic HTML, labelled inputs, visible focus, skip link, keyboard-focusable
highlights, and sentiment is always shown as icon + text + colour (✓ Positive, ✕ Negative, – Neutral).

**How did you make it fast?** Reviews are tokenized, sorted by length and padded per batch, so one model call handles 16 to 32 reviews
(about 1.9x faster on CPU with identical predictions, checked by a test). A small LRU cache returns repeated reviews instantly, the models are warmed
up at server start, and the website lazy-loads heavy pages (main JavaScript bundle 713 kB down to 305 kB).

**Is the CSV export safe?** Cells that start with = + - or @ are prefixed with a quote so a spreadsheet cannot run them as formulas (CSV injection).

## 5. Real-world

**Who would use it?** E-commerce sellers, product managers and support teams who need to know *which feature*
drives complaints or praise.

**Limitations (say them; it earns marks):** tested only on laptops, phones, cameras, MP3/DVD players (not headphones or other products); aspect finding on non-laptop products is weaker, and
the annotation of the extra datasets is incomplete; small dataset; implicit aspects ("it dies in an hour") are missed; sarcasm; two-stage pipeline
means ATE boundary errors propagate to ATSC; Neutral is the hardest class; if the same aspect word appears twice
in a review, the sentence-pair input does not say *which* occurrence.

**Scaling to production?** Serve the model behind a queue with batching and a GPU, cache repeated reviews,
move SQLite → PostgreSQL, add authentication and monitoring.

**Extending to Amazon/Flipkart reviews?** Ingest reviews through official/licensed APIs or datasets, fine-tune on
labelled data from those domains (or multilingual BERT for Indian languages), and re-evaluate. Never claim the
laptop-trained model is accurate on other domains without measuring it.
