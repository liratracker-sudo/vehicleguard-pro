import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    console.log('Billing notifications processor started');
    
    // Parse request body to check for specific payment/company triggers
    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { payment_id, company_id, trigger, force, scheduled_time } = body;
    
    console.log('📥 Request params:', { payment_id, company_id, trigger, force, scheduled_time });
    
    // Log execution start for monitoring
    const { data: logEntry } = await supabase
      .from('cron_execution_logs')
      .insert({
        job_name: trigger === 'manual_9am_start' ? 'billing-notifications-manual-9am' : 'billing-notifications-function',
        status: 'running'
      })
      .select()
      .single();
    
    let result;
    
    if (trigger === 'payment_created' && payment_id) {
      // Handle specific payment notification creation
      console.log(`Creating notifications for specific payment: ${payment_id}`);
      
      // Get payment details to identify company
      const { data: payment } = await supabase
        .from('payment_transactions')
        .select('company_id')
        .eq('id', payment_id)
        .single();
        
      if (payment?.company_id) {
        result = await createMissingNotifications(payment_id, payment.company_id);
      }
    } else if (trigger === 'manual_9am_start') {
      // Handle manual 9am trigger - force send all pending notifications and create missing ones
      console.log('🚀 Manual 9AM trigger - processing all notifications with force=true');
      result = await processNotifications(true);
    } else {
      // Process all pending notifications and create missing ones
      result = await processNotifications(force);
    }
    
    const executionTime = Date.now() - startTime;
    
    // Update log entry with success
    if (logEntry) {
      await supabase
        .from('cron_execution_logs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          execution_time_ms: executionTime,
          response_body: JSON.stringify(result || { success: true })
        })
        .eq('id', logEntry.id);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Billing notifications processed',
        execution_time_ms: executionTime,
        result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing billing notifications:', error);
    
    // Log error for monitoring
    await supabase
      .from('cron_execution_logs')
      .insert({
        job_name: 'billing-notifications-function',
        status: 'error',
        finished_at: new Date().toISOString(),
        error_message: error.message
      });
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function processNotifications(force = false) {
  console.log('Starting notification processing...', { force });
  
  const results = {
    sent: 0,
    failed: 0,
    created: 0,
    skipped: 0
  };
  
  // 1. Send pending notifications that are due (or all if force=true)
  const sentResults = await sendPendingNotifications(force);
  results.sent = sentResults.sent;
  results.failed = sentResults.failed;
  
  // 2. Create new notifications for payments without them
  const createdResults = await createMissingNotifications();
  results.created = createdResults.created;
  results.skipped = createdResults.skipped;
  
  console.log('Notification processing completed', results);
  return results;
}

