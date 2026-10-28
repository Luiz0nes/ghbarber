CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.raw_user_meta_data->>'phone');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  duration_minutes int NOT NULL DEFAULT 30,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services public read" ON public.services FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.services (name, description, price, duration_minutes, sort_order) VALUES
('Corte', 'Corte masculino com acabamento na navalha', 45, 30, 1),
('Barba', 'Barba modelada com toalha quente', 35, 30, 2),
('Corte + Barba', 'O combo completo', 70, 60, 3),
('Degradê / Fade', 'Degradê navalhado com desenho opcional', 50, 30, 4),
('Sobrancelha', 'Limpeza e alinhamento', 15, 30, 5),
('Pigmentação', 'Pigmentação de barba ou cabelo', 30, 30, 6);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_id uuid NOT NULL REFERENCES public.services(id),
  starts_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'agendado',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX appointments_slot_unique ON public.appointments(starts_at) WHERE status = 'agendado';
GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own appt select" ON public.appointments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own appt insert" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'agendado');
CREATE POLICY "own appt update" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND status IN ('agendado','cancelado'));

CREATE OR REPLACE FUNCTION public.validate_appointment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'agendado' AND NEW.starts_at < now() THEN
    RAISE EXCEPTION 'Não é possível agendar no passado';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER appointments_validate BEFORE INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.validate_appointment();

CREATE OR REPLACE FUNCTION public.get_busy_slots(day date) RETURNS SETOF timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT starts_at FROM public.appointments
  WHERE status = 'agendado' AND (starts_at AT TIME ZONE 'America/Sao_Paulo')::date = day;
$$;
REVOKE ALL ON FUNCTION public.get_busy_slots(date) FROM public;
GRANT EXECUTE ON FUNCTION public.get_busy_slots(date) TO authenticated;