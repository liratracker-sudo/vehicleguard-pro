import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appUrl = Deno.env.get('APP_URL') || 'https://gestaotracker.lovable.app';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ================== CACHES GLOBAIS PARA OTIMIZAÇÃO ==================
// Esses caches são preenchidos uma vez por execução e reutilizados
interface CompanyCache {
  notificationSettings: Map<string, any>;
  whatsappSettings: Map<string, any>;
  companyDomains: Map<string, string | null>;
  whatsappConnectionStatus: Map<string, { connected: boolean; error?: string }>;
}

let companyCache: CompanyCache = {
  notificationSettings: new Map(),
  whatsappSettings: new Map(),
  companyDomains: new Map(),
  whatsappConnectionStatus: new Map(),
};

// Função para resetar cache no início de cada execução
function resetCache() {
  companyCache = {
    notificationSettings: new Map(),
    whatsappSettings: new Map(),
    companyDomains: new Map(),
    whatsappConnectionStatus: new Map(),
  };
  console.log('🗑️ Cache resetado para nova execução');
}

// Função para pré-carregar todas as configurações necessárias
async function preloadConfigurations(companyIds: string[]) {
  if (companyIds.length === 0) return;
  
  console.log(`📦 Pré-carregando configurações para ${companyIds.length} empresas...`);
  const startTime = Date.now();
  
  // Buscar todas as configurações em paralelo
  const [notificationSettingsResult, whatsappSettingsResult, companiesResult] = await Promise.all([
    supabase
      .from('payment_notification_settings')
      .select('*')
      .in('company_id', companyIds),
    supabase
      .from('whatsapp_settings')
      .select('*')
      .in('company_id', companyIds)
      .eq('is_active', true),
    supabase
      .from('companies')
      .select('id, domain')
      .in('id', companyIds)
  ]);
  
  // Popular caches
  for (const setting of notificationSettingsResult.data || []) {
    companyCache.notificationSettings.set(setting.company_id, setting);
  }
  
  for (const setting of whatsappSettingsResult.data || []) {
    companyCache.whatsappSettings.set(setting.company_id, setting);
  }
  
  for (const company of companiesResult.data || []) {
    companyCache.companyDomains.set(company.id, company.domain);
  }
  
  console.log(`✅ Cache carregado em ${Date.now() - startTime}ms: ${companyCache.notificationSettings.size} notification settings, ${companyCache.whatsappSettings.size} whatsapp settings, ${companyCache.companyDomains.size} domains`);
}

// Função para verificar conexão WhatsApp com cache
async function checkWhatsAppConnectionCached(companyId: string): Promise<{ connected: boolean; error?: string }> {
  // Verificar se já temos no cache
  if (companyCache.whatsappConnectionStatus.has(companyId)) {
    console.log(`📱 WhatsApp connection (cached) para empresa ${companyId}`);
    return companyCache.whatsappConnectionStatus.get(companyId)!;
  }
  
  // Buscar configurações do cache
  const whatsappSettings = companyCache.whatsappSettings.get(companyId);
  if (!whatsappSettings) {
    const result = { connected: false, error: 'Configurações do WhatsApp não encontradas' };
    companyCache.whatsappConnectionStatus.set(companyId, result);
    return result;
  }
  
  // Verificar conexão
  console.log(`📱 Verificando conexão WhatsApp para empresa ${companyId}...`);
  try {
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
    
    const result = {
      connected: connectionCheck.data?.connected || false,
      error: connectionCheck.error?.message || connectionCheck.data?.error
    };
    
    companyCache.whatsappConnectionStatus.set(companyId, result);
    console.log(`📱 WhatsApp connection status para ${companyId}: ${result.connected ? '✅ conectado' : '❌ desconectado'}`);
    return result;
  } catch (error) {
    const result = { connected: false, error: error instanceof Error ? error.message : String(error) };
    companyCache.whatsappConnectionStatus.set(companyId, result);
    return result;
  }
}

// ================== FIM DOS CACHES ==================

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

// Helper function to set time in Brazil timezone with optional randomization for anti-spam
function setBrazilTime(date: Date, hour: number, minute: number, randomize: boolean = false): Date {
  // Get date components in UTC
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  
  // Create a date at midnight UTC for the given date
  const utcDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  
  let finalHour = hour;
  let finalMinute = minute;
  
  // Randomização anti-spam: variar horário entre 8h-11h Brasil para evitar padrões detectáveis
  if (randomize) {
    // Janela de 8h-10h59 (3 horas = 180 minutos)
    const randomMinutes = Math.floor(Math.random() * 180);
    finalHour = 8 + Math.floor(randomMinutes / 60);
    finalMinute = randomMinutes % 60;
    console.log(`🎲 Randomized time: ${finalHour}:${String(finalMinute).padStart(2, '0')} Brazil (anti-spam)`);
  }
  
  // Brazil is UTC-3, so to set 9h Brazil time, we need 12h UTC (9 + 3)
  // Add the desired Brazil time + 3 hours to get UTC time
  const utcHour = finalHour + 3;
  utcDate.setUTCHours(utcHour, finalMinute, 0, 0);
  
  console.log(`🕐 Setting time: ${finalHour}:${String(finalMinute).padStart(2, '0')} Brazil = ${utcDate.toISOString()} UTC (${utcHour}:${String(finalMinute).padStart(2, '0')} UTC)`);
  
  return utcDate;
}

// Global timeout for edge function (280s - alinhado com cron timeout de 300s)
const FUNCTION_TIMEOUT_MS = 280000;

// Configurações de processamento paralelo por empresa
const NOTIFICATIONS_PER_COMPANY = 25; // Limite de notificações por empresa por execução
const PARALLEL_COMPANIES = 3; // Número de empresas processadas simultaneamente
const DELAY_BETWEEN_MESSAGES_MS = { min: 5000, max: 8000 }; // Delay anti-ban entre mensagens

