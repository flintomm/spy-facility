# Agent Memory System

## Concept
Each subagent maintains their own memory/context, learning from past work to improve future performance.

## Implementation Ideas

### Per-Agent Memory Files
```
memory/
  flint/
  cipher/
    lessons-learned.md
    common-mistakes.md
    successful-patterns.md
  sentry/
    test-patterns.md
    bug-database.md
  atlas/
    design-principles.md
```

### Memory Contents
- **Lessons learned** — What worked, what didn't
- **Common mistakes** — Personal failure patterns
- **Successful patterns** — Approaches that consistently work
- **Project context** — Domain knowledge specific to 87 Deer Crossing Lane

### Usage
- Agent spawned → Load their memory
- Agent works → Update memory with new lessons
- Agent completes → Save state for next time

## Benefits
- Cipher stops making the same bugs
- Sentry builds institutional testing knowledge
- Atlas refines architectural intuition
- Each agent gets better over time

## Status
⬜ **BACKLOG** — Future enhancement
