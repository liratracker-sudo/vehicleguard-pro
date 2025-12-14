import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, 
  DollarSign, 
  AlertTriangle, 
  Calendar, 
  Edit, 
  Trash2, 
  CheckCircle2,
  Download
} from "lucide-react";
import { useExpenses } from "@/hooks/useExpenses";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { ExpenseFilters } from "@/components/expenses/ExpenseFilters";
import { formatDateBR } from "@/lib/timezone";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Expenses() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filters, setFilters] = useState<any>({});

  const { expenses, loadingExpenses, deleteExpense, markAsPaid, getSummary } = useExpenses();
  const summary = getSummary();

  const handleEdit = (expense: any) => {
    setSelectedExpense(expense);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteExpense.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleMarkPaid = async (id: string) => {
    await markAsPaid.mutateAsync({ id });
  };

  const handleNewExpense = () => {
    setSelectedExpense(null);
    setFormOpen(true);
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = new Date(dueDate) < new Date() && status === "pending";
    
    if (status === "paid") {
      return <Badge variant="default" className="bg-green-500">Pago</Badge>;
    }
    if (isOverdue) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const filteredExpenses = expenses.filter((expense) => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const matchDescription = expense.description.toLowerCase().includes(search);
      const matchSupplier = expense.supplier_name?.toLowerCase().includes(search);
      if (!matchDescription && !matchSupplier) return false;
    }

    if (filters.status && filters.status !== "all") {
      if (filters.status === "overdue") {
        const isOverdue = new Date(expense.due_date) < new Date() && expense.status === "pending";
        if (!isOverdue) return false;
      } else if (expense.status !== filters.status) {
        return false;
      }
    }

    if (filters.category && filters.category !== "all" && expense.category_id !== filters.category) {
      return false;
    }

    if (filters.period && filters.period !== "all") {
      const dueDate = new Date(expense.due_date);
      const now = new Date();
      
      if (filters.period === "today" && dueDate.toDateString() !== now.toDateString()) {
        return false;
      }
      if (filters.period === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (dueDate < weekAgo || dueDate > now) return false;
      }
      if (filters.period === "month" && dueDate.getMonth() !== now.getMonth()) {
        return false;
      }
      if (filters.period === "overdue" && (dueDate >= now || expense.status !== "pending")) {
        return false;
      }
    }

    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Contas a Pagar</h1>
            <p className="text-muted-foreground">Controle suas despesas e pagamentos</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button onClick={handleNewExpense}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Despesa
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.pending.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.pending.count} despesa{summary.pending.count !== 1 ? "s" : ""} pendente{summary.pending.count !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {summary.overdue.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.overdue.count} despesa{summary.overdue.count !== 1 ? "s" : ""} vencida{summary.overdue.count !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Este Mês</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.thisMonth.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.thisMonth.count} despesa{summary.thisMonth.count !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <ExpenseFilters onFilterChange={setFilters} />
          </CardContent>
        </Card>

        {/* Expenses Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingExpenses ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Carregando despesas...
                    </TableCell>
                  </TableRow>
                ) : filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma despesa encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.description}</TableCell>
                      <TableCell>{expense.supplier_name || "-"}</TableCell>
                      <TableCell>
                        {expense.expense_categories ? (
                          <Badge variant="outline" style={{ borderColor: expense.expense_categories.color }}>
                            {expense.expense_categories.name}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {formatDateBR(expense.due_date)}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {Number(expense.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(expense.status, expense.due_date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {expense.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMarkPaid(expense.id)}
                              title="Marcar como pago"
                            >
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(expense)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(expense.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Forms and Dialogs */}
      <ExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={selectedExpense}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Despesa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
