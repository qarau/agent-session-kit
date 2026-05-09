import type { JsonValue } from './shared.js';

export type AskOhderLawSeverity = 'critical' | 'high' | 'medium' | 'low' | (string & {});
export type AskOhderLawClass = 'hard' | 'soft' | (string & {});
export type AskOhderLawOutcome = 'block' | 'retry' | 'warn' | 'allow' | (string & {});
export type AskOhderLawOperator = '==' | '!=' | '<=' | '<' | '>=' | '>' | 'in' | 'not-in' | (string & {});
export type AskOhderLawScope = 'runtime' | 'architecture' | 'security' | 'durability' | 'testability' | 'language-profile' | (string & {});

export interface AskOhderLaw {
  id: string;
  name: string;
  lawClass: AskOhderLawClass;
  enabled: boolean;
  severity: AskOhderLawSeverity;
  scope?: AskOhderLawScope;
  metric: string;
  operator: AskOhderLawOperator;
  value: JsonValue;
  outcome?: AskOhderLawOutcome;
  message?: string;
}

export interface AskOhderLawExemption {
  lawId: string;
  reason: string;
  approvedBy: string;
  operation?: string;
  sessionId?: string;
  expiresAt?: string;
  createdAt?: string;
}

export interface AskOhderLawPack {
  id?: string;
  version: number;
  name?: string;
  scope?: AskOhderLawScope;
  defaultEnabled?: boolean;
  defaultOutcomes: Record<AskOhderLawSeverity, AskOhderLawOutcome>;
  laws: AskOhderLaw[];
  exemptions: AskOhderLawExemption[];
}
