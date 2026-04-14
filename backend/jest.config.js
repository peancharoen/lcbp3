/**
 * Jest Configuration for LCBP3-DMS Backend
 *
 * ตาม Testing Strategy spec:
 * - Global coverage: 70% (backend overall)
 * - Services: 80% (business logic)
 * - Guards/Middleware: 90%
 * - Utilities: 95%
 *
 * @see specs/05-Engineering-Guidelines/05-04-testing-strategy.md
 */
module.exports = {
  // File extensions
  moduleFileExtensions: ['js', 'json', 'ts'],

  // Root directory for tests
  rootDir: 'src',

  // Test file pattern
  testRegex: '.*\\.spec\\.ts$',

  // TypeScript transformation
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // ใช้ V8 built-in coverage แทน babel-plugin-istanbul
  // เพื่อหลีกเลี่ยง test-exclude@6.0.0 + minimatch incompatibility
  coverageProvider: 'v8',

  // Coverage configuration
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.d.ts',
    '!**/index.ts',
    '!**/database/seeds/**',
    '!**/database/migrations/**',
    '!**/config/**',
    '!**/scripts/**',
    '!**/*.module.ts',
  ],
  coverageDirectory: '../coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/test/', '/dist/'],

  // Test environment
  testEnvironment: 'node',

  // Cache for faster subsequent runs
  cacheDirectory: '.jest-cache',

  // Global setup after env
  setupFilesAfterEnv: ['../test/jest.setup.ts'],

  // Transform ignore patterns (ให้ Jest ประมวลผล ESM modules)
  // รองรับ uuid และ @nestjs/elasticsearch ที่เป็น ESM
  // ใช้ .* เพื่อ match path ย่อยใน pnpm structure
  transformIgnorePatterns: [
    'node_modules/(?!.*(uuid|@nestjs[\\+]elasticsearch).*/)',
  ],

  // Coverage thresholds ตาม Testing Strategy spec
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './src/modules/*/services/*.service.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/modules/*/services/*.spec.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/common/guards/*.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/common/interceptors/*.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/common/utils/*.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },

  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@database/(.*)$': '<rootDir>/database/$1',
  },

  // Verbose output for debugging
  verbose: true,

  // Clear mock calls between tests
  clearMocks: true,

  // Restore mock state after each test
  restoreMocks: true,

  // Maximum workers (ใช้ 50% ของ available CPUs)
  maxWorkers: '50%',
};
