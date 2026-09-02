import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Shield, Users, AlertTriangle, Clock, Calendar, BarChart3 } from 'lucide-react';
import { useEvent } from '../contexts/EventContext';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import DataTable from '../components/DataTable';
import { generateEventReport } from '../services/ai.service';
import { generatePDFReport } from '../utils/pdfGenerator';
import { incidentService } from '../services/incident.service';
import { useToast } from '../components/Toast';

const PostEventReports: React.FC = () => {
  const { event } = useEvent();
  const toast = useToast();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Check if event is completed (date has passed)
  const isEventCompleted = event && new Date(event.date) < new Date();

  // Incidents actually recorded against this event. A report handed to an
  // authority is the last place a number should be invented, so everything
  // below is computed from these rows or reported as unavailable.
  const [incidents, setIncidents] = useState<any[]>([]);
  const [incidentsLoaded, setIncidentsLoaded] = useState(false);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);

  useEffect(() => {
    if (!event?.id) {
      setIncidents([]);
      setIncidentsLoaded(true);
      return;
    }

    let cancelled = false;
    setIncidentsLoaded(false);

    incidentService
      .getIncidentsByEvent(event.id)
      .then((rows: any[]) => {
        if (cancelled) return;
        setIncidents(rows);
        setIncidentsError(null);
      })
      .catch((error: any) => {
        // The report says it could not read them, rather than reporting zero
        // incidents - which would be a very different and much worse claim.
        if (cancelled) return;
        setIncidents([]);
        setIncidentsError(error?.message ?? 'Incidents could not be read');
      })
      .finally(() => {
        if (!cancelled) setIncidentsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [event?.id]);

  const metrics = useMemo(() => {
    const resolved = incidents.filter((i) => i.status === 'resolved');
    const withTimes = resolved.filter((i) => typeof i.responseTime === 'number');

    return {
      total: incidents.length,
      resolved: resolved.length,
      // Null rather than 0 when there is nothing to divide by: a resolution
      // rate of 0% and "no incidents to resolve" are opposite statements.
      resolutionRate: incidents.length > 0
        ? Math.round((resolved.length / incidents.length) * 100)
        : null,
      meanResponseMinutes: withTimes.length > 0
        ? withTimes.reduce((sum, i) => sum + i.responseTime, 0) / withTimes.length / 60
        : null,
    };
  }, [incidents]);

  const eventData = event ? {
    name: event.name,
    date: event.date,
    // The schema records a start date and time but no end, so a duration would
    // have to be assumed. It was previously the string '8 hours' on every
    // report regardless of the event.
    duration: 'Not recorded',
    attendance: event.registeredUsers?.length || 0,
    zones: event.zones.length,
    incidents: metrics.total,
    responseTime: metrics.meanResponseMinutes,
    resolutionRate: metrics.resolutionRate,
  } : null;

  // One shape, rendered by both the on-screen table and the PDF, so the
  // document an authority receives says exactly what the operator saw.
  const incidentTableData = incidents.map((incident: any) => ({
    time: new Date(incident.timestamp).toLocaleTimeString(),
    type: incident.type ?? '—',
    severity: incident.severity ?? '—',
    location: incident.location ?? '—',
    response: typeof incident.responseTime === 'number'
      ? `${Math.round(incident.responseTime / 60)} min`
      : '—',
    status: incident.status ?? '—',
  }));

  const incidentTableColumns = [
    { key: 'time', label: 'Time', width: 'w-24' },
    { key: 'type', label: 'Type', width: 'w-32' },
    { key: 'severity', label: 'Severity', width: 'w-28', align: 'center' as const },
    { key: 'location', label: 'Location', width: 'w-36' },
    { key: 'response', label: 'Response Time', width: 'w-32', align: 'center' as const },
    { key: 'status', label: 'Status', width: 'w-28', align: 'center' as const }
  ];

  const reportSections = [
    {
      id: 'executive',
      title: 'Executive Summary',
      description: 'High-level overview of safety performance and key metrics',
      icon: BarChart3,
      data: {
        // Resolved is counted, not assumed equal to the total as it was before.
        incidents: eventData?.incidents ?? 0,
        resolved: metrics.resolved,
        resolutionRate: metrics.resolutionRate === null ? 'no incidents' : `${metrics.resolutionRate}%`,
        avgResponse: metrics.meanResponseMinutes === null
          ? 'no resolved incidents'
          : `${metrics.meanResponseMinutes.toFixed(1)} minutes`
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

  const canGenerate = Boolean(eventData) && incidentsLoaded && !incidentsError;

  const generateReport = async () => {
    if (!eventData) {
      toast.error('No event selected', 'Choose an event before generating a report.');
      return;
    }

    // An unread incident list arrives here as an empty one, and the report
    // would go out stating that the event had no incidents.
    if (incidentsError) {
      toast.error('Incidents could not be read', `${incidentsError}. A report now would understate what happened.`);
      return;
    }

    if (!incidentsLoaded) {
      toast.info('Still loading incidents', 'Try again in a moment.');
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
        resolutionRate: eventData.resolutionRate,
        responseTime: eventData.responseTime,
        zones: (event?.zones ?? []).map(z => z.name)
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
      toast.error('The report was not generated', 'Nothing was downloaded. Try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-ai-black text-ai-white overflow-hidden">
      <MeshGradient />
      <Spotlight />
      <Navbar />
      
      <div className="relative z-10 pt-20 sm:pt-24 pb-8 sm:pb-12 safe-bottom">
        <div className="page-container">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8 sm:mb-12"
          >
            <FileText className="w-10 h-10 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-ai-white" />
            <h1 className="text-heading text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 text-ai-white">
              Post-Event Reports
            </h1>
            <p className="text-ai-gray-400 text-sm sm:text-base lg:text-lg max-w-2xl mx-auto">
              Comprehensive safety analysis and insights for continuous improvement
            </p>
          </motion.div>

          {/* Event Summary */}
          {!eventData ? (
            <div className="glass-light rounded-2xl p-6 sm:p-12 mb-6 sm:mb-8 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-ai-gray-700" />
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">No Event Data Available</h3>
              <p className="text-ai-gray-400">Set up an event first to generate post-event reports</p>
            </div>
          ) : !isEventCompleted ? (
            <div className="glass-light rounded-2xl p-6 sm:p-12 mb-6 sm:mb-8 text-center">
              <Clock className="w-16 h-16 mx-auto mb-4 text-ai-gray-700" />
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Event Not Yet Completed</h3>
              <p className="text-ai-gray-400">Reports will be available after the event date: {new Date(event!.date).toLocaleDateString()}</p>
            </div>
          ) : (
            <>
          <div className="glass-light rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <Calendar className="w-9 h-9 sm:w-12 sm:h-12 text-ai-white shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-semibold text-white break-anywhere">{eventData.name}</h3>
                  <p className="text-sm sm:text-base text-ai-gray-400">{new Date(eventData.date).toLocaleDateString()} • {eventData.duration}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-ai-white">{eventData.attendance.toLocaleString()}</div>
                  <div className="text-xs sm:text-sm text-ai-gray-400">Attendees</div>
                </div>
                <div>
                  {/* A resolution rate is defined and computable. The "safety
                      score" that stood here was a constant zero labelled as a
                      measurement. */}
                  <div className="text-xl sm:text-2xl font-bold text-ai-white">
                    {eventData.resolutionRate === null ? '—' : `${eventData.resolutionRate}%`}
                  </div>
                  <div className="text-xs sm:text-sm text-ai-gray-400">Incidents Resolved</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-ai-white">{eventData.incidents}</div>
                  <div className="text-xs sm:text-sm text-ai-gray-400">Incidents</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-ai-white">
                    {eventData.responseTime === null ? '—' : `${eventData.responseTime.toFixed(1)}m`}
                  </div>
                  <div className="text-xs sm:text-sm text-ai-gray-400">Avg Response</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Report Sections */}
            <div className="lg:col-span-2 min-w-0">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-6"
              >
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Report Sections</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {reportSections.map((section) => (
                    <div
                      key={section.id}
                      onClick={() => setSelectedReport(selectedReport === section.id ? null : section.id)}
                      className={`glass-light rounded-2xl p-4 sm:p-6 cursor-pointer transition-all ${
                        selectedReport === section.id ? 'border border-ai-white' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-ai-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                          <section.icon className="w-5 h-5 sm:w-6 sm:h-6 text-ai-white" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-semibold text-white mb-2">{section.title}</h3>
                          <p className="text-ai-gray-400 text-sm">{section.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Section Details */}
              {selectedReport && (
                <div className="glass-light rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
                  {(() => {
                    const section = reportSections.find(s => s.id === selectedReport);
                    if (!section) return null;

                    return (
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <section.icon className="w-6 h-6 text-ai-white" />
                          <h3 className="text-lg sm:text-xl font-semibold text-white">{section.title}</h3>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
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
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                              <div className="p-3 bg-ai-white/10 border border-ai-white/30 rounded-lg">
                                <div className="font-medium text-ai-white">Medical (3)</div>
                                <div className="text-xs sm:text-sm text-ai-gray-400">All resolved, no serious injuries</div>
                              </div>
                              <div className="p-3 bg-ai-gray-600/10 border border-ai-gray-600/30 rounded-lg">
                                <div className="font-medium text-ai-gray-300">Security (2)</div>
                                <div className="text-xs sm:text-sm text-ai-gray-400">Minor disturbances resolved</div>
                              </div>
                              <div className="p-3 bg-ai-gray-600/10 border border-ai-gray-600/30 rounded-lg">
                                <div className="font-medium text-ai-gray-300">Lost & Found (2)</div>
                                <div className="text-xs sm:text-sm text-ai-gray-400">Items returned to owners</div>
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
              <div className="glass-light rounded-2xl p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Download className="w-5 h-5 text-ai-white" />
                  Generate Report
                </h3>
                
                <div className="space-y-4">
                  <div className="text-xs sm:text-sm text-ai-gray-400">
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
                    disabled={isGenerating || !canGenerate}
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

                  {!canGenerate && !isGenerating && (
                    <p className="mt-3 text-xs text-ai-gray-400 text-center">
                      {incidentsError
                        ? 'Incidents could not be read, so a report would understate what happened at this event.'
                        : !eventData
                          ? 'Select an event to generate a report.'
                          : 'Loading incident records…'}
                    </p>
                  )}
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="glass-light rounded-2xl p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-ai-white" />
                  Privacy & Compliance
                </h3>
                
                <div className="space-y-3 text-sm text-ai-gray-400">
                  {/* This panel used to certify the deployment as GDPR
                      compliant with a 30-day deletion schedule. Neither is
                      something the page can know: retention is whatever the
                      operator configured, and compliance is theirs to assert. */}
                  <p>
                    Reports are built from the incident and zone records held for this event.
                  </p>
                  <p>
                    Retention, lawful basis and regulatory position are set by the operating
                    authority for this deployment.
                  </p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="glass-light rounded-2xl p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Performance Highlights</h3>
                
                <div className="space-y-3">
                  {/* Every figure here was a constant: 100%, 94%, an A+ grade and
                      a "zero tolerance met" tick, printed on every report for
                      every event whatever had happened at it. They are now
                      counted from the incident rows, and say so when there are
                      none to count. */}
                  <div className="flex items-center justify-between">
                    <span className="text-ai-gray-400 text-sm">Incidents recorded</span>
                    <span className="text-ai-white font-medium">
                      {incidentsError ? '—' : metrics.total}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ai-gray-400 text-sm">Resolved</span>
                    <span className="text-ai-white font-medium">
                      {incidentsError
                        ? '—'
                        : metrics.resolutionRate === null
                          ? 'none to resolve'
                          : `${metrics.resolved} of ${metrics.total} (${metrics.resolutionRate}%)`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ai-gray-400 text-sm">Mean response</span>
                    <span className="text-ai-white font-medium">
                      {metrics.meanResponseMinutes === null
                        ? '—'
                        : `${metrics.meanResponseMinutes.toFixed(1)} min`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ai-gray-400 text-sm">Source</span>
                    <span className="text-ai-white font-medium">
                      {incidentsError
                        ? 'unavailable'
                        : incidentsLoaded
                          ? 'incident records'
                          : 'loading…'}
                    </span>
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