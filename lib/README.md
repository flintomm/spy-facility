# spy-facility/lib

Helper functions for the 87 Deer Crossing Lane facility.

## spawnAgent.js

Spawns subagents with full context loading - persona, memory, patterns, and facility context.

### Basic Usage

```javascript
const { spawnAgent } = require('./spawnAgent');

// Get formatted prompt for manual spawning
const result = await spawnAgent('cipher', {
  task: 'Build the authentication module',
  spec: 'Must support OAuth2 and API keys'
});

console.log(result.prompt);  // Full prompt with all context
console.log(result.agent);   // 'Cipher'

// After manually spawning, register with facility
await result.register('session-uuid', 'agent:main:subagent:session-uuid');

// When done
await result.unregister();
```

### With Custom Spawner

```javascript
const { spawnAgent } = require('./spawnAgent');

// Provide your own spawn implementation
const result = await spawnAgent('cipher', {
  task: 'Build the authentication module',
  model: 'claude-opus-4-5',
  spawner: async (prompt, { model, agentType, task }) => {
    // Your spawn logic here
    const session = await mySpawnFunction(prompt, model);
    return {
      sessionId: session.id,
      sessionKey: session.key
    };
  }
});

// Session is already registered with facility
console.log(result.sessionId);
```

### Function Signature

```javascript
async function spawnAgent(agentType, { task, spec, model, spawner })
```

**Parameters:**
- `agentType` (string, required) - Agent type: 'cipher', 'scout', 'atlas', 'forge', 'sentry', 'patch'
- `task` (string, required) - Task description
- `spec` (string, optional) - Detailed specification
- `model` (string, optional) - Model override
- `spawner` (function, optional) - Custom spawn function

**Returns:**
```javascript
{
  agent: 'Cipher',           // Capitalized agent name
  prompt: '...',             // Full formatted prompt
  sessionId: '...',          // If spawner provided
  sessionKey: '...',         // If spawner provided
  task: '...',               // Original task
  
  // Helper methods (if no spawner)
  register(sessionId, sessionKey),  // Register with facility
  unregister()                      // Mark session complete
}
```

### What Gets Loaded

1. **Persona** (`agents/{type}/persona.md`) - Who the agent is
2. **Memory** (`agents/{type}/memory.md`) - Lessons learned from past tasks
3. **Patterns** (`agents/{type}/patterns.md`) - Successful code patterns
4. **Facility Context** - Recent activity from other agents

### Memory Update Protocol

The formatted prompt includes mandatory instructions for agents to update their memory files after task completion. This ensures lessons learned persist across sessions.

### Environment Variables

- `OPENCLAW_WORKSPACE` - Workspace path (default: `~/.openclaw/workspace`)
- `FACILITY_URL` - Facility server URL (default: `http://localhost:8080`)

### Individual Exports

```javascript
const {
  spawnAgent,           // Main function
  loadAgentContext,     // Load persona/memory/patterns
  formatPrompt,         // Format full prompt
  registerWithFacility, // Register session
  unregisterFromFacility, // Mark complete
  AGENTS_DIR,           // Agents directory path
  FACILITY_URL          // Facility URL
} = require('./spawnAgent');
```

### Example: Scout Agent

```javascript
const { spawnAgent } = require('./spawnAgent');

const result = await spawnAgent('scout', {
  task: 'Research competitors in the AI coding space',
  spec: `
    Find and summarize:
    - GitHub Copilot features
    - Cursor capabilities  
    - Replit AI offerings
    
    Output: markdown report
  `
});
```

### Error Handling

- Throws if `agentType` directory doesn't exist
- Throws if `task` is not provided
- Facility registration fails gracefully (doesn't break spawn)
- Timeouts after 5s for facility API calls

---

*Built by Cipher, Tier 4 Coder @ 87 Deer Crossing Lane*
