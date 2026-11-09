import express from 'express';
import cors from 'cors';
export const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000' }));
app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'labtrack-api' }));
