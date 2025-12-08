import Order from "../models/Order.js";
import MenuItem from "../models/MenuItems.js";
import OrderItem from "../models/OrderItem.js";
import { stripe } from "../config/stripe.js";
import { formatDistanceToNow } from "date-fns";
import mongoose, { set, trusted } from "mongoose";
import dotenv from "dotenv";
import Restaurant from "../models/Restaurant.js";
import moment from "moment";
import Complaint from "../models/Complaints.js";

dotenv.config();

export const placeOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { items, deliveryAddress } = req.body;
    const customerId = req.user.id;

    if (!items || items.length === 0 || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: "Items and delivery address are required",
      });
    }

    // Extract menuItem IDs
    const menuItemIds = items.map((i) => i.menuItem);
    const menuItems = await MenuItem.find({
      _id: { $in: menuItemIds },
    }).session(session);

    const menuMap = new Map(menuItems.map((m) => [m._id.toString(), m]));

    // -------------------------------
    // 1️⃣ Group items by restaurantId
    // -------------------------------
    const grouped = {}; // { restaurantId: [items] }

    for (const item of items) {
      if (!grouped[item.restaurantId]) {
        grouped[item.restaurantId] = [];
      }
      grouped[item.restaurantId].push(item);
    }

    // -------------------------------
    // 2️⃣ Create separate orders
    // -------------------------------
    const createdOrders = [];
    const allOrderItemIds = []; // for Stripe

    for (const restaurantId of Object.keys(grouped)) {
      const restaurantItems = grouped[restaurantId];

      let totalPrice = 0;
      const orderItemsToCreate = [];

      // Build Order Items
      for (const cartItem of restaurantItems) {
        const menu = menuMap.get(cartItem.menuItem);
        if (!menu) throw new Error("Menu item not found!");

        const price = menu.price * cartItem.quantity;
        totalPrice += price;

        orderItemsToCreate.push({
          restaurantId,
          item: menu._id,
          quantity: cartItem.quantity,
          price: price,
        });
      }

      // Create OrderItems in DB
      const createdOrderItems = await OrderItem.insertMany(orderItemsToCreate, {
        session,
      });

      const orderItemIds = createdOrderItems.map((i) => i._id);
      allOrderItemIds.push(...createdOrderItems);

      // Create ONE order per restaurant
      const order = await Order.create(
        [
          {
            customerId,
            orderItems: orderItemIds,
            deliveryAddress,
            totalPrice,
            paymentStatus: "pending",
            status: "pending",
            paymentMethod: "card",
            restaurantId, // Optional: store main restaurant for easier queries
          },
        ],
        { session }
      );

      createdOrders.push(order[0]);
    }

    // 🧡 Create one Stripe session for whole cart (multiple restaurants)
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],

      line_items: items.map((cartItem) => {
        const menu = menuMap.get(cartItem.menuItem);
        return {
          price_data: {
            currency: "usd",
            product_data: {
              name: menu.name,
            },
            unit_amount: Math.round(menu.price * 100),
          },
          quantity: cartItem.quantity,
        };
      }),

      mode: "payment",

      metadata: {
        orderIds: createdOrders.map((o) => o._id.toString()).join(","), // important
      },

      success_url: `${process.env.CLIENT_URL}/payment-success`,
      cancel_url: `${process.env.CLIENT_URL}/payment-cancel`,
    });

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Orders created successfully. Proceed to payment.",
      stripeUrl: stripeSession.url,
      orderIds: createdOrders.map((o) => o._id),
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("PlaceOrder Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

export const getRestaurantCuisine = async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    let cuisine = new Set();

    restaurants.forEach((rest) => {
      rest.cuisine.forEach((c) => cuisine.add(c));
    });

    if (cuisine.size > 0) {
      return res.status(200).json({
        success: true,
        cuisine: Array.from(cuisine),
      });
    } else {
      return res.status(200).json({
        success: true,
        cuisine: [],
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "server error",
      error: error?.message,
    });
  }
};

export const getRestaurantFrontInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const skip = (page - 1) * limit;

    // Fetch restaurants with selected fields
    const restaurants = await Restaurant.find({
      verificationStatus: "approved",
      operationalStatus: "active",
    })
      .select("logo deliveryAvailable name cuisine deliveryTime") // same fields as your old function
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Restaurant.countDocuments({
      verificationStatus: "approved",
      operationalStatus: "active",
    });

    return res.status(200).json({
      success: true,
      restaurants,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error in fetching restaurant info",
      error: error?.message,
    });
  }
};

