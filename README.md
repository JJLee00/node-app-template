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

## Social rankings + sharing v0.4

- **Community rankings** - `GET /api/social/rankings` returns the MovieBox leaderboard. Each member's ratings for a movie are averaged into one vote, then movies are ordered by a weighted (Bayesian) average that pulls movies with few ratings toward the site-wide mean (`RANKING_MIN_RATERS`). The movie review page shows the movie's rank.
- **My ranked list** - each member has one personal list (`social_ranked_list` / `social_ranked_list_item`). `GET /api/social/my-list` loads it and `PUT /api/social/my-list` saves the full order as `{ movieIds: [...] }` (max 25).
- **Sharing** - `POST /api/social/my-list/share` with `{ enabled: true|false }` creates or revokes a public link at `/lists/:token`, which works without logging in and never shows the owner's email. Movies can be shared with a copyable `/social?movie=<tmdb id>` link.
