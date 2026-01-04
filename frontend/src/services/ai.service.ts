import axios, { InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SafetyAnalysis {
  recommendations: Array<{
    type: string;
    title: string;
    count: number;
    description: string;
    positions: string[];
    priority: string;
  }>;
  overallScore: number;
  keyInsights: string[];
}

export interface IncidentAnalysis {
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  analysis: string;
  recommendedActions: string[];
  estimatedResponseTime: string;
  resourcesNeeded: string[];
}

export interface CrowdFlowPrediction {
  predictions: Array<{
    zone: string;
    timeframe: string;
    severity: string;
    crowdLevel: number;
    description: string;
    recommendation: string;
  }>;
  overallStatus: string;
  immediateActions: string[];
}

export interface MonitoringAnalysis {
  overallAssessment: string;
  riskLevel: string;
  recommendations: string[];
  priorityActions: string[];
  trends: string;
  predictedIssues: string[];
}

// AI Chat
export const chatWithAI = async (messages: ChatMessage[], context?: string) => {
  try {
    const response = await api.post('/ai/chat', { messages, context });
    return response.data;
  } catch (error: any) {
    console.error('AI Chat Error:', error);
    throw new Error(error.response?.data?.message || 'Failed to chat with AI');
  }
};

// Safety Planning Analysis
export const analyzeSafetyPlanning = async (eventData: {
  name: string;
  type: string;
  expectedAttendance: number;
  venue: string;
  duration: string;
  zones?: string[];
}): Promise<{ success: boolean; analysis: SafetyAnalysis }> => {
  try {
    const response = await api.post('/ai/safety-planning', eventData);
    return response.data;
  } catch (error: any) {
    console.error('Safety Planning Error:', error);
    throw new Error(error.response?.data?.message || 'Failed to analyze safety planning');
  }
};

// Incident Analysis
export const analyzeIncident = async (incident: {
  type: string;
  location: string;
  description: string;
  context?: string;
}): Promise<{ success: boolean; analysis: IncidentAnalysis }> => {
  try {
    const response = await api.post('/ai/analyze-incident', incident);
    return response.data;
  } catch (error: any) {
    console.error('Incident Analysis Error:', error);
    throw new Error(error.response?.data?.message || 'Failed to analyze incident');
  }
};

// Crowd Flow Analysis
export const analyzeCrowdFlow = async (data: {
  zones: Array<{
    name: string;
    currentCapacity: number;
    maxCapacity: number;
    trend: string;
  }>;
  eventPhase: string;
  timeRemaining: string;
}): Promise<{ success: boolean; predictions: CrowdFlowPrediction }> => {
  try {
    const response = await api.post('/ai/crowd-flow', data);
    return response.data;
  } catch (error: any) {
    console.error('Crowd Flow Error:', error);
    throw new Error(error.response?.data?.message || 'Failed to analyze crowd flow');
  }
};

// Generate Event Report
export const generateEventReport = async (eventData: {
  name: string;
  date: string;
  duration: string;
  attendance: number;
  incidents: number;
  safetyScore: number;
  responseTime: number;
  zones?: string[];
}): Promise<{ success: boolean; report: string }> => {
  try {
    const response = await api.post('/ai/generate-report', eventData);
    return response.data;
  } catch (error: any) {
    console.error('Report Generation Error:', error);
    throw new Error(error.response?.data?.message || 'Failed to generate report');
  }
};

// Analyze Live Monitoring
export const analyzeMonitoring = async (data: {
  activeIncidents: number;
  crowdLevel: number;
  safetyStatus: string;
  recentIncidents?: Array<{ type: string; location: string }>;
}): Promise<{ success: boolean; analysis: MonitoringAnalysis }> => {
  try {
    const response = await api.post('/ai/analyze-monitoring', data);
    return response.data;
  } catch (error: any) {
    console.error('Monitoring Analysis Error:', error);
    throw new Error(error.response?.data?.message || 'Failed to analyze monitoring data');
  }
};

// Quick Query
export const quickQuery = async (query: string, eventContext?: any): Promise<{ success: boolean; response: string }> => {
  try {
    const response = await api.post('/ai/query', { query, eventContext });
    return response.data;
  } catch (error: any) {
    console.error('Quick Query Error:', error);
    throw new Error(error.response?.data?.message || 'Failed to process query');
  }
};

export default {
  chatWithAI,
  analyzeSafetyPlanning,
  analyzeIncident,
  analyzeCrowdFlow,
  generateEventReport,
  analyzeMonitoring,
  quickQuery,
};
