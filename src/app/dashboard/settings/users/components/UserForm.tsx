
'use client';

import type { User } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const userFormSchemaBase = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres."),
  email: z.string().email("Email inválido."),
});

const userFormSchemaCreate = userFormSchemaBase.extend({
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres."),
  confirmPassword: z.string().min(6, "Confirmação de senha deve ter pelo menos 6 caracteres."),
}).refine(data => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"], 
});

const userFormSchemaUpdate = userFormSchemaBase.extend({
  password: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres.").optional().or(z.literal('')),
  confirmPassword: z.string().min(6, "Confirmação de nova senha deve ter pelo menos 6 caracteres.").optional().or(z.literal('')),
}).refine(data => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});


type UserFormValues = z.infer<typeof userFormSchemaCreate>; // Use create for broader type initially

interface UserFormProps {
  initialData?: User;
  onSubmitAction: (data: Omit<User, 'id'> & { password?: string }) => Promise<void>;
  onClose: () => void;
}

export function UserForm({ initialData, onSubmitAction, onClose }: UserFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const form = useForm<UserFormValues>({
    resolver: zodResolver(initialData ? userFormSchemaUpdate : userFormSchemaCreate),
    defaultValues: initialData ? {
      name: initialData.name,
      email: initialData.email,
      password: '',
      confirmPassword: '',
    } : {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: UserFormValues) => {
    setIsLoading(true);
    const submitData: Omit<User, 'id'> & { password?: string } = {
      name: data.name,
      email: data.email,
    };
    // Only include password if it's provided (for create or update)
    if (data.password) {
      submitData.password = data.password;
    }

    try {
      await onSubmitAction(submitData);
      toast({
        title: `Usuário ${initialData ? 'Atualizado' : 'Criado'}`,
        description: `Os dados do usuário foram ${initialData ? 'atualizados' : 'salvos'} com sucesso.`,
        variant: 'success',
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Erro',
        description: (error as Error).message || `Falha ao ${initialData ? 'atualizar' : 'criar'} usuário.`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{initialData ? 'Editar Usuário' : 'Adicionar Novo Usuário'}</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome Completo</FormLabel>
                <FormControl><Input placeholder="ex: João da Silva" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" placeholder="ex: joao.silva@email.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{initialData ? 'Nova Senha' : 'Senha'}</FormLabel>
                 <div className="relative">
                    <FormControl>
                      <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...field} />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:bg-transparent"
                      onClick={() => setShowPassword((prev) => !prev)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">{showPassword ? 'Ocultar senha' : 'Mostrar senha'}</span>
                    </Button>
                  </div>
                {initialData && <FormDescription className="text-xs">Deixe em branco para manter a senha atual.</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{initialData ? 'Confirmar Nova Senha' : 'Confirmar Senha'}</FormLabel>
                 <div className="relative">
                    <FormControl>
                        <Input type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" {...field} />
                    </FormControl>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:bg-transparent"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        tabIndex={-1}
                    >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        <span className="sr-only">{showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}</span>
                    </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" disabled={isLoading}>Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Salvando...' : (initialData ? 'Salvar Alterações' : 'Adicionar Usuário')}</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
