'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DailyTimesheet, fmtMins } from './DailyTimesheet';
import type { TimeEntryRich } from '../_types';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekDays(anchor: Date): Date[] {
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  const day  = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(d);
    nd.setDate(d.getDate() + i);
    return nd;
  });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

interface Props {
  entries: TimeEntryRich[];
  onEdit: (entry: TimeEntryRich) => void;
  onDeleted: (id: string) => void;
}

export function WeeklyTimesheet({ entries, onEdit, onDeleted }: Props) {
  const today = new Date();
  const [anchor, setAnchor]       = useState(today);
  const [selected, setSelected]   = useState(today);

  const days = getWeekDays(anchor);
  const weekStart = days[0];
  const weekEnd   = days[6];

  function prevWeek() {
    const a = new Date(anchor);
    a.setDate(a.getDate() - 7);
    setAnchor(a);
    setSelected(a); // jump to Mon of prev week
  }
  function nextWeek() {
    const a = new Date(anchor);
    a.setDate(a.getDate() + 7);
    setAnchor(a);
    setSelected(a);
  }

  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const weekTotal = days.reduce((sum, day) => {
    const dayMins = entries
      .filter((e) => sameDay(new Date(e.start_time), day))
      .reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
    return sum + dayMins;
  }, 0);

  const selectedEntries = entries.filter((e) => sameDay(new Date(e.start_time), selected));

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={prevWeek}
          className="rounded-lg border border-border p-1.5 transition-colors hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[220px] text-center text-sm font-medium">{weekLabel}</span>
        <button
          onClick={nextWeek}
          className="rounded-lg border border-border p-1.5 transition-colors hover:bg-muted"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="ml-auto text-xs text-muted-foreground">
          Week total: <strong className="text-foreground">{fmtMins(weekTotal)}</strong>
        </span>
      </div>

      {/* Day picker strip */}
      <div className="tc-card overflow-hidden">
        <div className="grid grid-cols-7 divide-x divide-border">
          {days.map((day, i) => {
            const dayMins    = entries
              .filter((e) => sameDay(new Date(e.start_time), day))
              .reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
            const isToday    = sameDay(day, today);
            const isSelected = sameDay(day, selected);

            return (
              <button
                key={i}
                onClick={() => setSelected(day)}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-3 text-xs transition-colors',
                  isSelected ? 'bg-primary/10' : 'hover:bg-muted',
                )}
              >
                <span className={cn(
                  'text-[10px] font-semibold uppercase tracking-wide',
                  isToday && !isSelected ? 'text-primary' : 'text-muted-foreground',
                  isSelected && 'text-primary',
                )}>
                  {DOW[i]}
                </span>
                <span className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
                  isToday ? 'bg-primary text-white' : isSelected ? 'text-primary' : 'text-foreground',
                )}>
                  {day.getDate()}
                </span>
                <span className={cn(
                  'text-[10px] font-medium tabular-nums',
                  dayMins > 0 ? 'text-foreground' : 'text-transparent select-none',
                )}>
                  {fmtMins(dayMins)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day entries */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">
          {selected.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </h3>
        <DailyTimesheet entries={selectedEntries} onEdit={onEdit} onDeleted={onDeleted} />
      </div>
    </div>
  );
}
