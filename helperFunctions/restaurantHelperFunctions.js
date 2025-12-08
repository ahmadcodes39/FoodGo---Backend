import moment from "moment";
import Order from "../models/Order.js";

export const calculateRestaurantRevenue = async (restaurantId, range) => {
  let revenueData = [];

  if (range === "weekly") {
    const startOfWeek = moment().startOf("week");
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    for (let i = 0; i < 7; i++) {
      const day = moment(startOfWeek).add(i, "days");
      const start = day.startOf("day").toDate();
      const end = day.endOf("day").toDate();

      const orders = await Order.find({
        status: "delivered",
        createdAt: { $gte: start, $lte: end },
      }).populate("orderItems");

      let revenue = 0;

      orders.forEach((order) => {
        order.orderItems.forEach((item) => {
          if (item.restaurantId.toString() === restaurantId) {
            revenue += item.price;
          }
        });
      });

      revenueData.push({
        label: labels[i],
        revenue: revenue * 0.95,
      });
    }
  }

  else if (range === "monthly") {
    const startDate = moment().subtract(30, "days");
    const weekLabels = ["Week 1", "Week 2", "Week 3", "Week 4"];
    let weeklyRevenue = [0, 0, 0, 0];

    for (let i = 0; i < 30; i++) {
      const day = moment(startDate).add(i, "days");
      const start = day.startOf("day").toDate();
      const end = day.endOf("day").toDate();

      const orders = await Order.find({
        status: "delivered",
        createdAt: { $gte: start, $lte: end },
      }).populate("orderItems");

      let revenue = 0;

      orders.forEach((order) => {
        order.orderItems.forEach((item) => {
          if (item.restaurantId.toString() === restaurantId) {
            revenue += item.price;
          }
        });
      });

      weeklyRevenue[Math.floor(i / 7)] += revenue * 0.95;
    }

    revenueData = weekLabels.map((label, i) => ({
      label,
      revenue: weeklyRevenue[i],
    }));
  }

  else if (range === "yearly") {
    const monthNames = moment.monthsShort();

    for (let m = 0; m < 12; m++) {
      const start = moment().month(m).startOf("month").toDate();
      const end = moment().month(m).endOf("month").toDate();

      const orders = await Order.find({
        status: "delivered",
        createdAt: { $gte: start, $lte: end },
      }).populate("orderItems");

      let revenue = 0;

      orders.forEach((order) => {
        order.orderItems.forEach((item) => {
          if (item.restaurantId.toString() === restaurantId) {
            revenue += item.price;
          }
        });
      });

      revenueData.push({
        label: monthNames[m],
        revenue: revenue * 0.95,
      });
    }
  }

  return revenueData;
};

export const calculateRestaurantOrderGrowth = async (restaurantId, range) => {
  let orderData = [];

  // ---------------- WEEKLY ----------------
  if (range === "weekly") {
    const startOfWeek = moment().startOf("week");
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    for (let i = 0; i < 7; i++) {
      const day = moment(startOfWeek).add(i, "days");

      const start = day.startOf("day").toDate();
      const end = day.endOf("day").toDate();

      // Fetch by date only
      const orders = await Order.find({
        createdAt: { $gte: start, $lte: end },
      }).populate("orderItems");

      let orderCount = 0;

      // Manual restaurant filter
      orders.forEach((order) => {
        const hasRestaurantItem = order.orderItems.some(
          (item) => item.restaurantId.toString() === restaurantId
        );

        if (hasRestaurantItem) {
          orderCount++;
        }
      });

      orderData.push({
        label: labels[i],
        orders: orderCount,
      });
    }
  }

  // ---------------- MONTHLY ----------------
  else if (range === "monthly") {
    const startDate = moment().subtract(30, "days");
    const weekLabels = ["Week 1", "Week 2", "Week 3", "Week 4"];

    let weeklyOrders = [0, 0, 0, 0];

    for (let i = 0; i < 30; i++) {
      const day = moment(startDate).add(i, "days");

      const start = day.startOf("day").toDate();
      const end = day.endOf("day").toDate();

      const orders = await Order.find({
        createdAt: { $gte: start, $lte: end },
      }).populate("orderItems");

      let count = 0;

      orders.forEach((order) => {
        const hasRestaurantItem = order.orderItems.some(
          (item) => item.restaurantId.toString() === restaurantId
        );

        if (hasRestaurantItem) {
          count++;
        }
      });

      weeklyOrders[Math.floor(i / 7)] += count;
    }

    orderData = weekLabels.map((label, i) => ({
      label,
      orders: weeklyOrders[i],
    }));
  }

  // ---------------- YEARLY ----------------
  else if (range === "yearly") {
    const monthNames = moment.monthsShort();

    for (let m = 0; m < 12; m++) {
      const start = moment().month(m).startOf("month").toDate();
      const end = moment().month(m).endOf("month").toDate();

      const orders = await Order.find({
        createdAt: { $gte: start, $lte: end },
      }).populate("orderItems");

      let orderCount = 0;

      orders.forEach((order) => {
        const hasRestaurantItem = order.orderItems.some(
          (item) => item.restaurantId.toString() === restaurantId
        );

        if (hasRestaurantItem) {
          orderCount++;
        }
      });

      orderData.push({
        label: monthNames[m],
        orders: orderCount,
      });
    }
  }

  return orderData;
};

export const getSellingItems = async (restaurantId) => {
  try {
    // Populate orderItems + item details
    const orders = await Order.find().populate({
      path: "orderItems",
      populate: {
        path: "item",
        select: "name category image"
      }
    });

    let restaurantItems = [];

    // Collect all restaurant items
    orders.forEach((order) => {
      order.orderItems.forEach((item) => {
        if (item.restaurantId.toString() === restaurantId) {
          restaurantItems.push(item);
        }
      });
    });

    let itemStats = {};

    restaurantItems.forEach((item) => {
      const id = item.item._id.toString(); 

      if (!itemStats[id]) {
        itemStats[id] = {
          itemId: id,
          itemName: item.item.name,
          itemCategory: item.item.category,
          itemImage: item.item.image,
          orders: 0,
          revenue: 0,
        };
      }

      itemStats[id].orders += item.quantity || 1;
      itemStats[id].revenue += item.price;
    });

    // Convert object → array
    let itemsArray = Object.values(itemStats);

    // Top 5
    const top5 = [...itemsArray]
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);

    // Least 5
    const lowest5 = [...itemsArray]
      .sort((a, b) => a.orders - b.orders)
      .slice(0, 5);

    return { top5, lowest5 };

  } catch (error) {
    console.error("Error in getSellingItems:", error.message);
    return { top5: [], lowest5: [] };
  }
};



