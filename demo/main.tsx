import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoApp } from './DemoApp';
import './demo.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <DemoApp />
  </StrictMode>,
);
