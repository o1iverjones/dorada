import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface PageHeaderContextValue {
  title: ReactNode;
  description?: string;
  /** Called by TopBar to register the DOM node where actions will be portaled into */
  setActionsTarget: (el: HTMLElement | null) => void;
  actionsTarget: HTMLElement | null;
  setTitle: (title: ReactNode, description?: string) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue>({
  title: "",
  description: undefined,
  actionsTarget: null,
  setActionsTarget: () => {},
  setTitle: () => {},
});

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitleState] = useState<ReactNode>("");
  const [description, setDescriptionState] = useState<string | undefined>(undefined);
  const [actionsTarget, setActionsTargetState] = useState<HTMLElement | null>(null);

  const setTitle = useCallback((t: ReactNode, d?: string) => {
    setTitleState(t);
    setDescriptionState(d);
  }, []);

  const setActionsTarget = useCallback((el: HTMLElement | null) => {
    setActionsTargetState(el);
  }, []);

  return (
    <PageHeaderContext.Provider value={{ title, description, actionsTarget, setActionsTarget, setTitle }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader() {
  return useContext(PageHeaderContext);
}
