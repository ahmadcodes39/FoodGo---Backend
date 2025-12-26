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
    const totalCus = await User.find({ role: "customer" }).countDocuments();
    const totalRes = await Restaurant.countDocuments();
    const totalOrders = await Order.countDocuments();
    const pendingReq = await Complaint.countDocuments({ status: "Pending" });
    const pendingRestaurantsCount = await Restaurant.find({
      verificationStatus: "pending",
    }).countDocuments()
    const activeOrdersCount = await Order.countDocuments({
      status: { $in: ["confirmed", "preparing", "arriving"] },
    });

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
        totalRevenue: totalRevenue*0.05,
        pendingRestaurantsCount: pendingRestaurantsCount,
        activeOrdersCount: activeOrdersCount,
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

export const getRevenueGrowth = async (req, res) => {
  try {
    const range = req.query.range || "weekly";

    if (!["weekly", "monthly", "yearly"].includes(range)) {
      return res.status(400).json({
        success: false,
        message: "Invalid range",
      });
    }

    let startDate, endDate;

    if (range === "weekly") {
      startDate = moment().startOf("isoWeek").toDate();
      endDate = moment().endOf("isoWeek").toDate();
    }

    if (range === "monthly") {
      startDate = moment().startOf("month").toDate();
      endDate = moment().endOf("month").toDate();
    }

    if (range === "yearly") {
      startDate = moment().startOf("year").toDate();
      endDate = moment().endOf("year").toDate();
    }

    // Only delivered orders should count as revenue
    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    let revenueGrowth = [];

    // ---------------- WEEKLY ----------------
    if (range === "weekly") {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

      revenueGrowth = days.map((day) => {
        const revenue = orders
          .filter((o) => moment(o.createdAt).format("ddd") === day)
          .reduce((sum, o) => sum + o.totalPrice * 0.05, 0);

        return { label: day, revenue };
      });
    }

    // ---------------- MONTHLY ----------------
    if (range === "monthly") {
      revenueGrowth = [1, 2, 3, 4].map((week) => {
        const revenue = orders
          .filter(
            (o) => Math.ceil(moment(o.createdAt).date() / 7) === week
          )
          .reduce((sum, o) => sum + o.totalPrice * 0.05, 0);

        return { label: `Week ${week}`, revenue };
      });
    }

    // ---------------- YEARLY ----------------
    if (range === "yearly") {
      const months = moment.monthsShort(); // Jan, Feb...

      revenueGrowth = months.map((month, index) => {
        const revenue = orders
          .filter((o) => moment(o.createdAt).month() === index)
          .reduce((sum, o) => sum + o.totalPrice * 0.05, 0);

        return { label: month, revenue };
      });
    }

    return res.json({
      success: true,
      range,
      revenueGrowth,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Revenue growth fetch failed",
      error: error.message,
    });
  }
};

