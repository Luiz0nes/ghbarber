// Agenda: terça (2) a sábado (6), 9h às 19h, intervalos de 30 min (horário de Brasília, UTC-3).
export const OPEN_DAYS = [2, 3, 4, 5, 6];
export const OPEN_HOUR = 9;
export const CLOSE_HOUR = 19;
export const SLOT_MIN = 30;

export function daySlots(dateStr: string): string[] {
  const out: string[] = [];
  for (let m = OPEN_HOUR * 60; m < CLOSE_HOUR * 60; m += SLOT_MIN) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    out.push(`${dateStr}T${hh}:${mm}:00-03:00`);
  }
  return out;
}

/** Returns the slots (ISO) where a service of `duration` minutes fits, given busy slot timestamps (ms). */
export function availableSlots(dateStr: string, duration: number, busy: Set<number>, now = Date.now()): string[] {
  const all = daySlots(dateStr);
  const need = Math.ceil(duration / SLOT_MIN);
  return all.filter((s, i) => {
    if (new Date(s).getTime() <= now) return false;
    if (i + need > all.length) return false;
    for (let k = 0; k < need; k++) if (busy.has(new Date(all[i + k]).getTime())) return false;
    return true;
  });
}
