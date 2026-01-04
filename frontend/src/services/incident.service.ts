import axios from 'axios';

const API_URL = 'http://localhost:5000/api/incidents';

const getAuthHeaders = () => {
  const token = localStorage.getItem('drishti_token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

export interface IncidentData {
  eventId: string;
  type: 'medical' | 'security' | 'lost_found' | 'general';
  description: string;
  location: string;
  reporter: string;
  reporterEmail?: string;
}

export interface Incident extends IncidentData {
  _id: string;
  timestamp: Date;
  status: 'open' | 'investigating' | 'resolved';
  responseTime?: number;
  resolvedAt?: Date;
}

export const incidentService = {
  // Create a new incident
  async createIncident(incidentData: IncidentData): Promise<Incident> {
    const response = await axios.post(API_URL, incidentData, {
      headers: getAuthHeaders(),
    });
    return response.data.data;
  },

  // Get incidents by event ID
  async getIncidentsByEvent(eventId: string, status?: string): Promise<Incident[]> {
    const params = status ? { status } : {};
    const response = await axios.get(`${API_URL}/event/${eventId}`, {
      headers: getAuthHeaders(),
      params,
    });
    return response.data.data;
  },

  // Update incident status
  async updateIncidentStatus(incidentId: string, status: 'open' | 'investigating' | 'resolved'): Promise<Incident> {
    const response = await axios.put(
      `${API_URL}/${incidentId}/status`,
      { status },
      { headers: getAuthHeaders() }
    );
    return response.data.data;
  },

  // Get all incidents (admin)
  async getAllIncidents(): Promise<Incident[]> {
    const response = await axios.get(API_URL, {
      headers: getAuthHeaders(),
    });
    return response.data.data;
  },

  // Delete incident (admin)
  async deleteIncident(incidentId: string): Promise<void> {
    await axios.delete(`${API_URL}/${incidentId}`, {
      headers: getAuthHeaders(),
    });
  },
};
