import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { Splash } from "./components/Splash";
import { ToastProvider } from "./components/ui/Toast";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Splash>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </Splash>
  </StrictMode>,
);
