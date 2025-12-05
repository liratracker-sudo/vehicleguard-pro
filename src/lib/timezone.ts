/**
 * Utilitários para trabalhar com fuso horário de Brasília (UTC-3)
 */

const BRASILIA_OFFSET = -3 * 60; // -3 horas em minutos

/**
 * Converte uma data UTC para o horário de Brasília
 */
export function toBrasiliaTime(utcDate: Date | string): Date {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return new Date(date.getTime() + BRASILIA_OFFSET * 60 * 1000);
}

/**
 * Converte uma data do horário de Brasília para UTC
 */
export function toUTC(brasiliaDate: Date | string): Date {
  const date = typeof brasiliaDate === 'string' ? new Date(brasiliaDate) : brasiliaDate;
  return new Date(date.getTime() - BRASILIA_OFFSET * 60 * 1000);
}

/**
 * Retorna a data/hora atual no horário de Brasília
 */
export function nowInBrasilia(): Date {
  return toBrasiliaTime(new Date());
}

/**
 * Formata uma data no padrão brasileiro (DD/MM/YYYY)
 * Para strings "YYYY-MM-DD", extrai diretamente sem conversão de timezone
 */
export function formatDateBR(date: Date | string | null): string {
  if (!date) return '-';
  
  // Para strings no formato "YYYY-MM-DD", extrair diretamente sem conversão
  if (typeof date === 'string') {
    const datePart = date.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }
  
  // Para objetos Date, usar Intl.DateTimeFormat para consistência com Brasília
  const formatter = new Intl.DateTimeFormat('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  });
  return formatter.format(date);
}

/**
 * Formata data e hora no padrão brasileiro (DD/MM/YYYY HH:mm)
 * Para strings com data e hora, usa Intl.DateTimeFormat
 */
export function formatDateTimeBR(date: Date | string | null): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Usar Intl.DateTimeFormat para formatação consistente em Brasília
  const formatter = new Intl.DateTimeFormat('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return formatter.format(d);
}

/**
 * Formata apenas a hora no padrão brasileiro (HH:mm)
 */
export function formatTimeBR(date: Date | string | null): string {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Usar Intl.DateTimeFormat para formatação consistente em Brasília
  const formatter = new Intl.DateTimeFormat('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return formatter.format(d);
}

/**
 * Retorna a data no formato ISO (YYYY-MM-DD)
 * Para strings "YYYY-MM-DD", extrai diretamente sem conversão de timezone
 */
export function toISODateBR(date: Date | string): string {
  // Para strings no formato "YYYY-MM-DD", extrair diretamente sem conversão
  if (typeof date === 'string') {
    return date.split('T')[0];
  }
  
  // Para objetos Date, usar Intl.DateTimeFormat para consistência com Brasília
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit'
  });
  return formatter.format(date);
}

/**
 * Retorna a data e hora no formato ISO mas no horário de Brasília (YYYY-MM-DD HH:mm:ss)
 */
export function toISODateTimeBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const brasiliaDate = toBrasiliaTime(d);
  
  const year = brasiliaDate.getFullYear();
  const month = String(brasiliaDate.getMonth() + 1).padStart(2, '0');
  const day = String(brasiliaDate.getDate()).padStart(2, '0');
  const hours = String(brasiliaDate.getHours()).padStart(2, '0');
  const minutes = String(brasiliaDate.getMinutes()).padStart(2, '0');
  const seconds = String(brasiliaDate.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Calcula quantos dias faltam até uma data (considerando horário de Brasília)
 * Compara apenas as datas (sem considerar hora)
 * Usa Intl.DateTimeFormat para obter a data de Brasília independente do timezone do browser
 */
export function daysUntil(targetDate: Date | string): number {
  // Usa Intl.DateTimeFormat para pegar a data atual em Brasília de forma confiável
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit'
  });
  const todayStr = formatter.format(new Date()); // Retorna "YYYY-MM-DD"
  const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);
  const todayUTC = Date.UTC(todayYear, todayMonth - 1, todayDay);
  
  // Parse da data alvo em UTC
  let targetUTC: number;
  if (typeof targetDate === 'string') {
    // Para strings no formato "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm:ss"
    const datePart = targetDate.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    targetUTC = Date.UTC(year, month - 1, day);
  } else {
    // Para objetos Date, também formata em Brasília para consistência
    const targetStr = formatter.format(targetDate);
    const [year, month, day] = targetStr.split('-').map(Number);
    targetUTC = Date.UTC(year, month - 1, day);
  }
  
  // Calcula diferença em dias
  const diffTime = targetUTC - todayUTC;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Calcula quantos dias se passaram desde uma data (considerando horário de Brasília)
 * Compara apenas as datas (sem considerar hora)
 * Usa Intl.DateTimeFormat para obter a data de Brasília independente do timezone do browser
 */
export function daysSince(pastDate: Date | string): number {
  // Usa Intl.DateTimeFormat para pegar a data atual em Brasília de forma confiável
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit'
  });
  const todayStr = formatter.format(new Date()); // Retorna "YYYY-MM-DD"
  const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);
  const todayUTC = Date.UTC(todayYear, todayMonth - 1, todayDay);
  
  // Parse da data passada em UTC
  let pastUTC: number;
  if (typeof pastDate === 'string') {
    const datePart = pastDate.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    pastUTC = Date.UTC(year, month - 1, day);
  } else {
    // Para objetos Date, também formata em Brasília para consistência
    const pastStr = formatter.format(pastDate);
    const [year, month, day] = pastStr.split('-').map(Number);
    pastUTC = Date.UTC(year, month - 1, day);
  }
  
  // Calcula diferença em dias
  const diffTime = todayUTC - pastUTC;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Verifica se uma data está vencida (considerando horário de Brasília)
 */
export function isOverdue(dueDate: Date | string): boolean {
  return daysUntil(dueDate) < 0;
}

/**
 * Cria uma data no horário de Brasília a partir de componentes
 */
export function createBrasiliaDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  const date = new Date(year, month - 1, day, hour, minute, second);
  return toUTC(date);
}
