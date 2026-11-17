import express from "express";
import { validate } from "../middleware/validate.middleware.js";
import authSchema from "../schemas/auth.schema.js";
import authController from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post(
  "/register",
  validate(authSchema.register, "body"),
  authController.register,
);

router.post("/login", validate(authSchema.login, "body"), authController.login);

router.post("/refresh-token", authController.refreshToken);

router.post("/logout", authMiddleware("student"), authController.logout);

export default router;
