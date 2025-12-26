import { Router } from "express";
import {
  adminDashboardStas,
  approveRestaurant,
  fetchAllCustomers,
  fetchAllRestaurants,
  getAdminAnalytics,
  getAllComplaints,
  getAllOrders,
  getComplaints,
  getCustomerProfile,
  getRevenueGrowth,
  getSingleOrder,
  getSpecificRestaurantInfo,
  resolveComplaint,
  updateUserStatus,
} from "../controllers/adminController.js";
import { auth } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/approve-restaurant", auth, approveRestaurant);
router.get("/dashboard-stats", auth, adminDashboardStas);
router.get("/revenue-growth", auth, getRevenueGrowth);
router.get("/get-customer-profile", auth, getCustomerProfile);
router.get("/orders/all", auth, getAllOrders);
router.get("/:orderId/orders", auth, getSingleOrder);
router.get("/analytics",auth, getAdminAnalytics);
router.get("/fetch-all-restaurants", fetchAllRestaurants);
router.get("/fetch-all-customers", auth, fetchAllCustomers);
router.get("/:id/restaurant-info", getSpecificRestaurantInfo);
router.get("/get-complaints",auth,getAllComplaints)
router.put('/resolve-complaint',auth,resolveComplaint)
router.put('/update-user-status',auth,updateUserStatus)

// router.get("/complaints",auth,getComplaints);



// router.get("/:id/res-analytics", getRestaurantRevenue);


export default router;
