# MyOhana — Production Deployment Guide

## Prerequisites

- [Railway CLI](https://docs.railway.app/develop/cli) installed (`npm i -g @railway/cli`)
- A Railway account (railway.app)
- A Stripe account with test/live API keys
- DNS access to myohana.family

---

## Step 1: Railway Project Setup

```bash
railway login
railway init        # Creates a new project, or link to existing
railway up          # Deploys from Dockerfile
```

## Step 2: Attach Persistent Volume

In the Railway dashboard (railway.app):

1. Select your service
2. Go to **Settings → Volumes**
3. Click **+ New Volume**
4. Mount path: `/app/data`
5. Size: 1 GB (expandable later)

Then set these env vars so the app writes to the mounted volume:

```
DATABASE_URL=/app/data/data.db
UPLOAD_DIR=/app/data/uploads
```

> The volume persists across deploys and restarts. Without it, your database and uploaded files will be lost on every deploy.

## Step 3: Set Environment Variables

In Railway dashboard → **Variables**, set ALL of the following:

### Required — App Will Not Start Without These

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Enables secure cookies, disables seed data |
| `SESSION_SECRET` | *(random 64+ char string)* | Generate with: `openssl rand -hex 32` |
| `APP_URL` | `https://myohana.family` | Your production domain, no trailing slash |
| `PORT` | `5000` | Railway maps this automatically |
| `DATABASE_URL` | `/app/data/data.db` | Must be on the persistent volume |

### Required — Stripe Billing

| Variable | Value | Notes |
|----------|-------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | From Stripe Dashboard → Developers → API Keys |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Same location |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | From Stripe Dashboard → Developers → Webhooks |
| `STRIPE_PRICE_FAMILY` | `price_...` | Create a $19.99/mo recurring price in Stripe |
| `STRIPE_PRICE_EXTENDED` | `price_...` | Create a $29.99/mo recurring price in Stripe |

### Optional — Work Without These (Graceful Degradation)

| Variable | Value | Notes |
|----------|-------|-------|
| `S3_ENDPOINT` | R2/S3 endpoint URL | Vault files use local storage fallback if not set |
| `S3_BUCKET` | Bucket name | |
| `S3_ACCESS_KEY_ID` | Access key | |
| `S3_SECRET_ACCESS_KEY` | Secret key | |
| `S3_REGION` | `auto` | |
| `EMAIL_API_KEY` | Resend API key | Password reset emails log to console if not set |
| `EMAIL_FROM_ADDRESS` | `noreply@myohana.family` | |
| `LOG_LEVEL` | `info` | Options: debug, info, warn, error |

## Step 4: Stripe Product Setup

In [Stripe Dashboard](https://dashboard.stripe.com):

1. Go to **Products → + Add Product**
2. Create **"MyOhana Family"**:
   - Price: $19.99/month, recurring
   - Copy the Price ID → set as `STRIPE_PRICE_FAMILY`
3. Create **"MyOhana Extended"**:
   - Price: $29.99/month, recurring
   - Copy the Price ID → set as `STRIPE_PRICE_EXTENDED`
4. Go to **Developers → Webhooks → + Add Endpoint**:
   - URL: `https://myohana.family/api/billing/webhook`
   - Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
   - Copy the Signing Secret → set as `STRIPE_WEBHOOK_SECRET`

## Step 5: Custom Domain

In Railway dashboard → **Settings → Domains**:

1. Click **+ Custom Domain**
2. Enter: `myohana.family`
3. Railway provides a CNAME target
4. In your DNS provider (Squarespace): add a CNAME record pointing `myohana.family` → Railway's target
5. Railway provisions HTTPS automatically via Let's Encrypt

## Step 6: Verify

```bash
curl https://myohana.family/api/health
# Should return: {"status":"ok","timestamp":"...","version":"1.0.0","database":"connected"}
```

Open https://myohana.family in a browser. Register the Foss family. Subscribe via Stripe. That's your first dollar.

---

## Updating / Redeploying

```bash
cd myohana-app
git push origin master    # CI runs tests
railway up                # Deploys latest build
```

## Database Backup (Manual for Now)

```bash
railway connect           # Opens shell into container
cp /app/data/data.db /app/data/backup-$(date +%Y%m%d).db
```

Automate nightly backups to S3/R2 post-launch (see TECH_DEBT.md).

## Rollback

In Railway dashboard → **Deployments**, click on a previous deployment → **Redeploy**.

Database rollback requires restoring from backup — Railway volumes are persistent across deploys.
