import { NextResponse } from 'next/server';
import * as https from 'node:https';
import { createClient } from '@/lib/supabase/server';

interface OpenAIMessage { role: 'system' | 'user' | 'assistant'; content: string; }

function callOpenAI(messages: OpenAIMessage[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o',
      messages,
      max_tokens: 600,
      temperature: 0.4,
      response_format: { type: 'json_object' },
    });

    const agent = new https.Agent({ keepAlive: false });
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
        agent,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) return reject(new Error(json.error.message));
            resolve(json.choices?.[0]?.message?.content ?? '{}');
          } catch {
            reject(new Error('Invalid JSON from OpenAI'));
          }
        });
      },
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ focus: [], reason: 'No workspace found.' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDays = new Date(today.getTime() + 7 * 86_400_000);

    // Fetch open tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, priority, due_date, status, projects(name)')
      .eq('workspace_id', membership.workspace_id)
      .eq('assignee_id', user.id)
      .neq('status', 'done')
      .order('priority', { ascending: false })
      .limit(20);

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ focus: [], reason: 'No open tasks to analyse.' });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taskList = tasks.map((t: any) => {
      const isOverdue = t.due_date && t.due_date < today.toISOString();
      const isDueToday = t.due_date && t.due_date >= today.toISOString() && t.due_date < sevenDays.toISOString();
      const projectName = Array.isArray(t.projects) ? t.projects[0]?.name : t.projects?.name;
      return `- "${t.title}" | priority: ${t.priority} | status: ${t.status}${
        projectName ? ` | project: ${projectName}` : ''
      }${isOverdue ? ' | OVERDUE' : ''}${isDueToday ? ` | due: ${String(t.due_date).slice(0, 10)}` : ''}`;
    }).join('\n');

    const content = await callOpenAI([
      {
        role: 'system',
        content:
          'You are a productivity assistant. Given a list of open tasks, return a JSON object with two keys: ' +
          '"focus" (array of up to 5 objects with "title", "reason", and "priority" fields — priority must be one of: urgent, high, medium, low) ' +
          'and "reason" (a single sentence explaining today\'s overall focus strategy). ' +
          'Pick the most impactful tasks based on priority, due dates, and overdue status.',
      },
      {
        role: 'user',
        content: `Here are my open tasks:\n${taskList}\n\nGenerate my focus plan for today.`,
      },
    ]);

    const parsed = JSON.parse(content) as {
      focus?: { title: string; reason: string; priority: string }[];
      reason?: string;
    };

    return NextResponse.json({
      focus: (parsed.focus ?? []).map((item) => ({
        title: item.title,
        reason: item.reason,
        priority: ['urgent', 'high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
      })),
      reason: parsed.reason ?? '',
    });
  } catch (err) {
    console.error('[ai/focus-plan]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
