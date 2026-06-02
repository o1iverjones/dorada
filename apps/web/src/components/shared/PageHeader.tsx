import { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePageHeader } from "../../contexts/PageHeaderContext.js";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  /** @deprecated no longer needed — kept for API compatibility */
  className?: string;
}

/**
 * PageHeader pushes title + description into the sticky TopBar via context
 * (stable string values → no render loop).  Actions are rendered directly
 * into the TopBar's reserved DOM node via createPortal — no state update
 * involved, so there is no infinite-update cycle.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const { setTitle, actionsTarget } = usePageHeader();

  // Only runs when title / description actually change — safe, no loop.
  useEffect(() => {
    setTitle(title, description);
    return () => setTitle("", undefined);
  }, [title, description]);

  // Render actions into the TopBar portal target.
  // createPortal does NOT call setState so it never triggers a re-render loop.
  if (!actions || !actionsTarget) return null;
  return createPortal(actions, actionsTarget);
}
