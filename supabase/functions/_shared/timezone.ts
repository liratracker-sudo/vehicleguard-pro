/**
 * Utilitários de fuso horário para Edge Functions
 * Sincronizado com src/lib/timezone.ts
 */

const BRASILIA_OFFSET = -3 * 60; // -3 horas em minutos

export function toBrasiliaTime(utcDate: Date | string): Date {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return new Date(date.getTime() + BRASILIA_OFFSET * 60 * 1000);
}

export function toUTC(brasiliaDate: Date | string): Date {
  const date = typeof brasiliaDate === 'string' ? new Date(brasiliaDate) : brasiliaDate;
  return new Date(date.getTime() - BRASILIA_OFFSET * 60 * 1000);
}

export function nowInBrasilia(): Date {
  return toBrasiliaTime(new Date());
}

export function toISODateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const brasiliaDate = toBrasiliaTime(d);
  
  const year = brasiliaDate.getFullYear();
  const month = String(brasiliaDate.getMonth() + 1).padStart(2, '0');
  const day = String(brasiliaDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

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

export function formatDateTimeBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const brasiliaDate = toBrasiliaTime(d);
  
  const day = String(brasiliaDate.getDate()).padStart(2, '0');
  const month = String(brasiliaDate.getMonth() + 1).padStart(2, '0');
  const year = brasiliaDate.getFullYear();
  const hours = String(brasiliaDate.getHours()).padStart(2, '0');
  const minutes = String(brasiliaDate.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
