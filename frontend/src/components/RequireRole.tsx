import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth, type UserRole } from '../contexts/AuthContext';
import MeshGradient from './MeshGradient';
import Spotlight from './Spotlight';
import Navbar from './Navbar';

// ============================================================================
// Route guard.
//
// The app had none: every route in App.tsx was a bare <Route>, so any URL was
// reachable by anyone and the server's 403 was the only real boundary. That was
// survivable while the pages were read-only dashboards. It is not survivable
// now that a page can dispatch a police unit.
//
// This does not replace the server checks - it cannot, and it must not be
// trusted to. The API still authorises every call, and a user who edits their
// stored role gains nothing but a page that 403s on every request. What this
// adds is the honest client-side half: the right destination for a signed-out
// user, and a clear refusal instead of a screen of failed requests.
// ============================================================================

interface RequireRoleProps {
  roles: UserRole[];
  children: React.ReactNode;
}

const RequireRole: React.FC<RequireRoleProps> = ({ roles, children }) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    // `state` lets Login send them back where they were going.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!roles.includes(user.role)) {
    return (
      <div className="relative min-h-screen bg-ai-black text-ai-white overflow-hidden">
        <MeshGradient />
        <Spotlight />
        <Navbar />

        <div className="relative z-10 pt-24 pb-12 safe-bottom">
          <div className="page-container max-w-lg mx-auto text-center">
            <ShieldAlert className="w-10 h-10 text-ai-gray-500 mx-auto mb-4" />
            <h1 className="text-heading text-xl sm:text-2xl font-bold text-ai-white mb-2">
              Not available to your role
            </h1>
            <p className="text-sm text-ai-gray-400">
              This page is limited to {roles.join(' and ')}. You are signed in as {user.role}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireRole;
