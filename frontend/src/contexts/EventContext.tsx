import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAllEvents as fetchAllEvents, getEventsByOrganizer as fetchEventsByOrganizer, registerForEvent as registerForEventAPI } from '../services/event.service';

interface Camera {
  id: string;
  name: string;
  location: string;
  ipAddress: string;
  rtspUrl: string;
}

interface DispatchUnit {
  id: string;
  name: string;
  type: string;
  contact: string;
  capacity: number;
  location: string;
}

interface Event {
  id: string;
  name: string;
  type: string;
  date: string;
  time: string;
  crowdSize: number;
  zones: string[];
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
  deleteEvent: (eventId: string) => void;
  getEventsByOrganizer: (organizerEmail: string) => Event[];
  getAllEvents: () => Event[];
  registerForEvent: (eventId: string, userId: string) => Promise<void>;
  getUserRegisteredEvents: (userId: string) => Event[];
  refreshEvents: () => Promise<void>;
}

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
          crowdSize: e.crowdSize,
          zones: e.zones,
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
        localStorage.setItem('drishti_all_events', JSON.stringify(apiEvents));
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      // Continue with localStorage data if API fails
    }
  };

  const setEvent = (newEvent: Event) => {
    setEventState(newEvent);
    localStorage.setItem('drishti_current_event', JSON.stringify(newEvent));
  };

  const addEvent = (newEvent: Event) => {
    const updatedEvents = [...events, newEvent];
    setEvents(updatedEvents);
    setEventState(newEvent);
    localStorage.setItem('drishti_all_events', JSON.stringify(updatedEvents));
    localStorage.setItem('drishti_current_event', JSON.stringify(newEvent));
  };

  const clearEvent = () => {
    setEventState(null);
    localStorage.removeItem('drishti_current_event');
  };

  const deleteEvent = (eventId: string) => {
    const updatedEvents = events.filter(e => e.id !== eventId);
    setEvents(updatedEvents);
    localStorage.setItem('drishti_all_events', JSON.stringify(updatedEvents));
    
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
    try {
      // Call the API to register
      await registerForEventAPI(eventId, userId);
      
      // Update local state
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
      localStorage.setItem('drishti_all_events', JSON.stringify(updatedEvents));
      
      // Refresh events from server to ensure consistency
      await refreshEvents();
    } catch (error) {
      console.error('Error registering for event:', error);
      // If API call fails, still update local state as fallback
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
      localStorage.setItem('drishti_all_events', JSON.stringify(updatedEvents));
    }
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