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

// Helper function to convert UTC date to Brazil timezone (America/Sao_Paulo = UTC-3)
function toBrazilTime(date: Date): Date {
  // Get the timezone offset for Brazil (UTC-3 = -180 minutes)
  const brazilOffset = -180; // -3 hours in minutes
  const utcOffset = date.getTimezoneOffset(); // Current timezone offset in minutes
  
  // Calculate the difference and adjust
  const offsetDiff = utcOffset - brazilOffset;
  
  // Create new date adjusted to Brazil time
  const brazilDate = new Date(date.getTime() - (offsetDiff * 60 * 1000));
  return brazilDate;
}

// Helper function to set time in Brazil timezone
function setBrazilTime(date: Date, hour: number, minute: number): Date {
  // Create a new date based on the input date
  const brazilDate = new Date(date);
  
  // Brazil is UTC-3, so to set 9h Brazil time, we need 12h UTC
  // We set the UTC time directly - when it's 12:00 UTC, it's 09:00 in Brazil
  brazilDate.setUTCHours(hour + 3, minute, 0, 0);
  
  // Get the date in Brazil timezone for display
  const brazilTimeStr = brazilDate.toLocaleString('en-US', { 
    timeZone: 'America/Sao_Paulo', 
    hour12: false 
  });
  console.log(`🕐 Setting time: ${hour}:${minute.toString().padStart(2, '0')} Brazil = ${brazilDate.toISOString()} UTC (Brazil time: ${brazilTimeStr})`);
  
  return brazilDate;
}

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

    const { payment_id, company_id, trigger, force, scheduled_time, notification_id } = body;
    
    console.log('📥 Request params:', { payment_id, company_id, trigger, force, scheduled_time, notification_id });
    
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
    } else if (trigger === 'resend_notification' && notification_id) {
      // Handle specific notification resend
      console.log(`🔄 Resending specific notification: ${notification_id}`);
      result = await resendSpecificNotification(notification_id);
    } else if (trigger === 'debug_notification' && notification_id) {
      // Handle notification debug
      console.log(`🐛 Debugging specific notification: ${notification_id}`);
      result = await debugSpecificNotification(notification_id);
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
        error_message: error instanceof Error ? error.message : String(error)
      });
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
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

