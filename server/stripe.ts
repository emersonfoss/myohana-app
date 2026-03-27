import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export function isStripeConfigured(): boolean {
  return stripe !== null;
}

export const STRIPE_PRICES: Record<string, string | undefined> = {
  family: process.env.STRIPE_PRICE_FAMILY,
  extended: process.env.STRIPE_PRICE_EXTENDED,
};

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
