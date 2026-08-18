# Carl Agent Dashboard

Web app for **Carl** human agents (Next.js).

**Full product + technical context:** see [`CONTEXT.md`](./CONTEXT.md)

```bash
npm install
npm run env:which   # which env file each command loads
npm run dev         # loads .env.staging
```

Open [http://localhost:3000/login](http://localhost:3000/login).

| Command | Env file |
| --- | --- |
| `npm run dev` | `.env.staging` |
| `npm run build` / `npm start` | `.env.production` |

Copy `.env.example` → `.env.staging` / `.env.production` if those files are missing. When the live Backend is ready, change only `API_BASE_URL` in `.env.production`.
