import type { JsonObject, JsonValue } from './shared.js';

export type AskLanguageAdapterCapability =
  | 'install'
  | 'format'
  | 'lint'
  | 'typecheck'
  | 'test'
  | 'build'
  | 'detect'
  | 'mapChangedFilesToTests'
  | 'inspectArchitecture';

export type AskLanguageAdapterResultStatus = 'passed' | 'failed' | 'skipped' | 'unavailable';

export interface AskLanguageAdapterContext {
  cwd: string;
  changedFiles?: string[];
  packageManager?: string;
  env?: Record<string, string>;
  metadata?: JsonObject;
}

export interface AskLanguageAdapterResult {
  capability: AskLanguageAdapterCapability;
  status: AskLanguageAdapterResultStatus;
  command?: string;
  args?: string[];
  exitCode?: number;
  reason?: string;
  stdout?: string;
  stderr?: string;
  metadata?: JsonObject;
}

export interface AskLanguageDetectionResult extends AskLanguageAdapterResult {
  detected: boolean;
  confidence: 'low' | 'medium' | 'high' | (string & {});
  evidence: string[];
}

export interface AskChangedFileTestMapping {
  changedFile: string;
  testFiles: string[];
  reason?: string;
}

export interface AskLanguageAdapterInspectionResult extends AskLanguageAdapterResult {
  facts: Record<string, JsonValue>;
  findings: string[];
  recommendations: string[];
}

export interface AskLanguageAdapter {
  languageId: string;
  displayName: string;
  fileGlobs: string[];
  capabilities: AskLanguageAdapterCapability[];
  detect(context: AskLanguageAdapterContext): Promise<AskLanguageDetectionResult> | AskLanguageDetectionResult;
  install(context: AskLanguageAdapterContext): Promise<AskLanguageAdapterResult> | AskLanguageAdapterResult;
  format(context: AskLanguageAdapterContext): Promise<AskLanguageAdapterResult> | AskLanguageAdapterResult;
  lint(context: AskLanguageAdapterContext): Promise<AskLanguageAdapterResult> | AskLanguageAdapterResult;
  typecheck(context: AskLanguageAdapterContext): Promise<AskLanguageAdapterResult> | AskLanguageAdapterResult;
  test(context: AskLanguageAdapterContext): Promise<AskLanguageAdapterResult> | AskLanguageAdapterResult;
  build(context: AskLanguageAdapterContext): Promise<AskLanguageAdapterResult> | AskLanguageAdapterResult;
  mapChangedFilesToTests(context: AskLanguageAdapterContext): Promise<AskChangedFileTestMapping[]> | AskChangedFileTestMapping[];
  inspectArchitecture(context: AskLanguageAdapterContext): Promise<AskLanguageAdapterInspectionResult> | AskLanguageAdapterInspectionResult;
}
