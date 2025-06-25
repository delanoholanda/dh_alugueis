
'use client';

import type { Expense, ExpenseCategory } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CalendarIcon, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { formatToBRL, parseFromBRL } from '@/lib/utils';
import { ExpenseCategoryForm } from './ExpenseCategoryForm';
import { createExpenseCategory, getExpenseCategories as fetchExpenseCategoriesAction } from '@/actions/expenseCategoryActions';


const expenseSchema = z.object({
  date: z.date({ required_error: "Data é obrigatória." }),
  description: z.string().min(3, "Descrição deve ter pelo menos 3 caracteres"),
  amount: z.coerce.number({invalid_type_error: "Valor deve ser um número."}).positive("Valor deve ser positivo"),
  categoryId: z.string().min(1, "Categoria é obrigatória."),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

interface ExpenseFormProps {
  onSubmitAction: (data: Omit<Expense, 'id' | 'categoryName'>) => Promise<void>;
  onClose: () => void;
  initialExpenseCategories: ExpenseCategory[];
}

export function ExpenseForm({ onSubmitAction, onClose, initialExpenseCategories }: ExpenseFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [currentExpenseCategories, setCurrentExpenseCategories] = useState<ExpenseCategory[]>(initialExpenseCategories);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  
  useEffect(() => {
    setCurrentExpenseCategories(initialExpenseCategories.sort((a, b) => a.name.localeCompare(b.name)));
  }, [initialExpenseCategories]);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date(),
      description: '',
      amount: 0,
      categoryId: currentExpenseCategories.find(cat => cat.name.toLowerCase() === 'outro')?.id || currentExpenseCategories[0]?.id || '',
    },
  });

  const handleNewCategoryCreated = async (data: Pick<ExpenseCategory, 'name' | 'iconName'>) => {
    try {
      const newCategory = await createExpenseCategory(data.name, data.iconName);
      if (newCategory) {
        const updatedCategories = await fetchExpenseCategoriesAction(); 
        setCurrentExpenseCategories(updatedCategories.sort((a, b) => a.name.localeCompare(b.name)));
        form.setValue('categoryId', newCategory.id, { shouldValidate: true }); 
        toast({
          title: "Categoria Criada",
          description: `${newCategory.name} foi adicionada e selecionada.`,
          variant: 'success',
        });
        setIsCategoryFormOpen(false); 
      }
    } catch (error) {
      toast({
        title: 'Erro ao Criar Categoria',
        description: `Não foi possível criar a nova categoria. ${(error as Error).message}`,
        variant: 'destructive',
      });
    }
  };


  const onSubmit = async (data: ExpenseFormValues) => {
    setIsLoading(true);
    const submitData = { ...data, date: format(data.date, 'yyyy-MM-dd') };
    try {
      await onSubmitAction(submitData);
    } catch (error) {
      toast({
        title: 'Erro Inesperado no Formulário',
        description: `Falha ao processar o formulário de despesa. ${(error as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Adicionar Nova Despesa</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}>
                        {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar 
                      mode="single" 
                      selected={field.value} 
                      onSelect={field.onChange} 
                      initialFocus 
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição</FormLabel>
                <FormControl><Textarea placeholder="ex: Combustível para caminhão de entrega" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor (R$)</FormLabel>
                <FormControl>
                  <Input 
                    type="text" 
                    value={formatToBRL(field.value)}
                    onChange={(e) => field.onChange(parseFromBRL(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <div className="flex gap-2 items-center">
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {currentExpenseCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog open={isCategoryFormOpen} onOpenChange={setIsCategoryFormOpen}>
                    <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="icon" title="Adicionar Nova Categoria de Despesa">
                            <Tag className="h-4 w-4 text-primary" />
                        </Button>
                    </DialogTrigger>
                    {isCategoryFormOpen && (
                        <ExpenseCategoryForm
                            onSubmitAction={handleNewCategoryCreated}
                            onClose={() => setIsCategoryFormOpen(false)}
                        />
                    )}
                  </Dialog>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Salvando...' : 'Adicionar Despesa'}</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
