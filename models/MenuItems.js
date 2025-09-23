import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      required:true
    }, // e.g., "Pizza", "Burgers", "Drinks"
    image: {
      type: String,
      default: "https://cdn-icons-png.flaticon.com/512/149/149071.png", 
    },
  },
  { timestamps: true }
);

const MenuItems = mongoose.model("MenuItem", menuItemSchema);
export default MenuItems;
