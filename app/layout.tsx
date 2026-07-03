import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'TaskCraft AI | Plan smarter. Track faster. Invoice instantly.',
    template: '%s | TaskCraft AI',
  },
  description:
    'TaskCraft AI is a task, project, and time-tracking platform built for freelancers, consultants, and small teams. Integrated with BillCraft AI for seamless invoicing.',
  keywords: ['task management', 'project tracking', 'time tracking', 'invoicing', 'freelancer tools', 'SaaS'],
  metadataBase: new URL('https://taskcraft.aakasa.dev'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://taskcraft.aakasa.dev',
    siteName: 'TaskCraft AI',
    title: 'TaskCraft AI | Plan smarter. Track faster. Invoice instantly.',
    description: 'Task, project, and time-tracking SaaS for freelancers and small teams.',
    images: [{ url: '/android-chrome-512x512.png', width: 512, height: 512 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TaskCraft AI | Plan smarter. Track faster. Invoice instantly.',
    description: 'Task, project, and time-tracking SaaS for freelancers and small teams.',
    images: ['/android-chrome-512x512.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: { url: '/apple-touch-icon.png' },
    other: [{ rel: 'manifest', url: '/site.webmanifest' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
