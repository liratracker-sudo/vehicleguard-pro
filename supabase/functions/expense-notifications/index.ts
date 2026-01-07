import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExpenseNotificationSettings {
  id: string
  company_id: string
  is_active: boolean
  pre_due_days: number[]
  notify_on_due: boolean
  post_due_days: number[]
  send_hour: string
  template_pre_due: string
  template_on_due: string
  template_post_due: string
  send_daily_summary: boolean
}

interface Expense {
  id: string
  company_id: string
  description: string
  amount: number
  due_date: string
  status: string
  supplier_name: string | null
}

interface Manager {
  phone: string | null
  full_name: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('[expense-notifications] Starting expense notification check...')

    // Get all companies with active expense notification settings
    const { data: allSettings, error: settingsError } = await supabase
      .from('expense_notification_settings')
      .select('*')
      .eq('is_active', true)

    if (settingsError) {
      console.error('[expense-notifications] Error fetching settings:', settingsError)
      throw settingsError
    }

    if (!allSettings || allSettings.length === 0) {
      console.log('[expense-notifications] No active notification settings found')
      return new Response(
        JSON.stringify({ success: true, message: 'No active settings' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[expense-notifications] Found ${allSettings.length} companies with active settings`)

    const results = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const settings of allSettings as ExpenseNotificationSettings[]) {
      const companyId = settings.company_id
      console.log(`[expense-notifications] Processing company: ${companyId}`)

      // Get managers (admin profiles) for this company
      const { data: managers, error: managersError } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('company_id', companyId)
        .eq('role', 'admin')
        .eq('is_active', true)

      if (managersError) {
        console.error(`[expense-notifications] Error fetching managers for company ${companyId}:`, managersError)
        continue
      }

      // Filter managers with valid phone numbers
      const validManagers = (managers as Manager[])?.filter(m => m.phone && m.phone.length >= 10) || []

      if (validManagers.length === 0) {
        console.log(`[expense-notifications] No managers with valid phone for company ${companyId}`)
        continue
      }

      console.log(`[expense-notifications] Found ${validManagers.length} managers for company ${companyId}`)

      // Get pending expenses for this company
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('id, company_id, description, amount, due_date, status, supplier_name')
        .eq('company_id', companyId)
        .eq('status', 'pending')

      if (expensesError) {
        console.error(`[expense-notifications] Error fetching expenses for company ${companyId}:`, expensesError)
        continue
      }

      if (!expenses || expenses.length === 0) {
        console.log(`[expense-notifications] No pending expenses for company ${companyId}`)
        continue
      }

      console.log(`[expense-notifications] Found ${expenses.length} pending expenses for company ${companyId}`)

      // Categorize expenses
      const preDueExpenses: { expense: Expense; days: number }[] = []
      const onDueExpenses: Expense[] = []
      const postDueExpenses: { expense: Expense; days: number }[] = []

      for (const expense of expenses as Expense[]) {
        const dueDate = new Date(expense.due_date + 'T00:00:00')
        const diffTime = dueDate.getTime() - today.getTime()
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

        if (diffDays > 0 && settings.pre_due_days.includes(diffDays)) {
          preDueExpenses.push({ expense, days: diffDays })
        } else if (diffDays === 0 && settings.notify_on_due) {
          onDueExpenses.push(expense)
        } else if (diffDays < 0 && settings.post_due_days.includes(Math.abs(diffDays))) {
          postDueExpenses.push({ expense, days: Math.abs(diffDays) })
        }
      }

      console.log(`[expense-notifications] Company ${companyId}: ${preDueExpenses.length} pre-due, ${onDueExpenses.length} on-due, ${postDueExpenses.length} post-due`)

      // Get WhatsApp settings for the company
      const { data: whatsappSettings, error: wpError } = await supabase
        .from('whatsapp_settings')
        .select('instance_name, api_token_encrypted')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .single()

      if (wpError || !whatsappSettings) {
        console.log(`[expense-notifications] No WhatsApp settings for company ${companyId}`)
        continue
      }

      // Send daily summary if enabled
      if (settings.send_daily_summary) {
        const summaryMessage = buildDailySummary(expenses as Expense[], today, validManagers[0]?.full_name || 'Gestor')
        
        if (summaryMessage) {
          for (const manager of validManagers) {
            await sendNotification(
              supabase,
              companyId,
              null,
              'daily_summary',
              manager.phone!,
              manager.full_name,
              summaryMessage,
              whatsappSettings.instance_name,
              whatsappSettings.api_token_encrypted
            )
          }
        }
      }

      // Send individual notifications
      for (const { expense, days } of preDueExpenses) {
        const message = formatTemplate(settings.template_pre_due, expense, days)
        for (const manager of validManagers) {
          await sendNotification(
            supabase,
            companyId,
            expense.id,
            'pre_due',
            manager.phone!,
            manager.full_name,
            message,
            whatsappSettings.instance_name,
            whatsappSettings.api_token_encrypted
          )
        }
      }

      for (const expense of onDueExpenses) {
        const message = formatTemplate(settings.template_on_due, expense, 0)
        for (const manager of validManagers) {
          await sendNotification(
            supabase,
            companyId,
            expense.id,
            'on_due',
            manager.phone!,
            manager.full_name,
            message,
            whatsappSettings.instance_name,
            whatsappSettings.api_token_encrypted
          )
        }
      }

      for (const { expense, days } of postDueExpenses) {
        const message = formatTemplate(settings.template_post_due, expense, days)
        for (const manager of validManagers) {
          await sendNotification(
            supabase,
            companyId,
            expense.id,
            'post_due',
            manager.phone!,
            manager.full_name,
            message,
            whatsappSettings.instance_name,
            whatsappSettings.api_token_encrypted
          )
        }
      }

      results.push({
        companyId,
        preDue: preDueExpenses.length,
        onDue: onDueExpenses.length,
        postDue: postDueExpenses.length,
        managers: validManagers.length
      })
    }

    console.log('[expense-notifications] Completed processing all companies')

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[expense-notifications] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function formatTemplate(template: string, expense: Expense, days: number): string {
  const formattedDate = new Date(expense.due_date + 'T00:00:00').toLocaleDateString('pt-BR')
  const formattedAmount = expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  
  return template
    .replace(/\{\{descricao\}\}/g, expense.description)
    .replace(/\{\{valor\}\}/g, formattedAmount)
    .replace(/\{\{dias\}\}/g, days.toString())
    .replace(/\{\{vencimento\}\}/g, formattedDate)
    .replace(/\{\{fornecedor\}\}/g, expense.supplier_name || '')
}

function buildDailySummary(expenses: Expense[], today: Date, managerName: string): string | null {
  let todayCount = 0
  let todayTotal = 0
  let next3DaysCount = 0
  let next3DaysTotal = 0
  let overdueCount = 0
  let overdueTotal = 0

  for (const expense of expenses) {
    const dueDate = new Date(expense.due_date + 'T00:00:00')
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      todayCount++
      todayTotal += expense.amount
    } else if (diffDays > 0 && diffDays <= 3) {
      next3DaysCount++
      next3DaysTotal += expense.amount
    } else if (diffDays < 0) {
      overdueCount++
      overdueTotal += expense.amount
    }
  }

  // Only send summary if there's something to report
  if (todayCount === 0 && next3DaysCount === 0 && overdueCount === 0) {
    return null
  }

  const formatMoney = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const todayDate = today.toLocaleDateString('pt-BR')

  let message = `📊 *Resumo de Contas a Pagar*\n`
  message += `📅 ${todayDate}\n\n`

  if (todayCount > 0) {
    message += `🔔 *Vence Hoje:* ${todayCount} conta(s) (R$ ${formatMoney(todayTotal)})\n`
  }
  if (next3DaysCount > 0) {
    message += `⚠️ *Próximos 3 dias:* ${next3DaysCount} conta(s) (R$ ${formatMoney(next3DaysTotal)})\n`
  }
  if (overdueCount > 0) {
    message += `🚨 *Vencidas:* ${overdueCount} conta(s) (R$ ${formatMoney(overdueTotal)})\n`
  }

  const totalPending = todayTotal + next3DaysTotal + overdueTotal
  message += `\n💰 *Total Pendente:* R$ ${formatMoney(totalPending)}`

  return message
}

async function sendNotification(
  supabase: any,
  companyId: string,
  expenseId: string | null,
  notificationType: string,
  recipientPhone: string,
  recipientName: string | null,
  message: string,
  instanceName: string,
  apiTokenEncrypted: string
): Promise<boolean> {
  try {
    // Log the notification
    const { data: logEntry, error: logError } = await supabase
      .from('expense_notification_logs')
      .insert({
        company_id: companyId,
        expense_id: expenseId,
        notification_type: notificationType,
        recipient_phone: recipientPhone,
        recipient_name: recipientName,
        message: message,
        status: 'pending'
      })
      .select('id')
      .single()

    if (logError) {
      console.error('[expense-notifications] Error logging notification:', logError)
    }

    // Send via WhatsApp Evolution
    const evolutionUrl = Deno.env.get('WHATSAPP_EVOLUTION_URL')
    const evolutionToken = Deno.env.get('WHATSAPP_EVOLUTION_TOKEN')

    if (!evolutionUrl || !evolutionToken) {
      console.error('[expense-notifications] Missing WhatsApp Evolution credentials')
      if (logEntry) {
        await supabase
          .from('expense_notification_logs')
          .update({ status: 'failed', error_message: 'Missing WhatsApp Evolution credentials' })
          .eq('id', logEntry.id)
      }
      return false
    }

    // Normalize phone number
    let normalizedPhone = recipientPhone.replace(/\D/g, '')
    if (normalizedPhone.length === 11 && normalizedPhone.startsWith('9')) {
      normalizedPhone = '55' + normalizedPhone
    } else if (normalizedPhone.length === 10 || normalizedPhone.length === 11) {
      normalizedPhone = '55' + normalizedPhone
    }

    const sendUrl = `${evolutionUrl}/message/sendText/${instanceName}`
    
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionToken
      },
      body: JSON.stringify({
        number: normalizedPhone,
        text: message
      })
    })

    const result = await response.json()

    if (response.ok) {
      console.log(`[expense-notifications] Message sent to ${normalizedPhone}`)
      if (logEntry) {
        await supabase
          .from('expense_notification_logs')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', logEntry.id)
      }
      return true
    } else {
      console.error(`[expense-notifications] Failed to send message:`, result)
      if (logEntry) {
        await supabase
          .from('expense_notification_logs')
          .update({ status: 'failed', error_message: JSON.stringify(result) })
          .eq('id', logEntry.id)
      }
      return false
    }

  } catch (error) {
    console.error('[expense-notifications] Error sending notification:', error)
    return false
  }
}
