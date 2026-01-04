// Test Gemini API directly with HTTP request
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

async function testGeminiAPI() {
  console.log('🔑 API Key:', API_KEY ? `${API_KEY.substring(0, 20)}...` : 'MISSING');
  console.log('\n🧪 Testing Gemini API with direct HTTP request...\n');

  const models = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-pro',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Say "test successful"' }]
          }]
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${model}: WORKS!`);
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(`   Response: ${text}\n`);
        return model; // Return first working model
      } else {
        console.log(`❌ ${model}: ${data.error?.message || 'Failed'}`);
      }
    } catch (error) {
      console.log(`❌ ${model}: ${error.message}`);
    }
  }
  
  console.log('\n⚠️  No models worked. Please check:');
  console.log('1. API key is correct');
  console.log('2. API key has Generative Language API enabled');
  console.log('3. Visit: https://aistudio.google.com/app/apikey');
}

testGeminiAPI();
