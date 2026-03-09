# Contributing

## Development Workflow

1. Fork and create a feature branch.
2. Make focused changes with tests.
3. Run:
   - `npm run test`
4. Open a pull request with:
   - problem statement
   - behavior change summary
   - verification commands and outputs

## Contribution Rules

- Keep changes minimal and atomic.
- Preserve backward compatibility for existing CLI flags.
- Update `README.md` when changing install or usage behavior.
- Keep `kit/docs/session/*` templates in sync with script behavior.

## Commit Guidance

Use clear, imperative commit messages, for example:

- `fix: support spaced cli args in session validators`
- `chore: add standalone github actions workflow`
