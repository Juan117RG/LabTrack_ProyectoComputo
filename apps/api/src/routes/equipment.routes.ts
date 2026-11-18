import express from "express";
import { validate } from "../middleware/validate.middleware.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import equipmentSchema from "../schemas/equipment.schema.js";
import equipmentController from "../controllers/equipment.controller.js";
const router = express.Router();

router.get(
  "/",
  authMiddleware("student"),
  validate(equipmentSchema.getEquipment, "query"),
  equipmentController.getEquipment,
);
router.post(
  "/",
  authMiddleware("manager"),
  validate(equipmentSchema.createEquipment, "body"),
  equipmentController.createEquipment,
);

export default router;
