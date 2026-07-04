import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — TaskCraft AI',
  description: 'Simple, transparent pricing for TaskCraft AI. Free forever for solo users. Upgrade to Solo ($9/mo) or Team ($19/mo) for unlimited projects, reports, integrations, and more.',
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
