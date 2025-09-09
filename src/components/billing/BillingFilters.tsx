import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns"
import { CalendarIcon, Filter, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface BillingFiltersState {
  search: string;
  status: string;
  gateway: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  amountMin: string;
  amountMax: string;
}

interface BillingFiltersProps {
  filters: BillingFiltersState;
  onFiltersChange: (filters: BillingFiltersState) => void;
  onClearFilters: () => void;
}

export function BillingFilters({ 
  filters, 
  onFiltersChange, 
  onClearFilters 
}: BillingFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = (key: keyof BillingFiltersState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== '' && value !== undefined
  );

  return (
    <div className="space-y-4">
      {/* Basic Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar por cliente, ID..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
          />
        </div>
        
        <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.gateway} onValueChange={(value) => updateFilter('gateway', value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Gateway" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="asaas">Asaas</SelectItem>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="boleto">Boleto</SelectItem>
            <SelectItem value="credit_card">Cartão</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filtros
        </Button>

        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={onClearFilters}
          >
            <X className="w-4 h-4 mr-2" />
            Limpar
          </Button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/20">
          <div className="space-y-2">
            <Label htmlFor="dateFrom">Data Inicial</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="dateFrom"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? (
                    format(filters.dateFrom, "dd/MM/yyyy")
                  ) : (
                    "Selecione..."
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom}
                  onSelect={(date) => updateFilter('dateFrom', date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateTo">Data Final</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="dateTo"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateTo ? (
                    format(filters.dateTo, "dd/MM/yyyy")
                  ) : (
                    "Selecione..."
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dateTo}
                  onSelect={(date) => updateFilter('dateTo', date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amountMin">Valor Mínimo</Label>
            <Input
              id="amountMin"
              type="number"
              placeholder="0,00"
              value={filters.amountMin}
              onChange={(e) => updateFilter('amountMin', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amountMax">Valor Máximo</Label>
            <Input
              id="amountMax"
              type="number"
              placeholder="999999,99"
              value={filters.amountMax}
              onChange={(e) => updateFilter('amountMax', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}