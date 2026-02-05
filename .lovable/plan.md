

# Plano: Implementar Alteração de Vencimento de Cobranças

## Situação Atual

Atualmente, para alterar a data de vencimento de uma cobrança, é necessário:
1. Cancelar a cobrança existente
2. Criar uma nova cobrança com a nova data

Isso é trabalhoso e pode perder o histórico/rastreabilidade da cobrança original.

## Solução Proposta

Implementar uma funcionalidade de **"Alterar Vencimento"** diretamente na interface, que:

1. Atualiza a data de vencimento no banco local
2. Atualiza a cobrança no gateway de pagamento (Asaas, se integrado)
3. Reagenda as notificações automáticas
4. Mantém o ID original da cobrança (rastreabilidade)

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (BillingActions)                 │
│   [Novo botão "Alterar Vencimento" com ícone de calendário] │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              billing-management Edge Function                │
│   action: 'update_due_date'                                 │
│   - Valida nova data (não pode ser no passado)              │
│   - Atualiza payment_transactions.due_date                  │
│   - Se external_id existir → atualiza no Asaas              │
│   - Reagenda payment_notifications                          │
└─────────────────────────────┬───────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Banco Local   │  │   API Asaas     │  │  Notificações   │
│ payment_trans.  │  │ PUT /payments   │  │ Reagendamento   │
│   due_date      │  │    {dueDate}    │  │  automático     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/billing-management/index.ts` | Adicionar action `update_due_date` |
| `supabase/functions/asaas-integration/index.ts` | Adicionar action `update_charge` para atualizar cobrança |
| `src/hooks/useBillingManagement.ts` | Adicionar função `updateDueDate` |
| `src/components/billing/BillingActions.tsx` | Adicionar botão e dialog para alterar vencimento |

## Implementação Detalhada

### 1. Nova Action no billing-management

```typescript
case 'update_due_date': {
  const { new_due_date, reason } = data;
  
  if (!payment_id || !new_due_date) {
    throw new Error('Payment ID e nova data são obrigatórios');
  }

  // Validar que a nova data não está no passado
  const newDate = new Date(new_due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (newDate < today) {
    throw new Error('A nova data de vencimento não pode estar no passado');
  }

  // Buscar cobrança
  const { data: payment } = await supabase
    .from('payment_transactions')
    .select('id, external_id, due_date, status')
    .eq('id', payment_id)
    .eq('company_id', userCompanyId)
    .single();

  if (!payment) throw new Error('Cobrança não encontrada');

  // Não permitir alterar cobranças pagas
  if (payment.status === 'paid') {
    throw new Error('Não é possível alterar vencimento de cobranças pagas');
  }

  // 1. Atualizar no banco local
  await supabase
    .from('payment_transactions')
    .update({
      due_date: new_due_date,
      status: newDate < today ? 'overdue' : 'pending',
      updated_at: new Date().toISOString()
    })
    .eq('id', payment_id);

  // 2. Se tiver cobrança no Asaas, atualizar lá também
  if (payment.external_id) {
    await supabaseService.functions.invoke('asaas-integration', {
      body: {
        action: 'update_charge',
        company_id: userCompanyId,
        data: {
          chargeId: payment.external_id,
          dueDate: new_due_date
        }
      }
    });
  }

  // 3. Reagendar notificações (deletar antigas e criar novas)
  await supabaseService
    .from('payment_notifications')
    .delete()
    .eq('payment_id', payment_id)
    .eq('status', 'pending');

  // Criar novas notificações baseadas na nova data...

  return new Response(
    JSON.stringify({ success: true, message: 'Vencimento atualizado' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### 2. Nova Action no asaas-integration

```typescript
case 'update_charge':
  return await updateCharge(supabaseClient, companyId, data)

// Nova função
async function updateCharge(supabaseClient: any, companyId: string, data: any) {
  console.log('Atualizando cobrança no Asaas:', data.chargeId);
  
  const settings = await getAsaasSettings(supabaseClient, companyId);
  
  const updateData: any = {};
  if (data.dueDate) updateData.dueDate = data.dueDate;
  if (data.value) updateData.value = data.value;
  if (data.description) updateData.description = data.description;

  const responseData = await makeAsaasRequest(
    `${settings.base_url}/payments/${data.chargeId}`,
    {
      method: 'POST', // Asaas usa POST para update
      headers: {
        'access_token': settings.api_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    }
  );

  return new Response(
    JSON.stringify({ success: true, charge: responseData }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### 3. Hook useBillingManagement

```typescript
const updateDueDate = async (paymentId: string, newDueDate: string, reason?: string) => {
  setLoading(true);
  try {
    const { data, error } = await supabase.functions.invoke('billing-management', {
      body: {
        action: 'update_due_date',
        payment_id: paymentId,
        data: { new_due_date: newDueDate, reason }
      }
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Falha ao atualizar vencimento');

    toast({
      title: "Sucesso",
      description: "Data de vencimento atualizada!"
    });

    return data;
  } catch (error: any) {
    toast({
      title: "Erro",
      description: error.message,
      variant: "destructive"
    });
    throw error;
  } finally {
    setLoading(false);
  }
};
```

### 4. Componente BillingActions

Adicionar novo botão com ícone de calendário e dialog para selecionar nova data:

```tsx
// Novo estado
const [showDueDateDialog, setShowDueDateDialog] = useState(false);
const [newDueDate, setNewDueDate] = useState<Date | undefined>();

// Novo botão (apenas para cobranças pendentes/vencidas)
{payment.status !== 'paid' && payment.status !== 'cancelled' && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button 
        size="icon" 
        variant="ghost" 
        className="h-8 w-8 text-amber-600 hover:text-amber-700"
        onClick={() => {
          setNewDueDate(payment.due_date ? new Date(payment.due_date) : undefined);
          setShowDueDateDialog(true);
        }}
      >
        <CalendarDays className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Alterar vencimento</TooltipContent>
  </Tooltip>
)}

// Dialog para selecionar nova data
<Dialog open={showDueDateDialog} onOpenChange={setShowDueDateDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Alterar Vencimento</DialogTitle>
      <DialogDescription>
        Selecione a nova data de vencimento para esta cobrança.
      </DialogDescription>
    </DialogHeader>
    
    <div className="py-4">
      <Calendar
        mode="single"
        selected={newDueDate}
        onSelect={setNewDueDate}
        disabled={(date) => date < new Date()}
        initialFocus
      />
    </div>
    
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowDueDateDialog(false)}>
        Cancelar
      </Button>
      <Button onClick={handleUpdateDueDate} disabled={!newDueDate || loading}>
        Confirmar
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Fluxo do Usuário

1. Usuário clica no ícone de **calendário** na linha da cobrança
2. Abre dialog com **calendário** para selecionar nova data
3. Datas passadas ficam **desabilitadas**
4. Ao confirmar:
   - Banco local é atualizado
   - Gateway (Asaas) é atualizado (se aplicável)
   - Notificações são reagendadas
   - Toast de sucesso aparece

## Validações de Segurança

| Validação | Descrição |
|-----------|-----------|
| Data futura | Não permite selecionar datas passadas |
| Status | Não permite alterar cobranças pagas ou canceladas |
| Permissão | Verifica se o usuário pertence à empresa da cobrança |
| Protesto | Não permite alterar cobranças protestadas |

## Impacto

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Passos para alterar | Cancelar + Criar nova (2 ações) | 1 clique + selecionar data |
| Histórico | Perdido (nova cobrança) | Mantido (mesmo ID) |
| Notificações | Manuais | Reagendadas automaticamente |
| Gateway | Manual | Sincronizado automaticamente |

## Etapas de Implementação

1. Adicionar action `update_charge` no `asaas-integration`
2. Adicionar action `update_due_date` no `billing-management`
3. Adicionar função `updateDueDate` no hook `useBillingManagement`
4. Adicionar botão e dialog no `BillingActions`
5. Deploy das edge functions
6. Testar fluxo completo

