import { Router } from "express";
import {
  adminDashboardStas,
  approveRestaurant,
  fetchAllRestaurants,
  getAdminAnalytics,
  getAllComplaints,
  getAllOrders,
  getComplaints,
  getCustomerProfile,
  getSingleOrder,
  resolveComplaint,
} from "../controllers/adminController.js";
import { auth } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/approve-restaurant", auth, approveRestaurant);
router.get("/dashboard-stats", auth, adminDashboardStas);
router.get("/:userId/get-customer-profile", auth, getCustomerProfile);
router.get("/orders/all", getAllOrders);
router.get("/:orderId/orders", auth, getSingleOrder);
router.get("/fetch-all-restaurants", fetchAllRestaurants);
router.get("/analytics",auth, getAdminAnalytics);
router.get("/complaints",auth,getComplaints);
router.get("/get-complaints",auth,getAllComplaints)
router.patch('/resolve-complaint',resolveComplaint)




// router.get("/:id/res-analytics", getRestaurantRevenue);


export default router;
