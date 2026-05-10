import type {
  AskOhderFinding,
  AskOhderFindingResolution,
} from './governance.js';

export function defineAskOhderFinding<T extends AskOhderFinding>(finding: T): T {
  return finding;
}

export function defineAskOhderFindingResolution<T extends AskOhderFindingResolution>(resolution: T): T {
  return resolution;
}
