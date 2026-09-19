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

  // Test timeout — 60s สำหรับ CI runner ที่มี resource contention (ExcelJS I/O ช้าบน ASUSTOR)
  // Local รันเร็ว (~10ms) แต่ CI runner อาจช้ากว่า 30s default (D274, D302)
  testTimeout: 60000,

  // Root directory for tests
  rootDir: '.',

  // Test file pattern — ครอบคลุมทั้ง src/ (unit), tests/ (integration/e2e), และ performance tests
  testMatch: [
    '<rootDir>/src/**/*.spec.ts',
    '<rootDir>/tests/**/*.spec.ts',
    '<rootDir>/tests/**/*.e2e-spec.ts',
    '<rootDir>/tests/**/*.perf-spec.ts',
  ],

  // TypeScript transformation — ใช้ tsconfig.spec.json สำหรับ jest globals (describe, it, expect)
  // NOTE: อย่าเพิ่ม per-file transform entries ที่ตั้งค่า tsconfig ต่างกัน —
  // ts-jest cache ConfigSet ต่อ jest project config (ไม่ใช่ต่อ pattern) ทำให้
  // transformer ตัวแรกที่ถูกใช้ "ชนะ" และ tsconfig ของมันกลายเป็นของทั้ง worker
  // (dead config หรือ contamination แบบ nondeterministic) — decorator metadata
  // branches (`typeof X === "function" ? X : Object` ใน design:paramtypes)
  // จึง cover ไม่ได้ผ่าน test code และถือเป็นข้อจำกัดของ v8 coverage
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }],
  },

  // ใช้ V8 built-in coverage แทน babel-plugin-istanbul
  // เพื่อหลีกเลี่ยง test-exclude@6.0.0 + minimatch incompatibility
  coverageProvider: 'v8',

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/database/seeds/**',
    '!src/**/database/migrations/**',
    '!src/**/config/**',
    '!src/**/scripts/**',
    '!src/**/*.module.ts',
  ],
  coverageDirectory: './coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/test/', '/dist/'],

  // Test environment
  testEnvironment: 'node',

  // Cache for faster subsequent runs
  cacheDirectory: '.jest-cache',

  // Global setup after env
  setupFilesAfterEnv: ['./test/jest.setup.ts'],

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
    // (ลบ '*.spec.ts' entry — spec files ไม่ถูก instrument โดย v8 provider
    //  pattern จึง match ไฟล์ไม่ได้และทำให้ Jest รายงาน "coverage data not found")
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
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
  },

  // Verbose output for debugging
  verbose: true,

  // Clear mock calls between tests
  clearMocks: true,

  // Restore mock state after each test
  restoreMocks: true,

  // Maximum workers — CI runner (ASUSTOR) มี resource จำกัด
  // ใช้ 1 worker บน CI เพื่อลด I/O contention (ExcelJS ช้าเมื่อ parallel)
  // Local ใช้ 50% ของ CPUs เพื่อความเร็ว
  maxWorkers: process.env.CI === 'true' ? 1 : '50%',

  // Recycle workers ที่ใช้ memory เกิน 512MB (ป้องกัน memory leak จาก ExcelJS)
  workerIdleMemoryLimit: '512MB',
};
