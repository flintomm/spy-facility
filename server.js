const http = require('http');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const MESHNET_IP = process.env.MESHNET_IP || '0.0.0.0';
const PORT = process.env.PORT || 8080;

const SERVER_START_TIME = Date.now();

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon'
};

// ============================================================================
// SIMPLIFIED STATUS DETECTION CONFIG
// ============================================================================
// Flint (main agent): 60s timeout - generous for thinking/deep work periods
// Subagents: 30s timeout - tighter since they should be actively working
const FLINT_TIMEOUT_MS = 60000;
const SUBAGENT_TIMEOUT_MS = 30000;

// Base OpenClaw directory
const OPENCLAW_DIR = path.join(process.env.HOME || '/Users/flint', '.openclaw');

// All agent session directories to watch
const AGENT_SESSION_DIRS = {
  main: path.join(OPENCLAW_DIR, 'agents/main/sessions'),
  cipher: path.join(OPENCLAW_DIR, 'agents/cipher/sessions'),
  scout: path.join(OPENCLAW_DIR, 'agents/scout/sessions'),
  scrub: path.join(OPENCLAW_DIR, 'agents/scrub/sessions'),
  vera: path.join(OPENCLAW_DIR, 'agents/vera/sessions')
};

// Legacy compatibility
const SESSIONS_DIR = AGENT_SESSION_DIRS.main;

const AGENTS_JSON_PATH = path.join(__dirname, 'data', 'agents.json');
const AGENT_SESSIONS_PATH = path.join(__dirname, 'data', 'agent-sessions.json');

// In-memory cache of last activity timestamps per session
const sessionActivity = new Map();

// ============================================================================
// DATA HELPERS
// ============================================================================

