import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { authStore } from './stores/authStore'

// Extract JWT token from URL fragment BEFORE React renders
// This ensures the token is available for all components
if (typeof window !== 'undefined') {
  const hash = window.location.hash;
  if (hash.startsWith('#token=')) {
    const token = decodeURIComponent(hash.substring(7));
    console.log('[main] Token found in URL, storing...');
    authStore.setToken(token);
    // Remove token from URL without triggering navigation
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    console.log('[main] Token stored, URL cleaned');
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
