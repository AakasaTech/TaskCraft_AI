import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, CalendarDays, TicketCheck, ExternalLink, Mail } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

export const metadata: Metadata = { title: 'Help & Support' };

interface HelpCardProps {
  icon:     React.ReactNode;
  title:    string;
  desc:     string;
  children: React.ReactNode;
}

function HelpCard({ icon, title, desc, children }: HelpCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="pl-14">{children}</div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Help & Support"
        subtitle="Find answers, book a call, or raise a support ticket with our team."
      />

      <div className="max-w-2xl space-y-6">

        {/* Documentation */}
        <HelpCard
          icon={<BookOpen className="h-5 w-5" />}
          title="Product Documentation"
          desc="Step-by-step guides covering every feature in TaskCraft AI."
        >
          <Link
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            Product Documentation
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </HelpCard>

        {/* Schedule a call */}
        <HelpCard
          icon={<CalendarDays className="h-5 w-5" />}
          title="Schedule a Support Call"
          desc="Book a video call with our support team — we'll walk you through anything live."
        >
          <a
            href="https://calendar.app.google/tWuP3r4rq7ER8R2o9"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <CalendarDays className="h-4 w-4" />
            Book a Support Call
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </a>
        </HelpCard>

        {/* Support ticket */}
        <HelpCard
          icon={<TicketCheck className="h-5 w-5" />}
          title="Submit a Support Ticket"
          desc="Send us an email and our team will respond within one business day."
        >
          <div className="space-y-3">
            <ol className="space-y-2 text-sm text-foreground list-decimal list-inside marker:text-muted-foreground">
              <li>Compose a new email from your registered email address.</li>
              <li>
                Send it to{' '}
                <a
                  href="mailto:aakasa@supportcraft.aakasa.dev"
                  className="font-mono text-primary underline underline-offset-2 hover:opacity-80"
                >
                  aakasa@supportcraft.aakasa.dev
                </a>
              </li>
              <li>Include a clear subject line and describe your issue in detail.</li>
              <li>Attach any screenshots that help illustrate the problem.</li>
            </ol>
            <a
              href="mailto:aakasa@supportcraft.aakasa.dev"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Mail className="h-4 w-4 text-muted-foreground" />
              Open Email Client
            </a>
          </div>
        </HelpCard>

      </div>
    </div>
  );
}
