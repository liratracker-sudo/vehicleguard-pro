-- Tornar rastreklira@gmail.com super_admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('c462ba23-b05d-49ed-88bd-7e7fc1d988d7', 'super_admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;