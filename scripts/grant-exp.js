#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const agentsPath = path.join(ROOT, 'data', 'agents.json');
const activityPath = path.join(ROOT, 'data', 'todo-activity.json');

function loadJson(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error(`[grant-exp] Failed to read ${filePath}:`, err.message);
  }
  return fallback;
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Normalize model names to canonical short names.
 * Maps provider/variant strings → simple model family name.
 */
function normalizeModel(raw) {
  if (!raw) return 'unknown';
  const s = raw.toLowerCase().trim();

  // Claude family
  if (s.includes('opus')) return 'claude-opus';
  if (s.includes('sonnet')) return 'claude-sonnet';
  if (s.includes('haiku')) return 'claude-haiku';
  if (s.includes('claude')) return 'claude';

  // GPT family
  if (s.includes('gpt-5') || s.includes('gpt5')) return 'gpt-5';
  if (s.includes('gpt-4') || s.includes('gpt4')) return 'gpt-4';
  if (s.includes('o3')) return 'o3';
  if (s.includes('o4-mini')) return 'o4-mini';
  if (s.includes('codex')) return 'codex';

  // Gemini family
  if (s.includes('gemini-2.5-pro') || s.includes('gemini-pro')) return 'gemini-pro';
  if (s.includes('gemini-2.5-flash') || s.includes('gemini-flash')) return 'gemini-flash';
  if (s.includes('gemini')) return 'gemini';

  // Kimi / Moonshot
  if (s.includes('kimi') || s.includes('k2p5') || s.includes('k2-p5') || s.includes('moonshot') || s.includes('kimi-coding')) return 'kimi';

  // Grok
  if (s.includes('grok')) return 'grok';

  // DeepSeek
  if (s.includes('deepseek')) return 'deepseek';

  // Qwen
  if (s.includes('qwen')) return 'qwen';

  // Mistral
  if (s.includes('mistral')) return 'mistral';

  return raw; // Return as-is if no match
}

function usage() {
  console.log('Usage: node scripts/grant-exp.js <agent> <exp> "Reason" [--by Stealth] [--model <model>]');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 3) usage();

const agentName = args[0];
const expDelta = Number(args[1]);
if (Number.isNaN(expDelta)) usage();
const reason = args[2];

let grantedBy = 'Flint';
const byIndex = args.indexOf('--by');
if (byIndex !== -1 && args[byIndex + 1]) {
  grantedBy = args[byIndex + 1];
}

let model = 'unknown';
const modelIndex = args.indexOf('--model');
if (modelIndex !== -1 && args[modelIndex + 1]) {
  model = normalizeModel(args[modelIndex + 1]);
}

const agentsData = loadJson(agentsPath, null);
if (!agentsData || !agentsData.agents || !agentsData.agents[agentName]) {
  console.error(`[grant-exp] Agent "${agentName}" not found in agents.json`);
  process.exit(1);
}

const agent = agentsData.agents[agentName];
agent.exp = (agent.exp || 0) + expDelta;
if (agent.exp < 0) agent.exp = 0;

while (agent.exp >= agent.nextLevel) {
  agent.level += 1;
  agent.nextLevel = Math.floor(agent.nextLevel * 1.5);
}

// Add history entry with model
if (!agentsData.history) agentsData.history = [];
agentsData.history.push({
  agent: agentName,
  action: expDelta >= 0 ? 'ship' : 'bug',
  exp: expDelta,
  note: reason,
  model: model,
  date: new Date().toISOString().split('T')[0],
  timestamp: new Date().toISOString()
});

// Update modelStats
if (!agentsData.modelStats) agentsData.modelStats = {};
if (!agentsData.modelStats[model]) {
  agentsData.modelStats[model] = { tasks: 0, totalExp: 0, wins: 0, losses: 0, agents: {} };
}
const ms = agentsData.modelStats[model];
ms.tasks += 1;
ms.totalExp += expDelta;
if (expDelta > 0) ms.wins += 1;
if (expDelta < 0) ms.losses += 1;
if (!ms.agents[agentName]) ms.agents[agentName] = { tasks: 0, totalExp: 0 };
ms.agents[agentName].tasks += 1;
ms.agents[agentName].totalExp += expDelta;

saveJson(agentsPath, agentsData);

const activity = loadJson(activityPath, []);
const actionText = expDelta >= 0 ? 'received bonus EXP' : 'correction applied';
activity.push({
  time: new Date().toISOString(),
  agent: agentName,
  action: actionText,
  task: reason,
  exp: expDelta,
  grantedBy,
  model: model
});
while (activity.length > 100) {
  activity.shift();
}
saveJson(activityPath, activity);

const expLabel = expDelta >= 0 ? `+${expDelta}` : `${expDelta}`;
console.log(`[grant-exp] ${agentName} ${expLabel} EXP for "${reason}" (granted by ${grantedBy}, model: ${model})`);
