import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    item: {
      type: mongoose.Schema.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
    }
  },
  { timestamps: true }
);

const OrderItem =  mongoose.model("OrderItem", orderItemSchema);
export default OrderItem
