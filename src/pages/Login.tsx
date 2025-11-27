// Backend-handled Google OAuth flow (matches auth.go routes)
// The server exposes:
//  - GET /auth/login/google   -> initiates OAuth with Google (redirects to Google)
//  - GET /auth/callback/google -> Google redirects here, server handles token exchange
// Frontend simply redirects the browser to the backend login route.

// The backend registers auth routes under `/api` (see `main.go`), so point there.
const BACKEND_LOGIN = 'http://localhost:8080/api/auth/login/google';

export default function Login() {
  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Sign in with Google</h1>
      <p>This app uses the backend to handle the OAuth flow.</p>
      <div style={{ margin: '12px 0' }}>
        <a href={BACKEND_LOGIN}>
          <button>Sign in with Google</button>
        </a>
      </div>

      <div style={{ marginTop: 20, fontSize: 13, color: '#666' }}>
        <p>Notes:</p>
        <ul>
          <li>Ensure your Google OAuth client has redirect URI: <code>http://localhost:8080/auth/callback/google</code></li>
          <li>Server is expected to perform the exchange and set session/cookie or redirect back to the frontend.</li>
        </ul>
      </div>
    </div>
  );
}
