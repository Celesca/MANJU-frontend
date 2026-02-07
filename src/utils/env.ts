/**
 * Utility to access environment variables safely across environments.
 */

// In Vite, import.meta.env is replaced at build time (and dev time).
// In Jest (Node), process.env is usually preferred, but import.meta works if module=esnext.
// However, ts-jest/jest often struggle with import.meta.env syntax in tests.
// This wrapper isolates the env access.

export const getEnv = (key: string): string => {
    // Check if import.meta.env exists (Vite)
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env[key] || '';
    }
  
    // Fallback to process.env (Node/Jest safe)
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || '';
    }
  
    return '';
};
