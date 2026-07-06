import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import { ToggleActiveButton } from './ToggleActiveButton';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'Manage Users' };

interface ProfileRow {
  id:              string;
  email:           string;
  full_name:       string | null;
  avatar_url:      string | null;
  plan:            Plan;
  plan_expires_at: string | null;
  is_admin:        boolean;
  created_at:      string;
}

export default async function AdminUsersPage() {
  const supabase = createAdminClient();

  const [profilesRes, authRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, plan, plan_expires_at, is_admin, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const profiles   = (profilesRes.data ?? []) as ProfileRow[];
  const authUsers  = authRes.data?.users ?? [];

  // Build banned status map: userId → boolean
  const now = Date.now();
  const banMap = new Map<string, boolean>(
    authUsers.map((au) => [
      au.id,
      !!(au.banned_until && new Date(au.banned_until).getTime() > now),
    ]),
  );

  const activeCount    = profiles.filter((u) => !banMap.get(u.id)).length;
  const suspendedCount = profiles.filter((u) => banMap.get(u.id)).length;
  const paidCount      = profiles.filter((u) => u.plan !== 'free').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Users</h1>
        <p className="page-subtitle">
          {profiles.length} total · {activeCount} active · {suspendedCount} suspended · {paidCount} paid
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">Joined</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No users yet.</td>
                </tr>
              )}
              {profiles.map((u) => {
                const isBanned = banMap.get(u.id) ?? false;
                const initials = u.full_name
                  ? u.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                  : u.email?.[0]?.toUpperCase() ?? 'U';
                return (
                  <tr
                    key={u.id}
                    className={`border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors ${isBanned ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={u.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium leading-tight">{u.full_name ?? '—'}</p>
                            {u.is_admin && (
                              <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-bold uppercase text-primary">Admin</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        variant={u.plan === 'free' ? 'secondary' : 'default'}
                        className="capitalize text-[11px]"
                      >
                        {u.plan}
                      </Badge>
                      {u.plan_expires_at && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          until {new Date(u.plan_expires_at).toLocaleDateString()}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        isBanned
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      }`}>
                        {isBanned ? 'Suspended' : 'Active'}
                      </span>
                    </td>

                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                      {formatDate(u.created_at)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <ToggleActiveButton userId={u.id} isBanned={isBanned} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
