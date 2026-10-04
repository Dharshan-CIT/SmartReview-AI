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
    { name: "S Dharshan", rollNumber: "210425148091", role: "Backend" },
    { name: "Mohammed Irfan AR", rollNumber: "210425148066", role: "Frontend" },
  ] as TeamMember[],
  guide: "Mr. R. Thirumalai Murugan, M.E.",
  institution: "Chennai Institute of Technology",
  department: "Department of Artificial Intelligence and Machine Learning",
  programme: "B.E. / B.Tech, Artificial Intelligence and Machine Learning",
  course: "Project-Based Learning (PBL)",
  academicYear: "Semester 3",
  github: "", // e.g. "https://github.com/your-name/smartreview-ai"
  contact: "", // e.g. "yourname@example.com"
};

export const isPlaceholder = (v: string) => v.startsWith("TODO");
