import React, { useEffect, useState } from 'react';

// Simple Google OAuth2 (PKCE) client-side helper for React + TypeScript
// - Redirects user to Google's authorization endpoint with a PKCE challenge
// - Stores the PKCE code_verifier and state in sessionStorage
// - On callback (redirect to this route), reads `code` and `state` from URL
// - Exposes a button to POST the `code` + `code_verifier` to a backend

const REDIRECT_URI = 'http://localhost:8080/auth/callback/google';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_EXCHANGE_ENDPOINT = '/api/auth/google/exchange'; // change to your server endpoint

function base64UrlEncode(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(buffer: string) {
  const enc = new TextEncoder();
  const data = enc.encode(buffer);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(hash);
}

function randomString(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => ('0' + b.toString(16)).slice(-2)).join('');
}

export default function Login() {
  const [status, setStatus] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [authState, setAuthState] = useState<string | null>(null);
  const [codeVerifierPresent, setCodeVerifierPresent] = useState<boolean>(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '<YOUR_GOOGLE_CLIENT_ID>';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code) {
      setAuthCode(code);
      setAuthState(state);
      setStatus('Authorization code received — ready to exchange.');
      const storedVerifier = sessionStorage.getItem('pkce_code_verifier');
      setCodeVerifierPresent(Boolean(storedVerifier));
    }
  }, []);

  async function startSignIn() {
    setStatus('Generating PKCE code challenge...');
    const codeVerifier = randomString(64);
    const codeChallenge = await sha256(codeVerifier);
    const state = randomString(16);

    // Persist verifier/state in sessionStorage for the callback
    sessionStorage.setItem('pkce_code_verifier', codeVerifier);
    sessionStorage.setItem('pkce_state', state);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      include_granted_scopes: 'true',
      access_type: 'offline',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    } as Record<string, string>);

    // Redirect the browser to Google's OAuth 2.0 endpoint
    window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`;
  }

  async function exchangeCodeServerSide() {
    if (!authCode) return setStatus('No authorization code to exchange.');
    const verifier = sessionStorage.getItem('pkce_code_verifier');
    if (!verifier) return setStatus('PKCE code_verifier not found in sessionStorage.');

    setStatus('Sending code to backend for exchange...');
    try {
      const resp = await fetch(TOKEN_EXCHANGE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode, code_verifier: verifier, redirect_uri: REDIRECT_URI }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        setStatus(`Exchange failed: ${resp.status} ${text}`);
        return;
      }
      const data = await resp.json();
      setStatus('Token exchange successful (server response received).');
      console.log('Token exchange response:', data);
    } catch (err) {
      setStatus(`Exchange error: ${String(err)}`);
    }
  }

  async function exchangeCodeClientSide() {
    if (!authCode) return setStatus('No authorization code to exchange.');
    const verifier = sessionStorage.getItem('pkce_code_verifier');
    if (!verifier) return setStatus('PKCE code_verifier not found in sessionStorage.');
    setStatus('Exchanging code directly with Google token endpoint (client-side).');

    try {
      const params = new URLSearchParams({
        code: authCode,
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      } as Record<string,string>);

      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setStatus(`Token endpoint error: ${JSON.stringify(json)}`);
        return;
      }
      setStatus('Received tokens from Google (client-side exchange).');
      console.log('Tokens:', json);
    } catch (err) {
      setStatus(`Client-side exchange error: ${String(err)}`);
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Sign in with Google</h1>
      <p>Redirect URI: <code>{REDIRECT_URI}</code></p>
      <div style={{ margin: '12px 0' }}>
        <button onClick={startSignIn}>Sign in with Google</button>
      </div>

      {authCode ? (
        <div style={{ marginTop: 16 }}>
          <h3>Callback data</h3>
          <div>Code: <code style={{ wordBreak: 'break-all' }}>{authCode}</code></div>
          <div>State: <code>{authState}</code></div>
          <div>PKCE verifier present: {String(codeVerifierPresent)}</div>
          <div style={{ marginTop: 8 }}>
            <button onClick={exchangeCodeServerSide} style={{ marginRight: 8 }}>Exchange on Server</button>
            <button onClick={exchangeCodeClientSide}>Exchange Directly (client-side)</button>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 20 }}>
        <strong>Status:</strong> {status ?? 'idle'}
      </div>

      <div style={{ marginTop: 16, fontSize: 13, color: '#666' }}>
        <p>Notes:</p>
        <ul>
          <li>Set your Google client id in <code>VITE_GOOGLE_CLIENT_ID</code> or replace it above.</li>
          <li>Prefer exchanging the code on a backend (`{TOKEN_EXCHANGE_ENDPOINT}`) to keep your client secret safe.</li>
          <li>The client-side direct token exchange is shown for completeness and requires correct OAuth client config.</li>
        </ul>
      </div>
    </div>
  );
}
