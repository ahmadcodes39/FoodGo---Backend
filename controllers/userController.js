import { Router } from "express";
import User from "../models/User.js";
import { createToken } from "../helperFunctions/createToken.js";
import bcrypt from "bcryptjs";
import { storeImageToCloud } from "../helperFunctions/imageToCloud.js";


export const SignUp = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashPassword,
      phone,
      role,
    });

  user.isOnBoarded = ["customer", "admin", "complaint manager"].includes(role.toLowerCase());


    await user.save();

    // Remove password before sending response
    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;

    return res
      .status(201)
      .json({
        message: "User registered successfully",
        user: userWithoutPassword,
      });
  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const token = createToken(user);

    const { password: _, ...userWithoutPassword } = user._doc;

    return res.status(200).json({
      message: "Login successful",
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Signin Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name, email, phone, password } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    let profilePicUrl = null;
    if (req.files?.profilePic) {
      profilePicUrl = await storeImageToCloud(
        req.files.profilePic[0],
        "user/profilePics"
      );
    }
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (password) user.password = password;
    if (profilePicUrl) user.profilePic = profilePicUrl;

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update profile Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const fetchApprovedRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({
      verificationStatus: "approved",
    });

    if (!restaurants || restaurants.length === 0) {
      return res.status(404).json({
        message: "No approved restaurants found",
      });
    }
    return res.status(200).json({
      success: true,
      restaurants,
    });
  } catch (error) {
    console.error("Fetch Approved Restaurants Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};