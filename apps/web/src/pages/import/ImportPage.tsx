import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, Download, CheckCircle, XCircle, AlertCircle, FileText } from "lucide-react";
import { api } from "../../lib/api.js";
import { Button } from "../../components/ui/button.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card.js";
import { cn } from "../../lib/utils.js";

type EntityType = "interpreters" | "clinics" | "patients" | "insurance-agencies" | "appointments";

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  errors: Array<{ row: number; message: string }>;
}

const ENTITY_KEYS: EntityType[] = ["interpreters", "clinics", "patients", "insurance-agencies", "appointments"];

export function ImportPage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<EntityType>("interpreters");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(f: File | null) {
    if (!f) return;
    if (!f.name.endsWith(".csv")) {
      setError(t("import.invalid_file_type"));
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFileSelect(e.dataTransfer.files[0] ?? null);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/v1/import/${selected}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("dorada_access_token")}`,
        },
        body: formData,
      });

      const text = await res.text();
      if (!res.ok) {
        let message = `Server error (${res.status})`;
        try { message = (JSON.parse(text) as { error?: { message?: string } })?.error?.message ?? message; } catch {}
        throw new Error(message);
      }

      const data = JSON.parse(text) as ImportResult;
      setResult(data);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadTemplate() {
    const link = document.createElement("a");
    link.href = `/api/v1/import/template/${selected}`;
    link.setAttribute("download", `${selected}-template.csv`);
    link.click();
  }

  const entityLabel = t(`import.entity.${selected}`);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("import.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("import.subtitle")}</p>
      </div>

      {/* Entity selector */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ENTITY_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => { setSelected(key); setFile(null); setResult(null); setError(null); }}
            className={cn(
              "rounded-lg border px-3 py-3 text-left text-sm font-medium transition-colors",
              selected === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {t(`import.entity.${key}`)}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left — instructions + template */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("import.format_card_title", { entity: entityLabel })}</CardTitle>
            <CardDescription>{t(`import.desc.${selected}`)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{t(`import.note.${selected}`)}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="w-full gap-2">
              <Download className="h-4 w-4" />
              {t("import.download_template", { entity: entityLabel })}
            </Button>
            <p className="text-xs text-muted-foreground">{t("import.template_hint")}</p>
          </CardContent>
        </Card>

        {/* Right — upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("import.upload_card_title")}</CardTitle>
            <CardDescription>{t("import.upload_card_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 cursor-pointer transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50",
              )}
            >
              {file ? (
                <>
                  <FileText className="h-8 w-8 text-primary" />
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("import.file_size", { size: (file.size / 1024).toFixed(1) })}
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-primary">{t("import.click_to_select")}</span>{" "}
                    {t("import.drag_drop")}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("import.csv_only")}</p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            />

            {error && (
              <div className="flex gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <Button onClick={handleImport} disabled={!file || loading} className="w-full">
              {loading ? t("import.importing") : t("import.import_button", { entity: entityLabel })}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              {t("import.results_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{result.total}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("import.total_rows")}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{result.created}</p>
                <p className="text-xs text-green-600 mt-1">{t("import.created")}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                <p className="text-xs text-blue-600 mt-1">{t("import.updated")}</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div>
                <p className="text-sm font-medium text-destructive mb-2">
                  {result.errors.length === 1
                    ? t("import.errors_title", { count: result.errors.length })
                    : t("import.errors_title_plural", { count: result.errors.length })}
                </p>
                <div className="rounded-md border border-destructive/20 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-destructive/5">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-destructive w-20">{t("import.error_row")}</th>
                        <th className="px-4 py-2 text-left font-medium text-destructive">{t("import.error_message")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((err, idx) => (
                        <tr key={idx} className={cn("border-t border-destructive/10", idx % 2 === 0 ? "bg-white" : "bg-destructive/5")}>
                          <td className="px-4 py-2 font-mono text-xs">{err.row}</td>
                          <td className="px-4 py-2 text-muted-foreground">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
