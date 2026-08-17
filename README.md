# Carl Agent Dashboard

Web app for **Carl** human agents (Next.js).

**Full product + technical context:** see [`CONTEXT.md`](./CONTEXT.md)

```bash
npm install
npm run env:which   # main → .env.production, else → .env.staging
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).  
Stub auth (empty `API_BASE_URL`): valid email + password (6+ chars, 1 number).

Override file: `ENV_FILE=.env.local npm run dev`
