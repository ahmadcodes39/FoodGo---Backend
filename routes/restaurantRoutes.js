import { Router } from "express";
import { auth } from "../middleware/authMiddleware.js";
import upload from "../config/multer.js";
import {
  addMenuItems,
  deleteMenuItem,
  registerRestaurant,
  updateRestaurantDetails,
  getMenuItems,
  updateMenuItem,
  getRestaurantDashboardStats,
  getRestaurantAllOrders,
  getRestaurantRevenue,
  getRestaurantAnalytics,
  makeAComplaint,
  updateOrderStatus,
  myComplaints,
  getMenuCategories,
  getRestaurantStatus,
  getRestaurantDetails
} from "../controllers/restaurantController.js";
const router = Router();

// register restaurant
router.post(
  "/register",
  auth,
  upload.fields([{ name: "logo" }, { name: "license" }]),
  registerRestaurant
);

router.get("/:restaurantId/get-detail",auth,getRestaurantDetails)

// update restaurant details
router.put(
  "/:restaurantId/update-restaurant-details",
  auth,
  upload.fields([{ name: "logo" }, { name: "license" }]),
  updateRestaurantDetails
);
// add menu items
router.post(
  "/:restaurantId/add-menu",
  auth,
  upload.fields([{ name: "image" }]),
  addMenuItems
);
// get menu items
router.get("/:restaurantId/get-menu", auth, getMenuItems);
// update menu items
router.put(
  "/:restaurantId/:menuItemId/update-menu",
  auth,
  upload.fields([{ name: "image" }]),
  updateMenuItem
);
// delete menu items
router.delete("/:restaurantId/:menuItemId/delete-menu", auth, deleteMenuItem);
// get dashboard stats
router.get("/:id/dashboard-stats", auth, getRestaurantDashboardStats);

// get all orders
router.get("/:restaurantId/orders",auth, getRestaurantAllOrders);

router.get("/:id/revenue", auth, getRestaurantRevenue);
router.get("/:id/analytics",auth, getRestaurantAnalytics);
router.post("/make-complaint",auth, makeAComplaint);
router.post("/update-order-status",auth,updateOrderStatus)
router.get("/my-complaints",auth,myComplaints)
router.get("/:id/menu-categories",auth,getMenuCategories)
router.get("/status", auth, getRestaurantStatus);

export default router; 
 