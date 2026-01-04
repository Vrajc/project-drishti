import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useEvent } from '../contexts/EventContext';
import { Shield, Users, Calendar, Activity, Database, Trash2, Eye, TrendingUp, BarChart3, Settings, FileText } from 'lucide-react';
import FloatingElements from '../components/FloatingElements';
import Navbar from '../components/Navbar';
import GradientButton from '../components/GradientButton';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import ParticleHero from '../components/ParticleHero';
import { incidentService } from '../services/incident.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Event {
  id: string;
  name: string;
  type: string;
  date: string;
  time: string;
  location: string;
  organizerId?: string;
  organizerName?: string;
  crowdSize: number;
  registeredUsers?: string[];
  zones: string[];
  cameras: any[];
  dispatchUnits: any[];
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { getAllEvents, deleteEvent } = useEvent();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'events' | 'users' | 'analytics'>('overview');
  const [allIncidents, setAllIncidents] = useState<any[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Get all events from context
  const allEvents = getAllEvents();

  // Fetch all incidents from all events
  useEffect(() => {
    const fetchAllIncidents = async () => {
      if (allEvents.length === 0) return;
      
      setLoadingIncidents(true);
      try {
        const incidentPromises = allEvents.map(event => 
          incidentService.getIncidentsByEvent(event.id).catch(() => [])
        );
        const incidentArrays = await Promise.all(incidentPromises);
        const allIncidentsFlat = incidentArrays.flat();
        setAllIncidents(allIncidentsFlat);
      } catch (error) {
        console.error('Error fetching incidents:', error);
        setAllIncidents([]);
      } finally {
        setLoadingIncidents(false);
      }
    };

    fetchAllIncidents();
    const intervalId = setInterval(fetchAllIncidents, 5000); // Refresh every 5 seconds
    return () => clearInterval(intervalId);
  }, [allEvents.length]);

  // Helper function to check if event is live
  const isEventLive = (date: string, time: string): boolean => {
    const now = new Date();
    
    // Parse the event date and time
    const eventDate = new Date(date);
    const [hours, minutes] = time.split(':').map(Number);
    eventDate.setHours(hours, minutes, 0, 0);
    
    // Assume event duration is 8 hours (can be made configurable)
    const eventEndTime = new Date(eventDate.getTime() + (8 * 60 * 60 * 1000));
    
    // Check if current time is within event timeframe
    return now >= eventDate && now <= eventEndTime;
  };

  const getEventStatus = (date: string, time: string): 'upcoming' | 'live' | 'completed' => {
    const now = new Date();
    const eventDate = new Date(date);
    const [hours, minutes] = time.split(':').map(Number);
    eventDate.setHours(hours, minutes, 0, 0);
    const eventEndTime = new Date(eventDate.getTime() + (8 * 60 * 60 * 1000));
    
    if (now >= eventDate && now <= eventEndTime) return 'live';
    if (now < eventDate) return 'upcoming';
    return 'completed';
  };

  // Calculate statistics with mock data
  const systemStats = useMemo(() => {
    const now = new Date();
    
    // Get all registered users from localStorage
    const storedUsers = localStorage.getItem('drishti_registered_users');
    let allUsers: any[] = [];
    try {
      allUsers = storedUsers ? JSON.parse(storedUsers) : [];
    } catch {
      allUsers = [];
    }

    const organizers = allUsers.filter(u => u.role === 'organizer');
    const participants = allUsers.filter(u => u.role === 'participant');
    
    // Calculate event statuses using proper time-based logic
    const liveEvents = allEvents.filter(e => isEventLive(e.date, e.time));

    const upcomingEvents = allEvents.filter(e => getEventStatus(e.date, e.time) === 'upcoming');

    const completedEvents = allEvents.filter(e => getEventStatus(e.date, e.time) === 'completed');

    // Calculate incident statistics
    const openIncidents = allIncidents.filter(inc => inc.status === 'open').length;
    const investigatingIncidents = allIncidents.filter(inc => inc.status === 'investigating').length;
    const resolvedIncidents = allIncidents.filter(inc => inc.status === 'resolved').length;
    
    // Calculate average response time
    const resolvedWithTime = allIncidents.filter(inc => inc.status === 'resolved' && inc.responseTime);
    const avgResponseTime = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((sum, inc) => sum + inc.responseTime, 0) / resolvedWithTime.length
      : 0;

    // Count unique organizers from actual events
    const uniqueOrganizerIds = new Set(allEvents.map(event => event.organizerId).filter(Boolean));
    const actualOrganizers = uniqueOrganizerIds.size;

    // Use mock data for user statistics (except organizers - use actual count)
    const mockParticipants = 2103;
    const mockAdmins = 16;
    const mockAvgSafetyScore = 94.5;
    const calculatedTotalUsers = mockParticipants + actualOrganizers + mockAdmins;

    return {
      totalEvents: allEvents.length,
      activeEvents: liveEvents.length,
      upcomingEvents: upcomingEvents.length,
      completedEvents: completedEvents.length,
      totalUsers: calculatedTotalUsers,
      totalOrganizers: actualOrganizers,
      totalParticipants: mockParticipants,
      totalAdmins: mockAdmins,
      totalIncidents: allIncidents.length,
      openIncidents,
      investigatingIncidents,
      resolvedIncidents,
      avgResponseTime,
      avgSafetyScore: mockAvgSafetyScore,
      systemHealth: allEvents.length > 0 ? 98 : 100
    };
  }, [allEvents, allIncidents]);

  const eventsWithStatus = useMemo(() => {
    return allEvents.map(event => {
      const status = getEventStatus(event.date, event.time);
      
      // Count incidents for this event
      const eventIncidents = allIncidents.filter(inc => inc.eventId === event.id);

      return {
        ...event,
        status,
        attendees: event.registeredUsers?.length || 0,
        safetyScore: 0,
        incidents: eventIncidents.length
      };
    });
  }, [allEvents, allIncidents]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'bg-ai-white/10 text-ai-white border-ai-gray-700';
      case 'upcoming':
        return 'bg-ai-gray-800/50 text-ai-gray-300 border-ai-gray-700';
      case 'completed':
        return 'bg-ai-gray-900/50 text-ai-gray-500 border-ai-gray-800';
      default:
        return 'bg-ai-gray-900/50 text-ai-gray-500 border-ai-gray-800';
    }
  };

  const getSafetyScoreColor = (score: number) => {
    if (score >= 90) return 'text-ai-white';
    if (score >= 75) return 'text-ai-gray-300';
    return 'text-ai-gray-500';
  };

  const handleDeleteEvent = (eventId: string) => {
    deleteEvent(eventId);
    setShowDeleteConfirm(null);
  };

  const handleViewEvent = (event: Event) => {
    setSelectedEvent(event);
  };

  const closeEventModal = () => {
    setSelectedEvent(null);
  };

  const generateSystemReport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Header
    doc.setFillColor(26, 26, 26);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Drishti System Report', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 30, { align: 'center' });
    
    let yPos = 50;
    
    // System Overview
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('System Overview', 20, yPos);
    yPos += 10;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    const overviewData = [
      ['Total Events', systemStats.totalEvents.toString()],
      ['Active Events', systemStats.activeEvents.toString()],
      ['Upcoming Events', systemStats.upcomingEvents.toString()],
      ['Completed Events', systemStats.completedEvents.toString()],
      ['Total Users', systemStats.totalUsers.toLocaleString()],
      ['Participants', systemStats.totalParticipants.toLocaleString()],
      ['Organizers', systemStats.totalOrganizers.toString()],
      ['Admins', systemStats.totalAdmins.toString()],
      ['Average Safety Score', systemStats.avgSafetyScore.toFixed(1)],
      ['System Health', `${systemStats.systemHealth}%`]
    ];
    
    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: overviewData,
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26], textColor: [255, 255, 255], fontSize: 11 },
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 100 },
        1: { cellWidth: 60 }
      }
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    // Incident Statistics
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Incident Statistics', 20, yPos);
    yPos += 10;
    
    const incidentData = [
      ['Total Incidents', systemStats.totalIncidents.toString()],
      ['Open Incidents', systemStats.openIncidents.toString()],
      ['Investigating', systemStats.investigatingIncidents.toString()],
      ['Resolved', systemStats.resolvedIncidents.toString()],
      ['Avg Response Time', systemStats.avgResponseTime > 0 
        ? `${Math.floor(systemStats.avgResponseTime / 60)}m ${Math.round(systemStats.avgResponseTime % 60)}s`
        : 'N/A']
    ];
    
    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: incidentData,
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26], textColor: [255, 255, 255], fontSize: 11 },
      styles: { fontSize: 10, cellPadding: 5 }
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    // Events List
    if (eventsWithStatus.length > 0) {
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Events List', 20, yPos);
      yPos += 10;
      
      const eventsData = eventsWithStatus.map(event => [
        event.name,
        event.type,
        new Date(event.date).toLocaleDateString(),
        event.status.toUpperCase(),
        event.attendees.toString(),
        event.incidents.toString()
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Event Name', 'Type', 'Date', 'Status', 'Attendees', 'Incidents']],
        body: eventsData,
        theme: 'striped',
        headStyles: { fillColor: [26, 26, 26], textColor: [255, 255, 255], fontSize: 10 },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 30 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 25 }
        }
      });
    }
    
    // Footer on last page
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      doc.text(
        'Drishti Event Safety Management System',
        pageWidth - 20,
        pageHeight - 10,
        { align: 'right' }
      );
    }
    
    // Save the PDF
    doc.save(`Drishti-System-Report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-ai-black">
      {/* Animated mesh gradient background */}
      <MeshGradient />
      
      {/* Particle layer */}
      <div className="absolute inset-0 z-0 opacity-20">
        <ParticleHero />
      </div>
      
      {/* Interactive spotlight effects */}
      <Spotlight />
      
      <Navbar />

      <div className="relative z-10 pt-24 pb-12">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h1 className="text-5xl font-bold mb-3 text-ai-white tracking-tight">
              System <span className="text-ai-gray-300">Administration</span>
            </h1>
            <p className="text-ai-gray-400 text-lg">
              Complete oversight of all events, users, and system analytics
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            <motion.div 
              whileHover={{ y: -4 }}
              className="glass-light rounded-2xl p-6 border border-ai-gray-800 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-ai-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ai-gray-400 tracking-wide">Total Events</span>
                  <Calendar className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                </div>
                <div className="text-3xl font-bold text-ai-white mb-1">{systemStats.totalEvents}</div>
                <div className="text-sm text-ai-gray-500">{systemStats.activeEvents} live now</div>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -4 }}
              className="glass-light rounded-2xl p-6 border border-ai-gray-800 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-ai-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ai-gray-400 tracking-wide">Total Users</span>
                  <Users className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                </div>
                <div className="text-3xl font-bold text-ai-white mb-1">{systemStats.totalUsers.toLocaleString()}</div>
                <div className="text-sm text-ai-gray-500">{systemStats.totalOrganizers} organizers</div>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -4 }}
              className="glass-light rounded-2xl p-6 border border-ai-gray-800 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-ai-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ai-gray-400 tracking-wide">Avg Safety Score</span>
                  <Shield className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                </div>
                <div className="text-3xl font-bold text-ai-white mb-1">{systemStats.avgSafetyScore.toFixed(1)}</div>
                <div className="text-sm text-ai-gray-500">Excellent</div>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -4 }}
              className="glass-light rounded-2xl p-6 border border-ai-gray-800 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-ai-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ai-gray-400 tracking-wide">System Health</span>
                  <Activity className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                </div>
                <div className="text-3xl font-bold text-ai-white mb-1">{systemStats.systemHealth}%</div>
                <div className="text-sm text-ai-gray-500">Optimal</div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-light rounded-2xl p-6 mb-8 border border-ai-gray-800"
          >
            <div className="flex gap-4 mb-6 border-b border-ai-gray-800 pb-4">
              <button
                onClick={() => setSelectedTab('overview')}
                className={`px-5 py-2.5 rounded-xl transition-all font-medium ${
                  selectedTab === 'overview'
                    ? 'bg-ai-white text-ai-black'
                    : 'text-ai-gray-400 hover:text-ai-white hover:bg-ai-gray-900/50'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setSelectedTab('events')}
                className={`px-5 py-2.5 rounded-xl transition-all font-medium ${
                  selectedTab === 'events'
                    ? 'bg-ai-white text-ai-black'
                    : 'text-ai-gray-400 hover:text-ai-white hover:bg-ai-gray-900/50'
                }`}
              >
                All Events
              </button>
              <button
                onClick={() => setSelectedTab('users')}
                className={`px-5 py-2.5 rounded-xl transition-all font-medium ${
                  selectedTab === 'users'
                    ? 'bg-ai-white text-ai-black'
                    : 'text-ai-gray-400 hover:text-ai-white hover:bg-ai-gray-900/50'
                }`}
              >
                Users
              </button>
              <button
                onClick={() => setSelectedTab('analytics')}
                className={`px-5 py-2.5 rounded-xl transition-all font-medium ${
                  selectedTab === 'analytics'
                    ? 'bg-ai-white text-ai-black'
                    : 'text-ai-gray-400 hover:text-ai-white hover:bg-ai-gray-900/50'
                }`}
              >
                Analytics
              </button>
            </div>

            {selectedTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-ai-gray-900/50 rounded-xl p-6 border border-ai-gray-800 hover:border-ai-gray-700 transition-colors group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-ai-white/5 rounded-xl flex items-center justify-center group-hover:bg-ai-white/10 transition-colors">
                        <Calendar className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                      </div>
                      <div>
                        <div className="text-sm text-ai-gray-500">Event Distribution</div>
                        <div className="text-lg font-semibold text-ai-white">By Status</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-ai-gray-400">Live</span>
                        <span className="text-ai-white font-medium">{systemStats.activeEvents}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ai-gray-400">Upcoming</span>
                        <span className="text-ai-white font-medium">{systemStats.upcomingEvents}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ai-gray-400">Completed</span>
                        <span className="text-ai-gray-500 font-medium">{systemStats.completedEvents}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-ai-gray-900/50 rounded-xl p-6 border border-ai-gray-800 hover:border-ai-gray-700 transition-colors group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-ai-white/5 rounded-xl flex items-center justify-center group-hover:bg-ai-white/10 transition-colors">
                        <Users className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                      </div>
                      <div>
                        <div className="text-sm text-ai-gray-500">User Statistics</div>
                        <div className="text-lg font-semibold text-ai-white">Platform Users</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-ai-gray-400">Participants</span>
                        <span className="text-ai-white font-medium">{systemStats.totalParticipants.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ai-gray-400">Organizers</span>
                        <span className="text-ai-white font-medium">{systemStats.totalOrganizers}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ai-gray-400">Admins</span>
                        <span className="text-ai-white font-medium">{systemStats.totalAdmins}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-ai-gray-900/50 rounded-xl p-6 border border-ai-gray-800 hover:border-ai-gray-700 transition-colors group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-ai-white/5 rounded-xl flex items-center justify-center group-hover:bg-ai-white/10 transition-colors">
                        <Shield className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                      </div>
                      <div>
                        <div className="text-sm text-ai-gray-500">Safety Overview</div>
                        <div className="text-lg font-semibold text-ai-white">Incident Reports</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-ai-gray-400">Total Incidents</span>
                        <span className="text-ai-white font-medium">{systemStats.totalIncidents}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ai-gray-400">Open</span>
                        <span className="text-red-400 font-medium">{systemStats.openIncidents || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ai-gray-400">Investigating</span>
                        <span className="text-yellow-400 font-medium">{systemStats.investigatingIncidents || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ai-gray-400">Resolved</span>
                        <span className="text-green-400 font-medium">{systemStats.resolvedIncidents || 0}</span>
                      </div>
                      {systemStats.avgResponseTime > 0 && (
                        <div className="flex justify-between text-sm pt-2 border-t border-ai-gray-800">
                          <span className="text-ai-gray-400">Avg Response</span>
                          <span className="text-ai-white font-medium">
                            {Math.floor(systemStats.avgResponseTime / 60)}m {Math.round(systemStats.avgResponseTime % 60)}s
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'events' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-ai-white tracking-wide">All Events Across Platform</h3>
                  <div className="text-sm text-ai-gray-400">{eventsWithStatus.length} events</div>
                </div>

                {eventsWithStatus.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-ai-gray-700 mx-auto mb-4" />
                    <p className="text-ai-gray-400 text-lg">No events have been created yet</p>
                    <p className="text-ai-gray-500 text-sm mt-2">Events created by organizers will appear here</p>
                  </div>
                ) : (
                  eventsWithStatus.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ x: 4 }}
                      className="bg-ai-gray-900/50 rounded-xl p-5 border border-ai-gray-800 hover:border-ai-gray-700 transition-all"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h4 className="text-lg font-semibold text-ai-white">{event.name}</h4>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(event.status)}`}>
                              {event.status.toUpperCase()}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-ai-gray-500 mb-1">Organizer</div>
                              <div className="text-ai-gray-300">{event.organizerName || 'Unknown'}</div>
                            </div>
                            <div>
                              <div className="text-ai-gray-500 mb-1">Date</div>
                              <div className="text-ai-gray-300">{new Date(event.date).toLocaleDateString()}</div>
                            </div>
                            <div>
                              <div className="text-ai-gray-500 mb-1">Attendees</div>
                              <div className="text-ai-gray-300">{event.attendees.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-ai-gray-500 mb-1">Safety Score</div>
                              <div className={`font-semibold ${getSafetyScoreColor(event.safetyScore)}`}>
                                {event.safetyScore > 0 ? event.safetyScore : '-'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleViewEvent(event)}
                            className="px-4 py-2 bg-ai-white text-ai-black rounded-lg hover:shadow-lg hover:shadow-white/10 transition-all flex items-center gap-2 font-medium"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowDeleteConfirm(event.id)}
                            className="px-4 py-2 bg-ai-gray-900/50 border border-ai-gray-800 hover:border-ai-gray-700 rounded-lg text-ai-gray-400 hover:text-ai-white transition-all flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}

            {selectedTab === 'users' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-white">User Management</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700/50">
                    <Users className="w-8 h-8 text-cyan-400 mb-3" />
                    <div className="text-2xl font-bold text-white mb-1">
                      {systemStats.totalParticipants.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-400 mb-4">Total Participants</div>
                    <GradientButton className="w-full text-sm py-2">
                      View All
                    </GradientButton>
                  </div>

                  <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700/50">
                    <Calendar className="w-8 h-8 text-green-400 mb-3" />
                    <div className="text-2xl font-bold text-white mb-1">
                      {systemStats.totalOrganizers}
                    </div>
                    <div className="text-sm text-gray-400 mb-4">Event Organizers</div>
                    <GradientButton className="w-full text-sm py-2">
                      View All
                    </GradientButton>
                  </div>

                  <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700/50">
                    <Shield className="w-8 h-8 text-purple-400 mb-3" />
                    <div className="text-2xl font-bold text-white mb-1">
                      {systemStats.totalUsers - systemStats.totalParticipants - systemStats.totalOrganizers}
                    </div>
                    <div className="text-sm text-gray-400 mb-4">System Admins</div>
                    <GradientButton className="w-full text-sm py-2">
                      Manage
                    </GradientButton>
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'analytics' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-white">System Analytics</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700/50">
                    <div className="flex items-center gap-3 mb-4">
                      <TrendingUp className="w-6 h-6 text-green-400" />
                      <h4 className="text-lg font-semibold text-white">Platform Growth</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Users</span>
                        <span className="text-green-400 font-semibold">{systemStats.totalUsers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Events</span>
                        <span className="text-green-400 font-semibold">{systemStats.totalEvents}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Growth Rate</span>
                        <span className="text-green-400 font-semibold">-</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700/50">
                    <div className="flex items-center gap-3 mb-4">
                      <Database className="w-6 h-6 text-blue-400" />
                      <h4 className="text-lg font-semibold text-white">System Resources</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Events Created</span>
                        <span className="text-blue-400 font-semibold">{systemStats.totalEvents}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Active Users</span>
                        <span className="text-blue-400 font-semibold">{systemStats.totalUsers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Uptime</span>
                        <span className="text-green-400 font-semibold">-</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-light rounded-2xl p-6 border border-ai-gray-800"
          >
            <h3 className="text-xl font-semibold text-ai-white mb-4">System Actions</h3>
            <div className="flex flex-wrap gap-4">
              <GradientButton onClick={generateSystemReport}>
                Generate System Report
              </GradientButton>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={closeEventModal}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="glass-light rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-ai-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-ai-white">{selectedEvent.name}</h2>
              <button
                onClick={closeEventModal}
                className="text-ai-gray-400 hover:text-ai-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-ai-gray-500 mb-1">Event Type</div>
                  <div className="text-ai-white font-medium">{selectedEvent.type}</div>
                </div>
                <div>
                  <div className="text-sm text-ai-gray-500 mb-1">Date & Time</div>
                  <div className="text-ai-white font-medium">
                    {new Date(selectedEvent.date).toLocaleDateString()} at {selectedEvent.time}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm text-ai-gray-500 mb-1">Location</div>
                <div className="text-ai-white font-medium">{selectedEvent.location}</div>
              </div>

              <div>
                <div className="text-sm text-ai-gray-500 mb-1">Organizer</div>
                <div className="text-ai-white font-medium">{selectedEvent.organizerName || 'Unknown'}</div>
                {selectedEvent.organizerEmail && (
                  <div className="text-sm text-ai-gray-400">{selectedEvent.organizerEmail}</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-ai-gray-500 mb-1">Expected Crowd Size</div>
                  <div className="text-ai-white font-medium">{selectedEvent.crowdSize.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-ai-gray-500 mb-1">Registered Attendees</div>
                  <div className="text-ai-white font-medium">{selectedEvent.registeredUsers?.length || 0}</div>
                </div>
              </div>

              {selectedEvent.description && (
                <div>
                  <div className="text-sm text-ai-gray-500 mb-1">Description</div>
                  <div className="text-ai-white">{selectedEvent.description}</div>
                </div>
              )}

              <div>
                <div className="text-sm text-ai-gray-500 mb-1">Zones ({selectedEvent.zones.length})</div>
                <div className="flex flex-wrap gap-2">
                  {selectedEvent.zones.map((zone, idx) => (
                    <span key={idx} className="px-3 py-1 bg-ai-gray-900/50 border border-ai-gray-800 rounded-lg text-ai-white text-sm">
                      {zone}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm text-ai-gray-500 mb-1">Cameras ({selectedEvent.cameras.length})</div>
                <div className="space-y-2">
                  {selectedEvent.cameras.map((camera, idx) => (
                    <div key={idx} className="bg-ai-gray-900/50 border border-ai-gray-800 rounded-lg p-3">
                      <div className="text-ai-white font-medium">{camera.name}</div>
                      <div className="text-sm text-ai-gray-400">{camera.location}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm text-ai-gray-500 mb-1">Dispatch Units ({selectedEvent.dispatchUnits.length})</div>
                <div className="space-y-2">
                  {selectedEvent.dispatchUnits.map((unit, idx) => (
                    <div key={idx} className="bg-ai-gray-900/50 border border-ai-gray-800 rounded-lg p-3">
                      <div className="text-ai-white font-medium">{unit.name}</div>
                      <div className="text-sm text-ai-gray-400">{unit.type} - Capacity: {unit.capacity}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={closeEventModal}
                className="px-6 py-2 bg-ai-white text-ai-black rounded-lg font-medium hover:shadow-lg transition-all"
              >
                Close
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowDeleteConfirm(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="glass-light rounded-2xl p-6 max-w-md w-full border border-ai-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-ai-white">Delete Event</h3>
                <p className="text-sm text-ai-gray-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-ai-gray-300 mb-6">
              Are you sure you want to delete this event? All associated data will be permanently removed.
            </p>

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-ai-gray-900/50 border border-ai-gray-800 rounded-lg text-ai-white hover:border-ai-gray-700 transition-all"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleDeleteEvent(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all font-medium"
              >
                Delete
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default AdminDashboard;
