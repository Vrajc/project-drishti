// Simple test file to verify OpenAI setup
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

async function testOpenAI() {
  try {
    console.log('Testing OpenAI API connection...');
    console.log('API Key present:', !!process.env.OPENAI_API_KEY);
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant.'
        },
        {
          role: 'user',
          content: 'Say "OpenAI integration working!" if you can read this.'
        }
      ],
      max_tokens: 50
    });

    console.log('✅ OpenAI Response:', completion.choices[0]?.message?.content);
    console.log('✅ OpenAI integration is working correctly!');
  } catch (error: any) {
    console.error('❌ OpenAI Error:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
  }
}

testOpenAI();
