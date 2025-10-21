import Stripe from "stripe";
import Order from "../models/Order.js";
import { stripe } from "../config/stripe.js";
import dotenv from "dotenv";

dotenv.config();

export const stripePaymentWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    // verify the event came from Stripe
    event = stripe.webhooks.constructEvent(
      req.body, // raw body (not parsed)
      sig,
      process.env.STRIPE_WEBHOOK_SECRET // from your Stripe dashboard
    );
  } catch (err) {
    console.error("⚠️ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle specific event types
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;

      if (orderId) {
        await Order.findByIdAndUpdate(orderId, {
          paymentStatus: "paid",
          status: "confirmed",
          paymentId: session.id,
        });
      }

      console.log(`✅ Checkout session completed for Order ID: ${orderId}`);
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await Order.findByIdAndUpdate(orderId, { paymentStatus: "failed" });
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
};
