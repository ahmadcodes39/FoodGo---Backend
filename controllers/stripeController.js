import Stripe from "stripe";
import Order from "../models/Order.js";
import { stripe } from "../config/stripe.js";
import dotenv from "dotenv";

dotenv.config();

export const stripePaymentWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

 if (event.type === "checkout.session.completed") {
  const sessionObj = event.data.object;
  const meta = sessionObj.metadata || {};

  let orderIds = [];

  if (meta.orderIds) {
    orderIds = meta.orderIds.split(",").map((id) => id.trim());
  }

  if (orderIds.length > 0) {
    await Order.updateMany(
      { _id: { $in: orderIds } },
      {
        $set: {
          paymentStatus: "paid",
          status: "confirmed",
        },
        $push: {
          statusHistory: {
            status: "confirmed",
            time: new Date(),
          },
        },
      }
    );
  }
}


  res.status(200).json({ received: true });
};

