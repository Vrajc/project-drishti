import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import authRoutes from './routes/auth.routes';
import eventRoutes from './routes/event.routes';
import userRoutes from './routes/user.routes';
import monitoringRoutes from './routes/monitoring.routes';
import aiRoutes from './routes/ai.routes';
import incidentRoutes from './routes/incident.routes';
import crowdAnalysisRoutes from './routes/crowdAnalysis.routes';
import { listModels } from './utils/openai.service';
import { seedTestUser } from './utils/seedDatabase';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Middleware
// Configure CORS to allow requests from frontend
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL // Add production URL from .env
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
// Increase body size limit to handle base64 encoded files (map uploads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/crowd-analysis', crowdAnalysisRoutes);

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Start server
const startServer = async () => {
  try {
    // Connect to database (comment out if MongoDB is not running)
    try {
      await connectDatabase();
      // Seed test user after successful connection
      await seedTestUser();
    } catch (dbError) {
      console.warn('⚠️  MongoDB connection failed - running without database');
      console.warn('Start MongoDB to enable database features');
    }
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📍 API available at: http://localhost:${PORT}`);
      listModels(); // This will list the available models
    });

    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.error('Please stop the other process or use a different port');
        process.exit(1);
      } else {
        console.error('Server error:', error);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
