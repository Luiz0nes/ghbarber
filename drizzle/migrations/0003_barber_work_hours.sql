CREATE TABLE public.work_hours (
  weekday smallint PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
  is_open boolean NOT NULL DEFAULT false,
  open_min integer NOT NULL DEFAULT 540 CHECK (open_min BETWEEN 0 AND 1440),
  close_min integer NOT NULL DEFAULT 1140 CHECK (close_min BETWEEN 0 AND 1440),
  CHECK (close_min > open_min)
);
GRANT SELECT ON public.work_hours TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.work_hours TO authenticated;
GRANT ALL ON public.work_hours TO service_role;
ALTER TABLE public.work_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_hours public read" ON public.work_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "work_hours barbeiro write" ON public.work_hours FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'barbeiro')) WITH CHECK (public.has_role(auth.uid(), 'barbeiro'));
INSERT INTO public.work_hours (weekday, is_open) VALUES (0,false),(1,false),(2,true),(3,true),(4,true),(5,true),(6,true);

CREATE TABLE public.days_off (
  day date PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.days_off TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.days_off TO authenticated;
GRANT ALL ON public.days_off TO service_role;
ALTER TABLE public.days_off ENABLE ROW LEVEL SECURITY;
CREATE POLICY "days_off public read" ON public.days_off FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "days_off barbeiro write" ON public.days_off FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'barbeiro')) WITH CHECK (public.has_role(auth.uid(), 'barbeiro'));

CREATE OR REPLACE FUNCTION public.validate_appointment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  local_ts timestamp := NEW.starts_at AT TIME ZONE 'America/Sao_Paulo';
  start_min int := extract(hour from local_ts)::int * 60 + extract(minute from local_ts)::int;
  dur int;
  wh public.work_hours%ROWTYPE;
BEGIN
  IF NEW.status = 'agendado' AND NEW.starts_at < now() THEN
    RAISE EXCEPTION 'Não é possível agendar no passado';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO wh FROM public.work_hours WHERE weekday = extract(dow from local_ts)::int;
    IF NOT FOUND OR NOT wh.is_open OR EXISTS (SELECT 1 FROM public.days_off WHERE day = local_ts::date) THEN
      RAISE EXCEPTION 'A barbearia não atende neste dia';
    END IF;
    SELECT duration_minutes INTO dur FROM public.services WHERE id = NEW.service_id;
    IF start_min < wh.open_min OR start_min + coalesce(dur, 30) > wh.close_min THEN
      RAISE EXCEPTION 'Fora do horário de atendimento';
    END IF;
  END IF;
  RETURN NEW;
END $$;