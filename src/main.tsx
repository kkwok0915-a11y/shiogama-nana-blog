import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

function LiveAnalytics() {
  const host = window.location.hostname;
  if (!host.endsWith(".vercel.app")) return null;
  return <Analytics />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <LiveAnalytics />
    </ErrorBoundary>
  </StrictMode>,
);
