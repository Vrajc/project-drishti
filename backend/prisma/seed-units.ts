/**
 * Seeds the estate's responder units — the resources a police operator actually
 * dispatches, as opposed to an organizer's own event marshals.
 *
 * WHAT IS AND IS NOT REAL HERE
 *
 * The coordinates are real: every unit is based at an actual police station,
 * control room, fire station or hospital in Gandhinagar or Ahmedabad, and the
 * nearest-unit ranking in the dispatch console is a genuine haversine over
 * these points. This is a plausible *deployment* of real infrastructure, not a
 * claim about which vehicles Gujarat Police operates today.
 *
 * `contact` is deliberately a role label rather than a phone number. Inventing
 * a phone number for a real police station would be worse than an empty field,
 * which is the same call seed-cameras.ts makes about department contacts.
 *
 * Nothing here writes an observed value. Every unit is seeded AVAILABLE, which
 * is the schema default and means "not currently committed to an assignment" —
 * the dispatch lifecycle is the only thing that moves a unit to DISPATCHED, and
 * only in response to a real operator action.
 *
 * Three units are deliberately seeded without coordinates. A real force always
 * has resources whose position is known to a controller but not to the system,
 * and the console has to list them as dispatchable-but-unranked rather than
 * pretending to know where they are.
 *
 * Run with:  npm run seed:units   (from backend/)
 * Safe to re-run: matches on unitId among registry units and updates in place.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface UnitSeed {
  unitId: string;
  name: string;
  /** Free text, matching the existing DispatchUnit.type convention. */
  type: string;
  department: string;
  location: string;
  contact: string;
  capacity: number;
  latitude: number | null;
  longitude: number | null;
}

