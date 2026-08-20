import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { callOpenAI } from '@/lib/ai';
import { getEffectivePlan } from '@/lib/plan-gates';

// ── Plan access matrix ──────────────────────────────────────────────────────
const FREE_MONTHLY_LIMIT = 5;

const TOOL_PLANS: Record<string, Array<'free' | 'solo' | 'team'>> = {
  'task-generator':        ['free', 'solo', 'team'],
  'subtask-generator':     ['free', 'solo', 'team'],
  'progress-summary':      ['free', 'solo', 'team'],
  'project-planner':       ['solo', 'team'],
  'daily-plan':            ['solo', 'team'],
  'priority-suggestions':  ['solo', 'team'],
  'meeting-notes':         ['solo', 'team'],
  'productivity-insights': ['solo', 'team'],
  'overdue-suggestions':   ['solo', 'team'],
  'workload-balancing':    ['team'],
  'capacity-planning':     ['team'],
  'project-health':        ['team'],
  'risk-detection':        ['team'],
};

const JSON_SYSTEM = 'Always respond with valid JSON only. No markdown, no code blocks, just the raw JSON object.';

function dateOnly(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

// ── Tool prompt builders ────────────────────────────────────────────────────

async function buildPrompt(
  tool: string,
  input: Record<string, string>,
  uid: string,
  wid: string,
) {
  switch (tool) {

    case 'task-generator': {
      let projContext = '';
      if (input.project_id) {
        const p = await prisma.project.findUnique({
          where: { id: input.project_id },
          select: { name: true, description: true, client: { select: { name: true } } },
        });
        if (p) {
          projContext = `Project: ${p.name}\nDescription: ${p.description ?? '(none)'}\nClient: ${p.client?.name ?? '(none)'}`;
        }
        const existingTasks = await prisma.task.findMany({
          where: { projectId: input.project_id, status: { not: 'done' } },
          select: { title: true },
          take: 20,
        });
        if (existingTasks.length) {
          projContext += `\nExisting open tasks (do not duplicate): ${existingTasks.map((t) => t.title).join(', ')}`;
        }
      }
      return {
        system: `${JSON_SYSTEM}\nYou are a project management AI. Generate 6–10 actionable tasks. Schema:\n{"tasks":[{"title":"string","description":"string","priority":"low|medium|high|urgent","estimated_hours":number}]}`,
        user:   `${projContext}\nGoal: ${input.goal ?? 'Complete the project successfully'}`,
      };
    }

    case 'subtask-generator': {
      let ctx = '';
      if (input.task_id) {
        const t = await prisma.task.findUnique({
          where: { id: input.task_id },
          select: { title: true, description: true, project: { select: { name: true } } },
        });
        if (t) {
          ctx = `Task: ${t.title}\nDescription: ${t.description ?? '(none)'}\nProject: ${t.project?.name ?? '(none)'}`;
        }
      }
      return {
        system: `${JSON_SYSTEM}\nBreak the task into 3–7 concrete subtasks. Schema:\n{"subtasks":[{"title":"string"}]}`,
        user:   ctx || `Task: ${input.task_title ?? 'Unnamed task'}`,
      };
    }

    case 'project-planner': {
      return {
        system: `${JSON_SYSTEM}\nYou are a project planning AI. Generate a structured task list for a new project. Schema:\n{"tasks":[{"title":"string","description":"string","priority":"low|medium|high|urgent","estimated_hours":number}]}`,
        user:   `Project name: ${input.project_name ?? 'New Project'}\nGoal: ${input.goal ?? ''}\nTimeline: ${input.timeline ?? 'No specific timeline'}`,
      };
    }

    case 'daily-plan': {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tasks = await prisma.task.findMany({
        where: {
          workspaceId: wid,
          assigneeId:  uid,
          status:      { in: ['todo', 'in_progress', 'in_review'] },
        },
        select: { id: true, title: true, priority: true, dueDate: true, status: true, project: { select: { name: true } } },
        orderBy: { dueDate: { sort: 'asc', nulls: 'last' } },
        take: 30,
      });

      const overdue  = tasks.filter((t) => t.dueDate && t.dueDate.getTime() < today.getTime());
      const upcoming = tasks.filter((t) => !t.dueDate || t.dueDate.getTime() >= today.getTime());

      const fmt = (arr: typeof tasks) => arr.map((t) =>
        `[${t.id}] ${t.title} (${t.priority}, ${t.project?.name ?? 'no project'}, due: ${dateOnly(t.dueDate) ?? 'none'})`
      ).join('\n');

      return {
        system: `${JSON_SYSTEM}\nCreate a prioritized daily work plan. Schema:\n{"plan":[{"task_id":"string","title":"string","reason":"string","suggested_minutes":number}],"summary":"string"}`,
        user:   `Today: ${dateOnly(today)}\n\nOverdue tasks:\n${fmt(overdue) || '(none)'}\n\nUpcoming tasks:\n${fmt(upcoming) || '(none)'}`,
      };
    }

    case 'priority-suggestions': {
      const tasks = await prisma.task.findMany({
        where: {
          workspaceId: wid,
          assigneeId:  uid,
          status:      { notIn: ['done', 'backlog'] },
        },
        select: { id: true, title: true, priority: true, dueDate: true, status: true, description: true },
        orderBy: { createdAt: 'desc' },
        take: 25,
      });

      const list = tasks.map((t) =>
        `[${t.id}] "${t.title}" current:${t.priority} due:${dateOnly(t.dueDate) ?? 'none'} status:${t.status}`
      ).join('\n');

      return {
        system: `${JSON_SYSTEM}\nAnalyze tasks and suggest better priorities where needed. Only include tasks that need a change. Schema:\n{"suggestions":[{"task_id":"string","title":"string","current":"low|medium|high|urgent","suggested":"low|medium|high|urgent","reason":"string"}]}`,
        user:   `Tasks:\n${list || '(none)'}`,
      };
    }

    case 'progress-summary': {
      let ctx = 'No project selected.';
      if (input.project_id) {
        const [proj, tasks, time] = await Promise.all([
          prisma.project.findUnique({
            where: { id: input.project_id },
            select: { name: true, description: true, status: true, budget: true, hourlyRate: true, client: { select: { name: true } } },
          }),
          prisma.task.findMany({ where: { projectId: input.project_id }, select: { status: true, priority: true } }),
          prisma.timeEntry.findMany({
            where: { projectId: input.project_id, durationMinutes: { not: null } },
            select: { durationMinutes: true, billable: true },
          }),
        ]);
        if (proj) {
          const totalMins = time.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
          const billMins  = time.filter((e) => e.billable).reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
          ctx = `Project: ${proj.name}\nClient: ${proj.client?.name ?? 'none'}\nStatus: ${proj.status}\nTasks total: ${tasks.length} | Done: ${tasks.filter(t => t.status === 'done').length} | In progress: ${tasks.filter(t => t.status === 'in_progress').length} | Overdue: ${tasks.filter(t => t.status !== 'done').length}\nHours logged: ${(totalMins / 60).toFixed(1)}h | Billable: ${(billMins / 60).toFixed(1)}h`;
        }
      }
      return {
        system: `${JSON_SYSTEM}\nWrite a professional project progress summary. Schema:\n{"summary":"string","insights":["string"]}`,
        user:   ctx,
      };
    }

    case 'meeting-notes': {
      return {
        system: `${JSON_SYSTEM}\nExtract actionable tasks from meeting notes. Schema:\n{"tasks":[{"title":"string","description":"string","priority":"low|medium|high|urgent","assignee_name":null,"due_hint":null}]}`,
        user:   `Meeting notes:\n${input.notes ?? '(no notes provided)'}`,
      };
    }

    case 'productivity-insights': {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const entries = await prisma.timeEntry.findMany({
        where: { userId: uid, durationMinutes: { not: null }, startTime: { gte: since } },
        select: { durationMinutes: true, billable: true, startTime: true, projectId: true, project: { select: { name: true } } },
      });

      const totalMins = entries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
      const billMins  = entries.filter((e) => e.billable).reduce((s, e) => s + (e.durationMinutes ?? 0), 0);

      const byProject: Record<string, number> = {};
      for (const e of entries) {
        const name = e.project?.name ?? 'No project';
        byProject[name] = (byProject[name] ?? 0) + (e.durationMinutes ?? 0);
      }
      const byProj = Object.entries(byProject)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([n, m]) => `${n}: ${(m / 60).toFixed(1)}h`)
        .join(', ');

      return {
        system: `${JSON_SYSTEM}\nAnalyze productivity data and provide actionable insights. Schema:\n{"insights":["string"],"recommendations":["string"]}`,
        user:   `Last 30 days:\nTotal hours: ${(totalMins / 60).toFixed(1)}h\nBillable: ${(billMins / 60).toFixed(1)}h (${totalMins > 0 ? Math.round((billMins / totalMins) * 100) : 0}%)\nBy project: ${byProj || '(none)'}`,
      };
    }

    case 'overdue-suggestions': {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tasks = await prisma.task.findMany({
        where: {
          workspaceId: wid,
          assigneeId:  uid,
          status:      { not: 'done' },
          dueDate:     { lt: today },
        },
        select: { id: true, title: true, priority: true, dueDate: true, description: true, project: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 20,
      });

      const list = tasks.map((t) => {
        const daysOver = Math.floor((Date.now() - t.dueDate!.getTime()) / 86400000);
        return `[${t.id}] "${t.title}" | project: ${t.project?.name ?? 'none'} | overdue by ${daysOver}d | priority: ${t.priority}`;
      }).join('\n');

      return {
        system: `${JSON_SYSTEM}\nSuggest concrete actions for overdue tasks. Schema:\n{"suggestions":[{"task_id":"string","title":"string","action":"string","reason":"string"}]}`,
        user:   `Overdue tasks:\n${list || '(none)'}`,
      };
    }

    case 'workload-balancing': {
      const members = await prisma.workspaceMember.findMany({
        where: { workspaceId: wid },
        select: { userId: true, user: { select: { fullName: true, email: true } } },
      });

      const memberList = await Promise.all(members.map(async (m) => {
        const tasks = await prisma.task.findMany({
          where: { workspaceId: wid, assigneeId: m.userId, status: { notIn: ['done', 'backlog'] } },
          select: { id: true, title: true, priority: true, dueDate: true, estimatedHours: true },
          take: 20,
        });
        const name = m.user.fullName ?? m.user.email ?? m.userId;
        const taskSummary = tasks.map((t) =>
          `"${t.title}" (${t.priority}, ${t.estimatedHours ?? '?'}h, due: ${dateOnly(t.dueDate) ?? 'none'})`
        ).join('; ');
        return `${name}: ${tasks.length} tasks — ${taskSummary || '(no tasks)'}`;
      }));

      return {
        system: `${JSON_SYSTEM}\nAnalyze team workloads and suggest task rebalancing. Schema:\n{"analysis":{"overloaded":["string"],"underutilized":["string"]},"suggestions":[{"from":"string","to":"string","task_title":"string","reason":"string"}]}`,
        user:   `Team workloads:\n${memberList.join('\n') || '(no members)'}`,
      };
    }

    case 'capacity-planning': {
      const members = await prisma.workspaceMember.findMany({
        where: { workspaceId: wid },
        select: { userId: true, user: { select: { fullName: true, email: true } } },
      });

      const upcoming = await prisma.task.findMany({
        where: { workspaceId: wid, status: { notIn: ['done', 'backlog'] } },
        select: { id: true, title: true, priority: true, estimatedHours: true, assigneeId: true, dueDate: true },
        orderBy: { dueDate: 'asc' },
        take: 30,
      });

      const memberNames: Record<string, string> = {};
      for (const m of members) {
        memberNames[m.userId] = m.user.fullName ?? m.user.email ?? m.userId;
      }

      const taskList = upcoming.map((t) =>
        `"${t.title}" | est: ${t.estimatedHours ?? '?'}h | priority: ${t.priority} | assignee: ${memberNames[t.assigneeId ?? ''] ?? 'unassigned'} | due: ${dateOnly(t.dueDate) ?? 'none'}`
      ).join('\n');

      return {
        system: `${JSON_SYSTEM}\nPlan capacity allocation for the team. Schema:\n{"plan":[{"member":"string","available_hours":40,"assigned_tasks":["string"],"utilization_pct":number}],"unassigned":["string"]}`,
        user:   `Team members: ${Object.values(memberNames).join(', ')}\nUpcoming tasks:\n${taskList || '(none)'}`,
      };
    }

    case 'project-health': {
      let ctx = 'No project selected.';
      if (input.project_id) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [proj, tasks, time] = await Promise.all([
          prisma.project.findUnique({ where: { id: input.project_id }, select: { name: true, status: true, budget: true, hourlyRate: true, dueDate: true } }),
          prisma.task.findMany({ where: { projectId: input.project_id }, select: { status: true, priority: true, dueDate: true } }),
          prisma.timeEntry.findMany({ where: { projectId: input.project_id, durationMinutes: { not: null } }, select: { durationMinutes: true, billable: true, hourlyRate: true } }),
        ]);
        if (proj) {
          const totalMins = time.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
          const billVal   = time.reduce((s, e) => s + (e.billable ? (e.durationMinutes ?? 0) / 60 * Number(e.hourlyRate ?? 0) : 0), 0);
          const overdue   = tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate.getTime() < today.getTime()).length;
          ctx = `Project: ${proj.name}\nStatus: ${proj.status}\nTotal tasks: ${tasks.length} | Done: ${tasks.filter(t => t.status === 'done').length} | Overdue: ${overdue}\nHours logged: ${(totalMins / 60).toFixed(1)}h | Billable value: $${billVal.toFixed(2)}\nBudget: ${proj.budget ?? 'N/A'} | Deadline: ${dateOnly(proj.dueDate) ?? 'N/A'}`;
        }
      }
      return {
        system: `${JSON_SYSTEM}\nScore this project's health 0–100 with a breakdown. Schema:\n{"score":number,"status":"on_track|at_risk|critical","breakdown":{"schedule":number,"scope":number,"budget":number,"quality":number},"insights":["string"]}`,
        user:   ctx,
      };
    }

    case 'risk-detection': {
      let ctx = 'No project selected.';
      if (input.project_id) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [proj, tasks] = await Promise.all([
          prisma.project.findUnique({ where: { id: input.project_id }, select: { name: true, status: true, budget: true, dueDate: true } }),
          prisma.task.findMany({ where: { projectId: input.project_id }, select: { status: true, priority: true, dueDate: true, title: true } }),
        ]);
        if (proj) {
          const overdue = tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate.getTime() < today.getTime());
          const urgent  = tasks.filter((t) => t.priority === 'urgent' && t.status !== 'done');
          ctx = `Project: ${proj.name}\nStatus: ${proj.status}\nDeadline: ${dateOnly(proj.dueDate) ?? 'N/A'}\nBudget: ${proj.budget ?? 'N/A'}\nOverdue tasks (${overdue.length}): ${overdue.map(t => t.title).slice(0, 5).join(', ')}\nUrgent open tasks (${urgent.length}): ${urgent.map(t => t.title).slice(0, 5).join(', ')}\nTotal tasks: ${tasks.length} | Done: ${tasks.filter(t => t.status === 'done').length}`;
        }
      }
      return {
        system: `${JSON_SYSTEM}\nIdentify project risks. Schema:\n{"risks":[{"title":"string","severity":"low|medium|high|critical","description":"string","mitigation":"string","category":"schedule|scope|resource|technical|budget"}]}`,
        user:   ctx,
      };
    }

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as Record<string, string>;
    const tool = body.tool;

    if (!tool || !TOOL_PLANS[tool]) {
      return NextResponse.json({ error: 'Unknown AI tool.' }, { status: 400 });
    }

    const plan = getEffectivePlan(currentUser.profile.plan as 'free' | 'solo' | 'team', currentUser.profile.planExpiresAt?.toISOString() ?? null);
    const wid  = currentUser.workspace.id;
    const uid  = currentUser.profile.id;

    // Plan access check
    if (!TOOL_PLANS[tool].includes(plan)) {
      const required = TOOL_PLANS[tool].includes('team') ? 'Team' : 'Solo';
      return NextResponse.json({
        error:   `This AI tool requires the ${required} plan.`,
        upgrade: true,
        required_plan: required.toLowerCase(),
      }, { status: 403 });
    }

    // Free plan monthly limit
    if (plan === 'free') {
      const since = new Date();
      since.setDate(1); // first of month
      since.setHours(0, 0, 0, 0);
      const count = await prisma.aiUsage.count({
        where: { userId: uid, usedAt: { gte: since } },
      });

      if (count >= FREE_MONTHLY_LIMIT) {
        return NextResponse.json({
          error:   `You've used all ${FREE_MONTHLY_LIMIT} free AI requests this month. Upgrade to Solo or Team for unlimited AI.`,
          upgrade: true,
          usage:   count,
          limit:   FREE_MONTHLY_LIMIT,
        }, { status: 429 });
      }
    }

    // Build prompt
    const { system, user: userMsg } = await buildPrompt(tool, body, uid, wid);

    // Call OpenAI
    const raw = await callOpenAI(
      [{ role: 'system', content: system }, { role: 'user', content: userMsg }],
      { jsonMode: true, maxTokens: 1500 },
    );

    // Parse JSON
    let result: unknown;
    try { result = JSON.parse(raw); }
    catch { return NextResponse.json({ error: 'AI returned invalid JSON. Please try again.' }, { status: 500 }); }

    // Track usage
    await prisma.aiUsage.create({ data: { userId: uid, workspaceId: wid, tool } });

    return NextResponse.json({ ok: true, tool, result });

  } catch (err: unknown) {
    console.error('[AI Route]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'AI request failed.' }, { status: 500 });
  }
}
