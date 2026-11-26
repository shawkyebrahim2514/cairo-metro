import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, type HighlightId, type ThemeMode } from './settings';

// Apply the saved theme before the first paint to avoid a flash.
applyTheme(
  (localStorage.getItem('theme') as ThemeMode) || 'auto',
  (localStorage.getItem('highlight') as HighlightId) || 'amber',
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
  });
}
