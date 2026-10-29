import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { availableSlots, upcomingOpenDays } from "@/lib/slots";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agendar")({
  head: () => ({
    meta: [
      { title: "Agendar horário | GH Barbearia" },
      { name: "description", content: "Escolha serviço, dia e horário na GH Barbearia." },
      { property: "og:title", content: "Agendar horário | GH Barbearia" },
      { property: "og:description", content: "Reserve seu corte em segundos." },
    ],
  }),
  component: Agendar,
});

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

function Agendar() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: hours } = useQuery({
    queryKey: ["work_hours"],
    queryFn: async () => (await supabase.from("work_hours").select("*")).data ?? [],
  });
  const { data: off } = useQuery({
    queryKey: ["days_off"],
    queryFn: async () => (await supabase.from("days_off").select("day")).data ?? [],
  });
  const days = useMemo(() => {
    if (!hours) return [];
    const offSet = new Set((off ?? []).map((d) => d.day));
    return upcomingOpenDays(
      12,
      (key, wd) => !offSet.has(key) && !!hours.find((h) => h.weekday === wd && h.is_open),
    );
  }, [hours, off]);
  const dayHours = day
    ? hours?.find((h) => h.weekday === new Date(day + "T12:00:00-03:00").getUTCDay())
    : undefined;

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user!.id)
        .maybeSingle();
      return data;
    },
  });
  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () =>
      (await supabase.from("services").select("*").order("sort_order")).data ?? [],
  });
  const { data: busy, isPending: busyPending } = useQuery({
    queryKey: ["busy", day],
    enabled: !!day,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_busy_slots", { day: day! });
      if (error) throw error;
      return new Set((data as unknown as string[]).map((s) => new Date(s).getTime()));
    },
  });
  const { data: isBarber } = useQuery({
    queryKey: ["isBarber"],
    queryFn: async () => (await supabase.rpc("is_barbeiro")).data === true,
  });
  const { data: mine } = useQuery({
    queryKey: ["mine"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      // RLS lets a barber read every row, so scope "your bookings" explicitly
      // to the signed-in user instead of relying on the policies alone.
      if (!u.user) return [];
      const { data } = await supabase
        .from("appointments")
        .select("id, starts_at, status, services(name, price)")
        .eq("user_id", u.user.id)
        .eq("status", "agendado")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at");
      return data ?? [];
    },
  });

  const service = services?.find((s) => s.id === serviceId);
  const slots =
    day && service && busy
      ? availableSlots(day, service.duration_minutes, busy, Date.now(), dayHours)
      : [];
  const busyLoading = !!day && busyPending;

  const book = async () => {
    if (!service || !slot) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("appointments")
      .insert({ user_id: u.user!.id, service_id: service.id, starts_at: slot });
    setSaving(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Esse horário acabou de ser reservado. Escolha outro."
          : "Não foi possível agendar.",
      );
    } else {
      toast.success(`Agendado: ${service.name} às ${fmtTime(slot)}`);
      setSlot(null);
    }
    qc.invalidateQueries({ queryKey: ["busy"] });
    qc.invalidateQueries({ queryKey: ["mine"] });
  };

  const cancel = async (id: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelado" })
      .eq("id", id);
    if (error) toast.error("Não foi possível cancelar.");
    else toast.success("Agendamento cancelado.");
    qc.invalidateQueries({ queryKey: ["busy"] });
    qc.invalidateQueries({ queryKey: ["mine"] });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-6 pb-32">
      <header className="flex items-center justify-between">
        <Link to="/" className="font-display text-4xl">
          GH<span className="text-primary">.</span>
        </Link>
        <div className="flex items-center gap-1">
          {isBarber && (
            <Button asChild variant="outline" size="sm">
              <Link to="/painel">Painel</Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut /> Sair
          </Button>
        </div>
      </header>

      <h1 className="mt-8 text-5xl">
        Olá{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
      </h1>

      {mine && mine.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="text-2xl text-muted-foreground">Seus horários</h2>
          {mine.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-md border border-primary/40 bg-card p-4"
            >
              <div>
                <p className="font-semibold">{a.services?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(a.starts_at).toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                  })}{" "}
                  · {fmtTime(a.starts_at)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => cancel(a.id)}>
                Cancelar
              </Button>
            </div>
          ))}
        </section>
      )}

      <Step n={1} title="Serviço">
        <div className="grid gap-2 sm:grid-cols-2">
          {services?.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setServiceId(s.id);
                setSlot(null);
              }}
              className={cn(
                "flex items-center justify-between rounded-md border p-4 text-left transition-colors",
                serviceId === s.id
                  ? "border-primary bg-accent"
                  : "border-border bg-card hover:border-primary/50",
              )}
            >
              <span>
                <span className="block font-semibold">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.duration_minutes} min</span>
              </span>
              <span className="font-display text-2xl text-primary">
                R$ {Number(s.price).toFixed(0)}
              </span>
            </button>
          ))}
        </div>
      </Step>

      <Step n={2} title="Dia">
        {days.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {hours ? "Nenhum dia disponível para agendar." : "Carregando dias…"}
          </p>
        )}
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2">
          {days.map(({ key, date }) => (
            <button
              key={key}
              onClick={() => {
                setDay(key);
                setSlot(null);
              }}
              className={cn(
                "flex min-w-16 flex-col items-center rounded-md border px-3 py-3",
                day === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card",
              )}
            >
              <span className="text-xs uppercase">
                {date
                  .toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" })
                  .replace(".", "")}
              </span>
              <span className="font-display text-3xl">
                {date.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  timeZone: "America/Sao_Paulo",
                })}
              </span>
            </button>
          ))}
        </div>
      </Step>

      <Step n={3} title="Horário">
        {!service || !day ? (
          <p className="text-sm text-muted-foreground">Escolha o serviço e o dia.</p>
        ) : busyLoading ? (
          <p className="text-sm text-muted-foreground">Carregando horários…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem horários livres nesse dia.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((s) => (
              <button
                key={s}
                onClick={() => setSlot(s)}
                className={cn(
                  "rounded-md border py-2.5 text-sm font-semibold",
                  slot === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/50",
                )}
              >
                {fmtTime(s)}
              </button>
            ))}
          </div>
        )}
      </Step>

      {slot && service && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card p-4">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <p className="text-sm">
              <span className="font-semibold">{service.name}</span> · {fmtTime(slot)}
            </p>
            <Button variant="hero" className="h-11" disabled={saving} onClick={book}>
              Confirmar
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-3xl">
        <span className="text-primary">{n}.</span> {title}
      </h2>
      {children}
    </section>
  );
}
