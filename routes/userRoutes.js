import { Router } from "express";
import { login, SignUp } from "../controllers/userController.js";
import { auth } from "../middleware/authMiddleware.js"; 
import User from "../models/user.js";

const router = Router();

router.post("/signup", SignUp);
router.post("/login", login);

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
