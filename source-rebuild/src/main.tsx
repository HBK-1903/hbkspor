import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './visual-features.css';
import './selected-features.css';
import './follow-up-features.css';
import './report-media-notifications.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch((error: unknown) => {
      console.warn('[HBK Spor] Service worker registration failed:', error);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
