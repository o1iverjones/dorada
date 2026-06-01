import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth.js";
import { usePageHeader } from "../../contexts/PageHeaderContext.js";

export function TopBar() {
  const { title, description, setActionsTarget } = usePageHeader();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  // This div is the portal target for <PageHeader actions={…} />
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActionsTarget(actionsRef.current);
    return () => setActionsTarget(null);
  // setActionsTarget is stable (useCallback) — intentionally run once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-6">
      {/* Left: page title + actions portal target */}
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {title && (
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {title}
          </h1>
        )}
        {description && (
          <p className="hidden truncate text-sm text-muted-foreground sm:block">
            {description}
          </p>
        )}
        {/* PageHeader portals actions into this div */}
        <div ref={actionsRef} className="flex shrink-0 items-center gap-2" />
      </div>

      {/* Right: user avatar chip → My Account */}
      <button
        onClick={() => navigate("/account")}
        className="ml-4 flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
      >
        {user?.profile_picture_url ? (
          <img
            src={user.profile_picture_url}
            alt={user.name}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </span>
        )}
        <span className="hidden sm:block">{user?.name}</span>
      </button>
    </header>
  );
}
