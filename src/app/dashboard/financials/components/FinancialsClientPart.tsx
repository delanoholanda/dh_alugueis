
'use client';

import { useState, useEffect } from 'react';
import type { Expense, ExpenseCategory } from '@/types'; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { ExpenseForm } from './ExpenseForm';
import { createExpense, deleteExpense, updateExpense } from '@/actions/financialActions';
import { PlusCircle, Trash2, Edit } from 'lucide-react';
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
import { formatToBRL } from '@/lib/utils';

interface FinancialsClientPartProps {
  initialExpenses: Expense[];
  initialExpenseCategories: ExpenseCategory[];
  onDataShouldRefresh: () => Promise<void>;
}

export default function FinancialsClientPart({ initialExpenses, initialExpenseCategories, onDataShouldRefresh }: FinancialsClientPartProps) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    setExpenses(initialExpenses);
  }, [initialExpenses]);

  const handleFormSubmit = async (data: any) => { // data is ExpenseFormValues from the form
    const submitData = { ...data, date: format(data.date, 'yyyy-MM-dd') };
    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, submitData);
        toast({ title: 'Despesa Atualizada', description: 'A despesa foi atualizada com sucesso.', variant: 'success' });
      } else {
        await createExpense(submitData);
        toast({ title: 'Despesa Adicionada', description: 'A despesa foi registrada com sucesso.', variant: 'success' });
      }
      await onDataShouldRefresh();
    } catch (error) {
      toast({ title: `Erro ao ${editingExpense ? 'Atualizar' : 'Adicionar'} Despesa`, description: (error as Error).message, variant: 'destructive' });
    } finally {
        setIsFormOpen(false);
        setEditingExpense(undefined);
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
  
  const openEditForm = (expense: Expense) => {
    setEditingExpense(expense);
    setIsFormOpen(true);
  };

  const openNewForm = () => {
    setEditingExpense(undefined);
    setIsFormOpen(true);
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-headline">Registro de Despesas</CardTitle>
        <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingExpense(undefined); }}>
          <DialogTrigger asChild>
            <Button onClick={openNewForm}>
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Despesa
            </Button>
          </DialogTrigger>
          {isFormOpen && (
            <ExpenseForm
              initialData={editingExpense}
              onSubmit={handleFormSubmit}
              onClose={() => { setIsFormOpen(false); setEditingExpense(undefined); }}
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
                    <TableCell className="text-right">{formatToBRL(expense.amount)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" title="Editar Despesa" onClick={() => openEditForm(expense)}>
                          <Edit className="h-4 w-4" />
                        </Button>
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
                      </div>
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
