/**
 * Utility to access environment variables safely across environments.
 */

// In Vite, import.meta.env is replaced at build time (and dev time).
// In Jest (Node), process.env is usually preferred, but import.meta works if module=esnext.
// However, ts-jest/jest often struggle with import.meta.env syntax in tests.
// This wrapper isolates the env access.

export const getEnv = (key: string): string => {
    let metaEnv: any = {};
    try {
        // Use new Function to avoid syntax error in CJS environments (Jest)
        // when parsing the file.
        metaEnv = new Function('return import.meta.env')();
    } catch (e) {
        // Ignore errors (e.g., in CJS where import.meta is not allowed)
    }

    if (metaEnv && metaEnv[key]) {
        return metaEnv[key];
    }
  
    // Fallback to process.env (Node/Jest safe)
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key] || '';
    }
  
    return '';
};
