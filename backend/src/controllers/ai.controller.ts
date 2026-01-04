import { Request, Response } from 'express';
import {
  generateChatResponse,
  analyzeSafetyPlanning,
  detectAnomaly,
  predictCrowdFlow,
  generateSafetyReport,
  analyzeLiveMonitoring,
  ChatMessage
} from '../utils/openai.service';

/**
 * Handle AI chat interactions with live event context
 * Feature: AI Safety Assistant - Chatbot with real-time event awareness
 */
export const chatWithAI = async (req: Request, res: Response) => {
  try {
    const { messages, context, eventId, liveData } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Enhanced system context with live event information
    let systemContext = `You are an AI Safety Assistant for event management with real-time monitoring capabilities. 
    
Your capabilities include:
- Real-time event safety monitoring and analysis
- Crowd flow predictions and bottleneck detection
- Incident response recommendations
- Emergency protocol guidance
- Risk assessment and preventive measures
- Resource allocation optimization
- Historical data analysis and pattern recognition

Provide accurate, actionable, and concise advice focused on safety and security.`;

    // Add live event context if available
    if (context) {
      systemContext += `\n\nCurrent Event Context: ${context}`;
    }

    if (liveData) {
      systemContext += `\n\nLive Event Data:`;
      if (liveData.crowdLevel) systemContext += `\n- Crowd Level: ${liveData.crowdLevel}%`;
      if (liveData.activeIncidents !== undefined) systemContext += `\n- Active Incidents: ${liveData.activeIncidents}`;
      if (liveData.safetyStatus) systemContext += `\n- Safety Status: ${liveData.safetyStatus}`;
      if (liveData.attendance) systemContext += `\n- Current Attendance: ${liveData.attendance}`;
    }

    const systemMessage: ChatMessage = {
      role: 'system',
      content: systemContext
    };

    const aiMessages: ChatMessage[] = [systemMessage, ...messages];
    const response = await generateChatResponse(aiMessages, 0.7);

    res.json({
      success: true,
      message: response,
      timestamp: new Date(),
      contextUsed: !!(context || liveData)
    });
  } catch (error: any) {
    console.error('Chat AI Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI response',
      message: error.message
    });
  }
};

/**
 * Analyze event for safety planning
 */
export const analyzeEventSafety = async (req: Request, res: Response) => {
  try {
    const { name, type, expectedAttendance, venue, duration, zones } = req.body;

    console.log('📊 Analyzing event safety:', { name, type, expectedAttendance, venue });

    if (!name || !type || !expectedAttendance || !venue) {
      return res.status(400).json({
        error: 'Missing required fields: name, type, expectedAttendance, venue'
      });
    }

    const analysis = await analyzeSafetyPlanning({
      name,
      type,
      expectedAttendance: Number(expectedAttendance),
      venue,
      duration: duration || 'Not specified',
      zones: zones || []
    });

    console.log('✅ Analysis complete');

    res.json({
      success: true,
      analysis,
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('❌ Safety Analysis Error:', error);
    console.error('Error details:', error.message);
    if (error.response) {
      console.error('API Response Error:', error.response.data);
    }
    res.status(500).json({
      success: false,
      error: 'Failed to analyze event safety',
      message: error.message,
      details: error.response?.data || error.toString()
    });
  }
};

/**
 * Detect and analyze anomalies/incidents
 */
export const analyzeIncident = async (req: Request, res: Response) => {
  try {
    const { type, location, description, context } = req.body;

    if (!type || !location || !description) {
      return res.status(400).json({
        error: 'Missing required fields: type, location, description'
      });
    }

    const analysis = await detectAnomaly({
      type,
      location,
      description,
      context
    });

    res.json({
      success: true,
      analysis,
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('Incident Analysis Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze incident',
      message: error.message
    });
  }
};

/**
 * Predict crowd flow and bottlenecks
 */
export const analyzeCrowdFlow = async (req: Request, res: Response) => {
  try {
    const { currentLevel, timeOfDay, eventPhase, zones } = req.body;

    if (currentLevel === undefined) {
      return res.status(400).json({
        error: 'currentLevel is required'
      });
    }

    const predictions = await predictCrowdFlow({
      currentLevel: Number(currentLevel),
      timeOfDay: timeOfDay || new Date().toLocaleTimeString(),
      eventPhase: eventPhase || 'ongoing',
      zones: zones || []
    });

    res.json({
      success: true,
      predictions,
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('Crowd Flow Analysis Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze crowd flow',
      message: error.message
    });
  }
};

/**
 * Generate post-event report
 */
export const generateEventReport = async (req: Request, res: Response) => {
  try {
    const {
      name,
      date,
      attendance,
      incidents,
      safetyScore,
      responseTime,
      zones
    } = req.body;

    if (!name || !date) {
      return res.status(400).json({
        error: 'Missing required fields: name, date'
      });
    }

    const report = await generateSafetyReport({
      name,
      date,
      attendance: Number(attendance) || 0,
      incidents: Number(incidents) || 0,
      safetyScore: Number(safetyScore) || 0,
      responseTime: Number(responseTime) || 0,
      zones: zones || []
    });

    res.json({
      success: true,
      report,
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('Report Generation Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate event report',
      message: error.message
    });
  }
};

/**
 * Analyze live monitoring data
 */
export const analyzeMonitoring = async (req: Request, res: Response) => {
  try {
    const { activeIncidents, crowdLevel, safetyStatus, recentIncidents } = req.body;

    const analysis = await analyzeLiveMonitoring({
      activeIncidents: Number(activeIncidents) || 0,
      crowdLevel: Number(crowdLevel) || 0,
      safetyStatus: safetyStatus || 'UNKNOWN',
      recentIncidents: recentIncidents || []
    });

    res.json({
      success: true,
      analysis,
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('Monitoring Analysis Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze monitoring data',
      message: error.message
    });
  }
};

/**
 * Quick AI query for specific event insights
 */
export const quickQuery = async (req: Request, res: Response) => {
  try {
    const { query, eventContext } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an AI event safety expert. Provide concise, actionable insights. ${eventContext ? `Event context: ${JSON.stringify(eventContext)}` : ''}`
      },
      {
        role: 'user',
        content: query
      }
    ];

    const response = await generateChatResponse(messages, 0.5);

    res.json({
      success: true,
      response,
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('Quick Query Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      message: error.message
    });
  }
};
