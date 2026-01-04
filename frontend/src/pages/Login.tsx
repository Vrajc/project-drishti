import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, User, Shield, Briefcase } from 'lucide-react';
import GradientButton from '../components/GradientButton';
import FloatingElements from '../components/FloatingElements';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import ParticleHero from '../components/ParticleHero';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'participant' as 'participant' | 'organizer' | 'admin'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate Gmail
    if (!formData.email.endsWith('@gmail.com')) {
      setError('Email must be a Gmail address (@gmail.com)');
      return;
    }

    setLoading(true);

    try {
      await login(formData.email, formData.password, formData.role);

      // Redirect based on role
      if (formData.role === 'participant') {
        navigate('/participant-dashboard');
      } else if (formData.role === 'organizer') {
        navigate('/organizer-dashboard');
      } else if (formData.role === 'admin') {
        navigate('/admin-dashboard');
      }
    } catch (error: any) {
      setError(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-ai-black">
      {/* Animated mesh gradient background */}
      <MeshGradient />
      
      {/* Particle layer */}
      <div className="absolute inset-0 z-0 opacity-30">
        <ParticleHero />
      </div>
      
      {/* Interactive spotlight effects */}
      <Spotlight />
      
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          {/* Header */}
          <div className="text-center mb-10">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-5xl font-bold text-ai-white mb-3 tracking-tight"
            >
              Welcome Back
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-ai-gray-400 text-lg"
            >
              Sign in to continue to Drishti
            </motion.p>
          </div>

          {/* Auth Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="glass-light rounded-2xl p-8 shadow-2xl border border-ai-gray-800 relative group"
            style={{
              boxShadow: '0 0 40px rgba(255, 255, 255, 0.03), 0 0 80px rgba(255, 255, 255, 0.015)'
            }}
          >
            {/* Soft glow border effect */}
            <div 
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.05) 100%)',
                filter: 'blur(1px)'
              }}
            />
            
            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-ai-gray-300 mb-4 tracking-wide">
                  Select Role
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setFormData({ ...formData, role: 'participant' })}
                    className={`p-4 rounded-xl transition-all duration-300 relative overflow-hidden ${
                      formData.role === 'participant'
                        ? 'bg-ai-white text-ai-black shadow-lg'
                        : 'bg-ai-gray-900/50 text-ai-gray-400 hover:bg-ai-gray-800/50 border border-ai-gray-800'
                    }`}
                  >
                    {formData.role === 'participant' && (
                      <motion.div
                        layoutId="roleIndicator"
                        className="absolute inset-0 bg-ai-white"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <div className="relative z-10 flex flex-col items-center">
                      <User className="w-6 h-6 mb-2" />
                      <span className="text-xs font-medium">Participant</span>
                    </div>
                  </motion.button>

                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setFormData({ ...formData, role: 'organizer' })}
                    className={`p-4 rounded-xl transition-all duration-300 relative overflow-hidden ${
                      formData.role === 'organizer'
                        ? 'bg-ai-white text-ai-black shadow-lg'
                        : 'bg-ai-gray-900/50 text-ai-gray-400 hover:bg-ai-gray-800/50 border border-ai-gray-800'
                    }`}
                  >
                    {formData.role === 'organizer' && (
                      <motion.div
                        layoutId="roleIndicator"
                        className="absolute inset-0 bg-ai-white"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <div className="relative z-10 flex flex-col items-center">
                      <Briefcase className="w-6 h-6 mb-2" />
                      <span className="text-xs font-medium">Organizer</span>
                    </div>
                  </motion.button>

                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.4 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setFormData({ ...formData, role: 'admin' })}
                    className={`p-4 rounded-xl transition-all duration-300 relative overflow-hidden ${
                      formData.role === 'admin'
                        ? 'bg-ai-white text-ai-black shadow-lg'
                        : 'bg-ai-gray-900/50 text-ai-gray-400 hover:bg-ai-gray-800/50 border border-ai-gray-800'
                    }`}
                  >
                    {formData.role === 'admin' && (
                      <motion.div
                        layoutId="roleIndicator"
                        className="absolute inset-0 bg-ai-white"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <div className="relative z-10 flex flex-col items-center">
                      <Shield className="w-6 h-6 mb-2" />
                      <span className="text-xs font-medium">Admin</span>
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* Email Input */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.4 }}
              >
                <label htmlFor="email" className="block text-sm font-medium text-ai-gray-300 mb-2 tracking-wide">
                  Email Address (Gmail only)
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-ai-gray-500 w-5 h-5 transition-colors group-focus-within:text-ai-gray-300" />
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 bg-ai-gray-900/50 border border-ai-gray-800 rounded-xl text-ai-white placeholder-ai-gray-500 focus:outline-none focus:ring-2 focus:ring-ai-white/20 focus:border-ai-gray-700 transition-all duration-300"
                    placeholder="yourname@gmail.com"
                    required
                  />
                </div>
              </motion.div>

              {/* Password Input */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.4 }}
              >
                <label htmlFor="password" className="block text-sm font-medium text-ai-gray-300 mb-2 tracking-wide">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-ai-gray-500 w-5 h-5 transition-colors group-focus-within:text-ai-gray-300" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-12 pr-14 py-3.5 bg-ai-gray-900/50 border border-ai-gray-800 rounded-xl text-ai-white placeholder-ai-gray-500 focus:outline-none focus:ring-2 focus:ring-ai-white/20 focus:border-ai-gray-700 transition-all duration-300"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-ai-gray-500 hover:text-ai-white transition-colors duration-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </motion.div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 backdrop-blur-sm"
                >
                  <p className="text-sm text-red-400">{error}</p>
                </motion.div>
              )}

              {/* Submit Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.4 }}
              >
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 bg-ai-white text-ai-black font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-white/10 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="relative z-10">{loading ? 'Signing In...' : 'Sign In'}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-ai-gray-100 via-ai-white to-ai-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </motion.button>
              </motion.div>

              {/* Sign Up Link */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1, duration: 0.4 }}
                className="text-center text-sm text-ai-gray-400 pt-2"
              >
                Don't have an account?{' '}
                <Link 
                  to="/register" 
                  className="text-ai-white hover:text-ai-gray-300 font-medium transition-colors duration-300 underline decoration-ai-gray-700 hover:decoration-ai-gray-500 underline-offset-2"
                >
                  Sign Up
                </Link>
              </motion.p>
            </form>
          </motion.div>

          {/* Subtle bottom text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="text-center text-xs text-ai-gray-600 mt-8"
          >
            Secured by Drishti AI Platform
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;