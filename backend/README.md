# 🔧 Drishti Backend API

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)
![Express](https://img.shields.io/badge/Express-4.18-lightgrey.svg)
![MongoDB](https://img.shields.io/badge/MongoDB-6.0-green.svg)

**RESTful API server for the Drishti Event Safety Platform**

</div>

---

## 📖 Overview

The Drishti backend is a robust Node.js/Express server built with TypeScript, providing comprehensive APIs for event management, real-time monitoring, incident reporting, and AI-powered safety analytics.

## ✨ Key Features

- 🔐 **JWT Authentication** - Secure user authentication and authorization
- 👥 **Role-Based Access Control** - Organizer, participant, and admin roles
- 🎯 **Event Management** - Complete CRUD operations for events
- 📊 **Real-time Monitoring** - Live event metrics and crowd data
- 🚨 **Incident Reporting** - Comprehensive incident tracking
- 🤖 **AI Integration** - Google Gemini & OpenAI for intelligent analysis
- 📹 **Video Analysis** - Python-based crowd flow analysis
- 📁 **File Uploads** - Multer with Cloudinary integration
- 🗄️ **MongoDB Database** - Mongoose ODM for data modeling

## 🛠️ Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | v18+ | JavaScript runtime |
| Express | 4.18 | Web framework |
| TypeScript | 5.0 | Type-safe development |
| MongoDB | 6.0+ | NoSQL database |
| Mongoose | 8.0+ | MongoDB ODM |
| JWT | - | Authentication tokens |
| Bcrypt | - | Password hashing |
| Multer | - | File upload handling |
| Cloudinary | - | Media storage |
| Google Gemini AI | 1.5 Flash | FREE AI analysis |
| OpenAI | GPT-4 | Advanced AI (optional) |
| Python | 3.8+ | AI services integration |


## 🤖 AI Integration

### Google Gemini (FREE - Recommended)

This project uses **Google Gemini 1.5 Flash** - completely FREE with no credit card required!

#### AI-Powered Features:
- ✅ **Safety Planning Analysis** - Event safety recommendations
- ✅ **Anomaly Detection** - Real-time incident analysis
- ✅ **Crowd Flow Prediction** - Predictive analytics
- ✅ **Live Monitoring Insights** - Real-time safety assessment
- ✅ **Post-Event Reports** - Comprehensive report generation
- ✅ **AI Chat Assistant** - Interactive safety Q&A

#### Getting Your FREE Gemini API Key:

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Get API key"** → **"Create API key"**
4. Copy your API key
5. Add to `.env`:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

**No credit card needed!** ✨

### OpenAI (Optional - Paid)

For advanced AI capabilities, you can optionally use OpenAI GPT-4:

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create account and add billing
3. Generate API key
4. Add to `.env`:
   ```env
   OPENAI_API_KEY=your_openai_api_key
   ```


## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher ([Download](https://nodejs.org/))
- **MongoDB** v6.0 or higher ([Download](https://www.mongodb.com/try/download/community))
- **Python** v3.8+ (for AI services)
- **npm** or **yarn**

### Installation

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

4. **Configure `.env` file:**
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # Database
   MONGODB_URI=mongodb://localhost:27017/drishti
   
   # JWT Authentication
   JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
   JWT_EXPIRE=7d
   
   # AI Services
   GEMINI_API_KEY=your_gemini_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here  # Optional
   
   # Cloudinary (Optional - for media uploads)
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_key
   CLOUDINARY_API_SECRET=your_cloudinary_secret
   
   # CORS
   FRONTEND_URL=http://localhost:3000
   ```

5. **Install Python dependencies** (for AI services):
   ```bash
   pip install -r requirements.txt
   ```

### Running the Server

**Development mode** (with hot reload):
```bash
npm run dev
```

**Production build:**
```bash
npm run build
npm start
```

The server will start on `http://localhost:5000`

### Testing API

You can test the API using:
- **Postman** or **Insomnia**
- **cURL** commands
- Test scripts in the `backend/` directory:
  ```bash
  node test-api-direct.js
  node test-gemini.js
  ```


## 📁 Project Structure

```
backend/
├── src/
│   ├── config/               # Configuration files
│   │   ├── database.ts       # MongoDB connection
│   │   └── cloudinary.ts     # Cloudinary setup
│   │
│   ├── controllers/          # Request handlers
│   │   ├── auth.controller.ts
│   │   ├── event.controller.ts
│   │   ├── incident.controller.ts
│   │   ├── ai.controller.ts
│   │   └── crowdAnalysis.controller.ts
│   │
│   ├── models/               # Mongoose schemas
│   │   ├── user.model.ts
│   │   ├── event.model.ts
│   │   ├── incident.model.ts
│   │   └── crowdDensity.model.ts
│   │
│   ├── routes/               # API route definitions
│   │   ├── auth.routes.ts
│   │   ├── event.routes.ts
│   │   ├── incident.routes.ts
│   │   ├── ai.routes.ts
│   │   ├── crowdAnalysis.routes.ts
│   │   ├── monitoring.routes.ts
│   │   └── user.routes.ts
│   │
│   ├── middleware/           # Express middleware
│   │   └── auth.middleware.ts
│   │
│   ├── services/             # Business logic
│   │   ├── crowdAnalysis.service.ts
│   │   └── crowd_analyzer.py    # Python AI service
│   │
│   ├── utils/                # Helper functions
│   │   ├── openai.service.ts
│   │   ├── mockCrowdData.ts
│   │   └── seedDatabase.ts
│   │
│   └── server.ts             # Application entry point
│
├── uploads/                  # File uploads
│   ├── videos/
│   └── images/
│
├── .env.example              # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
├── requirements.txt          # Python dependencies
└── README.md
```


## 🌐 API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register new user | No |
| POST | `/login` | User login | No |
| GET | `/me` | Get current user | Yes |
| PUT | `/update-profile` | Update user profile | Yes |
| POST | `/change-password` | Change password | Yes |

**Request Body (Register):**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "role": "organizer"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "_id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "organizer"
  }
}
```

### Event Routes (`/api/events`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/` | Get all events | No | - |
| GET | `/:id` | Get event by ID | No | - |
| POST | `/` | Create event | Yes | Organizer/Admin |
| PUT | `/:id` | Update event | Yes | Organizer/Admin |
| DELETE | `/:id` | Delete event | Yes | Organizer/Admin |
| GET | `/my-events` | Get user's events | Yes | Organizer |
| POST | `/:id/register` | Register for event | Yes | Participant |

**Request Body (Create Event):**
```json
{
  "name": "Tech Conference 2026",
  "description": "Annual technology conference",
  "location": "Convention Center",
  "date": "2026-06-15T09:00:00.000Z",
  "capacity": 5000,
  "category": "conference",
  "safetyFeatures": ["Medical team", "Security personnel"]
}
```

### Incident Routes (`/api/incidents`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get all incidents | Yes |
| GET | `/:id` | Get incident by ID | Yes |
| POST | `/` | Report incident | Yes |
| PUT | `/:id` | Update incident | Yes |
| DELETE | `/:id` | Delete incident | Yes |
| GET | `/event/:eventId` | Get event incidents | Yes |

**Request Body (Report Incident):**
```json
{
  "eventId": "event_id",
  "type": "medical",
  "severity": "high",
  "description": "Medical emergency in Section A",
  "location": "Section A, Row 12",
  "status": "reported"
}
```

### AI Routes (`/api/ai`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/chat` | AI chat assistant | Yes |
| POST | `/analyze-safety` | Safety planning analysis | Yes |
| POST | `/detect-anomaly` | Anomaly detection | Yes |
| POST | `/predict-crowd` | Crowd flow prediction | Yes |
| POST | `/generate-report` | Generate safety report | Yes |
| POST | `/monitoring-insights` | Live monitoring insights | Yes |

**Request Body (AI Chat):**
```json
{
  "message": "What safety measures should I have for a 5000 person concert?",
  "context": {
    "eventType": "concert",
    "capacity": 5000
  }
}
```

**Response:**
```json
{
  "success": true,
  "response": "For a 5000-person concert, you should consider...",
  "suggestions": [
    "Medical personnel: 1 per 500 attendees",
    "Emergency exits: Minimum 10",
    "Security staff: 1 per 250 attendees"
  ]
}
```

### Crowd Analysis Routes (`/api/crowd-analysis`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/analyze-video` | Analyze uploaded video | Yes |
| GET | `/density/:eventId` | Get crowd density | Yes |
| GET | `/heatmap/:eventId` | Get heatmap data | Yes |
| GET | `/flow/:eventId` | Get flow patterns | Yes |
| POST | `/real-time` | Real-time analysis | Yes |

**Request Body (Analyze Video):**
```json
{
  "eventId": "event_id",
  "videoUrl": "https://cloudinary.com/video.mp4",
  "analysisType": "density"
}
```

### Monitoring Routes (`/api/monitoring`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/:eventId` | Get monitoring data | Yes |
| POST | `/:eventId` | Update monitoring data | Yes |
| GET | `/:eventId/metrics` | Get real-time metrics | Yes |
| GET | `/:eventId/alerts` | Get active alerts | Yes |

### User Routes (`/api/users`)

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/` | Get all users | Yes | Admin |
| GET | `/:id` | Get user by ID | Yes | Admin |
| PUT | `/:id` | Update user | Yes | Admin |
| DELETE | `/:id` | Delete user | Yes | Admin |
| PUT | `/:id/role` | Change user role | Yes | Admin |

## 🔐 Authentication & Authorization

### JWT Authentication

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Roles

- **Admin** - Full system access
- **Organizer** - Event management, monitoring
- **Participant** - Event registration, viewing

### Protected Route Middleware

```typescript
import { protect, authorize } from './middleware/auth.middleware';

// Protect route (any authenticated user)
router.get('/profile', protect, getProfile);

// Authorize specific roles
router.post('/events', protect, authorize('organizer', 'admin'), createEvent);

## 📊 Database Models

### User Model
```typescript
{
  name: string;
  email: string;
  password: string;  // Hashed with bcrypt
  role: 'organizer' | 'participant' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}
```

### Event Model
```typescript
{
  name: string;
  description: string;
  location: string;
  date: Date;
  capacity: number;
  organizerId: ObjectId;
  category: string;
  safetyFeatures: string[];
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  registeredParticipants: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Incident Model
```typescript
{
  eventId: ObjectId;
  reportedBy: ObjectId;
  type: 'medical' | 'security' | 'fire' | 'crowd' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: string;
  status: 'reported' | 'investigating' | 'resolved' | 'closed';
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### CrowdDensity Model
```typescript
{
  eventId: ObjectId;
  timestamp: Date;
  zones: [{
    name: string;
    density: number;
    capacity: number;
    riskLevel: 'low' | 'medium' | 'high';
  }];
  totalCount: number;
  heatmapData: any;
  createdAt: Date;
}
```

## 🛠️ Available Scripts

```bash
# Development
npm run dev          # Start with nodemon (hot reload)

# Production
npm run build        # Compile TypeScript to JavaScript
npm start            # Run compiled code

# Testing
npm run test         # Run test suite
npm run test:watch   # Run tests in watch mode

# Database
npm run seed         # Seed database with sample data

# Utilities
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

## 🧪 Testing

### Run Tests
```bash
# All tests
npm run test

# Specific test file
npm run test test-api-direct.js

# Test AI features
node test-gemini.js
node test-simple-ai.js
node test-all-ai-features.js
```

### Manual API Testing

**Using cURL:**
```bash
# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123","role":"organizer"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get events (with auth token)
curl -X GET http://localhost:5000/api/events \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 5000 | No |
| `NODE_ENV` | Environment | development | No |
| `MONGODB_URI` | MongoDB connection string | - | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `JWT_EXPIRE` | Token expiration | 7d | No |
| `GEMINI_API_KEY` | Google Gemini API key | - | Yes* |
| `OPENAI_API_KEY` | OpenAI API key | - | No |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | - | No |
| `CLOUDINARY_API_KEY` | Cloudinary API key | - | No |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | - | No |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:3000 | No |

*At least one AI API key (Gemini or OpenAI) is required for AI features.

### MongoDB Connection

**Local MongoDB:**
```env
MONGODB_URI=mongodb://localhost:27017/drishti
```

**MongoDB Atlas:**
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/drishti?retryWrites=true&w=majority
```

### Cloudinary Setup (Optional)

For production file uploads:
1. Create account at [Cloudinary](https://cloudinary.com/)
2. Get credentials from dashboard
3. Add to `.env`:
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## 🚨 Error Handling

The API uses consistent error responses:

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message here",
  "statusCode": 400
}
```

**Common Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Server Error

## 🔒 Security Best Practices

- ✅ Passwords hashed with bcrypt (10 rounds)
- ✅ JWT tokens for authentication
- ✅ CORS configured for frontend
- ✅ Input validation and sanitization
- ✅ Rate limiting (recommended for production)
- ✅ Helmet.js for security headers (recommended)
- ✅ Environment variables for sensitive data
- ✅ MongoDB injection prevention

### Production Recommendations:
```bash
npm install helmet express-rate-limit
```

```typescript
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);
```

## 🐛 Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
# Windows
net start MongoDB

# macOS/Linux
sudo systemctl status mongod

# Check connection string
# Ensure correct format and credentials
```

### Port Already in Use
```bash
# Change PORT in .env
PORT=5001

# Or kill process using port
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5000
kill -9 <PID>
```

### AI API Issues
- Verify API key is correct and active
- Check API key permissions and quotas
- Review error messages in console
- Test with provided test scripts

### File Upload Issues
- Ensure `uploads/` directory exists and has write permissions
- Check Cloudinary credentials if using cloud storage
- Verify file size limits in middleware

## 📖 Additional Documentation

- [Crowd Flow Analysis Setup](../CROWD_FLOW_ANALYSIS.md)
- [Cloudinary Integration](../CLOUDINARY_SETUP.md)
- [Testing Guide](../TESTING_GUIDE.md)
- [API Documentation (Full)](./API_DOCS.md) *(if available)*

## 🤝 Contributing

1. Follow TypeScript best practices
2. Use ESLint and Prettier configurations
3. Add tests for new features
4. Update documentation
5. Submit pull requests to `develop` branch

## 📄 License

ISC License

---

<div align="center">

**Built with ❤️ for safer events**

[⬆ Back to Top](#-drishti-backend-api)

</div>
