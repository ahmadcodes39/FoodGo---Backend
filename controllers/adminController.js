import Complaint from "../models/Complaints.js";
import MenuItems from "../models/MenuItems.js";
import Order from "../models/Order.js";
import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";
import moment from "moment";

export const approveRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.body;
    const { status } = req.body;

    if (!restaurantId || !status) {
      return res.status(400).json({
        message: "Both restaurantId and status are required",
      });
    }
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "Status must be either 'approved' or 'rejected'",
      });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        message: "Restaurant not found",
      });
    }

    restaurant.verificationStatus = status;
    await restaurant.save();

    return res.status(200).json({
      message: `Restaurant ${status} successfully!`,
      restaurant,
    });
  } catch (error) {
    console.error("Approve Restaurant Error:", error);
    return res.status(500).json({
      message: "Failed to update restaurant status",
      error: error.message,
    });
  }
};

export const adminDashboardStas = async (req, res) => {
  try {
    const orders = await Order.find();
    const totalCus = await User.countDocuments();
    const totalRes = await Restaurant.countDocuments();
    const totalOrders = await Order.countDocuments({ status: "confirmed" });
    const pendingReq = await Complaint.countDocuments({ status: "Pending" });

    const totalRevenue = orders.reduce((sum, order) => {
      return sum + (order.totalPrice || 0);
    }, 0);

    return res.status(200).json({
      success: true,
      stats: {
        totalCustomers: totalCus,
        totalRestaurants: totalRes,
        totaldOrders: totalOrders,
        pendingComplaints: pendingReq,
        totalRevenue: totalRevenue,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const getCustomerProfile = async (req, res) => {
  try {
    const userId = req.params.userId;

    // --- 1. Get User Details ---
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // --- 2. Get All Orders for The Customer ---
    const orders = await Order.find({ customerId: userId }).populate({
      path: "orderItems",
      populate: {
        path: "item restaurantId",
      },
    });

    // --- 3. Total Orders ---
    const totalOrders = orders.length;

    // --- 4. Total Spent ---
    const totalSpent = orders.reduce(
      (sum, order) => sum + (order.totalPrice || 0),
      0
    );

    // --- 5. Last Order Date ---
    const lastOrderDate =
      totalOrders > 0
        ? orders.map((o) => o.createdAt).sort((a, b) => b - a)[0]
        : null;

    // --- 6. Total Orders By Status ---
    const statusCounts = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      arriving: 0,
      delivered: 0,
    };

    orders.forEach((order) => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });

    // --- 7. Most Ordered Restaurant ---
    const restaurantCount = {};
    orders.forEach((order) => {
      order.orderItems.forEach((item) => {
        const resId = item.restaurantId?._id;
        if (!resId) return;

        restaurantCount[resId] = (restaurantCount[resId] || 0) + 1;
      });
    });

    let mostOrderedRestaurant = null;
    if (Object.keys(restaurantCount).length > 0) {
      const mostResId = Object.entries(restaurantCount).sort(
        (a, b) => b[1] - a[1]
      )[0][0];

      mostOrderedRestaurant = await Restaurant.findById(mostResId).select(
        "name logo"
      );
    }

    // --- 8. Most Ordered Menu Item ---
    const itemCount = {};
    orders.forEach((order) => {
      order.orderItems.forEach((orderItem) => {
        const itemId = orderItem.item?._id;
        if (!itemId) return;
        itemCount[itemId] = (itemCount[itemId] || 0) + orderItem.quantity;
      });
    });

    let mostOrderedItem = null;
    if (Object.keys(itemCount).length > 0) {
      const mostItemId = Object.entries(itemCount).sort(
        (a, b) => b[1] - a[1]
      )[0][0];

      mostOrderedItem = await MenuItems.findById(mostItemId).select(
        "name image price"
      );
    }

    // --- RESPONSE ---
    return res.status(200).json({
      success: true,
      profile: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        profilePic: user.profilePic,
        status: user.status,
        joinedDate: user.createdAt,
        totalOrders,
        totalSpent,
        lastOrderDate,

        ordersByStatus: statusCounts,
        mostOrderedRestaurant,
        mostOrderedItem,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("customerId", "name email")
      .populate({
        path: "orderItems",
        populate: [
          { path: "restaurantId", select: "name logo" },
          { path: "item", select: "name price" },
        ],
      })
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map((order) => {
      const restaurantName = order.orderItems[0]?.restaurantId?.name || "N/A";

      const totalItems = order.orderItems.length;

      return {
        orderId: order._id,
        customerName: order.customerId?.name,
        customerEmail: order.customerId?.email,
        restaurant: restaurantName,
        itemsCount: totalItems,
        totalPrice: order.totalPrice,
        createdDate: order.createdAt,
        status: order.status,
      };
    });

    return res.status(200).json({
      success: true,
      orders: formattedOrders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const getSingleOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate("customerId", "name email phone address")
      .populate({
        path: "orderItems",
        populate: [
          { path: "restaurantId", select: "name phone address" },
          { path: "item", select: "name price" },
        ],
      });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const getAdminAnalytics = async (req, res) => {
  try {
    const range = req.query.range || "monthly";

    // ------------------ BASIC STATS ------------------
    const totalCustomer = await User.countDocuments();
    const totalRestaurants = await Restaurant.countDocuments();
    const totalPendingRestaurants = await Restaurant.countDocuments({
      verificationStatus: "pending",
    });

    const summary = {
      totalCustomer,
      totalRestaurants,
      totalPendingRestaurants,
    };

    // ------------------ VALIDATE RANGE ------------------
    if (!["weekly", "monthly", "yearly"].includes(range)) {
      return res.status(400).json({
        success: false,
        message: "Invalid analytics range",
      });
    }

    // ------------------ CALCULATE CURRENT & PREVIOUS PERIOD ------------------
    let currentStart, currentEnd, previousStart, previousEnd;

    if (range === "weekly") {
      currentStart = moment().startOf("isoWeek").toDate();
      currentEnd = moment().endOf("isoWeek").toDate();
      previousStart = moment().subtract(1, "weeks").startOf("isoWeek").toDate();
      previousEnd = moment().subtract(1, "weeks").endOf("isoWeek").toDate();
    } else if (range === "monthly") {
      currentStart = moment().startOf("month").toDate();
      currentEnd = moment().endOf("month").toDate();
      previousStart = moment().subtract(1, "months").startOf("month").toDate();
      previousEnd = moment().subtract(1, "months").endOf("month").toDate();
    } else if (range === "yearly") {
      currentStart = moment().startOf("year").toDate();
      currentEnd = moment().endOf("year").toDate();
      previousStart = moment().subtract(1, "years").startOf("year").toDate();
      previousEnd = moment().subtract(1, "years").endOf("year").toDate();
    }

    // ------------------ FETCH ORDERS ------------------
    const currentOrders = await Order.find({
      createdAt: { $gte: currentStart, $lte: currentEnd },
    });

    const previousOrders = await Order.find({
      createdAt: { $gte: previousStart, $lte: previousEnd },
    });

    // ------------------ NEW vs RETURNING CUSTOMERS ------------------
    const currentCustomerIds = [
      ...new Set(currentOrders.map((o) => o.customerId?.toString())),
    ];

    let newCustomers = 0;
    let returningCustomers = 0;

    for (let customerId of currentCustomerIds) {
      const previousOrdersExist = await Order.exists({
        customerId,
        createdAt: { $lt: currentStart }, // any order before this period
      });

      if (previousOrdersExist) {
        returningCustomers++;
      } else {
        newCustomers++;
      }
    }

    const totalActiveCustomers = newCustomers + returningCustomers;

    let newCustomerPercentage = 0;
    let returningCustomerPercentage = 0;

    if (totalActiveCustomers > 0) {
      newCustomerPercentage = (newCustomers / totalActiveCustomers) * 100;
      returningCustomerPercentage =
        (returningCustomers / totalActiveCustomers) * 100;
    }

    // attach to summary
    summary.newCustomers = newCustomers;
    summary.returningCustomers = returningCustomers;
    summary.newCustomerPercentage = Number(newCustomerPercentage.toFixed(2));
    summary.returningCustomerPercentage = Number(
      returningCustomerPercentage.toFixed(2)
    );

    // ------------------ ADMIN REVENUE ------------------
    const adminRevenueCurrent = currentOrders.reduce(
      (sum, o) => sum + o.totalPrice * 0.05,
      0
    );

    const adminRevenuePrevious = previousOrders.reduce(
      (sum, o) => sum + o.totalPrice * 0.05,
      0
    );

    summary.adminRevenueCurrent = adminRevenueCurrent;
    summary.adminRevenuePrevious = adminRevenuePrevious;

    // ------------------ ORDER GROWTH ------------------
    let orderGrowth = [];

    if (range === "weekly") {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      orderGrowth = days.map((d) => ({ label: d, orders: 0 }));

      currentOrders.forEach((order) => {
        const day = moment(order.createdAt).format("ddd");
        const index = orderGrowth.findIndex((d) => d.label === day);
        if (index !== -1) orderGrowth[index].orders++;
      });
    }

    if (range === "monthly") {
      orderGrowth = [
        { label: "Week 1", orders: 0 },
        { label: "Week 2", orders: 0 },
        { label: "Week 3", orders: 0 },
        { label: "Week 4", orders: 0 },
      ];

      currentOrders.forEach((order) => {
        let week = Math.ceil(moment(order.createdAt).date() / 7);
        if (week > 4) week = 4;
        orderGrowth[week - 1].orders++;
      });
    }

    if (range === "yearly") {
      const months = moment.months();
      orderGrowth = months.map((m) => ({ label: m, orders: 0 }));

      currentOrders.forEach((order) => {
        const monthIndex = moment(order.createdAt).month();
        orderGrowth[monthIndex].orders++;
      });
    }

    // ------------------ REVENUE GROWTH ------------------
    const revenueGrowth = [];

    if (range === "weekly") {
      const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

      weekDays.forEach((day) => {
        const current = currentOrders
          .filter((o) => moment(o.createdAt).format("ddd") === day)
          .reduce((sum, o) => sum + o.totalPrice * 0.05, 0);

        const previous = previousOrders
          .filter((o) => moment(o.createdAt).format("ddd") === day)
          .reduce((sum, o) => sum + o.totalPrice * 0.05, 0);

        revenueGrowth.push({ label: day, current, previous });
      });
    }

    if (range === "monthly") {
      for (let i = 1; i <= 4; i++) {
        const current = currentOrders
          .filter((o) => Math.ceil(moment(o.createdAt).date() / 7) === i)
          .reduce((sum, o) => sum + o.totalPrice * 0.05, 0);

        const previous = previousOrders
          .filter((o) => Math.ceil(moment(o.createdAt).date() / 7) === i)
          .reduce((sum, o) => sum + o.totalPrice * 0.05, 0);

        revenueGrowth.push({ label: `Week ${i}`, current, previous });
      }
    }

    if (range === "yearly") {
      const months = moment.months();

      months.forEach((m, i) => {
        const current = currentOrders
          .filter((o) => moment(o.createdAt).month() === i)
          .reduce((sum, o) => sum + o.totalPrice * 0.05, 0);

        const previous = previousOrders
          .filter((o) => moment(o.createdAt).month() === i)
          .reduce((sum, o) => sum + o.totalPrice * 0.05, 0);

        revenueGrowth.push({ label: m, current, previous });
      });
    }

    // ------------------ RESTAURANT REVENUE (TOP 5) ------------------
    const restaurants = await Restaurant.find();

    const deliveredOrders = await Order.find({
      status: "delivered",
      createdAt: { $gte: currentStart, $lte: currentEnd },
    }).populate("orderItems");

    let restaurantStats = [];

    for (let rest of restaurants) {
      let totalOrders = 0;
      let totalRevenue = 0;

      deliveredOrders.forEach((order) => {
        order.orderItems.forEach((item) => {
          if (item.restaurantId.toString() === rest._id.toString()) {
            totalOrders++;
            totalRevenue += item.price;
          }
        });
      });

      const restaurantRevenue = totalRevenue * 0.95;

      restaurantStats.push({
        restaurantId: rest._id,
        name: rest.name,
        status: rest.operationalStatus,
        totalOrders,
        totalRevenue: restaurantRevenue,
      });
    }

    restaurantStats.sort((a, b) => b.totalRevenue - a.totalRevenue);
    const topRestaurants = restaurantStats.slice(0, 5);

    // For chart
    const restaurantsRevenue = topRestaurants.map((r) => ({
      name: r.name,
      revenue: r.totalRevenue,
    }));

    // ------------------ TODAY ORDER SUMMARY ------------------
    const startOfDay = moment().startOf("day").toDate();
    const endOfDay = moment().endOf("day").toDate();

    const todayOrders = await Order.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    let pending = 0,
      confirmed = 0,
      preparing = 0,
      arriving = 0,
      delivered = 0;

    todayOrders.forEach((order) => {
      if (order.status === "pending") pending++;
      if (order.status === "confirmed") confirmed++;
      if (order.status === "preparing") preparing++;
      if (order.status === "arriving") arriving++;
      if (order.status === "delivered") delivered++;
    });

    // ------------------ RESPONSE ------------------
    return res.json({
      success: true,
      summary,
      orderGrowth,
      revenueGrowth,
      topRestaurants,
      restaurantsRevenue,
      todayOrders: { pending, confirmed, preparing, arriving, delivered },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Analytics fetch error",
      error: error.message,
    });
  }
};

export const getComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find();

    return res.status(200).json({
      success: true,
      complaints,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const fetchAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find();

    if (!restaurants || restaurants.length === 0) {
      return res.status(404).json({
        message: "No restaurants found",
      });
    }
    return res.status(200).json({
      success: true,
      restaurants,
    });
  } catch (error) {
    console.error("Fetch  Restaurants Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find();
    return res.status(200).json({ success: true, complaints });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error in getting complaints",
      error: error?.message,
    });
  }
};

export const resolveComplaint = async (req, res) => {
  try {
    const { complaintId, responseToCustomer, responseToRestaurant , managerAction } = req.body;
    const targetComplaint = await Complaint.findById(complaintId);
    if (!targetComplaint) {
      return res
        .status(500)
        .json({ success: false, message: "Such compaint not found" });
    }
    targetComplaint.responseToCustomer = responseToCustomer || null;
    targetComplaint.responseToRestaurant = responseToRestaurant || null;
    targetComplaint.managerAction = managerAction || "None"
    await targetComplaint.save();
    return res.status(200).json({
      success: true,
      complaint:targetComplaint,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "server error complaint not updates",
      error: error?.message,
    });
  }
};
