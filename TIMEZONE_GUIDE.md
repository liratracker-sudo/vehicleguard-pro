# Guia de Uso do Fuso Horário de Brasília

Toda a aplicação foi configurada para trabalhar no **fuso horário de Brasília (UTC-3)**.

## 📚 Bibliotecas Disponíveis

### Frontend: `src/lib/timezone.ts`
### Backend: `supabase/functions/_shared/timezone.ts`

## 🔧 Funções Principais

### Conversão de Datas

```typescript
import { toBrasiliaTime, toUTC, nowInBrasilia } from '@/lib/timezone';

// Obter hora atual em Brasília
const agora = nowInBrasilia();

// Converter UTC para Brasília
const utcDate = new Date('2025-10-09T12:00:00Z');
const brasiliaDate = toBrasiliaTime(utcDate);

// Converter Brasília para UTC (para salvar no banco)
const brasiliaDate = new Date('2025-10-09 09:00:00');
const utcDate = toUTC(brasiliaDate);
```

### Formatação de Datas

```typescript
import { formatDateBR, formatDateTimeBR, formatTimeBR } from '@/lib/timezone';

const data = new Date();

// Formato brasileiro: DD/MM/YYYY
console.log(formatDateBR(data)); // "09/10/2025"

// Data e hora: DD/MM/YYYY HH:mm
console.log(formatDateTimeBR(data)); // "09/10/2025 14:30"

// Apenas hora: HH:mm
console.log(formatTimeBR(data)); // "14:30"
```

### Cálculos de Data

```typescript
import { daysUntil, daysSince, isOverdue } from '@/lib/timezone';

// Quantos dias até vencer
const diasAteVencimento = daysUntil('2025-10-15');

// Quantos dias desde uma data
const diasEmAtraso = daysSince('2025-10-01');

// Verificar se está vencido
const vencido = isOverdue('2025-10-01'); // true/false
```

## 🎨 Componentes React

### Exibir Datas

```tsx
import { DateDisplay } from '@/components/common/DateDisplay';

// Em seu componente
<DateDisplay date={payment.due_date} format="date" />
<DateDisplay date={payment.created_at} format="datetime" />
<DateDisplay date={notification.sent_at} format="time" />
```

### Hook de Horário Atual

```tsx
import { useBrasiliaTime } from '@/hooks/useBrasiliaTime';

function MyComponent() {
  const { currentTime, formatted } = useBrasiliaTime();
  
  return <div>Horário de Brasília: {formatted}</div>;
}
```

## 🗄️ Trabalhando com Banco de Dados

### Importante!
- **O banco sempre armazena em UTC**
- **Sempre converta para UTC antes de salvar**
- **Sempre converta de UTC ao exibir**

```typescript
import { toUTC, toBrasiliaTime } from '@/lib/timezone';

// Salvando no banco
const scheduledFor = toUTC(new Date('2025-10-09 09:00:00'));
await supabase.from('table').insert({
  scheduled_for: scheduledFor.toISOString()
});

// Lendo do banco
const { data } = await supabase.from('table').select('*').single();
const brasiliaTime = toBrasiliaTime(data.scheduled_for);
```

## 🔧 Edge Functions

```typescript
import { nowInBrasilia, toISODateTimeBR } from "../_shared/timezone.ts";

// Usar em suas edge functions
const agora = nowInBrasilia();
const dataFormatada = toISODateTimeBR(agora);
console.log('Horário de Brasília:', dataFormatada);
```

## ⚠️ Boas Práticas

1. **NUNCA use `new Date()` diretamente para lógica de negócio**
   - Use `nowInBrasilia()` para obter a hora atual
   
2. **SEMPRE converta ao exibir datas do banco**
   ```typescript
   // ❌ ERRADO
   <span>{payment.due_date}</span>
   
   // ✅ CORRETO
   <DateDisplay date={payment.due_date} format="date" />
   ```

3. **SEMPRE converta para UTC antes de salvar**
   ```typescript
   // ❌ ERRADO
   scheduled_for: new Date('2025-10-09 09:00:00')
   
   // ✅ CORRETO
   scheduled_for: toUTC(new Date('2025-10-09 09:00:00')).toISOString()
   ```

4. **Use os componentes e hooks fornecidos**
   - Evite reinventar a roda
   - Mantenha consistência na aplicação

## 🎯 Exemplos Práticos

### Calcular se pagamento está vencido

```typescript
import { isOverdue, daysSince } from '@/lib/timezone';

const payment = { due_date: '2025-10-01', status: 'pending' };

if (isOverdue(payment.due_date)) {
  const dias = daysSince(payment.due_date);
  console.log(`Pagamento vencido há ${dias} dias`);
}
```

### Agendar notificação para amanhã

```typescript
import { nowInBrasilia, toUTC } from '@/lib/timezone';

const amanha = new Date(nowInBrasilia());
amanha.setDate(amanha.getDate() + 1);
amanha.setHours(9, 0, 0, 0); // 09:00

const utcDate = toUTC(amanha);

await supabase.from('scheduled_reminders').insert({
  scheduled_for: utcDate.toISOString(),
  // ...outros campos
});
```

## 📝 Notas Importantes

- O servidor Supabase usa UTC
- Toda conversão é feita automaticamente pelos utilitários
- Datas no banco = UTC
- Datas exibidas = Horário de Brasília
- A diferença entre UTC e Brasília é **sempre -3 horas**
