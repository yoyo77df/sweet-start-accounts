-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.payment_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.payment_method AS ENUM ('bkash', 'nagad');
CREATE TYPE public.resolution_tier AS ENUM ('244p','480p','720p','1080p','2k','4k');
CREATE TYPE public.announcement_audience AS ENUM ('all','admin','user');

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolution_rank(_r public.resolution_tier)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _r
    WHEN '244p' THEN 1
    WHEN '480p' THEN 2
    WHEN '720p' THEN 3
    WHEN '1080p' THEN 4
    WHEN '2k' THEN 5
    WHEN '4k' THEN 6
  END
$$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  username text,
  email text,
  avatar_url text,
  credits integer NOT NULL DEFAULT 0,
  banned boolean NOT NULL DEFAULT false,
  max_resolution public.resolution_tier NOT NULL DEFAULT '244p',
  can_upload_thumbnails boolean NOT NULL DEFAULT false,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_phone_unique ON public.profiles (phone) WHERE phone IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_banned(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT banned FROM public.profiles WHERE id = _uid), false)
$$;

CREATE POLICY "Profiles are viewable by owner" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ TEMPLATES ============
CREATE TABLE public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text NOT NULL,
  coordinates jsonb NOT NULL DEFAULT '{}'::jsonb,
  premium boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  accent_color text NOT NULL DEFAULT '#34d399',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT SELECT ON public.templates TO anon;
GRANT ALL ON public.templates TO service_role;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active templates" ON public.templates FOR SELECT TO anon, authenticated USING (active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage templates" ON public.templates FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ POINT TABLES ============
CREATE TABLE public.point_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tournament_name text NOT NULL,
  template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.point_tables TO authenticated;
GRANT ALL ON public.point_tables TO service_role;
ALTER TABLE public.point_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tables" ON public.point_tables FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tables" ON public.point_tables FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tables" ON public.point_tables FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own tables" ON public.point_tables FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all tables" ON public.point_tables FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Block banned users from tables" ON public.point_tables AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_banned(auth.uid())) WITH CHECK (NOT public.is_banned(auth.uid()));

-- ============ CREDIT PACKAGES ============
CREATE TABLE public.credit_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  price numeric(10,2) NOT NULL,
  credits integer NOT NULL,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  popular boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  max_resolution public.resolution_tier NOT NULL DEFAULT '244p',
  allow_thumbnail boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.credit_packages TO authenticated;
GRANT ALL ON public.credit_packages TO service_role;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active packages" ON public.credit_packages FOR SELECT TO anon, authenticated USING (active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage packages" ON public.credit_packages FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ PAYMENT REQUESTS ============
CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  package_id uuid REFERENCES public.credit_packages(id) ON DELETE SET NULL,
  package_name text NOT NULL,
  amount numeric(10,2) NOT NULL,
  credits integer NOT NULL,
  payment_method public.payment_method NOT NULL,
  sender_number text NOT NULL,
  transaction_id text NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  reject_reason text,
  max_resolution public.resolution_tier NOT NULL DEFAULT '244p',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own payments" ON public.payment_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create payments" ON public.payment_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage payments" ON public.payment_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Block banned users from payments" ON public.payment_requests AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_banned(auth.uid())) WITH CHECK (NOT public.is_banned(auth.uid()));

-- ============ DOWNLOADS ============
CREATE TABLE public.downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  table_id uuid REFERENCES public.point_tables(id) ON DELETE SET NULL,
  credits_used integer NOT NULL DEFAULT 1,
  resolution public.resolution_tier NOT NULL DEFAULT '244p',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.downloads TO authenticated;
