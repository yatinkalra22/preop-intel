export function maskName(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return name;
  return parts
    .map((p) => (p.length <= 1 ? '*' : `${p[0]}${'*'.repeat(Math.max(2, p.length - 1))}`))
    .join(' ');
}

export function maskId(id: string): string {
  if (id.length <= 4) return '****';
  return `${id.slice(0, 2)}****${id.slice(-2)}`;
}

export function maskDate(date: string): string {
  // Keep year-level context while masking exact date.
  const year = date.slice(0, 4);
  return year && /^\d{4}$/.test(year) ? `${year}-**-**` : '**/**/****';
}
