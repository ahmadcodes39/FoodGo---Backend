import MenuItems from "../models/MenuItems.js";
import Restaurant from "../models/Restaurant.js";
import { storeImageToCloud } from "../helperFunctions/imageToCloud.js";

import User from "../models/User.js";


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
      return res
        .status(403)
        .json({ message: "Only restaurant owners can register restaurants" });
    }

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
      cuisine,
      description,
      openingHours,
      deliveryAvailable,
      deliveryTime,
      logo: logoUrl || undefined,
      license: licenseUrl || undefined,
    });

    // Update user's isOnBoarded status to true
    await User.findByIdAndUpdate(ownerId, { isOnBoarded: true });

    return res.status(201).json({
      message: "Restaurant registered successfully",
      restaurant,
    });
  } catch (error) {
    console.error("Register Restaurant Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

export const addMenuItems = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, price, category } = req.body;
    if (!restaurantId) {
      return res
        .status(400)
        .json({ message: "Resttaurant Id is not provided" });
    }
    if (!name || !price || !category) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const priceNumber = parseFloat(price);
    if (isNaN(priceNumber)) {
      return res.status(400).json({ message: "Price must be a number" });
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
        return res.status(404).json({ message: "Restaurant not found" });
      }

      restaurant.menu.push(menuItem._id);
      await restaurant.save();

      return res.status(201).json({
        message: "Menu item added successfully",
        menuItem,
      });
    } else {
      return res.status(400).json({ message: "Restaurant is not approved!" });
    }
  } catch (error) {
    console.error("Menu Items Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

export const updateDetails = async (req, res) => {
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
      return res.status(400).json({ message: "Restaurant Id is required" });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (restaurant.ownerId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You are not authorized to update this restaurant" });
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
      message: "Restaurant details updated successfully",
      restaurant,
    });
  } catch (error) {
    console.error("Update Restaurant Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

export const updateMenuItem = async (req, res) => {
  try {
    const { restaurantId, menuItemId } = req.params;
    const { name, price, category } = req.body;

    if (!restaurantId || !menuItemId) {
      return res
        .status(400)
        .json({ message: "Restaurant ID and Menu Item ID are required" });
    }

    const menuItem = await MenuItems.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    if (restaurant.ownerId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You are not authorized to update this menu item" });
    }

    if (name) menuItem.name = name;
    if (price) {
      const priceNumber = parseFloat(price);
      if (isNaN(priceNumber)) {
        return res.status(400).json({ message: "Price must be a number" });
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
      message: "Menu item updated successfully",
      menuItem,
    });
  } catch (error) {
    console.error("Update Menu Item Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

export const deleteMenuItem = async (req, res) => {
  try {
    const { restaurantId, menuItemId } = req.params;
    if (!restaurantId || !menuItemId) {
      return res
        .status(400)
        .json({ message: "Restaurant and Menu item Id's are required" });
    }
    const menuItem = await MenuItems.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    if (restaurant.ownerId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this menu item" });
    }

    await MenuItems.findByIdAndDelete(menuItemId);
    restaurant.menu = restaurant.menu.filter(
      (id) => id.toString() !== menuItemId
    );
    await restaurant.save();

    return res.status(200).json({ message: "Menu item deleted successfully" });
  } catch (error) {
    console.error("Delete Menu Item Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

export const fetchApprovedRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({ verificationStatus: "approved" });

    if (!restaurants || restaurants.length === 0) {
      return res.status(404).json({
        message: "No approved restaurants found",
      });
    }
    return res.status(200).json({
      message: "Approved restaurants fetched successfully",
      restaurants,
    });
  } catch (error) {
    console.error("Fetch Approved Restaurants Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const getMenuItems = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant ID is required" });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const menuItems = await MenuItems.find({ restaurantId });

    if (!menuItems || menuItems.length === 0) {
      return res.status(404).json({ message: "No menu items found" });
    }

    return res.status(200).json({
      message: "Data fetched successfully",
      restaurant,
      menuItems,
    });
  } catch (error) {
    console.error("Get Menu Items Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
