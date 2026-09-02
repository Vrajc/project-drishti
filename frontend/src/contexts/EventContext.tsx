import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  getAllEvents as fetchAllEvents,
  registerForEvent as registerForEventAPI,
  deleteEvent as deleteEventAPI,
} from '../services/event.service';
import { persist } from '../utils/storage';

export interface Camera {
  id: string;
  name: string;
  location: string;
  ipAddress: string;
  rtspUrl: string;
}

// A zone as the API returns it. The context previously typed `zones` as `string[]`, which
// was true only for an event just created in this browser session: `refreshEvents()`
// replaces it with the Zone rows the server sends, so after any reload the pages that
// rendered `{zone}` directly threw "Objects are not valid as a React child". tsc could not
// see it because the API response is `any`.
export interface Zone {
  id: string;
  zoneId: string;
  name: string;
  coordinates: Array<{ x: number; y: number }>;
  maxCapacity: number;
  color?: string;
}

export interface DispatchUnit {
  id: string;
  name: string;
  type: string;
  contact: string;
  capacity: number;
  location: string;
}

// Exported so pages share one definition — AdminDashboard previously kept its
// own copy that had drifted out of sync with this one.
export interface Event {
  id: string;
  name: string;
  type: string;
  date: string;
  time: string;
  /** When it ends. Null on events created before the column existed. */
  endDate?: string | null;
  endTime?: string | null;
  crowdSize: number;
  zones: Zone[];
  cameras: Camera[];
  dispatchUnits: DispatchUnit[];
  location: string;
  mapFile: File | string | null;
  organizerId?: string;
  organizerEmail?: string;
  organizerName?: string;
  description?: string;
  image?: string;
  registeredUsers?: string[];
}

interface EventContextType {
  event: Event | null;
  events: Event[];
  setEvent: (event: Event) => void;
  addEvent: (event: Event) => void;
  clearEvent: () => void;
  deleteEvent: (eventId: string) => Promise<void>;
  getEventsByOrganizer: (organizerEmail: string) => Event[];
  getAllEvents: () => Event[];
  registerForEvent: (eventId: string, userId: string) => Promise<void>;
  getUserRegisteredEvents: (userId: string) => Event[];
  refreshEvents: () => Promise<void>;
}

// EventSetup collects zone names as plain strings, while the API returns Zone rows. Coerce
// both to Zone[] at the single point where events enter the context, so no page has to
// guess which shape it holds.
export const normaliseZones = (zones: unknown): Zone[] => {
  if (!Array.isArray(zones)) return [];

  return zones.map((zone: any, index: number) => {
    if (typeof zone === 'string') {
      return {
        id: '',
        zoneId: `zone-${index}`,
        name: zone,
        coordinates: [],
        maxCapacity: 0,
      };
    }

    return {
      id: zone?.id ?? '',
      zoneId: zone?.zoneId ?? `zone-${index}`,
      name: zone?.name ?? `Zone ${index + 1}`,
      coordinates: Array.isArray(zone?.coordinates) ? zone.coordinates : [],
      maxCapacity: typeof zone?.maxCapacity === 'number' ? zone.maxCapacity : 0,
      color: zone?.color,
    };
  });
};

const EventContext = createContext<EventContextType | undefined>(undefined);

export const useEvent = () => {
  const context = useContext(EventContext);
  if (context === undefined) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
};

