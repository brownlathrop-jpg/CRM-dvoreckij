import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { buildBaseExchangeXml, type ExportScope } from "@/lib/export-1c-full";
import { downloadText } from "@/lib/export-1c";
import { useActiveWorkspaceId } from "@/lib/workspace";

/** Экспорт базы в формате обмена 1С (КонвертацияДанных 2.0). */
export function Export1CPanel() {
  const wsId = useActiveWorkspaceId();
  const [exporting, setExporting] = useState<ExportScope | null>(null);

  const onExport = async (scope: ExportScope) => {
    if (!wsId) { toast.error("Не выбрана база данных"); return; }
    setExporting(scope);
    try {
      const { xml, counts } = await buildBaseExchangeXml(wsId, scope);
      const date = new Date().toISOString().slice(0, 10);
      downloadText(scope === "products" ? `товары-и-услуги-${date}.xml` : `вся-база-1с-${date}.xml`, xml, "application/xml");
      toast.success("Файл сохранён: " + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", "));
    } catch (e: any) {
      toast.error(e?.message ?? "Не удалось выгрузить");
    } finally {
      setExporting(null);
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="font-medium">Экспорт в 1С</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Файл XML в формате обмена 1С «Управление торговлей» (правила КонвертацииДанных 2.0).
          Его можно загрузить в другой базе в разделе «Настройки → Импорт → Из 1С (XML)». Накладные переносятся черновиками —
          проведите их в новой базе, чтобы двинулся склад. Повторная загрузка того же файла не создаёт дублей.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!!exporting} onClick={() => onExport("products")}>
          {exporting === "products" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          Выгрузить товары и услуги
        </Button>
        <Button variant="outline" disabled={!!exporting} onClick={() => onExport("all")}>
          {exporting === "all" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          Выгрузить всё: товары, контрагенты и документы
        </Button>
      </div>
    </Card>
  );
}
