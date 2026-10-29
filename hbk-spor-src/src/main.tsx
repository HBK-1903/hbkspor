import React from 'react';
import { createRoot } from 'react-dom/client';
import MuscleAnalyticsLauncher from './MuscleAnalyticsLauncher';
import './muscle-analytics.css';
import './player-card-redesign.css';

const mount = document.getElementById('muscle-extension-root');
if (mount) {
  createRoot(mount).render(
    <React.StrictMode>
      <MuscleAnalyticsLauncher />
    </React.StrictMode>,
  );
}
