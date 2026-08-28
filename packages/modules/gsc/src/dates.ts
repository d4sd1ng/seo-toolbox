export function gscDefaultRange(now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return { startDate: iso(start), endDate: iso(end) };
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
