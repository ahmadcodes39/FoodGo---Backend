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
  isAlreadyHaveAComplaint,
  makeAComplaint,
  placeOrder,
  updateOrderStatus,
} from "../controllers/customerController.js";
import { auth } from "../middleware/authMiddleware.js";
const router = Router();

// router.post("/update-status", auth, updateOrderStatus);
// router.get("/:restaurantId/get-orders", auth, getAllOrders);
// router.get("/:restaurantId/get-orderStats", auth, getTodayOrderStats);
// router.get(
//   "/:restaurantId/get-dashboardStats",
//   auth,
//   getRestaurantDashboardStats
// );
// router.get(
//   "/:restaurantId/get-restaurant-revenue", 
//   auth,
//   getRestaurantRevenueData
// );
// router.get("/:restaurantId/get-restaurant-analytics", auth, getAnalyticsStats);

///// 
router.get("/restaurant-cuisine", auth, getRestaurantCuisine);
router.get("/restaurant-front-info", getRestaurantFrontInfo);
router.get("/:restaurantId/restaurant-info", getRestaurantDetailInfo);
router.get("/my-orders",auth, getMyOrders);
router.get("/:orderId/detail-order",auth, getDetailOrder);
router.post("/place-order", auth, placeOrder);
router.post("/make-complaint", auth, makeAComplaint);
router.get("/check-isComplaint", auth, isAlreadyHaveAComplaint);
router.get("/complaints/my", auth, getMyComplaints);
router.get("/complaints", auth, getDetailComplaints);
 
export default router;
