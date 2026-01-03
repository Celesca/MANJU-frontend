/**
 * Centralized API utility for MANJU frontend.
 * Automatically adds the X-API-Key and Authorization headers to all requests.
 */

import { authStore } from '../stores/authStore';

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const MANJU_API_KEY = import.meta.env.VITE_MANJU_API_KEY || '';

    // Build headers object - start with existing headers from options
    const headers: Record<string, string> = {};

    // Copy existing headers if any
    if (options.headers) {
        if (options.headers instanceof Headers) {
            options.headers.forEach((value, key) => {
                headers[key] = value;
            });
        } else if (Array.isArray(options.headers)) {
            options.headers.forEach(([key, value]) => {
                headers[key] = value;
            });
        } else {
            Object.assign(headers, options.headers);
        }
    }

    // Add API Key
    if (MANJU_API_KEY) {
        headers['X-API-Key'] = MANJU_API_KEY;
    }

    // Add JWT token if available
    const token = authStore.getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Ensure Content-Type is set for JSON requests if not already set
    if (options.body && !headers['Content-Type'] && typeof options.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }

    return fetch(url, {
        ...options,
        headers,
    });
}
