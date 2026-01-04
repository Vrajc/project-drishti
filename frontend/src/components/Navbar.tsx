import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Menu, X, User } from 'lucide-react';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
        return [];
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
      default:
        navigate('/');
    }
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 glassmorphism border-b border-ai-gray-800"
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
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
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="w-9 h-9 bg-ai-white rounded flex items-center justify-center">
              <span className="text-ai-black font-bold text-lg">✦</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-ai-white">Drishti</span>
          </motion.div>

          <div className="hidden md:flex items-center space-x-1">
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
                className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                  location.pathname === item.path
                    ? 'bg-ai-white text-ai-black shadow-lg'
                    : 'text-ai-gray-300 hover:text-ai-white hover:bg-ai-gray-900'
                }`}
              >
                {item.label}
              </motion.button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-ai-gray-900 rounded-lg border border-ai-gray-800">
                <User className="w-4 h-4 text-ai-gray-400" />
                <span className="text-sm text-ai-gray-300">{user?.name}</span>
                <span className="px-2 py-0.5 bg-ai-white text-ai-black rounded text-xs font-medium">
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
                className="p-2 text-ai-gray-400 hover:text-ai-white transition-colors rounded-lg hover:bg-ai-gray-900"
              >
                <LogOut className="w-5 h-5" />
              </motion.button>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-ai-gray-400 hover:text-ai-white transition-colors rounded-lg hover:bg-ai-gray-900"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </motion.button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ 
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1]
            }}
            className="md:hidden border-t border-ai-gray-800 py-4"
          >
            <div className="space-y-2">
              {navItems.map((item) => (
                <motion.button
                  key={item.path}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    navigate(item.path);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`block w-full text-left px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                    location.pathname === item.path
                      ? 'bg-ai-white text-ai-black'
                      : 'text-ai-gray-300 hover:text-ai-white hover:bg-ai-gray-900'
                  }`}
                >
                  {item.label}
                </motion.button>
              ))}
              
              <div className="pt-4 border-t border-ai-gray-800 mt-4">
                <div className="flex items-center gap-2 px-4 py-2 text-sm text-ai-gray-300">
                  <User className="w-4 h-4" />
                  {user?.name} ({user?.role})
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-ai-gray-400 hover:text-ai-white transition-colors rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.nav>
  );
};

export default Navbar;