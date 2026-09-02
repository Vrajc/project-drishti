import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader, Plus, Building2, MapPin } from 'lucide-react';
import * as surveillance from '../../services/surveillance.service';
import type { Department, Site } from '../../services/surveillance.service';

/**
 * Creating the departments and sites a camera can belong to.
 *
 * Both were read-only. The registry's filter dropdowns and the camera form
 * offered whichever rows `npm run seed:cameras` had written, and a deployment
 * that never ran that script had none — so a camera could not be filed under
 * anything, and an estate dispatch unit, which must belong to a department,
 * could not exist at all.
 *
 * Editing and deletion are deliberately absent for now: a department or site
 * that cameras and units already reference cannot be removed without deciding
 * what happens to them, and quietly detaching an estate's cameras is not a
 * decision this dialog should make on its own.
 */

interface Props {
  departments: Department[];
  sites: Site[];
  onClose: () => void;
  /** Called after a successful create so the registry can reload its lists. */
  onChanged: () => void;
}

const EstateStructureModal: React.FC<Props> = ({ departments, sites, onClose, onChanged }) => {
  const [dept, setDept] = useState({ code: '', name: '', contactName: '', contactPhone: '' });
  const [site, setSite] = useState({
    code: '',
    name: '',
    departmentId: '',
    address: '',
    latitude: '',
    longitude: '',
  });

  const [saving, setSaving] = useState<'department' | 'site' | null>(null);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [siteError, setSiteError] = useState<string | null>(null);

  const field =
    'w-full px-3 py-2.5 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-500 text-sm focus:border-ai-white focus:outline-none transition-colors';

  const saveDepartment = async () => {
    if (!dept.code.trim() || !dept.name.trim()) {
      setDeptError('A department needs a code and a name');
      return;
    }
    setSaving('department');
    setDeptError(null);
    try {
      await surveillance.createDepartment({
        code: dept.code.trim(),
        name: dept.name.trim(),
        contactName: dept.contactName.trim() || undefined,
        contactPhone: dept.contactPhone.trim() || undefined,
      });
      setDept({ code: '', name: '', contactName: '', contactPhone: '' });
      onChanged();
    } catch (error: any) {
      setDeptError(error?.message ?? 'The department could not be created');
    } finally {
      setSaving(null);
    }
  };

  const saveSite = async () => {
    if (!site.code.trim() || !site.name.trim()) {
      setSiteError('A site needs a code and a name');
      return;
    }
    // Both or neither, matching every other position in the product: half a
    // coordinate would place a pin somewhere nobody surveyed.
    const hasLat = site.latitude.trim() !== '';
    const hasLon = site.longitude.trim() !== '';
    if (hasLat !== hasLon) {
      setSiteError('A position needs both latitude and longitude, or neither');
      return;
    }

    setSaving('site');
    setSiteError(null);
    try {
      await surveillance.createSite({
        code: site.code.trim(),
        name: site.name.trim(),
        departmentId: site.departmentId || null,
        address: site.address.trim() || undefined,
        latitude: hasLat ? Number(site.latitude) : null,
        longitude: hasLon ? Number(site.longitude) : null,
      });
      setSite({ code: '', name: '', departmentId: '', address: '', latitude: '', longitude: '' });
      onChanged();
    } catch (error: any) {
      setSiteError(error?.message ?? 'The site could not be created');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-ai-gray-800 bg-ai-black"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-ai-gray-800 bg-ai-black">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-ai-white">Estate structure</h2>
            <p className="text-xs text-ai-gray-500">
              What cameras are filed under, and what response units belong to
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="icon-btn shrink-0 p-1 text-ai-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Departments */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-ai-white" />
              <h3 className="text-sm font-medium text-ai-white">
                Departments {departments.length > 0 && `(${departments.length})`}
              </h3>
            </div>

            <div className="rounded-xl border border-ai-gray-800 p-4 space-y-3">
              <input
                className={field}
                placeholder="Code (e.g. GNR-CITY)"
                value={dept.code}
                onChange={(e) => setDept({ ...dept, code: e.target.value })}
              />
              <input
                className={field}
                placeholder="Name"
                value={dept.name}
                onChange={(e) => setDept({ ...dept, name: e.target.value })}
              />
              <input
                className={field}
                placeholder="Contact name (optional)"
                value={dept.contactName}
                onChange={(e) => setDept({ ...dept, contactName: e.target.value })}
              />
              <input
                className={field}
                placeholder="Contact phone (optional)"
                value={dept.contactPhone}
                onChange={(e) => setDept({ ...dept, contactPhone: e.target.value })}
              />
              {deptError && <p className="text-sm text-red-400 break-anywhere">{deptError}</p>}
              <button
                onClick={saveDepartment}
                disabled={saving !== null}
                className="w-full px-4 py-2.5 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
              >
                {saving === 'department' ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add department
              </button>
            </div>

            {departments.length === 0 ? (
              <p className="text-sm text-ai-gray-500">
                None yet. Estate response units cannot exist without one.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {departments.map((department) => (
                  <li
                    key={department.id}
                    className="px-3 py-2 rounded-lg bg-ai-gray-800/40 text-sm text-ai-gray-300"
                  >
                    <span className="text-ai-gray-500">{department.code}</span> — {department.name}
                    <span className="text-xs text-ai-gray-600 block">
                      {department.cameraCount} camera(s) · {department.siteCount} site(s)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sites */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-ai-white" />
              <h3 className="text-sm font-medium text-ai-white">
                Sites {sites.length > 0 && `(${sites.length})`}
              </h3>
            </div>

            <div className="rounded-xl border border-ai-gray-800 p-4 space-y-3">
              <input
                className={field}
                placeholder="Code (e.g. GNR-STN-01)"
                value={site.code}
                onChange={(e) => setSite({ ...site, code: e.target.value })}
              />
              <input
                className={field}
                placeholder="Name"
                value={site.name}
                onChange={(e) => setSite({ ...site, name: e.target.value })}
              />
              <select
                className={field}
                value={site.departmentId}
                onChange={(e) => setSite({ ...site, departmentId: e.target.value })}
              >
                <option value="" className="bg-ai-black">
                  No department
                </option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id} className="bg-ai-black">
                    {department.code} — {department.name}
                  </option>
                ))}
              </select>
              <input
                className={field}
                placeholder="Address (optional)"
                value={site.address}
                onChange={(e) => setSite({ ...site, address: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className={field}
                  placeholder="Latitude"
                  value={site.latitude}
                  onChange={(e) => setSite({ ...site, latitude: e.target.value })}
                />
                <input
                  className={field}
                  placeholder="Longitude"
                  value={site.longitude}
                  onChange={(e) => setSite({ ...site, longitude: e.target.value })}
                />
              </div>
              {siteError && <p className="text-sm text-red-400 break-anywhere">{siteError}</p>}
              <button
                onClick={saveSite}
                disabled={saving !== null}
                className="w-full px-4 py-2.5 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
              >
                {saving === 'site' ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add site
              </button>
            </div>

            {sites.length === 0 ? (
              <p className="text-sm text-ai-gray-500">None yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {sites.map((row) => (
                  <li
                    key={row.id}
                    className="px-3 py-2 rounded-lg bg-ai-gray-800/40 text-sm text-ai-gray-300"
                  >
                    <span className="text-ai-gray-500">{row.code}</span> — {row.name}
                    <span className="text-xs text-ai-gray-600 block">
                      {row.cameraCount} camera(s)
                      {row.latitude === null ? ' · not surveyed' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default EstateStructureModal;
