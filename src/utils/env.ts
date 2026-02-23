/**
 * Utility to access environment variables safely across environments.
 */

// In Vite, import.meta.env is replaced at build time (and dev time).
// In Jest (Node), process.env is usually preferred, but import.meta works if module=esnext.
// However, ts-jest/jest often struggle with import.meta.env syntax in tests.
// This wrapper isolates the env access.

export const getEnv = (key: string): string => {
    // Prefer direct access to import.meta.env so Vite can statically replace
    // environment variables at build/dev time. This will work in the browser
    // and during Vite dev where `import.meta.env` is available.
    try {
        // @ts-ignore - import.meta exists in ESM/Vite environments
        const meta = (import.meta as any)?.env;
        if (meta && meta[key]) return meta[key];
    } catch (e) {
        // ignore and fall through to process.env fallback
    }

    // Fallback for Node/Jest environments where process.env is available
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key] || '';
    }

    return '';
};
