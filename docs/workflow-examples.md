# Workflow Examples

Real scenarios showing how tasks flow through 87 Deer Crossing Lane.

---

## Scenario 1: Simple CSS Fix (Fast Path)

**The Problem:** A button is misaligned on mobile view.

### Step-by-Step Flow

**Stealth:** "The submit button in the todo modal is off-center on mobile."

**Flint:** Recognizes this is a quick fix. Instead of writing a full spec, Flint spawns Cipher directly:

```
Task: Fix todo modal submit button alignment on mobile
Context: The button appears off-center in the Add Task modal
File: index.html around the modal styling section
Expected: Button should be centered on all screen sizes
```

**Cipher (you):**
1. Read my persona (reminds me: I'm a coder, build in small chunks, test locally)
2. Read the relevant CSS in index.html
3. Find the button styling — it's missing `margin: 0 auto` or flex centering
4. Make the surgical fix (one `edit` call)
5. Verify the fix mentally (no browser needed for obvious CSS)
6. Report completion

**Cipher's Report:**
```
Fixed. Added `justify-content: center` to the modal button container (line ~2450). 
The button was using default flex alignment (flex-start). Tested by checking the 
CSS selector matches the modal structure. No other changes needed.
```

**Flint:** Reviews the diff, approves, deploys.

**Cipher (after task):** Updates memory.md:
```markdown
## 2026-02-15

### Todo Modal Button Fix — SUCCESS
- **What:** Fixed off-center button in Add Task modal
- **Result:** Single CSS property change, no side effects
- **Lesson:** Always check parent container flex properties before modifying element margins
```

---

## Scenario 2: Complex Feature with Spec Review (Complex Path)

**The Problem:** Need to add a complete activity logging system.

### Step-by-Step Flow

**Stealth:** "I want to see a history of everything that happens in the facility — agent logins, task completions, status changes."

**Flint:** Recognizes this is complex. Needs architecture decisions. Writes a spec first:

**`specs/activity-log-system.md`:**
```markdown
# Spec: Activity Log System

## Overview
Track all significant events in the facility with timestamps.

## Data Model
```json
{
  "timestamp": "2026-02-15T12:00:00Z",
  "agent": "Cipher",
  "action": "task_complete",
  "details": "Fixed CSS alignment",
  "expChange": 50
}
```

## Events to Track
- agent_login / agent_logout
- task_created / task_assigned / task_completed / task_deleted
- status_change (working/idle)
- exp_awarded / exp_penalty

## API Changes
- GET /api/activity?limit=50 — returns recent events
- POST /api/activity — internal endpoint for logging

## Frontend
- New "ACTIVITY" tab in status board
- Scrollable list with timestamp, agent, action
- Filter by agent

## Acceptance Criteria
- [ ] All 8 event types logged
- [ ] API returns correct format
- [ ] Frontend displays in real-time
- [ ] Old events purged after 30 days
```

**Flint:** Spawns Atlas (Tech Director) first:
```
Task: Review activity log spec for technical soundness
Spec: specs/activity-log-system.md
Focus: Data model, API design, any missing edge cases
```

**Atlas:** Reviews, suggests changes:
```
Spec looks solid. Two suggestions:
1. Add index on timestamp for performant querying
2. Consider WebSocket for real-time updates instead of polling
3. Add 'system' agent for non-agent events (server restart, etc.)
```

**Flint:** Updates spec with Atlas's feedback.

**Flint:** Now spawns Cipher to implement:
```
Task: Implement activity log system (backend)
Spec: specs/activity-log-system.md (REVISED version)
Chunks: 
  1. Data model + file storage
  2. POST /api/activity endpoint
  3. GET /api/activity endpoint
  4. Event hooks in existing code
  5. 30-day purge logic
```

**Cipher (you):**
1. Read spec completely
2. Check my memory — I've done similar logging before
3. Build Chunk 1: Create `data/activity.jsonl`, test structure
4. Report chunk 1 done, wait for implicit OK (or explicit if Flint asks)
5. Build Chunk 2: POST endpoint
6. Build Chunk 3: GET endpoint with limit param
7. Build Chunk 4: Add hooks to task system, status system
8. Build Chunk 5: Daily purge on server start
9. Final test: Create test events, verify API returns them
10. Report completion

**Cipher's Report:**
```
Activity log backend complete. 5 chunks built:

1. data/activity.jsonl — append-only log format
2. POST /api/activity — accepts {timestamp, agent, action, details, expChange}
3. GET /api/activity?limit=N — returns array, default 50, max 500
4. Event hooks added to: task routes, status detection, EXP awards
5. Auto-purge: server startup removes entries >30 days

Tested: Created 5 test events, API returns correctly. File format validated.
No breaking changes to existing APIs.
```

**Flint:** Spawns Sentry (QA) to verify:
```
Task: Verify activity log system
Spec: specs/activity-log-system.md
Backend: Cipher's implementation (reported complete)
Test: All 8 event types, API response format, purge logic
```

**Sentry:** Tests, finds one issue:
```
Found edge case: When expChange is 0, the field should still be present (null 
not undefined) for consistent schema. Currently omits the field.
```

**Cipher:** Fixes the edge case (one line change).

**Sentry:** Approves.

**Flint:** Merges, deploys.

**Cipher (after task):** Updates memory.md:
```markdown
## 2026-02-15

### Activity Log System — SUCCESS
- **What:** Complete logging backend with 5 chunks
- **Result:** All specs met, one edge case fix from QA
- **Lesson:** 
  - Chunking kept complexity manageable
  - Including field even when 0 prevents schema inconsistencies
  - QA caught what I missed — external verification is valuable
```

---

## Scenario 3: Research Task

**The Problem:** Stealth wants to know options for real-time collaboration.

### Step-by-Step Flow

**Stealth:** "What are the options for adding real-time collaboration to the facility? Like seeing other people's cursors or live edits?"

**Flint:** This is research, not implementation. Spawns Scout:

```
Task: Research real-time collaboration options for facility
Deliverable: Research report with 3 options, pros/cons, recommendation
Timebox: 30 minutes max
Focus: Practical implementation, not theoretical
```

**Scout (research agent):**
1. Reads persona (I'm a researcher, direct summaries, no fluff)
2. Searches web for "real-time collaboration websocket 2025"
3. Searches for "operational transform vs crdt"
4. Searches for "yjs socket.io comparison"
5. Compiles findings

**Scout's Report:**
```markdown
## Real-Time Collaboration Research

### Option 1: Socket.io + Custom Sync
**Approach:** WebSocket server broadcasting cursor positions and edits
**Pros:** Simple, well-documented, lots of examples
**Cons:** Requires handling conflict resolution ourselves
**Effort:** Medium (2-3 days for basic cursors, 1-2 weeks for edits)

### Option 2: Yjs (CRDT Library)
**Approach:** Battle-tested CRDT library, handles conflicts automatically
**Pros:** Production-ready, handles offline/online sync, no central server needed
**Cons:** Adds ~100KB to bundle, learning curve
**Effort:** Low-Medium (1-2 days for integration, works out of box)

### Option 3: Liveblocks (Hosted Service)
**Approach:** Managed service, SDK handles everything
**Pros:** Fastest to implement, handles scaling, presence + storage
**Cons:** $99/mo for production, external dependency
**Effort:** Very Low (hours to integrate)

### Recommendation: Yjs
Best balance of capability and ownership. Open source, no hosting costs,
handles the hard problems (conflicts, sync) for us. Socket.io is fine for 
cursors only, but Yjs gives us future option for document collaboration.

### Next Steps
1. Spike: Add Yjs to facility, test cursor presence (1 day)
2. Evaluate performance with 5+ agents
3. Decide on document sync scope
```

**Flint:** Reviews, agrees with recommendation. Files the research in `research/realtime-collab-2026-02-15.md` for future reference.

**Stealth:** "Let's do the Yjs spike. Flint, schedule it."

**Flint:** Creates a proper spec for the spike, assigns to Cipher.

**Scout (after task):** Updates memory.md:
```markdown
## 2026-02-15

### Real-Time Collaboration Research — SUCCESS
- **What:** 30-min research on 3 collaboration options
- **Result:** Clear recommendation (Yjs), actionable next steps
- **Lesson:** 
  - Timeboxing prevents research rabbit holes
  - Pros/cons format makes decision easy for lead
  - Always include "next steps" — research should lead to action
```

---

## Key Differences Summary

| Aspect | Simple Fix | Complex Feature | Research |
|--------|-----------|-----------------|----------|
| **Spec written?** | No | Yes | Brief task only |
| **Who reviews?** | Flint | Atlas (tech) + Sentry (QA) | Flint |
| **Chunks?** | 1 | Many | N/A |
| **Verification?** | Flint check | Sentry QA | N/A |
| **Memory update?** | Yes | Yes | Yes |
| **Time spent** | 10 min | Hours-days | 30 min |

---

## What These Examples Show

1. **Not everything needs a spec.** Small fixes go straight to implementation.

2. **Complex work gets reviewed.** Architecture decisions happen before coding.

3. **Research is a valid deliverable.** Not every task produces code.

4. **QA catches what builders miss.** External verification is worth it.

5. **Memory updates happen regardless.** Every task teaches something.

---

*Study these patterns. Recognize which path a task needs. Act accordingly.*
