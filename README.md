# LocalAgendaWatch

Public awareness of local government decisions &mdash; land development, rezoning, and municipal items &mdash; before they happen.

Production: [localagendawatch.com](https://www.localagendawatch.com)

## Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- TypeScript

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Production build

```bash
npm run build
npm run start
```

## Deployment

Deployed on Vercel from the `main` branch. Pushes auto-deploy.

## Project structure

- `app/page.tsx` &mdash; landing page
- `app/nampa/` &mdash; Nampa locality hub and tracked items
- `app/layout.tsx` &mdash; root layout with shared header/footer
- `app/opengraph-image.tsx` &mdash; dynamic social share image

## Status

Early / experimental. First use case: Toll Brothers' proposed 500-home development at E. Amity Ave and S. Happy Valley Rd in Nampa, Idaho.

## Case timeline pilot

Braeburn Creek now has a source-backed timeline and protected evidence review workflow. See [setup and operating instructions](docs/case-timeline.md) for Neon storage, extraction credentials, the hourly GitHub Actions trigger, and review rules.
