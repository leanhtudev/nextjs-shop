import nextJest from "next/jest.js";

// next/jest wires up SWC (TypeScript/JSX), CSS/image mocks and .env loading for us.
const createJestConfig = nextJest({ dir: "./" });

export default createJestConfig({
  testEnvironment: "jsdom", // component tests; server tests opt out with a `@jest-environment node` docblock
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // `server-only` throws when imported outside a React Server environment; stub it for unit tests.
    "^server-only$": "<rootDir>/__tests__/stubs/server-only.ts",
  },
  testMatch: ["<rootDir>/__tests__/**/*.test.{ts,tsx}"],
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/", "<rootDir>/e2e/"],
  // Coverage (npm run test:ci). Pages and layouts are covered by the Playwright e2e suite instead.
  collectCoverageFrom: [
    "src/lib/**/*.{ts,tsx}",
    "src/server/**/*.{ts,tsx}",
    "src/components/**/*.{ts,tsx}",
    "src/app/**/actions.ts",
    "src/app/api/**/route.ts",
  ],
  coverageReporters: ["text-summary", "lcov", "json-summary"],
  // A ratchet, set just under today's numbers (56 / 41 / 52 / 56 %): coverage may not go DOWN.
  // Raise these as tests are added.
  coverageThreshold: {
    global: { statements: 55, branches: 40, functions: 50, lines: 55 },
  },
});
