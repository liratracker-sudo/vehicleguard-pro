import { useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, startOfYear, endOfYear, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import type { PeriodRange } from "@/hooks/useFinancialData";

interface Props {
  value: PeriodRange;
  onChange: (p: PeriodRange) => void;
}

type Preset = "today" | "week" | "month" | "last_month" | "30d" | "year" | "custom";

export function PeriodSelector({ value, onChange }: Props) {
  const [preset, setPreset] = useState<Preset>("month");
  const [open, setOpen] = useState(false);

  const handlePreset = (p: Preset) => {
    setPreset(p);
    const now = new Date();
    let range: PeriodRange | null = null;
    switch (p) {
      case "today":
        range = { from: startOfDay(now), to: endOfDay(now) };
        break;
      case "week":
        range = { from: startOfWeek(now, { weekStartsOn: 0 }), to: endOfWeek(now, { weekStartsOn: 0 }) };
        break;
      case "month":
        range = { from: startOfMonth(now), to: endOfMonth(now) };
        break;
      case "last_month": {
        const lm = subMonths(now, 1);
        range = { from: startOfMonth(lm), to: endOfMonth(lm) };
        break;
      }
      case "30d":
        range = { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
        break;
      case "year":
        range = { from: startOfYear(now), to: endOfYear(now) };
        break;
      case "custom":
        setOpen(true);
        return;
    }
    if (range) onChange(range);
  };

  const handleCustom = (r: DateRange | undefined) => {
    if (r?.from && r?.to) {
      onChange({ from: startOfDay(r.from), to: endOfDay(r.to) });
      setPreset("custom");
      setOpen(false);
    }
  };

  const label = `${format(value.from, "dd/MM/yyyy", { locale: ptBR })} → ${format(value.to, "dd/MM/yyyy", { locale: ptBR })}`;

  return (
    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
      <Select value={preset} onValueChange={(v) => handlePreset(v as Preset)}>
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="week">Esta semana</SelectItem>
          <SelectItem value="month">Este mês</SelectItem>
          <SelectItem value="last_month">Mês passado</SelectItem>
          <SelectItem value="30d">Últimos 30 dias</SelectItem>
          <SelectItem value="year">Este ano</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("justify-start text-left font-normal min-w-[260px]")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={{ from: value.from, to: value.to }}
            onSelect={handleCustom}
            numberOfMonths={2}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
