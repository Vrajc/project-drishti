import React, { useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Users, AlertTriangle, MapPin, Brain, Eye } from 'lucide-react';
import FloatingElements from '../components/FloatingElements';
import GradientButton from '../components/GradientButton';
import FeatureCard from '../components/FeatureCard';
import Spotlight from '../components/Spotlight';
import ParticleHero from '../components/ParticleHero';
import AnimatedHeroText from '../components/AnimatedHeroText';
import SplineScene from '../components/SplineScene';
import HeroButtonExpandable from '../components/HeroButtonExpandable';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.3], [1, 0.95]);

  useEffect(() => {
    document.title = 'Drishti - AI-Powered Event Safety';
  }, []);

  const features = [
    {
      icon: Shield,
      title: 'AI Pre-Safety Planning',
      description: 'Intelligent placement of safety infrastructure before events begin'
    },
    {
      icon: Users,
      title: 'Crowd Flow Analysis',
      description: 'Predict bottlenecks and congestion 15-20 minutes in advance'
    },
    {
      icon: AlertTriangle,
      title: 'Anomaly Detection',
      description: 'Real-time detection of emergencies, fires, and safety threats'
    },
    {
      icon: MapPin,
      title: 'Smart Dispatch',
      description: 'Automated emergency response with optimal routing'
    },
    {
      icon: Brain,
      title: 'AI Summaries',
      description: 'Conversational insights about event safety status'
    },
    {
      icon: Eye,
      title: 'Live Monitoring',
      description: 'Comprehensive dashboard for event safety oversight'
    }
  ];

  return (
    <div className="min-h-screen bg-ai-black text-ai-white overflow-hidden relative">
      {/* Particle canvas - Behind everything */}
      <ParticleHero />
      
      {/* Spotlight glow effects */}
      <Spotlight />
      
      {/* Grid background */}
      <div className="fixed inset-0 grid-background opacity-40" />
      
      <FloatingElements />
      
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 glassmorphism border-b border-ai-gray-800"
      >
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-ai-white rounded flex items-center justify-center">
                <span className="text-ai-black font-bold text-lg">✦</span>
              </div>
              <span className="text-xl font-bold tracking-tight">Drishti</span>
            </div>
            <div className="flex items-center gap-4">
              <GradientButton onClick={() => navigate('/login')} variant="ghost">
                Login
              </GradientButton>
              <GradientButton onClick={() => navigate('/register')} variant="primary">
                Get Started
              </GradientButton>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 min-h-screen flex items-center">
        <motion.div 
          className="w-full px-4 sm:px-6 lg:px-8 relative z-10 w-full"
          style={{ opacity, scale }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div className="space-y-8">
              {/* Animated Hero headline */}
              <AnimatedHeroText className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-none">
                AI-Powered Event Safety
              </AnimatedHeroText>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="text-lg md:text-xl text-ai-gray-400 leading-relaxed font-light max-w-xl"
              >
                Predict risks. Detect emergencies. Coordinate responses.
                <br />
                Advanced AI for large-scale public safety.
              </motion.p>

              {/* CTA Buttons with expandable info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="flex flex-col sm:flex-row gap-4 items-start"
              >
                <HeroButtonExpandable 
                  onClick={() => navigate('/register')}
                  variant="primary"
                  expandedContent={
                    <div className="text-sm">
                      <div className="font-semibold text-text-primary mb-2">Start Free Demo</div>
                      <p className="text-text-tertiary">Experience full platform capabilities</p>
                    </div>
                  }
                >
                  Start Demo
                </HeroButtonExpandable>
                
                {/* Live AI Status Indicator */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="relative group cursor-default w-[200px]"
                >
                  <div className="glassmorphism border border-ai-gray-800 rounded-xl px-6 py-4 h-full">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-ai-white">AI Systems Active</div>
                        <div className="text-xs text-ai-gray-400">6 Models Online</div>
                      </div>
                    </div>
                    {/* Hover tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="glassmorphism border border-ai-gray-800 rounded-lg px-4 py-3 text-xs whitespace-nowrap">
                        <div className="text-ai-gray-400 mb-2">Real-time Processing:</div>
                        <div className="space-y-1 text-ai-white">
                          <div>✓ Crowd Flow Prediction</div>
                          <div>✓ Anomaly Detection</div>
                          <div>✓ Emergency Response</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Stats bar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1 }}
                className="grid grid-cols-3 gap-6 pt-8 border-t border-border-subtle"
              >
                {[
                  { value: '15-20min', label: 'Early Warning' },
                  { value: '99.8%', label: 'Detection Rate' },
                  { value: '<30sec', label: 'Response Time' }
                ].map((stat, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.2 + index * 0.1 }}
                  >
                    <div className="text-2xl md:text-3xl font-bold text-ai-white mb-1">{stat.value}</div>
                    <div className="text-sm text-ai-gray-500 font-light">{stat.label}</div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Right: 3D Spline Scene with centered logo */}
            <div className="relative h-[500px] lg:h-[600px]">
              {/* Logo in exact center of circular animation */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
              >
                <div className="relative">
                  <div className="w-20 h-20 bg-ai-white rounded-xl flex items-center justify-center shadow-2xl">
                    <span className="text-ai-black font-bold text-4xl">✦</span>
                  </div>
                  {/* Animated rings */}
                  <motion.div
                    className="absolute inset-0 rounded-xl border-2 border-ai-white"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0, 0.5],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-xl border-2 border-ai-white"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.3, 0, 0.3],
                    }}
                    transition={{
                      duration: 3,
                      delay: 0.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                </div>
              </motion.div>
              
              {/* Spline Scene */}
              <SplineScene className="w-full h-full" />
            </div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-6 h-10 border-2 border-text-tertiary/30 rounded-full flex justify-center pt-2"
          >
            <motion.div 
              className="w-1 h-2 bg-text-tertiary rounded-full"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative">
        <motion.div 
          className="w-full px-4 sm:px-6 lg:px-8 relative z-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            {/* Section label */}
            <motion.div 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-ai-gray-800 bg-ai-gray-900 mb-6"
              whileHover={{ scale: 1.05 }}
            >
              <div className="w-2 h-2 bg-ai-white rounded-full animate-glow-pulse" />
              <span className="text-sm text-ai-gray-400 font-medium">Six Core Capabilities</span>
            </motion.div>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
              <span className="text-ai-white">Comprehensive Safety</span>
              <br />
              <span className="text-ai-gray-500">Infrastructure</span>
            </h2>
            <p className="text-ai-gray-400 text-base md:text-lg max-w-2xl mx-auto font-light">
              Six integrated AI systems working together to ensure complete event oversight
            </p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.08
                }
              }
            }}
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: { opacity: 1, y: 0 }
                }}
              >
                <FeatureCard
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  delay={0}
                />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="w-full px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, margin: "-100px" }}
            className="glassmorphism rounded-2xl p-12 md:p-16 border border-ai-gray-800 relative overflow-hidden group"
            whileHover={{ scale: 1.02 }}
          >
            {/* Animated background gradient on hover */}
            <motion.div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.03) 0%, transparent 70%)',
              }}
            />
            
            {/* Accent line */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-ai-white to-transparent" />
            
            <div className="relative z-10">
              <motion.h3 
                className="text-3xl md:text-4xl font-bold mb-6 text-ai-white tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                viewport={{ once: true }}
              >
                Ready to Transform
                <br />
                Event Safety?
              </motion.h3>
              
              <motion.p 
                className="text-ai-gray-400 text-base md:text-lg mb-10 max-w-2xl mx-auto font-light"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                viewport={{ once: true }}
              >
                Join the future of AI-powered event management.
                <br className="hidden md:block" />
                Protect your attendees with cutting-edge technology.
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                viewport={{ once: true }}
              >
                <GradientButton 
                  onClick={() => navigate('/register')} 
                  variant="primary"
                  className="text-base px-10 py-4 flex items-center gap-2 mx-auto"
                >
                  Get Started Now <ArrowRight className="w-5 h-5" />
                </GradientButton>
              </motion.div>
            </div>

            {/* Bottom accent */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-ai-white to-transparent" />
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-ai-gray-900 relative z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-ai-gray-600 text-sm font-light">
            © 2025 Drishti. Built for hackathon demonstration. Privacy-first design.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;