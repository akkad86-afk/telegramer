# Telegram news feed

Landing page that shows the latest posts from public Telegram channels.

- `api/feed.js` – serverless function; scrapes `https://t.me/s/<channel>`, returns JSON. Edit `CHANNELS` at the top to change the list.
- `public/index.html` – the page (RTL, filter by channel, text search with highlighting, auto-refresh every 2 minutes).

## Deploy
```
npm install
npx vercel          # preview
npx vercel --prod   # production
```
Local test: `npx vercel dev`, then open http://localhost:3000

Responses are cached at the edge for 2 minutes (`s-maxage=120`), so Telegram is hit rarely.
