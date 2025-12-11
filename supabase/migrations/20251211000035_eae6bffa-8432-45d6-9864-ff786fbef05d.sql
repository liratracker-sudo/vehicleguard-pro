-- Adicionar role super_admin para gtvflix@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('d989fb23-4648-4da0-ab44-a89656e91cce', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;