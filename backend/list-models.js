// List all available models
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

async function listAllModels() {
  console.log('📋 Listing all available Gemini models...\n');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok && data.models) {
      console.log(`✅ Found ${data.models.length} models:\n`);
      
      data.models.forEach((model, index) => {
        console.log(`${index + 1}. ${model.name}`);
        console.log(`   Display Name: ${model.displayName}`);
        console.log(`   Supported Methods: ${model.supportedGenerationMethods?.join(', ')}`);
        console.log('');
      });
      
      // Find models that support generateContent
      const contentModels = data.models.filter(m => 
        m.supportedGenerationMethods?.includes('generateContent')
      );
      
      console.log(`\n✨ Models that support generateContent (${contentModels.length}):`);
      contentModels.forEach(m => {
        console.log(`   - ${m.name.replace('models/', '')}`);
      });
      
    } else {
      console.log('❌ Error:', data.error?.message || 'Failed to fetch models');
      console.log('\n💡 Tips:');
      console.log('1. Check if API key is valid');
      console.log('2. Enable "Generative Language API" in Google Cloud Console');
      console.log('3. Get a new key from: https://aistudio.google.com/app/apikey');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

listAllModels();
