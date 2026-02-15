# Todo Delete Button Fix

## Problem
The delete (✕) button on the compact todo view doesn't work when clicked.

## Requirements
1. Fix the delete button click handler so clicking ✕ removes the task
2. When a task is deleted, log it in the Activity Stream as: `"TASK TEXT" has been deleted by XX`
3. Only Stealth, Flint, or T3+ agents can delete tasks

## Files to Modify

### index.html
The compact todo view draws delete buttons at ~line 1888. Each button is stored in `todoPositions` with `type: 'delete'`.

The click handler is in `handleStatusBarClick()` (~line 1985). It checks `pos.type === 'delete'` and calls `fetch('/api/todos', { method: 'POST', body: JSON.stringify({ action: 'delete', id: pos.id }) })`.

**Debug steps:**
1. Check if `todoPositions` array is being populated with delete entries
2. Check if the click detection coordinates match the drawn button coordinates
3. Check if the fetch call is actually firing
4. Check if the server is handling the delete action correctly

### server.js
The `/api/todos` POST handler should already support `action: 'delete'`. Verify it:
1. Removes the todo from the array
2. Saves to file
3. Logs the deletion to the activity stream

**Activity logging format:**
```
"TASK TEXT" has been deleted by AGENT_NAME
```

This should be logged to BOTH:
- `data/agents.json` history array
- `data/todo-activity.json` (if it exists)

### Permission check
Only allow deletion if requester is:
- "Stealth" (the human)
- "Flint" (lead)  
- T3 or higher (Flint=T1, Atlas=T2, Forge=T3)

T4 and below (Cipher, Patch, Sentry, Scout) cannot delete tasks.

Tier mapping:
- T1: Flint (Lead)
- T2: Atlas (Tech Director)
- T3: Forge (Heavy Coder)
- T4: Cipher (Coder)
- T5: Patch, Sentry, Scout (Maintenance, QA, Recon)

## Testing
After changes, restart the server:
```
launchctl stop com.flint.spyservice && sleep 1 && launchctl start com.flint.spyservice
```

Then test with curl:
```
# Add a test task
curl -X POST http://localhost:8080/api/todos -H 'Content-Type: application/json' -H 'X-Requester: Flint' -d '{"action":"add","text":"Test delete task"}'

# Delete it (note the id from the add response)
curl -X POST http://localhost:8080/api/todos -H 'Content-Type: application/json' -H 'X-Requester: Flint' -d '{"action":"delete","id":ID_HERE}'

# Verify activity was logged
curl http://localhost:8080/api/activity
```

## Ship Criteria
- ✕ button click deletes the task in both compact and modal views
- Activity stream shows `"TASK" has been deleted by XX`
- T4/T5 agents get denied (403 or silent ignore)
