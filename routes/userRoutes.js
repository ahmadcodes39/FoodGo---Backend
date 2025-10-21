import { Router } from "express";
import { login, SignUp, updateProfile } from "../controllers/userController.js";
import { auth } from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import upload from "../config/multer.js";

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
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
