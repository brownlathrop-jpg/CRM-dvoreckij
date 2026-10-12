export type PrintParty = {
  name?: string | null;
  inn?: string | null;
  kpp?: string | null;
  address?: string | null;
  phone?: string | null;
  okpo?: string | null;
  bank_name?: string | null;
  bank_bik?: string | null;
  bank_account?: string | null;
  bank_corr_account?: string | null;
} | null;

export type PrintItem = {
  name: string;
  unit: string;
  quantity: number;
  /** Цена за единицу без НДС (когда НДС в цене — цена уже без налога). */
  price: number;
  /** Ставка НДС: null — «без НДС». */
  vatRate?: number | null;
  /** Сумма НДС по строке. */
  vatSum?: number;
  /** Сумма без НДС. */
  netSum?: number;
  /** Сумма с НДС. */
  grossSum?: number;
};


export const nfmt = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const dfmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Полная строка реквизитов для ТОРГ-12: наименование, ИНН/КПП, адрес, телефон, банк. */
export function partyFull(p: PrintParty): string {
  if (!p) return "—";
  return [
    p.name,
    p.inn ? `ИНН ${p.inn}` : "",
    p.kpp ? `КПП ${p.kpp}` : "",
    p.address,
    p.phone ? `тел. ${p.phone}` : "",
    p.bank_account ? `р/с ${p.bank_account}` : "",
    p.bank_name ? `в ${p.bank_name}` : "",
    p.bank_bik ? `БИК ${p.bank_bik}` : "",
    p.bank_corr_account ? `к/с ${p.bank_corr_account}` : "",
  ].filter(Boolean).join(", ");
}

export function partyLine(p: PrintParty): string {
  if (!p) return "—";
  return [p.name, p.address, p.inn ? `ИНН ${p.inn}` : "", p.kpp ? `КПП ${p.kpp}` : "", p.phone ? `тел. ${p.phone}` : ""]
    .filter(Boolean)
    .join(", ");
}
