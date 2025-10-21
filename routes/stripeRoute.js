import express, { Router } from "express";
import { stripePaymentWebhook } from "../controllers/stripeController.js";
const router = Router();

router.post("/webhook", stripePaymentWebhook);

export default router;
