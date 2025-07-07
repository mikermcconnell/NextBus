import '@testing-library/jest-dom';

/// <reference types="jest" />

jest.mock('next/image', () => ({ __esModule: true, default: () => null })); 