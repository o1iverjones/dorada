import { useLayoutEffect, useRef } from "react";
import { usePageHeader } from "../../contexts/PageHeaderContext.js";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  /** @deprecated no longer needed — kept for API compatibility */
  className?: string;
}

/**
 * PageHeader writes its title, description and actions into the
 * PageHeaderContext so they render inside the sticky TopBar at the top of the
 * page.  The component itself renders nothing in the page body.
 *
 * Using useLayoutEffect means the header updates synchronously after every
 * render, so there is no visible flash of the old title.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const { setHeader } = usePageHeader();
  const propsRef = useRef({ title, description, actions });
  propsRef.current = { title, description, actions };

  // Run after every render so actions (which often change reference) stay current
  useLayoutEffect(() => {
    setHeader({ title: propsRef.current.title, description: propsRef.current.description, actions: propsRef.current.actions });
  });

  // Clear when page unmounts
  useLayoutEffect(() => {
    return () => setHeader({ title: "" });
  }, [setHeader]);

  return null;
}
