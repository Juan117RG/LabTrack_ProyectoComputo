import { Router } from "express";
import equipmentRoutes from "./equipment.routes.js";
import loansRoutes from "./loans.routes.js";

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'labtrack-api' }));
router.use('/equipment', equipmentRoutes);
router.use('/loans', loansRoutes);
export default router;
