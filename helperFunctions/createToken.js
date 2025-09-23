import jwt from "jsonwebtoken";
import dontenv from 'dotenv'
dontenv.config()

export const createToken = (user) => {
  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
  return token;
};
