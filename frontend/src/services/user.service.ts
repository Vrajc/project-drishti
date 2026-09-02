import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/users`;

export interface UserStats {
  total: number;
  /** Every role appears, so zero is distinguishable from "no such role". */
  byRole: { participant: number; organizer: number; admin: number; police: number };
  /** Organizers who have actually created an event, not just holders of the role. */
  activeOrganizers: number;
  eventCount: number;
  incidentCount: number;
}

function authHeaders() {
  const token = localStorage.getItem('drishti_token');
  if (!token) throw new Error('Authentication token not found. Sign in again.');
  return { Authorization: `Bearer ${token}` };
}

/** Admin only. Counts come from a GROUP BY over the users table. */
export const getUserStats = async (): Promise<UserStats> => {
  try {
    const response = await axios.get<{ success: boolean; data: UserStats }>(`${API_URL}/stats`, {
      headers: authHeaders(),
    });
    return response.data.data;
  } catch (error: any) {
    const message = error?.response?.data?.message || error?.message || 'Failed to load user statistics';
    throw new Error(message);
  }
};
