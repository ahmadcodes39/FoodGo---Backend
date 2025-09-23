import Restaurant from "../models/Restaurant.js";

export const approveRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;
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

    restaurant.status = status;
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

