# Deep OHDER Analyzer Implementation Plan

## Goal

Deepen the OHDER loop from broad entropy and architecture scoring into concrete analyzers for coupling, durability, authority, complexity, and refactor execution planning.

## Architecture

The implementation extends `ArchitectRuntime` rather than replacing the current governed lifecycle. New analyzers run during OHDER assessment, feed architecture score penalties, and preserve existing slice-close behavior.

## Slice Areas

1. Coupling analyzer
2. Durability validator
3. SSoT / authority analyzer
4. Complexity / SRP analyzer
5. Refactor execution planner
6. Documentation and operator guidance

## Governance

Each slice must be implemented test-first and closed with `ask slice close <taskId>` so OHDER validation, full-suite checks, auto-complete, auto-commit, and pre-push validation remain enforced.
