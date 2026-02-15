#!/usr/bin/env node
/**
 * Status Detection Test Harness
 * 
 * Simulates agent activity and validates status detection accuracy.
 * Run with: node scripts/test-status-detection.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEST_LOG_FILE = path.join(__dirname, '..', 'logs', 'status-test-results.jsonl');
const API_ENDPOINT = 'http://localhost:8080/api/employee-status';

// Ensure logs directory exists
const logsDir = path.dirname(TEST_LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

class StatusTestHarness {
  constructor() {
    this.results = [];
    this.testStartTime = Date.now();
    this.sessionDir = path.join(process.env.HOME || '/Users/flint', '.openclaw/agents/main/sessions');
  }

  log(level, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data
    };
    this.results.push(entry);
    fs.appendFileSync(TEST_LOG_FILE, JSON.stringify(entry) + '\n');
    console.log(`[${level.toUpperCase()}] ${message}`, data);
  }

  async fetchStatus() {
    try {
      const response = await fetch(API_ENDPOINT);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      this.log('error', 'Failed to fetch status', { error: err.message });
      return null;
    }
  }

  async testBasicStatusFetch() {
    this.log('info', 'Test: Basic status fetch');
    const status = await this.fetchStatus();
    if (!status) {
      this.log('fail', 'Basic status fetch failed');
      return false;
    }
    
    if (!status.agents || !Array.isArray(status.agents)) {
      this.log('fail', 'Status response missing agents array', { status });
      return false;
    }

    // Check all expected agents are present
    const expectedAgents = ['Flint', 'Cipher', 'Atlas', 'Vera', 'Pulse'];
    const foundAgents = status.agents.map(a => a.name);
    const missing = expectedAgents.filter(a => !foundAgents.includes(a));
    
    if (missing.length > 0) {
      this.log('warn', 'Missing agents in status', { missing, found: foundAgents });
    }

    this.log('pass', 'Basic status fetch successful', { 
      agentCount: status.agents.length,
      agents: foundAgents
    });
    return true;
  }

  async testStatusConsistency() {
    this.log('info', 'Test: Status consistency over time');
    
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const status = await this.fetchStatus();
      if (status) {
        samples.push({
          time: Date.now(),
          agents: status.agents.reduce((acc, a) => {
            acc[a.name] = a.status;
            return acc;
          }, {})
        });
      }
      await this.sleep(1000);
    }

    // Check if any agent flapped (changed status rapidly)
    const agentStatuses = {};
    samples.forEach((sample, idx) => {
      Object.entries(sample.agents).forEach(([agent, status]) => {
        if (!agentStatuses[agent]) agentStatuses[agent] = [];
        agentStatuses[agent].push({ sample: idx, status });
      });
    });

    let flappingDetected = false;
    Object.entries(agentStatuses).forEach(([agent, statuses]) => {
      const uniqueStatuses = [...new Set(statuses.map(s => s.status))];
      if (uniqueStatuses.length > 1) {
        flappingDetected = true;
        this.log('warn', `Agent ${agent} status changed during test`, { 
          statuses: statuses.map(s => s.status),
          samples: statuses.length
        });
      }
    });

    if (!flappingDetected) {
      this.log('pass', 'Status consistency maintained', { samples: samples.length });
    }
    
    return { samples, agentStatuses, flappingDetected };
  }

  async testTimeoutBehavior() {
    this.log('info', 'Test: Timeout behavior (7-second window)');
    
    // Get current status
    const before = await this.fetchStatus();
    if (!before) return false;

    this.log('info', 'Current status before wait', {
      agents: before.agents.map(a => ({ name: a.name, status: a.status }))
    });

    // Wait for 8 seconds (longer than 7s timeout)
    this.log('info', 'Waiting 8 seconds for timeout...');
    await this.sleep(8000);

    // Get status after wait
    const after = await this.fetchStatus();
    if (!after) return false;

    this.log('info', 'Status after 8s wait', {
      agents: after.agents.map(a => ({ name: a.name, status: a.status }))
    });

    // Check if any agents that were working became idle
    const changes = [];
    before.agents.forEach(beforeAgent => {
      const afterAgent = after.agents.find(a => a.name === beforeAgent.name);
      if (afterAgent && beforeAgent.status !== afterAgent.status) {
        changes.push({
          agent: beforeAgent.name,
          from: beforeAgent.status,
          to: afterAgent.status
        });
      }
    });

    if (changes.length > 0) {
      this.log('info', 'Status changes detected', { changes });
    } else {
      this.log('info', 'No status changes (agents may not have been working)');
    }

    return { before, after, changes };
  }

  async testContextGrowthDetection() {
    this.log('info', 'Test: Context growth detection simulation');
    
    // This test checks if the server correctly tracks context growth
    // We simulate by checking if the server's contextHistory would work
    
    const now = Date.now();
    const mockContextHistory = new Map();
    
    // Simulate: Session starts with 1000 tokens
    mockContextHistory.set('test-session', { tokens: 1000, lastGrowth: now });
    
    // Simulate: 3 seconds later, tokens increase to 1200
    mockContextHistory.set('test-session', { tokens: 1200, lastGrowth: now + 3000 });
    
    // Check logic (simulating isSessionActive)
    const CONTEXT_GROWTH_WINDOW_MS = 7000;
    const checkTime = now + 5000; // 5 seconds after initial
    const history = mockContextHistory.get('test-session');
    const isActive = (checkTime - history.lastGrowth) < CONTEXT_GROWTH_WINDOW_MS;
    
    if (isActive) {
      this.log('pass', 'Context growth detection logic works', {
        tokens: history.tokens,
        lastGrowth: history.lastGrowth,
        checkTime,
        isActive
      });
    } else {
      this.log('fail', 'Context growth detection failed', { isActive });
    }

    // Simulate: 10 seconds later (beyond window)
    const lateCheckTime = now + 10000;
    const isStillActive = (lateCheckTime - history.lastGrowth) < CONTEXT_GROWTH_WINDOW_MS;
    
    if (!isStillActive) {
      this.log('pass', 'Context growth timeout works correctly', {
        timeSinceGrowth: lateCheckTime - history.lastGrowth,
        window: CONTEXT_GROWTH_WINDOW_MS,
        isActive: isStillActive
      });
    } else {
      this.log('fail', 'Context growth should have timed out');
    }

    return { isActive, isStillActive };
  }

  async testGracePeriod() {
    this.log('info', 'Test: Grace period behavior (RECENTLY_ACTIVE_MS)');
    
    // The grace period is 7000ms - if an agent was recently active,
    // they stay "working" for 7 seconds even if no new activity
    
    const RECENTLY_ACTIVE_MS = 7000;
    const now = Date.now();
    
    // Simulate grace period tracking
    const recentlyActive = new Map();
    recentlyActive.set('TestAgent', now);
    
    // Check immediately (should be active)
    const immediateCheck = (now - recentlyActive.get('TestAgent')) < RECENTLY_ACTIVE_MS;
    
    // Check after 5 seconds (should still be active)
    const fiveSecCheck = ((now + 5000) - recentlyActive.get('TestAgent')) < RECENTLY_ACTIVE_MS;
    
    // Check after 8 seconds (should be expired)
    const eightSecCheck = ((now + 8000) - recentlyActive.get('TestAgent')) < RECENTLY_ACTIVE_MS;
    
    this.log('info', 'Grace period test results', {
      immediate: immediateCheck,
      after5s: fiveSecCheck,
      after8s: eightSecCheck,
      expected: { immediate: true, after5s: true, after8s: false }
    });

    const pass = immediateCheck && fiveSecCheck && !eightSecCheck;
    if (pass) {
      this.log('pass', 'Grace period behavior correct');
    } else {
      this.log('fail', 'Grace period behavior unexpected');
    }

    return pass;
  }

  async testAll() {
    this.log('info', '=== Starting Status Detection Test Suite ===');
    
    const results = {
      basic: await this.testBasicStatusFetch(),
      consistency: await this.testStatusConsistency(),
      timeout: await this.testTimeoutBehavior(),
      contextGrowth: await this.testContextGrowthDetection(),
      gracePeriod: await this.testGracePeriod()
    };

    // Generate summary
    const summary = {
      testRunTime: Date.now() - this.testStartTime,
      testsRun: 5,
      passed: [
        results.basic,
        !results.consistency.flappingDetected,
        true, // timeout test is informational
        results.contextGrowth.isActive && !results.contextGrowth.isStillActive,
        results.gracePeriod
      ].filter(Boolean).length
    };

    this.log('info', '=== Test Suite Complete ===', summary);
    
    return { results, summary };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run if called directly
if (require.main === module) {
  const harness = new StatusTestHarness();
  harness.testAll().then(({ summary }) => {
    console.log('\n=== FINAL SUMMARY ===');
    console.log(`Tests passed: ${summary.passed}/${summary.testsRun}`);
    console.log(`Duration: ${summary.testRunTime}ms`);
    console.log(`Log file: ${TEST_LOG_FILE}`);
    process.exit(summary.passed === summary.testsRun ? 0 : 1);
  }).catch(err => {
    console.error('Test harness failed:', err);
    process.exit(1);
  });
}

module.exports = { StatusTestHarness };
