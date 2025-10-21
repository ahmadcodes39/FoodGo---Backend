import { Router } from "express";
import { getAllOrders, getAnalyticsStats, getRestaurantDashboardStats, getRestaurantRevenueData, getTodayOrderStats, placeOrder, updateOrderStatus } from "../controllers/orderController.js";
import { auth } from "../middleware/authMiddleware.js";
const router = Router();

router.post("/place-order", auth, placeOrder);
router.post("/update-status", auth, updateOrderStatus);
router.get("/:restaurantId/get-orders", auth, getAllOrders);
router.get("/:restaurantId/get-orderStats", auth, getTodayOrderStats);
router.get("/:restaurantId/get-dashboardStats", auth, getRestaurantDashboardStats);
router.get("/:restaurantId/get-restaurant-revenue", auth, getRestaurantRevenueData);
router.get("/:restaurantId/get-restaurant-analytics", auth, getAnalyticsStats);

export default router;

 