'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Search, Plus, MoreHorizontal, Pencil, Trash2,
  Building2, Mail, Phone, Clock, FolderOpen,
} from 'lucide-react';
import { ClientFormModal } from './ClientFormModal';
import { deleteClientRecord } from '../actions';
import type { Client } from '@/lib/types';

export interface ClientWithStats extends Client {
  project_count:       number;
  open_task_count:     number;
  billable_hours:      number;
}

interface Props {
  clients: ClientWithStats[];
}

export function ClientList({ clients }: Props) {
  const router = useRouter();
  const [search,    setSearch]    = useState('');
  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState<Client | null>(null);
  const [menuOpen,  setMenuOpen]  = useState<string | null>(null);
  const [, startTx] = useTransition();

  const filtered = clients.filter((c) =>
    [c.name, c.company, c.email, c.phone]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function openAdd() { setEditing(null); setModal(true); }
  function openEdit(c: Client) { setEditing(c); setModal(true); setMenuOpen(null); }

  function handleDelete(id: string) {
    setMenuOpen(null);
    if (!confirm('Delete this client? This cannot be undone.')) return;
    startTx(async () => {
      const result = await deleteClientRecord(id);
      if (result.error) { toast.error(result.error); return; }
      toast.success('Client deleted.');
    });
  }

  function handleSuccess(id: string) {
    setModal(false);
    router.refresh();
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button onClick={openAdd} className="tc-btn-primary gap-1.5">
          <Plus className="h-4 w-4" />
          Add client
        </button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-sm">{search ? 'No clients match your search.' : 'No clients yet.'}</p>
          {!search && (
            <p className="text-xs text-muted-foreground mt-1 mb-4">Add your first client to get started.</p>
          )}
          {!search && (
            <button onClick={openAdd} className="tc-btn-primary gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add client
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => (
            <div
              key={client.id}
              className="group relative rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              {/* Menu button */}
              <div className="absolute top-4 right-4">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === client.id ? null : client.id); }}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuOpen === client.id && (
                  <div className="absolute right-0 top-full mt-1 z-10 min-w-[140px] rounded-xl border border-border bg-card shadow-lg py-1">
                    <button
                      onClick={() => openEdit(client)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(client.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>

              <Link href={`/clients/${client.id}`} className="block">
                {/* Avatar + name */}
                <div className="flex items-start gap-3 pr-8">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold text-sm uppercase">
                    {client.name.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{client.name}</p>
                    {client.company && (
                      <p className="text-xs text-muted-foreground truncate">{client.company}</p>
                    )}
                  </div>
                </div>

                {/* Contact info */}
                <div className="mt-3 space-y-1">
                  {client.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="mt-4 flex items-center gap-4 border-t border-border pt-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>{client.project_count} project{client.project_count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{client.billable_hours.toFixed(1)}h billed</span>
                  </div>
                  {client.default_hourly_rate != null && (
                    <div className="ml-auto text-xs font-medium text-primary">
                      {client.currency} {client.default_hourly_rate}/hr
                    </div>
                  )}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Click-away to close menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-[5]" onClick={() => setMenuOpen(null)} />
      )}

      <ClientFormModal
        open={modal}
        onClose={() => setModal(false)}
        onSuccess={handleSuccess}
        initial={editing}
      />
    </>
  );
}
