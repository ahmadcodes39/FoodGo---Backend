import { Router } from "express";
import { login, SignUp, updateProfile } from "../controllers/userController.js";
import { auth } from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import upload from "../config/multer.js";
import Restaurant from "../models/Restaurant.js";

const router = Router();

router.post("/signup", SignUp);
router.post("/login", login);
router.put(
  "/update-profile",
  auth,
  upload.fields([{ name: "profilePic" }]),
  updateProfile
);

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const restaurant = await Restaurant.findOne({ ownerId: user._id });

    // Convert to plain object
    const userObj = user.toObject();
    userObj.restaurantId = restaurant ? restaurant._id : null;
    
    // Include restaurant operational status for restaurantOwner
    if (user.role === "restaurantOwner" && restaurant) {
      userObj.operationalStatus = restaurant.operationalStatus;
    }

    // console.log(userObj); // restaurantId will now appear
    res.status(200).json(userObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


export default router;
