import type { Plan } from './types';
import { PLANS } from './constants';

export function getEffectivePlan(plan: Plan, planExpiresAt: string | null): Plan {
  if (planExpiresAt && new Date(planExpiresAt) < new Date()) return 'free';
  return plan;
}

// ── Feature keys ─────────────────────────────────────────────────────────────

export type PlanFeature =
  | 'reports'
  | 'clients'
  | 'integrations'
  | 'exports'
  | 'ai_unlimited'
  | 'billcraft_sync'
  | 'supportcraft_sync'
  | 'team_management'
  | 'audit_logs';

// Minimum plan required for each feature
export const FEATURE_MIN_PLAN: Record<PlanFeature, Plan> = {
  reports:           'solo',
  clients:           'solo',
  integrations:      'solo',
  exports:           'solo',
  ai_unlimited:      'solo',
  billcraft_sync:    'solo',
  supportcraft_sync: 'solo',
  team_management:   'team',
  audit_logs:        'team',
};

const PLAN_RANK: Record<Plan, number> = { free: 0, solo: 1, team: 2 };

// ── Feature checks ────────────────────────────────────────────────────────────

export function canUseFeature(plan: Plan, feature: PlanFeature): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]];
}

export function isSoloPlusPlan(plan: Plan): boolean {
  return plan === 'solo' || plan === 'team';
}

export function isTeamPlan(plan: Plan): boolean {
  return plan === 'team';
}

// ── Limit helpers ─────────────────────────────────────────────────────────────

export function getProjectLimit(plan: Plan): number {
  return PLANS[plan].max_projects; // -1 = unlimited
}

export function getMemberLimit(plan: Plan): number {
  return PLANS[plan].max_members; // -1 = unlimited
}

export function isUnlimitedProjects(plan: Plan): boolean {
  return PLANS[plan].max_projects === -1;
}

// ── Feature metadata (for UI) ─────────────────────────────────────────────────

export const FEATURE_LABELS: Record<PlanFeature, string> = {
  reports:           'Reports & Analytics',
  clients:           'Client Management',
  integrations:      'Integrations',
  exports:           'CSV & Report Exports',
  ai_unlimited:      'Unlimited AI Features',
  billcraft_sync:    'BillCraft AI Invoice Sync',
  supportcraft_sync: 'SupportCraft AI Task Sync',
  team_management:   'Team Management',
  audit_logs:        'Audit Logs',
};

export const FEATURE_DESCRIPTIONS: Record<PlanFeature, string> = {
  reports:
    'Track time, billable hours, project progress, and client profitability. Export your data as CSV for accounting and analysis.',
  clients:
    'Create client profiles, link them to projects, and track billable hours and revenue per client.',
  integrations:
    'Connect BillCraft AI to send invoices directly and SupportCraft AI to turn support tickets into tasks automatically.',
  exports:
    'Download any report as a CSV file for use in spreadsheets, accounting software, or client invoices.',
  ai_unlimited:
    'Use all AI productivity features — task suggestions, smart focus plans, and AI summaries — without monthly usage limits.',
  billcraft_sync:
    'Send tracked billable hours directly to BillCraft AI and generate professional invoices in one click.',
  supportcraft_sync:
    'Convert SupportCraft AI support tickets into TaskCraft tasks automatically and keep them in sync.',
  team_management:
    'Invite team members, assign roles (owner / admin / member / viewer), and collaborate across shared projects.',
  audit_logs:
    'See a full audit trail of every change made in your workspace — who changed what and when.',
};
