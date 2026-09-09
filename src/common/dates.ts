/** Utilitários de mês/data. Tudo em UTC para consistência do "mês de referência". */

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(month: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error(`Mês inválido: ${month} (esperado YYYY-MM)`);
  const year = Number(match[1]);
  const m = Number(match[2]) - 1;
  const start = new Date(Date.UTC(year, m, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, m + 1, 1, 0, 0, 0));
  return { start, end };
}

export function addMonths(date: Date, count: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + count);
  return d;
}

export function daysInMonth(month: string): number {
  const { start, end } = monthRange(month);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/** "Hoje" / "Ontem" / "terça, 1" — rótulo de grupo de dia (pt-BR). */
export function dayLabel(date: Date, now = new Date()): string {
  const d0 = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const n0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = Math.round((n0 - d0) / 86_400_000);
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  const weekday = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    timeZone: 'UTC',
  });
  return `${weekday}, ${date.getUTCDate()}`;
}
