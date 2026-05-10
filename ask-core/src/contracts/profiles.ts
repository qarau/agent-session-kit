import type { JsonObject } from './shared.js';
import type { AskLanguageAdapterCapability } from './adapter.js';

export interface AskProjectLanguageProfile {
  id: string;
  languageId: string;
  displayName: string;
  adapterId?: string;
  fileGlobs: string[];
  capabilities: AskLanguageAdapterCapability[];
  defaultPackageManager?: string;
  metadata?: JsonObject;
}

export interface AskProjectFrameworkProfile {
  id: string;
  languageProfileId: string;
  displayName: string;
  frameworkId: string;
  fileGlobs: string[];
  testGlobs: string[];
  metadata?: JsonObject;
}

export interface AskProjectGovernanceGate {
  id: string;
  name: string;
  appliesTo: string[];
  requiredCapabilities: AskLanguageAdapterCapability[];
  lawPackIds: string[];
  enabled: boolean;
  metadata?: JsonObject;
}

export interface AskProjectProfile {
  profileId: string;
  name: string;
  languageProfiles: AskProjectLanguageProfile[];
  frameworkProfiles: AskProjectFrameworkProfile[];
  gates: AskProjectGovernanceGate[];
  defaultLawPackIds: string[];
  metadata?: JsonObject;
}
