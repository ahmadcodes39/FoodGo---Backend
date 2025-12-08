import express from "express";
import dotenv from "dotenv";
import { connectToMongo } from "./config/db.js";
import userRouter from "./routes/userRoutes.js";
import restaurantRouter from "./routes/restaurantRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import customerRouter from "./routes/customerRoutes.js"
import stripeRouter from "./routes/stripeRoute.js";
import bodyParser from "body-parser";
import { stripePaymentWebhook } from "./controllers/stripeController.js";
dotenv.config();
connectToMongo();
 
const app = express();

// ⚠️ STRIPE WEBHOOK: must come BEFORE express.json()
app.post(
   "/api/stripe-payments/webhook",
  bodyParser.raw({ type: "application/json" }),
  stripePaymentWebhook
);

// Then normal JSON parser for all other routes
app.use(express.json());

app.get("/", (req, res) => {
  res.send("FoodGo is running...");
});

app.use("/api/user", userRouter);
app.use("/api/restaurant", restaurantRouter);
app.use("/api/admin", adminRouter);
app.use("/api/customer", customerRouter);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`✅ Server started on port ${port}`);
});
