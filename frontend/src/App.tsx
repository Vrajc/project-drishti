import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

// Import your existing pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ParticipantDashboard from './pages/ParticipantDashboard';
import OrganizerDashboard from './pages/OrganizerDashboard';
import EventExplore from './pages/EventExplore';
import MyEvents from './pages/MyEvents';
import LiveMonitoring from './pages/LiveMonitoring';
import EventSetup from './pages/EventSetup';
import PreSafetyPlanning from './pages/PreSafetyPlanning';
import CrowdFlowAnalysis from './pages/CrowdFlowAnalysis';
import AnomalyDetection from './pages/AnomalyDetection';
import EmergencyDispatch from './pages/EmergencyDispatch';
import AISummaries from './pages/AISummaries';
import PostEventReports from './pages/PostEventReports';
import AdminDashboard from './pages/AdminDashboard';

const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const transitionConfig = { 
  duration: 0.4, 
  ease: [0.4, 0, 0.2, 1] as const
};

const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageTransition}
      transition={transitionConfig}
    >
      {children}
    </motion.div>
  );
};

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><Landing /></PageWrapper>} />
        <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
        <Route path="/register" element={<PageWrapper><Register /></PageWrapper>} />
        <Route path="/participant-dashboard" element={<PageWrapper><ParticipantDashboard /></PageWrapper>} />
        <Route path="/organizer-dashboard" element={<PageWrapper><OrganizerDashboard /></PageWrapper>} />
        <Route path="/explore-events" element={<PageWrapper><EventExplore /></PageWrapper>} />
        <Route path="/my-events" element={<PageWrapper><MyEvents /></PageWrapper>} />
        <Route path="/live-monitoring" element={<PageWrapper><LiveMonitoring /></PageWrapper>} />
        <Route path="/event-setup" element={<PageWrapper><EventSetup /></PageWrapper>} />
        <Route path="/pre-safety-planning" element={<PageWrapper><PreSafetyPlanning /></PageWrapper>} />
        <Route path="/crowd-flow-analysis" element={<PageWrapper><CrowdFlowAnalysis /></PageWrapper>} />
        <Route path="/anomaly-detection" element={<PageWrapper><AnomalyDetection /></PageWrapper>} />
        <Route path="/emergency-dispatch" element={<PageWrapper><EmergencyDispatch /></PageWrapper>} />
        <Route path="/ai-summaries" element={<PageWrapper><AISummaries /></PageWrapper>} />
        <Route path="/post-event-reports" element={<PageWrapper><PostEventReports /></PageWrapper>} />
        <Route path="/admin-dashboard" element={<PageWrapper><AdminDashboard /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AnimatedRoutes />
    </Router>
  );
};

export default App;