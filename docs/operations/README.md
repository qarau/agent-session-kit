# ASK Operations Docs

This directory is the operator entrypoint for running ASK at scale.

Use these docs in order:

1. `runtime-architecture.md`: runtime stack, control plane paths, and event flow
2. `policy-reference.md`: policy keys and governance behavior
3. `operator-playbooks.md`: day-to-day runbooks and incident response
4. `ohder-analyzer-playbook.md`: detailed analyzer-warning responses for coupling, durability, authority, security boundary, complexity, and refactor execution plans
5. `future-ohder-runtime.md`: current, partial, planned, and future OHDER capability boundaries

Core commands to keep handy:

- `node ask-core/bin/ask.js next`
- `node ask-core/bin/ask.js governance status`
- `node ask-core/bin/ask.js governance explain`
- `node ask-core/bin/ask.js metrics show --history 20`
- `node ask-core/bin/ask.js project-state`
