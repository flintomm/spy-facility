# To-Do System v2 — Specification

## Overview
Enhanced to-do board with assignment, delegation, permissions, and activity logging.

## Data Model

```json
{
  "id": 1,
  "text": "Task description",
  "done": false,
  "createdAt": "2026-02-13T22:00:00Z",
  "createdBy": "Flint",
  "assignedTo": "Cipher",
  "completedAt": null
}
```

## API Endpoints

### GET /api/todos
Returns array of todo objects.

### POST /api/todos
**Actions:**

1. `add` - Create new task
   - Body: `{ action: 'add', text: '...', assignedTo?: 'AgentName' }`
   - Auto-assigns createdBy from request header or default

2. `toggle` - Complete/incomplete
   - Body: `{ action: 'toggle', id: 123 }`
   - Sets completedAt when done

3. `delete` - Remove task
   - Body: `{ action: 'delete', id: 123 }`

4. `assign` - Self-assign or delegate (T3+ only)
   - Body: `{ action: 'assign', id: 123, assignedTo: 'AgentName' }`
   - Requires auth header or query param for requester

5. `unassign` - Clear assignment
   - Body: `{ action: 'unassign', id: 123 }`

## Permissions

| Tier | Can Add | Can Complete | Can Assign (self) | Can Delegate (others) |
|------|---------|--------------|-------------------|----------------------|
| T1   | ✓       | ✓            | ✓                 | ✓                    |
| T2   | ✓       | ✓            | ✓                 | ✓                    |
| T3   | ✓       | ✓            | ✓                 | ✓                    |
| T4   | ✓       | ✓            | ✓                 | ✗                    |
| T5   | ✓       | ✓            | ✓                 | ✗                    |

- "Assign (self)" = clicking own name to claim
- "Delegate" = assigning to someone else (T3+)

## UI - Compact Status Board

**Layout:**
- Left side: Task list (scrollable, ~100px per line)
- Right side: Quick actions panel

**Each task line shows:**
```
[ ] TASK TEXT............... [Assignee] [X]
```

- Checkbox on left
- Task text (truncated to fit)
- Assignee badge (or "Unassigned")
- Delete X button (for creator/admin)

**Colors:**
- Unassigned: dim gray badge
- Self-assigned: cyan badge
- Assigned to others: purple badge
- Completed: strikethrough, green check

## UI - Expanded Modal

**Layout:**
- Full task list with more detail
- Assignment dropdown
- Filter by: All / Mine / Assigned to Me / Unassigned

**Each task card shows:**
- Checkbox
- Full task text
- Created by: Agent (timestamp)
- Assigned to: Agent (click to change)
- Delete button

**Header bar:**
- Filter buttons: [ALL] [MINE] [UNASSIGNED]
- [+ ADD] button

## Activity Logging

Every action logs to activity stream:

```
[TIME] Agent: added task "TASK TEXT"
[TIME] Agent: completed task "TASK TEXT"
[TIME] Agent: assigned task "TASK TEXT" to OtherAgent
[TIME] Agent: delegated task "TASK TEXT" to OtherAgent
[TIME] Agent: deleted task "TASK TEXT"
[TIME] Agent: unassigned task "TASK TEXT"
```

## Implementation Notes

1. Pass `requester` in API call (query param or header)
2. Server checks T3+ for delegation
3. Activity logging updates both todos.json history AND activity feed
4. Frontend polls for updates
5. Assignment dropdown shows all agents

## Files to Modify

- `server.js` - Enhanced /api/todos endpoints
- `data/todos.json` - New data structure
- `index.html` - Both compact and modal UI
