/** Упорядочить строки документа по сохранённому номеру позиции. Строки без номера — в конце, в исходном порядке. */
export function sortItems<T extends { position?: unknown }>(rows: T[]): T[] {
  return rows
    .map((r, i) => ({ r, i, p: Number(r.position) }))
    .sort((a, b) => {
      const pa = Number.isFinite(a.p) && a.p > 0 ? a.p : Infinity;
      const pb = Number.isFinite(b.p) && b.p > 0 ? b.p : Infinity;
      return pa === pb ? a.i - b.i : pa - pb;
    })
    .map((x) => x.r);
}

/** Переместить элемент списка с одного места на другое. */
export function moveItem<T>(rows: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return rows;
  const next = rows.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}
