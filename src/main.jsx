import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WorldProvider } from "./lib/store";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <WorldProvider>
      <App />
    </WorldProvider>
  </StrictMode>
);
