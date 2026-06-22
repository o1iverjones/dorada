import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card.js";
import { Button } from "../ui/button.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog.js";
import { toast } from "../../hooks/use-toast.js";
import { useEntityStatus, type StatusEntity } from "../../hooks/useEntityNotes.js";
import { AlertTriangle } from "lucide-react";

interface DeactivateCardProps {
  entity: StatusEntity;
  id: string;
  isActive: boolean;
}

export function DeactivateCard({ entity, id, isActive }: DeactivateCardProps) {
  const { t } = useTranslation();
  const { deactivate, reactivate } = useEntityStatus(entity, id);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);

  const label = t(`status.entity_${entity}`);

  return (
    <>
      <Card className={!isActive ? "border-red-200 dark:border-red-900" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {!isActive && <AlertTriangle className="h-4 w-4 text-red-500" />}
            {t("status.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isActive ? t("status.active_description") : t("status.inactive_description")}
          </p>
          {isActive ? (
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 hover:bg-destructive/10 transition-colors">
              <input type="checkbox" checked={false} onChange={() => setDeactivateOpen(true)} className="h-4 w-4 accent-destructive" />
              <span className="text-sm font-medium text-destructive">{t("status.deactivate_label", { entity: label })}</span>
            </label>
          ) : (
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-green-300 bg-green-50 p-3 hover:bg-green-100 transition-colors dark:border-green-800 dark:bg-green-950/30 dark:hover:bg-green-950/50">
              <input type="checkbox" checked={false} onChange={() => setReactivateOpen(true)} className="h-4 w-4 accent-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">{t("status.reactivate_label", { entity: label })}</span>
            </label>
          )}
        </CardContent>
      </Card>

      {/* Deactivate dialog */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> {t("status.deactivate_confirm_title", { entity: label })}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("status.deactivate_confirm_body", { entity: label })}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateOpen(false)}>{t("common.cancel")}</Button>
            <Button
              variant="destructive"
              disabled={deactivate.isPending}
              onClick={async () => {
                try {
                  await deactivate.mutateAsync();
                  setDeactivateOpen(false);
                  toast({ title: t("status.deactivated_toast", { entity: label }) });
                } catch (err: unknown) {
                  setDeactivateOpen(false);
                  const code = (err as { code?: string })?.code;
                  toast({
                    title: code === "HAS_UPCOMING_APPOINTMENTS" ? t("status.deactivate_blocked") : t("common.error"),
                    variant: "destructive",
                  });
                }
              }}
            >
              {t("status.deactivate_confirm_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate dialog */}
      <Dialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("status.reactivate_confirm_title", { entity: label })}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("status.reactivate_confirm_body", { entity: label })}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReactivateOpen(false)}>{t("common.cancel")}</Button>
            <Button
              disabled={reactivate.isPending}
              onClick={async () => {
                try {
                  await reactivate.mutateAsync();
                  setReactivateOpen(false);
                  toast({ title: t("status.reactivated_toast", { entity: label }) });
                } catch {
                  toast({ title: t("common.error"), variant: "destructive" });
                }
              }}
            >
              {t("status.reactivate_confirm_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
