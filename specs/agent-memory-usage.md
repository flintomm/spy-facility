# Spec: Agent Memory System — Usage

## Overview
Each agent loads their memory when spawned, and updates it when done. Agents learn over time.

## Directory Structure (Already Created)
```
memory/
  cipher/
    lessons-learned.md   # What worked, what didn't
    patterns.md          # Successful approaches
  sentry/
    test-patterns.md     # Testing approaches
    bug-database.md      # Bugs found (for pattern recognition)
  atlas/
    design-principles.md # Architecture lessons
  forge/
    (empty - to be populated)
  patch/
    (empty - to be populated)
  scout/
    (empty - to be populated)
```

## Spawn Protocol

When Flint spawns an agent, include memory context:

```javascript
sessions_spawn({
  task: `
    **Your Memory (read this first):**
    ${readFile('memory/cipher/lessons-learned.md')}
    ${readFile('memory/cipher/patterns.md')}
    
    **Task:**
    Build XYZ feature...
    
    **When Done:**
    Update your memory files with lessons learned.
  `,
  label: 'cipher-task-name',
  model: 'kimi'
})
```

## Memory Update Protocol

At end of task, agent writes to their memory:

**If success:**
- Add to patterns.md what worked
- Note any new techniques in lessons-learned.md

**If failure/issues:**
- Document what went wrong in lessons-learned.md
- Add to patterns.md what to avoid

## Implementation

### Phase 1: Manual (Now)
- Flint manually reads agent memory before spawning
- Flint manually includes memory in task context
- Agent manually updates files at task end

### Phase 2: Helper Function (Later)
- Create `spawnWithMemory(agent, task)` helper
- Automatically loads and includes memory
- Automatically prompts for memory update

## Example: Spawning Cipher

```
Read memory/cipher/lessons-learned.md
Read memory/cipher/patterns.md

sessions_spawn({
  task: `
    **Your Memory:**
    [contents of lessons-learned.md]
    [contents of patterns.md]
    
    **Task:** Build galley coordinate fix
    
    **When Complete:** Update memory/cipher/lessons-learned.md with what you learned.
  `,
  label: 'cipher-galley-fix',
  model: 'kimi'
})
```

## Acceptance Criteria
- [ ] Agents receive their memory when spawned
- [ ] Agents update memory after completing tasks
- [ ] Memory persists across sessions
- [ ] Patterns improve over time (measurable)
