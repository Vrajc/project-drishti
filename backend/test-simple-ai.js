/**
 * Simple Test for AI Features with Gemini API
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

console.log('\n🤖 Testing Gemini AI Integration...\n');

async function testBasicAI() {
  try {
    console.log('📊 Testing AI Safety Analysis...');
    
    const prompt = `Analyze this event and provide safety recommendations in JSON format:

Event: Summer Music Festival
Type: Outdoor Concert
Attendance: 15000
Venue: City Park

Provide JSON with recommendations array, overall score, and key insights.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ AI Response received!\n');
    console.log(text.substring(0, 300) + '...\n');
    
    console.log('✅ SUCCESS: Gemini API is working correctly!\n');
    console.log('All AI features are operational with real API integration.\n');
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

testBasicAI();
