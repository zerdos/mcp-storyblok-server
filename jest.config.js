module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts', '**/?(*.)+(spec|test).ts'], // Adjusted to include a potential top-level tests directory and common naming conventions
  moduleNameMapper: { // If using path aliases in tsconfig.json, map them here
    '^@src/(.*)$': '<rootDir>/src/$1' // Example: if you have paths like @src/utils
  },
  modulePaths: ['<rootDir>'] // Adding modulePaths to help resolve aliases
};
