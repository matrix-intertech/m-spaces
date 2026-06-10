# MatrixSpaces

This repository is now a single Next.js application at the repo root, with the internal Express server source mounted through `pages/api/_internal/[[...slug]].ts`.

## Local development

```bash
npm install
npm run dev
```

The app runs as one project on `http://localhost:3000`.

## Vercel deployment

Import the repository in Vercel as a single project from the repo root.

Required environment variables depend on your server integrations, but the common ones are:

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `SESSION_SECRET`
- `DATABASE_URL` or the Postgres variables your app already uses
- `AUTH0_*` variables if Auth0 login is enabled
- `AWS_*` variables if S3 uploads are enabled

## Notes

- Frontend requests now use the internal `/svc/server/*` bridge, so a separate frontend/server deploy is no longer required.
- Existing Socket.IO realtime transport is not used in the merged Vercel flow. Chat falls back to HTTP polling so deployment still works on Vercel.
