import { NextResponse } from "next/server";
import { databaseConfig } from "@/lib/auth/config";
import { ensureSchema } from "@/lib/auth/db";
import { applyStripeEvent, getStripe } from "@/lib/auth/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 500 });
  }
  if (!databaseConfig()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    console.error("Stripe signature rejected", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await ensureSchema();
    await applyStripeEvent(event);
  } catch (error) {
    console.error("Stripe webhook failed", event.type, error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
