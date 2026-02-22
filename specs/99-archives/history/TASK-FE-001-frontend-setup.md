# TASK-FE-001: Frontend Setup & Configuration

**ID:** TASK-FE-001
**Title:** Frontend Project Setup & Configuration
**Category:** Foundation
**Priority:** P0 (Critical)
**Effort:** 2-3 days
**Dependencies:** None
**Assigned To:** Frontend Lead

---

## 📋 Overview

Setup Next.js project with TypeScript, Tailwind CSS, Shadcn/UI, and all necessary tooling for LCBP3-DMS frontend development.

---

## 🎯 Objectives

1. Initialize Next.js 14+ project with App Router
2. Configure TypeScript with strict mode
3. Setup Tailwind CSS and Shadcn/UI
4. Configure ESLint, Prettier, and Husky
5. Setup environment variables
6. Configure API client and interceptors

---

## ✅ Acceptance Criteria

- [ ] Next.js project running on `http://localhost:3001`
- [ ] TypeScript strict mode enabled
- [ ] Shadcn/UI components installable with CLI
- [ ] ESLint and Prettier working
- [ ] Environment variables loaded correctly
- [ ] Axios configured with interceptors
- [ ] Health check endpoint accessible

---

## 🔧 Implementation Steps

### Step 1: Create Next.js Project

```bash
# Create Next.js project with TypeScript
npx create-next-app@latest frontend --typescript --tailwind --app --src-dir --import-alias "@/*"

cd frontend

# Install dependencies
npm install
```

### Step 2: Configure TypeScript

```json
// File: tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Step 3: Setup Tailwind CSS

```javascript
// File: tailwind.config.js
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        // ... more colors
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

### Step 4: Initialize Shadcn/UI

```bash
# Initialize shadcn/ui
npx shadcn-ui@latest init

# Answer prompts:
# - TypeScript: Yes
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes
# - Tailwind config: tailwind.config.js
# - Components: @/components
# - Utils: @/lib/utils

# Install essential components
npx shadcn-ui@latest add button input label card dialog dropdown-menu table
```

### Step 5: Configure ESLint & Prettier

```bash
npm install -D prettier eslint-config-prettier
```

```json
// File: .eslintrc.json
{
  "extends": ["next/core-web-vitals", "prettier"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

```json
// File: .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 100
}
```

### Step 6: Setup Git Hooks with Husky

```bash
npm install -D husky lint-staged

# Initialize husky
npx husky-init
```

```json
// File: package.json (add to scripts)
{
  "scripts": {
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

```bash
# File: .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

### Step 7: Environment Variables

```bash
# File: .env.local (DO NOT commit)
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=LCBP3-DMS
NEXT_PUBLIC_APP_VERSION=1.5.0
```

```bash
# File: .env.example (commit this)
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=LCBP3-DMS
NEXT_PUBLIC_APP_VERSION=1.5.0
```

```typescript
// File: src/lib/env.ts
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL!,
  appName: process.env.NEXT_PUBLIC_APP_NAME!,
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION!,
};

// Validate at build time
if (!env.apiUrl) {
  throw new Error('NEXT_PUBLIC_API_URL is required');
}
```

### Step 8: Configure API Client

```bash
npm install axios react-query zustand
```

```typescript
// File: src/lib/api/client.ts
import axios from 'axios';
import { env } from '@/lib/env';

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      localStorage.removeItem('auth-token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Step 9: Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (public)/          # Public routes
│   │   │   └── login/
│   │   ├── (dashboard)/       # Protected routes
│   │   │   ├── correspondences/
│   │   │   ├── rfas/
│   │   │   └── drawings/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/            # React components
│   │   ├── ui/               # Shadcn/UI components
│   │   ├── layout/           # Layout components
│   │   ├── correspondences/  # Feature components
│   │   └── common/           # Shared components
│   │
│   ├── lib/                   # Utilities
│   │   ├── api/              # API clients
│   │   ├── stores/           # Zustand stores
│   │   ├── utils.ts          # Helpers
│   │   └── env.ts            # Environment
│   │
│   ├── types/                # TypeScript types
│   │   └── index.ts
│   │
│   └── styles/               # Global styles
│       └── globals.css
│
├── public/                    # Static files
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🧪 Testing & Verification

### Manual Testing

```bash
# Start dev server
npm run dev

# Check TypeScript
npm run type-check

# Run linter
npm run lint

# Format code
npm run format
```

### Verification Checklist

- [ ] Dev server starts without errors
- [ ] TypeScript compilation succeeds
- [ ] ESLint passes with no errors
- [ ] Tailwind CSS classes working
- [ ] Shadcn/UI components render correctly
- [ ] Environment variables accessible
- [ ] API client configured (test with mock endpoint)

---

## 📦 Deliverables

- [ ] Next.js project initialized
- [ ] TypeScript configured (strict mode)
- [ ] Tailwind CSS working
- [ ] Shadcn/UI installed
- [ ] ESLint & Prettier configured
- [ ] Husky git hooks working
- [ ] Environment variables setup
- [ ] API client configured
- [ ] Project structure documented

---

## 🔗 Related Documents

- [ADR-011: Next.js App Router](../../05-decisions/ADR-011-nextjs-app-router.md)
- [ADR-012: UI Component Library](../../05-decisions/ADR-012-ui-component-library.md)
- [ADR-014: State Management](../../05-decisions/ADR-014-state-management.md)
- [Frontend Guidelines](../../03-implementation/frontend-guidelines.md)

---

## 📝 Notes

- Use App Router (not Pages Router)
- Enable TypeScript strict mode
- Follow Shadcn/UI patterns for components
- Keep bundle size small

---

**Created:** 2025-12-01
**Updated:** 2025-12-01
**Status:** Ready
