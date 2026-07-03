import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, CheckSquare, Clock, BarChart3, FolderKanban,
  FileText, Plug, Sparkles,
} from 'lucide-react';
import { PricingSection } from '@/components/shared/PricingSection';

export const metadata: Metadata = {
  title: 'TaskCraft AI | Plan smarter. Track faster. Invoice instantly.',
};

const features = [
  {
    icon: FolderKanban,
    title: 'Project Management',
    description: 'Organise work into projects with statuses, due dates, and team assignments. Kanban and list views included.',
  },
  {
    icon: CheckSquare,
    title: 'Task Tracking',
    description: 'Create, assign, and prioritise tasks. Set deadlines, add descriptions, and move tasks through custom workflows.',
  },
  {
    icon: Clock,
    title: 'Time Tracking',
    description: 'One-click timers on any task. Log billable hours, set hourly rates, and export time sheets.',
  },
  {
    icon: FileText,
    title: 'Invoice with BillCraft',
    description: 'Send tracked billable time directly to BillCraft AI and generate a professional invoice in seconds.',
  },
  {
    icon: BarChart3,
    title: 'Reports & Insights',
    description: 'See where time goes across projects, track billable vs non-billable hours, and monitor team productivity.',
  },
  {
    icon: Plug,
    title: 'SupportCraft Integration',
    description: 'Convert support tickets from SupportCraft AI into tasks automatically. Close the loop between support and delivery.',
  },
];

const DEMO_TASKS = [
  { title: 'Design landing page mockup',  project: 'Website Redesign', priority: 'high',   status: 'in_progress', time: '2h 14m' },
  { title: 'API endpoint for time export', project: 'TaskCraft AI',    priority: 'medium', status: 'todo',        time: '—' },
  { title: 'Client onboarding call',       project: 'Acme Corp',       priority: 'urgent', status: 'done',        time: '1h 00m' },
];

const PRIORITY_PILL: Record<string, string> = {
  low:    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  high:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const STATUS_PILL: Record<string, string> = {
  todo:        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-primary/10 text-primary',
  done:        'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

const STATUS_LABEL: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', done: 'Done',
};

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-20 pb-0 sm:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 60% 30%, hsl(250 84% 60% / 0.10) 0%, transparent 65%),' +
              'radial-gradient(ellipse 50% 50% at 15% -5%, hsl(270 70% 60% / 0.06) 0%, transparent 60%)',
          }}
        />

        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-12">

            {/* Left copy */}
            <div className="pb-16 lg:pb-28">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3.5 py-1.5 text-xs font-semibold text-primary mb-6">
                <Sparkles className="h-3 w-3" />
                AI-Assisted Productivity
              </div>

              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.5rem] lg:leading-[1.15]">
                Plan smarter.{' '}
                <span className="text-primary">Track faster.</span>
                <br />
                Invoice instantly.
              </h1>

              <p className="mt-6 max-w-[480px] text-lg leading-relaxed text-muted-foreground">
                TaskCraft AI combines project management, task tracking, and time logging into one clean platform — with
                direct invoicing via BillCraft AI and ticket-to-task sync via SupportCraft AI.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/register"
                  className="tc-btn-primary inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base"
                >
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="#pricing"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-7 py-3.5 text-base font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
                >
                  View pricing
                </Link>
              </div>

              <p className="mt-5 text-sm text-muted-foreground">
                Free forever · No credit card required · Setup in minutes
              </p>
            </div>

            {/* Right — task list mockup */}
            <div className="relative pb-12 lg:pb-20">
              {/* Floating timer card */}
              <div className="absolute -right-2 -top-4 z-20 flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg sm:-right-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold leading-tight">Timer running</p>
                  <p className="text-[10px] text-muted-foreground font-mono">02:14:33</p>
                </div>
              </div>

              {/* Main dashboard card */}
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-slate-200/60 dark:shadow-black/20">
                {/* Window chrome */}
                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                      <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                      <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                    </div>
                    <span className="ml-2 text-xs font-semibold text-foreground">My Tasks</span>
                  </div>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">3 active</span>
                </div>

                {/* Stat row */}
                <div className="grid grid-cols-3 gap-0 border-b border-border">
                  {[
                    { label: 'Open Tasks', val: '12', color: 'text-foreground' },
                    { label: 'Hours Today', val: '3.2h', color: 'text-primary' },
                    { label: 'Done this week', val: '8', color: 'text-green-600' },
                  ].map((s) => (
                    <div key={s.label} className="px-5 py-4 text-center border-r border-border last:border-r-0">
                      <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Task list */}
                <div className="p-4 space-y-2">
                  {DEMO_TASKS.map((t) => (
                    <div key={t.title} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background px-4 py-3">
                      <div className="h-4 w-4 shrink-0 rounded border-2 border-border" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{t.project}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize ${PRIORITY_PILL[t.priority]}`}>
                        {t.priority}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${STATUS_PILL[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground w-12 text-right">{t.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating invoice card */}
              <div className="absolute -bottom-3 -left-2 z-20 flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg sm:-left-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                  <FileText className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 leading-tight">Invoice sent!</p>
                  <p className="text-[10px] text-muted-foreground">$1,840 via BillCraft AI</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature strip ───────────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/30 px-6 py-8 mt-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { icon: CheckSquare, title: 'Task Management',  sub: 'Priorities, deadlines & workflows' },
              { icon: Clock,       title: 'Time Tracking',    sub: 'One-click timers on any task' },
              { icon: BarChart3,   title: 'Reports',          sub: 'Billable hours & productivity' },
              { icon: FileText,    title: 'BillCraft Invoice', sub: 'Time → invoice in one click' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────────── */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to ship faster
            </h2>
            <p className="mt-4 text-muted-foreground">
              From the first task to the final invoice — TaskCraft AI handles every step.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────────── */}
      <PricingSection />

      {/* ── CTA ─────────────────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/30 px-6 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Ready to take control of your time?</h2>
        <p className="mt-4 text-muted-foreground">Free forever for solo users. Upgrade when your team grows.</p>
        <Link href="/register" className="tc-btn-primary mt-8 inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-base">
          Start for free
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-6 text-xs text-muted-foreground">
          By signing up you agree to our{' '}
          <Link href="/terms" className="underline hover:text-foreground transition-colors">Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>.
        </p>
      </section>
    </>
  );
}
