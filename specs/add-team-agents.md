# Spec: Add Remaining Agents to Facility

## Goal
Add Atlas, Forge, Patch, and Sentry to the 87 Deer Crossing Lane facility visualization so all working agents are visible (per security policy).

## Agents to Add

### Atlas — Technical Director
- **Role:** Technical Director
- **Color:** #3366CC (blue)
- **Desk:** Blueprints, red pen
- **Pod:** 3 (top row, rightmost)
- **Model:** Opus 4.6
- **Status:** idle (until spawned)

### Forge — Complex Coder
- **Role:** Heavy Implementer
- **Color:** #CC6600 (orange/forge fire)
- **Desk:** Anvil, hammer, glowing screen
- **Pod:** 4 (bottom row, leftmost)
- **Model:** GPT-5.3 Codex
- **Status:** idle

### Patch — Maintenance
- **Role:** Maintenance
- **Color:** #9966CC (purple)
- **Desk:** Toolbox, manual, coffee stains
- **Pod:** 5 (bottom row, second from left)
- **Model:** Kimi K2.5
- **Status:** idle

### Sentry — QA/Tester
- **Role:** QA
- **Color:** #CC3333 (red)
- **Desk:** Checklist, bug reports, magnifying glass
- **Pod:** 6 (bottom row, third from left)
- **Model:** MiniMax M2.1
- **Status:** idle

## Files to Modify

### 1. `data/agents.json`
Add 4 new agent entries with:
- name, rank, color, level=1, exp=0, nextLevel=500
- desk: empty array for now (desk items optional)
- podIndex matching assignments above

### 2. `index.html`
Add 4 entries to `AGENTS` array:
```javascript
{
  name: 'Atlas', role: 'Tech Director', color: '#3366CC', podIndex: 3,
  deskItems: [], status: 'idle', level: 1, exp: 0, nextLevel: 500, expProgress: 0
},
{
  name: 'Forge', role: 'Heavy Coder', color: '#CC6600', podIndex: 4,
  deskItems: [], status: 'idle', level: 1, exp: 0, nextLevel: 500, expProgress: 0
},
{
  name: 'Patch', role: 'Maintenance', color: '#9966CC', podIndex: 5,
  deskItems: [], status: 'idle', level: 1, exp: 0, nextLevel: 500, expProgress: 0
},
{
  name: 'Sentry', role: 'QA', color: '#CC3333', podIndex: 6,
  deskItems: [], status: 'idle', level: 1, exp: 0, nextLevel: 500, expProgress: 0
}
```

### 3. Sprites
For now, reuse existing sprites:
- Atlas, Forge, Patch, Sentry → reuse `CIPHER_PAL` and `CIPHER_STAND` etc.
- Update `AgentEntity.getSprites()` to return Cipher sprites for these names

Later: We can create unique sprites for each agent.

## Server-Side Status Mapping
In `server.js` `getActiveAgentStatus()`, ensure these labels are detected:
- `label.includes('atlas')` → status.Atlas = true
- `label.includes('forge')` → status.Forge = true
- `label.includes('patch')` → status.Patch = true
- `label.includes('sentry')` → status.Sentry = true

These mappings already exist but verify they work.

## Chunks
**Chunk 1:** Update `data/agents.json` with 4 new agents
**Chunk 2:** Update `index.html` AGENTS array and getSprites mapping

## Testing
- Refresh facility page
- Should see 7 agents total (Flint, Cipher, Scout, Atlas, Forge, Patch, Sentry)
- All new agents at their assigned pods
- Status bar shows all 7 agent cards
- EXP bars at 0%

## Edge Cases
- Don't break existing agent positions (Flint/Cipher/Scout stay at pods 0,1,2)
- Ensure podIndex 3-6 are actually empty in the PODS array
- If level/nextLevel missing, default safely in frontend