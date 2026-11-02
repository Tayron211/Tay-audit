import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (typeof window !== 'undefined') {
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  // Capturar evento PWA para instalación 1-tap en móviles
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as any).__pwaInstallPrompt = e;
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
