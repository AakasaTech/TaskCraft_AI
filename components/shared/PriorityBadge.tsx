import { cn } from '@/lib/utils';
import { AlertCircle, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';
import type { TaskPriority } from '@/lib/types';

const CONFIG: Record<TaskPriority, { className: string; label: string; Icon: React.ElementType }> = {
  low:    { className: 'priority-low',    label: 'Low',    Icon: ArrowDown },
  medium: { className: 'priority-medium', label: 'Medium', Icon: ArrowRight },
  high:   { className: 'priority-high',   label: 'High',   Icon: ArrowUp },
  urgent: { className: 'priority-urgent', label: 'Urgent', Icon: AlertCircle },
};

interface PriorityBadgeProps {
  priority: TaskPriority;
  iconOnly?: boolean;
}

export function PriorityBadge({ priority, iconOnly = false }: PriorityBadgeProps) {
  const { className, label, Icon } = CONFIG[priority];
  return (
    <span className={cn(className, 'inline-flex items-center gap-1')}>
      <Icon className="h-3 w-3" />
      {!iconOnly && label}
    </span>
  );
}
