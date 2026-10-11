// Выгрузка базы в XML формата обмена 1С (КонвертацияДанных 2.0) —
// тот же формат, который понимает наш «Импорт из 1С». Так можно перенести
// товары, услуги и документы из одной нашей базы в другую.

import { db } from "@/integrations/db";

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Код для обмена: код 1С, если он похож на UUID, иначе наш id. */
const outId = (r: { id: string; ext_1c_id?: string | null }) =>
  r.ext_1c_id && UUID.test(r.ext_1c_id.trim()) ? r.ext_1c_id.trim() : r.id;

async function loadAll(table: string, wsId: string) {
  const out: any[] = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await (db as any)
      .from(table).select("*").eq("workspace_id", wsId).range(from, from + step - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < step) break;
  }
  return out;
}

async function loadItems(invoiceIds: string[]) {
  const out: any[] = [];
  for (let i = 0; i < invoiceIds.length; i += 200) {
    const part = invoiceIds.slice(i, i + 200);
    const { data, error } = await (db as any).from("invoice_items").select("*").in("invoice_id", part);
    if (error) throw new Error(`invoice_items: ${error.message}`);
    out.push(...(data ?? []));
  }
  return out;
}

const s = (name: string, v: unknown) =>
  v === null || v === undefined || v === ""
    ? ""
    : `    <Свойство Имя="${esc(name)}" Тип="Строка"><Значение>${esc(v)}</Значение></Свойство>\n`;
const n = (name: string, v: unknown) =>
  `    <Свойство Имя="${esc(name)}" Тип="Число"><Значение>${Number(v ?? 0) || 0}</Значение></Свойство>\n`;
const b = (name: string, v: boolean) =>
  `    <Свойство Имя="${esc(name)}" Тип="Булево"><Значение>${v ? "true" : "false"}</Значение></Свойство>\n`;
const refXml = (id: string) =>
  `<Ссылка><Свойство Имя="{УникальныйИдентификатор}" Тип="Строка"><Значение>${esc(id)}</Значение></Свойство></Ссылка>`;
const r = (name: string, type: string, id: string | null | undefined) =>
  id ? `    <Свойство Имя="${esc(name)}" Тип="${esc(type)}">${refXml(id)}</Свойство>\n` : "";
const obj = (type: string, id: string, body: string) =>
  `  <Объект Тип="${esc(type)}">\n    ${refXml(id)}\n${body}  </Объект>\n`;

export type ExportScope = "products" | "all";

export type ExportResult = { xml: string; counts: Record<string, number> };

