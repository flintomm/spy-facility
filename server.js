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

const SESSIONS_DIR = path.join(
  process.env.HOME || '/Users/flint',
  '.openclaw/agents/main/sessions'
);

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
 * Returns 0 if no activity found
 */
function getSessionLastActivity(sessionId) {
  const jsonlPath = path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
  const entry = getLastJsonlEntry(jsonlPath);
  
  if (entry && entry.timestamp) {
    return new Date(entry.timestamp).getTime();
  }
  return 0;
}

/**
 * Load OpenClaw's sessions.json to get sessionId -> sessionKey mapping
 * This tells us which session file belongs to which agent key
 */
function loadOpenClawSessionsJson() {
  const map = {};
  try {
    const sessionsPath = path.join(SESSIONS_DIR, 'sessions.json');
    if (fs.existsSync(sessionsPath)) {
      const data = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
      for (const [key, val] of Object.entries(data)) {
        if (val && val.sessionId) {
          map[val.sessionId] = key;
        }
      }
    }
  } catch (err) {
    console.error('[STATUS] Error reading OpenClaw sessions.json:', err.message);
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
function getAgentStatus() {
  const now = Date.now();
  const status = {
    Flint: 'idle',
    Cipher: 'idle',
    Atlas: 'idle',
    Vera: 'idle',
    Pulse: 'idle'
  };

  // Load session mappings
  const openClawMap = loadOpenClawSessionsJson(); // sessionId -> sessionKey
  const agentRegistry = loadAgentSessionMap();    // agentName -> {sessionId, ...}

  // Build reverse map: sessionId -> agentName from registry
  const registrySessionToAgent = {};
  for (const [agentName, info] of Object.entries(agentRegistry)) {
    if (info.sessionId) {
      registrySessionToAgent[info.sessionId] = agentName;
    }
  }

  // Build complete sessionId -> agent mapping
  const sessionToAgent = {};
  for (const [sessionId, sessionKey] of Object.entries(openClawMap)) {
    // Check if this session is in the registry first
    if (registrySessionToAgent[sessionId]) {
      sessionToAgent[sessionId] = registrySessionToAgent[sessionId];
    } else if (sessionKey === 'agent:main:main') {
      // Flint's main session
      sessionToAgent[sessionId] = 'Flint';
    }
  }
  // Add any registry entries that weren't in OpenClaw map (fallback)
  for (const [agentName, info] of Object.entries(agentRegistry)) {
    if (info.sessionId && !sessionToAgent[info.sessionId]) {
      sessionToAgent[info.sessionId] = agentName;
    }
  }

  // Check activity for each known session
  for (const [sessionId, agentName] of Object.entries(sessionToAgent)) {
    if (!status.hasOwnProperty(agentName)) continue;

    let lastActivity = getSessionLastActivity(sessionId);
    
    // If no activity yet, use session start time from registry
    if (lastActivity === 0 && agentRegistry[agentName] && agentRegistry[agentName].startedAt) {
      lastActivity = new Date(agentRegistry[agentName].startedAt).getTime();
    }
    
    if (lastActivity === 0) continue; // No activity and no start time

    const age = now - lastActivity;
    
    if (agentName === 'Flint') {
      // Flint: 60s timeout
      if (age < FLINT_TIMEOUT_MS) {
        status.Flint = 'working';
      }
    } else {
      // Subagent: must be registered + 30s timeout
      const isRegistered = agentRegistry[agentName] && agentRegistry[agentName].sessionId === sessionId;
      if (isRegistered && age < SUBAGENT_TIMEOUT_MS) {
        status[agentName] = 'working';
      }
    }
  }

  return status;
}

// ============================================================================
// FILE WATCHER (for real-time updates)
// ============================================================================

const watcher = chokidar.watch(SESSIONS_DIR, {
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
