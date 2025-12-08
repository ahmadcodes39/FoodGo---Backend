import MenuItems from "../models/MenuItems.js";
import Restaurant from "../models/Restaurant.js";
import { storeImageToCloud } from "../helperFunctions/imageToCloud.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import moment from "moment";
import {
  calculateRestaurantRevenue,
  calculateRestaurantOrderGrowth,
  getSellingItems,
} from "../helperFunctions/restaurantHelperFunctions.js";
import Complaint from "../models/Complaints.js";

export const registerRestaurant = async (req, res) => {
  try {
    const {
      name,
      restaurantPhoneNumber,
      address,
      cuisine,
      description,
      openingHours,
      deliveryAvailable,
      deliveryTime,
    } = req.body;

    const ownerId = req.user.id;

    if (req.user.role !== "restaurantOwner") {
      return res.status(403).json({
        success: false,
        message: "Only restaurant owners can register restaurants",
      });
    }

    const cuisineArray = Array.isArray(cuisine)
      ? cuisine
      : cuisine?.split(",").map((item) => item.trim());

    let logoUrl = null;
    let licenseUrl = null;

    if (req.files?.logo) {
      logoUrl = await storeImageToCloud(req.files.logo[0], "restaurant/logos");
    }

    if (req.files?.license) {
      licenseUrl = await storeImageToCloud(
        req.files.license[0],
        "restaurant/licenses"
      );
    }

    const restaurant = await Restaurant.create({
      ownerId,
      name,
      restaurantPhoneNumber,
      address,
      cuisine: cuisineArray,
      description,
      openingHours,
      deliveryAvailable,
      deliveryTime,
      logo: logoUrl || undefined,
      license: licenseUrl || undefined,
    });

    await User.findByIdAndUpdate(ownerId, { isOnBoarded: true });

    return res.status(201).json({
      success: true,
      restaurant,
    });
  } catch (error) {
    console.error("Register Restaurant Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const updateRestaurantDetails = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const {
      name,
      restaurantPhoneNumber,
      address,
      cuisine,
      description,
      openingHours,
      deliveryAvailable,
      deliveryTime,
    } = req.body;

    if (!restaurantId) {
      return res
        .status(400)
        .json({ success: false, message: "Restaurant Id is required" });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found" });
    }

    if (restaurant.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this restaurant",
      });
    }

    if (name) restaurant.name = name;
    if (restaurantPhoneNumber)
      restaurant.restaurantPhoneNumber = restaurantPhoneNumber;
    if (address) restaurant.address = address;
    if (cuisine)
      restaurant.cuisine = Array.isArray(cuisine)
        ? cuisine
        : cuisine.split(",");
    if (description) restaurant.description = description;
    if (openingHours) restaurant.openingHours = openingHours;
    if (deliveryAvailable !== undefined)
      restaurant.deliveryAvailable = deliveryAvailable;
    if (deliveryTime) restaurant.deliveryTime = deliveryTime;

    if (req.files?.logo) {
      restaurant.logo = await storeImageToCloud(
        req.files.logo[0],
        "restaurant/logos"
      );
    }
    if (req.files?.license) {
      restaurant.license = await storeImageToCloud(
        req.files.license[0],
        "restaurant/licenses"
      );
    }

    await restaurant.save();

    return res.status(200).json({
      success: true,
      restaurant,
    });
  } catch (error) {
    console.error("Update Restaurant Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const addMenuItems = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, price, category } = req.body;
    if (!restaurantId) {
      return res
        .status(400)
        .json({ success: false, message: "Resttaurant Id is not provided" });
    }
    if (!name || !price || !category) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const priceNumber = parseFloat(price);
    if (isNaN(priceNumber)) {
      return res
        .status(400)
        .json({ success: false, message: "Price must be a number" });
    }

    let imageUrl = await storeImageToCloud(
      req.files.image[0],
      "restaurant/menu-items"
    );
    const restaurant = await Restaurant.findById(restaurantId);
    if (restaurant.verificationStatus == "approved") {
      const menuItem = await MenuItems.create({
        restaurantId,
        name,
        price: priceNumber,
        image: imageUrl,
        category,
      });
      // push menuItem into restaurant.menu
      if (!restaurant) {
        return res
          .status(404)
          .json({ success: false, message: "Restaurant not found" });
      }

      restaurant.menu.push(menuItem._id);
      await restaurant.save();

      return res.status(201).json({
        success: true,
        menuItem,
      });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Restaurant is not approved!" });
    }
  } catch (error) {
    console.error("Menu Items Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const getMenuItems = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!restaurantId) {
      return res
        .status(400)
        .json({ success: false, message: "Restaurant ID is required" });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found" });
    }

    const menuItems = await MenuItems.find({ restaurantId });

    if (!menuItems || menuItems.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No menu items found" });
    }

    return res.status(200).json({
      success: true,
      restaurant,
      menuItems,
    });
  } catch (error) {
    console.error("Get Menu Items Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const updateMenuItem = async (req, res) => {
  try {
    const { restaurantId, menuItemId } = req.params;
    const { name, price, category } = req.body;

    if (!restaurantId || !menuItemId) {
      return res.status(400).json({
        success: false,
        message: "Restaurant ID and Menu Item ID are required",
      });
    }

    const menuItem = await MenuItems.findById(menuItemId);
    if (!menuItem) {
      return res
        .status(404)
        .json({ success: false, message: "Menu item not found" });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found" });
    }
    if (restaurant.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this menu item",
      });
    }

    if (name) menuItem.name = name;
    if (price) {
      const priceNumber = parseFloat(price);
      if (isNaN(priceNumber)) {
        return res
          .status(400)
          .json({ success: false, message: "Price must be a number" });
      }
      menuItem.price = priceNumber;
    }
    if (category) menuItem.category = category;
    menuItem.image = await storeImageToCloud(
      req.files.image[0],
      "restaurant/menu-items"
    );

    await menuItem.save();

    return res.status(200).json({
      success: true,
      menuItem,
    });
  } catch (error) {
    console.error("Update Menu Item Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const deleteMenuItem = async (req, res) => {
  try {
    const { restaurantId, menuItemId } = req.params;
    if (!restaurantId || !menuItemId) {
      return res.status(400).json({
        success: false,
        message: "Restaurant and Menu item Id's are required",
      });
    }
    const menuItem = await MenuItems.findById(menuItemId);
    if (!menuItem) {
      return res
        .status(404)
        .json({ success: false, message: "Menu item not found" });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found" });
    }
    if (restaurant.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this menu item",
      });
    }

    await MenuItems.findByIdAndDelete(menuItemId);
    restaurant.menu = restaurant.menu.filter(
      (id) => id.toString() !== menuItemId
    );
    await restaurant.save();

    return res
      .status(200)
      .json({ success: true, message: "Menu item deleted successfully" });
  } catch (error) {
    console.error("Delete Menu Item Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const getRestaurantDashboardStats = async (req, res) => {
  try {
    const restaurantId = req.params.id;
    const start = moment().startOf("day").toDate();
    const end = moment().endOf("day").toDate();

    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end },
    }).populate("orderItems");

    let totalRevenue = 0;
    let totalOrders = 0;
    const customerSet = new Set();

    const orderStatusCounts = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      arriving: 0,
      delivered: 0,
    };

    orders.forEach((order) => {
      let hasItemFromRestaurant = false;

      order.orderItems.forEach((item) => {
        if (item.restaurantId.toString() === restaurantId) {
          totalRevenue += item.price;
          totalOrders += 1;
          hasItemFromRestaurant = true;
        }
      });

      if (hasItemFromRestaurant) {
        customerSet.add(order.customerId.toString());
        if (orderStatusCounts.hasOwnProperty(order.status)) {
          orderStatusCounts[order.status]++;
        }
      }
    });

    totalRevenue = totalRevenue * 0.95;

    return res.status(200).json({
      success: true,
      totalRevenue,
      totalOrders,
      averageRevenue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      totalCustomers: customerSet.size,
      ordersByStatus: orderStatusCounts,
    });
  } catch (error) {
    console.error(error?.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const getRestaurantAllOrders = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const allOrders = await Order.find()
      .sort({ createdAt: -1 })
      .select("-statusHistory")
      .populate({
        path: "customerId",
        select: "name phone _id",
      })
      .populate({
        path: "orderItems",
        populate: [
          {
            path: "item",
            select: "name image category",
          },
          {
            path: "restaurantId",
            select: "name logo",
          },
        ],
      });

    const restaurantOrders = [];

    allOrders.forEach((order) => {
      // Get only items that belong to this restaurant
      const itemsForRestaurant = order.orderItems.filter(
        (item) => item.restaurantId._id.toString() === restaurantId
      );

      // Skip orders that do not contain this restaurant's items
      if (itemsForRestaurant.length === 0) return;

      // Calculate TOTAL PRICE for this restaurant only
      const totalPrice = itemsForRestaurant.reduce(
        (sum, item) => sum + item.price,
        0
      );

      // Build clean order object
      restaurantOrders.push({
        _id: order._id,
        customer: order.customerId,
        deliveryAddress: order.deliveryAddress,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        totalPrice: totalPrice,
        orderItems: itemsForRestaurant,
      });
    });

    return res.status(200).json({
      success: true,
      orders: restaurantOrders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;

    const targetedOrder = await Order.findById(orderId);
    if (!targetedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    targetedOrder.status = status;
    targetedOrder.statusHistory.push({
      status,
      time: new Date(),
    });

    await targetedOrder.save();

    return res
      .status(200)
      .json({ message: "Order status updated", order: targetedOrder });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getRestaurantRevenue = async (req, res) => {
  try {
    const restaurantId = req.params.id;
    const range = req.query.range || "weekly";

    const revenueData = await calculateRestaurantRevenue(restaurantId, range);

    return res.status(200).json({
      success: true,
      range,
      data: revenueData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

export const getRestaurantAnalytics = async (req, res) => {
  try {
    const restaurantId = req.params.id;
    const range = req.query.range || "weekly";

    const customerSet = new Set();

    const summary = {
      totalRevenue: 0,
      totalOrders: 0,
      totalCustomers: 0,
      confirmedOrders: 0,
      deliveredOrders: 0,
      averageRevenue: 0,
    };

    let startDate;

    if (range === "weekly") {
      startDate = moment().subtract(7, "days").startOf("day");
    } else if (range === "monthly") {
      startDate = moment().subtract(1, "month").startOf("day");
    } else if (range === "yearly") {
      startDate = moment().subtract(1, "year").startOf("day");
    }

    const orders = await Order.find({
      createdAt: { $gte: startDate.toDate() },
    }).populate("orderItems");

    orders.forEach((order) => {
      let restaurantRevenue = 0;
      let belongsToRestaurant = false;

      order.orderItems.forEach((item) => {
        if (item.restaurantId.toString() === restaurantId) {
          belongsToRestaurant = true;
          restaurantRevenue += item.price;
        }
      });

      if (!belongsToRestaurant) return;

      summary.totalOrders++;

      if (order.status === "confirmed") summary.confirmedOrders++;
      if (order.status === "delivered") summary.deliveredOrders++;

      customerSet.add(order.customerId.toString());

      summary.totalRevenue += restaurantRevenue * 0.95;
    });

    summary.totalCustomers = customerSet.size;
    summary.averageRevenue =
      summary.totalOrders > 0
        ? Number((summary.totalRevenue / summary.totalOrders).toFixed(2))
        : 0;

    const revenueChart = await calculateRestaurantRevenue(restaurantId, range);
    const orderGrowthChart = await calculateRestaurantOrderGrowth(
      restaurantId,
      range
    );
    const sellingItems = await getSellingItems(restaurantId);

    return res.status(200).json({
      success: true,
      analytics: summary,
      revenueChart,
      orderGrowthChart,
      sellingItems,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Analytics error",
      error: error.message,
    });
  }
};

export const makeAComplaint = async (req, res) => {
  try {
    const { reason, orderId, againstUser, againstRestaurant } = req.body;

    if (!reason || !orderId) {
      return res.status(400).json({
        success: false,
        message: "Reason and orderId are required",
      });
    }

    const restaurantId = req.user.id;

    const complaint = await Complaint.create({
      raisedBy: restaurantId,
      orderId,
      reason,
      complaintStatus: "Restaurant",
      againstUser: againstUser || null,
      againstRestaurant: againstRestaurant || null,
    });

    return res.status(201).json({
      success: true,
      complaint,
    });
  } catch (error) {
    console.error("Complaint error:", error);
    return res.status(500).json({
      success: false,
      message: "Complaint submission failed",
      error: error.message,
    });
  }
};

export const myComplaints = async (req, res) => {
  try {
    const restaurantId = req.user.id;

    // Get all complaints raised by this restaurant
    const complaints = await Complaint.find({
      complaintStatus: "Restaurant",
      raisedBy: restaurantId,
    });

    // If no complaints found
    if (complaints.length === 0) {
      return res.status(200).json({
        success: true,
        complaints: [],
        message: "No complaints found",
      });
    }

    // Fetch order for each complaint
    const complaintWithOrders = await Promise.all(
      complaints.map(async (complaint) => {
        const order = await Order.findById(complaint.orderId);
        return {
          complaint,
          order,
        };
      })
    );

    return res.status(200).json({
      success: true,
      complaints: complaintWithOrders,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: error?.message,
    });
  }
};

export const getMenuCategories = async (req, res) => {
  try {
    const restaurantId = req.params.id;
    if (!restaurantId) {
      return res
        .status(400)
        .json({ success: false, message: "Restaurant Id is required" });
    }
    let categories = [];
    const items = await MenuItems.find({ restaurantId: restaurantId });

    items.forEach((i) => {
      categories.push(i.category);
    });
    if (categories.length > 0) {
      return res.status(200).json({ success: true, categories: categories });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error in getting categories",
      error: error?.message,
    });
  }
};
