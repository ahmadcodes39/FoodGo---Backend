import Order from "../models/Order.js";
import MenuItem from "../models/MenuItems.js";
import OrderItem from "../models/OrderItem.js";
import { stripe } from "../config/stripe.js";
import { formatDistanceToNow } from "date-fns";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const placeOrder = async (req, res) => {
  // Start a new session for the transaction
  const session = await mongoose.startSession();

  try {
    // Start the transaction
    session.startTransaction();

    const { items, deliveryAddress } = req.body;
    const customerId = req.user.id;

    if (!items || items.length === 0 || !deliveryAddress) {
      return res
        .status(400)
        .json({ message: "Items and delivery address are required" });
    }

    // --- 1. Performance Optimization: Bulk Fetch Menu Items ---
    const menuItemIds = items.map((item) => item.menuItem);
    const menuItems = await MenuItem.find({
      _id: { $in: menuItemIds },
    }).session(session);

    // Create a map for efficient lookups (O(1) access)
    const menuItemMap = new Map(
      menuItems.map((item) => [item._id.toString(), item])
    );

    let totalPrice = 0;
    const orderItemsToCreate = [];

    // This loop now performs no database calls
    for (const item of items) {
      const menuItem = menuItemMap.get(item.menuItem);
      if (!menuItem) {
        // If any item is not found, the entire transaction should fail
        throw new Error(`Menu item with ID ${item.menuItem} not found`);
      }

      const price = menuItem.price * item.quantity;
      totalPrice += price;

      orderItemsToCreate.push({
        restaurantId: item.restaurantId,
        item: menuItem._id,
        quantity: item.quantity,
        price: price,
      });
    }

    // --- 2. Performance Optimization: Bulk Create Order Items ---
    const createdOrderItems = await OrderItem.insertMany(orderItemsToCreate, {
      session,
    });
    const orderItemIds = createdOrderItems.map((item) => item._id);

    // --- 3. Create the Final Order ---
    // Using new Order() and order.save() to create the document within the session
    const order = new Order({
      customerId,
      orderItems: orderItemIds,
      deliveryAddress,
      totalPrice,
      paymentStatus: "pending",
      status: "pending",
      paymentMethod: "card",
    });
    await order.save({ session });

    // --- 4. Create Stripe Checkout Session ---
    const sessionStripe = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: items.map((item) => {
        const menuItem = menuItemMap.get(item.menuItem);
        return {
          price_data: {
            currency: "usd",
            product_data: {
              name: menuItem.name,
            },
            unit_amount: Math.round(menuItem.price * 100),
          },
          quantity: item.quantity,
        };
      }),
      mode: "payment",
      metadata: {
        orderId: order._id.toString(),
      },
      success_url: `${process.env.CLIENT_URL}/payment-success?orderId=${order._id}`,
      cancel_url: `${process.env.CLIENT_URL}/payment-cancel?orderId=${order._id}`,
    });

    // If everything is successful, commit the transaction
    await session.commitTransaction();

    return res.status(201).json({
      message: "Order created successfully. Proceed to payment.",
      url: sessionStripe.url, // ✅ redirect to this in frontend
      orderId: order._id,
    });
  } catch (error) {
    // If any error occurs, abort the transaction
    await session.abortTransaction();
    console.error("Place Order Transaction Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  } finally {
    // Always end the session
    session.endSession();
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    let ordersData = await Order.find()
      .populate({
        path: "orderItems",
        populate: {
          path: "item",
          model: "MenuItem",
          match: { restaurantId },
        },
      })
      .populate({
        path: "customerId",
        model: "User",
        select: "name phone",
      })
      .sort({ createdAt: -1 });

    // filter and add extra props
    ordersData = ordersData
      .map((order) => {
        const filteredItems = order.orderItems.filter((oi) => oi.item !== null);

        return {
          ...order.toObject(),
          orderItems: filteredItems,
          totalItems: filteredItems.reduce((sum, oi) => sum + oi.quantity, 0),

          timeAgo: formatDistanceToNow(new Date(order.createdAt), {
            addSuffix: true,
          }),
        };
      })
      .filter((order) => order.orderItems.length > 0);

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
      "arriving",
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

export const getTodayOrderStats = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const statuses = ["pending", "confirmed", "preparing", "arriving", "delivered"];
    const orderStats = {};

    // Date range
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    for (const status of statuses) {
      // Find all orders for today with that status
      const orders = await Order.find({
        status,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      }).populate("orderItems");

      // Filter only orders belonging to this restaurant
      const filteredOrders = orders.filter((order) =>
        order.orderItems.some(
          (item) => item.restaurantId.toString() === restaurantId
        )
      );

      orderStats[status] = filteredOrders.length;
    }

    res.json({ message: "Today's order stats fetched", orderStats });
  } catch (error) {
    console.error("Order stats Error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
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
    orders = orders.map((order) => {
      const filteredItems = order.orderItems.filter(
        (oi) => oi.item && oi.item.restaurantId.toString() === restaurantId
      );

      return {
        ...order.toObject(),
        orderItems: filteredItems,
      };
    });

    // ✅ Step 3: Remove empty orders
    orders = orders.filter((order) => order.orderItems.length > 0);

    // ✅ Step 4: Calculate stats
    const todayOrders = orders.length;
    const todaySales = orders.reduce((sum, o) => sum + o.totalPrice, 0);
    const avgRevenue = todayOrders > 0 ? todaySales / todayOrders : 0;
    const customers = new Set(orders.map((o) => o.customerId?._id.toString()))
      .size;

    return res.json({
      message: "Dashboard stats fetched successfully",
      stats: {
        todayOrders,
        todaySales,
        avgRevenue,
        customers,
      },
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

export const getRestaurantRevenueData = async (req, res) => {
  try {
    // Fetch all PAID orders (only consider completed payments)
    const orders = await Order.find({ paymentStatus: "paid" });

    const now = new Date();

    // Helper functions to filter data by time range
    const isThisWeek = (date) => {
      const today = new Date();
      const firstDayOfWeek = new Date(today);
      firstDayOfWeek.setDate(today.getDate() - today.getDay());
      firstDayOfWeek.setHours(0, 0, 0, 0);

      const lastDayOfWeek = new Date(firstDayOfWeek);
      lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
      lastDayOfWeek.setHours(23, 59, 59, 999);

      return date >= firstDayOfWeek && date <= lastDayOfWeek;
    };

    const isThisMonth = (date) => {
      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    };

    const isThisYear = (date) => {
      return date.getFullYear() === now.getFullYear();
    };

    // 1️⃣ WEEKLY DATA
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyData = days.map((day) => ({ name: day, revenue: 0 }));

    orders.forEach((order) => {
      const orderDate = new Date(order.createdAt);
      if (isThisWeek(orderDate)) {
        const day = orderDate.getDay(); // 0 = Sunday
        weeklyData[day].revenue += order.totalPrice;
      }
    });

    // 2️⃣ MONTHLY DATA (group into 4 weeks)
    const monthlyData = [
      { name: "Week 1", revenue: 0 },
      { name: "Week 2", revenue: 0 },
      { name: "Week 3", revenue: 0 },
      { name: "Week 4", revenue: 0 },
    ];

    orders.forEach((order) => {
      const orderDate = new Date(order.createdAt);
      if (isThisMonth(orderDate)) {
        const weekOfMonth = Math.floor(orderDate.getDate() / 7); // 0–3
        if (monthlyData[weekOfMonth]) {
          monthlyData[weekOfMonth].revenue += order.totalPrice;
        }
      }
    });

    // 3️⃣ YEARLY DATA
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const yearlyData = months.map((m) => ({ name: m, revenue: 0 }));

    orders.forEach((order) => {
      const orderDate = new Date(order.createdAt);
      if (isThisYear(orderDate)) {
        const monthIndex = orderDate.getMonth(); // 0–11
        yearlyData[monthIndex].revenue += order.totalPrice;
      }
    });

    res.status(200).json({
      message: "Revenue data fetched successfully",
      weeklyData,
      monthlyData,
      yearlyData,
    });
  } catch (error) {
    console.error("Revenue data error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const getAnalyticsStats = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // ✅ Step 1: Fetch all orders (no date filter)
    let orders = await Order.find({})
      .populate({
        path: "orderItems",
        populate: {
          path: "item",
          model: "MenuItem",
        },
      })
      .populate("customerId", "name");

    // ✅ Step 2: Filter only orders containing items from this restaurant
    orders = orders.map((order) => {
      const filteredItems = order.orderItems.filter(
        (oi) => oi.item && oi.item.restaurantId.toString() === restaurantId
      );
      return {
        ...order.toObject(),
        orderItems: filteredItems,
      };
    });

    // ✅ Step 3: Remove orders that don’t belong to this restaurant
    orders = orders.filter((order) => order.orderItems.length > 0);

    // ✅ Step 4: Calculate analytics stats
    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, o) => sum + o.totalPrice, 0);
    const avgRevenue = totalOrders > 0 ? totalSales / totalOrders : 0;
    const totalCustomers = new Set(
      orders.map((o) => o.customerId?._id.toString())
    ).size;

    // ✅ Step 5: Get order count by status (e.g. pending, confirmed, delivered)
    const statusCounts = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      arriving: 0,
      delivered: 0,
    };

    orders.forEach((order) => {
      if (statusCounts[order.status] !== undefined) {
        statusCounts[order.status]++;
      }
    });

    // ✅ Step 6: Payment status stats (optional)
    const paymentStats = {
      paid: 0,
      pending: 0,
      failed: 0,
    };

    orders.forEach((order) => {
      if (paymentStats[order.paymentStatus] !== undefined) {
        paymentStats[order.paymentStatus]++;
      }
    });

    // ✅ Step 7: Return all-time stats
    res.json({
      message: "All-time analytics fetched successfully",
      stats: {
        totalOrders,
        totalSales,
        avgRevenue,
        totalCustomers,
        statusCounts,
        paymentStats,
      },
    });
  } catch (error) {
    console.error("Analytics Stats Error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