// Bases are real facilities. Types follow the vocabulary EmergencyDispatch.tsx
// already maps: anything containing "police", "ambulance"/"medical" or "fire"
// is recognised; everything else falls through to security.
const UNITS: UnitSeed[] = [
  // --- Gandhinagar City Police ------------------------------------------
  { unitId: 'GNR-PCR-01', name: 'PCR Van Sector 17', type: 'police', department: 'GNR-CITY', location: 'Sector 17 Police Station, Gandhinagar', contact: 'Sector 17 control', capacity: 4, latitude: 23.2287, longitude: 72.6494 },
  { unitId: 'GNR-PCR-02', name: 'PCR Van Sector 21', type: 'police', department: 'GNR-CITY', location: 'Sector 21 Police Station, Gandhinagar', contact: 'Sector 21 control', capacity: 4, latitude: 23.2156, longitude: 72.6604 },
  { unitId: 'GNR-PCR-03', name: 'PCR Van Sector 7', type: 'police', department: 'GNR-CITY', location: 'Sector 7 Police Station, Gandhinagar', contact: 'Sector 7 control', capacity: 4, latitude: 23.2114, longitude: 72.6398 },
  { unitId: 'GNR-QRT-01', name: 'Quick Response Team Gandhinagar', type: 'police', department: 'GNR-CITY', location: 'Police Bhavan, Sector 18, Gandhinagar', contact: 'District control room', capacity: 8, latitude: 23.2240, longitude: 72.6503 },
  { unitId: 'GNR-INFOCITY-01', name: 'Patrol Unit Infocity', type: 'police', department: 'GNR-CITY', location: 'Infocity Police Outpost, Gandhinagar', contact: 'Infocity outpost', capacity: 4, latitude: 23.1889, longitude: 72.6297 },

  // --- Ahmedabad City Police --------------------------------------------
  { unitId: 'AMD-PCR-01', name: 'PCR Van Maninagar', type: 'police', department: 'AMD-CITY', location: 'Maninagar Police Station, Ahmedabad', contact: 'Maninagar control', capacity: 4, latitude: 22.9967, longitude: 72.6021 },
  { unitId: 'AMD-PCR-02', name: 'PCR Van Navrangpura', type: 'police', department: 'AMD-CITY', location: 'Navrangpura Police Station, Ahmedabad', contact: 'Navrangpura control', capacity: 4, latitude: 23.0364, longitude: 72.5613 },
  { unitId: 'AMD-PCR-03', name: 'PCR Van Sabarmati', type: 'police', department: 'AMD-CITY', location: 'Sabarmati Police Station, Ahmedabad', contact: 'Sabarmati control', capacity: 4, latitude: 23.0808, longitude: 72.5806 },
  { unitId: 'AMD-PCR-04', name: 'PCR Van Vastrapur', type: 'police', department: 'AMD-CITY', location: 'Vastrapur Police Station, Ahmedabad', contact: 'Vastrapur control', capacity: 4, latitude: 23.0387, longitude: 72.5288 },
  { unitId: 'AMD-QRT-01', name: 'Quick Response Team Ahmedabad', type: 'police', department: 'AMD-CITY', location: 'Police Commissioner Office, Shahibaug, Ahmedabad', contact: 'City control room', capacity: 10, latitude: 23.0587, longitude: 72.5936 },
  { unitId: 'AMD-MOTERA-01', name: 'Stadium Detail Motera', type: 'police', department: 'AMD-CITY', location: 'Narendra Modi Stadium, Motera, Ahmedabad', contact: 'Stadium security post', capacity: 12, latitude: 23.0916, longitude: 72.5970 },

  // --- Traffic ------------------------------------------------------------
  { unitId: 'TRAF-SG-01', name: 'Traffic Interceptor SG Highway', type: 'police', department: 'GUJ-TRAF', location: 'SG Highway Traffic Post, Ahmedabad', contact: 'Traffic control', capacity: 2, latitude: 23.0470, longitude: 72.5150 },
  { unitId: 'TRAF-CG-01', name: 'Traffic Unit CG Road', type: 'police', department: 'GUJ-TRAF', location: 'CG Road Traffic Post, Navrangpura, Ahmedabad', contact: 'Traffic control', capacity: 2, latitude: 23.0250, longitude: 72.5600 },
  { unitId: 'TRAF-CRANE-01', name: 'Recovery Crane Western Division', type: 'recovery', department: 'GUJ-TRAF', location: 'Traffic Division Yard, Ahmedabad', contact: 'Traffic control', capacity: 2, latitude: 23.0331, longitude: 72.5450 },

  // --- Transit and terminals ---------------------------------------------
  { unitId: 'TRN-KALUPUR-01', name: 'RPF Detail Kalupur', type: 'security', department: 'AMD-TRANSIT', location: 'Ahmedabad Junction (Kalupur), Ahmedabad', contact: 'Station security office', capacity: 6, latitude: 23.0272, longitude: 72.6019 },
  { unitId: 'TRN-AIRPORT-01', name: 'Terminal Response Unit SVPI', type: 'security', department: 'AMD-TRANSIT', location: 'SVP International Airport, Hansol, Ahmedabad', contact: 'Terminal security', capacity: 6, latitude: 23.0725, longitude: 72.6266 },
  { unitId: 'TRN-GNRRAIL-01', name: 'Station Detail Gandhinagar Capital', type: 'security', department: 'AMD-TRANSIT', location: 'Gandhinagar Capital Railway Station', contact: 'Station security office', capacity: 4, latitude: 23.2229, longitude: 72.6360 },

  // --- Medical -----------------------------------------------------------
  { unitId: 'MED-108-GNR1', name: 'Ambulance 108 Gandhinagar Civil', type: 'ambulance', department: 'GNR-CITY', location: 'Civil Hospital, Sector 12, Gandhinagar', contact: '108 dispatch', capacity: 2, latitude: 23.2183, longitude: 72.6448 },
  { unitId: 'MED-108-AMD1', name: 'Ambulance 108 Civil Asarwa', type: 'ambulance', department: 'AMD-CITY', location: 'Civil Hospital, Asarwa, Ahmedabad', contact: '108 dispatch', capacity: 2, latitude: 23.0537, longitude: 72.6068 },
  { unitId: 'MED-108-AMD2', name: 'Ambulance 108 SVP Hospital', type: 'ambulance', department: 'AMD-CITY', location: 'SVP Hospital, Ellisbridge, Ahmedabad', contact: '108 dispatch', capacity: 2, latitude: 23.0261, longitude: 72.5745 },
  { unitId: 'MED-108-AMD3', name: 'Ambulance 108 Maninagar', type: 'ambulance', department: 'AMD-CITY', location: 'LG Hospital, Maninagar, Ahmedabad', contact: '108 dispatch', capacity: 2, latitude: 22.9962, longitude: 72.6019 },

  // --- Fire ---------------------------------------------------------------
  { unitId: 'FIRE-GNR-01', name: 'Fire Tender Gandhinagar Sector 24', type: 'fire', department: 'GNR-CITY', location: 'Fire Station, Sector 24, Gandhinagar', contact: 'Fire control', capacity: 6, latitude: 23.2032, longitude: 72.6360 },
  { unitId: 'FIRE-AMD-01', name: 'Fire Tender Danapith', type: 'fire', department: 'AMD-CITY', location: 'Danapith Fire Station, Ahmedabad', contact: 'Fire control', capacity: 6, latitude: 23.0233, longitude: 72.5873 },
  { unitId: 'FIRE-AMD-02', name: 'Fire Tender Naranpura', type: 'fire', department: 'AMD-CITY', location: 'Naranpura Fire Station, Ahmedabad', contact: 'Fire control', capacity: 6, latitude: 23.0555, longitude: 72.5535 },

  // --- Heritage and public spaces ----------------------------------------
  { unitId: 'HER-AKSHAR-01', name: 'Security Detail Akshardham', type: 'security', department: 'GUJ-HERITAGE', location: 'Akshardham Temple Complex, Gandhinagar', contact: 'Complex security office', capacity: 8, latitude: 23.2295, longitude: 72.6717 },
  { unitId: 'HER-ASHRAM-01', name: 'Security Detail Sabarmati Ashram', type: 'security', department: 'GUJ-HERITAGE', location: 'Sabarmati Ashram, Ahmedabad', contact: 'Ashram security office', capacity: 4, latitude: 23.0606, longitude: 72.5809 },
  { unitId: 'HER-OLDCITY-01', name: 'Foot Patrol Manek Chowk', type: 'security', department: 'GUJ-HERITAGE', location: 'Manek Chowk, Old City, Ahmedabad', contact: 'Old City outpost', capacity: 6, latitude: 23.0243, longitude: 72.5877 },

  // --- Registered but not surveyed ---------------------------------------
  // Their controller knows where they are; this system does not. The console
  // lists them as dispatchable and says it cannot rank them by distance.
  { unitId: 'GNR-RESERVE-01', name: 'Reserve Platoon Gandhinagar', type: 'police', department: 'GNR-CITY', location: 'Reserve lines, Gandhinagar', contact: 'District control room', capacity: 20, latitude: null, longitude: null },
  { unitId: 'AMD-RESERVE-01', name: 'Reserve Platoon Ahmedabad', type: 'police', department: 'AMD-CITY', location: 'Reserve lines, Ahmedabad', contact: 'City control room', capacity: 20, latitude: null, longitude: null },
  { unitId: 'MED-108-FLOAT', name: 'Ambulance 108 Floating Unit', type: 'ambulance', department: 'AMD-CITY', location: 'Assigned by 108 control', contact: '108 dispatch', capacity: 2, latitude: null, longitude: null },
];

