import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Map as MapIcon, List, Loader, AlertTriangle, MapPinOff, Video } from 'lucide-react';
import MeshGradient from '../../components/MeshGradient';
import Spotlight from '../../components/Spotlight';
import Navbar from '../../components/Navbar';
import * as surveillance from '../../services/surveillance.service';
import type { RegistryCamera, Department } from '../../services/surveillance.service';
import {
  STATUS_PRESENTATION, STATUS_ORDER, formatLastSeen, formatCoordinates, formatBearing,
} from './cameraStatus';

// Centre of the estate until the real cameras arrive: Gandhinagar. Only used as
// the map's opening view - it never stands in for a camera position.
const GANDHINAGAR: [number, number] = [23.2156, 72.6369];

/**
 * Great-circle destination from a point, given a bearing and a distance.
 * Used to draw the aim line at the camera's declared range - a computation over
 * two stored values, not a drawn guess.
 */
function destinationPoint(
  lat: number,
  lon: number,
  bearingDegrees: number,
  distanceMetres: number
): [number, number] {
  const R = 6371000;
  const angular = distanceMetres / R;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI];
}

function markerIcon(camera: RegistryCamera, isSelected: boolean): L.DivIcon {
  const { hex } = STATUS_PRESENTATION[camera.status];
  const arrow =
    camera.coverageAngle === null
      ? ''
      : `<i class="camera-marker-arrow" style="transform: rotate(${camera.coverageAngle}deg)"></i>`;

  return L.divIcon({
    className: 'camera-marker',
    html:
      `<span class="camera-marker-dot${isSelected ? ' is-selected' : ''}" ` +
      `style="--marker-color:${hex}">${arrow}</span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

/** Frames the map on the cameras that actually have coordinates. */
const FitToCameras: React.FC<{ points: Array<[number, number]> }> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48] });
  }, [map, points]);

  return null;
};

const CameraMap: React.FC = () => {
  const navigate = useNavigate();

  const [cameras, setCameras] = useState<RegistryCamera[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCoverage, setShowCoverage] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [result, deptRows] = await Promise.all([
        surveillance.getCameras({
          departmentId: departmentFilter || undefined,
          status: statusFilter || undefined,
          take: 1000,
        }),
        surveillance.getDepartments(),
      ]);
      setCameras(result.cameras);
      setDepartments(deptRows);
    } catch (error: any) {
      setCameras([]);
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const located = useMemo(
    () => cameras.filter((c) => c.latitude !== null && c.longitude !== null),
    [cameras]
  );
  const unlocated = useMemo(
    () => cameras.filter((c) => c.latitude === null || c.longitude === null),
    [cameras]
  );
  const points = useMemo<Array<[number, number]>>(
    () => located.map((c) => [c.latitude as number, c.longitude as number]),
    [located]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const status of STATUS_ORDER) counts[status] = 0;
    for (const camera of cameras) counts[camera.status] += 1;
    return counts;
  }, [cameras]);

  const selected = located.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="relative min-h-screen bg-ai-black text-ai-white overflow-hidden">
      <MeshGradient />
      <Spotlight />
      <Navbar />

      <div className="relative z-10 pt-20 sm:pt-24 pb-8 sm:pb-12 safe-bottom">
        <div className="page-container max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6"
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <MapIcon className="w-7 h-7 sm:w-8 sm:h-8 text-ai-white shrink-0" />
                <h1 className="text-heading text-2xl sm:text-3xl font-bold text-ai-white">
                  Camera Map
                </h1>
              </div>
              <p className="text-ai-gray-400 text-sm sm:text-base">
                {loading
                  ? 'Loading camera positions…'
                  : `${located.length} of ${cameras.length} cameras have surveyed coordinates.`}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/surveillance/cameras')}
                className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors flex items-center gap-2 text-sm"
              >
                <List className="w-4 h-4" />
                Registry list
              </button>
              <button
                onClick={() => navigate('/surveillance/live-wall')}
                className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors flex items-center gap-2 text-sm"
              >
                <Video className="w-4 h-4" />
                Live wall
              </button>
            </div>
          </motion.div>

          <div className="glass-light rounded-2xl p-4 mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 bg-ai-gray-900 border border-ai-gray-700 rounded-lg text-sm text-ai-white focus:outline-none focus:border-ai-gray-400"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.cameraCount})</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-ai-gray-900 border border-ai-gray-700 rounded-lg text-sm text-ai-white focus:outline-none focus:border-ai-gray-400"
            >
              <option value="">All statuses</option>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>{STATUS_PRESENTATION[status].label}</option>
              ))}
            </select>

            <label className="flex items-center gap-2 cursor-pointer text-sm text-ai-gray-300">
              <input
                type="checkbox"
                checked={showCoverage}
                onChange={(e) => setShowCoverage(e.target.checked)}
                className="w-4 h-4"
              />
              Show declared range and aim
            </label>

            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              {STATUS_ORDER.map((status) => (
                <span
                  key={status}
                  className="text-xs text-ai-gray-400 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span className={`w-2 h-2 rounded-full ${STATUS_PRESENTATION[status].dot}`} />
                  {STATUS_PRESENTATION[status].label} {statusCounts[status]}
                </span>
              ))}
            </div>
          </div>

          {loadError && (
            <div className="mb-4 p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-sm text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium mb-1">The map could not load camera positions.</p>
                <p className="text-xs break-anywhere">{loadError}</p>
              </div>
            </div>
          )}

          <div className="glass-light rounded-2xl overflow-hidden">
            {loading ? (
              <div className="h-[28rem] flex flex-col items-center justify-center text-ai-gray-400">
                <Loader className="w-6 h-6 animate-spin mb-2" />
                Loading camera positions…
              </div>
            ) : located.length === 0 ? (
              <div className="h-[28rem] flex flex-col items-center justify-center text-center px-6">
                <MapPinOff className="w-8 h-8 text-ai-gray-500 mb-3" />
                <p className="text-ai-gray-300 mb-1">No camera has coordinates yet.</p>
                <p className="text-ai-gray-500 text-sm max-w-md">
                  {loadError
                    ? 'Positions could not be read from the registry.'
                    : 'Cameras appear here once a survey records their latitude and longitude.'}
                </p>
              </div>
            ) : (
              <div className="camera-map-shell h-[26rem] sm:h-[32rem] lg:h-[36rem]">
                <MapContainer
                  center={GANDHINAGAR}
                  zoom={11}
                  scrollWheelZoom
                  className="w-full h-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                  />
                  <FitToCameras points={points} />

                  {located.map((camera) => {
                    const lat = camera.latitude as number;
                    const lon = camera.longitude as number;
                    const isSelected = camera.id === selectedId;
                    const presentation = STATUS_PRESENTATION[camera.status];
                    const showThisCoverage = showCoverage && isSelected;

                    return (
                      <React.Fragment key={camera.id}>
                        {showThisCoverage && camera.coverageRadius !== null && (
                          <Circle
                            center={[lat, lon]}
                            radius={camera.coverageRadius}
                            pathOptions={{
                              color: presentation.hex,
                              fillColor: presentation.hex,
                              fillOpacity: 0.08,
                              weight: 1,
                            }}
                          />
                        )}

                        {showThisCoverage &&
                          camera.coverageAngle !== null &&
                          camera.coverageRadius !== null && (
                            <Polyline
                              positions={[
                                [lat, lon],
                                destinationPoint(lat, lon, camera.coverageAngle, camera.coverageRadius),
                              ]}
                              pathOptions={{ color: presentation.hex, weight: 2, dashArray: '4 4' }}
                            />
                          )}

                        <Marker
                          position={[lat, lon]}
                          icon={markerIcon(camera, isSelected)}
                          eventHandlers={{ click: () => setSelectedId(camera.id) }}
                        >
                          <Popup>
                            <div className="camera-popup">
                              <p className="camera-popup-title">{camera.cameraId}</p>
                              <p className="camera-popup-sub">{camera.name}</p>

                              <dl>
                                <dt>Status</dt>
                                <dd>{presentation.label}</dd>

                                <dt>Last reached</dt>
                                <dd>{formatLastSeen(camera.lastSeenAt)}</dd>

                                <dt>Site</dt>
                                <dd>{camera.site?.name ?? 'Unassigned'}</dd>

                                <dt>Department</dt>
                                <dd>{camera.department?.name ?? 'Unassigned'}</dd>

                                <dt>Hardware</dt>
                                <dd>
                                  {camera.vendor ?? 'Vendor not recorded'}
                                  {camera.model ? ` ${camera.model}` : ''}
                                  {camera.isPtz ? ' · PTZ' : ''}
                                </dd>

                                <dt>Configured</dt>
                                <dd>
                                  {camera.resolution ?? 'resolution not recorded'}
                                  {camera.fps ? ` · ${camera.fps} fps` : ''}
                                </dd>

                                <dt>Aim</dt>
                                <dd>{formatBearing(camera.coverageAngle) ?? 'Bearing not surveyed'}</dd>

                                <dt>Range</dt>
                                <dd>
                                  {camera.coverageRadius !== null
                                    ? `${camera.coverageRadius} m declared`
                                    : 'Range not recorded'}
                                </dd>

                                <dt>Position</dt>
                                <dd>{formatCoordinates(camera.latitude, camera.longitude)}</dd>
                              </dl>
                            </div>
                          </Popup>
                        </Marker>
                      </React.Fragment>
                    );
                  })}
                </MapContainer>
              </div>
            )}
          </div>

          {selected && (
            <p className="mt-3 text-xs text-ai-gray-500">
              Showing declared range and aim for {selected.cameraId}. These are survey values from
              the registry, not a measured field of view.
            </p>
          )}

          {/* Cameras the map cannot honestly place. Listing them is the point:
              silently dropping them would understate the estate. */}
          {!loading && unlocated.length > 0 && (
            <div className="glass-light rounded-2xl p-4 sm:p-5 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPinOff className="w-4 h-4 text-ai-gray-400 shrink-0" />
                <h2 className="text-sm font-semibold text-ai-white">
                  Not on the map — {unlocated.length} camera{unlocated.length === 1 ? '' : 's'} awaiting survey
                </h2>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {unlocated.map((camera) => (
                  <li
                    key={camera.id}
                    className="px-3 py-2 rounded-lg bg-ai-gray-900/60 border border-ai-gray-800"
                  >
                    <p className="text-sm text-ai-gray-200">{camera.cameraId}</p>
                    <p className="text-xs text-ai-gray-500">{camera.name}</p>
                    <p className="text-xs text-ai-gray-600 mt-0.5">
                      {camera.site?.name ?? 'No site'} · no coordinates recorded
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraMap;