GRANT ALL ON public.downloads TO service_role;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own downloads" ON public.downloads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own downloads" ON public.downloads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all downloads" ON public.downloads FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Block banned users from downloads" ON public.downloads AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_banned(auth.uid())) WITH CHECK (NOT public.is_banned(auth.uid()));

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own global notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ CREDIT LEDGER ============
CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ledger" ON public.credit_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage ledger" ON public.credit_ledger FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ APP SETTINGS ============
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage settings" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ ANNOUNCEMENTS ============
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  bg_color text NOT NULL DEFAULT '#0c1c3e',
  text_color text NOT NULL DEFAULT '#ffffff',
  audience public.announcement_audience NOT NULL DEFAULT 'all',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read active by audience" ON public.announcements FOR SELECT TO authenticated USING (active = true AND (audience = 'all' OR (audience = 'admin' AND public.has_role(auth.uid(),'admin')) OR (audience = 'user' AND NOT public.has_role(auth.uid(),'admin')) OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER announcements_touch_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ USER THUMBNAILS ============
CREATE TABLE public.user_thumbnails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  image_url text NOT NULL,
  storage_path text,
  accent_color text NOT NULL DEFAULT '#34d399',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_thumbnails TO authenticated;
GRANT ALL ON public.user_thumbnails TO service_role;
ALTER TABLE public.user_thumbnails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own thumbnails" ON public.user_thumbnails FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own thumbnails" ON public.user_thumbnails FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND COALESCE((SELECT can_upload_thumbnails FROM public.profiles WHERE id = auth.uid()), false));
CREATE POLICY "Users delete own thumbnails" ON public.user_thumbnails FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage thumbnails" ON public.user_thumbnails FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Block banned users from thumbnails" ON public.user_thumbnails AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_banned(auth.uid())) WITH CHECK (NOT public.is_banned(auth.uid()));

