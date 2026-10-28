import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, LogOut, Phone, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { dayStartIso, fmtDayKey, upcomingOpenDays } from "@/lib/slots";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel do barbeiro | GH Barbearia" },
      { name: "description", content: "Agenda da GH Barbearia com nome e contato de cada cliente." },
      { property: "og:title", content: "Painel do barbeiro | GH Barbearia" },
      { property: "og:description", content: "Veja quem vem, a que horas e com quem falar." },
    ],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.rpc("is_barbeiro");
    if (error || !data) throw redirect({ to: "/agendar" });
  },
  component: Painel,
});

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const fmtLongDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long" }).format(new Date(iso));
const brl = (n: number) => `R$ ${n.toFixed(0)}`;
const waHref = (phone: string | null, name: string) => {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const n = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(`Olá${name ? ` ${name.split(" ")[0]}` : ""}, aqui é da GH Barbearia!`)}`;
};

type Row = {
  id: string;
  starts_at: string;
  status: string;
  notes: string | null;
  profiles: { full_name: string | null; phone: string | null } | null;
  services: { name: string; price: number } | null;
};

function Painel() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const days = useMemo(() => upcomingOpenDays(12), []);
  const [day, setDay] = useState<string>(() => fmtDayKey(new Date()));
  const [showCancelled, setShowCancelled] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["agenda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, starts_at, status, notes, profiles(full_name, phone), services(name, price)")
        .gte("starts_at", dayStartIso(fmtDayKey(new Date())))
        .lt("starts_at", new Date(Date.now() + 30 * 86400000).toISOString())
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const { data: team } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("barbeiro_team");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("painel-agenda")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        qc.invalidateQueries({ queryKey: ["agenda"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const all = rows ?? [];
  const ofDay = all.filter((r) => fmtDayKey(new Date(r.starts_at)) === day);
  const visible = showCancelled ? ofDay : ofDay.filter((r) => r.status !== "cancelado");
  const active = ofDay.filter((r) => r.status === "agendado" || r.status === "concluido");
  const money = active.reduce((s, r) => s + Number(r.services?.price ?? 0), 0);
  const perDay = (key: string) =>
    all.filter((r) => fmtDayKey(new Date(r.starts_at)) === key && (r.status === "agendado" || r.status === "concluido")).length;

  const setStatus = async (id: string, status: string, label: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) toast.error("Não foi possível atualizar.");
    else toast.success(label);
    qc.invalidateQueries({ queryKey: ["agenda"] });
  };

  const addBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("add_barbeiro", { _email: email });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Acesso de barbeiro liberado.");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["team"] });
    }
  };

  const removeBarber = async (id: string) => {
    const { error } = await supabase.rpc("remove_barbeiro", { _user_id: id });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["team"] });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-6 pb-24">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <Link to="/" className="font-display text-4xl">GH<span className="text-primary">.</span></Link>
          <span className="text-xs uppercase tracking-[0.25em] text-primary">Painel</span>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}><LogOut /> Sair</Button>
      </header>

      <div className="-mx-5 mt-8 flex gap-2 overflow-x-auto px-5 pb-2">
        {days.map(({ key, date }) => {
          const n = perDay(key);
          return (
            <button key={key} onClick={() => setDay(key)}
              className={cn("flex min-w-16 flex-col items-center rounded-md border px-3 py-3",
                day === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
              <span className="text-xs uppercase">{date.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" }).replace(".", "")}</span>
              <span className="font-display text-3xl">{date.toLocaleDateString("pt-BR", { day: "2-digit", timeZone: "America/Sao_Paulo" })}</span>
              {n > 0 && (
                <span className={cn("mt-1 rounded-full px-1.5 text-[10px] font-bold",
                  day === key ? "bg-primary-foreground/20" : "bg-primary/20 text-primary")}>{n}</span>
              )}
            </button>
          );
        })}
      </div>

      <section className="mt-6 flex flex-wrap items-end justify-between gap-3 border-y border-border py-4">
        <h1 className="text-4xl capitalize">{fmtLongDate(new Date(day + "T12:00:00-03:00").toISOString())}</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-display text-3xl text-primary">{active.length}</span> cliente{active.length === 1 ? "" : "s"} ·{" "}
          <span className="font-display text-3xl text-primary">{brl(money)}</span> previsto
        </p>
      </section>

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Carregando a agenda…</p>}

      {!isLoading && visible.length === 0 && (
        <p className="mt-10 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum horário nesse dia.
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {visible.map((r) => {
          const name = r.profiles?.full_name?.trim() || "Cliente sem nome";
          const wa = waHref(r.profiles?.phone ?? null, name);
          const done = r.status === "concluido";
          const missing = r.status === "faltou";
          const cancelled = r.status === "cancelado";
          return (
            <li key={r.id}
              className={cn("rounded-md border bg-card p-4",
                cancelled || missing ? "border-border opacity-60" : "border-primary/40")}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className={cn("font-display text-4xl leading-none text-primary", cancelled && "line-through")}>{fmtTime(r.starts_at)}</p>
                  <p className={cn("mt-2 truncate text-xl", cancelled && "line-through")}>{name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {r.services?.name} · {brl(Number(r.services?.price ?? 0))}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </p>
                  {r.profiles?.phone && <p className="mt-1 text-sm text-muted-foreground">{r.profiles.phone}</p>}
                </div>
                <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                  done ? "border-primary bg-primary text-primary-foreground"
                    : missing ? "border-destructive text-destructive"
                      : cancelled ? "border-border text-muted-foreground line-through"
                        : "border-primary/50 text-primary")}>
                  {done ? "Feito" : missing ? "Faltou" : cancelled ? "Cancelado" : "Esperando"}
                </span>
              </div>

              {r.status === "agendado" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="hero" onClick={() => setStatus(r.id, "concluido", "Atendimento concluído.")}>
                    <Check /> Feito
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "faltou", "Marcado como faltou.")}>Faltou</Button>
                  <Button size="sm" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => setStatus(r.id, "cancelado", "Horário cancelado.")}>
                    <X /> Cancelar
                  </Button>
                  {wa && (
                    <Button size="sm" variant="ghost" asChild>
                      <a href={wa} target="_blank" rel="noreferrer"><Phone /> WhatsApp</a>
                    </Button>
                  )}
                </div>
              )}
              {(done || missing || cancelled) && (
                <button className="mt-3 text-xs uppercase tracking-wider text-muted-foreground hover:text-primary"
                  onClick={() => setStatus(r.id, "agendado", "Horário reaberto.")}>
                  Reabrir horário
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {ofDay.some((r) => r.status === "cancelado") && (
        <button className="mt-4 text-xs uppercase tracking-wider text-muted-foreground hover:text-primary"
          onClick={() => setShowCancelled(!showCancelled)}>
          {showCancelled ? "Esconder cancelados" : "Ver cancelados"}
        </button>
      )}

      <section className="mt-14 border-t border-border pt-8">
        <h2 className="text-3xl">Quem tem acesso</h2>
        <p className="mt-1 text-sm text-muted-foreground">Só quem está aqui vê a agenda completa e os contatos dos clientes.</p>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {(team ?? []).map((t) => (
            <li key={t.user_id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{t.full_name || t.email}</span>
                <span className="block truncate text-sm text-muted-foreground">{t.email}</span>
              </span>
              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
                onClick={() => removeBarber(t.user_id)}>
                <X /> Remover
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={addBarber} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input type="email" required placeholder="e-mail do barbeiro" value={email}
            onChange={(e) => setEmail(e.target.value)} className="sm:flex-1" />
          <Button type="submit" variant="hero" className="h-11" disabled={busy}>
            <UserPlus /> Dar acesso
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">A pessoa precisa ter conta criada antes (mesmo e-mail do cadastro).</p>
      </section>
    </main>
  );
}