function loadAgentsData() {
  try {
    const data = fs.readFileSync(AGENTS_JSON_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading agents.json:', err.message);
    return null;
  }
}

function saveAgentsData(agentsData) {
  try {
    fs.writeFileSync(AGENTS_JSON_PATH, JSON.stringify(agentsData, null, 2));
  } catch (err) {
    console.error('Error saving agents.json:', err.message);
  }
}

function updateAgentExp(agentName, expChange) {
  const agentsData = loadAgentsData();
  if (!agentsData || !agentsData.agents || !agentsData.agents[agentName]) {
    return null;
  }
  
  const agent = agentsData.agents[agentName];
  agent.exp = (agent.exp || 0) + expChange;
  
  while (agent.exp >= agent.nextLevel) {
    agent.level += 1;
    agent.nextLevel = Math.floor(agent.nextLevel * 1.5);
  }
  
  if (agent.exp < 0) agent.exp = 0;
  
  saveAgentsData(agentsData);
  console.log(`[EXP] ${agentName}: ${expChange > 0 ? '+' : ''}${expChange} EXP (total: ${agent.exp}, Lv${agent.level})`);
  return agent;
}

function loadAgentSessionMap() {
  try {
    if (fs.existsSync(AGENT_SESSIONS_PATH)) {
      return JSON.parse(fs.readFileSync(AGENT_SESSIONS_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('[STATUS] Error reading agent-sessions.json:', err.message);
  }
  return {};
}

function saveAgentSessionMap(map) {
  try {
    fs.writeFileSync(AGENT_SESSIONS_PATH, JSON.stringify(map, null, 2));
  } catch (err) {
    console.error('[STATUS] Error saving agent-sessions.json:', err.message);
  }
}

// ============================================================================
// ACTIVITY TRACKING
// ============================================================================

/**
 * Get the last entry from a JSONL file
 * Returns null if file doesn't exist or has no valid JSON entries
 */
function getLastJsonlEntry(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stats = fs.statSync(filePath);
    if (stats.size === 0) return null;
    
    // Read last 8KB of file (covers most recent activity)
    const readSize = Math.min(8192, stats.size);
    const buffer = Buffer.alloc(readSize);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, readSize, stats.size - readSize);
    fs.closeSync(fd);
    
    const chunk = buffer.toString('utf8');
    const lines = chunk.split('\n');
    
    // Find last valid JSON line
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
    // Ignore errors - file may not exist or be unreadable
  }
  return null;
}

/**
 * Get timestamp of last activity from a session's JSONL file
 * Searches across ALL agent session directories
 * Returns 0 if no activity found
 */
function getSessionLastActivity(sessionId) {
  // Check each agent's session directory
  for (const [agentId, sessDir] of Object.entries(AGENT_SESSION_DIRS)) {
    const jsonlPath = path.join(sessDir, `${sessionId}.jsonl`);
    if (fs.existsSync(jsonlPath)) {
      const entry = getLastJsonlEntry(jsonlPath);
      if (entry && entry.timestamp) {
        return new Date(entry.timestamp).getTime();
      }
    }
  }
  return 0;
}

/**
 * Load OpenClaw's sessions.json from ALL agent directories
 * Returns combined sessionId -> {sessionKey, agentId} mapping
 */
function loadOpenClawSessionsJson() {
  const map = {};
  
  for (const [agentId, sessDir] of Object.entries(AGENT_SESSION_DIRS)) {
    try {
      const sessionsPath = path.join(sessDir, 'sessions.json');
      if (fs.existsSync(sessionsPath)) {
        const data = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
        for (const [key, val] of Object.entries(data)) {
          if (val && val.sessionId) {
            map[val.sessionId] = key;
            // Also track which agent directory this came from
            if (!map._agentMap) map._agentMap = {};
            map._agentMap[val.sessionId] = agentId;
          }
        }
      }
    } catch (err) {
      // Silently continue - directory might not exist yet
    }
  }
  return map;
}

// ============================================================================
// SIMPLIFIED STATUS DETECTION
// ============================================================================

/**
 * Determine agent status based on simple activity timeout rules:
 * 
 * FLINT (agent:main:main):
 *   - WORKING: JSONL activity in last 60s
 *   - IDLE: No JSONL activity in last 60s
 *   - Rationale: Flint's session always exists, so we need timeout to flip to IDLE
 * 
 * SUBAGENTS (Cipher, Vera, etc):
 *   - WORKING: Registered in agent-sessions.json AND JSONL activity in last 30s
 *   - IDLE: Not registered OR no JSONL activity in last 30s
 *   - Rationale: Subagents should be actively working when spawned, 30s is tight
 */

// Map agent directory name to display name
const AGENT_DIR_TO_NAME = {
  main: 'Flint',
  cipher: 'Cipher',
  scout: 'Scout',
  scrub: 'Scrub',
  vera: 'Vera',
  atlas: 'Atlas',
  pulse: 'Pulse'
};

/**
 * Get the most recent JSONL activity timestamp from an agent's session directory
 */
function getAgentLastActivity(agentId) {
  const sessDir = AGENT_SESSION_DIRS[agentId];
  if (!sessDir || !fs.existsSync(sessDir)) return 0;
  
  try {
    const files = fs.readdirSync(sessDir).filter(f => f.endsWith('.jsonl'));
    if (files.length === 0) return 0;
    
    // Find the most recently modified JSONL file
    let latestTime = 0;
    let latestFile = null;
    
    for (const file of files) {
      const fullPath = path.join(sessDir, file);
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs > latestTime) {
        latestTime = stat.mtimeMs;
        latestFile = fullPath;
      }
    }
    
    if (!latestFile) return 0;
    
    // Get the actual last entry timestamp from the file
    const entry = getLastJsonlEntry(latestFile);
    if (entry && entry.timestamp) {
      return new Date(entry.timestamp).getTime();
    }
    
    // Fall back to file mtime
    return latestTime;
  } catch (err) {
    return 0;
  }
}

function getAgentStatus() {
  const now = Date.now();
  const status = {
    Flint: 'idle',
    Cipher: 'idle',
    Scout: 'idle',
    Scrub: 'idle',
    Atlas: 'idle',
    Vera: 'idle',
    Pulse: 'idle'
  };

  // Check each agent's session directory directly
  for (const [agentId, agentName] of Object.entries(AGENT_DIR_TO_NAME)) {
    if (!status.hasOwnProperty(agentName)) continue;
    if (!AGENT_SESSION_DIRS[agentId]) continue;
    
    const lastActivity = getAgentLastActivity(agentId);
    if (lastActivity === 0) continue;
    
    const age = now - lastActivity;
    const timeout = (agentId === 'main') ? FLINT_TIMEOUT_MS : SUBAGENT_TIMEOUT_MS;
    
    if (age < timeout) {
      status[agentName] = 'working';
    }
  }

  return status;
}

// ============================================================================
// FILE WATCHER (for real-time updates)
// ============================================================================

// Watch ALL agent session directories
const allSessionDirs = Object.values(AGENT_SESSION_DIRS);
const watcher = chokidar.watch(allSessionDirs, {
  persistent: true,
  usePolling: true,
  interval: 1000,
  ignoreInitial: false,
  depth: 0
});

// Update activity cache when JSONL files change
watcher.on('change', (filePath) => {
  if (!filePath.endsWith('.jsonl')) return;
  const sessionId = path.basename(filePath, '.jsonl');
  const entry = getLastJsonlEntry(filePath);
  if (entry && entry.timestamp) {
    const activityTime = new Date(entry.timestamp).getTime();
    sessionActivity.set(sessionId, {
      lastActivity: activityTime,
      model: entry.modelId || entry.model || null
    });
  }
});

watcher.on('add', (filePath) => {
  if (!filePath.endsWith('.jsonl')) return;
  const sessionId = path.basename(filePath, '.jsonl');
  const entry = getLastJsonlEntry(filePath);
  if (entry && entry.timestamp) {
    const activityTime = new Date(entry.timestamp).getTime();
    sessionActivity.set(sessionId, {
      lastActivity: activityTime,
      model: entry.modelId || entry.model || null
    });
  }
});

watcher.on('unlink', (filePath) => {
  if (!filePath.endsWith('.jsonl')) return;
  const sessionId = path.basename(filePath, '.jsonl');
  sessionActivity.delete(sessionId);
});

console.log('[WATCHER] File watcher initialized for real-time status');

// ============================================================================
// TODO / ACTIVITY SYSTEM
// ============================================================================

const activityFile = path.join(__dirname, 'data', 'todo-activity.json');
const todosFile = path.join(__dirname, 'data', 'todos.json');

function loadActivity() {
  try {
    if (fs.existsSync(activityFile)) {
      return JSON.parse(fs.readFileSync(activityFile, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading activity:', err);
  }
  return [];
}

function saveActivity(activity) {
  try {
    fs.writeFileSync(activityFile, JSON.stringify(activity, null, 2));
  } catch (err) {
    console.error('Error saving activity:', err);
  }
}

// ===== AGENT COMMUNICATIONS LOG =====
const agentCommsFile = path.join(__dirname, 'data', 'agent-comms.json');

function loadAgentComms() {
  try {
    if (fs.existsSync(agentCommsFile)) {
      return JSON.parse(fs.readFileSync(agentCommsFile, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading agent-comms:', err);
  }
  return [];
}

function saveAgentComms(comms) {
  try {
    fs.writeFileSync(agentCommsFile, JSON.stringify(comms, null, 2));
  } catch (err) {
    console.error('Error saving agent-comms:', err);
  }
}

function logAgentComm(agentComms) {
  const comms = loadAgentComms();
  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    ...agentComms
  };
  comms.push(entry);
  // Keep last 500 entries
  if (comms.length > 500) {
    comms.shift();
  }
  saveAgentComms(comms);
  return entry.id;
}

function logActivity(agent, action, taskText, extra = {}) {
  const exp = extra.exp || 0;
  const activity = loadActivity();
  const entry = {
    time: new Date().toISOString(),
    agent,
    action,
    task: taskText,
    exp: exp,
    ...extra
  };
  activity.push(entry);
  if (activity.length > 100) {
    activity.shift();
  }
  saveActivity(activity);
  const expStr = exp > 0 ? `+${exp}` : (exp < 0 ? `${exp}` : '');
  console.log(`[TODO] ${agent}: ${expStr ? expStr + ' ' : ''}${action} "${taskText}"${extra.target ? ` to ${extra.target}` : ''}`);
}

function loadTodos() {
  try {
    if (fs.existsSync(todosFile)) {
      return JSON.parse(fs.readFileSync(todosFile, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading todos:', err);
  }
  return [];
}

function saveTodos(todos) {
  try {
    fs.writeFileSync(todosFile, JSON.stringify(todos, null, 2));
  } catch (err) {
    console.error('Error saving todos:', err);
  }
}

let todos = loadTodos();

// ============================================================================
// HTTP SERVER
// ============================================================================

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requester');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: Employee Status (simplified WORKING/IDLE)
  if (url.pathname === '/api/employee-status') {
    const agentsData = loadAgentsData();
    const agentStatus = getAgentStatus();
    const agentSessions = loadAgentSessionMap();
    
    const agents = [];
    if (agentsData && agentsData.agents) {
      for (const [name, data] of Object.entries(agentsData.agents)) {
        const computedStatus = agentStatus[data.name] || 'idle';
        const session = agentSessions[data.name] || {};
        // Only show current task/model when actually working
        // Prevents stale data from completed sessions
        const isWorking = computedStatus === 'working';
        agents.push({
          name: data.name,
          role: data.rank,
          status: computedStatus,
          color: data.color,
          level: data.level,
          exp: data.exp,
          nextLevel: data.nextLevel,
          expProgress: Math.round((data.exp / data.nextLevel) * 100),
          currentTask: isWorking ? (session.task || null) : null,
          currentModel: isWorking ? (session.model || null) : null
        });
      }
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', agents }));
    return;
  }

  // API: Todos - GET
  if (url.pathname === '/api/todos' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(todos));
    return;
  }

  // API: Todos - POST
  if (url.pathname === '/api/todos' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { action, text, id, assignedTo, requester } = JSON.parse(body);
        const requesterName = requester || 'Flint';
        
        if (action === 'add' && text) {
          const newTodo = {
            id: Date.now(),
            text,
            done: false,
            createdAt: new Date().toISOString(),
            createdBy: requesterName,
            assignedTo: assignedTo || null,
            completedAt: null
          };
          todos.push(newTodo);
          saveTodos(todos);
          logActivity(requesterName, 'added task', text);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(todos));
          return;
        }
        
        if (action === 'complete' && id) {
          const todo = todos.find(t => t.id == id);
          if (todo) {
            logActivity(requesterName, 'completed task', todo.text, { exp: 50 });
            updateAgentExp(requesterName, 50);
            todos = todos.filter(t => t.id != id);
            saveTodos(todos);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(todos));
          return;
        }

        if (action === 'delete' && id) {
          const todo = todos.find(t => t.id == id);
          const taskText = todo ? todo.text : '';
          todos = todos.filter(t => t.id != id);
          saveTodos(todos);
          logActivity(requesterName, 'deleted task', taskText, { exp: -25 });
          updateAgentExp(requesterName, -25);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(todos));
          return;
        }

        if (action === 'assign' && id && assignedTo) {
          const todo = todos.find(t => t.id == id);
          if (todo) {
            const oldAssignee = todo.assignedTo;
            todo.assignedTo = assignedTo;
            saveTodos(todos);
            if (oldAssignee !== assignedTo) {
              logActivity(requesterName, 'assigned task', todo.text, { target: assignedTo });
            }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(todos));
          return;
        }
        
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unknown action' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Activity Feed
  if (url.pathname === '/api/todos/activity' && req.method === 'GET') {
    const activity = loadActivity();
    const modelFilter = url.searchParams.get('model');
    let filtered = activity;
    if (modelFilter) {
      filtered = activity.filter(a => (a.model || 'unknown') === modelFilter);
    }
    const formatted = filtered.slice().reverse().map(a => {
      const d = new Date(a.time);
      const ts = d.toLocaleTimeString('en-US', { hour12: false });
      return { ...a, time: ts, expChange: a.exp > 0 ? `+${a.exp}` : (a.exp < 0 ? `${a.exp}` : '') };
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(formatted));
    return;
  }

  // API: Model Stats
  if (url.pathname === '/api/model-stats' && req.method === 'GET') {
    const agentsData = loadAgentsData();
    const modelStats = (agentsData && agentsData.modelStats) || {};
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(modelStats));
    return;
  }

  // API: Agent Comms - POST (log a message)
  if (url.pathname === '/api/agent-comms' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { from, to, type, message, sessionKey } = JSON.parse(body);
        if (!from || !to || !type || !message) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields: from, to, type, message' }));
          return;
        }
        const id = logAgentComm({ from, to, type, message, sessionKey });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', id }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Agent Comms - GET (retrieve log)
  if (url.pathname === '/api/agent-comms' && req.method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const fromFilter = url.searchParams.get('from');
    const sinceFilter = url.searchParams.get('since');
    
    let comms = loadAgentComms();
    
    // Apply filters
    if (fromFilter) {
      comms = comms.filter(c => c.from === fromFilter);
    }
    if (sinceFilter) {
      const since = new Date(sinceFilter).getTime();
      comms = comms.filter(c => new Date(c.timestamp).getTime() > since);
    }
    
    // Return newest first, limited
    const result = comms.reverse().slice(0, limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // API: Agent Sessions - POST (register/unregister)
  if (url.pathname === '/api/agent-sessions' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { agent, sessionId, sessionKey, task, action } = JSON.parse(body);
        let map = loadAgentSessionMap();
        
        if (action === 'start' && agent && sessionId) {
          const model = JSON.parse(body).model || null;
          map[agent] = { 
            sessionId, 
            sessionKey: sessionKey || null, 
            task: task || null, 
            model: model, 
            startedAt: new Date().toISOString() 
          };
          console.log(`[AGENT-MAP] ${agent} → ${sessionId} (${task || 'no task'}, model: ${model || 'unknown'})`);
          saveAgentSessionMap(map);
        } else if (action === 'stop' && agent) {
          delete map[agent];
          console.log(`[AGENT-MAP] ${agent} stopped`);
          saveAgentSessionMap(map);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(map));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Agent Sessions - GET
  if (url.pathname === '/api/agent-sessions' && req.method === 'GET') {
    const map = loadAgentSessionMap();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(map));
    return;
  }

  // Static files
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  const fullPath = path.join(__dirname, filePath);
  
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const ext = path.extname(fullPath);
    const contentType = mimeTypes[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(fs.readFileSync(fullPath));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://${MESHNET_IP}:${PORT}`);
  console.log(`📱 Access from your iPhone: http://${MESHNET_IP}:${PORT}`);
  console.log('🔌 Simplified status detection: ENABLED');
  console.log(`   - Flint timeout: ${FLINT_TIMEOUT_MS / 1000}s (accounts for thinking/deep work)`);
  console.log(`   - Subagent timeout: ${SUBAGENT_TIMEOUT_MS / 1000}s (tight, active work only)`);
  console.log('📊 Dashboard endpoints:');
  console.log('   - /api/employee-status (WORKING/IDLE status)');
  console.log('   - /api/todos (task management)');
  console.log('   - /api/todos/activity (activity feed)');
});