export const getRestaurantDetailInfo = async (req, res) => {
  try {
    const { restaurantId } = req.params.id;

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: "Restaurant Id is required",
      });
    }

    // get restaurant with selected fields + populate menu
    const restaurantInfo = await Restaurant.findById(restaurantId)
      .select(
        "logo name cuisine description address restaurantPhoneNumber openingHours deliveryTime deliveryAvailable menu"
      )
      .populate("menu");

    if (!restaurantInfo) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // collect unique categories
    let categories = new Set();
    restaurantInfo.menu.forEach((item) => {
      categories.add(item.category);
    });

    return res.status(200).json({
      success: true,
      info: restaurantInfo,
      categories: Array.from(categories),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error in getting restaurant info",
      error: error?.message,
    });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const customerId = req.user.id;

    const orders = await Order.find({ customerId })
      .select(
        "_id customerId status totalPrice createdAt updatedAt __v orderItems statusHistory"
      )
      .sort({ createdAt: -1 })
      .populate({
        path: "orderItems",
        select: "restaurantId -_id",
        populate: {
          path: "restaurantId",
          select: "name logo -_id",
        },
      });

    // Add deliveredAt field for orders with status 'delivered'
    const ordersWithDeliveredAt = orders.map((order) => {
      let deliveredAt = null;
      if (order.status === "delivered" && order.statusHistory.length > 0) {
        // find the time when status was set to 'delivered'
        const deliveredStatus = order.statusHistory.find(
          (s) => s.status === "delivered"
        );
        if (deliveredStatus) {
          deliveredAt = deliveredStatus.time;
        }
      }

      // return order as plain object with deliveredAt
      return {
        ...order.toObject(),
        deliveredAt,
      };
    });

    return res.status(200).json({ orders: ordersWithDeliveredAt });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error getting order detail",
      error: error.message,
    });
  }
};

export const getDetailOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    // REMOVE select or include orderItems
    const order = await Order.findById(orderId).select(
      "statusHistory deliveryAddress totalPrice orderItems"
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    await order.populate([
      {
        path: "orderItems",
        populate: [
          { path: "item", select: "name price" },
          { path: "restaurantId", select: "name logo" },
        ],
      },
    ]);

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error getting order detail",
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
    const customerId = req.user.id;

    const complaint = await Complaint.create({
      raisedBy: customerId,
      orderId,
      reason,
      complaintStatus: "Customer",
      againstUser: againstUser || null,
      againstRestaurant: againstRestaurant || null,
    });
    return res.status(201).json({
      success: true,
      complaint,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error in making complaints",
      error: error.message,
    });
  }
};

export const getMyComplaints = async (req, res) => {
  try {
    const customerId = req.user.id;

    const myComplaints = await Complaint.find({
      raisedBy: customerId,
    })
      .select("-againstUser -responseToCustomer -responseToRestaurant")
      .populate("againstRestaurant", "name logo")
      .populate("orderId", "_id");

    return res.status(200).json({
      success: true,
      complaints: myComplaints,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaints",
      error: error.message,
    });
  }
};
export const getDetailComplaints = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { complaintId } = req.params;

    const myComplaints = await Complaint.find({
      raisedBy: customerId,
      _id: complaintId,
    })
      .select("-againstUser -responseToCustomer -responseToRestaurant")
      .populate("againstRestaurant", "name logo")
      .populate(
        "orderId",
        "_id deliveryAddress paymentMethod paymentStatus totalPrice statusHistory"
      );

    return res.status(200).json({
      success: true,
      complaints: myComplaints,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaints",
      error: error.message,
    });
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

    // Find the order first
    const order = await Order.findById(orderId)
      .populate("orderItems")
      .populate("customerId", "name phone");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // ✅ Push new status into history before saving
    order.status = status;
    order.statusHistory.push({ status, time: new Date() });

    const updatedOrder = await order.save();

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
    const statuses = [
      "pending",
      "confirmed",
      "preparing",
      "arriving",
      "delivered",
    ];
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
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
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