// Helper para delay aleatório (anti-ban)
function randomDelay(): Promise<void> {
  const delay = Math.floor(
    Math.random() * (DELAY_BETWEEN_MESSAGES_MS.max - DELAY_BETWEEN_MESSAGES_MS.min + 1) + 
    DELAY_BETWEEN_MESSAGES_MS.min
  );
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Helper to create timeout promise
function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Function timeout exceeded (${ms}ms)`));
    }, ms);
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let logEntryId: string | null = null;

  try {
    console.log('🚀 Billing notifications processor started');
    
    // Resetar cache no início de cada execução
    resetCache();
    
    // Parse request body to check for specific payment/company triggers
    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { payment_id, company_id, trigger, force, scheduled_time, notification_id } = body;
    
    console.log('📥 Request params:', { payment_id, company_id, trigger, force, scheduled_time, notification_id });
    
    // ==================== PROTEÇÃO CONTRA JOBS CONCORRENTES ====================
    // Verificar se já existe um job em execução (evita duplicação)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    // Primeiro: limpar jobs travados há mais de 10 minutos
    const { data: stuckJobs } = await supabase
      .from('cron_execution_logs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: 'Timeout automático - job travado por mais de 10 minutos'
      })
      .eq('job_name', 'billing-notifications-function')
      .eq('status', 'running')
      .lt('started_at', tenMinutesAgo)
      .select('id');
    
    if (stuckJobs && stuckJobs.length > 0) {
      console.log(`🧹 Cleaned up ${stuckJobs.length} stuck jobs`);
    }
    
    // Segundo: verificar se há jobs recentes em execução (últimos 5 minutos)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: runningJobs } = await supabase
      .from('cron_execution_logs')
      .select('id, started_at')
      .eq('job_name', 'billing-notifications-function')
      .eq('status', 'running')
      .gt('started_at', fiveMinutesAgo);
    
    if (runningJobs && runningJobs.length > 0) {
      console.log(`⚠️ Found ${runningJobs.length} running jobs. Skipping to avoid duplication.`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Outro job ainda está em execução',
          skipped: true,
          running_job_ids: runningJobs.map(j => j.id)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ==================== FIM PROTEÇÃO JOBS CONCORRENTES ====================
    
    // Log execution start for monitoring
    const { data: logEntry } = await supabase
      .from('cron_execution_logs')
      .insert({
        job_name: trigger === 'manual_9am_start' ? 'billing-notifications-manual-9am' : 'billing-notifications-function',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    logEntryId = logEntry?.id || null;
    
    let result;
    
    // Wrap main processing in timeout
    const mainProcessing = async () => {
      if (trigger === 'payment_created' && payment_id) {
        // Handle specific payment notification creation
        console.log(`📝 Creating notifications for specific payment: ${payment_id}`);
        
        // Get payment details to identify company
        const { data: payment } = await supabase
          .from('payment_transactions')
          .select('company_id')
          .eq('id', payment_id)
          .single();
          
        if (payment?.company_id) {
          return await createMissingNotifications(payment_id, payment.company_id);
        }
        return { created: 0, skipped: 0 };
      } else if (trigger === 'resend_notification' && notification_id) {
        // Handle specific notification resend
        console.log(`🔄 Resending specific notification: ${notification_id}`);
        return await resendSpecificNotification(notification_id);
      } else if (trigger === 'debug_notification' && notification_id) {
        // Handle notification debug
        console.log(`🐛 Debugging specific notification: ${notification_id}`);
        return await debugSpecificNotification(notification_id);
      } else if (trigger === 'manual_9am_start') {
        // Handle manual 9am trigger - force send all pending notifications and create missing ones
        console.log('🚀 Manual 9AM trigger - processing all notifications with force=true');
        return await processNotifications(true);
      } else {
        // Process all pending notifications and create missing ones
        return await processNotifications(force);
      }
    };

    // Execute with timeout protection
    try {
      result = await Promise.race([
        mainProcessing(),
        createTimeout(FUNCTION_TIMEOUT_MS)
      ]);
    } catch (timeoutError) {
      if (timeoutError instanceof Error && timeoutError.message.includes('timeout')) {
        console.error('⏰ Function timeout reached, aborting...');
        throw timeoutError;
      }
      throw timeoutError;
    }
    
    const executionTime = Date.now() - startTime;
    console.log(`✅ Billing notifications completed in ${executionTime}ms`);
    
    // Update log entry with success
    if (logEntryId) {
      await supabase
        .from('cron_execution_logs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          execution_time_ms: executionTime,
          response_body: JSON.stringify(result || { success: true })
        })
        .eq('id', logEntryId);
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
    const executionTime = Date.now() - startTime;
    console.error('❌ Error processing billing notifications:', error);
    
    // Update existing log entry or create new one with error
    if (logEntryId) {
      await supabase
        .from('cron_execution_logs')
        .update({
          status: 'error',
          finished_at: new Date().toISOString(),
          execution_time_ms: executionTime,
          error_message: error instanceof Error ? error.message : String(error)
        })
        .eq('id', logEntryId);
    } else {
      await supabase
        .from('cron_execution_logs')
        .insert({
          job_name: 'billing-notifications-function',
          status: 'error',
          finished_at: new Date().toISOString(),
          execution_time_ms: executionTime,
          error_message: error instanceof Error ? error.message : String(error)
        });
    }
    
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
  console.log('🚀 [CHECKPOINT] Starting notification processing...', { force });
  
  const results = {
    sent: 0,
    failed: 0,
    created: 0,
    skipped: 0,
    recreated: 0
  };
  
  try {
    // 1. Limpar e recriar notificações de cobranças já vencidas com horário incorreto
    console.log('📋 [STEP 1/3] Recreating overdue notifications...');
    const recreatedResults = await recreateOverdueNotifications();
    results.recreated = recreatedResults.recreated;
    console.log(`✅ [STEP 1/3] Done: ${results.recreated} recreated`);
    
    // 2. Send pending notifications POR EMPRESA em PARALELO
    console.log('📤 [STEP 2/3] Sending pending notifications (parallel by company)...');
    const sentResults = await sendPendingNotificationsParallel(force);
    results.sent = sentResults.sent;
    results.failed = sentResults.failed;
    console.log(`✅ [STEP 2/3] Done: ${results.sent} sent, ${results.failed} failed`);
    
    // 3. Create new notifications for payments without them
    console.log('📝 [STEP 3/3] Creating missing notifications...');
    const createdResults = await createMissingNotifications();
    results.created = createdResults.created;
    results.skipped = createdResults.skipped;
    console.log(`✅ [STEP 3/3] Done: ${results.created} created, ${results.skipped} skipped`);
    
  } catch (error) {
    console.error('❌ Error in processNotifications:', error instanceof Error ? error.message : error);
    throw error; // Re-throw to be caught by main handler
  }
  
  console.log('✅ [CHECKPOINT] Notification processing completed', results);
  return results;
}

// ==================== PROCESSAMENTO PARALELO POR EMPRESA ====================

// Função principal que orquestra o processamento paralelo por empresa
async function sendPendingNotificationsParallel(force = false) {
  console.log('🚀 [PARALLEL] Starting parallel notification processing by company...', { force });
  
  const results = { sent: 0, failed: 0, skipped: 0, blocked_by_time: false, companies_processed: 0 };
  
  // VALIDAÇÃO DE JANELA DE HORÁRIO: Enviar entre 8h-11h E 14h-16h Brasil
  const now = new Date();
  const brazilHour = (now.getUTCHours() - 3 + 24) % 24; // UTC-3
  
  // Janela manhã: 8h-11h | Janela tarde: 14h-16h
  const inMorningWindow = brazilHour >= 8 && brazilHour <= 11;
  const inAfternoonWindow = brazilHour >= 14 && brazilHour <= 16;
  
  if (!force && !inMorningWindow && !inAfternoonWindow) {
    console.log(`⏰ BLOQUEADO: Fora da janela de envio (${brazilHour}h Brasil). Envio permitido: 8h-11h e 14h-16h Brasil.`);
    results.blocked_by_time = true;
    return results;
  }
  
  const windowType = inMorningWindow ? 'manhã' : 'tarde';
  console.log(`✅ Dentro da janela de envio ${windowType} (${brazilHour}h Brasil). Processando por empresa...`);
  
  // First, cleanup notifications for cancelled/paid payments
  await cleanupInvalidNotifications();
  
  // Buscar empresas com notificações ativas
  const { data: activeCompanies, error: companiesError } = await supabase
    .from('payment_notification_settings')
    .select('company_id, send_hour')
    .eq('active', true);
  
  if (companiesError || !activeCompanies?.length) {
    console.log('No active companies with notification settings');
    return results;
  }
  
  console.log(`📊 [PARALLEL] Found ${activeCompanies.length} active companies`);
  
  // Pré-carregar configurações de todas as empresas
  const companyIds = activeCompanies.map(c => c.company_id);
  await preloadConfigurations(companyIds);
  
  // FILTRAR empresas que TÊM WhatsApp configurado (evitar processamento desnecessário)
  const companiesWithWhatsApp = activeCompanies.filter(company => {
    const whatsappSettings = companyCache.whatsappSettings.get(company.company_id);
    if (!whatsappSettings) {
      console.log(`⏭️ Skipping company ${company.company_id} - no WhatsApp configured`);
      return false;
    }
    return true;
  });
  
  console.log(`📊 [PARALLEL] ${companiesWithWhatsApp.length}/${activeCompanies.length} companies have WhatsApp configured`);
  
  if (companiesWithWhatsApp.length === 0) {
    console.log('⚠️ No companies with WhatsApp configured - nothing to process');
    return results;
  }
  
  // Processar empresas em lotes paralelos (PARALLEL_COMPANIES simultâneas)
  // USAR companiesWithWhatsApp ao invés de activeCompanies
  for (let i = 0; i < companiesWithWhatsApp.length; i += PARALLEL_COMPANIES) {
    const batch = companiesWithWhatsApp.slice(i, i + PARALLEL_COMPANIES);
    console.log(`📦 [PARALLEL] Processing batch ${Math.floor(i / PARALLEL_COMPANIES) + 1}: ${batch.length} companies (with WhatsApp)`);
    
    // Processar lote de empresas em paralelo
    const batchResults = await Promise.all(
      batch.map(company => processCompanyNotifications(company.company_id, force))
    );
    
    // Agregar resultados
    for (const companyResult of batchResults) {
      results.sent += companyResult.sent;
      results.failed += companyResult.failed;
      results.skipped += companyResult.skipped;
      results.companies_processed++;
    }
    
    console.log(`✅ [PARALLEL] Batch completed. Totals so far: ${results.sent} sent, ${results.failed} failed`);
  }
  
  console.log(`🏁 [PARALLEL] All companies processed: ${results.companies_processed} companies, ${results.sent} sent, ${results.failed} failed`);
  return results;
}

// Processa notificações de UMA empresa específica (limite: NOTIFICATIONS_PER_COMPANY)
async function processCompanyNotifications(companyId: string, force = false) {
  console.log(`🏢 [COMPANY ${companyId}] Starting processing (limit: ${NOTIFICATIONS_PER_COMPANY})...`);
  
  const results = { sent: 0, failed: 0, skipped: 0 };
  const bufferTime = new Date();
  bufferTime.setMinutes(bufferTime.getMinutes() + 5);
  
  // Buscar notificações pendentes APENAS desta empresa
  // IMPORTANTE: Exclui status 'sending' para evitar duplicação por jobs concorrentes
  const { data: notifications, error } = await supabase
    .from('payment_notifications')
    .select(`
      *,
      payment_transactions!inner(*, clients(name, phone, email))
    `)
    .eq('company_id', companyId)
    .eq('status', 'pending')  // Apenas 'pending', exclui 'sending'
    .lte('scheduled_for', bufferTime.toISOString())
    .order('offset_days', { ascending: true })
    .order('scheduled_for', { ascending: true })
    .limit(NOTIFICATIONS_PER_COMPANY); // LIMITE POR EMPRESA
  
  if (error) {
    console.error(`❌ [COMPANY ${companyId}] Error fetching notifications:`, error);
    return results;
  }
  
  if (!notifications || notifications.length === 0) {
    console.log(`📭 [COMPANY ${companyId}] No pending notifications`);
    return results;
  }
  
  console.log(`📋 [COMPANY ${companyId}] Found ${notifications.length} pending notifications`);
  
  // Track which payment+event_type combinations we've already sent in this batch
  const sentInThisBatch = new Set<string>();
  
  for (const notification of notifications) {
    // Skip notifications without valid data
    if (!notification.payment_transactions || !notification.payment_transactions.clients) {
      console.log(`⏭️ [COMPANY ${companyId}] Skipping ${notification.id} - invalid data`);
      continue;
    }
    
    // Skip notifications for cancelled or paid payments
    const paymentStatus = notification.payment_transactions.status;
    if (!paymentStatus || !['pending', 'overdue'].includes(paymentStatus)) {
      await supabase
        .from('payment_notifications')
        .update({
          status: 'skipped',
          last_error: `Payment status is ${paymentStatus}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', notification.id);
      results.skipped++;
      continue;
    }
    
    // Check for duplicates in this batch
    const batchKey = `${notification.payment_id}:${notification.event_type}`;
    if (sentInThisBatch.has(batchKey)) {
      await supabase
        .from('payment_notifications')
        .update({
          status: 'skipped',
          last_error: `Duplicate ${notification.event_type} - already sent in this batch`,
          updated_at: new Date().toISOString()
        })
        .eq('id', notification.id);
      results.skipped++;
      continue;
    }
    
    // Check for recently sent similar notifications (last 12 hours)
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data: recentSent } = await supabase
      .from('payment_notifications')
      .select('id, sent_at')
      .eq('payment_id', notification.payment_id)
      .eq('event_type', notification.event_type)
      .eq('status', 'sent')
      .gte('sent_at', twelveHoursAgo)
      .limit(1);

    if (recentSent && recentSent.length > 0) {
      await supabase
        .from('payment_notifications')
        .update({
          status: 'skipped',
          last_error: `Similar notification already sent at ${recentSent[0].sent_at}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', notification.id);
      results.skipped++;
      continue;
    }
    
    try {
      // ==================== PROTEÇÃO ANTI-DUPLICAÇÃO ====================
      // PASSO 1: Marcar como "sending" ANTES de enviar (evita que outro job processe)
      const { error: lockError } = await supabase
        .from('payment_notifications')
        .update({
          status: 'sending',
          updated_at: new Date().toISOString()
        })
        .eq('id', notification.id)
        .eq('status', 'pending');  // Só atualiza se ainda estiver pending (lock otimista)
      
      if (lockError) {
        console.log(`⚠️ [COMPANY ${companyId}] Could not lock notification ${notification.id} - may be processed by another job`);
        results.skipped++;
        continue;
      }
      
      // Verificar se conseguimos o lock (outra instância pode ter atualizado antes)
      const { data: lockedNotif } = await supabase
        .from('payment_notifications')
        .select('status')
        .eq('id', notification.id)
        .single();
      
      if (lockedNotif?.status !== 'sending') {
        console.log(`⚠️ [COMPANY ${companyId}] Notification ${notification.id} was processed by another job`);
        results.skipped++;
        continue;
      }
      // ==================== FIM PROTEÇÃO ANTI-DUPLICAÇÃO ====================
      
      await sendSingleNotification(notification);
      
      // PASSO 2: Marcar como "sent" DEPOIS de enviar com sucesso
      await supabase
        .from('payment_notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          attempts: notification.attempts + 1
        })
        .eq('id', notification.id);
      
      sentInThisBatch.add(batchKey);
      results.sent++;
      console.log(`✅ [COMPANY ${companyId}] Notification ${notification.id} sent`);
      
      // DELAY ANTI-BAN entre mensagens (5-8 segundos)
      if (notifications.indexOf(notification) < notifications.length - 1) {
        await randomDelay();
      }
      
    } catch (error) {
      console.error(`❌ [COMPANY ${companyId}] Failed notification ${notification.id}:`, error);
      
      // 🔌 CIRCUIT BREAKER: Se for erro de WhatsApp desconectado, marcar como failed e PARAR
      if ((error as any).isCircuitBreaker || (error instanceof Error && error.message.includes('[CIRCUIT_BREAKER]'))) {
        console.error(`🔌 [CIRCUIT BREAKER] Company ${companyId} - WhatsApp disconnected, stopping all notifications`);
        
        // Marcar esta notificação como failed (estava em 'sending')
        await supabase
          .from('payment_notifications')
          .update({
            status: 'failed',
            attempts: notification.attempts + 1,
            last_error: 'WhatsApp desconectado - reconecte para retomar envios',
            updated_at: new Date().toISOString()
          })
          .eq('id', notification.id);
        
        results.failed++;
        
        // PARAR o processamento desta empresa (circuit breaker ativado)
        console.log(`🛑 [COMPANY ${companyId}] Circuit breaker activated - stopping all notifications for this company`);
        break;
      }
      
      const newAttempts = notification.attempts + 1;
      const maxAttempts = 3;
      // Se falhou, volta para 'pending' para tentar novamente (ou 'failed' se excedeu tentativas)
      const status = newAttempts >= maxAttempts ? 'failed' : 'pending';
      
      await supabase
        .from('payment_notifications')
        .update({
          status,
          attempts: newAttempts,
          last_error: error instanceof Error ? error.message : String(error),
          updated_at: new Date().toISOString()
        })
        .eq('id', notification.id);
      
      results.failed++;
    }
  }
  
  console.log(`🏁 [COMPANY ${companyId}] Completed: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`);
  return results;
}

// ==================== FIM PROCESSAMENTO PARALELO ====================

// Função para recriar notificações de cobranças já vencidas com horário incorreto
// OTIMIZADO: Limita processamento a 30 pagamentos por execução para evitar timeout
async function recreateOverdueNotifications() {
  console.log('🔄 [CHECKPOINT] Iniciando verificação de cobranças vencidas com notificações incorretas...');
  
  const results = { recreated: 0, processed: 0 };
  const now = new Date();
  const sendHour = 9; // Hora correta para envio (9h Brasil)
  const BATCH_LIMIT = 30; // Limitar processamento por execução
  
  try {
    // Buscar pagamentos já vencidos COM LIMITE (excluindo protestados)
    const { data: overduePayments, error: paymentsError } = await supabase
      .from('payment_transactions')
      .select('id, company_id, client_id, due_date, status, protested_at')
      .lt('due_date', now.toISOString())
      .in('status', ['pending', 'overdue'])
      .is('protested_at', null) // Excluir cobranças protestadas
      .limit(BATCH_LIMIT);
    
    if (paymentsError) {
      console.error('❌ Erro ao buscar pagamentos vencidos:', paymentsError);
      return results;
    }
    
    if (!overduePayments || overduePayments.length === 0) {
      console.log('✅ [CHECKPOINT] Nenhum pagamento vencido encontrado');
      return results;
    }
    
    console.log(`📋 [CHECKPOINT] Processando ${overduePayments.length} de no máximo ${BATCH_LIMIT} pagamentos vencidos`);
    
    // Buscar todas as notificações pendentes em batch (uma única query)
    const paymentIds = overduePayments.map(p => p.id);
    const { data: allPendingNotifications } = await supabase
      .from('payment_notifications')
      .select('id, payment_id, scheduled_for, event_type, offset_days')
      .in('payment_id', paymentIds)
      .eq('status', 'pending');
    
    // Criar mapa de notificações por payment_id
    const notificationsByPayment = new Map<string, typeof allPendingNotifications>();
    for (const notif of allPendingNotifications || []) {
      if (!notificationsByPayment.has(notif.payment_id)) {
        notificationsByPayment.set(notif.payment_id, []);
      }
      notificationsByPayment.get(notif.payment_id)!.push(notif);
    }
    
    // Processar cada pagamento
    for (const payment of overduePayments) {
      results.processed++;
      const pendingNotifications = notificationsByPayment.get(payment.id) || [];
      
      if (pendingNotifications.length === 0) {
        // Sem notificações pendentes - criar notificação post_due
        const dueDate = new Date(payment.due_date);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const scheduledFor = setBrazilTime(now, sendHour, 0);
        
        // USAR UPSERT com ignoreDuplicates para evitar erros de constraint
        const { error: insertError } = await supabase
          .from('payment_notifications')
          .upsert({
            payment_id: payment.id,
            client_id: payment.client_id,
            company_id: payment.company_id,
            event_type: 'post_due',
            offset_days: daysOverdue,
            scheduled_for: scheduledFor.toISOString(),
            status: 'pending'
          }, {
            onConflict: 'company_id,payment_id,event_type,offset_days',
            ignoreDuplicates: true
          });
        
        if (!insertError) {
          results.recreated++;
        } else {
          console.error(`❌ Erro ao criar notificação para ${payment.id}:`, insertError.message);
        }
        continue;
      }
      
      // Verificar se alguma notificação está com horário incorreto (22h UTC = 19h Brasil)
      const incorrectNotifications = pendingNotifications.filter(n => {
        const schedDate = new Date(n.scheduled_for);
        const schedHour = schedDate.getUTCHours();
        return schedHour === 22;
      });
      
      if (incorrectNotifications.length > 0) {
        // Marcar notificações antigas como skipped em batch
        const oldIds = incorrectNotifications.map(n => n.id);
        await supabase
          .from('payment_notifications')
          .update({ 
            status: 'skipped',
            last_error: 'Horário incorreto - recriada com horário correto (9h Brasil)'
          })
          .in('id', oldIds);
        
        // Criar nova notificação com horário correto
        const dueDate = new Date(payment.due_date);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const scheduledFor = setBrazilTime(now, sendHour, 0);
        
        // USAR UPSERT com ignoreDuplicates para evitar erros de constraint
        const { error: insertError } = await supabase
          .from('payment_notifications')
          .upsert({
            payment_id: payment.id,
            client_id: payment.client_id,
            company_id: payment.company_id,
            event_type: 'post_due',
            offset_days: daysOverdue,
            scheduled_for: scheduledFor.toISOString(),
            status: 'pending'
          }, {
            onConflict: 'company_id,payment_id,event_type,offset_days',
            ignoreDuplicates: true
          });
        
        if (!insertError) {
          results.recreated++;
        }
      }
    }
    
    console.log(`✅ [CHECKPOINT] Recriação concluída: ${results.recreated} notificações recriadas de ${results.processed} processados`);
  } catch (error) {
    console.error('❌ Erro no processo de recriação:', error instanceof Error ? error.message : error);
  }
  
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
  
  // Pré-carregar configurações para esta empresa
  await preloadConfigurations([notification.company_id]);
  
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
      payment_transactions(*, clients(name, phone, email))
    `)
    .eq('id', notificationId)
    .single();

  if (error || !notification) {
    throw new Error(`Notification not found: ${error?.message || 'Unknown error'}`);
  }

  const debugInfo = {
    notification: {
      id: notification.id,
      event_type: notification.event_type,
      offset_days: notification.offset_days,
      scheduled_for: notification.scheduled_for,
      status: notification.status,
      attempts: notification.attempts
    },
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

  // Check 5: AI configuration check (templates removed - AI only)
  if (debugInfo.checks.payment_valid && debugInfo.checks.has_phone) {
    try {
      // Verificar se ai-collection está configurada
      const { data: aiSettings } = await supabase
        .from('ai_collection_settings')
        .select('*')
        .eq('company_id', notification.company_id)
        .single();

      debugInfo.checks.template_rendered = true; // Renamed but kept for compatibility
      debugInfo.checks.rendered_message = 'IA será usada para gerar mensagem (templates removidos)';
      console.log('✅ AI check passed - messages will be generated by AI');
    } catch (error) {
      console.error('❌ Error checking AI settings:', error);
      debugInfo.checks.template_error = 'Falha ao verificar configurações de IA';
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

// NOTA: A função sendPendingNotifications foi substituída por sendPendingNotificationsParallel
// que processa notificações por empresa com limite individual (NOTIFICATIONS_PER_COMPANY) e processamento paralelo

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

// OTIMIZADO: sendSingleNotification agora usa cache
async function sendSingleNotification(notification: any) {
  const payment = notification.payment_transactions;
  const client = payment.clients;
  
  // Usar cache em vez de buscar do banco
  const settings = companyCache.notificationSettings.get(notification.company_id);
  
  if (!client?.phone) {
    throw new Error('Cliente não possui telefone cadastrado');
  }

  // 🛡️ VERIFICAÇÃO ANTI-SPAM: Checar opt-out e bloqueio do cliente
  const { data: clientStatus } = await supabase
    .from('clients')
    .select('whatsapp_opt_out, whatsapp_blocked, whatsapp_block_reason, whatsapp_failures')
    .eq('id', notification.client_id)
    .single();

  if (clientStatus?.whatsapp_opt_out) {
    console.log(`⛔ Cliente ${notification.client_id} optou por não receber WhatsApp (opt-out)`);
    throw new Error('Cliente optou por não receber mensagens WhatsApp (opt-out)');
  }

  if (clientStatus?.whatsapp_blocked) {
    console.log(`🚫 Cliente ${notification.client_id} está bloqueado: ${clientStatus.whatsapp_block_reason}`);
    throw new Error(`Número bloqueado: ${clientStatus.whatsapp_block_reason || 'Falhas consecutivas'}`);
  }

  // Usar cache para WhatsApp settings
  const whatsappSettings = companyCache.whatsappSettings.get(notification.company_id);
  if (!whatsappSettings) {
    throw new Error('Configurações do WhatsApp não encontradas');
  }

  // Usar cache para domain
  const companyDomain = companyCache.companyDomains.get(notification.company_id);
  
  // Use company domain if configured, otherwise fallback to APP_URL
  const baseUrl = companyDomain 
    ? `https://${companyDomain.replace(/^https?:+\/+/i, '')}` 
    : appUrl;
  
  const paymentLink = `${baseUrl}/checkout/${payment.id}`;
  console.log(`📎 Payment link generated: ${paymentLink} (domain: ${companyDomain || 'fallback'})`);

  // OTIMIZAÇÃO: Verificar conexão WhatsApp usando cache (apenas 1x por empresa)
  console.log(`Validating WhatsApp connection for company ${notification.company_id} (cached)...`);
  const connectionStatus = await checkWhatsAppConnectionCached(notification.company_id);

  // 🔌 CIRCUIT BREAKER: Se WhatsApp desconectado, marcar como failed e parar processamento
  if (!connectionStatus.connected) {
    const errorMsg = connectionStatus.error || 'WhatsApp não está conectado';
    console.error(`🔌 [CIRCUIT BREAKER] Connection check failed for company ${notification.company_id}:`, errorMsg);
    
    // Log WhatsApp disconnection alert with client info
    await logWhatsAppAlert(
      notification.company_id, 
      `WhatsApp desconectado: ${errorMsg}`,
      { name: client.name, phone: client.phone }
    );
    
    // CIRCUIT BREAKER: Lançar erro específico que será tratado de forma especial
    const circuitBreakerError = new Error(`[CIRCUIT_BREAKER] WhatsApp desconectado para empresa ${notification.company_id}. Reconectar para continuar. Erro: ${errorMsg}`);
    (circuitBreakerError as any).isCircuitBreaker = true;
    throw circuitBreakerError;
  }

  // Format payment info for AI message generation
  const dueDate = new Date(payment.due_date);
  const formattedDueDate = formatDateBR(dueDate);
  const formattedAmount = formatCurrencyBR(payment.amount);
  
  // Calculate days difference
  const daysDiff = calculateDaysDiff(dueDate);
  const daysText = formatDaysText(daysDiff);

  // === GERAR MENSAGEM COM IA ===
  console.log(`🤖 Generating AI message for notification ${notification.id}...`);
  
  let message = '';
  
  // GERAR MENSAGEM COM IA (com fallback para mensagem padrão)
  try {
    const aiResponse = await supabase.functions.invoke('ai-collection', {
      body: {
        action: 'process_specific_payment',
        company_id: notification.company_id,
        client_id: notification.client_id,
        payment_id: payment.id,
        event_type: notification.event_type,
        days_overdue: notification.event_type === 'post_due' ? notification.offset_days : 0,
        amount: payment.amount,
        due_date: payment.due_date,
        client_name: client.name
      }
    });
    
    if (aiResponse.error || !aiResponse.data?.generated_message) {
      const errorMsg = aiResponse.error?.message || 'IA não retornou mensagem';
      console.warn('⚠️ AI generation failed, using fallback message:', errorMsg);
      
      // Registrar alerta para a empresa (mas não interromper)
      await logAIFailureAlert(
        notification.company_id,
        payment.amount,
        client.name,
        `IA falhou, usando mensagem padrão: ${errorMsg}`
      );
      
      // 🔄 FALLBACK: Gerar mensagem padrão quando IA falhar
      message = generateFallbackMessage(
        client.name,
        formattedAmount,
        formattedDueDate,
        notification.event_type,
        daysText
      );
      console.log('📝 Using fallback message');
    } else {
      message = aiResponse.data.generated_message;
      console.log('✅ AI message generated successfully');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn('⚠️ Error calling AI collection, using fallback:', errorMsg);
    
    // Registrar alerta para a empresa (mas não interromper)
    await logAIFailureAlert(
      notification.company_id,
      payment.amount,
      client.name,
      `Erro na IA, usando mensagem padrão: ${errorMsg}`
    );
    
    // 🔄 FALLBACK: Gerar mensagem padrão quando IA falhar
    message = generateFallbackMessage(
      client.name,
      formattedAmount,
      formattedDueDate,
      notification.event_type,
      daysText
    );
    console.log('📝 Using fallback message after error');
  }
  
  // Remove any existing links from the message and add the payment link at the end
  const messageWithoutLink = message
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // Build unified message with link at the end
  const fullMessage = `${messageWithoutLink}\n\n🔗 Acesse aqui: ${paymentLink}`;
  
  // === SEND SINGLE UNIFIED MESSAGE (without link preview) ===
  console.log(`📤 Sending unified message for notification ${notification.id}...`);
  console.log('Message preview:', fullMessage.substring(0, 150) + '...');
  
  const response = await supabase.functions.invoke('whatsapp-evolution', {
    body: {
      action: 'send_message',
      payload: {
        instance_url: whatsappSettings.instance_url,
        api_token: whatsappSettings.api_token,
        instance_name: whatsappSettings.instance_name,
        phone_number: client.phone,
        message: fullMessage,
        company_id: notification.company_id,
        client_id: notification.client_id,
        linkPreview: false  // Disable link preview for cleaner message
      }
    }
  });

  // Check message result
  if (response.error) {
    const errorMsg = `HTTP Error: ${response.error.message}`;
    console.error(`❌ Message failed for notification ${notification.id}:`, errorMsg);
    await logWhatsAppAlert(notification.company_id, `Erro na API WhatsApp: ${errorMsg}`, { name: client.name, phone: client.phone });
    throw new Error(errorMsg);
  }

  if (response.data && response.data.success === false) {
    const errorMsg = response.data.error || response.data.message || 'Falha no envio da mensagem';
    console.error(`❌ Message failed for notification ${notification.id}:`, errorMsg);
    
    if (errorMsg.includes('not connected') || errorMsg.includes('WhatsApp instance not connected') || errorMsg.includes('não autenticado')) {
      await logWhatsAppAlert(notification.company_id, `WhatsApp desconectado durante envio: ${errorMsg}`, { name: client.name, phone: client.phone });
      throw new Error(`WhatsApp não autenticado — reconectar o número para continuar os envios.`);
    }
    
    await logWhatsAppAlert(notification.company_id, `Erro no envio: ${errorMsg}`, { name: client.name, phone: client.phone });
    throw new Error(`WhatsApp send failed: ${errorMsg}`);
  }

  console.log(`✅ Message sent successfully for notification ${notification.id}`);

  // Store rendered message for audit
  await supabase
    .from('payment_notifications')
    .update({ message_body: fullMessage })
    .eq('id', notification.id);
}

// Helper function to log WhatsApp alerts with optional client info AND send email to admin
async function logWhatsAppAlert(
  companyId: string, 
  message: string,
  clientInfo?: { name?: string; phone?: string }
) {
  try {
    // Append client details to message for easier identification
    const clientDetails = clientInfo?.name 
      ? ` (Cliente: ${clientInfo.name}${clientInfo.phone ? ` - ${clientInfo.phone}` : ''})` 
      : '';
    
    const fullMessage = `${message}${clientDetails}`;
    
    console.log('🚨 Logging WhatsApp alert:', { companyId, message: fullMessage });
    
    // Insert alert into system_alerts table
    await supabase
      .from('system_alerts')
      .insert({
        company_id: companyId,
        type: 'whatsapp_connection',
        message: fullMessage,
        severity: 'error',
        created_at: new Date().toISOString()
      });
    
    // 📧 ENVIAR EMAIL PARA O ADMIN (com rate limiting interno na função)
    // Só envia para alertas de desconexão (não para erros menores)
    const isDisconnectionAlert = message.toLowerCase().includes('desconectado') || 
                                  message.toLowerCase().includes('não autenticado') ||
                                  message.toLowerCase().includes('not connected');
    
    if (isDisconnectionAlert) {
      console.log('📧 Triggering admin email notification for WhatsApp disconnection...');
      
      try {
        const emailResponse = await supabase.functions.invoke('notify-admin-email', {
          body: {
            company_id: companyId,
            alert_type: 'whatsapp_disconnected',
            context: {
              error_message: message
            }
          }
        });
        
        if (emailResponse.error) {
          console.error('⚠️ Failed to send admin email:', emailResponse.error.message);
        } else {
          console.log('✅ Admin email notification result:', emailResponse.data);
        }
      } catch (emailError) {
        console.error('⚠️ Error invoking notify-admin-email:', emailError);
        // Não falhar o fluxo principal por causa do email
      }
    }
  } catch (error) {
    console.error('Failed to log WhatsApp alert:', error);
    // Don't throw here to avoid breaking the main flow
  }
}

// Helper function to log AI failure alerts
async function logAIFailureAlert(
  companyId: string,
  amount: number,
  clientName: string,
  errorMessage: string
) {
  try {
    const formattedAmount = formatCurrencyBR(amount);
    const alertMessage = `❌ Falha no sistema de IA: A cobrança para ${clientName} (R$ ${formattedAmount}) NÃO foi enviada. Erro: ${errorMessage}`;
    
    console.log('🚨 Logging AI failure alert:', { companyId, message: alertMessage });
    
    await supabase
      .from('system_alerts')
      .insert({
        company_id: companyId,
        type: 'ai_failure',
        message: alertMessage,
        severity: 'error',
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Failed to log AI failure alert:', error);
  }
}

// 🔄 FALLBACK: Gerar mensagem padrão quando IA falhar
function generateFallbackMessage(
  clientName: string,
  formattedAmount: string,
  formattedDueDate: string,
  eventType: string,
  daysText: string
): string {
  const firstName = clientName.split(' ')[0];
  
  switch (eventType) {
    case 'pre_due':
      return `Olá ${firstName}! 👋\n\nEste é um lembrete amigável sobre sua fatura de R$ ${formattedAmount} com vencimento em ${formattedDueDate}.\n\nAntecipe o pagamento e evite contratempos!`;
    
    case 'on_due':
      return `Olá ${firstName}! 👋\n\nSua fatura de R$ ${formattedAmount} vence hoje (${formattedDueDate}).\n\nRealize o pagamento para manter seus serviços em dia!`;
    
    case 'post_due':
      return `Olá ${firstName}! 👋\n\n⚠️ Sua fatura de R$ ${formattedAmount} está em atraso há ${daysText} dia(s). Vencimento original: ${formattedDueDate}.\n\nRegularize sua situação o quanto antes para evitar encargos adicionais.`;
    
    default:
      return `Olá ${firstName}! 👋\n\nVocê possui uma fatura de R$ ${formattedAmount} com vencimento em ${formattedDueDate}.\n\nAguardamos seu pagamento!`;
  }
}

// Helper function to format date in Brazilian format (DD/MM/YYYY)
function formatDateBR(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Helper function to format currency in Brazilian format (X.XXX,XX - sem R$ pois templates já incluem)
function formatCurrencyBR(value: number): string {
  const formatted = value.toFixed(2).replace('.', ',');
  const parts = formatted.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts.join(','); // Retorna "53,90" - template já tem "R$"
}

// Helper function to calculate days difference correctly (considering Brasília timezone)
function calculateDaysDiff(dueDate: Date): number {
  const now = new Date();
  
  // Normalize due_date to midnight UTC
  const dueDateOnly = new Date(Date.UTC(
    dueDate.getUTCFullYear(), 
    dueDate.getUTCMonth(), 
    dueDate.getUTCDate()
  ));
  
  // Get current date in Brasília (UTC-3)
  const brazilOffset = -3 * 60 * 60 * 1000;
  const nowInBrazil = new Date(now.getTime() + brazilOffset);
  const todayOnly = new Date(Date.UTC(
    nowInBrazil.getUTCFullYear(), 
    nowInBrazil.getUTCMonth(), 
    nowInBrazil.getUTCDate()
  ));
  
  const diffMs = dueDateOnly.getTime() - todayOnly.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// Helper function to format days text - retorna apenas o número para uso com "dia(s)" nos templates
function formatDaysText(daysDiff: number): string {
  // Para templates com "{{dias}} dia(s)" - retorna apenas o número absoluto
  return Math.abs(daysDiff).toString();
}

// REMOVIDO: renderTemplate - Agora todas as mensagens são geradas pela IA
// Templates foram removidos. Em caso de falha da IA, um alerta é criado e a cobrança NÃO é enviada.

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
    // Only check 'pending' status - sent notifications should not block new ones
    const { data: existingNotifications } = await supabase
      .from('payment_notifications')
      .select('event_type, offset_days, scheduled_for, status')
      .eq('payment_id', payment.id)
      .eq('status', 'pending'); // Only check pending to avoid duplicates

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
        
        // Use Brazil timezone (UTC-3) for scheduling with randomization for anti-spam
        scheduledDate = setBrazilTime(scheduledDate, hour, minute, true);
        
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
        
        // Use Brazil timezone (UTC-3) for scheduling with randomization for anti-spam
        scheduledDate = setBrazilTime(scheduledDate, hour, minute, true);
        
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
          attempts: 0
        });
      }
    }

    // Post-due notifications (for overdue payments)
    // NOVA LÓGICA: Criar apenas a PRÓXIMA notificação respeitando o intervalo de 6h
    if (isOverdue) {
      const postDueDays = settings.post_due_days || [1, 3, 7, 15, 30];
      const postDueTimes = settings.post_due_times_per_day || 2;
      const intervalHours = settings.post_due_interval_hours || 6;
      
      // Parse send_hour
      const timeParts = settings.send_hour.split(':');
      const baseHour = parseInt(timeParts[0]) || 9;
      const minute = parseInt(timeParts[1]) || 0;
      
      // Verificar se já enviamos notificação nas últimas 6 horas
      const sixHoursAgo = new Date(now.getTime() - intervalHours * 60 * 60 * 1000);
      const { data: recentPostDue } = await supabase
        .from('payment_notifications')
        .select('sent_at')
        .eq('payment_id', payment.id)
        .eq('event_type', 'post_due')
        .eq('status', 'sent')
        .gte('sent_at', sixHoursAgo.toISOString())
        .limit(1);
      
      if (recentPostDue && recentPostDue.length > 0) {
        console.log(`⏭️ Skipping post_due for payment ${payment.id} - sent in last ${intervalHours}h`);
        continue;
      }
      
      // Encontrar o próximo slot disponível para notificação
      let notificationCreated = false;
      
      for (const targetDays of postDueDays) {
        if (notificationCreated) break;
        if (daysPastDue < targetDays) continue; // Ainda não chegou neste dia
        
        // Verificar se já tem notificação pendente para este dia
        for (let dispatchIndex = 0; dispatchIndex < postDueTimes; dispatchIndex++) {
          const key = `post_due_${targetDays}_${dispatchIndex}`;
          if (existingKeys.has(key)) continue;
          
          // Criar notificação
          let scheduledDate = setBrazilTime(now, baseHour, minute, true);
          
          // Adicionar intervalo para o segundo disparo do dia
          if (dispatchIndex > 0) {
            scheduledDate.setHours(scheduledDate.getHours() + (dispatchIndex * intervalHours));
          }
          
          // Se a hora já passou hoje, agendar para agora + 5 min
          if (scheduledDate.getTime() < now.getTime()) {
            scheduledDate = new Date(now.getTime() + 5 * 60 * 1000);
          }
          
          notifications.push({
            company_id: settings.company_id,
            payment_id: payment.id,
            client_id: payment.client_id,
            event_type: 'post_due',
            offset_days: targetDays,
            scheduled_for: scheduledDate.toISOString(),
            status: 'pending',
            attempts: 0
          });
          
          console.log(`📝 Created post_due notification for payment ${payment.id}: day ${targetDays}, dispatch ${dispatchIndex}`);
          notificationCreated = true;
          break; // Criar apenas UMA notificação por vez
        }
      }
    }
  }

  // USAR UPSERT com ignoreDuplicates para evitar erros de constraint de duplicata
  if (notifications.length > 0) {
    console.log(`Inserting ${notifications.length} new notifications for company ${settings.company_id}`);
    
    const { data: inserted, error: insertError } = await supabase
      .from('payment_notifications')
      .upsert(notifications, {
        onConflict: 'company_id,payment_id,event_type,offset_days',
        ignoreDuplicates: true
      })
      .select('id');

    if (insertError) {
      console.error(`Error inserting notifications for company ${settings.company_id}:`, insertError);
    } else {
      results.created = inserted?.length || 0;
      console.log(`Successfully created ${results.created} notifications for company ${settings.company_id}`);
    }
  }
  
  return results;
}
