# 🎨 Drishti Frontend

<div align="center">

![React](https://img.shields.io/badge/React-18-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg)

**Modern, responsive frontend for the Drishti Event Safety Platform**

</div>

---

## 📖 Overview

The Drishti frontend is a modern React application built with TypeScript and Vite, featuring a beautiful UI with TailwindCSS, smooth animations with Framer Motion, and comprehensive event safety management capabilities.

## ✨ Key Features

- 🎨 **Modern UI/UX** - Clean, intuitive interface with TailwindCSS
- 🌈 **Smooth Animations** - Framer Motion for fluid transitions
- 📱 **Fully Responsive** - Works seamlessly on all devices
- 🌓 **Theme Support** - Light/dark mode toggle
- 🔐 **Secure Authentication** - JWT-based auth with protected routes
- 📊 **Real-time Dashboard** - Live event monitoring and analytics
- 🤖 **AI Integration** - Interactive AI assistant and insights
- 🎯 **Role-Based UI** - Customized experience for each user role
- ⚡ **Fast Performance** - Optimized with Vite and code splitting

## 🛠️ Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3 | UI framework |
| TypeScript | 5.0 | Type safety |
| Vite | 5.4 | Build tool & dev server |
| TailwindCSS | 3.4 | Utility-first CSS |
| Framer Motion | 11.x | Animations |
| React Router | 6.x | Client-side routing |
| Axios | 1.x | HTTP client |
| Lucide React | - | Icon library |
| Recharts | 2.x | Data visualization |
| React Hook Form | 7.x | Form handling |

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher ([Download](https://nodejs.org/))
- **npm** or **yarn**
- Backend server running (see [backend/README.md](../backend/README.md))

### Installation

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   # Create .env file
   ```

4. **Configure `.env`:**
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

### Running the Application

**Development mode** (with hot reload):
```bash
npm run dev
```

The app will start on `http://localhost:3000`

**Production build:**
```bash
npm run build
```

**Preview production build:**
```bash
npm run preview
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Navbar.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── DataTable.tsx
│   │   ├── GradientButton.tsx
│   │   ├── FeatureCard.tsx
│   │   └── ...
│   │
│   ├── pages/               # Page components
│   │   ├── Landing.tsx
│   │   ├── Login.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── OrganizerDashboard.tsx
│   │   ├── ParticipantDashboard.tsx
│   │   ├── EventSetup.tsx
│   │   ├── EventExplore.tsx
│   │   ├── LiveMonitoring.tsx
│   │   ├── CrowdFlowAnalysis.tsx
│   │   ├── AnomalyDetection.tsx
│   │   ├── EmergencyDispatch.tsx
│   │   ├── PreSafetyPlanning.tsx
│   │   ├── PostEventReports.tsx
│   │   ├── AISummaries.tsx
│   │   └── ...
│   │
│   ├── contexts/            # React contexts
│   │   ├── AuthContext.tsx
│   │   ├── EventContext.tsx
│   │   └── ThemeContext.tsx
│   │
│   ├── services/            # API services
│   │   ├── api.ts
│   │   ├── authService.ts
│   │   ├── eventService.ts
│   │   └── aiService.ts
│   │
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   │
│   ├── utils/               # Utility functions
│   │   └── helpers.ts
│   │
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
│
├── public/                  # Static assets
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🎯 Available Pages

### Public Pages
- **Landing** (`/`) - Homepage with features showcase
- **Login** (`/login`) - Authentication page
- **Event Explore** (`/explore`) - Browse public events

### Organizer Pages (Protected)
- **Organizer Dashboard** - Overview and quick actions
- **Event Setup** - Create and configure events
- **My Events** - Manage your events
- **Live Monitoring** - Real-time event monitoring
- **Crowd Flow Analysis** - AI-powered crowd analysis
- **Anomaly Detection** - Incident detection and alerts
- **Emergency Dispatch** - Emergency response management
- **Pre-Safety Planning** - AI safety recommendations
- **Post Event Reports** - Comprehensive analytics
- **AI Summaries** - AI-generated insights

### Participant Pages (Protected)
- **Participant Dashboard** - Personal dashboard
- **My Registered Events** - View registered events

### Admin Pages (Protected)
- **Admin Dashboard** - System administration
- **User Management** - Manage all users
- **Platform Analytics** - System-wide statistics

## 🎨 Design System

See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for complete design guidelines.

## 🛠️ Available Scripts

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## 🔐 Authentication

JWT-based authentication with AuthContext for state management and protected routes.

## 📚 Documentation

- [Design System](./DESIGN_SYSTEM.md)
- [Backend API](../backend/README.md)
- [Main README](../README.md)

## 🐛 Troubleshooting

**Port already in use** - Change port in `vite.config.ts`  
**API issues** - Verify `VITE_API_URL` in `.env`  
**Build errors** - Clear `node_modules` and reinstall

## 📄 License

ISC License

---

<div align="center">

**Built with ❤️ for safer events**

</div>
