# MovieBox - Node / Express / Nunjucks

Server-rendered MovieBox application integrated from the latest Figma React export.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Page routes

- `/` - public MovieBox landing page
- `/logon` - login/create-account page
- `/dashboard` - authenticated profile/dashboard design
- `/searchpage` - movie search
- `/social` - community review feed
- `/theatres` - theatre discovery
- `/settings` - account/preferences

## Structure

- `server.js` - Express setup, API endpoints, and page routes
- `templates/` - Nunjucks server-rendered HTML
- `templates/base.html` - shared authenticated application shell/navigation
- `static/css/` - global styles plus login-specific styles
- `static/js/` - framework-free browser interactions

Sample movie, review, theatre, and profile content is intentionally kept as template fallback data. Pass real data through `res.render()` as APIs/database services are connected.

Keep new API and page routes above the final 404/error handlers in `server.js`.

## Social reviews v0.3

The Socials page now starts with TMDB-backed movie selection. Selecting a result calls `POST /api/social/movies/resolve`; Express validates the TMDB ID and upserts that movie into `social_movie`. The review page then loads aggregate MovieBox ratings, the signed-in user's reviews, and other users' public reviews from MySQL. Posting a review uses `POST /api/social/movies/:id/reviews`.

The Socials tables are created with `CREATE TABLE IF NOT EXISTS` when the Socials API is first used. Socials API requests are protected by the existing JWT middleware, so the browser must have `movieboxToken` from a successful login. `TMDB_API_KEY` and the existing MySQL environment variables must also be configured in `.env`.
