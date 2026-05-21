# Prop Firm Dashboard — Local & Deploy Guide

Quick steps to run locally and deploy (Netlify, Vercel, GitHub Pages).

Prereqs

- Node.js (18+ recommended)
- npm

Local (development)

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

Open http://localhost:5173/

Build (production)

```bash
npm run build
```

This outputs static files to `dist/public`.

Netlify

- `netlify.toml` is included and configures `npm run build` and `dist/public` as the publish directory.

Vercel

- `vercel.json` is included to instruct Vercel to use `@vercel/static-build` with `dist/public` as the output directory.

GitHub Pages

- A GitHub Actions workflow is provided at `.github/workflows/deploy.yml` that builds and publishes `dist/public` to `gh-pages`.

Notes

- The repo originally used a workspace/monorepo layout; local `tsconfig.json` is now self-contained for standalone use.
- If you want to preserve monorepo references or a local `@workspace/*` package, restore that package or change the dependency in `package.json`.
