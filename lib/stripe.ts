import Stripe from "stripe";

export function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}
