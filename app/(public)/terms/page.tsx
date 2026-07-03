import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for TaskCraft AI.',
};

const LAST_UPDATED = '3 July 2026';

export default function TermsPage() {
  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-12">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none space-y-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:mt-8 [&_p]:leading-relaxed [&_p]:text-muted-foreground">

          <p>
            These Terms of Service govern your use of TaskCraft AI, operated by Aakasa Digital. By creating an account
            or using the service you agree to these Terms.
          </p>

          <section>
            <h2>1. Description of Service</h2>
            <p>TaskCraft AI is a cloud-based task, project, and time-tracking SaaS application. We reserve the right to modify or discontinue features with reasonable notice.</p>
          </section>

          <section>
            <h2>2. Account Registration</h2>
            <p>You must provide accurate information and keep your credentials secure. You must be at least 16 years old. Notify us immediately at <a href="mailto:legal@aakasa.dev" className="text-primary hover:underline">legal@aakasa.dev</a> of any unauthorised access.</p>
          </section>

          <section>
            <h2>3. Subscriptions and Billing</h2>
            <p>Paid plans are billed monthly or annually via PayPal. No refunds are issued for partial periods. Price changes will be notified at least 30 days in advance. You may cancel at any time; access continues until the end of the billing period.</p>
          </section>

          <section>
            <h2>4. Acceptable Use</h2>
            <p>You agree not to violate any applicable law, upload malicious content, attempt unauthorised access, or resell the service without a written agreement.</p>
          </section>

          <section>
            <h2>5. Your Content</h2>
            <p>You retain ownership of all data you create through the service. You grant us a limited licence to host and process it solely to provide the service.</p>
          </section>

          <section>
            <h2>6. Disclaimer of Warranties</h2>
            <p>THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND.</p>
          </section>

          <section>
            <h2>7. Limitation of Liability</h2>
            <p>Our total liability shall not exceed the greater of fees paid by you in the 12 months preceding the claim or USD 100.</p>
          </section>

          <section>
            <h2>8. Governing Law</h2>
            <p>These Terms are governed by the laws of Sri Lanka. Disputes shall be resolved by binding arbitration in Colombo, Sri Lanka.</p>
          </section>

          <section>
            <h2>9. Contact</h2>
            <p>Legal questions: <a href="mailto:legal@aakasa.dev" className="text-primary hover:underline">legal@aakasa.dev</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
