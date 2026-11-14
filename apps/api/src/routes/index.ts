import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'labtrack-api' }));

export default router;