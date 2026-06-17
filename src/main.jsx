// src/main.jsx
// ─────────────────────────────────────────────────────────────
// Vite entry point. Mounts the React app into the #root div
// defined in index.html.
//
// StrictMode is intentional — it double-invokes effects in
// development to surface side-effect bugs early. It has no
// impact on production builds.
// ─────────────────────────────────────────────────────────────

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

const container = document.getElementById('root');

if (!container) {
  throw new Error(
    '[lnceSaving] Could not find #root element in index.html. ' +
    'Make sure your index.html contains <div id="root"></div>.'
  );
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);