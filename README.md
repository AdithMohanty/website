portfolio

<<<<<<< HEAD
link: adithmohanty.com
=======
Adith Mohanty's personal site, built with [Next.js](https://nextjs.org).

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Edit content

- **Home page:** the `experience` and `projects` arrays in [`app/page.tsx`](app/page.tsx). Logos and images are in `public/media/`.
- **Blog:** copy [`content/blog/_template.md`](content/blog/_template.md), rename it, and write. Files starting with `_` are hidden.
- **Gallery:** drop images into `public/gallery/`. The filename becomes the caption.

## Environment variables

Set these in `.env.local` for development and in Vercel for the live site.

| Name | Used for |
| --- | --- |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Spotify app credentials |
| `SPOTIFY_REFRESH_TOKEN` | Created by `npm run spotify:auth` |
| `LOCATION_SECRET` | Password the phone shortcut sends to `/api/location` |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Stores the location on the live site (or `KV_REST_API_URL` / `KV_REST_API_TOKEN` from Vercel's Upstash integration) |

## Deploy

Hosted on Vercel. Pushing to `main` deploys automatically.
>>>>>>> d24c9e1 (added some visual and interactive elements, along with gallery and blog)
