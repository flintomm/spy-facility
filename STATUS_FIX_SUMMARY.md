# Status Detection Fix - Summary

## Problem
The previous status detection system was unreliable and inconsistent. Flint (main agent) was getting stuck on WORKING forever because the main session always exists, even when idle.

## Solution
Implemented simplified WORKING/IDLE status detection with activity timeouts:

### Status Model

| Entity | States | Detection Rule |
|--------|--------|----------------|
| **Flint** (main agent) | WORKING / IDLE | JSONL activity in last 60s = WORKING, else IDLE |
| **Subagent** (Cipher/Vera/etc) | WORKING / IDLE | Registered in agent-sessions.json + JSONL activity in last 30s = WORKING, else IDLE |

### Key Changes

1. **Flint Timeout (60s)**: Generous timeout to account for thinking/deep work periods
2. **Subagent Timeout (30s)**: Tighter timeout since subagents should be actively working when spawned
3. **Removed complex logic**: Eliminated CLI polling, context growth tracking, grace periods, and label parsing
4. **Activity-based only**: Status determined solely by timestamp of last JSONL entry

## Files Modified

### 1. `spy-facility/server.js`
- **Replaced** complex `getActiveAgentStatus()` function (150+ lines) with simple `getAgentStatus()` (~60 lines)
- **Removed**: CLI session polling, context growth tracking, recentlyActive grace period, label parsing fallback
- **Added**: Simple timestamp comparison logic with clear comments explaining timeout rationale
- **Added**: Clear startup logging showing timeout configuration

### 2. `spy-facility/test-status.js` (new file)
- Test suite for validating status detection logic
- Tests JSONL reading, registry loading, API response, and timeout logic

## API Response

The `/api/employee-status` endpoint now returns clean WORKING/IDLE status:

```json
{
  "status": "ok",
  "agents": [
    {"name": "Flint", "status": "working", ...},
    {"name": "Cipher", "status": "idle", ...},
    ...
  ]
}
```

## Testing Results

All tests pass:
- ✅ JSONL entry reading
- ✅ Agent sessions registry loading
- ✅ API endpoint response
- ✅ Timeout logic validation

## Backward Compatibility

- API response structure unchanged (only `status` field values simplified)
- Frontend (`index.html`) already compatible - no changes needed
- Existing agent-sessions.json registry still used for subagent detection

## Verification

Server logs confirm new behavior:
```
🔌 Simplified status detection: ENABLED
   - Flint timeout: 60s (accounts for thinking/deep work)
   - Subagent timeout: 30s (tight, active work only)
```
