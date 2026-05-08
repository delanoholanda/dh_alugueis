
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ShoppingCart, Loader2, Plus, Trash2, Package } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { formatToBRL, cn } from '@/lib/utils';
import type { Equipment } from '@/types';

const purchaseItemSchema = z.object({
  inventoryId: z.string().min(1, "Obrigatório"),
  quantity: z.coerce.number().min(1, "Min 1"),
  unitPrice: z.coerce.number().min(0, "Mín 0"),
});

const bulkPurchaseSchema = z.object({
  items: z.array(purchaseItemSchema).min(1, "Adicione pelo menos um item"),
  freightValue: z.coerce.number().min(0).default(0),
  purchaseDate: z.date({ required_error: "Data obrigatória" }),
  notes: z.string().optional(),
  affectsStock: z.boolean().default(true),
});

type BulkPurchaseFormValues = z.infer<typeof bulkPurchaseSchema>;

interface PurchaseFormProps {
  inventory: Equipment[];
  onSubmitAction: (data: BulkPurchaseFormValues) => Promise<void>;
  onClose: () => void;
}

export function PurchaseForm({ inventory, onSubmitAction, onClose }: PurchaseFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const form = useForm<BulkPurchaseFormValues>({
    resolver: zodResolver(bulkPurchaseSchema),
    defaultValues: {
      items: [{ inventoryId: '', quantity: 1, unitPrice: 0 }],
      freightValue: 0,
      purchaseDate: new Date(),
      notes: '',
      affectsStock: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const watchedItems = form.watch("items");
  const watchedFreight = form.watch("freightValue");
  
  const totalItemsValue = watchedItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
  const grandTotal = totalItemsValue + (watchedFreight || 0);

  const onSubmit = async (data: BulkPurchaseFormValues) => {
    setIsLoading(true);
    try {
      await onSubmitAction(data);
      onClose();
    } catch (error) {
      toast({ title: 'Erro', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" /> Registrar Compra em Lote
        </DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Data da Nota/Compra</FormLabel>
                    <Popover modal={true}>
                        <PopoverTrigger asChild>
                            <FormControl>
                                <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {field.value ? format(field.value, "dd/MM/yyyy") : <span>Selecione</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR} />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="freightValue"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Frete Total da Nota (R$)</FormLabel>
                    <FormControl>
                        <Input
                        type={focusedField === 'freight' ? 'number' : 'text'}
                        placeholder="R$ 0,00"
                        value={focusedField === 'freight' ? (field.value ?? '') : formatToBRL(field.value)}
                        onFocus={() => setFocusedField('freight')}
                        onBlur={() => setFocusedField(null)}
                        onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        step="0.01"
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
          </div>

          <div className="space-y-3">
              <div className="flex justify-between items-center">
                  <FormLabel className="text-base font-bold">Itens da Compra</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ inventoryId: '', quantity: 1, unitPrice: 0 })}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar Item
                  </Button>
              </div>
              
              <div className="space-y-4">
                  {fields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr_80px_150px_40px] gap-3 p-3 border rounded-lg bg-muted/20 relative group">
                          <FormField
                            control={form.control}
                            name={`items.${index}.inventoryId`}
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="bg-background">
                                      <SelectValue placeholder="Equipamento" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {inventory.map((item) => (
                                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl><Input type="number" {...field} placeholder="Qtd" className="bg-background"/></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`items.${index}.unitPrice`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                    <Input
                                        type={focusedField === `price-${index}` ? 'number' : 'text'}
                                        placeholder="Unitário"
                                        value={focusedField === `price-${index}` ? (field.value ?? '') : formatToBRL(field.value)}
                                        onFocus={() => setFocusedField(`price-${index}`)}
                                        onBlur={() => setFocusedField(null)}
                                        onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                        step="0.01"
                                        className="bg-background"
                                    />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {fields.length > 1 && (
                              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:bg-destructive/10 h-10 w-10">
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          )}
                      </div>
                  ))}
              </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <FormField
                control={form.control}
                name="affectsStock"
                render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-muted/30">
                    <div className="space-y-0.5">
                    <FormLabel className="text-sm font-semibold">Atualizar Estoque?</FormLabel>
                    <FormDescription className="text-[10px]">
                        Desative para registros históricos.
                    </FormDescription>
                    </div>
                    <FormControl>
                    <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                    />
                    </FormControl>
                </FormItem>
                )}
            />

            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 flex flex-col items-end">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Geral da Nota</span>
                <span className="text-2xl font-bold text-primary">{formatToBRL(grandTotal)}</span>
                <span className="text-[10px] text-muted-foreground">Itens: {formatToBRL(totalItemsValue)} + Frete: {formatToBRL(watchedFreight)}</span>
            </div>
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações da Compra</FormLabel>
                <FormControl><Textarea placeholder="Número da NF, fornecedor ou detalhes do lote..." {...field} rows={2}/></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter className="pt-4 border-t">
            <DialogClose asChild><Button type="button" variant="outline" disabled={isLoading}>Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
                Salvar Entrada ({fields.length} itens)
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