async function resendSpecificNotification(notificationId: string) {
  console.log(`Resending specific notification: ${notificationId}`);
  
  const results = { sent: 0, failed: 0 };
  
  // Get the specific notification with all related data
  const { data: notification, error } = await supabase
    .from('payment_notifications')
    .select(`
      *,
      payment_transactions!inner(*, clients(name, phone, email))
    `)
    .eq('id', notificationId)
    .eq('status', 'pending')
    .single();

  if (error) {
    console.error('Error fetching notification for resend:', error);
    throw new Error(`Notificação não encontrada ou não está pendente: ${error.message}`);
  }

  if (!notification) {
    throw new Error('Notificação não encontrada ou não está pendente');
  }

  console.log(`Processing resend for notification ${notification.id}`);
  
  // Validate notification data
  if (!notification.payment_transactions || !notification.payment_transactions.clients) {
    throw new Error('Dados de pagamento ou cliente inválidos');
  }
  
  // Skip notifications for cancelled or paid payments
  const paymentStatus = notification.payment_transactions.status;
  if (!paymentStatus || !['pending', 'overdue'].includes(paymentStatus)) {
    // Mark as skipped
    await supabase
      .from('payment_notifications')
      .update({
        status: 'skipped',
        last_error: `Payment status is ${paymentStatus}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', notification.id);
    
    throw new Error(`Pagamento não está mais pendente (status: ${paymentStatus})`);
  }
  
  try {
    await sendSingleNotification(notification);
    
    // Mark as sent
    await supabase
      .from('payment_notifications')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        attempts: (notification.attempts || 0) + 1
      })
      .eq('id', notification.id);
      
    console.log(`Notification resent successfully: ${notification.id}`);
    results.sent++;
  } catch (error) {
    console.error(`Failed to resend notification ${notification.id}:`, error);
    
    // Update with error
    await supabase
      .from('payment_notifications')
      .update({
        status: 'failed',
        attempts: (notification.attempts || 0) + 1,
        last_error: error instanceof Error ? error.message : String(error)
      })
      .eq('id', notification.id);
    
    results.failed++;
    throw error; // Re-throw to be caught by the main handler
  }
  
  return results;
}

async function debugSpecificNotification(notificationId: string) {
  console.log(`🐛 Debugging notification: ${notificationId}`);
  
  // Get notification with all related data
  const { data: notification, error } = await supabase
    .from('payment_notifications')
    .select(`
      *,
      payment_transactions!inner(*, clients(name, phone, email)),
      payment_notification_settings(*)
    `)
    .eq('id', notificationId)
    .single();

  if (error) {
    console.error('❌ Error fetching notification for debug:', error);
    return { error: `Notification not found: ${error.message}` };
  }

  const debugInfo = {
    notification_id: notificationId,
    status: notification.status,
    attempts: notification.attempts,
    scheduled_for: notification.scheduled_for,
    sent_at: notification.sent_at,
    last_error: notification.last_error,
    payment: {
      id: notification.payment_transactions?.id,
      status: notification.payment_transactions?.status,
      amount: notification.payment_transactions?.amount,
      due_date: notification.payment_transactions?.due_date
    },
    client: notification.payment_transactions?.clients,
    checks: {
      has_phone: false,
      payment_valid: false,
      whatsapp_configured: false,
      whatsapp_connected: false,
      template_rendered: false,
      whatsapp_connection_details: null as any,
      rendered_message: '',
      whatsapp_connection_error: '',
      template_error: ''
    } as {
      has_phone: boolean;
      payment_valid: boolean;
      whatsapp_configured: boolean;
      whatsapp_connected: boolean;
      template_rendered: boolean;
      whatsapp_connection_details?: any;
      rendered_message?: string;
      whatsapp_connection_error?: string;
      template_error?: string;
    }
  };

  console.log('📊 Debug Info:', debugInfo);

  // Check 1: Client has phone
  debugInfo.checks.has_phone = !!notification.payment_transactions?.clients?.phone;
  if (!debugInfo.checks.has_phone) {
    console.error('❌ Client has no phone number');
  }

  // Check 2: Payment is in valid status
  const paymentStatus = notification.payment_transactions?.status;
  debugInfo.checks.payment_valid = ['pending', 'overdue'].includes(paymentStatus);
  if (!debugInfo.checks.payment_valid) {
    console.error(`❌ Payment status is invalid: ${paymentStatus}`);
  }

  // Check 3: WhatsApp settings exist
  const { data: whatsappSettings } = await supabase
    .from('whatsapp_settings')
    .select('*')
    .eq('company_id', notification.company_id)
    .eq('is_active', true)
    .single();

  debugInfo.checks.whatsapp_configured = !!whatsappSettings;
  if (!debugInfo.checks.whatsapp_configured) {
    console.error('❌ WhatsApp settings not found or inactive');
  }

  // Check 4: WhatsApp connection status (if settings exist)
  if (whatsappSettings) {
    try {
      const connectionCheck = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'checkConnection',
          instance_url: whatsappSettings.instance_url,
          api_token: whatsappSettings.api_token,
          instance_name: whatsappSettings.instance_name
        }
      });

      debugInfo.checks.whatsapp_connected = connectionCheck.data?.connected || false;
      debugInfo.checks.whatsapp_connection_details = connectionCheck.data;
      
      if (!debugInfo.checks.whatsapp_connected) {
        console.error('❌ WhatsApp not connected:', connectionCheck.data);
      }
    } catch (error) {
      console.error('❌ Error checking WhatsApp connection:', error);
      debugInfo.checks.whatsapp_connection_error = error instanceof Error ? error.message : String(error);
    }
  }

  // Check 5: Message template rendering
  if (debugInfo.checks.payment_valid && debugInfo.checks.has_phone) {
    try {
      const { data: settings } = await supabase
        .from('payment_notification_settings')
        .select('*')
        .eq('company_id', notification.company_id)
        .single();

      if (settings) {
        const message = renderTemplate(
          notification, 
          notification.payment_transactions, 
          notification.payment_transactions.clients, 
          settings
        );
        debugInfo.checks.template_rendered = true;
        debugInfo.checks.rendered_message = message;
        console.log('✅ Template rendered successfully');
      }
    } catch (error) {
      console.error('❌ Error rendering template:', error);
      debugInfo.checks.template_error = error instanceof Error ? error.message : String(error);
    }
  }

  // Summary
  const allChecks = Object.values(debugInfo.checks);
  const passedChecks = allChecks.filter(check => check === true).length;
  const totalChecks = allChecks.filter(check => typeof check === 'boolean').length;
  
  console.log(`🔍 Debug Summary: ${passedChecks}/${totalChecks} checks passed`);
  console.log('📋 Full Debug Info:', JSON.stringify(debugInfo, null, 2));

  return {
    debug_info: debugInfo,
    summary: `${passedChecks}/${totalChecks} checks passed`,
    recommendations: generateRecommendations(debugInfo)
  };
}

function generateRecommendations(debugInfo: any): string[] {
  const recommendations = [];

  if (!debugInfo.checks.has_phone) {
    recommendations.push('Adicionar número de telefone ao cliente');
  }

  if (!debugInfo.checks.payment_valid) {
    recommendations.push('Verificar status do pagamento - deve estar "pending" ou "overdue"');
  }

  if (!debugInfo.checks.whatsapp_configured) {
    recommendations.push('Configurar integração WhatsApp nas configurações');
  }

  if (!debugInfo.checks.whatsapp_connected) {
    recommendations.push('Reconectar WhatsApp - verificar QR Code ou conexão');
  }

  if (debugInfo.checks.template_error) {
    recommendations.push('Verificar templates de mensagem nas configurações de notificação');
  }

  if (recommendations.length === 0) {
    recommendations.push('Todos os checks passaram - notificação deve funcionar normalmente');
  }

  return recommendations;
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
          last_error: error instanceof Error ? error.message : String(error),
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

  if (!whatsappSettings) {
    throw new Error('Configurações do WhatsApp não encontradas');
  }

  // First validate connection in real-time before sending
  console.log(`Validating WhatsApp connection for company ${notification.company_id}...`);
  const connectionCheck = await supabase.functions.invoke('whatsapp-evolution', {
    body: {
      action: 'checkConnection',
      payload: {
        instance_url: whatsappSettings.instance_url,
        api_token: whatsappSettings.api_token,
        instance_name: whatsappSettings.instance_name
      }
    }
  });

  // Check if connection validation failed or connection is not active
  if (connectionCheck.error || !connectionCheck.data?.connected) {
    const errorMsg = connectionCheck.error?.message || 
                    (connectionCheck.data?.error) || 
                    'WhatsApp não está conectado';
    console.error(`Connection check failed for company ${notification.company_id}:`, errorMsg);
    
    // Log WhatsApp disconnection alert
    await logWhatsAppAlert(notification.company_id, `WhatsApp não autenticado — reconectar o número para continuar os envios. Estado: ${connectionCheck.data?.state || 'unknown'}`);
    
    throw new Error(`WhatsApp não autenticado — reconectar o número para continuar os envios.`);
  }

  // Check if AI Collection is active for this company
  const { data: aiSettings } = await supabase
    .from('ai_collection_settings')
    .select('*')
    .eq('company_id', notification.company_id)
    .eq('is_active', true)
    .single();

  let message: string;
  
  if (aiSettings) {
    // Use AI to generate personalized message
    console.log(`Using AI to generate message for notification ${notification.id}...`);
    
    try {
      const aiResponse = await supabase.functions.invoke('ai-collection', {
        body: {
          action: 'process_specific_payment',
          company_id: notification.company_id,
          payment_id: payment.id
        }
      });

      if (aiResponse.error || !aiResponse.data?.generated_message) {
        console.error('AI generation failed, falling back to template:', aiResponse.error);
        // Fallback to template if AI fails
        message = renderTemplate(notification, payment, client, settings);
      } else {
        message = aiResponse.data.generated_message;
        console.log('AI message generated successfully');
      }
    } catch (error) {
      console.error('Error calling AI collection:', error);
      // Fallback to template if AI fails
      message = renderTemplate(notification, payment, client, settings);
    }
  } else {
    // Use traditional template
    message = renderTemplate(notification, payment, client, settings);
  }
  
  // Send via WhatsApp Evolution API
  console.log(`Sending WhatsApp message for notification ${notification.id}...`);
  console.log('Payload being sent to WhatsApp Evolution:', {
    action: 'send_message',
    hasInstanceUrl: !!whatsappSettings.instance_url,
    hasApiToken: !!whatsappSettings.api_token,
    instanceName: whatsappSettings.instance_name,
    phone: client.phone,
    messageLength: message.length,
    companyId: notification.company_id,
    clientId: notification.client_id
  });
  
  const whatsappResponse = await supabase.functions.invoke('whatsapp-evolution', {
    body: {
      action: 'send_message',
      payload: {
        instance_url: whatsappSettings.instance_url,
        api_token: whatsappSettings.api_token,
        instance_name: whatsappSettings.instance_name,
        phone_number: client.phone,
        message,
        company_id: notification.company_id,
        client_id: notification.client_id
      }
    }
  });

  console.log(`WhatsApp response for notification ${notification.id}:`, {
    hasError: !!whatsappResponse.error,
    hasData: !!whatsappResponse.data,
    success: whatsappResponse.data?.success,
    status: whatsappResponse.data?.status,
    error: whatsappResponse.data?.error
  });

  // Check for HTTP errors first
  if (whatsappResponse.error) {
    const errorMsg = `HTTP Error: ${whatsappResponse.error.message}`;
    console.error(`WhatsApp API HTTP error for notification ${notification.id}:`, errorMsg);
    
    // Log API error alert
    await logWhatsAppAlert(notification.company_id, `Erro na API WhatsApp: ${errorMsg}`);
    
    throw new Error(errorMsg);
  }

  // Check if the response indicates failure (success: false)
  if (whatsappResponse.data && whatsappResponse.data.success === false) {
    const errorMsg = whatsappResponse.data.error || whatsappResponse.data.message || 'Falha no envio da mensagem';
    console.error(`WhatsApp send failed for notification ${notification.id}:`, errorMsg);
    
    // Check if it's a connection issue
    if (errorMsg.includes('not connected') || errorMsg.includes('WhatsApp instance not connected') || errorMsg.includes('não autenticado')) {
      await logWhatsAppAlert(notification.company_id, `WhatsApp desconectado durante envio: ${errorMsg}`);
      throw new Error(`WhatsApp não autenticado — reconectar o número para continuar os envios.`);
    }
    
    // Log other sending errors
    await logWhatsAppAlert(notification.company_id, `Erro no envio: ${errorMsg}`);
    
    throw new Error(`WhatsApp send failed: ${errorMsg}`);
  }

  // Additional check for response status
  if (whatsappResponse.data && whatsappResponse.data.status === 'failed') {
    const errorMsg = whatsappResponse.data.error || 'Falha no envio via WhatsApp';
    console.error(`WhatsApp delivery failed for notification ${notification.id}:`, errorMsg);
    
    // Log delivery failure
    await logWhatsAppAlert(notification.company_id, `Falha na entrega: ${errorMsg}`);
    
    throw new Error(`WhatsApp delivery failed: ${errorMsg}`);
  }

  // Check if no data returned at all
  if (!whatsappResponse.data) {
    const errorMsg = 'Nenhuma resposta da API WhatsApp';
    console.error(`No response data for notification ${notification.id}`);
    
    // Log no response error
    await logWhatsAppAlert(notification.company_id, errorMsg);
    
    throw new Error(errorMsg);
  }

  console.log(`WhatsApp message sent successfully for notification ${notification.id}`);

  // Store rendered message for audit
  await supabase
    .from('payment_notifications')
    .update({ message_body: message })
    .eq('id', notification.id);
}

// Helper function to log WhatsApp alerts
async function logWhatsAppAlert(companyId: string, message: string) {
  try {
    console.log('🚨 Logging WhatsApp alert:', { companyId, message });
    
    // Insert alert into system_alerts table
    await supabase
      .from('system_alerts')
      .insert({
        company_id: companyId,
        type: 'whatsapp_connection',
        message: message,
        severity: 'error',
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Failed to log WhatsApp alert:', error);
    // Don't throw here to avoid breaking the main flow
  }
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
  
  // ALWAYS use checkout link (universal payment link)
  const checkoutUrl = `${supabaseUrl.replace('/rest/v1', '')}/checkout/${payment.id}`;
  const paymentLink = checkoutUrl;

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
  
  // First, update overdue payments status
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { error: updateError } = await supabase
    .from('payment_transactions')
    .update({ status: 'overdue', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lt('due_date', today.toISOString().split('T')[0]);
  
  if (updateError) {
    console.error('Error updating overdue payments:', updateError);
  } else {
    console.log('✅ Updated overdue payments status');
  }
  
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

  // Global payment index for staggering notifications across all companies
  let globalPaymentIndex = 0;

  for (const settings of companiesWithSettings) {
    const companyResults = await createNotificationsForCompany(settings, specificPaymentId, globalPaymentIndex);
    results.created += companyResults.created;
    results.skipped += companyResults.skipped;
    globalPaymentIndex = companyResults.lastPaymentIndex;
  }
  
  return results;
}

async function createNotificationsForCompany(settings: any, specificPaymentId?: string, startPaymentIndex: number = 0) {
  console.log(`Creating notifications for company: ${settings.company_id}${specificPaymentId ? `, payment: ${specificPaymentId}` : ''}`);
  
  const results = { created: 0, skipped: 0, lastPaymentIndex: startPaymentIndex };
  let paymentIndex = startPaymentIndex;
  
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
    // Process payments from the last 120 days (4 months) for better coverage
    // This ensures we catch overdue payments that need ongoing notifications
    const oneHundredTwentyDaysAgo = new Date();
    oneHundredTwentyDaysAgo.setDate(oneHundredTwentyDaysAgo.getDate() - 120);
    query = query.gte('due_date', oneHundredTwentyDaysAgo.toISOString().split('T')[0]);
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
    // Incrementar índice para escalonamento de múltiplos pagamentos
    paymentIndex++;
    results.lastPaymentIndex = paymentIndex;
    
    // Skip payments without valid client data
    if (!payment.clients || !payment.clients.phone) {
      console.log(`Skipping payment ${payment.id} - no valid client or phone`);
      results.skipped++;
      continue;
    }

    const dueDate = new Date(payment.due_date);
    
    // Skip payments that are too old (more than 120 days past due)  
    const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysPastDue > 120) {
      console.log(`Skipping payment ${payment.id} - too old (${daysPastDue} days past due)`);
      results.skipped++;
      continue;
    }
    
    // Check if we already have notifications for this payment
    // Check ALL statuses to avoid duplicate key errors
    const { data: existingNotifications } = await supabase
      .from('payment_notifications')
      .select('event_type, offset_days, scheduled_for, status')
      .eq('payment_id', payment.id)
      .in('status', ['pending', 'sent']); // Check pending and sent to avoid duplicates

    // Criar mapa das notificações existentes
    const existingKeys = new Set();
    const existingPostDueDays = new Map(); // Map para controlar quantos disparos já existem por dia
    const existingOnDueCount = new Map(); // Map para controlar quantos disparos on_due existem
    
    existingNotifications?.forEach(n => {
      if (n.event_type === 'post_due') {
        // Contar quantas notificações existem para cada dia pós-vencimento
        if (!existingPostDueDays.has(n.offset_days)) {
          existingPostDueDays.set(n.offset_days, 0);
        }
        existingPostDueDays.set(n.offset_days, existingPostDueDays.get(n.offset_days) + 1);
        
        // Criar chave específica para cada disparo (compatível com a lógica de criação)
        const scheduledDate = new Date(n.scheduled_for);
        const hour = scheduledDate.getHours();
        const timeParts = settings.send_hour.split(':');
        const baseHour = parseInt(timeParts[0]) || 9;
        const intervalHours = settings.post_due_interval_hours || 6;
        
        let dispatchIndex = 0;
        if (hour >= baseHour + intervalHours) {
          dispatchIndex = 1;
        }
        
        existingKeys.add(`post_due_${n.offset_days}_${dispatchIndex}`);
      } else if (n.event_type === 'on_due') {
        // Contar notificações on_due
        if (!existingOnDueCount.has(n.offset_days)) {
          existingOnDueCount.set(n.offset_days, 0);
        }
        existingOnDueCount.set(n.offset_days, existingOnDueCount.get(n.offset_days) + 1);
        existingKeys.add(`on_due_${n.offset_days}`);
      } else {
        existingKeys.add(`${n.event_type}_${n.offset_days}`);
      }
    });

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
        
        let scheduledDate = new Date(dueDate);
        scheduledDate.setDate(scheduledDate.getDate() - days);
        
        // Parse send_hour properly (format: HH:MM:SS or HH:MM)
        const timeParts = settings.send_hour.split(':');
        const hour = parseInt(timeParts[0]) || 9;
        const minute = parseInt(timeParts[1]) || 0;
        
        // Use Brazil timezone (UTC-3) for scheduling
        scheduledDate = setBrazilTime(scheduledDate, hour, minute);
        
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
      const existingOnDue = existingOnDueCount.get(0) || 0; // Verificar quantas notificações on_due já existem
      
      // Criar apenas as notificações on_due que faltam
      for (let i = existingOnDue; i < onDueTimes; i++) {
        const key = `on_due_${i}`;
        if (existingKeys.has(key)) continue;
        
        let scheduledDate = new Date(dueDate);
        
        // Parse send_hour properly (format: HH:MM:SS or HH:MM)
        const timeParts = settings.send_hour.split(':');
        const hour = parseInt(timeParts[0]) || 9;
        const minute = parseInt(timeParts[1]) || 0;
        
        // Use Brazil timezone (UTC-3) for scheduling
        scheduledDate = setBrazilTime(scheduledDate, hour, minute);
        
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
    // NOVA LÓGICA: Criar apenas a PRÓXIMA notificação respeitando o intervalo de 6h
    if (isOverdue) {
      console.log(`Creating post-due notifications for payment ${payment.id}, ${daysPastDue} days overdue`);
      
      const timeParts = settings.send_hour.split(':');
      const baseHour = parseInt(timeParts[0]) || 9;
      const baseMinute = parseInt(timeParts[1]) || 0;
      const intervalHours = settings.post_due_interval_hours || 6;
      
      // Buscar a última notificação post_due enviada ou agendada
      const postDueNotifications = existingNotifications
        .filter(n => n.event_type === 'post_due')
        .sort((a, b) => new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime());
      
      const lastPostDue = postDueNotifications[0];
      const hasPendingPostDue = postDueNotifications.some(n => n.status === 'pending');
      
      // Se já existe uma notificação pendente, não criar outra
      if (hasPendingPostDue) {
        console.log(`✅ Post_due notification already pending, skipping creation`);
      } else {
        // Calcular quando deve ser a próxima notificação
        let nextScheduledDate: Date;
        
        if (!lastPostDue) {
          // Primeira notificação post_due - agendar para o horário configurado (9h da manhã no Brasil)
          nextScheduledDate = setBrazilTime(new Date(), baseHour, baseMinute);
          
          // Se já passou do horário de hoje, enviar em alguns minutos com escalonamento
          if (nextScheduledDate.getTime() < now.getTime()) {
            // Escalonar múltiplos pagamentos: 2min, 5min, 8min, 11min...
            const delayMinutes = 2 + ((paymentIndex - 1) * 3);
            nextScheduledDate = new Date(now.getTime() + (delayMinutes * 60 * 1000));
          }
          console.log(`🆕 First post_due notification for payment #${paymentIndex}, scheduling for ${nextScheduledDate.toISOString()}`);
        } else {
          // Próxima notificação = última + intervalo configurado (6h)
          nextScheduledDate = new Date(lastPostDue.scheduled_for);
          nextScheduledDate.setHours(nextScheduledDate.getHours() + intervalHours);
          console.log(`📅 Last post_due at ${lastPostDue.scheduled_for}, scheduling next for ${nextScheduledDate.toISOString()}`);
          
          // Se a data calculada já passou, agendar com escalonamento
          if (nextScheduledDate.getTime() < now.getTime()) {
            // Escalonar múltiplos pagamentos: 2min, 5min, 8min, 11min...
            const delayMinutes = 2 + ((paymentIndex - 1) * 3);
            nextScheduledDate = new Date(now.getTime() + (delayMinutes * 60 * 1000));
            console.log(`⚡ Payment #${paymentIndex}: Adjusted to immediate send with ${delayMinutes}min delay: ${nextScheduledDate.toISOString()}`);
          }
        }
        
        console.log(`Creating next post-due notification scheduled for: ${nextScheduledDate.toISOString()}`);
        
        notifications.push({
          company_id: settings.company_id,
          payment_id: payment.id,
          client_id: payment.client_id,
          event_type: 'post_due',
          offset_days: daysPastDue,
          scheduled_for: nextScheduledDate.toISOString(),
          status: 'pending',
          notification_settings_id: settings.id,
          attempts: 0
        });
      }
    }
  }

  if (notifications.length > 0) {
    // Tentar insert em batch primeiro
    const { error } = await supabase
      .from('payment_notifications')
      .insert(notifications);

    if (error) {
      // Se houver erro de chave duplicada, tentar inserir um por um ignorando duplicatas
      if (error.code === '23505') {
        console.warn(`Duplicate key error for company ${settings.company_id}, inserting individually...`);
        let successCount = 0;
        
        for (const notification of notifications) {
          const { error: individualError } = await supabase
            .from('payment_notifications')
            .insert(notification);
          
          if (individualError) {
            if (individualError.code !== '23505') {
              console.error(`Error inserting individual notification:`, individualError);
            }
            // Se for erro de duplicata, apenas ignorar silenciosamente
          } else {
            successCount++;
          }
        }
        
        console.log(`Created ${successCount}/${notifications.length} notifications for company ${settings.company_id} (skipped duplicates)`);
        results.created = successCount;
      } else {
        console.error(`Error creating notifications for company ${settings.company_id}:`, error);
      }
    } else {
      console.log(`Created ${notifications.length} notifications for company ${settings.company_id}`);
      results.created = notifications.length;
    }
  }
  
  return results;
}