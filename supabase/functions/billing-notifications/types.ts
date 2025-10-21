// Type definitions for billing notifications

export interface DebugChecks {
  has_phone: boolean;
  payment_valid: boolean;
  whatsapp_configured: boolean;
  whatsapp_connected: boolean;
  template_rendered: boolean;
  whatsapp_connection_details?: {
    connected?: boolean;
    instance?: string;
    status?: string;
    error?: string;
  };
  rendered_message?: string;
  whatsapp_connection_error?: string;
  template_error?: string;
}

export interface NotificationSettings {
  max_attempts_per_notification?: number;
  retry_interval_hours?: number;
}

export interface PaymentTransaction {
  id: string;
  company_id: string;
  status: string;
  amount: number;
  due_date: string;
  payment_url?: string;
  pix_code?: string;
  barcode?: string;
  client_id: string;
  clients?: Client;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface PaymentNotification {
  id: string;
  company_id: string;
  event_type: string;
  client_id: string;
  status: string;
  attempts: number;
  scheduled_for: string;
  sent_at?: string;
  last_error?: string;
  payment_transactions?: PaymentTransaction;
}

export interface NotificationSettingsData {
  id: string;
  company_id: string;
  send_hour: string;
  post_due_interval_hours: number;
  on_due: boolean;
  on_due_times: number;
  on_due_interval_hours: number;
  pre_due_days: number | number[];
  template_pre_due: string;
  template_on_due: string;
  template_post_due: string;
}

export interface WhatsAppSettings {
  company_id: string;
  instance_url: string;
  api_token: string;
  instance_name: string;
  is_active: boolean;
}

export interface AICollectionSettings {
  company_id: string;
  is_active: boolean;
}