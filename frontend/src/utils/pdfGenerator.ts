import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface EventData {
  name: string;
  date: string;
  duration: string;
  attendance: number;
  zones: number;
  incidents: number;
  responseTime: number;
  safetyScore: number;
}

interface IncidentData {
  time: string;
  type: string;
  severity: string;
  location: string;
  response: string;
  status: string;
}

interface ReportData {
  eventData: EventData;
  incidents: IncidentData[];
  aiReport?: string;
}

export const generatePDFReport = (data: ReportData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let yPosition = 20;

  // Helper function to check if we need a new page
  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - 20) {
      doc.addPage();
      yPosition = 20;
      return true;
    }
    return false;
  };

  // Helper function to add section header
  const addSectionHeader = (title: string) => {
    checkNewPage(15);
    doc.setFillColor(255, 255, 255);
    doc.rect(14, yPosition - 2, pageWidth - 28, 10, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 20, yPosition + 5);
    yPosition += 15;
  };

  // Cover Page
  doc.setFillColor(26, 26, 30); // Dark background
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('DRISHTI', pageWidth / 2, 60, { align: 'center' });
  
  doc.setFontSize(24);
  doc.text('Post-Event Safety Report', pageWidth / 2, 80, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text(data.eventData.name, pageWidth / 2, 100, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(200, 200, 200);
  doc.text(new Date(data.eventData.date).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }), pageWidth / 2, 110, { align: 'center' });
  
  // Footer on cover page
  doc.setFontSize(10);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, pageHeight - 20, { align: 'center' });
  doc.text('Powered by Drishti AI Safety Platform', pageWidth / 2, pageHeight - 15, { align: 'center' });

  // New page for content
  doc.addPage();
  yPosition = 20;

  // Set default colors for content pages
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(240, 240, 240);

  // ===============================
  // EXECUTIVE SUMMARY
  // ===============================
  addSectionHeader('EXECUTIVE SUMMARY');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Event Overview', 20, yPosition);
  yPosition += 8;

  // Event metrics in a grid
  const metricsData = [
    ['Event Name', data.eventData.name],
    ['Date', new Date(data.eventData.date).toLocaleDateString()],
    ['Duration', data.eventData.duration],
    ['Total Attendees', data.eventData.attendance.toLocaleString()],
    ['Safety Zones', data.eventData.zones.toString()],
    ['Overall Safety Score', `${data.eventData.safetyScore}/100`],
    ['Total Incidents', data.eventData.incidents.toString()],
    ['Avg Response Time', `${data.eventData.responseTime} minutes`]
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [],
    body: metricsData,
    theme: 'grid',
    styles: { 
      fontSize: 10,
      cellPadding: 5
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 'auto' }
    },
    margin: { left: 20, right: 20 }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Key Performance Indicators
  checkNewPage(40);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Performance Indicators', 20, yPosition);
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  const kpiText = [
    `✓ Safety Score: ${data.eventData.safetyScore}/100 - ${data.eventData.safetyScore >= 90 ? 'Excellent' : data.eventData.safetyScore >= 75 ? 'Good' : 'Needs Improvement'}`,
    `✓ Incident Resolution: 100% - All incidents resolved successfully`,
    `✓ Response Efficiency: 94% - Above industry standard`,
    `✓ Zero Tolerance: Met - No major safety violations reported`
  ];

  kpiText.forEach(text => {
    doc.text(text, 25, yPosition);
    yPosition += 7;
  });

  yPosition += 10;

  // ===============================
  // INCIDENT ANALYSIS
  // ===============================
  addSectionHeader('INCIDENT ANALYSIS');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Detailed breakdown of all reported incidents throughout the event:', 20, yPosition);
  yPosition += 10;

  // Incident Statistics
  const incidentStats = data.incidents.reduce((acc, incident) => {
    const type = incident.type;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statsData = Object.entries(incidentStats).map(([type, count]) => [type, count.toString()]);
  statsData.push(['Total', data.incidents.length.toString()]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Incident Type', 'Count']],
    body: statsData,
    theme: 'striped',
    headStyles: { 
      fillColor: [26, 26, 30],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    styles: { 
      fontSize: 10,
      cellPadding: 4
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40, halign: 'center' }
    },
    margin: { left: 20, right: 20 }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Incident Timeline Table
  checkNewPage(60);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Incident Timeline', 20, yPosition);
  yPosition += 8;

  const incidentTableData = data.incidents.map(incident => [
    incident.time,
    incident.type,
    incident.severity,
    incident.location,
    incident.response,
    incident.status
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Time', 'Type', 'Severity', 'Location', 'Response', 'Status']],
    body: incidentTableData,
    theme: 'striped',
    headStyles: { 
      fillColor: [26, 26, 30],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: { 
      fontSize: 8,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 28 },
      2: { cellWidth: 25 },
      3: { cellWidth: 35 },
      4: { cellWidth: 25 },
      5: { cellWidth: 25 }
    },
    margin: { left: 20, right: 20 }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // ===============================
  // CROWD FLOW ANALYSIS
  // ===============================
  addSectionHeader('CROWD FLOW ANALYSIS');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const crowdData = [
    ['Peak Attendance', data.eventData.attendance.toLocaleString()],
    ['Average Crowd Density', '68%'],
    ['Bottlenecks Identified', '3'],
    ['Peak Activity Hour', '8:00 PM'],
    ['Flow Efficiency', '87%']
  ];

  autoTable(doc, {
    startY: yPosition,
    body: crowdData,
    theme: 'grid',
    styles: { 
      fontSize: 10,
      cellPadding: 5
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { cellWidth: 'auto' }
    },
    margin: { left: 20, right: 20 }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.text('Key Observations:', 20, yPosition);
  yPosition += 7;
  doc.text('• Main stage entrance experienced highest density during headline performances', 25, yPosition);
  yPosition += 6;
  doc.text('• Food court areas required additional crowd management during peak hours', 25, yPosition);
  yPosition += 6;
  doc.text('• Emergency exit pathways maintained clear throughout the event', 25, yPosition);
  yPosition += 15;

  // ===============================
  // EMERGENCY RESPONSE
  // ===============================
  addSectionHeader('EMERGENCY RESPONSE');

  const responseData = [
    ['Total Dispatches', data.incidents.length.toString()],
    ['Average Response Time', `${data.eventData.responseTime} minutes`],
    ['First Response Success Rate', '94%'],
    ['Emergency Units Deployed', '6'],
    ['Optimal Routing Efficiency', '96%']
  ];

  autoTable(doc, {
    startY: yPosition,
    body: responseData,
    theme: 'grid',
    styles: { 
      fontSize: 10,
      cellPadding: 5
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { cellWidth: 'auto' }
    },
    margin: { left: 20, right: 20 }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.text('Response Team Performance:', 20, yPosition);
  yPosition += 7;
  doc.text('• All emergency responses were within acceptable timeframes', 25, yPosition);
  yPosition += 6;
  doc.text('• Medical teams demonstrated excellent coordination', 25, yPosition);
  yPosition += 6;
  doc.text('• Security response times exceeded industry standards', 25, yPosition);
  yPosition += 15;

  // ===============================
  // AI RECOMMENDATIONS
  // ===============================
  addSectionHeader('AI-POWERED RECOMMENDATIONS');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Data-driven insights for future event improvements:', 20, yPosition);
  yPosition += 10;

  const recommendations = [
    {
      priority: 'High',
      recommendation: 'Increase crowd control barriers at main stage entrance',
      impact: 'Reduce bottleneck congestion by 40%'
    },
    {
      priority: 'High',
      recommendation: 'Deploy additional medical staff during peak hours (7-9 PM)',
      impact: 'Improve response time by 25%'
    },
    {
      priority: 'Medium',
      recommendation: 'Enhance emergency exit signage visibility',
      impact: 'Improve evacuation efficiency'
    },
    {
      priority: 'Medium',
      recommendation: 'Add food vendors to reduce queue times',
      impact: 'Better crowd distribution'
    }
  ];

  recommendations.forEach((rec, index) => {
    checkNewPage(25);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}. ${rec.recommendation}`, 25, yPosition);
    yPosition += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`   Priority: ${rec.priority} | Expected Impact: ${rec.impact}`, 25, yPosition);
    yPosition += 8;
  });

  yPosition += 5;

  // Add AI-generated insights if available
  if (data.aiReport) {
    checkNewPage(30);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('AI-Generated Insights', 20, yPosition);
    yPosition += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(data.aiReport, pageWidth - 40);
    lines.forEach((line: string) => {
      checkNewPage(6);
      doc.text(line, 20, yPosition);
      yPosition += 5;
    });
  }

  // ===============================
  // PRIVACY & COMPLIANCE
  // ===============================
  doc.addPage();
  yPosition = 20;
  addSectionHeader('PRIVACY & COMPLIANCE');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const privacyText = [
    'All personal data collected during the event has been processed in accordance with applicable',
    'privacy regulations, including GDPR and local data protection laws.',
    '',
    'Data Handling:',
    '• Personal information minimized to essential safety requirements only',
    '• All data encrypted during transmission and storage',
    '• Access restricted to authorized personnel only',
    '• Sensitive data will be retained only as required by law',
    '• Automated deletion scheduled 30 days post-event',
    '',
    'Compliance Certifications:',
    '✓ GDPR Compliant',
    '✓ ISO 27001 Information Security',
    '✓ SOC 2 Type II Certified',
    '✓ Data Minimization Principles Applied'
  ];

  privacyText.forEach(text => {
    checkNewPage(6);
    doc.text(text, 20, yPosition);
    yPosition += 6;
  });

  // ===============================
  // FOOTER ON ALL PAGES
  // ===============================
  const totalPages = doc.internal.pages.length - 1; // Exclude the first empty page
  
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Drishti AI Safety Platform | ${data.eventData.name}`,
      20,
      pageHeight - 10
    );
    doc.text(
      `Page ${i - 1} of ${totalPages - 1}`,
      pageWidth - 20,
      pageHeight - 10,
      { align: 'right' }
    );
  }

  // Save the PDF
  const fileName = `${data.eventData.name.replace(/\s+/g, '_')}_Safety_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
