import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { initDb } from './db';
import tripsRouter from './routes/trips';
import expensesRouter from './routes/expenses';
import settlementsRouter from './routes/settlements';
import aiRouter from './routes/ai';
import settingsRouter from './routes/settings';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 81;

// Middlewares
app.use(cors());
app.use(express.json());

// Prevent HTTP caching on all API routes so multiple devices always get live updates
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Initialize SQLite database
initDb();

// API routes
app.use('/api/trips', tripsRouter);
app.use('/api', expensesRouter);
app.use('/api', settlementsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/settings', settingsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    appName: 'TripSplit',
    version: '1.0.0',
    time: new Date().toISOString(),
  });
});

// Serve frontend static assets in production
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && req.method === 'GET') {
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      next();
    }
  });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✈️  TripSplit backend running on http://0.0.0.0:${PORT}`);
});
