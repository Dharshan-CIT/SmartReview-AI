export const MAX_REVIEW_CHARS = 2000;

export interface SampleReview {
  label: string;
  category: string;
  text: string;
}

/** Demo inputs only. Predictions always come from the model. */
export const SAMPLES: SampleReview[] = [
  { label: "Laptop", category: "Laptop review",
    text: "The display is beautiful and the keyboard is comfortable, but the battery drains quickly." },
  { label: "Mixed laptop", category: "Laptop review",
    text: "The display is fantastic, the keyboard is comfortable, but the battery life is terrible." },
  { label: "Lightweight", category: "Laptop review",
    text: "The laptop is lightweight, the keyboard is comfortable, and the display is excellent." },
  { label: "Smartphone", category: "Smartphone review",
    text: "The camera quality is excellent but the battery performance is disappointing." },
  { label: "Camera", category: "Camera review",
    text: "The lens is excellent and the zoom is fast, but the menu system is confusing." },
  { label: "Headphones", category: "Headphone review",
    text: "The sound quality is amazing, although the ear cushions are uncomfortable." },
];

/** Demo inputs for the Batch page (sample TEXT only; predictions always come from the model). */
export const BATCH_SAMPLES: string[] = [
  "The display is beautiful and the keyboard is comfortable, but the battery drains quickly.",
  "The battery life is terrible and the fan is loud.",
  "Great screen and fast performance, but the price is too high.",
  "The keyboard feels cheap and the trackpad is unresponsive.",
  "The camera quality is excellent but the battery performance is disappointing.",
  "The sound quality is amazing, although the ear cushions are uncomfortable.",
  "The lens is excellent and the zoom is fast, but the menu system is confusing.",
  "The screen is bright and the speaker is loud, but the software is buggy.",
  "The laptop is lightweight, the keyboard is comfortable, and the display is excellent.",
  "The storage is huge and the price is reasonable, but the battery is poor.",
];

/** Two small review sets for the Compare page demo (input text only). */
export const COMPARE_SAMPLES = {
  a: [
    "The screen is gorgeous and the keyboard is comfortable.",
    "The battery life is terrible and the fan is loud.",
    "Great display, but the price is too high.",
    "The speakers are weak, but the screen is excellent.",
  ],
  b: [
    "The battery lasts all day and the price is reasonable.",
    "The keyboard feels cheap and the screen is dim.",
    "The performance is fast, and the fan is quiet.",
    "The battery is great, but the speakers are tinny.",
  ],
};
