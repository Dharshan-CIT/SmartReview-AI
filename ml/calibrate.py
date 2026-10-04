"""Temperature-scale the ATSC model so its confidence is honest.

    python -m ml.calibrate

Fine-tuned BERT is usually OVER-confident (99% even when wrong). Temperature scaling divides the logits by one number T > 0
before the softmax. T is fitted on the VALIDATION set only (minimising negative log-likelihood), then Expected Calibration Error
(ECE) is measured on the untouched TEST sets before and after. The predicted class never changes, only the confidence.
T is stored in models/atsc/absa_config.json and applied by ml.inference.
"""
import json
import warnings

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

warnings.filterwarnings("ignore")

from ml import config  # noqa: E402
from ml.train_atsc import ID2LABEL, LABEL2ID, build_examples, read_mark_flag  # noqa: E402
from ml.utils import get_device, load_split, save_json  # noqa: E402

DATA = config.ROOT / "data" / "processed_md"
TESTS = ["test_laptop", "test_phone", "test_hl_seen", "test_unseen_camera", "test_unseen_mp3"]
MODEL_DIR = config.ATSC_MODEL_DIR


@torch.no_grad()
def logits_for(model, tok, examples, device, batch=32):
    order = sorted(range(len(examples)), key=lambda i: len(examples[i]["text"]))
    out = torch.zeros(len(examples), len(LABEL2ID))
    for s in range(0, len(order), batch):
        idx = order[s:s + batch]
        enc = tok([examples[i]["text"] for i in idx], [examples[i]["aspect"] for i in idx], truncation="only_first",
                  max_length=config.MAX_LEN, padding=True, return_tensors="pt").to(device)
        out[idx] = model(**enc).logits.cpu()
    return out, torch.tensor([e["label"] for e in examples])


def ece(probs: torch.Tensor, labels: torch.Tensor, bins: int = 10) -> float:
    conf, pred = probs.max(1)
    correct = (pred == labels).float()
    edges = torch.linspace(0, 1, bins + 1)
    total = 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.any():
            total += m.float().mean().item() * abs(correct[m].mean().item() - conf[m].mean().item())
    return total


def fit_temperature(logits: torch.Tensor, labels: torch.Tensor) -> float:
    log_t = torch.zeros(1, requires_grad=True)  # optimise log T so T stays positive
    opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=200)

    def closure():
        opt.zero_grad()
        loss = torch.nn.functional.cross_entropy(logits / log_t.exp(), labels)
        loss.backward()
        return loss

    opt.step(closure)
    return float(log_t.exp())


def main() -> None:
    device = get_device()
    tok = AutoTokenizer.from_pretrained(MODEL_DIR)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR).to(device).eval()
    mark = read_mark_flag(MODEL_DIR)

    val_logits, val_labels = logits_for(model, tok, build_examples(load_split("val", DATA), mark), device)
    T = fit_temperature(val_logits, val_labels)
    nll_before = torch.nn.functional.cross_entropy(val_logits, val_labels).item()
    nll_after = torch.nn.functional.cross_entropy(val_logits / T, val_labels).item()
    print(f"fitted temperature T = {T:.3f}  (validation NLL {nll_before:.4f} -> {nll_after:.4f})")

    report = {"temperature": round(T, 4), "validation_nll_before": round(nll_before, 4), "validation_nll_after": round(nll_after, 4), "test": {}}
    all_logits, all_labels = [], []
    print(f"{'test set':20s} {'n':>5s} {'ECE before':>11s} {'ECE after':>10s} {'mean conf before':>17s} {'mean conf after':>16s} {'accuracy':>9s}")
    for name in TESTS:
        lg, lb = logits_for(model, tok, build_examples(load_split(name, DATA), mark), device)
        all_logits.append(lg)
        all_labels.append(lb)
        p0, p1 = lg.softmax(1), (lg / T).softmax(1)
        acc = (p0.argmax(1) == lb).float().mean().item()
        report["test"][name] = {"n": len(lb), "ece_before": round(ece(p0, lb), 4), "ece_after": round(ece(p1, lb), 4),
                                "mean_conf_before": round(p0.max(1).values.mean().item(), 4), "mean_conf_after": round(p1.max(1).values.mean().item(), 4),
                                "accuracy": round(acc, 4)}
        r = report["test"][name]
        print(f"{name:20s} {r['n']:5d} {r['ece_before']:11.4f} {r['ece_after']:10.4f} {r['mean_conf_before']:17.3f} {r['mean_conf_after']:16.3f} {r['accuracy']:9.3f}")
    lg, lb = torch.cat(all_logits), torch.cat(all_labels)
    report["test_all"] = {"n": len(lb), "ece_before": round(ece(lg.softmax(1), lb), 4), "ece_after": round(ece((lg / T).softmax(1), lb), 4)}
    print(f"ALL TEST SETS n={report['test_all']['n']}: ECE {report['test_all']['ece_before']:.4f} -> {report['test_all']['ece_after']:.4f}")

    cfg_path = MODEL_DIR / "absa_config.json"
    cfg = json.loads(cfg_path.read_text()) if cfg_path.exists() else {}
    cfg["mark_aspect"] = bool(mark)
    cfg["temperature"] = round(T, 4)
    save_json(cfg, cfg_path)
    save_json(report, config.ROOT / "docs" / "results" / "calibration.json")
    print("saved temperature to", cfg_path)


if __name__ == "__main__":
    main()
