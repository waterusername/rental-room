export { GRINBERG_ADMIN_EMAILS, isGrinbergAdminEmail, isOfficeAccount } from "./config.ts";

/** Shown on Checkout. The charged amount is still STRIPE_PRICE_ID, not this sentence. */
export const CHECKOUT_SUBMIT_MESSAGE =
  "Rental Room access for outside brokers is $100 USD per month. The Stripe Price for this site must be $100 USD, billed monthly.";
