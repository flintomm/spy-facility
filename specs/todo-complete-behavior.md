# Spec: Todo Complete Behavior + Confirm Dialog Fix

## Overview
Two changes:
1. Checkbox clicks should **complete + remove** tasks (not toggle done state)
2. Fix broken "No" button in confirm dialog

## Change 1: Checkbox = Complete + Remove

### Server (server.js)
Add a new `complete` action in the POST `/api/todos` handler, right after the `toggle` block (~line 900):

```javascript
} else if (action === 'complete' && id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        logActivity(requester, 'completed task', todo.text);
        addToAgentsHistory(requester, 'task_complete', `${requester} completed ${todo.text}`);
        todos = todos.filter(t => t.id !== id);
    }
}
```

Key points:
- Logs activity BEFORE removing (need the todo reference for text)
- Uses `logActivity` for the todo-activity feed
- Uses `addToAgentsHistory` for the agents.json EXP/history feed
- Removes from the array after logging
- No permission check needed (anyone can complete)

### Frontend (index.html)

**Modal view** (~line 2120): Change the toggle handler:
```
// BEFORE:
if (pos.type === 'todo' || pos.type === 'toggle') {
    body: JSON.stringify({ action: 'toggle', id: pos.id })

// AFTER:
if (pos.type === 'todo' || pos.type === 'toggle') {
    body: JSON.stringify({ action: 'complete', id: pos.id })
```

**Compact view** (~line 2200): Change the toggle handler:
```
// BEFORE:  
body: JSON.stringify({ action: 'toggle', id: pos.id })

// AFTER:
body: JSON.stringify({ action: 'complete', id: pos.id })
```

There are exactly 2 places in `handleStatusBarClick` that send `action: 'toggle'`:
1. Inside the `if (modalOpen)` block, under `if (pos.type === 'todo' || pos.type === 'toggle')`
2. Inside the compact (non-modal) block, under `if (pos.type === 'todo')`

Change BOTH to send `action: 'complete'`.

## Change 2: Fix Confirm "No" Button

In `handleConfirmClick` function (~line 2685), there's a comparison chain bug:

```javascript
// BROKEN:
if (mouseX >= confirmModal.noPos.x <= confirmModal.noPos.x + confirmModal.noPos.width &&

// FIXED:
if (mouseX >= confirmModal.noPos.x && mouseX <= confirmModal.noPos.x + confirmModal.noPos.width &&
```

The bug: `mouseX >= confirmModal.noPos.x` evaluates to `true`/`false` (0 or 1), then `1 <= confirmModal.noPos.x + confirmModal.noPos.width` is always true. This causes the No button to fire on any click in its Y-range regardless of X position.

## Files to Edit
1. `server.js` — Add 'complete' action (~3 lines)
2. `index.html` — Change 2x 'toggle' to 'complete' + fix comparison (~3 lines total)

## Testing
After changes:
1. Add a todo via the UI
2. Click the checkbox → task should disappear from list
3. Check Activity tab → should show "AGENT completed TASK"
4. Click delete (✕) → confirm dialog should appear, Yes deletes, No cancels
5. Verify via `curl http://localhost:8080/api/todos/activity` that activity entries exist

## Do NOT
- Remove the existing 'toggle' action from the server (keep for backward compat)
- Change any drawing code
- Add console.log statements
- Touch any other functionality
