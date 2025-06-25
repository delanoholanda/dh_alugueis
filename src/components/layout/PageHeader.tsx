import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 p-6 rounded-lg shadow bg-card", className)}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && <Icon className="h-8 w-8 text-primary" />}
          <div>
            <h1 className="text-2xl md:text-3xl font-headline font-semibold text-foreground">{title}</h1>
            {description && <p className="text-sm md:text-base text-muted-foreground mt-1">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex gap-2 mt-4 md:mt-0 self-start md:self-center">{actions}</div>}
      </div>
    </div>
  );
}
