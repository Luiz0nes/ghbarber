import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | GH Barbearia" },
      { name: "description", content: "Entre ou crie sua conta para agendar na GH Barbearia." },
      { property: "og:title", content: "Entrar | GH Barbearia" },
      { property: "og:description", content: "Acesse sua conta e agende seu horário." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/agendar" });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/agendar" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { emailRedirectTo: window.location.origin + "/agendar", data: { full_name: form.name, phone: form.phone } },
      });
      if (error) toast.error(error.message);
      else toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      if (error) toast.error("E-mail ou senha inválidos.");
    }
    setLoading(false);
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Não foi possível entrar com Google.");
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <Link to="/" className="font-display text-5xl">GH<span className="text-primary">.</span></Link>
      <div className="mt-8 w-full max-w-sm rounded-md border border-border bg-card p-6">
        <h1 className="text-4xl">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <>
              <div className="space-y-1.5"><Label>Nome</Label><Input required value={form.name} onChange={set("name")} /></div>
              <div className="space-y-1.5"><Label>WhatsApp</Label><Input required type="tel" placeholder="(19) 99999-9999" value={form.phone} onChange={set("phone")} /></div>
            </>
          )}
          <div className="space-y-1.5"><Label>E-mail</Label><Input required type="email" value={form.email} onChange={set("email")} /></div>
          <div className="space-y-1.5"><Label>Senha</Label><Input required type="password" minLength={6} value={form.password} onChange={set("password")} /></div>
          <Button type="submit" variant="hero" className="h-11 w-full" disabled={loading}>
            {mode === "login" ? "Entrar" : "Cadastrar"}
          </Button>
        </form>
        <Button variant="outline" className="mt-3 h-11 w-full" onClick={google}>Continuar com Google</Button>
        <button className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-primary" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>
      </div>
    </main>
  );
}
