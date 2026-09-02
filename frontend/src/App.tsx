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
import EventCameras from './pages/EventCameras';
import PreSafetyPlanning from './pages/PreSafetyPlanning';
import CrowdFlowAnalysis from './pages/CrowdFlowAnalysis';
import AnomalyDetection from './pages/AnomalyDetection';
import EmergencyDispatch from './pages/EmergencyDispatch';
import AISummaries from './pages/AISummaries';
import PostEventReports from './pages/PostEventReports';
import AdminDashboard from './pages/AdminDashboard';
import CameraRegistry from './pages/surveillance/CameraRegistry';
import CameraMap from './pages/surveillance/CameraMap';
import LiveWall from './pages/surveillance/LiveWall';
import DispatchConsole from './pages/police/DispatchConsole';
import EstateOverview from './pages/police/EstateOverview';
import Watchlist from './pages/police/Watchlist';
import AlertsConsole from './pages/police/AlertsConsole';
import VehicleTracking from './pages/police/VehicleTracking';
import EventSearch from './pages/police/EventSearch';
import RequireRole from './components/RequireRole';

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
        <Route path="/event-cameras" element={<PageWrapper><EventCameras /></PageWrapper>} />
        <Route path="/pre-safety-planning" element={<PageWrapper><PreSafetyPlanning /></PageWrapper>} />
        <Route path="/crowd-flow-analysis" element={<PageWrapper><CrowdFlowAnalysis /></PageWrapper>} />
        <Route path="/anomaly-detection" element={<PageWrapper><AnomalyDetection /></PageWrapper>} />
        <Route path="/emergency-dispatch" element={<PageWrapper><EmergencyDispatch /></PageWrapper>} />
        <Route path="/ai-summaries" element={<PageWrapper><AISummaries /></PageWrapper>} />
        <Route path="/post-event-reports" element={<PageWrapper><PostEventReports /></PageWrapper>} />
        <Route path="/admin-dashboard" element={<PageWrapper><AdminDashboard /></PageWrapper>} />
        <Route path="/surveillance/cameras" element={<PageWrapper><CameraRegistry /></PageWrapper>} />
        <Route path="/surveillance/map" element={<PageWrapper><CameraMap /></PageWrapper>} />
        <Route path="/surveillance/live-wall" element={<PageWrapper><LiveWall /></PageWrapper>} />

        {/* Police operations. These are the first routes in the app that can
            change something in the field, so they are the first to be guarded.
            The server authorises every call regardless; this is the client-side
            half, so a signed-out user lands on /login rather than on a page that
            403s on every request. */}
        <Route
          path="/police/dispatch"
          element={
            <RequireRole roles={['police', 'admin']}>
              <PageWrapper><DispatchConsole /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/police/tracking"
          element={
            <RequireRole roles={['police', 'admin']}>
              <PageWrapper><VehicleTracking /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/police/search"
          element={
            <RequireRole roles={['police', 'admin']}>
              <PageWrapper><EventSearch /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/police/watchlist"
          element={
            <RequireRole roles={['police', 'admin']}>
              <PageWrapper><Watchlist /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/police/alerts"
          element={
            <RequireRole roles={['police', 'admin']}>
              <PageWrapper><AlertsConsole /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/police/overview"
          element={
            <RequireRole roles={['police', 'admin']}>
              <PageWrapper><EstateOverview /></PageWrapper>
            </RequireRole>
          }
        />
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