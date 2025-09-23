import { Router } from "express";
import { getAllOrders, getOrderStats, getRestaurantDashboardStats, placeOrder, updateOrderStatus } from "../controllers/orderController.js";
import { auth } from "../middleware/authMiddleware.js";
const router = Router();

router.post("/place-order", auth, placeOrder);
router.post("/update-status", auth, updateOrderStatus);
router.get("/:restaurantId/get-orders", auth, getAllOrders);
router.get("/:restaurantId/get-orderStats", auth, getOrderStats);
router.get("/:restaurantId/get-dashboardStats", auth, getRestaurantDashboardStats);

export default router;
