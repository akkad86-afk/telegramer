# Telegram news feed

Landing page that shows the latest posts from public Telegram channels.

- `api/feed.js` – serverless function; scrapes `https://t.me/s/<channel>`, returns JSON. Edit `CHANNELS` at the top to change the list.
- `public/index.html` – the page (RTL, dark mode). Filter by channel, text search with highlighting, newest first, clickable links, auto-refresh every 2 minutes with a "N new posts" pill when you are scrolled down, and a refresh button. The selected channel and search are kept in the URL hash (`#c=<channel>&q=<text>`), so a link can be shared.
- `public/manifest.webmanifest`, `public/icon*.png`, `public/icon.svg` – lets the page be installed / added to the home screen.

## Deploy
```
npm install
npx vercel          # preview
npx vercel --prod   # production
```
Local test: `npx vercel dev`, then open http://localhost:3000

Responses are cached at the edge for 2 minutes (`s-maxage=120`), so Telegram is hit rarely.
