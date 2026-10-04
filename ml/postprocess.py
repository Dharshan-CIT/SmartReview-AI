"""Rule-based refinements around the two BERT models. Every rule here was MEASURED on the held-out test sets
(see docs/EXPERIMENTS.md); none of them changes how the models are trained.

1. clean_spans(text, spans)  : tidy aspect terms the extractor produced ("battery drains" -> "battery",
                               "the screen" -> "screen") and drop terms that are not product features
                               ("recommend", "buy", "do not").
2. flag_mild_wording(...)   : detects clearly MILD wording in the clause of an aspect ("The keyboard is okay") and adds a
                               `hint` ("could also be read as neutral"). The LABEL IS NOT CHANGED: on real annotated reviews
                               "ok/okay" is labelled positive far more often than neutral (see docs/EXPERIMENTS.md), so forcing
                               neutral lowered accuracy. The rejected rule that DOES force neutral lives in
                               `ml/experiments/rejected_rules.py` (kept only so that experiment can be reproduced).
"""
import re

# ---------------------------------------------------------------------------- aspect clean-up
LEADING = {"the", "a", "an", "my", "your", "its", "his", "her", "our", "their", "this", "that", "these", "those", "of"}
TRAILING = {
    "is", "are", "was", "were", "be", "been", "seems", "seem", "looks", "look", "feels", "feel", "sounds", "sound",
    "works", "work", "runs", "run", "drains", "drain", "dies", "die", "died", "lasts", "last", "breaks", "broke",
    "fails", "failed", "crashes", "freezes", "overheats", "heats", "charges", "loads", "connects", "has", "have", "had",
    "does", "do", "did", "can", "could", "will", "would", "gets", "get", "got", "also", "very", "so", "too", "really",
}
GENERIC = {
    "recommend", "recommended", "recommends", "buy", "bought", "buying", "purchase", "purchased", "love", "loved", "like",
    "liked", "do", "not", "don't", "dont", "it", "this", "that", "they", "product", "item", "thing", "things",
    "everything", "nothing", "something", "overall", "order", "ordered", "i", "we", "you", "one", "ones", "got", "get",
    "happy", "satisfied", "pleased", "great", "good", "bad", "nice", "well", "much", "way",
}
_WORD = re.compile(r"[\w'-]+")


def clean_spans(text: str, spans: list[dict], drop_generic: bool = True) -> list[dict]:
    """Trim determiners / trailing verbs from aspect spans, drop non-feature terms, remove duplicates.

    Each span is {"term"|"text", "start", "end"}; the returned spans keep the same keys and true character offsets."""
    out, seen = [], set()
    for sp in spans:
        start, end = sp["start"], sp["end"]
        words = [(m.start() + start, m.end() + start) for m in _WORD.finditer(text[start:end])]
        while len(words) > 1 and text[words[0][0]:words[0][1]].lower() in LEADING:
            words.pop(0)
        while len(words) > 1 and text[words[-1][0]:words[-1][1]].lower() in TRAILING:
            words.pop()
        if not words:
            continue
        s, e = words[0][0], words[-1][1]
        term = text[s:e]
        toks = [t.lower() for t in _WORD.findall(term)]
        if not toks or len(term) < 2 or (drop_generic and all(t in GENERIC or t in LEADING for t in toks)):
            continue
        if (s, e) in seen:
            continue
        seen.add((s, e))
        new = dict(sp)
        new.update(start=s, end=e)
        for key in ("term", "text"):
            if key in sp:
                new[key] = term
        out.append(new)
    return out


# ---------------------------------------------------------------------------- mild wording
MILD = [
    "okay", "ok", "alright", "all right", "average", "so-so", "so so", "acceptable", "adequate", "passable", "middling",
    "nothing special", "nothing remarkable", "not remarkable", "just fine", "fair enough", "mediocre but usable", "fair",
]
STRONG = {
    "great", "excellent", "amazing", "fantastic", "superb", "wonderful", "brilliant", "awesome", "perfect", "love", "loved",
    "terrible", "awful", "horrible", "worst", "hate", "hated", "useless", "disappointing", "poor", "bad", "flimsy", "broken",
    "best", "incredible", "outstanding", "beautiful", "gorgeous", "lovely", "impressive", "fast", "slow", "cheap", "junk",
    "garbage", "unusable", "sucks", "crap", "faulty", "defective", "comfortable", "uncomfortable", "reliable", "unreliable",
    "sharp", "crisp", "clear", "blurry", "loud", "quiet", "smooth", "laggy", "sturdy", "solid",
}
# "and" only starts a new clause when a new subject follows ("... okay and the display is excellent"), not in "okay and excellent".
_CLAUSE_SPLIT = re.compile(
    r"[,;:!?.]|\b(?:but|although|though|however|while|whereas|yet)\b|\band\b(?=\s+(?:the|a|an|my|its|it|this|these|i)\b)",
    re.IGNORECASE,
)
_NEGATION = re.compile(r"\b(?:not|n't|never|no)\b", re.IGNORECASE)


def _clause(text: str, start: int, end: int) -> str:
    """The clause (split on punctuation and contrast words) that contains the aspect."""
    pos = 0
    for m in _CLAUSE_SPLIT.finditer(text):
        if m.start() >= end:
            break
        if m.end() <= start:
            pos = m.end()
    nxt = _CLAUSE_SPLIT.search(text, end)
    return text[pos:(nxt.start() if nxt else len(text))]


def mild_wording(text: str, start: int, end: int) -> str | None:
    """Return the mild word/phrase if the aspect's clause expresses ONLY mild wording, else None."""
    clause = _clause(text, start, end).lower()
    clause = clause.replace(text[start:end].lower(), " ", 1)
    words = set(_WORD.findall(clause))
    if words & STRONG:
        return None
    for phrase in MILD:
        if re.search(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", clause):
            if _NEGATION.search(clause) and phrase in {"acceptable", "adequate", "fair", "okay", "ok", "alright", "average"}:
                return None  # "not okay", "not acceptable" are negative, not mild
            return phrase
    return None


def flag_mild_wording(text: str, aspects: list[dict]) -> list[dict]:
    """Add a `hint` to aspects whose only opinion is a mild word. Sentiment and confidence stay exactly as the model produced them."""
    for a in aspects:
        word = mild_wording(text, a["start"], a["end"])
        if word:
            a["hint"] = f"mild wording ({word})"
    return aspects
