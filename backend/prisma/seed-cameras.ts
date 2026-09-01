/**
 * Seeds the standalone camera registry (Model 1) with the demonstration estate:
 * five departments, sixteen sites and fifty-six cameras across Gandhinagar and
 * Ahmedabad.
 *
 * WHAT IS AND IS NOT REAL HERE
 *
 * The coordinates are real: every site is an actual place in Gujarat, and each
 * camera sits at a surveyed point within it. The vendor, model, resolution,
 * frame rate and protocol are a declared hardware inventory - the same thing a
 * department would hand over as a spreadsheet - not measurements.
 *
 * Nothing in this file writes an observed value. Every camera is seeded with
 * status UNKNOWN and lastSeenAt null, because no probe has reached it yet; the
 * health checker is the only thing allowed to move a camera to ONLINE. Three
 * cameras are deliberately seeded without coordinates, because a real estate
 * always has a few units that are registered but not yet surveyed, and the map
 * has to show them honestly rather than dropping a pin in the Gulf of Guinea.
 *
 * Department contact names and phone numbers are left null. Inventing a phone
 * number for a real police department would be worse than an empty field.
 *
 * Run with:  npm run seed:cameras   (from backend/)
 * Safe to re-run: matches on cameraId and updates in place.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Where the demo streams are published. Override in .env so nothing about the
// stream host is baked into the build.
const RTSP_BASE = (process.env.MEDIAMTX_RTSP_BASE || 'rtsp://localhost:8554').replace(/\/+$/, '');

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

const DEPARTMENTS = [
  { code: 'GNR-CITY', name: 'Gandhinagar City Police' },
  { code: 'AMD-CITY', name: 'Ahmedabad City Police' },
  { code: 'GUJ-TRAF', name: 'Gujarat Traffic Police (Ahmedabad Division)' },
  { code: 'AMD-TRANSIT', name: 'Transit and Terminals Security' },
  { code: 'GUJ-HERITAGE', name: 'Heritage and Public Spaces Security' },
] as const;

type DepartmentCode = (typeof DEPARTMENTS)[number]['code'];

// ---------------------------------------------------------------------------
// Sites - real locations, real coordinates
// ---------------------------------------------------------------------------

interface SiteSeed {
  code: string;
  name: string;
  address: string;
  department: DepartmentCode;
  latitude: number;
  longitude: number;
}

const SITES: SiteSeed[] = [
  { code: 'GNR-SEC17', name: 'Sector 17 Civic Centre', address: 'Sector 17, Gandhinagar', department: 'GNR-CITY', latitude: 23.2290, longitude: 72.6500 },
  { code: 'GNR-MMANDIR', name: 'Mahatma Mandir Convention Centre', address: 'Sector 13, Gandhinagar', department: 'GNR-CITY', latitude: 23.2320, longitude: 72.6469 },
  { code: 'GNR-AKSHAR', name: 'Akshardham Temple Complex', address: 'J Road, Sector 20, Gandhinagar', department: 'GUJ-HERITAGE', latitude: 23.2295, longitude: 72.6717 },
  { code: 'GNR-RAIL', name: 'Gandhinagar Capital Railway Station', address: 'Sector 14, Gandhinagar', department: 'AMD-TRANSIT', latitude: 23.2229, longitude: 72.6360 },
  { code: 'GNR-INFOCITY', name: 'Infocity and GIFT City Approach', address: 'Infocity, Gandhinagar', department: 'GNR-CITY', latitude: 23.1600, longitude: 72.6840 },
  { code: 'GNR-INDRODA', name: 'Indroda Nature Park', address: 'Sector 7, Gandhinagar', department: 'GUJ-HERITAGE', latitude: 23.1993, longitude: 72.6543 },

  { code: 'AMD-KALUPUR', name: 'Ahmedabad Junction (Kalupur)', address: 'Kalupur, Ahmedabad', department: 'AMD-TRANSIT', latitude: 23.0272, longitude: 72.6019 },
  { code: 'AMD-AIRPORT', name: 'Sardar Vallabhbhai Patel International Airport', address: 'Hansol, Ahmedabad', department: 'AMD-TRANSIT', latitude: 23.0725, longitude: 72.6266 },
  { code: 'AMD-KANKARIA', name: 'Kankaria Lakefront', address: 'Maninagar, Ahmedabad', department: 'AMD-CITY', latitude: 22.9950, longitude: 72.6009 },
  { code: 'AMD-RIVERFRONT', name: 'Sabarmati Riverfront', address: 'Sabarmati Riverfront, Ahmedabad', department: 'AMD-CITY', latitude: 23.0225, longitude: 72.5714 },
  { code: 'AMD-ASHRAM', name: 'Sabarmati Ashram', address: 'Ashram Road, Ahmedabad', department: 'GUJ-HERITAGE', latitude: 23.0606, longitude: 72.5809 },
  { code: 'AMD-OLDCITY', name: 'Manek Chowk and Bhadra Precinct', address: 'Old City, Ahmedabad', department: 'GUJ-HERITAGE', latitude: 23.0243, longitude: 72.5877 },
  { code: 'AMD-MOTERA', name: 'Narendra Modi Stadium', address: 'Motera, Ahmedabad', department: 'AMD-CITY', latitude: 23.0920, longitude: 72.5975 },
  { code: 'AMD-SGHWY', name: 'SG Highway Corridor', address: 'Sarkhej-Gandhinagar Highway, Ahmedabad', department: 'GUJ-TRAF', latitude: 23.0470, longitude: 72.5150 },
  { code: 'AMD-CGROAD', name: 'CG Road and Law Garden', address: 'Navrangpura, Ahmedabad', department: 'GUJ-TRAF', latitude: 23.0250, longitude: 72.5600 },
  { code: 'AMD-VASTRAPUR', name: 'Vastrapur Lake', address: 'Vastrapur, Ahmedabad', department: 'AMD-CITY', latitude: 23.0395, longitude: 72.5262 },
];

// ---------------------------------------------------------------------------
// Hardware - a declared inventory, deliberately heterogeneous
// ---------------------------------------------------------------------------

interface Hardware {
  vendor: string;
  model: string;
  protocol: 'RTSP' | 'ONVIF' | 'HTTP';
  resolution: string;
  fps: number;
  ptz: boolean;
}

const HARDWARE: Hardware[] = [
  { vendor: 'Hikvision', model: 'DS-2CD2143G2-I', protocol: 'ONVIF', resolution: '2688x1520', fps: 25, ptz: false },
  { vendor: 'Hikvision', model: 'DS-2DE4425IW-DE', protocol: 'ONVIF', resolution: '2560x1440', fps: 25, ptz: true },
  { vendor: 'Dahua', model: 'IPC-HFW2431S-S-S2', protocol: 'RTSP', resolution: '2688x1520', fps: 20, ptz: false },
  { vendor: 'Dahua', model: 'SD5A445XA-HNR', protocol: 'ONVIF', resolution: '2560x1440', fps: 25, ptz: true },
  { vendor: 'CP Plus', model: 'CP-UNC-TA41L3C-V3', protocol: 'RTSP', resolution: '2560x1440', fps: 20, ptz: false },
  { vendor: 'Axis', model: 'P3265-LVE', protocol: 'RTSP', resolution: '1920x1080', fps: 30, ptz: false },
  { vendor: 'Axis', model: 'Q6135-LE', protocol: 'ONVIF', resolution: '1920x1080', fps: 30, ptz: true },
  { vendor: 'Bosch', model: 'FLEXIDOME IP 5000i', protocol: 'ONVIF', resolution: '1920x1080', fps: 25, ptz: false },
  { vendor: 'Uniview', model: 'IPC2124SB-ADF28KM-I0', protocol: 'RTSP', resolution: '1920x1080', fps: 20, ptz: false },
  { vendor: 'Honeywell', model: 'HC30WB5R2', protocol: 'HTTP', resolution: '1280x720', fps: 15, ptz: false },
];

// ---------------------------------------------------------------------------
// Cameras
//
// bearing: compass direction the lens faces, degrees clockwise from north.
// radius:  effective viewing range in metres, as declared by the installer.
// Both are null where the survey did not record them.
// ---------------------------------------------------------------------------

interface CameraSeed {
  cameraId: string;
  name: string;
  site: string;
  hw: number;
  latitude: number | null;
  longitude: number | null;
  bearing: number | null;
  radius: number | null;
}

const CAMERAS: CameraSeed[] = [
  // --- Gandhinagar: Sector 17 Civic Centre ---
  { cameraId: 'GNR-001', name: 'Ch-0 Circle North Approach', site: 'GNR-SEC17', hw: 0, latitude: 23.2266, longitude: 72.6489, bearing: 15, radius: 60 },
  { cameraId: 'GNR-002', name: 'Sector 17 Market Entrance', site: 'GNR-SEC17', hw: 4, latitude: 23.2301, longitude: 72.6512, bearing: 210, radius: 45 },
  { cameraId: 'GNR-003', name: 'Sachivalaya Gate 1', site: 'GNR-SEC17', hw: 1, latitude: 23.2295, longitude: 72.6486, bearing: 90, radius: 80 },
  { cameraId: 'GNR-004', name: 'Sector 17 Bus Bay', site: 'GNR-SEC17', hw: 8, latitude: 23.2285, longitude: 72.6521, bearing: 300, radius: 50 },

  // --- Gandhinagar: Mahatma Mandir ---
  { cameraId: 'GNR-005', name: 'Mahatma Mandir Main Gate', site: 'GNR-MMANDIR', hw: 3, latitude: 23.2320, longitude: 72.6469, bearing: 180, radius: 70 },
  { cameraId: 'GNR-006', name: 'Mahatma Mandir Parking A', site: 'GNR-MMANDIR', hw: 2, latitude: 23.2313, longitude: 72.6455, bearing: 45, radius: 90 },
  { cameraId: 'GNR-007', name: 'Mahatma Mandir Convention Foyer', site: 'GNR-MMANDIR', hw: 7, latitude: 23.2325, longitude: 72.6476, bearing: 270, radius: 35 },

  // --- Gandhinagar: Akshardham ---
  { cameraId: 'GNR-008', name: 'Akshardham East Entry', site: 'GNR-AKSHAR', hw: 0, latitude: 23.2299, longitude: 72.6728, bearing: 265, radius: 55 },
  { cameraId: 'GNR-009', name: 'Akshardham Visitor Queue', site: 'GNR-AKSHAR', hw: 5, latitude: 23.2291, longitude: 72.6711, bearing: 20, radius: 40 },
  { cameraId: 'GNR-010', name: 'Akshardham Perimeter North', site: 'GNR-AKSHAR', hw: 6, latitude: 23.2308, longitude: 72.6714, bearing: 175, radius: 120 },

  // --- Gandhinagar: Capital Railway Station ---
  { cameraId: 'GNR-011', name: 'Capital Station Concourse', site: 'GNR-RAIL', hw: 7, latitude: 23.2229, longitude: 72.6360, bearing: 90, radius: 45 },
  { cameraId: 'GNR-012', name: 'Capital Station Platform 1', site: 'GNR-RAIL', hw: 2, latitude: 23.2233, longitude: 72.6366, bearing: 355, radius: 70 },
  { cameraId: 'GNR-013', name: 'Capital Station Forecourt', site: 'GNR-RAIL', hw: 0, latitude: 23.2224, longitude: 72.6353, bearing: 200, radius: 60 },

  // --- Gandhinagar: Infocity ---
  { cameraId: 'GNR-014', name: 'Infocity Circle', site: 'GNR-INFOCITY', hw: 1, latitude: 23.1607, longitude: 72.6835, bearing: 130, radius: 75 },
  { cameraId: 'GNR-015', name: 'GIFT City Road Junction', site: 'GNR-INFOCITY', hw: 5, latitude: 23.1591, longitude: 72.6849, bearing: 310, radius: 65 },
  // Installed and cabled, survey not yet returned. Stays off the map on purpose.
  { cameraId: 'GNR-016', name: 'Infocity Service Road', site: 'GNR-INFOCITY', hw: 9, latitude: null, longitude: null, bearing: null, radius: null },

  // --- Gandhinagar: Indroda Nature Park ---
  { cameraId: 'GNR-017', name: 'Indroda Park Gate', site: 'GNR-INDRODA', hw: 8, latitude: 23.1993, longitude: 72.6543, bearing: 240, radius: 50 },
  { cameraId: 'GNR-018', name: 'Indroda Riverside Trail', site: 'GNR-INDRODA', hw: 9, latitude: 23.1978, longitude: 72.6560, bearing: 60, radius: 40 },

  // --- Ahmedabad: Kalupur Junction ---
  { cameraId: 'AMD-001', name: 'Kalupur Main Entrance', site: 'AMD-KALUPUR', hw: 3, latitude: 23.0272, longitude: 72.6019, bearing: 185, radius: 60 },
  { cameraId: 'AMD-002', name: 'Kalupur Platform 1 West', site: 'AMD-KALUPUR', hw: 0, latitude: 23.0277, longitude: 72.6011, bearing: 275, radius: 80 },
  { cameraId: 'AMD-003', name: 'Kalupur Foot Overbridge', site: 'AMD-KALUPUR', hw: 8, latitude: 23.0274, longitude: 72.6024, bearing: 95, radius: 55 },
  { cameraId: 'AMD-004', name: 'Kalupur Taxi Rank', site: 'AMD-KALUPUR', hw: 4, latitude: 23.0266, longitude: 72.6027, bearing: 20, radius: 45 },

  // --- Ahmedabad: Airport ---
  { cameraId: 'AMD-005', name: 'Terminal 1 Departures Kerb', site: 'AMD-AIRPORT', hw: 6, latitude: 23.0725, longitude: 72.6266, bearing: 160, radius: 70 },
  { cameraId: 'AMD-006', name: 'Terminal 1 Arrivals Hall', site: 'AMD-AIRPORT', hw: 7, latitude: 23.0719, longitude: 72.6259, bearing: 340, radius: 50 },
  { cameraId: 'AMD-007', name: 'Airport Approach Road', site: 'AMD-AIRPORT', hw: 5, latitude: 23.0736, longitude: 72.6274, bearing: 250, radius: 90 },
  { cameraId: 'AMD-008', name: 'Airport Long Stay Car Park', site: 'AMD-AIRPORT', hw: 2, latitude: 23.0741, longitude: 72.6250, bearing: 70, radius: 110 },

  // --- Ahmedabad: Kankaria Lakefront ---
  { cameraId: 'AMD-009', name: 'Kankaria Lakefront West Gate', site: 'AMD-KANKARIA', hw: 0, latitude: 22.9944, longitude: 72.5993, bearing: 105, radius: 55 },
  { cameraId: 'AMD-010', name: 'Kankaria Promenade North', site: 'AMD-KANKARIA', hw: 4, latitude: 22.9963, longitude: 72.6008, bearing: 195, radius: 65 },
  { cameraId: 'AMD-011', name: 'Kankaria Zoo Entrance', site: 'AMD-KANKARIA', hw: 8, latitude: 22.9951, longitude: 72.6027, bearing: 285, radius: 45 },
  { cameraId: 'AMD-012', name: 'Kankaria Balvatika', site: 'AMD-KANKARIA', hw: 9, latitude: 22.9938, longitude: 72.6019, bearing: 15, radius: 40 },

  // --- Ahmedabad: Sabarmati Riverfront ---
  { cameraId: 'AMD-013', name: 'Riverfront West Promenade', site: 'AMD-RIVERFRONT', hw: 1, latitude: 23.0231, longitude: 72.5709, bearing: 350, radius: 85 },
  { cameraId: 'AMD-014', name: 'Nehru Bridge East Landing', site: 'AMD-RIVERFRONT', hw: 5, latitude: 23.0244, longitude: 72.5762, bearing: 260, radius: 70 },
  { cameraId: 'AMD-015', name: 'Riverfront Flower Park', site: 'AMD-RIVERFRONT', hw: 2, latitude: 23.0480, longitude: 72.5790, bearing: 130, radius: 60 },
  { cameraId: 'AMD-016', name: 'Riverfront East Walkway', site: 'AMD-RIVERFRONT', hw: 0, latitude: 23.0218, longitude: 72.5741, bearing: 200, radius: 75 },
  // Pole erected, position not yet surveyed.
  { cameraId: 'AMD-017', name: 'Sardar Bridge Underpass', site: 'AMD-RIVERFRONT', hw: 9, latitude: null, longitude: null, bearing: null, radius: null },

  // --- Ahmedabad: Sabarmati Ashram ---
  { cameraId: 'AMD-018', name: 'Sabarmati Ashram Entrance', site: 'AMD-ASHRAM', hw: 7, latitude: 23.0606, longitude: 72.5809, bearing: 175, radius: 45 },
  { cameraId: 'AMD-019', name: 'Hriday Kunj Courtyard', site: 'AMD-ASHRAM', hw: 8, latitude: 23.0611, longitude: 72.5804, bearing: 90, radius: 30 },
  { cameraId: 'AMD-020', name: 'Ashram Riverside Gate', site: 'AMD-ASHRAM', hw: 4, latitude: 23.0599, longitude: 72.5815, bearing: 300, radius: 50 },

  // --- Ahmedabad: Old City ---
  { cameraId: 'AMD-021', name: 'Manek Chowk Night Market', site: 'AMD-OLDCITY', hw: 3, latitude: 23.0243, longitude: 72.5877, bearing: 210, radius: 40 },
  { cameraId: 'AMD-022', name: 'Bhadra Fort West Arch', site: 'AMD-OLDCITY', hw: 0, latitude: 23.0247, longitude: 72.5851, bearing: 95, radius: 55 },
  { cameraId: 'AMD-023', name: 'Sidi Saiyyed Junction', site: 'AMD-OLDCITY', hw: 5, latitude: 23.0272, longitude: 72.5804, bearing: 145, radius: 65 },
  { cameraId: 'AMD-024', name: 'Jama Masjid East Approach', site: 'AMD-OLDCITY', hw: 2, latitude: 23.0247, longitude: 72.5873, bearing: 280, radius: 50 },

  // --- Ahmedabad: Narendra Modi Stadium ---
  { cameraId: 'AMD-025', name: 'Stadium Gate 1', site: 'AMD-MOTERA', hw: 6, latitude: 23.0920, longitude: 72.5975, bearing: 190, radius: 80 },
  { cameraId: 'AMD-026', name: 'Stadium North Concourse', site: 'AMD-MOTERA', hw: 0, latitude: 23.0931, longitude: 72.5978, bearing: 250, radius: 60 },
  { cameraId: 'AMD-027', name: 'Stadium Parking P3', site: 'AMD-MOTERA', hw: 2, latitude: 23.0912, longitude: 72.5962, bearing: 40, radius: 120 },
  { cameraId: 'AMD-028', name: 'Motera Approach Road', site: 'AMD-MOTERA', hw: 5, latitude: 23.0903, longitude: 72.5990, bearing: 330, radius: 90 },

  // --- Ahmedabad: SG Highway corridor ---
  { cameraId: 'AMD-029', name: 'SG Highway Thaltej Flyover', site: 'AMD-SGHWY', hw: 1, latitude: 23.0470, longitude: 72.5150, bearing: 205, radius: 130 },
  { cameraId: 'AMD-030', name: 'ISKCON Circle North', site: 'AMD-SGHWY', hw: 5, latitude: 23.0270, longitude: 72.5070, bearing: 15, radius: 110 },
  { cameraId: 'AMD-031', name: 'Science City Road Junction', site: 'AMD-SGHWY', hw: 4, latitude: 23.0780, longitude: 72.5010, bearing: 250, radius: 100 },
  { cameraId: 'AMD-032', name: 'Gota Cross Roads', site: 'AMD-SGHWY', hw: 8, latitude: 23.1030, longitude: 72.5420, bearing: 140, radius: 95 },

  // --- Ahmedabad: CG Road and Law Garden ---
  { cameraId: 'AMD-033', name: 'CG Road Panchvati Circle', site: 'AMD-CGROAD', hw: 0, latitude: 23.0300, longitude: 72.5600, bearing: 175, radius: 70 },
  { cameraId: 'AMD-034', name: 'Law Garden Junction', site: 'AMD-CGROAD', hw: 7, latitude: 23.0225, longitude: 72.5590, bearing: 85, radius: 60 },
  { cameraId: 'AMD-035', name: 'Gujarat University Crossroads', site: 'AMD-CGROAD', hw: 3, latitude: 23.0367, longitude: 72.5453, bearing: 300, radius: 85 },

  // --- Ahmedabad: Vastrapur Lake ---
  { cameraId: 'AMD-036', name: 'Vastrapur Lake North Gate', site: 'AMD-VASTRAPUR', hw: 2, latitude: 23.0399, longitude: 72.5268, bearing: 200, radius: 50 },
  { cameraId: 'AMD-037', name: 'Vastrapur Lake Amphitheatre', site: 'AMD-VASTRAPUR', hw: 8, latitude: 23.0389, longitude: 72.5255, bearing: 25, radius: 45 },
  // Awaiting survey.
  { cameraId: 'AMD-038', name: 'Vastrapur Market Approach', site: 'AMD-VASTRAPUR', hw: 9, latitude: null, longitude: null, bearing: null, radius: null },
];

// ---------------------------------------------------------------------------

/** Deterministic private-range address derived from the camera's position in the list. */
function ipForIndex(index: number): string {
  return `10.42.${Math.floor(index / 64) + 1}.${(index % 64) + 10}`;
}

