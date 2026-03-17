This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## E2E Testing (Playwright)

Run from repo root:

```bash
pnpm --dir apps/frontend test:e2e
```

Targeted suites:

```bash
pnpm --dir apps/frontend test:e2e -- --grep "Admin — vendor approval via UI"
pnpm --dir apps/frontend test:e2e -- --grep "Pending vendor"
```

Prerequisites:

- Frontend on `http://localhost:3000`
- Backend on `http://localhost:3001`
- Backend env includes `E2E_TEST_OTP=123456` for deterministic OTP login in tests

## Onboarding + Access Guarantees

- Fresh buyer onboarding flow is covered end-to-end: `/login` -> OTP -> `/onboarding/buyer` -> `/buyer/dashboard`.
- Fresh vendor onboarding flow is covered end-to-end: `/login` -> OTP -> `/onboarding/vendor` submit -> `/vendor/dashboard` with pending banner.
- Pending vendors retain `/vendor/*` dashboard access, but write operations remain blocked:
  quote submit and vendor product mutation APIs are expected to return `403`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
