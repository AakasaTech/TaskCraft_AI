'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { createClientRecord, updateClientRecord } from '../actions';
import type { Client } from '@/lib/types';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'INR', 'JPY', 'CHF', 'NZD'];

interface Props {
  open:      boolean;
  onClose:   () => void;
  onSuccess: (id: string) => void;
  initial?:  Client | null;
}

function field(label: string, children: React.ReactNode) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function ClientFormModal({ open, onClose, onSuccess, initial }: Props) {
  const isEdit = !!initial;
  const [pending, startTransition] = useTransition();

  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [phone,        setPhone]        = useState('');
  const [company,      setCompany]      = useState('');
  const [website,      setWebsite]      = useState('');
  const [notes,        setNotes]        = useState('');
  const [rate,         setRate]         = useState('');
  const [currency,     setCurrency]     = useState('USD');
  // address
  const [line1,    setLine1]    = useState('');
  const [city,     setCity]     = useState('');
  const [state,    setState]    = useState('');
  const [zip,      setZip]      = useState('');
  const [country,  setCountry]  = useState('');

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setEmail(initial.email ?? '');
      setBillingEmail(initial.billing_email ?? '');
      setPhone(initial.phone ?? '');
      setCompany(initial.company ?? '');
      setWebsite(initial.website ?? '');
      setNotes(initial.notes ?? '');
      setRate(initial.default_hourly_rate != null ? String(initial.default_hourly_rate) : '');
      setCurrency(initial.currency ?? 'USD');
      setLine1(initial.address?.line1 ?? '');
      setCity(initial.address?.city ?? '');
      setState(initial.address?.state ?? '');
      setZip(initial.address?.zip ?? '');
      setCountry(initial.address?.country ?? '');
    } else {
      setName(''); setEmail(''); setBillingEmail(''); setPhone('');
      setCompany(''); setWebsite(''); setNotes(''); setRate(''); setCurrency('USD');
      setLine1(''); setCity(''); setState(''); setZip(''); setCountry('');
    }
  }, [open, initial]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name is required.'); return; }

    const payload = {
      name:                name.trim(),
      email:               email.trim()        || undefined,
      billing_email:       billingEmail.trim() || undefined,
      phone:               phone.trim()        || undefined,
      company:             company.trim()      || undefined,
      website:             website.trim()      || undefined,
      notes:               notes.trim()        || undefined,
      default_hourly_rate: rate ? parseFloat(rate) : null,
      currency,
      address: { line1, city, state, zip, country },
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateClientRecord(initial!.id, payload)
        : await createClientRecord(payload);

      if (result.error) { toast.error(result.error); return; }
      toast.success(isEdit ? 'Client updated.' : 'Client added.');
      onSuccess((result as any).id ?? initial!.id);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">{isEdit ? 'Edit Client' : 'Add Client'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {/* Basic info */}
          <div className="grid gap-4 sm:grid-cols-2">
            {field('Name *',
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" required />
            )}
            {field('Company',
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corporation" />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {field('Email',
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@acme.com" />
            )}
            {field('Billing Email',
              <Input type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} placeholder="billing@acme.com" />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {field('Phone',
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
            )}
            {field('Website',
              <Input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" />
            )}
          </div>

          {/* Billing */}
          <div className="grid gap-4 sm:grid-cols-2">
            {field('Default Hourly Rate',
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            )}
            {field('Currency',
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Address</p>
            <div className="grid gap-3">
              <Input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Street address" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Input value={city}    onChange={(e) => setCity(e.target.value)}    placeholder="City"    className="sm:col-span-2" />
                <Input value={state}   onChange={(e) => setState(e.target.value)}   placeholder="State"   />
                <Input value={zip}     onChange={(e) => setZip(e.target.value)}     placeholder="ZIP"     />
              </div>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" />
            </div>
          </div>

          {/* Notes */}
          {field('Notes',
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes about this client…"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button type="button" onClick={onClose} className="tc-btn-secondary" disabled={pending}>
              Cancel
            </button>
            <button type="submit" className="tc-btn-primary gap-2" disabled={pending}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? 'Save changes' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
