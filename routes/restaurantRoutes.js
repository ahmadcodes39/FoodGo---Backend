import { Router } from "express";
import { auth } from "../middleware/authMiddleware.js";
import upload from "../config/multer.js";
import {
  addMenuItems,
  deleteMenuItem,
  fetchApprovedRestaurants,
  registerRestaurant,
  updateDetails,
  getMenuItems,
  updateMenuItem,
} from "../controllers/restaurantController.js";
const router = Router();

router.post(
  "/register",
  auth,
  upload.fields([{ name: "logo" }, { name: "license" }]),
  registerRestaurant
);
router.put(
  "/:restaurantId/updateDetails",
  auth,
  upload.fields([{ name: "logo" }, { name: "license" }]),
  updateDetails
);
router.post(
  "/:restaurantId/add-menu",
  auth,
  upload.fields([{ name: "image" }]),
  addMenuItems
);
router.get(
  "/:restaurantId/get-menu",
  auth,
  getMenuItems
);
router.put(
  "/:restaurantId/:menuItemId/add-menu",
  auth,
  upload.fields([{ name: "image" }]),
  updateMenuItem
);


router.delete("/:restaurantId/:menuItemId/delete-menu", auth, deleteMenuItem);

router.get("/fetch-restaurants", auth, fetchApprovedRestaurants);

export default router;