interface EventProviderProps {
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Caching events in localStorage
//
// Events are cached so a reload paints something before the API answers. Two
// things about that went wrong at once.
//
// The cached copy included `mapFile`, which is a venue map stored as a base64
// data URL - megabytes per event, in a store with about five of them for the
// whole origin. A few events with maps filled it, and then every write threw
// QuotaExceededError.
//
// And the write was unguarded, in the same function that records a newly
// created event. So the throw happened *after* the server had already created
// the event, and the page reported "Error creating event" for an event that
// exists. A cache is an optimisation; the API is the source of truth. Failing
// to cache must never look like failing to do the thing.
// ---------------------------------------------------------------------------

/** Fields too large to cache. They are re-read from the API on the next load. */
const UNCACHED_FIELDS = ['mapFile', 'image'] as const;

const forCache = (value: any): any => {
  if (Array.isArray(value)) return value.map(forCache);
  if (!value || typeof value !== 'object') return value;

  const copy: any = { ...value };
  for (const field of UNCACHED_FIELDS) delete copy[field];
  return copy;
};

const writeCache = (key: string, value: unknown) => {
  // The result is deliberately ignored. Failing to cache is not failing to do
  // the thing the caller asked for, and `persist` leaves no stale entry behind.
  persist(key, JSON.stringify(forCache(value)));
};

export const EventProvider: React.FC<EventProviderProps> = ({ children }) => {
  const [event, setEventState] = useState<Event | null>(() => {
    const storedEvent = localStorage.getItem('drishti_current_event');
    if (storedEvent) {
      try {
        return JSON.parse(storedEvent);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [events, setEvents] = useState<Event[]>(() => {
    const storedEvents = localStorage.getItem('drishti_all_events');
    if (storedEvents) {
      try {
        return JSON.parse(storedEvents);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Fetch events from API on mount
  useEffect(() => {
    refreshEvents();
  }, []);

  const refreshEvents = async () => {
    try {
      const response = await fetchAllEvents();
      if (response.success && response.data) {
        const apiEvents = response.data.map((e: any) => ({
          id: e._id,
          name: e.name,
          type: e.type,
          date: e.date,
          time: e.time,
          endDate: e.endDate ?? null,
          endTime: e.endTime ?? null,
          crowdSize: e.crowdSize,
          zones: normaliseZones(e.zones),
          cameras: e.cameras,
          dispatchUnits: e.dispatchUnits,
          location: e.location,
          mapFile: e.mapFile || null,
          organizerId: e.organizerId,
          organizerEmail: e.organizerEmail,
          organizerName: e.organizerName,
          description: e.description,
          image: e.image,
          registeredUsers: e.registeredUsers || []
        }));
        setEvents(apiEvents);
        writeCache('drishti_all_events', apiEvents);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      // Continue with localStorage data if API fails
    }
  };

  const setEvent = (newEvent: Event) => {
    setEventState(newEvent);
    writeCache('drishti_current_event', newEvent);
  };

  const addEvent = (newEvent: Event) => {
    const updatedEvents = [...events, newEvent];
    setEvents(updatedEvents);
    setEventState(newEvent);
    writeCache('drishti_all_events', updatedEvents);
    writeCache('drishti_current_event', newEvent);
  };

  const clearEvent = () => {
    setEventState(null);
    localStorage.removeItem('drishti_current_event');
  };

  // This only ever edited localStorage, so an admin "deleting" an event saw the row vanish
  // while it stayed in Postgres and returned on the next refresh. It now calls the API and
  // only drops the row locally once the server has actually deleted it; failures propagate
  // to the caller so the UI can say the delete did not happen.
  const deleteEvent = async (eventId: string) => {
    await deleteEventAPI(eventId);

    const updatedEvents = events.filter(e => e.id !== eventId);
    setEvents(updatedEvents);
    writeCache('drishti_all_events', updatedEvents);

    // If the deleted event was the current event, clear it
    if (event?.id === eventId) {
      clearEvent();
    }
  };

  const getEventsByOrganizer = (organizerEmail: string): Event[] => {
    return events.filter(e => e.organizerEmail === organizerEmail);
  };

  const getAllEvents = (): Event[] => {
    return events;
  };

  const registerForEvent = async (eventId: string, userId: string) => {
    // The previous version caught a failed registration and added the user to
    // registeredUsers anyway, so the UI showed "Registered" for someone the server had
    // rejected — and persisted that lie to localStorage. A failure now propagates to the
    // caller, which surfaces it, and local state only changes once the server has agreed.
    await registerForEventAPI(eventId, userId);

    const updatedEvents = events.map(e => {
      if (e.id === eventId) {
        const registeredUsers = e.registeredUsers || [];
        if (!registeredUsers.includes(userId)) {
          return { ...e, registeredUsers: [...registeredUsers, userId] };
        }
      }
      return e;
    });
    setEvents(updatedEvents);
    writeCache('drishti_all_events', updatedEvents);

    // Refresh events from server to ensure consistency
    await refreshEvents();
  };

  const getUserRegisteredEvents = (userId: string): Event[] => {
    return events.filter(e => e.registeredUsers?.includes(userId));
  };

  const value: EventContextType = {
    event,
    events,
    setEvent,
    addEvent,
    clearEvent,
    deleteEvent,
    getEventsByOrganizer,
    getAllEvents,
    registerForEvent,
    getUserRegisteredEvents,
    refreshEvents
  };

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
};