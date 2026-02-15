/**
 * spawnAgent.js - Spawn subagents with full context loading
 * 
 * Loads agent persona, memory, and patterns, then spawns via OpenClaw
 * and registers the session with the facility for visibility.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Config
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.join(process.env.HOME || '/Users/flint', '.openclaw/workspace');
const AGENTS_DIR = path.join(WORKSPACE, 'agents');
const FACILITY_URL = process.env.FACILITY_URL || 'http://localhost:8080';

/**
 * Load a file safely, returning empty string if not found
 */
function loadFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (err) {
    console.error(`[spawnAgent] Failed to load ${filePath}:`, err.message);
  }
  return '';
}

/**
 * Load all context files for an agent type
 */
function loadAgentContext(agentType) {
  const agentDir = path.join(AGENTS_DIR, agentType);
  
  if (!fs.existsSync(agentDir)) {
    throw new Error(`Agent directory not found: ${agentDir}`);
  }
  
  return {
    persona: loadFile(path.join(agentDir, 'persona.md')),
    memory: loadFile(path.join(agentDir, 'memory.md')),
    patterns: loadFile(path.join(agentDir, 'patterns.md'))
  };
}

/**
 * Get recent facility activity for context
 */
function getFacilityContext() {
  const activityPath = path.join(WORKSPACE, 'spy-facility/data/activity.json');
  try {
    if (fs.existsSync(activityPath)) {
      const data = JSON.parse(fs.readFileSync(activityPath, 'utf8'));
      // Get last 5 entries
      const recent = (data.history || []).slice(-5);
      if (recent.length > 0) {
        return recent.map(e => `- ${e.agent}: ${e.status} - ${e.note || ''}`).join('\n');
      }
    }
  } catch (err) {
    // Ignore - facility context is optional
  }
  return 'No recent activity';
}

/**
 * Format the full prompt with all context
 */
function formatPrompt(agentType, context, { task, spec }) {
  const { persona, memory, patterns } = context;
  
  const prompt = `You are ${agentType}, a specialized agent at 87 Deer Crossing Lane.

**READ FIRST:**
1. \`agents/${agentType}/persona.md\` - Who you are
2. \`agents/${agentType}/memory.md\` - Your accumulated lessons
3. \`agents/${agentType}/patterns.md\` - Your successful patterns

---
## YOUR PERSONA
${persona || '(No persona defined)'}

---
## YOUR MEMORY (Lessons Learned)
${memory || '(No memory yet - you will create it)'}

---
## YOUR PATTERNS (What Works)
${patterns || '(No patterns yet - you will establish them)'}

---
## FACILITY CONTEXT (Recent Activity)
${getFacilityContext()}

---
## YOUR TASK
${task}

${spec ? `---\n## SPECIFICATION\n${spec}` : ''}

---
## MEMORY UPDATE PROTOCOL (MANDATORY)

After completing this task, you MUST update:

1. **\`agents/${agentType}/memory.md\`** - Add what you learned:
   \`\`\`markdown
   ### [Task Name] - [YYYY-MM-DD]
   - **What:** Brief description of what was built
   - **Result:** Success / Partial / Failure
   - **Lesson:** What you learned (what worked, what to avoid)
   \`\`\`

2. **\`agents/${agentType}/patterns.md\`** - Add new patterns that worked

This is NOT optional. Your memory is your continuity.

---

Now complete your task. Be direct. Be practical. Working code > elegant theory.`;

  return prompt;
}

/**
 * Register session with facility API
 */
async function registerWithFacility(agent, sessionId, sessionKey, task, model) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      agent,
      sessionId,
      sessionKey,
      task,
      model: model || null,
      action: 'start'
    });

    const url = new URL('/api/agent-sessions', FACILITY_URL);
    
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 8080,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[spawnAgent] Failed to register with facility:', err.message);
      resolve(null); // Don't fail the spawn if facility is down
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve(null);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Unregister session from facility (call when agent completes)
 */
async function unregisterFromFacility(agent) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      agent,
      action: 'stop'
    });

    const url = new URL('/api/agent-sessions', FACILITY_URL);
    
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 8080,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(true));
    });

    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Spawn an agent with full context
 * 
 * @param {string} agentType - Agent type (e.g., 'cipher', 'scout', 'atlas')
 * @param {Object} options - Spawn options
 * @param {string} options.task - Task description
 * @param {string} [options.spec] - Optional detailed specification
 * @param {string} [options.model] - Model to use (defaults to agent's configured model)
 * @param {Function} [options.spawner] - Custom spawn function (receives prompt, returns session info)
 * @returns {Promise<Object>} Session info { sessionId, sessionKey, agent, prompt }
 */
async function spawnAgent(agentType, { task, spec, model, spawner } = {}) {
  if (!agentType) {
    throw new Error('agentType is required');
  }
  if (!task) {
    throw new Error('task is required');
  }

  // Capitalize agent name for facility (e.g., 'cipher' -> 'Cipher')
  const agentName = agentType.charAt(0).toUpperCase() + agentType.slice(1);

  // Load context
  const context = loadAgentContext(agentType);
  
  // Format the full prompt
  const prompt = formatPrompt(agentType, context, { task, spec });

  // If a custom spawner is provided, use it
  if (typeof spawner === 'function') {
    const result = await spawner(prompt, { model, agentType, task });
    
    if (result && result.sessionId) {
      // Register with facility
      await registerWithFacility(agentName, result.sessionId, result.sessionKey, task, model);
    }
    
    return {
      ...result,
      agent: agentName,
      model: model || null,
      prompt
    };
  }

  // Default: Return prompt for manual spawning
  // The caller is responsible for actually spawning and registering
  console.log(`[spawnAgent] No spawner provided. Returning prompt for ${agentName}.`);
  console.log(`[spawnAgent] Task: ${task}`);
  
  return {
    agent: agentName,
    prompt,
    task,
    model: model || null,
    // Helper methods for manual flow
    async register(sessionId, sessionKey) {
      return registerWithFacility(agentName, sessionId, sessionKey, task, model);
    },
    async unregister() {
      return unregisterFromFacility(agentName);
    }
  };
}

// Export for use as module
module.exports = {
  spawnAgent,
  loadAgentContext,
  formatPrompt,
  registerWithFacility,
  unregisterFromFacility,
  AGENTS_DIR,
  FACILITY_URL
};
