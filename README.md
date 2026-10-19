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