async function main() {
  console.log('Seeding estate dispatch units…');

  const departments = await prisma.department.findMany({ select: { id: true, code: true } });
  const departmentIds = new Map(departments.map((d) => [d.code, d.id]));

  if (departmentIds.size === 0) {
    throw new Error(
      'No departments found. Run `npm run seed:cameras` first — units are owned by the ' +
        'same departments that own the camera estate.'
    );
  }

  let created = 0;
  let updated = 0;

  for (const unit of UNITS) {
    const departmentId = departmentIds.get(unit.department);
    if (!departmentId) {
      throw new Error(`Unit ${unit.unitId} names unknown department ${unit.department}`);
    }

    const data = {
      name: unit.name,
      type: unit.type,
      contact: unit.contact,
      capacity: unit.capacity,
      location: unit.location,
      latitude: unit.latitude,
      longitude: unit.longitude,
      departmentId,
      // `status` is deliberately absent. A re-run must not free a unit that is
      // currently committed to a live assignment, and a first run leaves it at
      // the schema default of AVAILABLE.
    };

    // Registry units have eventId null, so the composite unique key cannot be
    // used for an upsert - find then write, as seed-cameras.ts does.
    const existing = await prisma.dispatchUnit.findFirst({
      where: { unitId: unit.unitId, eventId: null },
      select: { id: true },
    });

    if (existing) {
      await prisma.dispatchUnit.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.dispatchUnit.create({
        data: { ...data, unitId: unit.unitId, eventId: null },
      });
      created += 1;
    }
  }

  const unlocated = UNITS.filter((u) => u.latitude === null).length;
  console.log(`  units: ${created} created, ${updated} updated (${UNITS.length} total)`);
  console.log(`  ${unlocated} unit(s) seeded without coordinates - dispatchable but not rankable`);
  console.log('  all units left at their current status; only dispatch changes it');
}

main()
  .catch((error) => {
    console.error('Dispatch unit seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
