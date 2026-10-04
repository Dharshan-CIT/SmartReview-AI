"""Input guards: refuse text the models cannot read, and warn when a review is outside what was tested.

The models are English-only (bert-base-uncased vocabulary) and were trained/tested on laptops, phones, cameras,
MP3 players and DVD players. These checks stop the system from answering confidently about things it cannot judge.
"""
import re

NON_ENGLISH_MESSAGE = "Please write the review in English. This tool only understands English text."
NO_WORDS_MESSAGE = "The review needs some words to analyze."
OUT_OF_SCOPE_MESSAGE = (
    "This review looks like it is about a kind of product the models were not tested on (for example clothing, food or hotels). "
    "The results may be unreliable."
)

# Words that strongly suggest a non-electronics product. Words that are also common in electronics reviews are left out on purpose
# (for example "menu", "fits", "size", "staff").
OFF_TOPIC = {
    "shirt", "tshirt", "t-shirt", "dress", "jeans", "shoes", "sneakers", "fabric", "sleeves", "stitching", "delicious", "tasty",
    "flavor", "flavour", "recipe", "restaurant", "waiter", "waitress", "hotel", "breakfast", "perfume", "shampoo", "lotion",
    "furniture", "sofa", "mattress", "toys", "toy", "dishwasher-safe", "pizza", "coffee", "chocolate",
}
ELECTRONICS = {
    "battery", "screen", "display", "camera", "laptop", "phone", "keyboard", "charger", "speaker", "speakers", "headphones",
    "bluetooth", "wifi", "lens", "zoom", "storage", "processor", "trackpad", "touchscreen", "resolution", "ram", "usb", "cable",
    "software", "app", "sound", "mic", "microphone", "camera", "player", "dvd", "mp3", "memory", "ports", "fan", "mouse",
}
_WORD = re.compile(r"[a-z][a-z'-]*")


def language_error(text: str) -> str | None:
    """A message if the text cannot be analyzed at all, otherwise None."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return NO_WORDS_MESSAGE
    latin = sum(1 for c in letters if ord(c) <= 0x024F)  # Basic Latin .. Latin Extended-B
    if len(letters) >= 4 and latin / len(letters) < 0.7:
        return NON_ENGLISH_MESSAGE
    return None


def scope_warnings(text: str) -> list[str]:
    """Soft warnings (the analysis still runs)."""
    words = set(_WORD.findall(text.lower()))
    if words & OFF_TOPIC and not words & ELECTRONICS:
        return [OUT_OF_SCOPE_MESSAGE]
    return []
