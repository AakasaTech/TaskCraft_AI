import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about TaskCraft AI.',
};

const faqs = [
  { q: 'Is TaskCraft AI free?', a: 'Yes. The Free plan gives you 3 projects and 50 tasks forever at no cost. Paid plans unlock unlimited projects, tasks, and team features.' },
  { q: 'How does time tracking work?', a: 'Click the timer icon on any task to start tracking. Stop it when you\'re done. TaskCraft logs the duration, links it to the task and project, and marks it as billable or non-billable based on your preferences.' },
  { q: 'How does the BillCraft AI integration work?', a: 'Once connected, you can select a date range of billable time entries and send them directly to BillCraft AI. A professional invoice is generated with the tracked hours, rates, and project breakdown pre-filled.' },
  { q: 'Can I convert SupportCraft tickets into tasks?', a: 'Yes. With the SupportCraft AI integration enabled, you can push any support ticket into TaskCraft AI as a task — complete with the ticket title, description, and assigned agent.' },
  { q: 'What is the Team plan?', a: 'The Team plan adds multi-user workspaces, member invitations, role-based permissions (owner/admin/member/viewer), task assignment, and team-level time reports.' },
  { q: 'How is billing handled?', a: 'Paid subscriptions are processed via PayPal. You can cancel at any time from the Billing settings page. Access continues until the end of the current billing period.' },
  { q: 'Is my data secure?', a: 'All data is stored in Supabase PostgreSQL with row-level security. Connections are encrypted with TLS. We do not share your data with third parties.' },
  { q: 'Can I export my data?', a: 'Yes. You can export time reports as CSV, and task lists as JSON or CSV, from the Reports and Settings pages.' },
];

export default function FAQPage() {
  return (
    <div className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold tracking-tight">Frequently asked questions</h1>
          <p className="mt-4 text-muted-foreground">Everything you need to know about TaskCraft AI.</p>
        </div>
        <div className="space-y-6">
          {faqs.map((faq) => (
            <div key={faq.q} className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-semibold">{faq.q}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
