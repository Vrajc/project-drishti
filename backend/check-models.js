// Quick script to list available Gemini models
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listAvailableModels() {
  try {
    console.log('🔍 Checking available Gemini models...\n');
    
    // Try different model names
    const modelsToTry = [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro',
      'gemini-1.0-pro',
      'gemini-flash',
      'models/gemini-1.5-flash',
      'models/gemini-1.5-pro',
      'models/gemini-pro'
    ];

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say "test successful"');
        const response = await result.response;
        console.log(`✅ ${modelName}: WORKS!`);
        console.log(`   Response: ${response.text()}\n`);
        break; // Stop at first working model
      } catch (error) {
        console.log(`❌ ${modelName}: ${error.message.substring(0, 100)}`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listAvailableModels();
