# Skills

Project-specific skills for Claude Code live here, one directory per skill:

```
.claude/skills/
  my-skill/
    SKILL.md    # frontmatter (name, description) + step-by-step instructions
```

## When to add a skill

Add a skill when a task is (1) recurring, (2) multi-step, and (3) benefits from a written procedure. Likely candidates for this project:

- `add-exercise` — scaffold a new exercise type end to end (type, migration, repository, UI)
- `new-screen` — scaffold an expo-router screen following the project's layout conventions
- `release` — version bump, changelog, EAS build steps

## When NOT to add one

- One-off tasks — just ask Claude directly.
- Things CLAUDE.md already covers (commands, conventions).
- Deep reference material — put that in `agent_docs/` instead and link it from CLAUDE.md.
