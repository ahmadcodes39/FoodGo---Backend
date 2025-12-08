import { Router } from "express";
import {
  getAllOrders,
  getAnalyticsStats,
  getDetailComplaints,
  getDetailOrder,
  getMyComplaints,
  getMyOrders,
  getRestaurantCuisine,
  getRestaurantDashboardStats,
  getRestaurantDetailInfo,
  getRestaurantFrontInfo,
  getRestaurantRevenueData,
  getTodayOrderStats,
  makeAComplaint,
  placeOrder,
  updateOrderStatus,
} from "../controllers/customerController.js";
import { auth } from "../middleware/authMiddleware.js";
const router = Router();

router.post("/update-status", auth, updateOrderStatus);
router.get("/:restaurantId/get-orders", auth, getAllOrders);
router.get("/:restaurantId/get-orderStats", auth, getTodayOrderStats);
router.get(
  "/:restaurantId/get-dashboardStats",
  auth,
  getRestaurantDashboardStats
);
router.get(
  "/:restaurantId/get-restaurant-revenue", 
  auth,
  getRestaurantRevenueData
);
router.get("/:restaurantId/get-restaurant-analytics", auth, getAnalyticsStats);

/////
router.get("/restaurant-cuisine", auth, getRestaurantCuisine);
router.get("/restaurant-front-info", getRestaurantFrontInfo);
router.get("/:restaurantId/restaurant-info", getRestaurantDetailInfo);
router.get("/my-orders",auth, getMyOrders);
router.get("/:orderId/detail-order",auth, getDetailOrder);
router.post("/place-order", auth, placeOrder);
router.post("/make-complaint", auth, makeAComplaint);
router.get("/complaints/my", auth, getMyComplaints);
router.get("/:complaintId/complaints", auth, getDetailComplaints);

export default router;
