import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fmtDayKey } from "@/lib/slots";
import { cn } from "@/lib/utils";

const NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
type H = { weekday: number; is_open: boolean; open_min: number; close_min: number };
const toTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + (m ?? 0);
};

export function WorkSchedule() {
  const qc = useQueryClient();
  const [rows, setRows] = useState<H[]>([]);
  const [saving, setSaving] = useState(false);
  const [offDay, setOffDay] = useState("");
  const [offNote, setOffNote] = useState("");

  const { data: hours } = useQuery({
    queryKey: ["work_hours"],
    queryFn: async () =>
      (await supabase.from("work_hours").select("*").order("weekday")).data ?? [],
  });
  const { data: off } = useQuery({
    queryKey: ["days_off"],
    queryFn: async () => (await supabase.from("days_off").select("*").order("day")).data ?? [],
  });

  useEffect(() => {
    if (hours)
      setRows(
        Array.from(
          { length: 7 },
          (_, i) =>
            hours.find((h) => h.weekday === i) ?? {
              weekday: i,
              is_open: false,
              open_min: 540,
              close_min: 1140,
            },
        ),
      );
  }, [hours]);

  const patch = (i: number, p: Partial<H>) =>
    setRows((r) => r.map((x) => (x.weekday === i ? { ...x, ...p } : x)));

  const save = async () => {
    if (rows.some((r) => r.is_open && r.close_min <= r.open_min)) {
      toast.error("O fechamento precisa ser depois da abertura.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("work_hours").upsert(rows);
    setSaving(false);
    if (error) toast.error("Não foi possível salvar.");
    else toast.success("Horários salvos.");
    qc.invalidateQueries({ queryKey: ["work_hours"] });
  };

  const addOff = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from("days_off")
      .upsert({ day: offDay, note: offNote || null });
    if (error) {
      toast.error("Não foi possível salvar a folga.");
      return;
    }
    toast.success("Folga marcada.");
    setOffDay("");
    setOffNote("");
    qc.invalidateQueries({ queryKey: ["days_off"] });
  };
  const removeOff = async (day: string) => {
    await supabase.from("days_off").delete().eq("day", day);
    qc.invalidateQueries({ queryKey: ["days_off"] });
  };

  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <section className="mt-14 border-t border-border pt-8">
      <h2 className="text-3xl">Dias e horários de trabalho</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Os clientes só conseguem marcar nos dias e horários abertos aqui.
      </p>
      <ul className="mt-4 divide-y divide-border border-y border-border">
        {order.map((i) => {
          const r = rows.find((x) => x.weekday === i);
          if (!r) return null;
          return (
            <li key={i} className="flex flex-wrap items-center gap-3 py-3">
              <button
                type="button"
                onClick={() => patch(i, { is_open: !r.is_open })}
                className={cn(
                  "w-28 rounded-md border px-3 py-2 text-left text-sm font-semibold",
                  r.is_open
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {NAMES[i]}
              </button>
              {r.is_open ? (
                <div className="flex items-center gap-2 text-sm">
                  <Input
                    type="time"
                    step={1800}
                    value={toTime(r.open_min)}
                    className="w-28"
                    onChange={(e) =>
                      e.target.value && patch(i, { open_min: toMin(e.target.value) })
                    }
                  />
                  até
                  <Input
                    type="time"
                    step={1800}
                    value={toTime(r.close_min)}
                    className="w-28"
                    onChange={(e) =>
                      e.target.value && patch(i, { close_min: toMin(e.target.value) })
                    }
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Fechado</span>
              )}
            </li>
          );
        })}
      </ul>
      <Button variant="hero" className="mt-4 h-11" onClick={save} disabled={saving}>
        Salvar horários
      </Button>

      <h3 className="mt-10 text-2xl">Folgas e feriados</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Datas em que não vai atender, mesmo sendo dia aberto.
      </p>
      <ul className="mt-3 space-y-2">
        {(off ?? [])
          .filter((d) => d.day >= fmtDayKey(new Date()))
          .map((d) => (
            <li
              key={d.day}
              className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <span>
                {new Date(d.day + "T12:00:00-03:00").toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                })}
                {d.note ? ` · ${d.note}` : ""}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => removeOff(d.day)}
              >
                <X /> Tirar
              </Button>
            </li>
          ))}
      </ul>
      <form onSubmit={addOff} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          type="date"
          required
          value={offDay}
          onChange={(e) => setOffDay(e.target.value)}
          className="sm:w-44"
        />
        <Input
          placeholder="motivo (opcional)"
          value={offNote}
          onChange={(e) => setOffNote(e.target.value)}
          className="sm:flex-1"
        />
        <Button type="submit" variant="outline" className="h-11">
          Marcar folga
        </Button>
      </form>
    </section>
  );
}
