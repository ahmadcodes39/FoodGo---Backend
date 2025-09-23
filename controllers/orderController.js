import Order from "../models/Order.js";
import MenuItem from "../models/MenuItems.js";
import OrderItem from "../models/OrderItem.js";
import mongoose from "mongoose";

export const placeOrder = async (req, res) => {
  try {
    const { items, deliveryAddress } = req.body;
    const customerId = req.user.id;

    if (!items || items.length === 0 || !deliveryAddress) {
      return res
        .status(400)
        .json({ message: "Items and delivery address are required" });
    }

    // Group items by restaurant
    const restaurantGroups = {};
    for (const item of items) {
      if (!restaurantGroups[item.restaurantId]) {
        restaurantGroups[item.restaurantId] = [];
      }
      restaurantGroups[item.restaurantId].push(item);
    }

    const orders = [];

    //  Create separate orders per restaurant
    for (const [restaurantId, restaurantItems] of Object.entries(
      restaurantGroups
    )) {
      let orderItemIds = [];
      let totalPrice = 0;

      for (const item of restaurantItems) {
        const menuItem = await MenuItem.findById(item.menuItem);
        if (!menuItem) {
          return res
            .status(404)
            .json({ message: `Menu item ${item.menuItem} not found` });
        }

        const orderItem = await OrderItem.create({
          restaurantId,
          item: menuItem._id,
          quantity: item.quantity,
          price: menuItem.price * item.quantity,
        });

        orderItemIds.push(orderItem._id);
        totalPrice += menuItem.price * item.quantity;
      }

      const order = await Order.create({
        customerId,
        orderItems: orderItemIds,
        deliveryAddress,
        totalPrice,
        status: "pending",
        paymentStatus: "paid",
      });

      orders.push(order);
    }

    return res.status(201).json({
      message: "Orders placed successfully",
      orders, // this give us order per restaurant
    });
  } catch (error) {
    console.error("Place Order Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // ✅ Find all orders and populate
    let ordersData = await Order.find()
      .populate({
        path: "orderItems",
        populate: {
          path: "item",
          model: "MenuItem",
          match: { restaurantId }, // only populate if item belongs to this restaurant
        },
      })
      .populate({
        path: "customerId",
        model: "User",
        select: "name phone",
      });

    // ✅ Remove items that are null (because they don't belong to this restaurant)
    ordersData = ordersData.map((order) => {
      const filteredItems = order.orderItems.filter((oi) => oi.item !== null);

      return {
        ...order.toObject(),
        orderItems: filteredItems,
        totalItems: filteredItems.reduce((sum, oi) => sum + oi.quantity, 0), // ✅ sum quantities
      };
    });

    // ✅ Remove orders with no items after filtering
    ordersData = ordersData.filter((order) => order.orderItems.length > 0);

    if (!ordersData || ordersData.length === 0) {
      return res.status(404).json({ message: "No orders data found" });
    }

    return res.status(200).json({
      message: "Data fetched successfully",
      ordersData,
    });
  } catch (error) {
    console.error("Get Orders Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status, orderId } = req.body;

    const validStatuses = [
      "pending",
      "confirmed",
      "preparing",
      "out-for-delivery",
      "delivered",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Allowed values: ${validStatuses.join(", ")}`,
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    )
      .populate("orderItems")
      .populate("customerId", "name phone");

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.status(200).json({
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Update Order Status Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const getOrderStats = async (req, res) => {
  try {
    const statuses = [
      "pending",
      "confirmed",
      "preparing",
      "out-for-delivery",
      "delivered",
    ];
    const orderStats = {};

    for (let status of statuses) {
      orderStats[status] = await Order.countDocuments({ status });
    }

    res.json({ message: "Order stats fetched", orderStats });
  } catch (error) {
    console.error("Order stats Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

export const getRestaurantDashboardStats = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // ✅ Today’s start & end time
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // ✅ Step 1: Get all today's orders
    let orders = await Order.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .populate({
        path: "orderItems",
        populate: {
          path: "item",
          model: "MenuItem",
        },
      })
      .populate("customerId", "name");

    // ✅ Step 2: Filter only items from this restaurant
    orders = orders.map(order => {
      const filteredItems = order.orderItems.filter(
        oi => oi.item && oi.item.restaurantId.toString() === restaurantId
      );

      return {
        ...order.toObject(),
        orderItems: filteredItems,
      };
    });

    // ✅ Step 3: Remove empty orders
    orders = orders.filter(order => order.orderItems.length > 0);

    // ✅ Step 4: Calculate stats
    const todayOrders = orders.length;
    const todaySales = orders.reduce((sum, o) => sum + o.totalPrice, 0);
    const avgOrder = todayOrders > 0 ? todaySales / todayOrders : 0;
    const customers = new Set(orders.map(o => o.customerId?._id.toString())).size;

    return res.json({
      message: "Dashboard stats fetched successfully",
      stats: {
        todayOrders,
        todaySales,
        avgOrder,
        customers,
      },
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};
