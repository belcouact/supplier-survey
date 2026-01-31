# Project Overview

## Tech Stack
- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Cloudflare Workers (Serverless)
- **Database:** Supabase PostgreSQL & Bucket

## Project Directory Structure

The project follows a specific structure as depicted below:

```text
/
├── components/                # React UI Components
│   ├── InfoModal.tsx
│
│
├── public/                    # Static public assets
│
├── services/                  # Application services
│   ├── aiService.ts
│
├── worker/                    # Cloudflare Workers Backend code
│
├── .gitignore
├── App.tsx                    # Main React Application Component
├── index.html                 # HTML Entry point
├── index.tsx                  # React Entry point
├── metadata.json
├── package-lock.json
├── package.json               # Project dependencies and scripts
├── README.md
├── tsconfig.json              # TypeScript configuration
├── types.ts                   # Shared TypeScript definitions
└── vite.config.ts             # Vite build configuration
```

## Mobile Responsiveness

The application is designed to be fully responsive across all device sizes, prioritizing a mobile-first approach.

- **Framework:** Tailwind CSS is used for all styling, utilizing its responsive utility classes (e.g., `md:`, `lg:`) to adapt layouts.
- **Breakpoints:** Standard Tailwind breakpoints are used.
- **Components:** UI components are built to stack or adjust their layout on smaller screens to ensure usability on mobile devices.

## Coding Standards & Best Practices

- **React Imports:** Do not explicitly import `React` from 'react' just for JSX, as the project uses the new JSX transform (React 17+). Only import named exports like hooks (e.g., `useState`, `useEffect`) or types when necessary.
- **Linting & Cleanup:** Always remove unused imports, variables, and function arguments before finalizing code. The build process enforces `noUnusedLocals` and `noUnusedParameters`, so these will cause build failures.

## Auto resolve issues in the Problems section


