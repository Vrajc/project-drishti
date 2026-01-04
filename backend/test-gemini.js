/**
 * Test script to verify Gemini AI integration
 * Run with: node test-gemini.js
 */

const API_URL = 'http://localhost:5000';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

async function testAIChat() {
  console.log(`\n${colors.blue}🧪 Testing AI Chat...${colors.reset}`);
  
  try {
    const response = await fetch(`${API_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'What are the key safety considerations for a large outdoor music festival?' }
        ],
        context: 'Event safety planning'
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`${colors.green}✅ AI Chat Test PASSED${colors.reset}`);
      console.log(`${colors.yellow}Response Preview:${colors.reset} ${data.message.substring(0, 200)}...`);
    } else {
      console.log(`${colors.red}❌ AI Chat Test FAILED${colors.reset}`);
      console.log('Error:', data.error);
    }
  } catch (error) {
    console.log(`${colors.red}❌ AI Chat Test ERROR: ${error.message}${colors.reset}`);
  }
}

async function testSafetyAnalysis() {
  console.log(`\n${colors.blue}🧪 Testing Safety Analysis...${colors.reset}`);
  
  try {
    const response = await fetch(`${API_URL}/api/ai/safety-planning`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Summer Music Festival 2026',
        type: 'Music Festival',
        expectedAttendance: 5000,
        venue: 'Central Park Arena',
        duration: '8 hours',
        zones: ['Main Stage', 'Food Court', 'VIP Area', 'Entrance']
      })
    });

    const data = await response.json();
    
    if (data.success && data.analysis) {
      console.log(`${colors.green}✅ Safety Analysis Test PASSED${colors.reset}`);
      console.log(`${colors.yellow}Overall Safety Score:${colors.reset} ${data.analysis.overallScore}/100`);
      console.log(`${colors.yellow}Recommendations Count:${colors.reset} ${data.analysis.recommendations?.length || 0}`);
    } else {
      console.log(`${colors.red}❌ Safety Analysis Test FAILED${colors.reset}`);
      console.log('Error:', data.error);
    }
  } catch (error) {
    console.log(`${colors.red}❌ Safety Analysis Test ERROR: ${error.message}${colors.reset}`);
  }
}

async function testAnomalyDetection() {
  console.log(`\n${colors.blue}🧪 Testing Anomaly Detection...${colors.reset}`);
  
  try {
    const response = await fetch(`${API_URL}/api/ai/analyze-incident`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'crowd_surge',
        location: 'Main Stage Area',
        description: 'Large crowd surge detected near the main stage. People are pushing forward rapidly.',
        context: 'Concert peak time'
      })
    });

    const data = await response.json();
    
    if (data.success && data.analysis) {
      console.log(`${colors.green}✅ Anomaly Detection Test PASSED${colors.reset}`);
      console.log(`${colors.yellow}Severity:${colors.reset} ${data.analysis.severity}`);
      console.log(`${colors.yellow}Category:${colors.reset} ${data.analysis.category}`);
      console.log(`${colors.yellow}Confidence:${colors.reset} ${(data.analysis.confidence * 100).toFixed(0)}%`);
    } else {
      console.log(`${colors.red}❌ Anomaly Detection Test FAILED${colors.reset}`);
      console.log('Error:', data.error);
    }
  } catch (error) {
    console.log(`${colors.red}❌ Anomaly Detection Test ERROR: ${error.message}${colors.reset}`);
  }
}

async function testCrowdFlowPrediction() {
  console.log(`\n${colors.blue}🧪 Testing Crowd Flow Prediction...${colors.reset}`);
  
  try {
    const response = await fetch(`${API_URL}/api/ai/crowd-flow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentLevel: 75,
        timeOfDay: '20:00',
        eventPhase: 'Main Performance',
        zones: [
          { name: 'Main Stage', occupancy: 85 },
          { name: 'Food Court', occupancy: 60 },
          { name: 'VIP Area', occupancy: 40 }
        ]
      })
    });

    const data = await response.json();
    
    if (data.success && data.prediction) {
      console.log(`${colors.green}✅ Crowd Flow Prediction Test PASSED${colors.reset}`);
      console.log(`${colors.yellow}Predicted Level:${colors.reset} ${data.prediction.predictedLevel}%`);
      console.log(`${colors.yellow}Trend:${colors.reset} ${data.prediction.trend}`);
      console.log(`${colors.yellow}Risk Level:${colors.reset} ${data.prediction.riskLevel}`);
    } else {
      console.log(`${colors.red}❌ Crowd Flow Prediction Test FAILED${colors.reset}`);
      console.log('Error:', data.error);
    }
  } catch (error) {
    console.log(`${colors.red}❌ Crowd Flow Prediction Test ERROR: ${error.message}${colors.reset}`);
  }
}

async function runAllTests() {
  console.log(`\n${colors.green}═══════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}   🚀 Gemini AI Integration Test Suite${colors.reset}`);
  console.log(`${colors.green}═══════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.yellow}Testing against: ${API_URL}${colors.reset}`);
  
  await testAIChat();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between tests
  
  await testSafetyAnalysis();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testAnomalyDetection();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testCrowdFlowPrediction();
  
  console.log(`\n${colors.green}═══════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}   ✨ All Tests Complete!${colors.reset}`);
  console.log(`${colors.green}═══════════════════════════════════════════════${colors.reset}\n`);
}

// Run tests
runAllTests().catch(error => {
  console.error(`${colors.red}Fatal Error: ${error.message}${colors.reset}`);
  process.exit(1);
});
