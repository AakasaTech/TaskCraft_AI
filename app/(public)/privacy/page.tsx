import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for TaskCraft AI.',
};

const LAST_UPDATED = '3 July 2026';

export default function PrivacyPage() {
  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-12">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none space-y-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:mt-8 [&_p]:leading-relaxed [&_p]:text-muted-foreground">

          <p>
            This Privacy Policy describes how TaskCraft AI, operated by Aakasa Digital (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;),
            collects, uses, and protects your information when you use our service at taskcraft.aakasa.dev.
          </p>

          <section>
            <h2>1. Information We Collect</h2>
            <p>We collect information you provide directly: name, email address, and profile details when you register. We also collect data generated through use of the service: projects, tasks, time entries, and settings you create.</p>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <p>We use your information to provide and improve the service, authenticate your account, process payments, and send transactional emails (such as invoices or subscription confirmations). We do not sell your data.</p>
          </section>

          <section>
            <h2>3. Data Storage and Security</h2>
            <p>Your data is stored in Supabase PostgreSQL with row-level security policies enforced. All data in transit is encrypted using TLS. We follow industry-standard security practices.</p>
          </section>

          <section>
            <h2>4. Third-Party Services</h2>
            <p>We use PayPal for payment processing and Supabase for database and authentication. When you connect BillCraft AI or SupportCraft AI integrations, only the data you explicitly share is transferred between services.</p>
          </section>

          <section>
            <h2>5. Your Rights</h2>
            <p>You may access, update, or delete your account data at any time from Settings. To request complete data deletion, contact <a href="mailto:privacy@aakasa.dev" className="text-primary hover:underline">privacy@aakasa.dev</a>.</p>
          </section>

          <section>
            <h2>6. Contact</h2>
            <p>Privacy questions: <a href="mailto:privacy@aakasa.dev" className="text-primary hover:underline">privacy@aakasa.dev</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