-- ============ STORAGE POLICIES ============
CREATE POLICY "Read templates bucket" ON storage.objects FOR SELECT USING (bucket_id='templates');
CREATE POLICY "Read site bucket" ON storage.objects FOR SELECT USING (bucket_id='site');
CREATE POLICY "Admins write templates bucket" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='templates' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update templates bucket" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='templates' AND public.has_role(auth.uid(),'admin')) WITH CHECK (bucket_id='templates' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete templates bucket" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='templates' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins write site bucket" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='site' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update site bucket" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='site' AND public.has_role(auth.uid(),'admin')) WITH CHECK (bucket_id='site' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete site bucket" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='site' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users read tables bucket" ON storage.objects FOR SELECT USING (bucket_id='tables');
CREATE POLICY "Users write tables bucket" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='tables' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update tables bucket" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='tables' AND auth.uid()::text = (storage.foldername(name))[1]) WITH CHECK (bucket_id='tables' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete tables bucket" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='tables' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users view own thumbnail files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='user-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own thumbnail files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='user-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1] AND COALESCE((SELECT can_upload_thumbnails FROM public.profiles WHERE id = auth.uid()), false));
CREATE POLICY "Users delete own thumbnail files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='user-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============ SEEDS ============
INSERT INTO public.app_settings (key, value) VALUES
  ('site', '{"name":"Point Arena","logo_url":null,"payment_number":"01957941250","maintenance":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.credit_packages (title, price, credits, features, popular, sort_order, max_resolution) VALUES
  ('Starter', 100, 20, '["20 HD Downloads","All Free Templates","Basic Support"]'::jsonb, false, 1, '480p'),
  ('Pro', 250, 60, '["60 HD Downloads","All Templates","Priority Support","AI Templates"]'::jsonb, true, 2, '720p'),
  ('Team', 500, 150, '["150 HD Downloads","All Premium Templates","24/7 Support","Watermark Free"]'::jsonb, false, 3, '1080p'),
  ('Premium', 1000, 400, '["400 HD Downloads","Everything in Team","Early Access","Custom Templates"]'::jsonb, false, 4, '4k');

-- ============ NEW USER TRIGGER (5 credits + auto-admin) ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _phone text;
  _role public.app_role;
BEGIN
  _phone := nullif(trim(NEW.raw_user_meta_data->>'phone'), '');
  IF _phone IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE phone = _phone) THEN
    RAISE EXCEPTION 'PHONE_ALREADY_USED' USING errcode = '23505';
  END IF;

  INSERT INTO public.profiles (id, email, username, credits, max_resolution, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    5,
    '244p',
    _phone
  );

  IF lower(NEW.email) = lower('yb49440@gmail.com') THEN
    _role := 'admin';
  ELSE
    _role := 'user';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  INSERT INTO public.credit_ledger (user_id, delta, reason) VALUES (NEW.id, 5, 'signup_bonus');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ADMIN RPCS ============
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'users', (SELECT count(*) FROM public.profiles),
    'revenue', COALESCE((SELECT sum(amount) FROM public.payment_requests WHERE status='approved'),0),
    'credits_sold', COALESCE((SELECT sum(credits) FROM public.payment_requests WHERE status='approved'),0),
    'downloads', (SELECT count(*) FROM public.downloads),
    'tables', (SELECT count(*) FROM public.point_tables),
    'templates', (SELECT count(*) FROM public.templates),
    'pending_payments', (SELECT count(*) FROM public.payment_requests WHERE status='pending'),
    'approved_payments', (SELECT count(*) FROM public.payment_requests WHERE status='approved')
  ) INTO r;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_payment(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO p FROM public.payment_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF p.status <> 'pending' THEN RAISE EXCEPTION 'already processed'; END IF;
  UPDATE public.payment_requests SET status='approved', reviewed_at=now() WHERE id=_request_id;
  UPDATE public.profiles
    SET credits = credits + p.credits,
        max_resolution = CASE WHEN public.resolution_rank(p.max_resolution) > public.resolution_rank(max_resolution) THEN p.max_resolution ELSE max_resolution END,
        can_upload_thumbnails = can_upload_thumbnails OR COALESCE((SELECT allow_thumbnail FROM public.credit_packages WHERE id = p.package_id), false)
    WHERE id = p.user_id;
  INSERT INTO public.credit_ledger(user_id, delta, reason, admin_id)
    VALUES (p.user_id, p.credits, 'payment_approved:' || p.package_name, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_payment(_request_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.payment_requests
    SET status='rejected', reject_reason=_reason, reviewed_at=now()
    WHERE id=_request_id AND status='pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_user_id uuid, _delta int, _reason text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_c int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET credits = GREATEST(0, credits + _delta) WHERE id=_user_id RETURNING credits INTO new_c;
  INSERT INTO public.credit_ledger(user_id, delta, reason, admin_id) VALUES (_user_id, _delta, _reason, auth.uid());
  RETURN new_c;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_quality(_user_id uuid, _quality public.resolution_tier)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET max_resolution = _quality WHERE id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_thumbnail_access(_user_id uuid, _allow boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET can_upload_thumbnails = _allow WHERE id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_credit_for_download(_table_id uuid, _resolution public.resolution_tier)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining int;
  max_q public.resolution_tier;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF public.is_banned(auth.uid()) THEN RAISE EXCEPTION 'banned'; END IF;

  SELECT max_resolution INTO max_q FROM public.profiles WHERE id = auth.uid();
  IF public.resolution_rank(_resolution) > public.resolution_rank(max_q) THEN
    RAISE EXCEPTION 'resolution_locked';
  END IF;

  UPDATE public.profiles
    SET credits = credits - 1
    WHERE id = auth.uid() AND credits > 0
    RETURNING credits INTO remaining;
  IF remaining IS NULL THEN RAISE EXCEPTION 'insufficient_credits'; END IF;

  INSERT INTO public.downloads(user_id, table_id, credits_used, resolution)
    VALUES (auth.uid(), _table_id, 1, _resolution);
  INSERT INTO public.credit_ledger(user_id, delta, reason) VALUES (auth.uid(), -1, 'download:' || _resolution::text);
  RETURN remaining;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_payment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_payment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_adjust_credits(uuid, int, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_user_quality(uuid, public.resolution_tier) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_thumbnail_access(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.spend_credit_for_download(uuid, public.resolution_tier) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_role(uuid, public.app_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_banned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_quality(uuid, public.resolution_tier) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_thumbnail_access(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credit_for_download(uuid, public.resolution_tier) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, public.app_role) TO authenticated;