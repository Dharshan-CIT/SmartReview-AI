"""Run sample reviews through the full ABSA pipeline and print what it really predicts.

    python -m ml.demo_samples
"""
import time
import warnings

warnings.filterwarnings("ignore")

from ml.inference import ABSAPipeline  # noqa: E402

SAMPLES = [
    "The display is fantastic.",
    "The battery life is terrible.",
    "The keyboard is okay.",
    "The screen is beautiful but the battery drains quickly.",
    "The laptop is lightweight, the keyboard is comfortable, and the display is excellent.",
    "I love it so much, highly recommend!",
    "The display is beautiful and the keyboard is comfortable, but the battery drains quickly.",
    "The camera quality is excellent but the battery performance is disappointing.",
    "The sound quality is amazing, although the ear cushions are uncomfortable.",
    "The display is fantastic, the keyboard is comfortable, but the battery life is terrible.",
    "The camera takes sharp photos in daylight but the battery dies after a few hours.",
    "The screen is bright and the battery lasts two days, but the speaker is tinny.",
    "The lens is excellent and the zoom is fast, but the menu system is confusing.",
    "Sound quality is great and the storage is huge, but the software is buggy.",
    "The ear cushions are comfortable but the bass is weak and the price is too high.",
    "The Zorblax is great.",
    "a " * 300,
]

if __name__ == "__main__":
    t0 = time.time()
    pipe = ABSAPipeline()
    print(f"models loaded in {time.time() - t0:.1f}s on {pipe.device}")
    for s in SAMPLES:
        t = time.time()
        r = pipe.analyze(s)
        print(f"\n{s[:90]!r}  [{(time.time() - t) * 1000:.0f} ms]  overall={r['overall_sentiment']}")
        for a in r["aspects"]:
            print(f"   {a['text']:<22} {a['sentiment']:<9} {a['confidence']:.3f}  {a['probabilities']}")
