import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CalmingErrorBoundary } from './components/shared/CalmingErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CalmingErrorBoundary>
      <App />
    </CalmingErrorBoundary>
  </React.StrictMode>,
);