/** Stream path on MediaMTX: cam01 .. camNN, matching the publisher configuration. */
function streamPath(index: number): string {
  return `cam${String(index + 1).padStart(2, '0')}`;
}

async function main() {
  console.log(`Seeding camera registry. Stream base: ${RTSP_BASE}`);

  // --- Departments ---
  const departmentIds = new Map<string, string>();
  for (const dept of DEPARTMENTS) {
    const row = await prisma.department.upsert({
      where: { code: dept.code },
      // contactName / contactPhone are intentionally left unset - see the header.
      update: { name: dept.name },
      create: { code: dept.code, name: dept.name },
    });
    departmentIds.set(dept.code, row.id);
  }
  console.log(`  departments: ${departmentIds.size}`);

  // --- Sites ---
  const siteIds = new Map<string, string>();
  for (const site of SITES) {
    const departmentId = departmentIds.get(site.department);
    if (!departmentId) throw new Error(`Site ${site.code} names unknown department ${site.department}`);

    const row = await prisma.site.upsert({
      where: { code: site.code },
      update: {
        name: site.name,
        address: site.address,
        latitude: site.latitude,
        longitude: site.longitude,
        departmentId,
      },
      create: {
        code: site.code,
        name: site.name,
        address: site.address,
        latitude: site.latitude,
        longitude: site.longitude,
        departmentId,
      },
    });
    siteIds.set(site.code, row.id);
  }
  console.log(`  sites: ${siteIds.size}`);

  // --- Cameras ---
  let created = 0;
  let updated = 0;

  for (const [index, cam] of CAMERAS.entries()) {
    const site = SITES.find((s) => s.code === cam.site);
    if (!site) throw new Error(`Camera ${cam.cameraId} names unknown site ${cam.site}`);

    const hardware = HARDWARE[cam.hw];
    if (!hardware) throw new Error(`Camera ${cam.cameraId} names unknown hardware index ${cam.hw}`);

    const ipAddress = ipForIndex(index);
    const path = streamPath(index);

    const data = {
      name: cam.name,
      location: `${site.name}, ${site.address.split(', ').pop()}`,
      ipAddress,
      rtspUrl: `${RTSP_BASE}/${path}`,
      latitude: cam.latitude,
      longitude: cam.longitude,
      coverageAngle: cam.bearing,
      coverageRadius: cam.radius,
      isPtz: hardware.ptz,
      vendor: hardware.vendor,
      model: hardware.model,
      protocol: hardware.protocol,
      onvifUrl: hardware.protocol === 'ONVIF' ? `http://${ipAddress}/onvif/device_service` : null,
      resolution: hardware.resolution,
      fps: hardware.fps,
      departmentId: departmentIds.get(site.department)!,
      siteId: siteIds.get(site.code)!,
      // status and lastSeenAt are deliberately absent. A re-run must not reset a
      // camera the health checker has since reached, and a first run must leave
      // it at the schema default of UNKNOWN.
    };

    // Registry cameras have eventId null, so `upsert` on the composite key is not
    // usable - find then write.
    const existing = await prisma.camera.findFirst({
      where: { cameraId: cam.cameraId, eventId: null },
      select: { id: true },
    });

    if (existing) {
      await prisma.camera.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.camera.create({ data: { ...data, cameraId: cam.cameraId, eventId: null } });
      created += 1;
    }
  }

  const unlocated = CAMERAS.filter((c) => c.latitude === null).length;
  console.log(`  cameras: ${created} created, ${updated} updated (${CAMERAS.length} total)`);
  console.log(`  ${unlocated} camera(s) seeded without coordinates - not yet surveyed`);
  console.log('  all cameras left at status UNKNOWN until a health check reaches them');
}

main()
  .catch((error) => {
    console.error('Camera registry seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
