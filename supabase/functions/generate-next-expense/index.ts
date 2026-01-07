import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function calculateNextDueDate(currentDueDate: string, recurrenceType: string): string {
  const date = new Date(currentDueDate + 'T12:00:00Z');
  const originalDay = date.getUTCDate();

  switch (recurrenceType) {
    case 'monthly':
      date.setUTCMonth(date.getUTCMonth() + 1);
      break;
    case 'quarterly':
      date.setUTCMonth(date.getUTCMonth() + 3);
      break;
    case 'yearly':
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      break;
    default:
      return currentDueDate;
  }

  // Adjust day if it rolled over (e.g., Jan 31 -> Feb 28)
  if (date.getUTCDate() !== originalDay) {
    date.setUTCDate(0); // Last day of previous month
  }

  return date.toISOString().split('T')[0];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { expense_id } = await req.json();

    if (!expense_id) {
      return new Response(
        JSON.stringify({ error: 'expense_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[generate-next-expense] Processing expense: ${expense_id}`);

    // Fetch the expense
    const { data: expense, error: fetchError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', expense_id)
      .single();

    if (fetchError || !expense) {
      console.error('[generate-next-expense] Expense not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Expense not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expense is recurring
    if (!expense.recurrence_type || expense.recurrence_type === 'none') {
      console.log('[generate-next-expense] Expense is not recurring');
      return new Response(
        JSON.stringify({ message: 'Expense is not recurring', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate next due date
    const nextDueDate = calculateNextDueDate(expense.due_date, expense.recurrence_type);
    console.log(`[generate-next-expense] Next due date: ${nextDueDate}`);

    // Check if a pending expense already exists for this period
    const parentId = expense.recurrence_parent_id || expense.id;
    const { data: existingExpense } = await supabase
      .from('expenses')
      .select('id')
      .eq('company_id', expense.company_id)
      .eq('due_date', nextDueDate)
      .eq('status', 'pending')
      .or(`recurrence_parent_id.eq.${parentId},id.eq.${parentId}`)
      .maybeSingle();

    if (existingExpense) {
      console.log('[generate-next-expense] Expense already exists for next period');
      return new Response(
        JSON.stringify({ message: 'Expense already exists for next period', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the next expense
    const newExpense = {
      company_id: expense.company_id,
      description: expense.description,
      amount: expense.amount,
      due_date: nextDueDate,
      status: 'pending',
      category_id: expense.category_id,
      supplier_name: expense.supplier_name,
      notes: expense.notes,
      recurrence_type: expense.recurrence_type,
      recurrence_parent_id: parentId,
    };

    const { data: createdExpense, error: createError } = await supabase
      .from('expenses')
      .insert(newExpense)
      .select()
      .single();

    if (createError) {
      console.error('[generate-next-expense] Error creating expense:', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to create next expense', details: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-next-expense] Created next expense: ${createdExpense.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        new_expense_id: createdExpense.id,
        next_due_date: nextDueDate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-next-expense] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
