/** @type {import('jest').Config} */
module.exports = {
  // Use jsdom for React component testing (DOM APIs)
  testEnvironment: 'jsdom',

  // ts-jest transform for TypeScript/TSX files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },

  // Look for tests inside src/ and top-level __tests__
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],

  // File extensions Jest should process
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Test file patterns
  testMatch: ['**/__tests__/**/*.(spec|test).[tj]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],

  // Setup file to load @testing-library/jest-dom matchers
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

  // Stub out CSS and static asset imports
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
};