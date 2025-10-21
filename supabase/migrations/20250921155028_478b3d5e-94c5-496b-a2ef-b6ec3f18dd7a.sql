-- Fix security vulnerability in cron_execution_logs table
-- Remove the overly permissive policy that allows public access
DROP POLICY IF EXISTS "System can manage cron logs" ON public.cron_execution_logs;

-- Create restrictive policies for super_admin access only
CREATE POLICY "Super admin can view cron logs" 
ON public.cron_execution_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "Super admin can manage cron logs" 
ON public.cron_execution_logs 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Create a security definer function for system operations to insert logs
-- This allows edge functions and system processes to insert logs without exposing the table
CREATE OR REPLACE FUNCTION public.insert_cron_log(
  p_job_name TEXT,
  p_status TEXT DEFAULT 'running',
  p_response_body TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_started_at TIMESTAMPTZ DEFAULT NOW(),
  p_finished_at TIMESTAMPTZ DEFAULT NULL,
  p_execution_time_ms INTEGER DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.cron_execution_logs (
    job_name,
    status,
    response_body,
    error_message,
    started_at,
    finished_at,
    execution_time_ms
  ) VALUES (
    p_job_name,
    p_status,
    p_response_body,
    p_error_message,
    p_started_at,
    p_finished_at,
    p_execution_time_ms
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Create a security definer function to update cron logs
CREATE OR REPLACE FUNCTION public.update_cron_log(
  p_log_id UUID,
  p_status TEXT DEFAULT NULL,
  p_response_body TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_finished_at TIMESTAMPTZ DEFAULT NULL,
  p_execution_time_ms INTEGER DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cron_execution_logs SET
    status = COALESCE(p_status, status),
    response_body = COALESCE(p_response_body, response_body),
    error_message = COALESCE(p_error_message, error_message),
    finished_at = COALESCE(p_finished_at, finished_at),
    execution_time_ms = COALESCE(p_execution_time_ms, execution_time_ms)
  WHERE id = p_log_id;
  
  RETURN FOUND;
END;
$$;