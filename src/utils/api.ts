/**
 * Centralized API utility for MANJU frontend.
 * Automatically adds the X-API-Key header to all requests.
 */

const MANJU_API_KEY = import.meta.env.VITE_MANJU_API_KEY || '';

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers || {});

    if (MANJU_API_KEY) {
        headers.set('X-API-Key', MANJU_API_KEY);
    }

    // Ensure Content-Type is set for JSON requests if not already set
    if (options.body && !headers.has('Content-Type') && typeof options.body === 'string') {
        headers.set('Content-Type', 'application/json');
    }

    return fetch(url, {
        ...options,
        headers,
    });
}
