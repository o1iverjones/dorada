import * as React from "react";
import type { ToastProps, ToastActionElement } from "../components/ui/toast.js";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 5000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type State = { toasts: ToasterToast[] };

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(toasts: ToasterToast[]) {
  memoryState = { toasts };
  listeners.forEach((l) => l(memoryState));
}

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

export function toast(props: Omit<ToasterToast, "id">) {
  const id = genId();
  const newToast: ToasterToast = { ...props, id };
  const updated = [newToast, ...memoryState.toasts].slice(0, TOAST_LIMIT);
  dispatch(updated);
  setTimeout(() => {
    dispatch(memoryState.toasts.filter((t) => t.id !== id));
  }, TOAST_REMOVE_DELAY);
  return id;
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const idx = listeners.indexOf(setState);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (id: string) => dispatch(memoryState.toasts.filter((t) => t.id !== id)),
  };
}
