
'use client';

import { useState, useEffect } from 'react';
import type { Expense, ExpenseCategory } from '@/types'; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { ExpenseForm } from './ExpenseForm';
import { createExpense, deleteExpense } from '@/actions/financialActions';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FinancialsClientPartProps {
  initialExpenses: Expense[];
  initialExpenseCategories: ExpenseCategory[];
  onDataShouldRefresh: () => Promise<void>; // Callback to refresh parent data
}

export default function FinancialsClientPart({ initialExpenses, initialExpenseCategories, onDataShouldRefresh }: FinancialsClientPartProps) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setExpenses(initialExpenses);
  }, [initialExpenses]);

  const handleAddExpense = async (data: Omit<Expense, 'id' | 'categoryName'>) => {
    try {
      const newExpense = await createExpense(data);
      if (newExpense) {
        toast({ title: 'Despesa Adicionada', description: 'A despesa foi registrada com sucesso.', variant: 'success' });
        await onDataShouldRefresh(); 
      } else {
        // This case implies createExpense returned null/undefined without throwing an error, which is unlikely with current action.
        toast({ title: 'Aviso', description: 'A despesa foi processada, mas não retornou dados atualizados.', variant: 'default' });
        await onDataShouldRefresh(); // Still refresh to be safe
      }
    } catch (error) {
      toast({ title: 'Erro ao Adicionar Despesa', description: (error as Error).message || "Falha ao criar despesa.", variant: 'destructive' });
      // No need to call onDataShouldRefresh() here if the operation failed, unless we want to ensure client is in sync with DB state
    } finally {
        setIsExpenseFormOpen(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await deleteExpense(expenseId);
      toast({ title: 'Despesa Excluída', description: 'A despesa foi removida.', variant: 'success' });
      await onDataShouldRefresh(); 
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha ao excluir despesa.', variant: 'destructive' });
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-headline">Registro de Despesas</CardTitle>
        <Dialog open={isExpenseFormOpen} onOpenChange={setIsExpenseFormOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Despesa
            </Button>
          </DialogTrigger>
          {isExpenseFormOpen && (
            <ExpenseForm
              onSubmitAction={handleAddExpense}
              onClose={() => setIsExpenseFormOpen(false)}
              initialExpenseCategories={initialExpenseCategories} 
            />
          )}
        </Dialog>
      </CardHeader>
      <CardContent>
        {expenses.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{format(parseISO(expense.date), 'PP', { locale: ptBR })}</TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell className="capitalize hidden sm:table-cell">{expense.categoryName || 'N/A'}</TableCell>
                    <TableCell className="text-right">R$ {expense.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Excluir Despesa">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Despesa: {expense.description}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Isso excluirá permanentemente este registro de despesa.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteExpense(expense.id)} className="bg-destructive hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-lg">Nenhuma despesa registrada ainda.</p>
            <p>Adicione despesas para acompanhar seus gastos.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
