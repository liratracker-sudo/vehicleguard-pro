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
 */
export function formatDateBR(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  const brasiliaDate = toBrasiliaTime(d);
  
  const day = String(brasiliaDate.getDate()).padStart(2, '0');
  const month = String(brasiliaDate.getMonth() + 1).padStart(2, '0');
  const year = brasiliaDate.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Formata data e hora no padrão brasileiro (DD/MM/YYYY HH:mm)
 */
export function formatDateTimeBR(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  const brasiliaDate = toBrasiliaTime(d);
  
  const day = String(brasiliaDate.getDate()).padStart(2, '0');
  const month = String(brasiliaDate.getMonth() + 1).padStart(2, '0');
  const year = brasiliaDate.getFullYear();
  const hours = String(brasiliaDate.getHours()).padStart(2, '0');
  const minutes = String(brasiliaDate.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Formata apenas a hora no padrão brasileiro (HH:mm)
 */
export function formatTimeBR(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  const brasiliaDate = toBrasiliaTime(d);
  
  const hours = String(brasiliaDate.getHours()).padStart(2, '0');
  const minutes = String(brasiliaDate.getMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

/**
 * Retorna a data no formato ISO mas no horário de Brasília (YYYY-MM-DD)
 */
export function toISODateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const brasiliaDate = toBrasiliaTime(d);
  
  const year = brasiliaDate.getFullYear();
  const month = String(brasiliaDate.getMonth() + 1).padStart(2, '0');
  const day = String(brasiliaDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
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
 */
export function daysUntil(targetDate: Date | string): number {
  const now = nowInBrasilia();
  const target = typeof targetDate === 'string' ? toBrasiliaTime(new Date(targetDate)) : toBrasiliaTime(targetDate);
  
  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Calcula quantos dias se passaram desde uma data (considerando horário de Brasília)
 */
export function daysSince(pastDate: Date | string): number {
  const now = nowInBrasilia();
  const past = typeof pastDate === 'string' ? toBrasiliaTime(new Date(pastDate)) : toBrasiliaTime(pastDate);
  
  const diffTime = now.getTime() - past.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Verifica se uma data está vencida (considerando horário de Brasília)
 */
export function isOverdue(dueDate: Date | string): boolean {
  const now = nowInBrasilia();
  const due = typeof dueDate === 'string' ? toBrasiliaTime(new Date(dueDate)) : toBrasiliaTime(dueDate);
  
  return due < now;
}

/**
 * Cria uma data no horário de Brasília a partir de componentes
 */
export function createBrasiliaDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  const date = new Date(year, month - 1, day, hour, minute, second);
  return toUTC(date);
}
