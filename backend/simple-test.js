// Simple curl-based test
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

async function testEndpoint(name, endpoint, body) {
  console.log(`\n${colors.blue}🧪 Testing ${name}...${colors.reset}`);
  
  try {
    const command = `curl -s -X POST http://localhost:5000${endpoint} -H "Content-Type: application/json" -d "${body.replace(/"/g, '\\"')}"`;
    
    const { stdout, stderr } = await execAsync(command, { shell: 'powershell.exe' });
    
    if (stderr) {
      console.log(`${colors.red}❌ ${name} Test ERROR: ${stderr}${colors.reset}`);
      return;
    }
    
    const data = JSON.parse(stdout);
    
    if (data.success) {
      console.log(`${colors.green}✅ ${name} Test PASSED${colors.reset}`);
      console.log(`${colors.yellow}Response:${colors.reset}`, JSON.stringify(data, null, 2).substring(0, 200));
    } else {
      console.log(`${colors.red}❌ ${name} Test FAILED${colors.reset}`);
      console.log('Error:', data.error);
    }
  } catch (error) {
    console.log(`${colors.red}❌ ${name} Test ERROR: ${error.message}${colors.reset}`);
  }
}

async function runTests() {
  console.log(`\n${colors.green}═══════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}   🚀 Gemini AI Integration Test (Simple)${colors.reset}`);
  console.log(`${colors.green}═══════════════════════════════════════════════${colors.reset}`);
  
  // Test 1: AI Chat
  await testEndpoint(
    'AI Chat',
    '/api/ai/chat',
    JSON.stringify({
      messages: [{ role: 'user', content: 'What are key safety considerations for festivals?' }]
    })
  );
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Safety Planning
  await testEndpoint(
    'Safety Planning',
    '/api/ai/safety-planning',
    JSON.stringify({
      name: 'Test Festival',
      type: 'Music Festival',
      expectedAttendance: 5000,
      venue: 'Central Park'
    })
  );
  
  console.log(`\n${colors.green}═══════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}   ✨ Tests Complete!${colors.reset}`);
  console.log(`${colors.green}═══════════════════════════════════════════════${colors.reset}\n`);
}

runTests();
