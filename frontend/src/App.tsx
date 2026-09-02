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
import LiveUpdates from './pages/LiveUpdates';
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
        <Route
          path="/participant-dashboard"
          element={
            <RequireRole roles={['participant']}>
              <PageWrapper><ParticipantDashboard /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/organizer-dashboard"
          element={
            <RequireRole roles={['organizer', 'admin']}>
              <PageWrapper><OrganizerDashboard /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/explore-events"
          element={
            <RequireRole roles={['participant', 'organizer', 'admin']}>
              <PageWrapper><EventExplore /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/my-events"
          element={
            <RequireRole roles={['participant', 'organizer', 'admin']}>
              <PageWrapper><MyEvents /></PageWrapper>
            </RequireRole>
          }
        />
        {/* The attendee's own live view. The participant dashboard used to send
            them to /live-monitoring, the organizer's operations console. */}
        <Route
          path="/live-updates"
          element={
            <RequireRole roles={['participant', 'organizer', 'admin']}>
              <PageWrapper><LiveUpdates /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/live-monitoring"
          element={
            <RequireRole roles={['organizer', 'admin']}>
              <PageWrapper><LiveMonitoring /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/event-setup"
          element={
            <RequireRole roles={['organizer', 'admin']}>
              <PageWrapper><EventSetup /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/event-cameras"
          element={
            <RequireRole roles={['organizer', 'admin']}>
              <PageWrapper><EventCameras /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/pre-safety-planning"
          element={
            <RequireRole roles={['organizer', 'admin']}>
              <PageWrapper><PreSafetyPlanning /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/crowd-flow-analysis"
          element={
            <RequireRole roles={['organizer', 'admin']}>
              <PageWrapper><CrowdFlowAnalysis /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/anomaly-detection"
          element={
            <RequireRole roles={['organizer', 'admin']}>
              <PageWrapper><AnomalyDetection /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/emergency-dispatch"
          element={
            <RequireRole roles={['organizer', 'admin']}>
              <PageWrapper><EmergencyDispatch /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/ai-summaries"
          element={
            <RequireRole roles={['organizer', 'admin']}>
              <PageWrapper><AISummaries /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/post-event-reports"
          element={
            <RequireRole roles={['organizer', 'admin']}>
              <PageWrapper><PostEventReports /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/admin-dashboard"
          element={
            <RequireRole roles={['admin']}>
              <PageWrapper><AdminDashboard /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/surveillance/cameras"
          element={
            <RequireRole roles={['police', 'admin']}>
              <PageWrapper><CameraRegistry /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/surveillance/map"
          element={
            <RequireRole roles={['police', 'admin']}>
              <PageWrapper><CameraMap /></PageWrapper>
            </RequireRole>
          }
        />
        <Route
          path="/surveillance/live-wall"
          element={
            <RequireRole roles={['police', 'admin']}>
              <PageWrapper><LiveWall /></PageWrapper>
            </RequireRole>
          }
        />

        {/* Police operations. Every route above is guarded too: a participant
            could previously open the admin dashboard, the camera registry and
            the organizer's monitoring console by typing the URL. The server
            authorises every call regardless - this is the client-side half, so
            a signed-out user lands on /login and a signed-in one gets a plain
            refusal instead of a screen of failed requests. */}
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