import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ToastProvider } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LanguageProvider } from './i18n/LanguageContext';
import { SecurityProvider } from './contexts/SecurityContext';
import { applyDarkModeClass, getCachedDarkMode } from './utils/security';

applyDarkModeClass(getCachedDarkMode());

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ToastProvider>
      <LanguageProvider>
        <SecurityProvider>
          <App />
        </SecurityProvider>
      </LanguageProvider>
    </ToastProvider>
  </ErrorBoundary>
);

// Register service worker ONLY in production
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('ServiceWorker registration omitted:', err);
    });
  });
} else {
  // In development, unregister any existing service worker and delete all caches
  // so a stale cached file can never break the preview.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key);
      }
    });
  }
}
