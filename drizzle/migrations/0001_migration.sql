CREATE OR REPLACE FUNCTION public.get_busy_slots(day date) RETURNS SETOF timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT generate_series(a.starts_at, a.starts_at + make_interval(mins => s.duration_minutes - 30), interval '30 minutes')
  FROM public.appointments a JOIN public.services s ON s.id = a.service_id
  WHERE a.status = 'agendado' AND (a.starts_at AT TIME ZONE 'America/Sao_Paulo')::date = day;
$$;