const http = require('http');
const fs = require('fs');
const path = require('path');

const MESHNET_IP = process.env.MESHNET_IP || '0.0.0.0';
const PORT = process.env.PORT || 8080;

// Server start time for uptime calculation
const SERVER_START_TIME = Date.now();

// MIME types
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

// Cache for agent status
let cachedStatus = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5000; // 5 seconds

const SESSIONS_DIR = path.join(
  process.env.HOME || '/Users/flint',
  '.openclaw/agents/main/sessions'
);

const AGENTS_JSON_PATH = path.join(__dirname, 'data', 'agents.json');

// Load agents data from JSON file
function loadAgentsData() {
  try {
    const data = fs.readFileSync(AGENTS_JSON_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading agents.json:', err.message);
    return null;
  }
}

// Read sessions.json to get active session list
function readSessionsIndex() {
  try {
    const sessionsPath = path.join(SESSIONS_DIR, 'sessions.json');
    const data = fs.readFileSync(sessionsPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading sessions index:', err.message);
    return null;
  }
}

// Parse model from session JSONL file (read last 100 lines for most recent model)
function getLatestModel(sessionId) {
  try {
    const jsonlPath = path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
    if (!fs.existsSync(jsonlPath)) return null;
    
    const data = fs.readFileSync(jsonlPath, 'utf8');
    const lines = data.trim().split('\n');
    const lastLines = lines.slice(-100); // Get last 100 lines
    
    for (let i = lastLines.length - 1; i >= 0; i--) {
      const line = lastLines[i];
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        
        // Check for model_change event
        if (entry.type === 'model_change' && entry.modelId) {
          return entry.modelId.toLowerCase();
        }
        
        // Check for model-snapshot custom event
        if (entry.type === 'custom' && entry.customType === 'model-snapshot' && entry.data?.modelId) {
          return entry.data.modelId.toLowerCase();
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

// Check if session has recent message activity (within last 5 seconds)
function getSessionMessageActivity(sessionId, maxLines = 50) {
  try {
    const jsonlPath = path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
    if (!fs.existsSync(jsonlPath)) {
      return { hasRecentActivity: false, lastActivity: null, model: null };
    }

    const data = fs.readFileSync(jsonlPath, 'utf8');
    const lines = data.trim().split('\n');

    // Check last N lines for recent activity
    const lastLines = lines.slice(-maxLines);
    const fiveSecondsAgo = Date.now() - 5000; // 5 second window

    for (let i = lastLines.length - 1; i >= 0; i--) {
      const line = lastLines[i];
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        // Handle both numeric timestamps and ISO date strings
        const entryTime = entry.timestamp ? new Date(entry.timestamp).getTime() : null;
        if (entryTime && entryTime > fiveSecondsAgo) {
          return {
            hasRecentActivity: true,
            lastActivity: entryTime,
            model: entry.modelId || entry.model || null
          };
        }
      } catch (e) {
        continue;
      }
    }
    return { hasRecentActivity: false, lastActivity: null, model: null };
  } catch (err) {
    console.error(`[STATUS] Error checking session ${sessionId}:`, err.message);
    return { hasRecentActivity: false, lastActivity: null, model: null };
  }
}

// Check if main session has recent activity (for Flint status)
function getMainSessionActivity() {
  try {
    const sessions = readSessionsIndex();
    if (!sessions || !sessions['agent:main:main']) return null;

    const mainSession = sessions['agent:main:main'];
    const sessionId = mainSession.sessionId;
    if (!sessionId) return null;

    return getSessionMessageActivity(sessionId, 50);
  } catch (err) {
    console.error('[STATUS] Error checking main session:', err.message);
    return null;
  }
}

// Get real agent status from OpenClaw sessions
function getRealAgentStatus() {
  const sessions = readSessionsIndex();
  const agentsData = loadAgentsData();
  
  if (!sessions) {
    console.log('[STATUS] No sessions data, using fallback');
    return getFallbackStatus(agentsData);
  }

  // Check main session for Flint's activity (model-agnostic)
  const mainActivity = getMainSessionActivity();
  const flintActive = mainActivity?.hasRecentActivity || false;
  const flintModel = mainActivity?.model || null;
  
  console.log(`[STATUS] Main session activity: active=${flintActive}, model=${flintModel}`);

  // Track Cipher activity separately - only if there's an ACTIVE subagent with recent MESSAGES
  let cipherActive = false;
  let cipherSession = null;

  // Analyze each session for Cipher (subagents, etc.) - check actual message activity
  for (const [sessionKey, sessionData] of Object.entries(sessions)) {
    const sessionId = sessionData.sessionId;
    if (!sessionId) continue;

    // Skip main session - we already handled Flint above
    if (sessionKey === 'agent:main:main') continue;

    // Get model from JSONL file (most recent) or fallback to sessions.json
    let model = getLatestModel(sessionId);

    // Fallback: try to get model from session data or origin
    if (!model) {
      model = (sessionData.model || sessionData.origin?.model || '').toLowerCase();
    }

    const label = (sessionData.label || sessionData.origin?.label || '').toLowerCase();

    // Cipher: kimi models OR label containing 'cipher'
    const isCipherModel = model.includes('kimi') || model === 'k2p5' || model.includes('moonshot') || label.includes('cipher');

    if (!isCipherModel) continue;

    // Check for ACTUAL recent message activity in this subagent session (not just updatedAt)
    const activity = getSessionMessageActivity(sessionId, 20);

    console.log(`[STATUS] Session ${sessionKey}: model=${model}, label=${label}, recentMsg=${activity.hasRecentActivity}`);

    if (activity.hasRecentActivity) {
      cipherActive = true;
      cipherSession = { key: sessionKey, model, label };
      // Don't break - continue checking to log all active cipher sessions
    }
  }

  console.log(`[STATUS] Result: Flint=${flintActive ? 'working' : 'idle'}, Cipher=${cipherActive ? 'working' : 'idle'}`);

  // Build status array with EXP/level data from agents.json
  const agents = [];
  
  if (agentsData && agentsData.agents) {
    // Build from agents.json with real status
    for (const [key, agent] of Object.entries(agentsData.agents)) {
      let status = 'idle';
      if (key === 'Flint') status = flintActive ? 'working' : 'idle';
      else if (key === 'Cipher') status = cipherActive ? 'working' : 'idle';
      
      agents.push({
        name: agent.name,
        role: agent.rank,
        status: status,
        color: agent.color,
        level: agent.level,
        exp: agent.exp,
        nextLevel: agent.nextLevel,
        expProgress: Math.round((agent.exp / agent.nextLevel) * 100),
        session: key === 'Flint' ? (flintActive ? { key: 'agent:main:main', model: flintModel || 'active' } : null) : 
                 (key === 'Cipher' && cipherActive ? cipherSession : null)
      });
    }
  } else {
    // Fallback without agents.json
    agents.push(
      { 
        name: 'Flint', 
        role: 'Lead', 
        status: flintActive ? 'working' : 'idle', 
        color: '#FF8C00',
        level: 1,
        exp: 0,
        nextLevel: 500,
        expProgress: 0,
        session: flintActive ? { key: 'agent:main:main', model: flintModel || 'active' } : null
      },
      { 
        name: 'Cipher', 
        role: 'Coder', 
        status: cipherActive ? 'working' : 'idle', 
        color: '#00D4FF',
        level: 1,
        exp: 0,
        nextLevel: 500,
        expProgress: 0,
        session: cipherSession
      },
      { 
        name: 'Scout', 
        role: 'Research', 
        status: 'idle', 
        color: '#00CC66',
        level: 1,
        exp: 0,
        nextLevel: 500,
        expProgress: 0,
        session: null
      }
    );
  }

  return agents;
}

// Fallback status when we can't read real data
function getFallbackStatus(agentsData) {
  if (agentsData && agentsData.agents) {
    return Object.values(agentsData.agents).map(agent => ({
      name: agent.name,
      role: agent.rank,
      status: 'idle',
      color: agent.color,
      level: agent.level,
      exp: agent.exp,
      nextLevel: agent.nextLevel,
      expProgress: Math.round((agent.exp / agent.nextLevel) * 100),
      session: null
    }));
  }
  
  return [
    { name: 'Flint', role: 'Lead', status: 'idle', color: '#FF8C00', level: 1, exp: 0, nextLevel: 500, expProgress: 0, session: null },
    { name: 'Cipher', role: 'Coder', status: 'idle', color: '#00D4FF', level: 1, exp: 0, nextLevel: 500, expProgress: 0, session: null },
    { name: 'Scout', role: 'Research', status: 'idle', color: '#00CC66', level: 1, exp: 0, nextLevel: 500, expProgress: 0, session: null }
  ];
}

// Get activity feed from agents.json history
function getActivityFeed() {
  const agentsData = loadAgentsData();
  if (!agentsData || !agentsData.history) {
    return [];
  }
  
  // Transform history into activity feed format
  const activities = agentsData.history.map(item => {
    const timestamp = item.timestamp || new Date().toISOString();
    const time = new Date(timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const expChange = item.exp > 0 ? `+${item.exp}` : `${item.exp}`;
    return {
      time,
      agent: item.agent,
      action: item.note || item.action,
      expChange,
      exp: item.exp,
      date: item.date
    };
  });
  
  // Sort by date/time descending, take last 10
  return activities.reverse().slice(0, 10);
}

// Get EXP leaderboard (agents sorted by total EXP)
function getLeaderboard() {
  const agentsData = loadAgentsData();
  if (!agentsData || !agentsData.agents) {
    return [];
  }
  
  return Object.values(agentsData.agents)
    .map(agent => ({
      name: agent.name,
      exp: agent.exp,
      level: agent.level,
      color: agent.color
    }))
    .sort((a, b) => b.exp - a.exp);
}

// Get recent shipments/bugs (last 3-5 events)
function getRecentEvents() {
  const agentsData = loadAgentsData();
  if (!agentsData || !agentsData.history) {
    return [];
  }
  
  return agentsData.history
    .slice(-5)
    .reverse()
    .map(item => ({
      agent: item.agent,
      action: item.note || item.action,
      exp: item.exp,
      expChange: item.exp > 0 ? `+${item.exp}` : `${item.exp}`
    }));
}

// Get system health info
function getSystemHealth() {
  const uptime = Date.now() - SERVER_START_TIME;
  const uptimeSecs = Math.floor(uptime / 1000);
  const hours = Math.floor(uptimeSecs / 3600);
  const mins = Math.floor((uptimeSecs % 3600) / 60);
  const secs = uptimeSecs % 60;
  
  return {
    uptime: `${hours}h ${mins}m ${secs}s`,
    uptimeMs: uptime,
    startTime: new Date(SERVER_START_TIME).toISOString(),
    startTimeFormatted: new Date(SERVER_START_TIME).toLocaleString('en-US'),
    status: 'OPERATIONAL'
  };
}

// Cached wrapper
function getCachedAgentStatus() {
  const now = Date.now();
  if (cachedStatus && (now - cacheTimestamp) < CACHE_TTL_MS) {
    console.log(`[CACHE] Returning cached status (age: ${now - cacheTimestamp}ms)`);
    return cachedStatus;
  }
  
  cachedStatus = getRealAgentStatus();
  cacheTimestamp = now;
  return cachedStatus;
}

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);

  // API endpoint - employee status with EXP/level data
  if (req.url === '/api/employee-status') {
    try {
      const status = getCachedAgentStatus();
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(JSON.stringify(status));
    } catch (err) {
      console.error('Error getting agent status:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to get agent status' }));
    }
    return;
  }

  // NEW: API endpoint - activity feed
  if (req.url === '/api/activity') {
    try {
      const activities = getActivityFeed();
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(JSON.stringify(activities));
    } catch (err) {
      console.error('Error getting activity feed:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to get activity feed' }));
    }
    return;
  }

  // NEW: API endpoint - dashboard data (leaderboard, recent events, system health)
  if (req.url === '/api/dashboard') {
    try {
      const dashboard = {
        leaderboard: getLeaderboard(),
        recentEvents: getRecentEvents(),
        systemHealth: getSystemHealth()
      };
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(JSON.stringify(dashboard));
    } catch (err) {
      console.error('Error getting dashboard data:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to get dashboard data' }));
    }
    return;
  }

  // Static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    }
  });
});

// Try to bind - first attempt on Meshnet IP, fallback to all interfaces
function startServer() {
  server.listen(PORT, MESHNET_IP, () => {
    console.log(`✅ Server running on http://${MESHNET_IP}:${PORT}`);
    console.log(`📱 Access from your iPhone: http://${MESHNET_IP}:${PORT}`);
    console.log(`🔌 Real-time agent status: ENABLED (cache: ${CACHE_TTL_MS}ms)`);
    console.log(`📊 Dashboard endpoints:`);
    console.log(`   - /api/employee-status (agents with EXP/levels)`);
    console.log(`   - /api/activity (timestamped events)`);
    console.log(`   - /api/dashboard (leaderboard + events + health)`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRNOTAVAIL') {
      console.log(`⚠️  Meshnet IP ${MESHNET_IP} not available, trying 0.0.0.0...`);
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
        console.log(`📱 Access from local network: http://<local-ip>:${PORT}`);
      });
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer();
