# MyOhana

A private family hub for messages, photos, calendar events, vault document storage, memory compilations, and real-time communication. Built for families who want to stay connected and preserve their most meaningful moments.

## Tech Stack

- **Frontend**: React 18 + Vite + TanStack Query + Tailwind CSS + shadcn/ui
- **Backend**: Express 5 + Passport (session-based auth) + Drizzle ORM
- **Database**: SQLite (better-sqlite3) with WAL mode
- **File Storage**: Local filesystem or S3-compatible (Cloudflare R2)
- **Billing**: Stripe (optional)
- **Email**: Resend via SMTP (optional, for password reset)

## Prerequisites

- Node.js 20+
- npm

## Local Development

```bash
cp .env.example .env
npm install
npm run dev
```

The app will be available at `http://localhost:5000`.

## Production Build

```bash
npm run build
NODE_ENV=production SESSION_SECRET=<your-secret> node dist/index.cjs
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | **Yes (prod)** | Random 64-char secret for session encryption |
| `NODE_ENV` | No | `development` or `production` (default: `development`) |
| `PORT` | No | Server port (default: `5000`) |
| `APP_URL` | **Yes (prod)** | Full public URL (e.g. `https://myohana.app`) |
| `LOG_LEVEL` | No | Pino log level: `debug`, `info`, `warn`, `error` (default: `info`) |
| `DATABASE_URL` | No | SQLite database path (default: `./data.db`) |
| `UPLOAD_DIR` | No | Photo upload directory (default: `./uploads`) |
| `STRIPE_SECRET_KEY` | No | Stripe secret key for billing |
| `STRIPE_PUBLISHABLE_KEY` | No | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `STRIPE_PRICE_FAMILY` | No | Stripe price ID for family plan |
| `STRIPE_PRICE_EXTENDED` | No | Stripe price ID for extended plan |
| `S3_ENDPOINT` | No | S3-compatible endpoint URL |
| `S3_BUCKET` | No | S3 bucket name |
| `S3_ACCESS_KEY_ID` | No | S3 access key |
| `S3_SECRET_ACCESS_KEY` | No | S3 secret key |
| `S3_REGION` | No | S3 region (default: `auto`) |
| `EMAIL_API_KEY` | No | Resend API key for email |
| `EMAIL_FROM_ADDRESS` | No | From address for emails |

## Database

SQLite with WAL mode for concurrent reads. The database file (`data.db`) is created automatically on first start with all required tables and indexes.

**Backups**: For production, implement nightly backup of `data.db` to S3/R2. The database is a single file that can be safely copied while the app is running (WAL mode ensures consistency).

## Testing

```bash
npm test          # Run all tests
npm run test:watch  # Watch mode
```

## Deployment

**Railway (recommended)**: Attach a persistent volume for `data.db`, `uploads/`, and `vault-uploads/`. The app listens on `PORT` (default 5000) and serves both API and frontend.

**Docker**:
```bash
docker build -t myohana .
docker run -p 5000:5000 -e SESSION_SECRET=... -v myohana-data:/app myohana
```

## License

MIT
