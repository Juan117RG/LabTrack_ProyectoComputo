import { Router } from "express";
import { z } from "zod";
import pool from "../db.js";
import equipmentRoutes from "./equipment.routes.js";
import loansRoutes from "./loans.routes.js";

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'labtrack-api' }));
router.use('/equipment', equipmentRoutes);
router.get('/loans', loansRoutes);
export default router;
