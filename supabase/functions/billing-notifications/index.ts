import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = "https://mcdidffxwtnqhawqilln.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw";

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Billing notifications processor started');
    
    // Process pending notifications and create new ones
    await processNotifications();
    
    return new Response(
      JSON.stringify({ success: true, message: 'Billing notifications processed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing billing notifications:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function processNotifications() {
  console.log('Starting notification processing...');
  
  // 1. Send pending notifications that are due
  await sendPendingNotifications();
  
  // 2. Create new notifications for payments without them
  await createMissingNotifications();
  
  console.log('Notification processing completed');
}

async function sendPendingNotifications() {
  console.log('Sending pending notifications...');
  
  // Get all pending notifications that are due
  const { data: pendingNotifications, error } = await supabase
    .from('payment_notifications')
    .select(`
      *,
      payment_transactions!inner(*, clients(name, phone, email))
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('Error fetching pending notifications:', error);
    return;
  }

  console.log(`Found ${pendingNotifications?.length || 0} pending notifications to send`);

  for (const notification of pendingNotifications || []) {
    try {
      await sendSingleNotification(notification);
      
      // Mark as sent with retry limit
      await supabase
        .from('payment_notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          attempts: notification.attempts + 1
        })
        .eq('id', notification.id);
        
      console.log(`Notification sent successfully: ${notification.id}`);
    } catch (error) {
      console.error(`Failed to send notification ${notification.id}:`, error);
      
      // Update attempts and mark as failed if too many attempts
      const newAttempts = notification.attempts + 1;
      const status = newAttempts >= 3 ? 'failed' : 'pending';
      
      await supabase
        .from('payment_notifications')
        .update({
          status,
          attempts: newAttempts,
          last_error: error.message,
          // Reschedule for 1 hour later if not failed
          scheduled_for: status === 'pending' 
            ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
            : notification.scheduled_for
        })
        .eq('id', notification.id);
    }
  }
}

async function sendSingleNotification(notification: any) {
  const payment = notification.payment_transactions;
  const client = payment.clients;
  
  // Get notification settings for the company
  const { data: settings } = await supabase
    .from('payment_notification_settings')
    .select('*')
    .eq('company_id', notification.company_id)
    .single();
  
  if (!client?.phone) {
    throw new Error('Cliente não possui telefone cadastrado');
  }

  // Get WhatsApp settings for company
  const { data: whatsappSettings } = await supabase
    .from('whatsapp_settings')
    .select('*')
    .eq('company_id', notification.company_id)
    .eq('is_active', true)
    .single();

  if (!whatsappSettings || whatsappSettings.connection_status !== 'connected') {
    throw new Error('WhatsApp não está conectado para esta empresa');
  }

  // Render message template
  const message = renderTemplate(notification, payment, client, settings);
  
  // Send via WhatsApp Evolution API
  const whatsappResponse = await supabase.functions.invoke('whatsapp-evolution', {
    body: {
      action: 'send_message',
      instance_url: whatsappSettings.instance_url,
      api_token: whatsappSettings.api_token,
      instance_name: whatsappSettings.instance_name,
      phone_number: client.phone,
      message,
      company_id: notification.company_id,
      client_id: notification.client_id
    }
  });

  if (whatsappResponse.error) {
    throw new Error(`WhatsApp API error: ${whatsappResponse.error.message}`);
  }

  // Store rendered message for audit
  await supabase
    .from('payment_notifications')
    .update({ message_body: message })
    .eq('id', notification.id);
}

function renderTemplate(notification: any, payment: any, client: any, settings: any): string {
  let template = '';
  
  switch (notification.event_type) {
    case 'pre_due':
      template = settings.template_pre_due;
      break;
    case 'on_due':
      template = settings.template_on_due;
      break;
    case 'post_due':
      template = settings.template_post_due;
      break;
    default:
      template = 'Olá {{cliente}}, temos uma cobrança de R$ {{valor}} para você.';
  }

  // Calculate days difference
  const dueDate = new Date(payment.due_date);
  const today = new Date();
  const daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  // Format values
  const formattedValue = payment.amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
  
  const formattedDueDate = dueDate.toLocaleDateString('pt-BR');
  
  // Create payment link
  const paymentLink = payment.payment_url || 
    payment.pix_code ? `PIX: ${payment.pix_code}` :
    payment.barcode ? `Boleto: ${payment.barcode}` :
    'Entre em contato para detalhes do pagamento';

  // Replace template variables
  return template
    .replace(/\{\{cliente\}\}/g, client.name)
    .replace(/\{\{valor\}\}/g, formattedValue)
    .replace(/\{\{vencimento\}\}/g, formattedDueDate)
    .replace(/\{\{dias\}\}/g, Math.abs(daysDiff).toString())
    .replace(/\{\{link_pagamento\}\}/g, paymentLink);
}

async function createMissingNotifications() {
  console.log('Creating missing notifications...');
  
  // Get active companies with notification settings
  const { data: companiesWithSettings } = await supabase
    .from('payment_notification_settings')
    .select('*')
    .eq('active', true);

  if (!companiesWithSettings?.length) {
    console.log('No active companies with notification settings');
    return;
  }

  for (const settings of companiesWithSettings) {
    await createNotificationsForCompany(settings);
  }
}

async function createNotificationsForCompany(settings: any) {
  console.log(`Creating notifications for company: ${settings.company_id}`);
  
  // Get pending/unpaid payments that don't have notifications yet
  const { data: paymentsWithoutNotifications } = await supabase
    .from('payment_transactions')
    .select(`
      *,
      clients(name, phone, email)
    `)
    .eq('company_id', settings.company_id)
    .in('status', ['pending', 'overdue'])
    .not('due_date', 'is', null);

  if (!paymentsWithoutNotifications?.length) {
    console.log(`No payments without notifications for company ${settings.company_id}`);
    return;
  }

  const notifications = [];
  const now = new Date();

  for (const payment of paymentsWithoutNotifications) {
    const dueDate = new Date(payment.due_date);
    
    // Check if we already have notifications for this payment
    const { data: existingNotifications } = await supabase
      .from('payment_notifications')
      .select('event_type, offset_days')
      .eq('payment_id', payment.id);

    const existingKeys = new Set(
      existingNotifications?.map(n => `${n.event_type}_${n.offset_days}`) || []
    );

    // Pre-due notifications
    for (const days of settings.pre_due_days || []) {
      const key = `pre_due_${days}`;
      if (existingKeys.has(key)) continue;
      
      const scheduledDate = new Date(dueDate);
      scheduledDate.setDate(scheduledDate.getDate() - days);
      scheduledDate.setHours(parseInt(settings.send_hour.split(':')[0]), parseInt(settings.send_hour.split(':')[1]), 0, 0);
      
      notifications.push({
        company_id: settings.company_id,
        payment_id: payment.id,
        client_id: payment.client_id,
        event_type: 'pre_due',
        offset_days: days,
        scheduled_for: scheduledDate.toISOString(),
        status: scheduledDate <= now ? 'pending' : 'pending'
      });
    }

    // On-due notification
    if (settings.on_due && !existingKeys.has('on_due_0')) {
      const scheduledDate = new Date(dueDate);
      scheduledDate.setHours(parseInt(settings.send_hour.split(':')[0]), parseInt(settings.send_hour.split(':')[1]), 0, 0);
      
      notifications.push({
        company_id: settings.company_id,
        payment_id: payment.id,
        client_id: payment.client_id,
        event_type: 'on_due',
        offset_days: 0,
        scheduled_for: scheduledDate.toISOString(),
        status: scheduledDate <= now ? 'pending' : 'pending'
      });
    }

    // Post-due notifications
    for (const days of settings.post_due_days || []) {
      const key = `post_due_${days}`;
      if (existingKeys.has(key)) continue;
      
      const scheduledDate = new Date(dueDate);
      scheduledDate.setDate(scheduledDate.getDate() + days);
      scheduledDate.setHours(parseInt(settings.send_hour.split(':')[0]), parseInt(settings.send_hour.split(':')[1]), 0, 0);
      
      notifications.push({
        company_id: settings.company_id,
        payment_id: payment.id,
        client_id: payment.client_id,
        event_type: 'post_due',
        offset_days: days,
        scheduled_for: scheduledDate.toISOString(),
        status: scheduledDate <= now ? 'pending' : 'pending'
      });
    }
  }

  if (notifications.length > 0) {
    const { error } = await supabase
      .from('payment_notifications')
      .insert(notifications);

    if (error) {
      console.error(`Error creating notifications for company ${settings.company_id}:`, error);
    } else {
      console.log(`Created ${notifications.length} notifications for company ${settings.company_id}`);
    }
  }
}