import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderItems: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "OrderItem",
      },
    ],
    deliveryAddress: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "preparing", "arriving", "delivered"],
      default: "pending",
    },
    // for keep tracking of order this field is used
    statusHistory: [
      {
        status: String,
        time: { type: Date, default: Date.now },
      },
    ],
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["card", "wallet", "bank_transfer"],
    },
    totalPrice: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
