/**
 * Auth Store - Manages JWT token storage and retrieval
 */

const TOKEN_KEY = 'manju_token';

class AuthStore {
    private token: string | null = null;

    constructor() {
        // Load token from localStorage on init
        if (typeof window !== 'undefined') {
            this.token = localStorage.getItem(TOKEN_KEY);
        }
    }

    getToken(): string | null {
        return this.token;
    }

    setToken(token: string): void {
        this.token = token;
        if (typeof window !== 'undefined') {
            localStorage.setItem(TOKEN_KEY, token);
        }
    }

    clearToken(): void {
        this.token = null;
        if (typeof window !== 'undefined') {
            localStorage.removeItem(TOKEN_KEY);
        }
    }

    hasToken(): boolean {
        return !!this.token;
    }
}

// Singleton instance
export const authStore = new AuthStore();
