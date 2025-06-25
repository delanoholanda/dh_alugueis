
'use client';

import type { ExpenseCategory } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
// Icon selection could be added later if desired, similar to EquipmentTypeForm
// import { selectableIconsList, DynamicLucideIcon } from '@/lib/lucide-icons'; 

const expenseCategorySchema = z.object({
  name: z.string().min(2, "Nome da categoria deve ter pelo menos 2 caracteres."),
  // iconName: z.string().optional(), // Future enhancement
});

type ExpenseCategoryFormValues = z.infer<typeof expenseCategorySchema>;

interface ExpenseCategoryFormProps {
  initialData?: ExpenseCategory; // Though for "Add New", this will likely be undefined
  onSubmitAction: (data: ExpenseCategoryFormValues) => Promise<ExpenseCategory | null | void>;
  onClose: () => void;
}

export function ExpenseCategoryForm({ initialData, onSubmitAction, onClose }: ExpenseCategoryFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const form = useForm<ExpenseCategoryFormValues>({
    resolver: zodResolver(expenseCategorySchema),
    defaultValues: initialData || {
      name: '',
      // iconName: 'Tag', // Default icon if implemented
    },
  });

  const onSubmit = async (data: ExpenseCategoryFormValues) => {
    setIsLoading(true);
    try {
      await onSubmitAction(data);
      // Toast for success is handled by the parent form (ExpenseForm) after category is created and selected
      onClose(); 
    } catch (error) {
      toast({
        title: 'Erro',
        description: `Falha ao ${initialData ? 'atualizar' : 'criar'} categoria. ${(error as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-xs"> {/* Smaller dialog for just name */}
      <DialogHeader>
        <DialogTitle>{initialData ? 'Editar Categoria' : 'Adicionar Nova Categoria de Despesa'}</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da Categoria</FormLabel>
                <FormControl><Input placeholder="ex: Manutenção Frota" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Icon selection can be added here later */}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" disabled={isLoading}>Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Salvando...' : (initialData ? 'Salvar' : 'Adicionar')}</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
