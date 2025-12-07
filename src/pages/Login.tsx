import Navbar from '../components/Navbar';
import Aurora from '../components/Backgound';

// Backend-handled Google OAuth flow (matches auth.go routes)
// The server exposes:
//  - GET /auth/login/google   -> initiates OAuth with Google (redirects to Google)
//  - GET /auth/callback/google -> Google redirects here, server handles token exchange
// Frontend simply redirects the browser to the backend login route.

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080';
const BACKEND_LOGIN = `${API_BASE}/auth/login/google`;

export default function Login() {
  return (
    <div className="w-full min-h-screen bg-white text-gray-900 relative overflow-hidden">

      {/* Aurora background (absolute) */}
      <div className="absolute top-0 left-0 right-0 h-96 z-10 pointer-events-none">
        <Aurora
          colorStops={["#40ffaa", "#4079ff", "#40ffaa"]}
          amplitude={0.5}
          blend={0.3}
          speed={0.7}
        />
      </div>

      {/* Main content above background */}
      <div className="relative z-20">
        <Navbar />

        <section className="pt-28 pb-20 max-w-3xl mx-auto text-center px-6">
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-lg p-10 mx-4">
            <h1 className="text-4xl font-extrabold mb-4">Sign in with Google</h1>
            <p className="text-gray-600 mb-6">
              This app uses the backend to handle the OAuth flow. Click the button below to continue.
            </p>

            <div className="flex justify-center">
              <a href={BACKEND_LOGIN}>
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow">
                  Sign in with Google
                </button>
              </a>
            </div>

            <div className="mt-6 text-sm text-gray-600">
              <p className="mb-2">Notes:</p>
              <ul className="list-disc list-inside text-left mx-auto max-w-xl">
                <li>Ensure your Google OAuth client has redirect URI: <code>http://localhost:8080/api/auth/callback/google</code></li>
                <li>Server is expected to perform the exchange and set session/cookie or redirect back to the frontend home page.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}
