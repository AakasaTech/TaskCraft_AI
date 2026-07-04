import type { Metadata } from 'next';
import { SecurityClient } from './_components/SecurityClient';

export const metadata: Metadata = { title: 'Security' };

export default function SecurityPage() {
  return <SecurityClient />;
}
