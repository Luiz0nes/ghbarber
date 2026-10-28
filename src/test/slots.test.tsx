import { describe, expect, it } from "vitest";
import { availableSlots, daySlots } from "@/lib/slots";

const day = "2030-01-08"; // terça
const past = 0;

describe("agenda", () => {
  it("abre 9h e o último horário é 18:30", () => {
    const s = daySlots(day);
    expect(s[0]).toBe(`${day}T09:00:00-03:00`);
    expect(s.at(-1)).toBe(`${day}T18:30:00-03:00`);
  });
  it("serviço de 60 min não cabe às 18:30", () => {
    expect(availableSlots(day, 60, new Set(), past)).not.toContain(`${day}T18:30:00-03:00`);
  });
  it("horário ocupado bloqueia quem precisa dele", () => {
    const busy = new Set([new Date(`${day}T10:00:00-03:00`).getTime()]);
    const s = availableSlots(day, 60, busy, past);
    expect(s).not.toContain(`${day}T09:30:00-03:00`);
    expect(s).not.toContain(`${day}T10:00:00-03:00`);
    expect(s).toContain(`${day}T10:30:00-03:00`);
  });
});
