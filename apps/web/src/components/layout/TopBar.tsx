import { useEffect, useRef } from "react";
import { usePageHeader } from "../../contexts/PageHeaderContext.js";

export function TopBar() {
  const { title, description, setActionsTarget } = usePageHeader();
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActionsTarget(actionsRef.current);
    return () => setActionsTarget(null);
  // setActionsTarget is stable (useCallback) — intentionally run once
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center border-b bg-card px-6">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {title && (
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {title}
          </h1>
        )}
        {description && (
          <p className="hidden truncate text-sm text-muted-foreground sm:block">
            {description}
          </p>
        )}
        <div ref={actionsRef} className="flex shrink-0 items-center gap-2" />
      </div>
    </header>
  );
}