export const getCustomerProfile = async (req, res) => {
  try {
    const { userId } = req.query;

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
      populate: [{ path: "item" }, { path: "restaurantId" }],
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

      const count = restaurantCount[mostResId];
      const restaurant = await Restaurant.findById(mostResId).select(
        "name logo"
      );
      mostOrderedRestaurant = {
        name: restaurant.name,
        logo: restaurant.logo,
        orderCount: count,
      };
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

      const count = itemCount[mostItemId];
      const item = await MenuItems.findById(mostItemId).select(
        "name image price"
      );
      mostOrderedItem = {
        name: item.name,
        image: item.image,
        price: item.price,
        orderCount: count,
      };
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

export const fetchAllCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" });

    const customerData = await Promise.all(
      customers.map(async (user) => {
        const totalOrders = await Order.countDocuments({
          customerId: user._id,
        });

        const totalSpentResult = await Order.aggregate([
          { $match: { customerId: user._id } },
          { $group: { _id: null, total: { $sum: "$totalPrice" } } },
        ]);

        const totalSpent =
          totalSpentResult.length > 0 ? totalSpentResult[0].total : 0;

        return {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          profilePic: user.profilePic,
          status: user.status.charAt(0).toUpperCase() + user.status.slice(1),
          joinedDate: user.createdAt,
          totalOrders,
          totalSpent,
        };
      })
    );

    return res.status(200).json({
      success: true,
      customers: customerData,
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
      .populate("customerId", "name email phone address")
      .populate({
        path: "orderItems",
        populate: [
          { path: "restaurantId", select: "name logo restaurantPhoneNumber" },
          { path: "item", select: "name price" },
        ],
      })
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map((order) => {
      const restaurantName = order.orderItems[0]?.restaurantId?.name || "N/A";

      const totalItems = order.orderItems.length;

      return {
        id: order._id,
        name: order.customerId?.name,
        email: order.customerId?.email,
        phone: order.customerId?.phone,
        address: order.customerId?.address,
        deliveryAddress: order.deliveryAddress,
        restaurantName,
        restaurantPhone:
          order.orderItems[0]?.restaurantId?.restaurantPhoneNumber || "N/A",
        items: totalItems,
        total: order.totalPrice,
        date: order.createdAt.toISOString().split("T")[0],
        time: new Date(order.createdAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        status: order.status.charAt(0).toUpperCase() + order.status.slice(1),
        orderItems: order.orderItems,
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
    const totalCustomer = await User.countDocuments({ role: "customer" });
    const totalRestaurants = await Restaurant.countDocuments();
    const totalPendingRestaurants = await Restaurant.countDocuments({
      verificationStatus: "pending",
    });

    const summary = { totalCustomer, totalRestaurants, totalPendingRestaurants };

    // ------------------ VALIDATE RANGE ------------------
    if (!["weekly", "monthly", "yearly"].includes(range)) {
      return res.status(400).json({ success: false, message: "Invalid analytics range" });
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
    const currentOrders = await Order.find({ createdAt: { $gte: currentStart, $lte: currentEnd } });
    const previousOrders = await Order.find({ createdAt: { $gte: previousStart, $lte: previousEnd } });

    // ------------------ NEW vs RETURNING CUSTOMERS ------------------
    const currentCustomerIds = [...new Set(currentOrders.map((o) => o.customerId?.toString()))];
    let newCustomers = 0;
    let returningCustomers = 0;

    for (let customerId of currentCustomerIds) {
      const previousOrdersExist = await Order.exists({
        customerId,
        createdAt: { $lt: currentStart },
      });

      if (previousOrdersExist) returningCustomers++;
      else newCustomers++;
    }

    const totalActiveCustomers = newCustomers + returningCustomers;
    summary.newCustomers = newCustomers;
    summary.returningCustomers = returningCustomers;
    summary.newCustomerPercentage = totalActiveCustomers
      ? Number(((newCustomers / totalActiveCustomers) * 100).toFixed(2))
      : 0;
    summary.returningCustomerPercentage = totalActiveCustomers
      ? Number(((returningCustomers / totalActiveCustomers) * 100).toFixed(2))
      : 0;

    // ------------------ ADMIN REVENUE ------------------
    const calcAdminRevenue = (orders) => orders.reduce((sum, o) => sum + o.totalPrice * 0.05, 0);
    summary.adminRevenueCurrent = calcAdminRevenue(currentOrders);
    summary.adminRevenuePrevious = calcAdminRevenue(previousOrders);

    // ------------------ ORDER GROWTH ------------------
    let orderGrowth = [];
    if (range === "weekly") {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      orderGrowth = days.map((d) => ({ label: d, orders: 0 }));
      currentOrders.forEach((order) => {
        const day = moment(order.createdAt).format("ddd");
        const idx = orderGrowth.findIndex((d) => d.label === day);
        if (idx !== -1) orderGrowth[idx].orders++;
      });
    } else if (range === "monthly") {
      orderGrowth = Array.from({ length: 4 }, (_, i) => ({ label: `Week ${i + 1}`, orders: 0 }));
      currentOrders.forEach((order) => {
        let week = Math.ceil(moment(order.createdAt).date() / 7);
        if (week > 4) week = 4;
        orderGrowth[week - 1].orders++;
      });
    } else if (range === "yearly") {
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
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      days.forEach((day) => {
        const current = currentOrders
          .filter((o) => moment(o.createdAt).format("ddd") === day)
          .reduce((sum, o) => sum + o.totalPrice * 0.05, 0);
        const previous = previousOrders
          .filter((o) => moment(o.createdAt).format("ddd") === day)
          .reduce((sum, o) => sum + o.totalPrice * 0.05, 0);
        revenueGrowth.push({ label: day, current, previous });
      });
    } else if (range === "monthly") {
      for (let i = 1; i <= 4; i++) {
        const current = currentOrders
          .filter((o) => Math.ceil(moment(o.createdAt).date() / 7) === i)
          .reduce((sum, o) => sum + o.totalPrice * 0.05, 0);
        const previous = previousOrders
          .filter((o) => Math.ceil(moment(o.createdAt).date() / 7) === i)
          .reduce((sum, o) => sum + o.totalPrice * 0.05, 0);
        revenueGrowth.push({ label: `Week ${i}`, current, previous });
      }
    } else if (range === "yearly") {
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
    const totalOrdersWithItems = await Order.find({
      createdAt: { $gte: currentStart, $lte: currentEnd },
    }).populate("orderItems");

    const restaurantStats = restaurants.map((rest) => {
      let totalOrdersCount = 0;
      let totalRevenue = 0;

      totalOrdersWithItems.forEach((order) => {
        order.orderItems.forEach((item) => {
          if (item.restaurantId.toString() === rest._id.toString()) {
            totalOrdersCount++;
            totalRevenue += item.price;
          }
        });
      });

      return {
        restaurantId: rest._id,
        name: rest.name,
        status: rest.operationalStatus,
        totalOrders: totalOrdersCount,
        totalRevenue: totalRevenue * 0.95,
      };
    });

    restaurantStats.sort((a, b) => b.totalRevenue - a.totalRevenue);
    const topRestaurants = restaurantStats.slice(0, 5);
    const restaurantsRevenue = topRestaurants.map((r) => ({ name: r.name, revenue: r.totalRevenue }));

    // ------------------ TODAY ORDER SUMMARY ------------------
    const startOfDay = moment().startOf("day").toDate();
    const endOfDay = moment().endOf("day").toDate();
    const todayOrders = await Order.find({ createdAt: { $gte: startOfDay, $lte: endOfDay } });

    const todaySummary = todayOrders.reduce(
      (acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      },
      { pending: 0, confirmed: 0, preparing: 0, arriving: 0, delivered: 0 }
    );

    // ------------------ RESPONSE ------------------
    return res.json({
      success: true,
      summary,
      orderGrowth,
      revenueGrowth,
      topRestaurants,
      restaurantsRevenue,
      todayOrders: todaySummary,
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
    const restaurants = await Restaurant.find().populate(
      "ownerId",
      "name email"
    );

    if (!restaurants || restaurants.length === 0) {
      return res.status(404).json({
        message: "No restaurants found",
      });
    }

    // Fetch all orders and non-pending orders once
    const allOrders = await Order.find().populate("orderItems");
    const nonPendingOrders = await Order.find({
      status: { $ne: "pending" },
    }).populate("orderItems");

    // Add orders and revenue for each restaurant
    const restaurantsWithStats = restaurants.map((restaurant) => {
      const relevantOrders = allOrders.filter((order) =>
        order.orderItems.some(
          (item) => item.restaurantId.toString() === restaurant._id.toString()
        )
      );
      const ordersCount = relevantOrders.length;

      const relevantNonPendingOrders = nonPendingOrders.filter((order) =>
        order.orderItems.some(
          (item) => item.restaurantId.toString() === restaurant._id.toString()
        )
      );
      const totalRevenue =
        relevantNonPendingOrders.reduce((sum, order) => {
          const restaurantItems = order.orderItems.filter(
            (item) => item.restaurantId.toString() === restaurant._id.toString()
          );
          return (
            sum +
            restaurantItems.reduce((itemSum, item) => itemSum + item.price, 0)
          );
        }, 0) * 0.95;

      return {
        ...restaurant.toObject(),
        id: restaurant._id, // add id for component
        orders: ordersCount,
        revenue: totalRevenue,
        status:
          restaurant.verificationStatus.charAt(0).toUpperCase() +
          restaurant.verificationStatus.slice(1), // capitalize
        cusisine: restaurant.cuisine, // fix typo
      };
    });

    return res.status(200).json({
      success: true,
      restaurants: restaurantsWithStats,
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

export const getSpecificRestaurantInfo = async (req, res) => {
  const { id } = req.params;

  try {
    const restaurant = await Restaurant.findById(id).populate({
      path: "menu",
      select: "-__v",
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    return res.status(200).json({
      success: true,
      restaurant,
    });
  } catch (error) {
    console.error("Get Restaurant Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate({
        path: "raisedBy",
        select: "_id name email",
      })
      .populate({
        path: "againstRestaurant",
        select: "_id name restaurantPhoneNumber",
      })
      .populate({
        path: "againstUser",
        select: "_id name email",
      })
      .populate({
        path: "orderId",
        select: "_id totalPrice paymentMethod paymentStatus deliveryAddress",
      }) .sort({ createdAt: -1 })
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
    const {
      complaintId,
      status, // Warned | Blocked | None | Active
      messageToCustomer,
      messageToRestaurant,
    } = req.body;

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    // 1️⃣ Update complaint info
    complaint.status = "Resolved";
    complaint.managerAction = status;
    complaint.responseToCustomer = messageToCustomer || "";
    complaint.responseToRestaurant = messageToRestaurant || "";

    // 2️⃣ Apply action ONLY if needed
    if (status === "Warned" || status === "Blocked") {
      // Complaint against CUSTOMER
      if (complaint.againstUser) {
        await User.findByIdAndUpdate(
          complaint.againstUser,
          { status: status.toLowerCase() }, // warned | blocked
          { new: true }
        );
      }

      // Complaint against RESTAURANT
      if (complaint.againstRestaurant) {
        await Restaurant.findByIdAndUpdate(
          complaint.againstRestaurant,
          { operationalStatus: status.toLowerCase() },
          { new: true }
        );
      }
    }

    await complaint.save();

    return res.status(200).json({
      success: true,
      message: "Complaint resolved successfully",
      complaint,
    });
  } catch (error) {
    console.error("Resolve complaint error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to resolve complaint",
    });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { userId, status } = req.body;

    if (!["Active", "Warned", "Blocked"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { status: status.toLowerCase() },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
};
