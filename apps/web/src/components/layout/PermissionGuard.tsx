import { useAuthStore } from "../../store/auth.js";

interface Props {
  permission: string;
  children: React.ReactNode;
}

export function PermissionGuard({ permission, children }: Props) {
  const hasPermission = useAuthStore((s) => s.hasPermission);

  if (!hasPermission(permission)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
        You do not have permission to view this page.
      </div>
    );
  }

  return <>{children}</>;
}
