import { Router } from "express";
import User from "../models/user.js";
import { createToken } from "../helperFunctions/createToken.js";
import bcrypt from 'bcryptjs'

export const SignUp = async (req, res) => {
  try {
    const { name, email,phone, password,role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this emaul alreasy exist" });
    }
    const hashPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashPassword,
      phone,
      role,
    });
    if (user.save()) {
      return res
        .status(201)
        .json({ message: "User regitered successfully", user });
    }
  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password  ) {
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

    // 5. Remove password from response
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
