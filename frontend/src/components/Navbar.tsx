import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAlertCounts } from '../services/watchlist.service';
import { onRealtime } from '../lib/socket';
import { LogOut, Menu, X, User } from 'lucide-react';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Alerts nobody has looked at yet. Null until the count is known, so the badge
  // is absent rather than showing a zero it has not verified.
  const [unhandledAlerts, setUnhandledAlerts] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role !== 'police' && user?.role !== 'admin') {
      setUnhandledAlerts(null);
      return;
    }

    let cancelled = false;
    const refresh = () => {
      getAlertCounts()
        .then((counts) => {
          if (!cancelled) setUnhandledAlerts(counts.unhandled);
        })
        .catch(() => {
          // A badge is not worth an error banner in the navigation. The alerts
          // console reports the failure properly; here it simply goes absent.
          if (!cancelled) setUnhandledAlerts(null);
        });
    };

    refresh();
    const offNew = onRealtime('alert:new', refresh);
    const offUpdated = onRealtime('alert:updated', refresh);
    const interval = setInterval(refresh, 30000);

    return () => {
      cancelled = true;
      offNew();
      offUpdated();
      clearInterval(interval);
    };
  }, [user?.role]);

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
        // Admin can reach every police route, so the nav offers them rather
        // than leaving pages that exist and cannot be navigated to.
        return [
          { label: 'Dashboard', path: '/admin-dashboard' },
          { label: 'Alerts', path: '/police/alerts', badge: unhandledAlerts },
          { label: 'Watchlist', path: '/police/watchlist' },
          { label: 'Vehicle Trail', path: '/police/tracking' },
          { label: 'Search', path: '/police/search' },
          { label: 'Dispatch', path: '/police/dispatch' },
          { label: 'Cameras', path: '/surveillance/cameras' }
        ];
      case 'police':
        // Operations first, estate second. A police operator's job starts at
        // the incident queue; the registry is the reference material behind it.
        return [
          { label: 'Overview', path: '/police/overview' },
          { label: 'Alerts', path: '/police/alerts', badge: unhandledAlerts },
          { label: 'Watchlist', path: '/police/watchlist' },
          { label: 'Vehicle Trail', path: '/police/tracking' },
          { label: 'Search', path: '/police/search' },
          { label: 'Dispatch', path: '/police/dispatch' },
          // One entry into the surveillance group. Registry, map and live wall
          // link to each other, so nothing is lost by not listing all three -
          // and nine items overflowed a nav whose scrollbar is deliberately
          // hidden, which made the last of them unreachable.
          { label: 'Cameras', path: '/surveillance/cameras' }
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
        navigate('/police/overview');
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
                {item.badge ? (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold align-middle">
                    {item.badge}
                  </span>
                ) : null}
              </motion.button>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-ai-gray-900 rounded-lg border border-ai-gray-800 max-w-[16rem]">
                <User className="w-4 h-4 text-ai-gray-400 shrink-0" />
                {/* The name yields to the navigation below xl. Seven destinations
                    plus a full name overflowed a nav whose scrollbar is hidden,
                    which silently put the last item out of reach. The role pill
                    stays, and the drawer still shows the name in full. */}
                <span className="hidden xl:inline text-sm text-ai-gray-300 truncate">{user?.name}</span>
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
                      {item.badge ? (
                        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                          {item.badge}
                        </span>
                      ) : null}
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