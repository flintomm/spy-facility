# Spec: Improved Activity Log

## Current Problems
1. Fixed view — can't see older entries
2. Cramped text — 50 char limit cuts off important details
3. Awkward wording — "received bonus EXP", "completed task" is robotic
4. No context — doesn't show WHO granted EXP or full task names

## Philosophy: EXP as Feedback

EXP adjustments are **course corrections**, not punishments:
- **+EXP**: Recognition for good work shipped
- **-EXP**: Correction to guide toward better outcomes
- Both are learning opportunities

The wording should reflect this: "-25 correction" not "-25 penalty"

### 1. Better Wording
| Old | New |
|-----|-----|
| "received bonus EXP" | "+{exp} bonus from {grantedBy}" |
| "completed task" | "shipped: {task}" |
| "added task" | "created: {task}" |
| "deleted task" | "cancelled: {task}" |
| "delegated task" | "assigned to {target}: {task}" |
| **correction applied** | "-{exp} correction: {reason}" |

### 2. Scrollable View
- Add `activityScrollOffset` variable (0 = newest)
- Show ~8 lines at a time (was ~12)
- Scroll buttons: ▲ / ▼ at top-right
- Mouse wheel support
- Show scroll position: "1-8 of 47"

### 3. Better Layout
```
[TIME]  AGENT      ACTION + TASK (full width)          EXP
[20:32] Flint      +25 bonus from Stealth: Fixed CLI...
[19:32] Cipher     +50 bonus from Stealth: Portrait...
[19:32] Cipher     -25 correction: Layout issues
```

### 4. Visual Polish
- Alternating row backgrounds (subtle)
- Separator lines between entries
- EXP shown as badge (pill shape) not just text
- Positive: green pill, Negative: red pill, Neutral: gray

## Implementation

### New Constants
```javascript
let activityScrollOffset = 0;
const ACTIVITY_LINES_PER_PAGE = 8;
```

### Scroll Buttons
```javascript
// Up/Down arrows at top-right of activity panel
const scrollBtnY = cliY + 2;
const upBtnX = TARGET_WIDTH - 80;
const downBtnX = TARGET_WIDTH - 50;
// Draw ▲ and ▼ buttons
```

### Improved Rendering
```javascript
// Calculate visible range
const totalItems = activityData.length;
const maxOffset = Math.max(0, totalItems - ACTIVITY_LINES_PER_PAGE);
activityScrollOffset = Math.min(activityScrollOffset, maxOffset);

const visibleItems = activityData.slice(
  activityScrollOffset, 
  activityScrollOffset + ACTIVITY_LINES_PER_PAGE
);

// Better action formatting
function formatAction(act) {
  switch(act.action) {
    case 'received bonus EXP':
      return `+${act.exp} bonus from ${act.grantedBy || 'System'}: ${act.task}`;
    case 'completed task':
      return `shipped: ${act.task}`;
    case 'added task':
      return `created: ${act.task}`;
    case 'deleted task':
      return `cancelled: ${act.task}`;
    case 'delegated task':
      return `assigned to ${act.target}: ${act.task}`;
    default:
      return `${act.action}: ${act.task || ''}`;
  }
}
```

### Click Handling
```javascript
// In handleStatusBarClick for ACTIVITY tab
if (mouseX >= upBtnX && mouseX <= upBtnX + 24) {
  activityScrollOffset = Math.max(0, activityScrollOffset - 1);
  return;
}
if (mouseX >= downBtnX && mouseX <= downBtnX + 24) {
  const maxOffset = Math.max(0, activityData.length - ACTIVITY_LINES_PER_PAGE);
  activityScrollOffset = Math.min(maxOffset, activityScrollOffset + 1);
  return;
}
```

## Files to Modify
- `index.html` — Activity rendering, scroll state, click handlers

## Testing
1. Activity tab shows scroll buttons
2. Click ▲ shows older entries
3. Click ▼ shows newer entries
4. Wording is natural: "+25 bonus from Stealth" not "received bonus EXP"
5. Long task names show truncated with "..."
6. EXP shows as colored pill badge
