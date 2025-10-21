import mongoose from "mongoose";

const RestaurantsSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    restaurantPhoneNumber: {
      type: String,
      required: true,
      match: [
        /^[0-9]{10,15}$/,
        "Phone number must be between 10 and 15 digits",
      ],
    },
    address: { type: String, required: true }, 
    logo: {
      type: String,
      default: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
    },
    license: { type: String, required: true },
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    operationalStatus: {
      type: String,
      enum: ["active", "warned", "blocked"],
      default: "active",
    },
    cuisine: [String],
    description: { type: String, maxlength: 500 },
    openingHours: String,
    deliveryAvailable: { type: Boolean, default: true },
    deliveryTime: String,

    menu: [{ type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" }],
  },
  { timestamps: true }
);

const Restaurant = mongoose.model("Restaurant", RestaurantsSchema);
export default Restaurant;
