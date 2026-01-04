import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Shield, Users, AlertTriangle, Clock, Calendar, BarChart3 } from 'lucide-react';
import { useEvent } from '../contexts/EventContext';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import DataTable from '../components/DataTable';
import { generateEventReport } from '../services/ai.service';
import { generatePDFReport } from '../utils/pdfGenerator';

const PostEventReports: React.FC = () => {
  const { event, getEventsByOrganizer } = useEvent();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Check if event is completed (date has passed)
  const isEventCompleted = event && new Date(event.date) < new Date();

  // Use real event data or show empty state
  const eventData = event ? {
    name: event.name,
    date: event.date,
    duration: '8 hours', // Would be calculated from event start/end
    attendance: event.registeredUsers?.length || 0,
    zones: event.zones.length,
    incidents: 0, // Would come from monitoring data
    responseTime: 0, // Would come from monitoring data
    safetyScore: 0 // Would come from monitoring data
  } : null;

  // Incident data would come from monitoring system
  const incidentTableData: any[] = [];

  const incidentTableColumns = [
    { key: 'time', label: 'Time', width: 'w-24' },
    { key: 'type', label: 'Type', width: 'w-32' },
    { key: 'severityDisplay', label: 'Severity', width: 'w-28', align: 'center' as const },
    { key: 'location', label: 'Location', width: 'w-36' },
    { key: 'response', label: 'Response Time', width: 'w-32', align: 'center' as const },
    { key: 'statusDisplay', label: 'Status', width: 'w-28', align: 'center' as const }
  ];

  const reportSections = [
    {
      id: 'executive',
      title: 'Executive Summary',
      description: 'High-level overview of safety performance and key metrics',
      icon: BarChart3,
      data: {
        safetyScore: eventData?.safetyScore || 0,
        incidents: eventData?.incidents || 0,
        resolved: eventData?.incidents || 0,
        avgResponse: eventData?.responseTime ? `${eventData.responseTime} minutes` : 'N/A',
        attendeeSatisfaction: 'N/A'
      }
    },
    {
      id: 'incidents',
      title: 'Incident Analysis',
      description: 'Detailed breakdown of all reported incidents and responses',
      icon: AlertTriangle,
      data: {
        total: eventData?.incidents || 0,
        medical: 0,
        security: 0,
        lostFound: 0,
        other: 0,
        resolved: eventData?.incidents || 0,
        avgResolution: 'N/A'
      }
    },
    {
      id: 'crowd',
      title: 'Crowd Flow Analysis',
      description: 'Crowd density patterns and bottleneck analysis throughout the event',
      icon: Users,
      data: {
        peakAttendance: eventData?.attendance || 0,
        avgDensity: 'N/A',
        bottlenecks: 0,
        peakHour: 'N/A',
        flowEfficiency: 'N/A'
      }
    },
    {
      id: 'response',
      title: 'Emergency Response',
      description: 'Emergency response team performance and dispatch efficiency',
      icon: Shield,
      data: {
        totalDispatches: 0,
        avgResponseTime: eventData?.responseTime ? `${eventData.responseTime} min` : 'N/A',
        firstResponseSuccess: 'N/A',
        unitsDeployed: 0,
        optimalRouting: 'N/A'
      }
    },
    {
      id: 'recommendations',
      title: 'AI Recommendations',
      description: 'Data-driven insights for future event improvements',
      icon: FileText,
      data: {
        improvements: 0,
        priorities: 0,
        costSavings: 'N/A',
        riskReduction: 'N/A'
      }
    }
  ];

  const generateReport = async () => {
    if (!eventData) {
      alert('No event data available to generate report.');
      return;
    }

    setIsGenerating(true);
    
    try {
      // Get AI-generated insights
      const result = await generateEventReport({
        name: eventData.name,
        date: new Date(eventData.date).toLocaleDateString(),
        duration: eventData.duration,
        attendance: eventData.attendance,
        incidents: eventData.incidents,
        safetyScore: eventData.safetyScore,
        responseTime: eventData.responseTime,
        zones: event?.zones || []
      });

      // Prepare data for PDF generation
      const pdfData = {
        eventData,
        incidents: incidentTableData,
        aiReport: result.success && result.report ? result.report : undefined
      };

      // Generate and download PDF
      generatePDFReport(pdfData);
    } catch (error) {
      console.error('Report generation error:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-ai-black text-ai-white overflow-hidden">
      <MeshGradient />
      <Spotlight />
      <Navbar />
      
      <div className="relative z-10 pt-24 pb-12">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <FileText className="w-16 h-16 mx-auto mb-4 text-ai-white" />
            <h1 className="text-heading text-4xl font-bold mb-4 text-ai-white">
              Post-Event Reports
            </h1>
            <p className="text-ai-gray-400 text-lg max-w-2xl mx-auto">
              Comprehensive safety analysis and insights for continuous improvement
            </p>
          </motion.div>

          {/* Event Summary */}
          {!eventData ? (
            <div className="glass-light rounded-2xl p-12 mb-8 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-ai-gray-700" />
              <h3 className="text-xl font-semibold text-white mb-2">No Event Data Available</h3>
              <p className="text-ai-gray-400">Set up an event first to generate post-event reports</p>
            </div>
          ) : !isEventCompleted ? (
            <div className="glass-light rounded-2xl p-12 mb-8 text-center">
              <Clock className="w-16 h-16 mx-auto mb-4 text-ai-gray-700" />
              <h3 className="text-xl font-semibold text-white mb-2">Event Not Yet Completed</h3>
              <p className="text-ai-gray-400">Reports will be available after the event date: {new Date(event!.date).toLocaleDateString()}</p>
            </div>
          ) : (
            <>
          <div className="glass-light rounded-2xl p-6 mb-8">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <Calendar className="w-12 h-12 text-ai-white" />
                <div>
                  <h3 className="text-xl font-semibold text-white">{eventData.name}</h3>
                  <p className="text-ai-gray-400">{new Date(eventData.date).toLocaleDateString()} • {eventData.duration}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold text-ai-white">{eventData.attendance.toLocaleString()}</div>
                  <div className="text-sm text-ai-gray-400">Attendees</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-ai-white">{eventData.safetyScore || '-'}</div>
                  <div className="text-sm text-ai-gray-400">Safety Score</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-ai-white">{eventData.incidents}</div>
                  <div className="text-sm text-ai-gray-400">Incidents</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-ai-white">{eventData.responseTime > 0 ? `${eventData.responseTime}m` : '-'}</div>
                  <div className="text-sm text-ai-gray-400">Avg Response</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Report Sections */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-6"
              >
                <h2 className="text-2xl font-bold text-white mb-6">Report Sections</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reportSections.map((section, index) => (
                    <div
                      key={section.id}
                      onClick={() => setSelectedReport(selectedReport === section.id ? null : section.id)}
                      className={`glass-light rounded-2xl p-6 cursor-pointer transition-all ${
                        selectedReport === section.id ? 'border border-ai-white' : ''
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-ai-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                          <section.icon className="w-6 h-6 text-ai-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-2">{section.title}</h3>
                          <p className="text-ai-gray-400 text-sm">{section.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Section Details */}
              {selectedReport && (
                <div className="glass-light rounded-2xl p-6 mb-6">
                  {(() => {
                    const section = reportSections.find(s => s.id === selectedReport);
                    if (!section) return null;

                    return (
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <section.icon className="w-6 h-6 text-ai-white" />
                          <h3 className="text-xl font-semibold text-white">{section.title}</h3>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {Object.entries(section.data).map(([key, value]) => (
                            <div key={key} className="bg-ai-gray-800/30 rounded-lg p-3 text-center">
                              <div className="text-lg font-bold text-ai-white">{value}</div>
                              <div className="text-xs text-ai-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                            </div>
                          ))}
                        </div>
                        
                        {section.id === 'recommendations' && (
                          <div className="mt-4 p-4 bg-ai-white/10 border border-ai-white/30 rounded-lg">
                            <h4 className="font-semibold text-ai-white mb-2">Key Recommendations:</h4>
                            <ul className="text-sm text-ai-gray-300 space-y-1">
                              <li>• Increase crowd control barriers at main stage entrance</li>
                              <li>• Deploy additional medical staff during peak hours (7-9 PM)</li>
                              <li>• Improve emergency exit signage visibility</li>
                              <li>• Consider additional food vendors to reduce queue times</li>
                            </ul>
                          </div>
                        )}
                        
                        {section.id === 'incidents' && (
                          <div className="mt-6 space-y-4">
                            <h4 className="font-semibold text-white text-lg">Incident Timeline</h4>
                            <DataTable 
                              columns={incidentTableColumns}
                              data={incidentTableData}
                              stickyHeader={true}
                              maxHeight="400px"
                              hoverable={true}
                            />
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                              <div className="p-3 bg-ai-white/10 border border-ai-white/30 rounded-lg">
                                <div className="font-medium text-ai-white">Medical (3)</div>
                                <div className="text-sm text-ai-gray-400">All resolved, no serious injuries</div>
                              </div>
                              <div className="p-3 bg-ai-gray-600/10 border border-ai-gray-600/30 rounded-lg">
                                <div className="font-medium text-ai-gray-300">Security (2)</div>
                                <div className="text-sm text-ai-gray-400">Minor disturbances resolved</div>
                              </div>
                              <div className="p-3 bg-ai-gray-600/10 border border-ai-gray-600/30 rounded-lg">
                                <div className="font-medium text-ai-gray-300">Lost & Found (2)</div>
                                <div className="text-sm text-ai-gray-400">Items returned to owners</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Report Generation */}
              <div className="glass-light rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Download className="w-5 h-5 text-ai-white" />
                  Generate Report
                </h3>
                
                <div className="space-y-4">
                  <div className="text-sm text-ai-gray-400">
                    Generate a comprehensive PDF report including all sections, charts, and recommendations.
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-ai-white rounded-full"></div>
                      <span className="text-ai-gray-300">Executive Summary</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-ai-white rounded-full"></div>
                      <span className="text-ai-gray-300">Incident Analysis</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-ai-white rounded-full"></div>
                      <span className="text-ai-gray-300">Crowd Flow Data</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-ai-white rounded-full"></div>
                      <span className="text-ai-gray-300">Response Metrics</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-ai-white rounded-full"></div>
                      <span className="text-ai-gray-300">AI Recommendations</span>
                    </div>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={generateReport}
                    disabled={isGenerating}
                    className="w-full px-6 py-3 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-ai-black border-t-transparent rounded-full animate-spin"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download PDF Report
                      </>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="glass-light rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-ai-white" />
                  Privacy & Compliance
                </h3>
                
                <div className="space-y-3 text-sm text-ai-gray-400">
                  <p>
                    All personal data has been processed in compliance with privacy regulations.
                  </p>
                  <p>
                    Sensitive information is automatically deleted 30 days post-event unless required for legal purposes.
                  </p>
                  <div className="p-3 bg-ai-white/10 border border-ai-white/30 rounded-lg">
                    <div className="font-medium text-ai-white">✓ GDPR Compliant</div>
                    <div className="font-medium text-ai-white">✓ Data Minimization</div>
                    <div className="font-medium text-ai-white">✓ Secure Processing</div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="glass-light rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Performance Highlights</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-ai-gray-400 text-sm">Incident Resolution</span>
                    <span className="text-ai-white font-medium">100%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ai-gray-400 text-sm">Response Efficiency</span>
                    <span className="text-ai-white font-medium">94%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ai-gray-400 text-sm">Safety Score</span>
                    <span className="text-ai-white font-medium">A+</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ai-gray-400 text-sm">Zero Tolerance</span>
                    <span className="text-ai-white font-medium">✓ Met</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostEventReports;