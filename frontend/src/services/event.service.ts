import axios from 'axios';

const API_URL = 'http://localhost:5000/api/events';

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export interface CreateEventData {
  name: string;
  type: string;
  date: string;
  time: string;
  crowdSize: number;
  zones: string[];
  cameras: Array<{
    id: string;
    name: string;
    location: string;
    ipAddress: string;
    rtspUrl: string;
  }>;
  dispatchUnits: Array<{
    id: string;
    name: string;
    type: string;
    contact: string;
    capacity: number;
    location: string;
  }>;
  location: string;
  description?: string;
  mapFile?: File | null;
  organizerId: string;
  organizerEmail: string;
  organizerName: string;
  image?: string;
}

export const createEvent = async (eventData: CreateEventData) => {
  try {
    const token = localStorage.getItem('drishti_token');
    if (!token) {
      throw new Error('Authentication token not found');
    }

    // Convert map file to base64 if provided
    let mapFileBase64 = '';
    if (eventData.mapFile) {
      mapFileBase64 = await fileToBase64(eventData.mapFile);
    }

    // Remove the File object and add base64 string
    const { mapFile, ...restData } = eventData;

    const response = await axios.post(
      API_URL,
      {
        ...restData,
        mapFileBase64
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Create event error:', error);
    throw error.response?.data || error;
  }
};

export const getAllEvents = async () => {
  try {
    const response = await axios.get(API_URL);
    return response.data;
  } catch (error: any) {
    console.error('Get all events error:', error);
    throw error.response?.data || error;
  }
};

export const getEventsByOrganizer = async (organizerEmail: string) => {
  try {
    const response = await axios.get(`${API_URL}/organizer/${organizerEmail}`);
    return response.data;
  } catch (error: any) {
    console.error('Get events by organizer error:', error);
    throw error.response?.data || error;
  }
};

export const getEventById = async (id: string) => {
  try {
    const response = await axios.get(`${API_URL}/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('Get event by ID error:', error);
    throw error.response?.data || error;
  }
};

export const updateEvent = async (id: string, eventData: Partial<CreateEventData>) => {
  try {
    const token = localStorage.getItem('drishti_token');
    if (!token) {
      throw new Error('Authentication token not found');
    }

    // Convert map file to base64 if provided
    let mapFileBase64 = '';
    if (eventData.mapFile) {
      mapFileBase64 = await fileToBase64(eventData.mapFile);
    }

    // Remove the File object and add base64 string
    const { mapFile, ...restData } = eventData;

    const response = await axios.put(
      `${API_URL}/${id}`,
      {
        ...restData,
        ...(mapFileBase64 && { mapFileBase64 })
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Update event error:', error);
    throw error.response?.data || error;
  }
};

export const deleteEvent = async (id: string) => {
  try {
    const token = localStorage.getItem('drishti_token');
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.delete(`${API_URL}/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return response.data;
  } catch (error: any) {
    console.error('Delete event error:', error);
    throw error.response?.data || error;
  }
};

export const registerForEvent = async (eventId: string, userId: string) => {
  try {
    const token = localStorage.getItem('drishti_token');
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.post(
      `${API_URL}/${eventId}/register`,
      { userId },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Register for event error:', error);
    throw error.response?.data || error;
  }
};
