/**
 * Comprehensive Test Suite for All AI Features
 * Tests real Gemini API integration for all event safety features
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

console.log('\n🤖 ═══════════════════════════════════════════════════════');
console.log('   DRISHTI AI FEATURES TEST SUITE');
console.log('   Testing Real Gemini API Integration');
console.log('═══════════════════════════════════════════════════════\n');

// Test 1: AI Safety Planning
async function testSafetyPlanning() {
  console.log('📊 TEST 1: AI Safety Planning Analysis');
  console.log('─────────────────────────────────────────────────────\n');
  
  try {
    const prompt = `You are an expert AI safety analyst. Analyze this event:

EVENT DETAILS:
- Name: Summer Music Festival 2026
- Type: Outdoor Concert
- Expected Attendance: 15000 people
- Venue: City Central Park
- Duration: 8 hours

Provide safety recommendations in JSON format with:
- Emergency exits (count and positions)
- Security cameras (count and positions)
- Medical posts (count and positions)
- Crowd control barriers
- Overall safety score

Respond with ONLY valid JSON.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Response received:');
    console.log(text.substring(0, 500) + '...\n');
    
    // Try to parse JSON
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ JSON parsed successfully');
      console.log(`   Recommendations: ${parsed.recommendations?.length || 'N/A'}`);
      console.log(`   Safety Score: ${parsed.overallScore || 'N/A'}\n`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message, '\n');
    return false;
  }
}

// Test 2: Crowd Flow Analysis
async function testCrowdFlowAnalysis() {
  console.log('👥 TEST 2: Crowd Flow Prediction & Monitoring');
  console.log('─────────────────────────────────────────────────────\n');
  
  try {
    const prompt = `Analyze crowd flow and predict patterns:

CURRENT STATE:
- Crowd Level: 65%
- Time: 19:30
- Event Phase: ongoing
- Zone Occupancy:
  Main Stage: 85%
  Food Court: 72%
  VIP Area: 45%

Predict future crowd levels, identify bottlenecks, and provide recommendations in JSON format.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Response received:');
    console.log(text.substring(0, 500) + '...\n');
    
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ JSON parsed successfully');
      console.log(`   Predicted Level: ${parsed.predictedLevel || parsed.predictions?.next15min || 'N/A'}%`);
      console.log(`   Trend: ${parsed.trend || 'N/A'}`);
      console.log(`   Bottlenecks: ${parsed.bottleneckZones?.length || 'N/A'}\n`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message, '\n');
    return false;
  }
}

// Test 3: Anomaly Detection
async function testAnomalyDetection() {
  console.log('🚨 TEST 3: Anomaly Detection & Incident Analysis');
  console.log('─────────────────────────────────────────────────────\n');
  
  try {
    const prompt = `Analyze this incident with AI prediction:

INCIDENT:
- Type: Crowd surge
- Location: Main Stage Front
- Description: Sudden movement of 200+ people towards stage barrier
- Context: Headline performer announced surprise guest

Assess severity, predict escalation, and recommend actions in JSON format.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Response received:');
    console.log(text.substring(0, 500) + '...\n');
    
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ JSON parsed successfully');
      console.log(`   Severity: ${parsed.severity || 'N/A'}`);
      console.log(`   Category: ${parsed.category || 'N/A'}`);
      console.log(`   Confidence: ${parsed.confidence || 'N/A'}`);
      console.log(`   Actions: ${parsed.recommendedActions?.length || 'N/A'}\n`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message, '\n');
    return false;
  }
}

// Test 4: AI Safety Assistant Chatbot
async function testSafetyAssistant() {
  console.log('💬 TEST 4: AI Safety Assistant Chatbot');
  console.log('─────────────────────────────────────────────────────\n');
  
  try {
    const prompt = `You are an AI Safety Assistant with live event awareness.

Event Context:
- Current Crowd Level: 78%
- Active Incidents: 2
- Safety Status: YELLOW (Caution)
- Current Attendance: 12,500

User Question: "What should I do about the crowd buildup near the main stage?"

Provide a helpful, actionable response.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Response received:');
    console.log(text);
    console.log('');
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message, '\n');
    return false;
  }
}

// Test 5: Post-Event Report Generation
async function testPostEventReport() {
  console.log('📄 TEST 5: Post-Event Report Auto-Generation');
  console.log('─────────────────────────────────────────────────────\n');
  
  try {
    const prompt = `Generate a comprehensive post-event safety report:

EVENT:
- Name: Summer Music Festival 2026
- Date: 2026-01-01
- Attendance: 14,800
- Incidents: 7
- Safety Score: 87/100
- Response Time: 3.2 minutes

Generate a professional report with executive summary, incident analysis, and recommendations.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Response received:');
    console.log(text.substring(0, 800) + '...\n');
    console.log(`✅ Report length: ${text.length} characters\n`);
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message, '\n');
    return false;
  }
}

// Test 6: Live Monitoring Analysis
async function testLiveMonitoring() {
  console.log('📡 TEST 6: Live Monitoring Analysis');
  console.log('─────────────────────────────────────────────────────\n');
  
  try {
    const prompt = `Analyze live monitoring data:

STATUS:
- Active Incidents: 3
- Crowd Level: 82%
- Safety Status: YELLOW
- Recent Incidents:
  - Medical emergency at VIP Area
  - Crowd surge at Main Stage
  - Lost child reported at Gate 2

Provide real-time insights, alerts, and recommendations in JSON format.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Response received:');
    console.log(text.substring(0, 500) + '...\n');
    
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ JSON parsed successfully');
      console.log(`   Overall Status: ${parsed.overallStatus || 'N/A'}`);
      console.log(`   Risk Level: ${parsed.riskLevel || 'N/A'}`);
      console.log(`   Alerts: ${parsed.alerts?.length || 'N/A'}\n`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message, '\n');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  const results = {
    safetyPlanning: false,
    crowdFlow: false,
    anomalyDetection: false,
    safetyAssistant: false,
    postEventReport: false,
    liveMonitoring: false
  };

  results.safetyPlanning = await testSafetyPlanning();
  await delay(2000);
  
  results.crowdFlow = await testCrowdFlowAnalysis();
  await delay(2000);
  
  results.anomalyDetection = await testAnomalyDetection();
  await delay(2000);
  
  results.safetyAssistant = await testSafetyAssistant();
  await delay(2000);
  
  results.postEventReport = await testPostEventReport();
  await delay(2000);
  
  results.liveMonitoring = await testLiveMonitoring();

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   TEST RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const tests = [
    { name: 'AI Safety Planning', passed: results.safetyPlanning },
    { name: 'Crowd Flow Analysis', passed: results.crowdFlow },
    { name: 'Anomaly Detection', passed: results.anomalyDetection },
    { name: 'AI Safety Assistant', passed: results.safetyAssistant },
    { name: 'Post-Event Report', passed: results.postEventReport },
    { name: 'Live Monitoring', passed: results.liveMonitoring }
  ];

  tests.forEach(test => {
    const status = test.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${status}  ${test.name}`);
  });

  const passedCount = tests.filter(t => t.passed).length;
  const totalCount = tests.length;

  console.log('\n─────────────────────────────────────────────────────');
  console.log(`Overall: ${passedCount}/${totalCount} tests passed`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (passedCount === totalCount) {
    console.log('🎉 All AI features are working with real Gemini API!\n');
  } else {
    console.log('⚠️  Some tests failed. Check your API key and network.\n');
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Execute tests
runAllTests().catch(console.error);
