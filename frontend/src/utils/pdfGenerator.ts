import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface EventData {
  name: string;
  date: string;
  /** 'not recorded' when the event has no end time stored. */
  duration: string;
  attendance: number;
  zones: number;
  incidents: number;
  /** Mean minutes over incidents that were genuinely resolved. Null when none were. */
  responseTime: number | null;
  /** Percentage of incidents resolved. Null when there were no incidents. */
  resolutionRate: number | null;
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

  // A report handed to an authority states what was measured, or says the
  // figure was not recorded. It never fills a gap with a plausible number.
  const NOT_RECORDED = 'Not recorded';
  const asPercent = (value: number | null) =>
    value === null ? NOT_RECORDED : `${value}%`;
  const asMinutes = (value: number | null) =>
    value === null ? NOT_RECORDED : `${value.toFixed(1)} minutes`;
  const resolvedCount = data.incidents.filter(i => i.status === 'resolved').length;

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
    ['Total Incidents', data.eventData.incidents.toString()],
    ['Incident Resolution Rate', asPercent(data.eventData.resolutionRate)],
    ['Avg Response Time', asMinutes(data.eventData.responseTime)]
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
  const kpiText = data.eventData.incidents === 0
    ? ['• No incidents were recorded against this event.']
    : [
        `• Incidents recorded: ${data.eventData.incidents}`,
        `• Incidents resolved: ${resolvedCount} (${asPercent(data.eventData.resolutionRate)})`,
        `• Mean response time, over resolved incidents: ${asMinutes(data.eventData.responseTime)}`
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
    ['Registered Attendees', data.eventData.attendance.toLocaleString()],
    ['Safety Zones', data.eventData.zones.toString()]
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
  // Density, bottleneck and flow figures are not retained once an event ends,
  // so this section says so rather than printing representative-looking ones.
  doc.splitTextToSize(
    'Crowd density, bottleneck and flow-efficiency analytics are not retained after an event ' +
    'closes. No figures for them are stated in this report.',
    pageWidth - 45
  ).forEach((line: string) => {
    checkNewPage(6);
    doc.text(line, 25, yPosition);
    yPosition += 6;
  });
  yPosition += 9;

  // ===============================
  // EMERGENCY RESPONSE
  // ===============================
  addSectionHeader('EMERGENCY RESPONSE');

  const responseData = [
    ['Incidents Recorded', data.eventData.incidents.toString()],
    ['Incidents Resolved', resolvedCount.toString()],
    ['Average Response Time', asMinutes(data.eventData.responseTime)]
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
  doc.splitTextToSize(
    'The average above covers only incidents that were both resolved and carry a recorded ' +
    'response time. Unit deployment and routing efficiency are not tracked per incident.',
    pageWidth - 45
  ).forEach((line: string) => {
    checkNewPage(6);
    doc.text(line, 25, yPosition);
    yPosition += 6;
  });
  yPosition += 9;

  // ===============================
  // AI RECOMMENDATIONS
  // ===============================
  addSectionHeader('AI-POWERED RECOMMENDATIONS');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // The recommendations here used to be a fixed list - barriers at the main
  // stage, more medical staff at 7-9 PM - printed for every event whether or
  // not any of it applied. The only recommendations this platform can honestly
  // attribute to an event are the ones the model wrote about that event.
  if (data.aiReport) {
    doc.text("Generated from this event's recorded incidents and zones:", 20, yPosition);
    yPosition += 10;

    doc.setFontSize(9);
    const lines = doc.splitTextToSize(data.aiReport, pageWidth - 40);
    lines.forEach((line: string) => {
      checkNewPage(6);
      doc.text(line, 20, yPosition);
      yPosition += 5;
    });
  } else {
    doc.splitTextToSize(
      'Automated analysis was unavailable when this report was generated, so it carries no ' +
      'recommendations. Re-generating the report once analysis is available will include them.',
      pageWidth - 40
    ).forEach((line: string) => {
      checkNewPage(6);
      doc.text(line, 20, yPosition);
      yPosition += 6;
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
  // This section previously certified the deployment as GDPR compliant and ISO
  // 27001 / SOC 2 Type II certified. A report cannot award its own operator an
  // audit certification, so it now states the platform's data-handling design
  // and leaves the compliance position to whoever runs the deployment.
  const privacyText = [
    'This report is generated from incident and zone records held by the Drishti platform.',
    'Responsibility for the lawful basis, retention policy and regulatory position of this',
    'deployment rests with the operating authority, not with this document.',
    '',
    'Data Handling:',
    '• Personal information minimized to essential safety requirements only',
    '• Access restricted to authenticated, authorized personnel',
    "• Incident records retained under the operator's configured retention policy"
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

// ============================================================================
// Vehicle trail export
//
// Added alongside generatePDFReport rather than routed through it. That function
// renders a post-event safety report - its cover page says so, and its data
// shape requires an attendance figure and a safety score. Forcing a vehicle
// trail through it would mean inventing both, so it shares this module's jsPDF
// setup and visual language instead of its report structure.
// ============================================================================

export interface TrailSightingRow {
  index: number;
  timestamp: string;
  cameraId: string;
  cameraName: string;
  location: string;
  plateNumber: string | null;
  color: string | null;
  vehicleType: string | null;
  /** How this sighting was linked to the one before it. Null for the first. */
  linkToPrevious: { certainty: 'CERTAIN' | 'PROBABLE'; score: number | null; note: string } | null;
}

export interface TrailReport {
  plateQuery: string;
  normalisedPlate: string;
  generatedAt: Date;
  sightings: TrailSightingRow[];
  /** Cameras seen in the trail that have never been surveyed. */
  unmappableCameras: string[];
  samplingNote: string;
  trailNote: string;
}

export const generateVehicleTrailPDF = (report: TrailReport) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  doc.setFillColor(26, 26, 30);
  doc.rect(0, 0, pageWidth, 45, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('DRISHTI', 14, 20);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text('Vehicle trail', 14, 30);
  doc.setFontSize(9);
  doc.text(`Generated ${report.generatedAt.toLocaleString()}`, 14, 38);

  doc.setTextColor(0, 0, 0);
  let y = 58;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Plate searched: ${report.plateQuery}`, 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Matched as: ${report.normalisedPlate}`, 14, y);
  y += 6;
  doc.text(`${report.sightings.length} sighting(s) across the estate`, 14, y);
  y += 10;

  // The two caveats travel with the document. A trail printed and handed to
  // someone else must carry what it is and is not, not rely on the reader having
  // seen the screen it came from.
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  const caveats = doc.splitTextToSize(`${report.trailNote} ${report.samplingNote}`, pageWidth - 28);
  doc.text(caveats, 14, y);
  y += caveats.length * 4 + 6;

  if (report.unmappableCameras.length > 0) {
    doc.setTextColor(150, 60, 0);
    const warning = doc.splitTextToSize(
      `Not shown on any map: ${report.unmappableCameras.join(', ')} — these cameras have no ` +
        'surveyed position, so their sightings are in the table but absent from the route.',
      pageWidth - 28
    );
    doc.text(warning, 14, y);
    y += warning.length * 4 + 4;
  }

  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Time', 'Camera', 'Plate read', 'Colour', 'Link to previous']],
    body: report.sightings.map((sighting) => [
      String(sighting.index),
      new Date(sighting.timestamp).toLocaleString(),
      `${sighting.cameraId}\n${sighting.cameraName}`,
      sighting.plateNumber ?? '—',
      sighting.color ?? '—',
      sighting.linkToPrevious === null
        ? 'first sighting'
        : sighting.linkToPrevious.certainty === 'CERTAIN'
          ? 'same plate — certain'
          : `probable (${Math.round((sighting.linkToPrevious.score ?? 0) * 100)}%)`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [26, 26, 26], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 10 }, 5: { cellWidth: 38 } },
  });

  // The reasoning behind every inferred link, spelled out. A "probable" row in
  // the table above is not evidence on its own; this is what lets a reader
  // check it.
  const inferred = report.sightings.filter((s) => s.linkToPrevious?.certainty === 'PROBABLE');
  if (inferred.length > 0) {
    let afterTable = (doc as any).lastAutoTable?.finalY ?? y;
    afterTable += 12;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('How the probable links were reached', 14, afterTable);
    afterTable += 7;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    for (const sighting of inferred) {
      if (afterTable > doc.internal.pageSize.height - 25) {
        doc.addPage();
        afterTable = 20;
      }
      const lines = doc.splitTextToSize(
        `#${sighting.index}: ${sighting.linkToPrevious!.note}`,
        pageWidth - 28
      );
      doc.text(lines, 14, afterTable);
      afterTable += lines.length * 4 + 3;
    }
  }

  doc.save(`drishti-trail-${report.normalisedPlate}.pdf`);
};
