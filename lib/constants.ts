import type { Plan, TaskStatus, TaskPriority, ProjectStatus } from './types';

export const APP_NAME = 'TaskCraft AI';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://taskcraft.aakasa.dev';
export const APP_DESCRIPTION =
  'Plan smarter. Track faster. Invoice instantly. TaskCraft AI is a task, project, and time-tracking platform built for freelancers, consultants, and small teams.';

// ── Plan definitions (mirrors plans table seed data) ─────────────
export const PLANS = {
  free: {
    name:          'Free',
    price_monthly: 0,
    price_yearly:  0,
    max_workspaces: 1,
    max_projects:   3,
    max_members:    1,
  },
  solo: {
    name:          'Solo',
    price_monthly: 9,
    price_yearly:  89,
    max_workspaces: 1,
    max_projects:   -1,
    max_members:    1,
  },
  team: {
    name:          'Team',
    price_monthly: 19,
    price_yearly:  189,
    max_workspaces: -1,
    max_projects:   -1,
    max_members:    -1,
  },
} as const satisfies Record<Plan, {
  name: string;
  price_monthly: number;
  price_yearly: number;
  max_workspaces: number;
  max_projects: number;
  max_members: number;
}>;

// ── Project colours (default palette) ────────────────────────────
export const PROJECT_COLORS = [
  '#6366f1',  // indigo (primary)
  '#8b5cf6',  // violet
  '#3b82f6',  // blue
  '#06b6d4',  // cyan
  '#10b981',  // emerald
  '#f59e0b',  // amber
  '#ef4444',  // red
  '#ec4899',  // pink
] as const;

// ── Task status ───────────────────────────────────────────────────
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog:     'Backlog',
  todo:        'To Do',
  in_progress: 'In Progress',
  in_review:   'Review',
  done:        'Done',
};

export const TASK_STATUS_ORDER: TaskStatus[] = [
  'backlog', 'todo', 'in_progress', 'in_review', 'done',
];

// ── Task priority ─────────────────────────────────────────────────
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
  urgent: 'Urgent',
};

export const TASK_PRIORITY_ORDER: TaskPriority[] = [
  'low', 'medium', 'high', 'urgent',
];

// ── Project status ────────────────────────────────────────────────
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: 'Not Started',
  active:      'In Progress',
  on_hold:     'On Hold',
  completed:   'Completed',
  archived:    'Archived',
};

export const PROJECT_COLOR_OPTIONS = [
  { hex: '#6366f1', label: 'Indigo'   },
  { hex: '#8b5cf6', label: 'Violet'   },
  { hex: '#3b82f6', label: 'Blue'     },
  { hex: '#06b6d4', label: 'Cyan'     },
  { hex: '#10b981', label: 'Emerald'  },
  { hex: '#f59e0b', label: 'Amber'    },
  { hex: '#ef4444', label: 'Red'      },
  { hex: '#ec4899', label: 'Pink'     },
] as const;

// ── PayPal plan IDs (populated from .env) ────────────────────────
export const PAYPAL_PLAN_IDS: Record<string, Plan> = {
  [process.env.PAYPAL_PLAN_ID_SOLO_MONTHLY ?? '']: 'solo',
  [process.env.PAYPAL_PLAN_ID_SOLO_YEARLY  ?? '']: 'solo',
  [process.env.PAYPAL_PLAN_ID_TEAM_MONTHLY ?? '']: 'team',
  [process.env.PAYPAL_PLAN_ID_TEAM_YEARLY  ?? '']: 'team',
};

// ── AI plan limits ────────────────────────────────────────────────
export const AI_LIMITS: Record<string, { monthly: number; team_tools: boolean }> = {
  free: { monthly: 5,  team_tools: false },
  solo: { monthly: -1, team_tools: false },
  team: { monthly: -1, team_tools: true  },
};

// ── Plan feature lists (for pricing UI) ───────────────────────────
export const PLAN_FEATURES: Record<Plan, string[]> = {
  free: [
    '1 user',
    'Up to 3 active projects',
    'Unlimited tasks',
    'Basic time tracking',
    'Limited AI usage (5 requests/month)',
  ],
  solo: [
    'Unlimited projects',
    'Unlimited tasks & time tracking',
    'All AI productivity features',
    'Reports & analytics',
    'Client management',
    'Export reports (CSV)',
    'BillCraft AI integration',
    'SupportCraft AI integration',
  ],
  team: [
    'Everything in Solo',
    'Unlimited team members',
    'Roles & permissions',
    'Team task assignment',
    'Team workload & time reports',
    'Team AI features',
    'Audit logs',
    'Priority support',
  ],
};

// ── Limits helper ─────────────────────────────────────────────────
export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

export function withinLimit(count: number, limit: number): boolean {
  return limit === -1 || count < limit;
}
