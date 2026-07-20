import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

// ── Tool prompt builders ────────────────────────────────────────────────────

async function buildPrompt(
  tool: string,
  input: Record<string, string>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  uid: string,
  wid: string,
) {
  switch (tool) {

    case 'task-generator': {
      let projContext = '';
      if (input.project_id) {
        const { data: p } = await supabase
          .from('projects')
          .select('name, description, clients(name)')
          .eq('id', input.project_id)
          .single();
        if (p) {
          const client = Array.isArray((p as any).clients) ? (p as any).clients[0] : (p as any).clients;
          projContext = `Project: ${p.name}\nDescription: ${p.description ?? '(none)'}\nClient: ${client?.name ?? '(none)'}`;
        }
        const { data: existingTasks } = await supabase
          .from('tasks')
          .select('title')
          .eq('project_id', input.project_id)
          .neq('status', 'done')
          .limit(20);
        if (existingTasks?.length) {
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
        const { data: t } = await supabase
          .from('tasks')
          .select('title, description, projects(name)')
          .eq('id', input.task_id)
          .single();
        if (t) {
          const proj = Array.isArray((t as any).projects) ? (t as any).projects[0] : (t as any).projects;
          ctx = `Task: ${t.title}\nDescription: ${t.description ?? '(none)'}\nProject: ${proj?.name ?? '(none)'}`;
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
      const today = new Date().toISOString().slice(0, 10);
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, priority, due_date, status, projects(name)')
        .eq('workspace_id', wid)
        .eq('assignee_id', uid)
        .in('status', ['todo', 'in_progress', 'in_review'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(30);

      const overdue = (tasks ?? []).filter((t) => t.due_date && t.due_date < today);
      const upcoming = (tasks ?? []).filter((t) => !t.due_date || t.due_date >= today);

      const fmt = (arr: typeof tasks) => (arr ?? []).map((t) => {
        const p = Array.isArray((t as any).projects) ? (t as any).projects[0] : (t as any).projects;
        return `[${t.id}] ${t.title} (${t.priority}, ${p?.name ?? 'no project'}, due: ${t.due_date ?? 'none'})`;
      }).join('\n');

      return {
        system: `${JSON_SYSTEM}\nCreate a prioritized daily work plan. Schema:\n{"plan":[{"task_id":"string","title":"string","reason":"string","suggested_minutes":number}],"summary":"string"}`,
        user:   `Today: ${today}\n\nOverdue tasks:\n${fmt(overdue) || '(none)'}\n\nUpcoming tasks:\n${fmt(upcoming) || '(none)'}`,
      };
    }

    case 'priority-suggestions': {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, priority, due_date, status, description')
        .eq('workspace_id', wid)
        .eq('assignee_id', uid)
        .not('status', 'in', '("done","backlog")')
        .order('created_at', { ascending: false })
        .limit(25);

      const list = (tasks ?? []).map((t) =>
        `[${t.id}] "${t.title}" current:${t.priority} due:${t.due_date ?? 'none'} status:${t.status}`
      ).join('\n');

      return {
        system: `${JSON_SYSTEM}\nAnalyze tasks and suggest better priorities where needed. Only include tasks that need a change. Schema:\n{"suggestions":[{"task_id":"string","title":"string","current":"low|medium|high|urgent","suggested":"low|medium|high|urgent","reason":"string"}]}`,
        user:   `Tasks:\n${list || '(none)'}`,
      };
    }

    case 'progress-summary': {
      let ctx = 'No project selected.';
      if (input.project_id) {
        const [projRes, tasksRes, timeRes] = await Promise.all([
          supabase.from('projects').select('name, description, status, budget, hourly_rate, clients(name)').eq('id', input.project_id).single(),
          supabase.from('tasks').select('status, priority').eq('project_id', input.project_id),
          supabase.from('time_entries').select('duration_minutes, billable').eq('project_id', input.project_id).not('duration_minutes', 'is', null),
        ]);
        const proj = projRes.data;
        const tasks = tasksRes.data ?? [];
        const time  = timeRes.data ?? [];
        if (proj) {
          const client = Array.isArray((proj as any).clients) ? (proj as any).clients[0] : (proj as any).clients;
          const totalMins = time.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
          const billMins  = time.filter((e) => e.billable).reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
          ctx = `Project: ${proj.name}\nClient: ${client?.name ?? 'none'}\nStatus: ${proj.status}\nTasks total: ${tasks.length} | Done: ${tasks.filter(t => t.status === 'done').length} | In progress: ${tasks.filter(t => t.status === 'in_progress').length} | Overdue: ${tasks.filter(t => t.status !== 'done').length}\nHours logged: ${(totalMins / 60).toFixed(1)}h | Billable: ${(billMins / 60).toFixed(1)}h`;
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
      const { data: entries } = await supabase
        .from('time_entries')
        .select('duration_minutes, billable, start_time, project_id, projects(name)')
        .eq('user_id', uid)
        .not('duration_minutes', 'is', null)
        .gte('start_time', since.toISOString());

      const totalMins = (entries ?? []).reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
      const billMins  = (entries ?? []).filter((e) => e.billable).reduce((s, e) => s + (e.duration_minutes ?? 0), 0);

      const byProject: Record<string, number> = {};
      for (const e of entries ?? []) {
        const p = Array.isArray((e as any).projects) ? (e as any).projects[0] : (e as any).projects;
        const name = p?.name ?? 'No project';
        byProject[name] = (byProject[name] ?? 0) + (e.duration_minutes ?? 0);
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
      const today = new Date().toISOString().slice(0, 10);
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, priority, due_date, description, projects(name)')
        .eq('workspace_id', wid)
        .eq('assignee_id', uid)
        .lt('due_date', today)
        .not('status', 'eq', 'done')
        .order('due_date', { ascending: true })
        .limit(20);

      const list = (tasks ?? []).map((t) => {
        const p = Array.isArray((t as any).projects) ? (t as any).projects[0] : (t as any).projects;
        const daysOver = Math.floor((Date.now() - new Date(t.due_date!).getTime()) / 86400000);
        return `[${t.id}] "${t.title}" | project: ${p?.name ?? 'none'} | overdue by ${daysOver}d | priority: ${t.priority}`;
      }).join('\n');

      return {
        system: `${JSON_SYSTEM}\nSuggest concrete actions for overdue tasks. Schema:\n{"suggestions":[{"task_id":"string","title":"string","action":"string","reason":"string"}]}`,
        user:   `Overdue tasks:\n${list || '(none)'}`,
      };
    }

    case 'workload-balancing': {
      const { data: members } = await supabase
        .from('workspace_members')
        .select('user_id, profiles(full_name, email)')
        .eq('workspace_id', wid);

      const memberList = await Promise.all((members ?? []).map(async (m) => {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, title, priority, due_date, estimated_hours')
          .eq('workspace_id', wid)
          .eq('assignee_id', m.user_id)
          .not('status', 'in', '("done","backlog")')
          .limit(20);
        const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles as any;
        const name = prof?.full_name ?? prof?.email ?? m.user_id;
        const taskSummary = (tasks ?? []).map((t) =>
          `"${t.title}" (${t.priority}, ${t.estimated_hours ?? '?'}h, due: ${t.due_date ?? 'none'})`
        ).join('; ');
        return `${name}: ${tasks?.length ?? 0} tasks — ${taskSummary || '(no tasks)'}`;
      }));

      return {
        system: `${JSON_SYSTEM}\nAnalyze team workloads and suggest task rebalancing. Schema:\n{"analysis":{"overloaded":["string"],"underutilized":["string"]},"suggestions":[{"from":"string","to":"string","task_title":"string","reason":"string"}]}`,
        user:   `Team workloads:\n${memberList.join('\n') || '(no members)'}`,
      };
    }

    case 'capacity-planning': {
      const { data: members } = await supabase
        .from('workspace_members')
        .select('user_id, profiles(full_name, email)')
        .eq('workspace_id', wid);

      const { data: upcoming } = await supabase
        .from('tasks')
        .select('id, title, priority, estimated_hours, assignee_id, due_date')
        .eq('workspace_id', wid)
        .not('status', 'in', '("done","backlog")')
        .order('due_date', { ascending: true })
        .limit(30);

      const memberNames: Record<string, string> = {};
      for (const m of members ?? []) {
        const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles as any;
        memberNames[m.user_id] = prof?.full_name ?? prof?.email ?? m.user_id;
      }

      const taskList = (upcoming ?? []).map((t) =>
        `"${t.title}" | est: ${t.estimated_hours ?? '?'}h | priority: ${t.priority} | assignee: ${memberNames[t.assignee_id ?? ''] ?? 'unassigned'} | due: ${t.due_date ?? 'none'}`
      ).join('\n');

      return {
        system: `${JSON_SYSTEM}\nPlan capacity allocation for the team. Schema:\n{"plan":[{"member":"string","available_hours":40,"assigned_tasks":["string"],"utilization_pct":number}],"unassigned":["string"]}`,
        user:   `Team members: ${Object.values(memberNames).join(', ')}\nUpcoming tasks:\n${taskList || '(none)'}`,
      };
    }

    case 'project-health': {
      let ctx = 'No project selected.';
      if (input.project_id) {
        const today = new Date().toISOString().slice(0, 10);
        const [projRes, tasksRes, timeRes] = await Promise.all([
          supabase.from('projects').select('name, status, budget, hourly_rate, deadline').eq('id', input.project_id).single(),
          supabase.from('tasks').select('status, priority, due_date').eq('project_id', input.project_id),
          supabase.from('time_entries').select('duration_minutes, billable, hourly_rate').eq('project_id', input.project_id).not('duration_minutes', 'is', null),
        ]);
        const proj = projRes.data as any;
        const tasks = tasksRes.data ?? [];
        const time  = timeRes.data ?? [];
        if (proj) {
          const totalMins = time.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
          const billVal   = time.reduce((s, e) => s + (e.billable ? (e.duration_minutes ?? 0) / 60 * (e.hourly_rate ?? 0) : 0), 0);
          const overdue   = tasks.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today).length;
          ctx = `Project: ${proj.name}\nStatus: ${proj.status}\nTotal tasks: ${tasks.length} | Done: ${tasks.filter(t => t.status === 'done').length} | Overdue: ${overdue}\nHours logged: ${(totalMins / 60).toFixed(1)}h | Billable value: $${billVal.toFixed(2)}\nBudget: ${proj.budget ?? 'N/A'} | Deadline: ${proj.deadline ?? 'N/A'}`;
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
        const today = new Date().toISOString().slice(0, 10);
        const [projRes, tasksRes] = await Promise.all([
          supabase.from('projects').select('name, status, budget, deadline').eq('id', input.project_id).single(),
          supabase.from('tasks').select('status, priority, due_date, title').eq('project_id', input.project_id),
        ]);
        const proj = projRes.data as any;
        const tasks = tasksRes.data ?? [];
        if (proj) {
          const overdue = tasks.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today);
          const urgent  = tasks.filter((t) => t.priority === 'urgent' && t.status !== 'done');
          ctx = `Project: ${proj.name}\nStatus: ${proj.status}\nDeadline: ${proj.deadline ?? 'N/A'}\nBudget: ${proj.budget ?? 'N/A'}\nOverdue tasks (${overdue.length}): ${overdue.map(t => t.title).slice(0, 5).join(', ')}\nUrgent open tasks (${urgent.length}): ${urgent.map(t => t.title).slice(0, 5).join(', ')}\nTotal tasks: ${tasks.length} | Done: ${tasks.filter(t => t.status === 'done').length}`;
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as Record<string, string>;
    const tool = body.tool;

    if (!tool || !TOOL_PLANS[tool]) {
      return NextResponse.json({ error: 'Unknown AI tool.' }, { status: 400 });
    }

    // Get user plan + workspace
    const [profileRes, memberRes] = await Promise.all([
      supabase.from('profiles').select('plan, plan_expires_at').eq('id', user.id).single(),
      supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).single(),
    ]);

    const plan = getEffectivePlan((profileRes.data?.plan ?? 'free') as 'free' | 'solo' | 'team', profileRes.data?.plan_expires_at ?? null);
    const wid  = memberRes.data?.workspace_id;
    if (!wid) return NextResponse.json({ error: 'No workspace found.' }, { status: 400 });

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
      const { count } = await supabase
        .from('ai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('used_at', since.toISOString());

      if ((count ?? 0) >= FREE_MONTHLY_LIMIT) {
        return NextResponse.json({
          error:   `You've used all ${FREE_MONTHLY_LIMIT} free AI requests this month. Upgrade to Solo or Team for unlimited AI.`,
          upgrade: true,
          usage:   count,
          limit:   FREE_MONTHLY_LIMIT,
        }, { status: 429 });
      }
    }

    // Build prompt
    const { system, user: userMsg } = await buildPrompt(tool, body, supabase, user.id, wid);

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
    await supabase.from('ai_usage').insert({ user_id: user.id, workspace_id: wid, tool });

    return NextResponse.json({ ok: true, tool, result });

  } catch (err: any) {
    console.error('[AI Route]', err);
    return NextResponse.json({ error: err.message ?? 'AI request failed.' }, { status: 500 });
  }
}
