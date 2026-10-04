import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/** Hidden shortcut: Alt + Shift + M opens the Model page (no visible link in the UI). */
export function useModelShortcut() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyM" && !e.repeat) {
        e.preventDefault();
        navigate("/model");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}