async function sendPendingNotifications(force = false) {
  console.log('Sending pending notifications...', { force });
  
  const results = { sent: 0, failed: 0 };
  
  // First, cleanup notifications for cancelled/paid payments BEFORE querying
  await cleanupInvalidNotifications();
  
  // Get all pending notifications that are due (including a 5-minute buffer for timing issues)
  // If force=true, include all pending notifications regardless of scheduled time
  const bufferTime = new Date();
  bufferTime.setMinutes(bufferTime.getMinutes() + 5);
  
  let query = supabase
    .from('payment_notifications')
    .select(`
      *,
      payment_transactions!inner(*, clients(name, phone, email))
    `)
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true })
    .limit(100); // Increase limit for manual triggers

  if (force) {
    console.log('🚀 Force mode: processing ALL pending notifications');
    // Don't filter by scheduled_for when force=true
  } else {
    query = query.lte('scheduled_for', bufferTime.toISOString());
  }

  const { data: pendingNotifications, error } = await query;

  if (error) {
    console.error('Error fetching pending notifications:', error);
    return results;
  }

  console.log(`Found ${pendingNotifications?.length || 0} pending notifications to send`);
  console.log('Notification details:', pendingNotifications?.map(n => ({
    id: n.id,
    event_type: n.event_type,
    payment_status: n.payment_transactions?.status,
    scheduled_for: n.scheduled_for
  })));

  for (const notification of pendingNotifications || []) {
    console.log(`Processing notification ${notification.id} for company ${notification.company_id}, event: ${notification.event_type}`);
    
    // Skip notifications that are too old or don't have valid payment data
    if (!notification.payment_transactions || !notification.payment_transactions.clients) {
      console.log(`Skipping notification ${notification.id} - invalid payment/client data`);
      continue;
    }
    
    // Skip notifications for cancelled or paid payments and mark as skipped
    const paymentStatus = notification.payment_transactions.status;
    if (!paymentStatus || !['pending', 'overdue'].includes(paymentStatus)) {
      console.log(`Skipping notification ${notification.id} - payment status is ${paymentStatus}`);
      
      // Mark as skipped
      await supabase
        .from('payment_notifications')
        .update({
          status: 'skipped',
          last_error: `Payment status is ${paymentStatus}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', notification.id);
      
      continue;
    }
    
    try {
      // Get notification settings for the company to use retry settings
      const { data: notificationSettings } = await supabase
        .from('payment_notification_settings')
        .select('max_attempts_per_notification, retry_interval_hours')
        .eq('company_id', notification.company_id)
        .single();

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
      results.sent++;
    } catch (error) {
      console.error(`Failed to send notification ${notification.id}:`, error);
      
      // Get notification settings for retry logic
      const { data: notificationSettings } = await supabase
        .from('payment_notification_settings')
        .select('max_attempts_per_notification, retry_interval_hours')
        .eq('company_id', notification.company_id)
        .single();
      
      // Update attempts and mark as failed if too many attempts
      const newAttempts = notification.attempts + 1;
      const maxAttempts = notificationSettings?.max_attempts_per_notification || 3;
      const retryInterval = notificationSettings?.retry_interval_hours || 1;
      const status = newAttempts >= maxAttempts ? 'failed' : 'pending';
      
      await supabase
        .from('payment_notifications')
        .update({
          status,
          attempts: newAttempts,
          last_error: error.message,
          // Reschedule based on retry_interval_hours if not failed
          scheduled_for: status === 'pending' 
            ? new Date(Date.now() + retryInterval * 60 * 60 * 1000).toISOString()
            : notification.scheduled_for
        })
        .eq('id', notification.id);
      
      results.failed++;
    }
  }
  
  return results;
}

async function cleanupInvalidNotifications() {
  console.log('Cleaning up notifications for cancelled/paid payments...');
  
  // First get the payment IDs that are cancelled or paid
  const { data: cancelledPayments, error: fetchError } = await supabase
    .from('payment_transactions')
    .select('id')
    .in('status', ['cancelled', 'paid']);

  if (fetchError) {
    console.error('Error fetching cancelled/paid payments:', fetchError);
    return;
  }

  if (!cancelledPayments || cancelledPayments.length === 0) {
    console.log('No cancelled or paid payments found');
    return;
  }

  const paymentIds = cancelledPayments.map(p => p.id);
  console.log(`Found ${paymentIds.length} cancelled/paid payments:`, paymentIds);
  
  // Mark notifications for cancelled or paid payments as skipped
  const { data: updatedNotifications, error } = await supabase
    .from('payment_notifications')
    .update({ 
      status: 'skipped',
      last_error: 'Payment was cancelled or already paid',
      updated_at: new Date().toISOString()
    })
    .eq('status', 'pending')
    .in('payment_id', paymentIds)
    .select('id');

  if (error) {
    console.error('Error cleaning up invalid notifications:', error);
  } else {
    console.log(`Successfully cleaned up ${updatedNotifications?.length || 0} notifications for ${paymentIds.length} cancelled/paid payments`);
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

async function createMissingNotifications(specificPaymentId?: string, specificCompanyId?: string) {
  console.log('Creating missing notifications...', { specificPaymentId, specificCompanyId });
  
  const results = { created: 0, skipped: 0 };
  
  // Build query for companies with notification settings
  let query = supabase
    .from('payment_notification_settings')
    .select('*')
    .eq('active', true);

  // If specific company ID provided, filter by it
  if (specificCompanyId) {
    query = query.eq('company_id', specificCompanyId);
  }

  const { data: companiesWithSettings } = await query;

  if (!companiesWithSettings?.length) {
    console.log('No active companies with notification settings');
    return results;
  }

  for (const settings of companiesWithSettings) {
    const companyResults = await createNotificationsForCompany(settings, specificPaymentId);
    results.created += companyResults.created;
    results.skipped += companyResults.skipped;
  }
  
  return results;
}

async function createNotificationsForCompany(settings: any, specificPaymentId?: string) {
  console.log(`Creating notifications for company: ${settings.company_id}${specificPaymentId ? `, payment: ${specificPaymentId}` : ''}`);
  
  const results = { created: 0, skipped: 0 };
  
  // Build query for payments that need notifications
  let query = supabase
    .from('payment_transactions')
    .select(`
      *,
      clients(name, phone, email)
    `)
    .eq('company_id', settings.company_id)
    .in('status', ['pending', 'overdue'])
    .not('due_date', 'is', null)
    .not('client_id', 'is', null); // Ensure we have a valid client

  // If specific payment ID provided, filter by it
  if (specificPaymentId) {
    query = query.eq('id', specificPaymentId);
  } else {
    // Process payments from the last 90 days for better coverage
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    query = query.gte('due_date', ninetyDaysAgo.toISOString().split('T')[0]);
  }

  const { data: paymentsWithoutNotifications, error: paymentsError } = await query;

  if (paymentsError) {
    console.error(`Error fetching payments for company ${settings.company_id}:`, paymentsError);
    return results;
  }

  if (!paymentsWithoutNotifications?.length) {
    console.log(`No payments found for company ${settings.company_id}`);
    return results;
  }

  console.log(`Processing ${paymentsWithoutNotifications.length} payments for company ${settings.company_id}`);

  const notifications = [];
  const now = new Date();

  for (const payment of paymentsWithoutNotifications) {
    // Skip payments without valid client data
    if (!payment.clients || !payment.clients.phone) {
      console.log(`Skipping payment ${payment.id} - no valid client or phone`);
      results.skipped++;
      continue;
    }

    const dueDate = new Date(payment.due_date);
    
    // Skip payments that are too old (more than 90 days past due)  
    const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysPastDue > 90) {
      console.log(`Skipping payment ${payment.id} - too old (${daysPastDue} days past due)`);
      results.skipped++;
      continue;
    }
    
    // Check if we already have notifications for this payment
    const { data: existingNotifications } = await supabase
      .from('payment_notifications')
      .select('event_type, offset_days')
      .eq('payment_id', payment.id);

    const existingKeys = new Set(
      existingNotifications?.map(n => `${n.event_type}_${n.offset_days}`) || []
    );

    // For overdue payments, prioritize post-due notifications
    const isOverdue = daysPastDue > 0;
    
    if (isOverdue) {
      console.log(`Payment ${payment.id} is ${daysPastDue} days overdue - prioritizing post-due notifications`);
    }

    // Pre-due notifications (only for future payments)
    if (!isOverdue) {
      for (const days of settings.pre_due_days || []) {
        const key = `pre_due_${days}`;
        if (existingKeys.has(key)) continue;
        
        const scheduledDate = new Date(dueDate);
        scheduledDate.setDate(scheduledDate.getDate() - days);
        
        // Parse send_hour properly (format: HH:MM:SS or HH:MM)
        const timeParts = settings.send_hour.split(':');
        const hour = parseInt(timeParts[0]) || 9;
        const minute = parseInt(timeParts[1]) || 0;
        
        scheduledDate.setHours(hour, minute, 0, 0);
        
        // Only create if the scheduled date is not too far in the past (allow up to 3 days)
        const hoursAgo = (now.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60);
        if (hoursAgo > 72) { // 3 days = 72 hours
          console.log(`Skipping pre-due notification for payment ${payment.id} - too old (${Math.round(hoursAgo)} hours ago)`);
          continue;
        }
        
        notifications.push({
          company_id: settings.company_id,
          payment_id: payment.id,
          client_id: payment.client_id,
          event_type: 'pre_due',
          offset_days: days,
          scheduled_for: scheduledDate.toISOString(),
          status: 'pending',
          notification_settings_id: settings.id,
          attempts: 0
        });
      }
    }

    // On-due notifications (for due date or recently overdue)
    if (settings.on_due && daysPastDue <= 7) { // Allow up to 7 days past due for on-due notifications
      const onDueTimes = settings.on_due_times || 1;
      const intervalHours = settings.on_due_interval_hours || 2;
      
      for (let i = 0; i < onDueTimes; i++) {
        const key = `on_due_${i}`;
        if (existingKeys.has(key)) continue;
        
        const scheduledDate = new Date(dueDate);
        
        // Parse send_hour properly (format: HH:MM:SS or HH:MM)
        const timeParts = settings.send_hour.split(':');
        const hour = parseInt(timeParts[0]) || 9;
        const minute = parseInt(timeParts[1]) || 0;
        
        scheduledDate.setHours(hour, minute, 0, 0);
        
        // Adicionar intervalo para disparos subsequentes
        if (i > 0) {
          scheduledDate.setHours(scheduledDate.getHours() + (i * intervalHours));
        }
        
        // For overdue payments, schedule immediately if past due
        if (isOverdue && i === 0) {
          scheduledDate.setTime(now.getTime() + (5 * 60 * 1000)); // 5 minutes from now
        }
        
        notifications.push({
          company_id: settings.company_id,
          payment_id: payment.id,
          client_id: payment.client_id,
          event_type: 'on_due',
          offset_days: i, // Usando offset_days para identificar o número do disparo
          scheduled_for: scheduledDate.toISOString(),
          status: 'pending',
          notification_settings_id: settings.id,
          attempts: 0
        });
      }
    }

    // Post-due notifications (for overdue payments)
    if (isOverdue) {
      for (const days of settings.post_due_days || []) {
        // Only create post-due notifications if we're past that threshold
        if (daysPastDue < days) continue;
        
        const key = `post_due_${days}`;
        if (existingKeys.has(key)) continue;
        
        const scheduledDate = new Date(dueDate);
        scheduledDate.setDate(scheduledDate.getDate() + days);
        
        // Parse send_hour properly (format: HH:MM:SS or HH:MM)
        const timeParts = settings.send_hour.split(':');
        const hour = parseInt(timeParts[0]) || 9;
        const minute = parseInt(timeParts[1]) || 0;
        
        scheduledDate.setHours(hour, minute, 0, 0);
        
        // If the scheduled date has already passed, schedule for immediate delivery
        if (scheduledDate.getTime() < now.getTime()) {
          scheduledDate.setTime(now.getTime() + (2 * 60 * 1000)); // 2 minutes from now
        }
        
        notifications.push({
          company_id: settings.company_id,
          payment_id: payment.id,
          client_id: payment.client_id,
          event_type: 'post_due',
          offset_days: days,
          scheduled_for: scheduledDate.toISOString(),
          status: 'pending',
          notification_settings_id: settings.id,
          attempts: 0
        });
      }
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
      results.created = notifications.length;
    }
  }
  
  return results;
}