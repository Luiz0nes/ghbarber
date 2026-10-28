import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Instagram, MapPin, Clock, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GH Barbearia | Gustavo Henry — Barbeiro em Americana SP" },
      { name: "description", content: "Corte, barba e degradê com Gustavo Henry em Americana SP. Agende seu horário online em segundos." },
      { property: "og:title", content: "GH Barbearia — Americana SP" },
      { property: "og:description", content: "Corte, barba e degradê. Agende seu horário online." },
    ],
  }),
  component: Index,
});

const IG = "https://www.instagram.com/gh.barbearia/";

function Index() {
  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <main>
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 md:px-10">
        <span className="font-display text-3xl tracking-wider">GH<span className="text-primary">.</span></span>
        <nav className="flex items-center gap-3 text-sm">
          <a href="#servicos" className="hidden text-muted-foreground hover:text-foreground sm:block">Serviços</a>
          <Link to="/agendar" className="rounded-sm border border-primary px-3 py-1.5 font-semibold text-primary hover:bg-primary hover:text-primary-foreground">
            Minha conta
          </Link>
        </nav>
      </header>

      <section className="relative flex min-h-[100svh] items-end overflow-hidden">
        <img src={hero} alt="Barbeiro fazendo degradê na GH Barbearia" width={1088} height={1440} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-fade" />
        <div className="relative z-10 w-full px-5 pb-14 md:px-10 md:pb-20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-primary">Americana · SP</p>
          <h1 className="text-[22vw] md:text-[11rem]">GH Barbearia</h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Corte na régua, barba alinhada e atendimento de verdade com Gustavo Henry.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg" className="h-12">
              <Link to="/agendar">Agendar horário</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12">
              <a href={IG} target="_blank" rel="noreferrer"><Instagram /> @gh.barbearia</a>
            </Button>
          </div>
        </div>
      </section>

      <div className="stripe-pole h-2 w-full" />

      <section id="servicos" className="mx-auto max-w-5xl px-5 py-20 md:px-10">
        <h2 className="text-6xl md:text-7xl">Serviços</h2>
        <p className="mt-2 text-muted-foreground">Escolha o seu e garanta o horário.</p>
        <ul className="mt-10 divide-y divide-border border-y border-border">
          {(services ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 py-5">
              <div>
                <h3 className="text-3xl">{s.name}</h3>
                <p className="text-sm text-muted-foreground">{s.description} · {s.duration_minutes} min</p>
              </div>
              <span className="font-display text-3xl text-primary">R$ {Number(s.price).toFixed(0)}</span>
            </li>
          ))}
        </ul>
        <Button asChild variant="hero" size="lg" className="mt-10 h-12 w-full sm:w-auto">
          <Link to="/agendar">Reservar agora</Link>
        </Button>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 md:grid-cols-3 md:px-10">
          <Info icon={<Scissors />} title="O barbeiro" text="Gustavo Henry — especialista em degradê, navalhado e barba." />
          <Info icon={<Clock />} title="Horários" text="Terça a sábado, das 9h às 19h." />
          <Info icon={<MapPin />} title="Onde" text="Americana · SP" />
        </div>
      </section>

      <footer className="px-5 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} GH Barbearia · <a href={IG} className="hover:text-primary">Instagram</a>
      </footer>
    </main>
  );
}

function Info({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div>
      <div className="mb-3 text-primary">{icon}</div>
      <h3 className="text-3xl">{title}</h3>
      <p className="mt-1 text-muted-foreground">{text}</p>
    </div>
  );
}
