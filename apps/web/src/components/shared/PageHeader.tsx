import { cn } from "../../lib/utils.js";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn(
      "sticky top-0 z-20 -mx-6 px-6 -mt-6 pt-5 pb-4 mb-6",
      "bg-background border-b border-border",
      "flex items-center justify-between gap-4",
      className,
    )}>
      <div>
        <h1 className="text-[2em] font-bold tracking-tight leading-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
