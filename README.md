# 🎯 Drishti Event Safety Platform

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-ISC-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)

**An AI-powered event safety management platform with real-time monitoring and predictive analytics**

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Tech Stack](#-technology-stack)

</div>

---

## 📖 About

Drishti is a comprehensive event safety management platform designed to help organizers plan, monitor, and analyze events with the power of artificial intelligence. The platform provides real-time monitoring, crowd flow analysis, anomaly detection, and automated safety reporting.


## ✨ Features

### 🤖 AI-Powered Capabilities

- **AI Chat Assistant** - Natural language safety queries and recommendations
- **Smart Safety Planning** - AI-generated event infrastructure and safety protocols
- **Intelligent Anomaly Detection** - Automated incident analysis and severity assessment
- **Predictive Crowd Flow Analysis** - ML-powered bottleneck prediction and crowd management
- **Automated Report Generation** - Comprehensive post-event safety reports
- **Live Monitoring Insights** - Real-time AI risk assessment and alerts

### 👥 For Event Organizers

- 📋 Complete event lifecycle management
- 🛡️ Pre-event safety planning with AI recommendations
- 📊 Real-time monitoring dashboard with live metrics
- 🚨 Emergency dispatch and incident management
- 📈 Detailed post-event analytics and insights
- 📹 Video-based crowd analysis

### 🎟️ For Participants

- 🔍 Event discovery and exploration
- 📝 Easy event registration
- 📱 Real-time event updates and notifications
- 🆘 Quick access to emergency contacts
- 📍 Event location and navigation

### 👨‍💼 For Administrators

- 👥 Comprehensive user management
- 📊 Platform-wide analytics and insights
- 🔧 System configuration and settings
- 📋 Event oversight and approval
- 🔐 Security and access control

## 🏗️ Architecture

```
drishti/
├── frontend/              # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page components
│   │   ├── contexts/     # React contexts (Auth, Event, Theme)
│   │   ├── services/     # API services
│   │   └── utils/        # Utility functions
│   └── public/
│
├── backend/              # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/       # Configuration files
│   │   ├── controllers/  # Request handlers
│   │   ├── models/       # Database models
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic & Python services
│   │   ├── middleware/   # Express middleware
│   │   └── utils/        # Helper functions
│   └── uploads/          # File uploads (videos, images)
│
└── docs/                 # Documentation files
```


## 🚀 Quick Start

### Prerequisites

Make sure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v6.0 or higher) - [Download](https://www.mongodb.com/try/download/community) or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- **Python** (v3.8 or higher) - Required for AI services
- **npm** or **yarn** - Package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd drishti
   ```

2. **Install all dependencies** (frontend + backend)
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**

   **Backend (.env)**
   ```bash
   cd backend
   cp .env.example .env
   ```
   
   Edit `backend/.env`:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/drishti
   JWT_SECRET=your_jwt_secret_key_here
   
   # AI Services (Choose one or both)
   GEMINI_API_KEY=your_gemini_api_key    # FREE - Get from https://aistudio.google.com/app/apikey
   OPENAI_API_KEY=your_openai_api_key    # Paid - Get from https://platform.openai.com/api-keys
   
   # Cloudinary (for media uploads - optional)
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

   **Frontend (.env)**
   ```bash
   cd ../frontend
   ```
   
   Create `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

4. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

### Running the Application

#### Option 1: Run both frontend and backend together
```bash
npm run dev
```

#### Option 2: Run separately

**Backend** (http://localhost:5000)
```bash
npm run dev:backend
```

**Frontend** (http://localhost:3000)
```bash
npm run dev:frontend
```

### First-Time Setup

1. **Create an admin account** - Register through the UI and promote to admin in MongoDB
2. **Test AI features** - Ensure your API keys are working
3. **Upload sample data** - Use the seeding script if available

### Building for Production

```bash
# Build both applications
npm run build

# Start production backend
npm run start:backend

# Serve frontend (use a static server like nginx or serve)
cd frontend/dist
npx serve
```

## 📚 Documentation

- **[API Documentation](./backend/README.md)** - Complete backend API reference
- **[Frontend Guide](./frontend/README.md)** - Frontend setup and components
- **[Crowd Flow Analysis](./CROWD_FLOW_ANALYSIS.md)** - AI crowd analysis setup
- **[Cloudinary Setup](./CLOUDINARY_SETUP.md)** - Media upload configuration
- **[Testing Guide](./TESTING_GUIDE.md)** - Testing procedures
- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - Technical implementation details


## 🛠️ Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **TypeScript** | Type-safe JavaScript |
| **Vite** | Build tool and dev server |
| **TailwindCSS** | Utility-first CSS framework |
| **Framer Motion** | Animation library |
| **React Router** | Client-side routing |
| **Axios** | HTTP client |
| **Lucide React** | Icon library |
| **Recharts** | Data visualization |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js** | JavaScript runtime |
| **Express** | Web framework |
| **TypeScript** | Type-safe JavaScript |
| **MongoDB** | NoSQL database |
| **Mongoose** | MongoDB ODM |
| **JWT** | Authentication |
| **Bcrypt** | Password hashing |
| **Multer** | File uploads |
| **Cloudinary** | Media storage (optional) |

### AI Services
| Service | Purpose |
|---------|---------|
| **Google Gemini** | FREE AI for analysis and chat |
| **OpenAI GPT-4** | Advanced AI capabilities (paid) |
| **Python** | AI service integration |
| **OpenCV** | Video analysis (via Python) |

## 🔑 Getting API Keys

### Google Gemini API (FREE)
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with Google account
3. Click "Get API key" → "Create API key"
4. Copy and add to `backend/.env` as `GEMINI_API_KEY`

### OpenAI API (Paid - Optional)
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create account and add payment method
3. Click "Create new secret key"
4. Copy and add to `backend/.env` as `OPENAI_API_KEY`

### Cloudinary (Optional - for media storage)
1. Visit [Cloudinary](https://cloudinary.com/)
2. Sign up for free account
3. Get Cloud Name, API Key, and API Secret from dashboard
4. Add to `backend/.env`

## 📋 Available Scripts

### Root Level
```bash
npm run install:all    # Install all dependencies
npm run dev           # Run both frontend and backend
npm run build         # Build both applications
npm run clean         # Clean all node_modules and build files
```

### Frontend
```bash
cd frontend
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Backend
```bash
cd backend
npm run dev          # Start dev server with hot reload
npm run build        # Compile TypeScript
npm start            # Run production build
npm run test         # Run tests
```

## 🗂️ Database Models

- **User** - User accounts (organizers, participants, admins)
- **Event** - Event details and configurations
- **Incident** - Safety incidents and reports
- **CrowdDensity** - Real-time crowd metrics
- **Monitoring** - Live monitoring data

## 🔒 Authentication & Authorization

- JWT-based authentication
- Role-based access control (RBAC)
- Protected routes and API endpoints
- Secure password hashing with bcrypt

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Events
- `GET /api/events` - List all events
- `POST /api/events` - Create event
- `GET /api/events/:id` - Get event details
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Incidents
- `GET /api/incidents` - List incidents
- `POST /api/incidents` - Report incident
- `GET /api/incidents/:id` - Get incident details
- `PUT /api/incidents/:id` - Update incident

### AI Services
- `POST /api/ai/chat` - AI chat assistant
- `POST /api/ai/analyze-safety` - Safety planning analysis
- `POST /api/ai/detect-anomaly` - Anomaly detection
- `POST /api/ai/predict-crowd` - Crowd flow prediction
- `POST /api/ai/generate-report` - Report generation

### Crowd Analysis
- `POST /api/crowd-analysis/analyze-video` - Video analysis
- `GET /api/crowd-analysis/density/:eventId` - Get crowd density
- `GET /api/crowd-analysis/heatmap/:eventId` - Get heatmap data

See [backend/README.md](./backend/README.md) for complete API documentation.

## 🧪 Testing

```bash
# Backend tests
cd backend
npm run test

# Frontend tests (if configured)
cd frontend
npm run test
```

For detailed testing procedures, see [TESTING_GUIDE.md](./TESTING_GUIDE.md).

## 🚨 Troubleshooting

### Common Issues

**MongoDB Connection Error**
- Ensure MongoDB is running: `mongod`
- Check connection string in `backend/.env`
- Verify database permissions

**Port Already in Use**
- Backend: Change `PORT` in `backend/.env`
- Frontend: Change in `vite.config.ts`

**AI Features Not Working**
- Verify API keys in `backend/.env`
- Check API key permissions and quotas
- Review error logs in terminal

**File Upload Issues**
- Check `uploads/` directory permissions
- Verify Cloudinary configuration
- Ensure file size limits

### Logs

- Backend logs: Check terminal running `npm run dev:backend`
- Frontend logs: Check browser console
- MongoDB logs: Check MongoDB log file

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier configurations
- Write meaningful commit messages
- Add comments for complex logic
- Update documentation as needed

## 📄 License

This project is licensed under the ISC License.

## 👨‍💻 Authors

Developed as part of an event safety management initiative.

## 🙏 Acknowledgments

- Google Gemini for AI capabilities
- OpenAI for advanced AI features
- MongoDB for database solutions
- The open-source community

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing documentation
- Review troubleshooting guide

---

<div align="center">

**Built with ❤️ for safer events**

</div>
