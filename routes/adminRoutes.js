import { Router } from "express";
import { approveRestaurant } from "../controllers/adminController.js";
import { auth } from "../middleware/authMiddleware.js";
const router = Router()

router.post("/:restaurantId/approve-restaurant",auth,approveRestaurant)

export default router 