import '@testing-library/jest-dom';

/// <reference types="jest" />

// @ts-expect-error jest global provided by test environment
jest.mock('next/image', () => ({ __esModule: true, default: () => null })); 