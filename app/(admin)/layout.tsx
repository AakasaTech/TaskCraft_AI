import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAuthUser } from '@/lib/auth/helpers'
import { LayoutDashboard, Users, Gift } from 'lucide-react'

export const dynamic = 'force-dynamic'

const navItems = [
  { href: '/admin',          label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users',    label: 'Users',     icon: Users },
  { href: '/admin/freepass', label: 'Free Pass', icon: Gift },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (!adminEmails.includes(user.email?.toLowerCase() ?? '')) redirect('/dashboard')

  return (
    <div className="flex min-h-screen bg-gray-950 text-white">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-white/10 bg-gray-900">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <img src="/app_icon.png" alt="TaskCraft AI" className="h-7 w-auto shrink-0 rounded-md" />
            <div>
              <p className="text-xs font-bold leading-tight text-white">TaskCraft AI</p>
              <p className="text-[10px] text-gray-400">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-white/10 bg-gray-900/50 px-8 py-3">
          <p className="text-xs text-gray-400">{user.email}</p>
        </header>
        <main className="flex-1 overflow-auto bg-gray-950 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
