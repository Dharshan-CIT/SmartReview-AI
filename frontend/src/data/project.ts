/**
 * EDIT THIS FILE to put your own details on the hidden project page (press Alt + Shift + M).
 * Replace every "TODO" text. Nothing else in the app needs to change.
 * If you leave a field as an empty string "", that line is simply not shown.
 */
export interface TeamMember {
  name: string;
  rollNumber: string;
  role: string;
}

export const PROJECT = {
  title: "SmartReview AI: Multi-Aspect Sentiment Analysis on E-Commerce Product Reviews Using BERT and Machine Learning",
  team: [
    { name: "TODO: Team member 1 name", rollNumber: "TODO: roll number", role: "TODO: e.g. ML models and evaluation" },
    { name: "TODO: Team member 2 name", rollNumber: "TODO: roll number", role: "TODO: e.g. Backend and frontend" },
  ] as TeamMember[],
  guide: "TODO: Guide / faculty name",
  institution: "TODO: Your university / college",
  department: "Department of Artificial Intelligence and Machine Learning",
  programme: "B.E. / B.Tech, Artificial Intelligence and Machine Learning",
  course: "Project-Based Learning (PBL)",
  academicYear: "TODO: e.g. 2026-27, Semester 3",
  github: "", // e.g. "https://github.com/your-name/smartreview-ai"
  contact: "", // e.g. "yourname@example.com"
};

export const isPlaceholder = (v: string) => v.startsWith("TODO");