/** products — папки, товары и услуги; all — плюс склады, контрагенты и все документы. */
export async function buildBaseExchangeXml(wsId: string, scope: ExportScope): Promise<ExportResult> {
  const [folders, products] = await Promise.all([
    loadAll("product_folders", wsId),
    loadAll("products", wsId),
  ]);
  const folderOut = new Map(folders.map((f) => [f.id, outId(f)]));
  const productOut = new Map(products.map((p) => [p.id, outId(p)]));
  const counts: Record<string, number> = { папки: folders.length, товары: products.length };
  let body = "";

  const NOM = "СправочникСсылка.Номенклатура";
  for (const f of folders) {
    body += obj(NOM, folderOut.get(f.id)!,
      s("Наименование", f.name || "Папка") +
      b("ЭтоГруппа", true) +
      r("Родитель", NOM, f.parent_id ? folderOut.get(f.parent_id) : null));
  }
  for (const p of products) {
    const service = Boolean(p.is_service) || p.kind === "service";
    body += obj(NOM, productOut.get(p.id)!,
      s("Наименование", p.name || "Товар") +
      s("Артикул", p.sku) +
      s("ЕдиницаХраненияОстатков", p.unit || "шт") +
      b("ЭтоУслуга", service) +
      n("Цена", p.price) +
      n("ЗакупочнаяЦена", p.cost) +
      s("Комментарий", p.description ?? p.comment) +
      r("Родитель", NOM, p.folder_id ? folderOut.get(p.folder_id) : null));
  }

  if (scope === "all") {
    const [warehouses, partners, invoices] = await Promise.all([
      loadAll("warehouses", wsId),
      loadAll("partners", wsId),
      loadAll("invoices", wsId),
    ]);
    const items = await loadItems(invoices.map((i) => i.id));
    const whOut = new Map(warehouses.map((w) => [w.id, outId(w)]));
    const partnerOut = new Map(partners.map((p) => [p.id, outId(p)]));
    const invOut = new Map(invoices.map((i) => [i.id, outId(i)]));
    const itemsBy = new Map<string, any[]>();
    for (const it of items) {
      const arr = itemsBy.get(it.invoice_id) ?? [];
      arr.push(it);
      itemsBy.set(it.invoice_id, arr);
    }
    Object.assign(counts, {
      склады: warehouses.length,
      контрагенты: partners.length,
      документы: invoices.length,
      позиции: items.length,
    });

    for (const w of warehouses) {
      body += obj("СправочникСсылка.Склады", whOut.get(w.id)!, s("Наименование", w.name || "Склад"));
    }
    const PT = "СправочникСсылка.Контрагенты";
    for (const p of partners) {
      body += obj(PT, partnerOut.get(p.id)!,
        s("Наименование", p.name || "Без имени") +
        s("НаименованиеПолное", p.full_name) +
        s("ИНН", p.inn) +
        s("КПП", p.kpp) +
        s("КодПоОКПО", p.okpo) +
        s("ЮридическоеФизическоеЛицо", p.entity_type === "individual" ? "ФизическоеЛицо" : "ЮридическоеЛицо") +
        s("ВидКонтрагента", p.kind) +
        s("Телефон", p.phone) +
        s("Email", p.email) +
        s("Адрес", p.address) +
        s("Комментарий", p.comment) +
        b("ЭтоГруппа", Boolean(p.is_group)) +
        r("Родитель", PT, p.parent_id ? partnerOut.get(p.parent_id) : null));
    }

    const docType = (i: any): string | null => {
      const inc = i.kind === "incoming";
      if (i.doc_type === "shipment") return inc ? "ПоступлениеТоваровУслуг" : "РеализацияТоваровУслуг";
      if (i.doc_type === "order") return inc ? "ЗаказПоставщику" : "ЗаказПокупателя";
      if (i.doc_type === "cash_receipt") return inc ? "ПриходныйКассовыйОрдер" : "РасходныйКассовыйОрдер";
      return null;
    };
    for (const i of invoices) {
      const t = docType(i);
      if (!t) continue;
      const rows = itemsBy.get(i.id) ?? [];
      const goods = rows.filter((x) => x.kind !== "service");
      const services = rows.filter((x) => x.kind === "service");
      const table = (name: string, list: any[]) =>
        list.length
          ? `    <ТабличнаяЧасть Имя="${name}">\n` +
            list.map((x) =>
              `    <Запись>\n` +
              r("Номенклатура", NOM, x.product_id ? productOut.get(x.product_id) : null) +
              s("Наименование", x.name) +
              n("Количество", x.quantity) +
              n("Цена", x.price) +
              n("Сумма", x.sum ?? Number(x.quantity ?? 0) * Number(x.price ?? 0)) +
              `    </Запись>\n`).join("") +
            `    </ТабличнаяЧасть>\n`
          : "";
      body += obj(`ДокументСсылка.${t}`, invOut.get(i.id)!,
        s("Номер", i.number) +
        s("Дата", i.issue_date) +
        r("Контрагент", PT, i.partner_id ? partnerOut.get(i.partner_id) : null) +
        r("Склад", "СправочникСсылка.Склады", i.warehouse_id ? whOut.get(i.warehouse_id) : null) +
        r("ДокументОснование", "ДокументСсылка", i.parent_id ? invOut.get(i.parent_id) : null) +
        n("СуммаДокумента", i.total) +
        s("СтатусCRM", i.status) +
        s("Комментарий", i.note) +
        table("Товары", goods) +
        table("Услуги", services));
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ФайлОбмена ВерсияФормата="2.0" ДатаВыгрузки="${new Date().toISOString().slice(0, 19)}" ` +
    `ИмяКонфигурацииИсточника="КабинетCRM">\n` +
    body +
    `</ФайлОбмена>\n`;
  return { xml, counts };
}
