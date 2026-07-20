import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

/**
 * registerType: 'autoUpdate' (vite.config.ts) means a new service worker activates
 * and reloads the page automatically once one is *found* — but nothing checks for
 * one beyond the browser's own infrequent, unpredictable heuristics unless we ask.
 * An installed PWA that's backgrounded/foregrounded rather than fully closed (the
 * normal mobile pattern) can otherwise sit on a stale build for a long time, which
 * has already caused real bugs here (a device silently running pre-fix sync logic
 * against a database whose rules had moved on). Poll explicitly, and check the
 * moment the app comes back to the foreground — the point it's most likely to have
 * missed a deploy since it was last active.
 */
const UPDATE_CHECK_MS = 5 * 60 * 1000;
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    setInterval(() => registration.update(), UPDATE_CHECK_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update();
    });
  },
});

// Catches render errors so a bug can't blank-screen the whole app mid-festival.
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.error(err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>Try reloading the app. Your saved ratings and schedule are safe on this device.</p>
          <button className="primary-btn" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
