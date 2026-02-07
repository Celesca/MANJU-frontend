import '@testing-library/jest-dom';

// Optional global test setup or mocks can go here

import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextDecoder, TextEncoder });
