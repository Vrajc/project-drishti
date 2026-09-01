import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Menu, X, User } from 'lucide-react';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close the drawer on navigation so it never lingers over the new page
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the drawer is open, otherwise the page behind it
  // scrolls under the user's finger on iOS
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobileMenuOpen]);

  // Escape closes the drawer (also covers phones with attached keyboards)
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getNavItems = () => {
    if (!user) return [];

    switch (user.role) {
      case 'participant':
        return [
          { label: 'Dashboard', path: '/participant-dashboard' },
          { label: 'Explore Events', path: '/explore-events' },
          { label: 'My Events', path: '/my-events' },
          { label: 'Live Updates', path: '/live-monitoring' }
        ];
      case 'organizer':
        // Hide navigation items for all organizer pages
        return [];
      case 'admin':
        // The camera registry is estate-wide, so it sits in the nav rather than
        // behind an event the way the organizer pages do.
        return [
          { label: 'Dashboard', path: '/admin-dashboard' },
          { label: 'Camera Registry', path: '/surveillance/cameras' },
          { label: 'Camera Map', path: '/surveillance/map' },
          { label: 'Live Wall', path: '/surveillance/live-wall' }
        ];
      case 'police':
        return [
          { label: 'Camera Registry', path: '/surveillance/cameras' },
          { label: 'Camera Map', path: '/surveillance/map' },
          { label: 'Live Wall', path: '/surveillance/live-wall' }
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  const handleLogoClick = () => {
    if (!user) {
      navigate('/');
      return;
    }

    switch (user.role) {
      case 'participant':
        navigate('/participant-dashboard');
        break;
      case 'organizer':
        navigate('/organizer-dashboard');
        break;
      case 'admin':
        navigate('/admin-dashboard');
        break;
      case 'police':
        navigate('/surveillance/cameras');
        break;
      default:
        navigate('/');
    }
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 glassmorphism border-b border-ai-gray-800"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="page-container">
        <div className="flex justify-between items-center h-16 gap-2">
          <motion.div
            whileHover={{
              scale: 1.03,
              transition: {
                type: 'spring',
                stiffness: 400,
                damping: 17
              }
            }}
            whileTap={{ scale: 0.97 }}
            onClick={handleLogoClick}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer shrink-0"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-ai-white rounded flex items-center justify-center shrink-0">
              <span className="text-ai-black font-bold text-base sm:text-lg">✦</span>
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-ai-white">Drishti</span>
          </motion.div>

          {/* Desktop nav — allowed to scroll rather than wrap if the role has
              many items and the window is narrow */}
          <div className="hidden md:flex items-center space-x-1 min-w-0 overflow-x-auto no-scrollbar">
            {navItems.map((item) => (
              <motion.button
                key={item.path}
                whileHover={{
                  scale: 1.03,
                  y: -1,
                  transition: {
                    type: 'spring',
                    stiffness: 400,
                    damping: 17
                  }
                }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(item.path)}
                className={`px-3 lg:px-4 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${
                  location.pathname === item.path
                    ? 'bg-ai-white text-ai-black shadow-lg'
                    : 'text-ai-gray-300 hover:text-ai-white hover:bg-ai-gray-900'
                }`}
              >
                {item.label}
              </motion.button>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-ai-gray-900 rounded-lg border border-ai-gray-800 max-w-[16rem]">
                <User className="w-4 h-4 text-ai-gray-400 shrink-0" />
                <span className="text-sm text-ai-gray-300 truncate">{user?.name}</span>
                <span className="px-2 py-0.5 bg-ai-white text-ai-black rounded text-xs font-medium shrink-0">
                  {user?.role}
                </span>
              </div>
              <motion.button
                whileHover={{
                  scale: 1.08,
                  rotate: 5,
                  transition: {
                    type: 'spring',
                    stiffness: 400,
                    damping: 17
                  }
                }}
                whileTap={{ scale: 0.92 }}
                onClick={handleLogout}
                aria-label="Log out"
                className="icon-btn p-2 text-ai-gray-400 hover:text-ai-white transition-colors rounded-lg hover:bg-ai-gray-900"
              >
                <LogOut className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Always available on mobile — even for roles with no nav items,
                since the drawer is the only route to the account and logout */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
              className="icon-btn md:hidden p-2 -mr-2 text-ai-gray-400 hover:text-ai-white transition-colors rounded-lg hover:bg-ai-gray-900"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </motion.button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Tap-away backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 top-16 bg-black/60 backdrop-blur-sm -z-10"
            />

            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1]
              }}
              className="md:hidden overflow-hidden border-t border-ai-gray-800 glassmorphism"
            >
              <div className="page-container py-4 max-h-[calc(100dvh-4rem)] overflow-y-auto safe-bottom">
                <div className="space-y-1">
                  {navItems.map((item) => (
                    <motion.button
                      key={item.path}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        navigate(item.path);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`block w-full text-left px-4 py-3 rounded-lg transition-all text-base font-medium ${
                        location.pathname === item.path
                          ? 'bg-ai-white text-ai-black'
                          : 'text-ai-gray-300 hover:text-ai-white hover:bg-ai-gray-900'
                      }`}
                    >
                      {item.label}
                    </motion.button>
                  ))}

                  <div className={`${navItems.length > 0 ? 'pt-4 mt-4 border-t border-ai-gray-800' : ''}`}>
                    <div className="flex items-center gap-2 px-4 py-2 text-sm text-ai-gray-300">
                      <User className="w-4 h-4 shrink-0" />
                      <span className="truncate break-anywhere">{user?.name}</span>
                      <span className="px-2 py-0.5 bg-ai-white text-ai-black rounded text-xs font-medium shrink-0">
                        {user?.role}
                      </span>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-4 py-3 text-ai-gray-400 hover:text-ai-white transition-colors rounded-lg hover:bg-ai-gray-900"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;