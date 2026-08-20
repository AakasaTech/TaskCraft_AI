import { NextResponse } from 'next/server';
import * as https from 'node:https';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';

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
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDays = new Date(today.getTime() + 7 * 86_400_000);

    // Fetch open tasks
    const tasks = await prisma.task.findMany({
      where: {
        workspaceId: currentUser.workspace.id,
        assigneeId:  currentUser.profile.id,
        status:      { not: 'done' },
      },
      select: { id: true, title: true, priority: true, dueDate: true, status: true, project: { select: { name: true } } },
      orderBy: { priority: 'desc' },
      take: 20,
    });

    if (tasks.length === 0) {
      return NextResponse.json({ focus: [], reason: 'No open tasks to analyse.' });
    }

    const taskList = tasks.map((t) => {
      const isOverdue  = t.dueDate ? t.dueDate.getTime() < today.getTime() : false;
      const isDueToday = t.dueDate ? t.dueDate.getTime() >= today.getTime() && t.dueDate.getTime() < sevenDays.getTime() : false;
      return `- "${t.title}" | priority: ${t.priority} | status: ${t.status}${
        t.project?.name ? ` | project: ${t.project.name}` : ''
      }${isOverdue ? ' | OVERDUE' : ''}${isDueToday ? ` | due: ${t.dueDate!.toISOString().slice(0, 10)}` : ''}`;
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
