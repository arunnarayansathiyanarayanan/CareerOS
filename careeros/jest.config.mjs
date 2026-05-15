import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  moduleNameMapper: {
    "^@vercel/analytics$": "<rootDir>/src/__tests__/__mocks__/vercel-analytics.ts",
    "^@resend/node$": "<rootDir>/src/__tests__/__mocks__/resend-node.ts",
    "^@/lib/analytics$": "<rootDir>/src/__tests__/__mocks__/analytics-e1.ts",
    "^pdf-parse$": "<rootDir>/src/__tests__/__mocks__/pdf-parse-stub.ts",
    "^next/navigation$": "<rootDir>/__mocks__/next/navigation.ts",
  },
};

export default createJestConfig(customJestConfig);
