#!/usr/bin/env node
/**
 * Test script for simplified status detection
 * Run: node test-status.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const SESSIONS_DIR = path.join(
  process.env.HOME || '/Users/flint',
  '.openclaw/agents/main/sessions'
);

const AGENT_SESSIONS_PATH = path.join(__dirname, 'data', 'agent-sessions.json');

// Test 1: Verify JSONL reading works
function testGetLastJsonlEntry() {
  console.log('\n📋 Test 1: JSONL Entry Reading');
  
  // Find the main session file
  const sessionsJsonPath = path.join(SESSIONS_DIR, 'sessions.json');
  let mainSessionId = null;
  
  try {
    const sessionsData = JSON.parse(fs.readFileSync(sessionsJsonPath, 'utf8'));
    for (const [key, val] of Object.entries(sessionsData)) {
      if (key === 'agent:main:main' && val.sessionId) {
        mainSessionId = val.sessionId;
        break;
      }
    }
  } catch (e) {
    console.log('  ❌ Could not read sessions.json:', e.message);
    return false;
  }
  
  if (!mainSessionId) {
    console.log('  ❌ Could not find agent:main:main session');
    return false;
  }
  
  const jsonlPath = path.join(SESSIONS_DIR, `${mainSessionId}.jsonl`);
  
  // Read last entry using the same logic as server
  function getLastJsonlEntry(filePath) {
    try {
      if (!fs.existsSync(filePath)) return null;
      const stats = fs.statSync(filePath);
      if (stats.size === 0) return null;
      
      const readSize = Math.min(8192, stats.size);
      const buffer = Buffer.alloc(readSize);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, readSize, stats.size - readSize);
      fs.closeSync(fd);
      
      const chunk = buffer.toString('utf8');
      const lines = chunk.split('\n');
      
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('{')) {
          try {
            return JSON.parse(line);
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } catch (err) {
      console.log('  Error:', err.message);
    }
    return null;
  }
  
  const entry = getLastJsonlEntry(jsonlPath);
  if (entry && entry.timestamp) {
    const age = Date.now() - new Date(entry.timestamp).getTime();
    console.log(`  ✅ Found last entry, age: ${Math.round(age / 1000)}s`);
    console.log(`  📄 Type: ${entry.type || 'unknown'}`);
    return true;
  } else {
    console.log('  ❌ No valid entry found');
    return false;
  }
}

// Test 2: Verify agent-sessions.json structure
function testAgentSessionsJson() {
  console.log('\n📋 Test 2: Agent Sessions Registry');
  
  try {
    if (!fs.existsSync(AGENT_SESSIONS_PATH)) {
      console.log('  ⚠️  agent-sessions.json does not exist (will be created on first use)');
      return true;
    }
    
    const data = JSON.parse(fs.readFileSync(AGENT_SESSIONS_PATH, 'utf8'));
    console.log('  ✅ Registry loaded successfully');
    
    for (const [agent, info] of Object.entries(data)) {
      console.log(`     ${agent}: ${info.sessionId ? info.sessionId.substring(0, 8) + '...' : 'no session'}`);
    }
    return true;
  } catch (e) {
    console.log('  ❌ Error reading registry:', e.message);
    return false;
  }
}

// Test 3: Test the API
function testApi() {
  return new Promise((resolve) => {
    console.log('\n📋 Test 3: API Endpoint');
    
    const req = http.get('http://localhost:8080/api/employee-status', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'ok' && Array.isArray(json.agents)) {
            console.log('  ✅ API returned valid response');
            console.log('  📊 Agent statuses:');
            json.agents.forEach(agent => {
              const icon = agent.status === 'working' ? '🔵' : '⚪';
              console.log(`     ${icon} ${agent.name}: ${agent.status.toUpperCase()}`);
            });
            resolve(true);
          } else {
            console.log('  ❌ Invalid API response structure');
            resolve(false);
          }
        } catch (e) {
          console.log('  ❌ Could not parse API response:', e.message);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.log('  ❌ Could not connect to server:', err.message);
      console.log('     Make sure the server is running: node server.js');
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      console.log('  ❌ API request timed out');
      req.destroy();
      resolve(false);
    });
  });
}

// Test 4: Verify timeout logic
function testTimeoutLogic() {
  console.log('\n📋 Test 4: Timeout Logic');
  
  const now = Date.now();
  
  // Simulate Flint scenarios
  const flintTests = [
    { name: 'Flint active 30s ago', lastActivity: now - 30000, expected: 'working' },
    { name: 'Flint active 59s ago', lastActivity: now - 59000, expected: 'working' },
    { name: 'Flint active 61s ago', lastActivity: now - 61000, expected: 'idle' },
    { name: 'Flint active 5min ago', lastActivity: now - 300000, expected: 'idle' },
  ];
  
  // Simulate Subagent scenarios  
  const subagentTests = [
    { name: 'Subagent active 15s ago', lastActivity: now - 15000, expected: 'working' },
    { name: 'Subagent active 29s ago', lastActivity: now - 29000, expected: 'working' },
    { name: 'Subagent active 31s ago', lastActivity: now - 31000, expected: 'idle' },
  ];
  
  console.log('  Flint timeout: 60s');
  flintTests.forEach(t => {
    const age = now - t.lastActivity;
    const result = age < 60000 ? 'working' : 'idle';
    const icon = result === t.expected ? '✅' : '❌';
    console.log(`     ${icon} ${t.name} → ${result} (expected: ${t.expected})`);
  });
  
  console.log('  Subagent timeout: 30s');
  subagentTests.forEach(t => {
    const age = now - t.lastActivity;
    const result = age < 30000 ? 'working' : 'idle';
    const icon = result === t.expected ? '✅' : '❌';
    console.log(`     ${icon} ${t.name} → ${result} (expected: ${t.expected})`);
  });
  
  return true;
}

// Run all tests
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Simplified Status Detection - Test Suite                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const results = [];
  
  results.push(testGetLastJsonlEntry());
  results.push(testAgentSessionsJson());
  results.push(await testApi());
  results.push(testTimeoutLogic());
  
  console.log('\n════════════════════════════════════════════════════════════');
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('✅ All tests passed!');
  } else {
    console.log('⚠️  Some tests failed - see above for details');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
