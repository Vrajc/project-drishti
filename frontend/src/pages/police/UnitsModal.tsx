import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader, Trash2, AlertTriangle, Plus, Truck } from 'lucide-react';
import { dispatchService, type DispatchUnit } from '../../services/dispatch.service';
import * as surveillance from '../../services/surveillance.service';
import type { Department } from '../../services/surveillance.service';

/**
 * The estate's own responder units.
 *
 * The dispatch console could list units and change their status, but nothing
 * could create one: the only estate units that ever existed were the rows
 * `npm run seed:units` wrote. An operator opening the console on a real
 * deployment had nothing to send and no way to add anything, so the console's
 * entire purpose needed shell access to the server to unlock.
 *
 * An estate unit belongs to a department, because the database refuses a unit
 * with neither a department nor an event - such a row appears in no dispatch
 * list and could never be sent anywhere. If no department exists yet, this says
 * so rather than presenting an empty dropdown as a choice.
 */

interface Props {
  onClose: () => void;
  /** Called after any change, so the console can refresh what it can dispatch. */
  onChanged?: () => void;
}

const EMPTY = {
  unitId: '',
  name: '',
  type: 'ambulance',
  contact: '',
  capacity: '',
  location: '',
  departmentId: '',
  latitude: '',
  longitude: '',
};

const UNIT_TYPES = ['ambulance', 'fire-truck', 'police', 'medical-team', 'security-team'];

const UnitsModal: React.FC<Props> = ({ onClose, onChanged }) => {
  const [units, setUnits] = useState<DispatchUnit[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [unitRows, deptRows] = await Promise.all([
        dispatchService.getUnits({ scope: 'registry' }),
        surveillance.getDepartments(),
      ]);
      setUnits(unitRows);
      setDepartments(deptRows ?? []);
      setLoadError(null);
    } catch (error: any) {
      setUnits([]);
      setDepartments([]);
      setLoadError(error?.message ?? 'Units could not be read');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const save = async () => {
    const capacity = Number(form.capacity);
    if (!form.unitId.trim() || !form.name.trim() || !form.contact.trim() || !form.location.trim()) {
      setFormError('Identifier, name, contact and base location are all required');
      return;
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      setFormError('Capacity must be above zero');
      return;
    }
    if (!form.departmentId) {
      setFormError('Choose the department this unit belongs to');
      return;
    }
    // Both or neither: the nearest-unit ranking skips a unit with no position
    // rather than guessing one, and half a coordinate is not a position.
    const hasLat = form.latitude.trim() !== '';
    const hasLon = form.longitude.trim() !== '';
    if (hasLat !== hasLon) {
      setFormError('A base position needs both latitude and longitude, or neither');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await dispatchService.createUnit({
        unitId: form.unitId.trim(),
        name: form.name.trim(),
        type: form.type,
        contact: form.contact.trim(),
        capacity: Math.round(capacity),
        location: form.location.trim(),
        departmentId: form.departmentId,
        latitude: hasLat ? Number(form.latitude) : null,
        longitude: hasLon ? Number(form.longitude) : null,
      });
      setForm({ ...EMPTY });
      await load();
      onChanged?.();
    } catch (error: any) {
      setFormError(error?.message ?? 'The unit could not be saved');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (unit: DispatchUnit) => {
    setBusyId(unit.id);
    try {
      await dispatchService.deleteUnit(unit.id);
      await load();
      onChanged?.();
    } catch (error: any) {
      setLoadError(error?.message ?? 'The unit could not be removed');
    } finally {
      setBusyId(null);
    }
  };

  const field =
    'w-full px-3 py-2.5 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-500 text-sm focus:border-ai-white focus:outline-none transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-ai-gray-800 bg-ai-black"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-ai-gray-800 bg-ai-black">
          <div className="flex items-center gap-3 min-w-0">
            <Truck className="w-5 h-5 text-ai-white shrink-0" />
            <h2 className="text-lg sm:text-xl font-semibold text-ai-white truncate">
              Estate response units
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="icon-btn shrink-0 p-1 text-ai-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {loadError && (
            <div className="flex items-start gap-3 rounded-xl border border-red-500/40 p-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-ai-gray-300 break-anywhere">{loadError}</p>
            </div>
          )}

          {!loading && departments.length === 0 ? (
            <div className="rounded-xl border border-ai-gray-800 p-6 text-center">
              <p className="text-ai-white font-medium mb-1">No departments exist yet</p>
              <p className="text-sm text-ai-gray-400">
                An estate unit belongs to a department — a unit with neither a department nor an
                event appears in no dispatch list. Create one from the camera registry first.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-ai-gray-800 p-4 space-y-3">
              <h3 className="text-sm font-medium text-ai-white">Add a unit</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  className={field}
                  placeholder="Identifier (e.g. AMB-04)"
                  value={form.unitId}
                  onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                />
                <input
                  className={field}
                  placeholder="Name (e.g. Ambulance 4)"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <select
                  className={field}
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {UNIT_TYPES.map((type) => (
                    <option key={type} value={type} className="bg-ai-black">
                      {type}
                    </option>
                  ))}
                </select>
                <select
                  className={field}
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                >
                  <option value="" className="bg-ai-black">
                    Department…
                  </option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id} className="bg-ai-black">
                      {department.code} — {department.name}
                    </option>
                  ))}
                </select>
                <input
                  className={field}
                  placeholder="Contact number"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                />
                <input
                  className={field}
                  type="number"
                  min={1}
                  placeholder="Capacity"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                />
                <input
                  className={`${field} sm:col-span-2`}
                  placeholder="Base location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
                <input
                  className={field}
                  placeholder="Base latitude (optional)"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                />
                <input
                  className={field}
                  placeholder="Base longitude (optional)"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                />
              </div>

              <p className="text-xs text-ai-gray-500">
                A unit without a surveyed base is still dispatchable, but cannot be ranked by
                distance to an incident — the console lists it last and says why.
              </p>

              {formError && <p className="text-sm text-red-400 break-anywhere">{formError}</p>}

              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2.5 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors disabled:opacity-50 text-sm font-medium flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add unit
                  </>
                )}
              </button>
            </div>
          )}

          <div className="rounded-xl border border-ai-gray-800 p-4">
            <h3 className="text-sm font-medium text-ai-white mb-3">
              Estate units {units.length > 0 && `(${units.length})`}
            </h3>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-ai-gray-400">
                <Loader className="w-4 h-4 animate-spin" />
                Reading units…
              </div>
            ) : units.length === 0 ? (
              <p className="text-sm text-ai-gray-500">
                None yet. The dispatch console has nothing to send until a unit exists.
              </p>
            ) : (
              <ul className="space-y-2">
                {units.map((unit) => (
                  <li
                    key={unit.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-ai-gray-800/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-ai-gray-200 truncate">
                        {unit.name}{' '}
                        <span className="text-ai-gray-500">· {unit.unitId}</span>
                      </p>
                      <p className="text-xs text-ai-gray-500 truncate">
                        {unit.type} · capacity {unit.capacity} · {unit.location}
                        {unit.isLocated ? '' : ' · base not surveyed'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-ai-gray-400 capitalize">{unit.status}</span>
                      <button
                        onClick={() => remove(unit)}
                        disabled={busyId === unit.id}
                        aria-label={`Remove ${unit.name}`}
                        className="icon-btn p-1 text-ai-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        {busyId === unit.id ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {units.length > 0 && (
              <p className="text-xs text-ai-gray-600 mt-3">
                Removing a unit also removes the record of where it was sent.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default UnitsModal;
