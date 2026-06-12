'use client';

import type { Quote, Customer, Equipment as InventoryEquipment, EquipmentType, Rental } from '@/types';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, PlusCircle, Trash2, Save, Truck, Percent, UserPlus, MapPin, ChevronsUpDown, Check, Package, ArrowLeft, CalendarDays, ClipboardList } from 'lucide-react';
import { format, parseISO, isSameDay, isWithinInterval, startOfDay, endOfDay, eachDayOfInterval, isValid, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { formatToBRL, cn, findNthBillableDay } from '@/lib/utils';
import { CustomerForm } from '@/app/dashboard/customers/components/CustomerForm';
import { createCustomer, getCustomers } from '@/actions/customerActions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const quoteFormSchema = z.object({
  customerId: z.string().min(1, "Cliente é obrigatório"),
  equipment: z.array(z.object({
    equipmentId: z.string().min(1, "Equipamento é obrigatório"),
    quantity: z.coerce.number({invalid_type_error: "Quantidade deve ser um número.", required_error: "Quantidade é obrigatória."})
      .min(1, "Quantidade deve ser pelo menos 1")
      .refine(val => !isNaN(val) && Number.isInteger(val), { message: "Quantidade deve ser um número inteiro válido." }),
    customDailyRentalRate: z.preprocess(
      (val) => (val === undefined || val === null || val === '' ? undefined : val),
      z.coerce.number({ invalid_type_error: "Taxa diária customizada deve ser um número." })
        .min(0, "Taxa diária customizada não pode ser negativa")
        .optional()
    ),
  })).min(1, "Pelo menos um item de equipamento é obrigatório"),
  rentalStartDate: z.date({ required_error: "Data de início é obrigatória." }),
  expectedReturnDate: z.date({ required_error: "Data de retorno é obrigatória." }),
  chargeSaturdays: z.boolean().default(true),
  chargeSundays: z.boolean().default(true),
  rentalDays: z.coerce.number({invalid_type_error: "Dias deve ser um número."}).min(0.5, "Mínimo 0.5 dia."),
  freightValue: z.preprocess((v) => (v === '' || v == null ? 0 : v), z.coerce.number().min(0).optional()),
  discountValue: z.preprocess((v) => (v === '' || v == null ? 0 : v), z.coerce.number().min(0).optional()),
  value: z.coerce.number().min(0),
  notes: z.string().optional(),
  deliveryAddress: z.string().optional(),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

interface QuoteFormProps {
  initialData?: Quote;
  customers: Customer[];
  inventory: InventoryEquipment[];
  equipmentTypes: EquipmentType[];
  allRentals: Rental[];
  onSubmitAction: (data: QuoteFormValues) => Promise<Quote | null | void>;
  formTitle: string;
  submitButtonText: string;
}

export function QuoteForm({ 
  initialData, 
  customers: initialCustomers, 
  inventory: initialInventory, 
  allRentals, 
  onSubmitAction, 
  formTitle, 
  submitButtonText 
}: QuoteFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [customerList, setCustomerList] = useState<Customer[]>(() => initialCustomers.sort((a, b) => a.name.localeCompare(b.name)));
  const [inventoryList, setInventoryList] = useState<InventoryEquipment[]>(() => initialInventory.sort((a, b) => a.name.localeCompare(b.name)));
  
  const [openCustomerCombobox, setOpenCustomerCombobox] = useState(false);
  const [openEquipmentCombobox, setOpenEquipmentCombobox] = useState<Record<number, boolean>>({});
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
  const [focusedCurrencyField, setFocusedCurrencyField] = useState<string | null>(null);

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: initialData ? {
      customerId: initialData.customerId,
      rentalStartDate: initialData.rentalStartDate ? parseISO(initialData.rentalStartDate) : new Date(),
      expectedReturnDate: initialData.expectedReturnDate ? parseISO(initialData.expectedReturnDate) : addDays(new Date(), 1),
      rentalDays: initialData.rentalDays,
      chargeSaturdays: initialData.chargeSaturdays ?? true,
      chargeSundays: initialData.chargeSundays ?? true,
      freightValue: initialData.freightValue ?? 0,
      discountValue: initialData.discountValue ?? 0,
      value: initialData.value,
      notes: initialData.notes ?? '',
      deliveryAddress: initialData.deliveryAddress ?? '',
      equipment: initialData.equipment.map(eq => ({
        equipmentId: eq.equipmentId,
        quantity: eq.quantity,
        customDailyRentalRate: eq.customDailyRentalRate === null ? undefined : eq.customDailyRentalRate 
      })),
    } : {
      customerId: '',
      equipment: [{ equipmentId: '', quantity: 1, customDailyRentalRate: undefined }],
      rentalStartDate: new Date(),
      rentalDays: 1,
      chargeSaturdays: true,
      chargeSundays: true,
      freightValue: 0,
      discountValue: 0,
      value: 0,
      notes: '',
      deliveryAddress: 'A definir',
      expectedReturnDate: addDays(new Date(), 1),
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "equipment" });
  const watchedEquipment = form.watch("equipment");
  const watchedRentalDays = form.watch("rentalDays");
  const watchedRentalStartDate = form.watch("rentalStartDate");
  const watchedExpectedReturnDate = form.watch("expectedReturnDate");
  const watchedFreightValue = form.watch("freightValue");
  const watchedDiscountValue = form.watch("discountValue");
  const watchedChargeSaturdays = form.watch("chargeSaturdays");
  const watchedChargeSundays = form.watch("chargeSundays");

  const inventoryWithAvailability = useMemo(() => {
    const startDate = watchedRentalStartDate;
    const endDate = watchedExpectedReturnDate || addDays(startDate, 1);
    
    if (!isValid(startDate) || !isValid(endDate)) return inventoryList.map(i => ({ ...i, availableQuantity: i.quantity }));

    const requestedInterval = { start: startOfDay(startDate), end: endOfDay(endDate) };
    const daysToCheck = eachDayOfInterval(requestedInterval);
    const usageOnEachDay = new Map<string, Map<string, number>>();
    for (const d of daysToCheck) usageOnEachDay.set(format(d, 'yyyy-MM-dd'), new Map());

    for (const rental of allRentals) {
        if (rental.actualReturnDate) continue;
        const rStart = startOfDay(parseISO(rental.rentalStartDate));
        const rEnd = rental.isOpenEnded ? addDays(new Date(), 365) : endOfDay(parseISO(rental.expectedReturnDate));
        const rentalInterval = { start: rStart, end: rEnd };
        for (const day of daysToCheck) {
            if (isWithinInterval(day, rentalInterval)) {
                const dayKey = format(day, 'yyyy-MM-dd');
                const dayMap = usageOnEachDay.get(dayKey)!;
                for (const eq of rental.equipment) dayMap.set(eq.equipmentId, (dayMap.get(eq.equipmentId) || 0) + eq.quantity);
            }
        }
    }

    const maxUsageByOthers = new Map<string, number>();
    for (const [_, dayMap] of usageOnEachDay) {
        for (const [eqId, qty] of dayMap) {
            if (qty > (maxUsageByOthers.get(eqId) || 0)) maxUsageByOthers.set(eqId, qty);
        }
    }

    return inventoryList.map(item => {
        const usage = maxUsageByOthers.get(item.id) || 0;
        const capacity = item.status === 'rented' ? 0 : item.quantity;
        
        let availableForThisForm = Math.max(0, capacity - usage);
        if (initialData) {
            const currentQtyInThisQuote = initialData.equipment.find(e => e.equipmentId === item.id)?.quantity || 0;
            availableForThisForm += currentQtyInThisQuote;
        }

        return { ...item, availableQuantity: availableForThisForm };
    });
  }, [inventoryList, allRentals, initialData, watchedRentalStartDate, watchedExpectedReturnDate]);

  useEffect(() => {
    const start = watchedRentalStartDate;
    const days = watchedRentalDays;
    if (start && !isNaN(days) && days > 0) {
      const end = findNthBillableDay(start, days, watchedChargeSaturdays, watchedChargeSundays);
      if (!watchedExpectedReturnDate || !isSameDay(watchedExpectedReturnDate, end)) {
        form.setValue('expectedReturnDate', end, { shouldValidate: true });
      }
    }
  }, [watchedRentalDays, watchedRentalStartDate, watchedChargeSaturdays, watchedChargeSundays, form]);

  useEffect(() => {
    let itemsTotal = 0;
    const days = watchedRentalDays || 0;
    watchedEquipment.forEach(item => {
      if (item.equipmentId && item.quantity > 0) {
        const details = inventoryList.find(i => i.id === item.equipmentId);
        if (details) {
          const rate = item.customDailyRentalRate ?? details.dailyRentalRate ?? 0;
          itemsTotal += (item.quantity * rate * days);
        }
      }
    });
    const final = itemsTotal + (Number(watchedFreightValue) || 0) - (Number(watchedDiscountValue) || 0);
    form.setValue('value', Math.max(0, final), { shouldValidate: true });
  }, [watchedEquipment, watchedRentalDays, watchedFreightValue, watchedDiscountValue, inventoryList, form]);

  const handleNewCustomerCreated = async (data: Omit<Customer, 'id'>) => {
    const newC = await createCustomer(data);
    if (newC) {
      const refreshed = await getCustomers();
      setCustomerList(refreshed.sort((a,b) => a.name.localeCompare(b.name)));
      form.setValue('customerId', newC.id, { shouldValidate: true });
      setIsCustomerFormOpen(false);
    }
  };

  const onSubmit = async (data: QuoteFormValues) => {
    setIsLoading(true);
    const actionData = {
      ...data,
      rentalStartDate: format(data.rentalStartDate, 'yyyy-MM-dd'),
      expectedReturnDate: format(data.expectedReturnDate, 'yyyy-MM-dd'),
    } as any;

    try {
      await onSubmitAction(actionData);
      toast({ title: "Orçamento Salvo", variant: 'success' });
      router.back();
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCustomer = customerList.find(c => c.id === form.getValues('customerId'));

  return (
    <Card className="max-w-4xl mx-auto shadow-xl">
      <CardHeader><CardTitle className="font-headline text-2xl">{formTitle}</CardTitle></CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            <FormField control={form.control} name="customerId" render={({ field }) => (
              <FormItem className="flex flex-col"><FormLabel>Cliente</FormLabel>
                <div className="flex items-center gap-2">
                  <Popover open={openCustomerCombobox} onOpenChange={setOpenCustomerCombobox}>
                    <PopoverTrigger asChild><FormControl>
                      <Button variant="outline" className={cn("w-full h-11 justify-between", !field.value && "text-muted-foreground")}>
                        <div className="flex items-center gap-2 overflow-hidden">
                          {selectedCustomer && (
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={selectedCustomer.imageUrl || undefined} />
                              <AvatarFallback>{selectedCustomer.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                          )}
                          <span className="truncate">{selectedCustomer ? selectedCustomer.name : "Selecione..."}</span>
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0"/>
                      </Button>
                    </FormControl></PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar..." /><CommandList><CommandEmpty>Nenhum.</CommandEmpty><CommandGroup>
                          {customerList.map(c => (
                            <CommandItem key={c.id} onSelect={() => { form.setValue("customerId", c.id, { shouldValidate: true }); setOpenCustomerCombobox(false); }}>
                              <div className="flex items-center gap-3 w-full">
                                <Avatar className="h-8 w-8"><AvatarImage src={c.imageUrl || undefined} /><AvatarFallback>{c.name.charAt(0)}</AvatarFallback></Avatar>
                                <span className="flex-grow">{c.name}</span>
                                <Check className={cn("h-4 w-4", c.id === field.value ? "opacity-100" : "opacity-0")}/>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup></CommandList></Command>
                    </PopoverContent>
                  </Popover>
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => setIsCustomerFormOpen(true)}><UserPlus className="h-4 w-4"/></Button>
                  <Dialog open={isCustomerFormOpen} onOpenChange={setIsCustomerFormOpen}>{isCustomerFormOpen && <CustomerForm onSubmitAction={handleNewCustomerCreated} onClose={() => setIsCustomerFormOpen(false)} isSubForm={true}/>}</Dialog>
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <div>
              <FormLabel className="text-base font-semibold flex items-center gap-2 mb-2"><Package className="h-5 w-5 text-primary" /> Equipamento(s)</FormLabel>
              <div className="space-y-4">
              {fields.map((item, index) => {
                const currentEqId = watchedEquipment[index]?.equipmentId;
                const selectedInventoryItem = inventoryList.find(i => i.id === currentEqId);
                return (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3 items-end p-4 border rounded-lg bg-muted/20">
                  <FormField control={form.control} name={`equipment.${index}.equipmentId`} render={({ field }) => (
                    <FormItem className="flex-grow">
                      {index === 0 && <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Item</FormLabel>}
                      <Popover open={openEquipmentCombobox[index]} onOpenChange={(v) => setOpenEquipmentCombobox(prev => ({...prev, [index]: v}))}>
                        <PopoverTrigger asChild><FormControl>
                          <Button variant="outline" className="w-full h-10 justify-between">
                             <div className="flex items-center gap-2 overflow-hidden">
                                {selectedInventoryItem?.imageUrl && (
                                    <div className="h-6 w-6 relative rounded overflow-hidden border bg-background shrink-0">
                                        <Image src={selectedInventoryItem.imageUrl} alt="" fill className="object-contain" />
                                    </div>
                                )}
                                <span className="truncate">{selectedInventoryItem ? selectedInventoryItem.name : "Selecionar..."}</span>
                            </div>
                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0"/>
                          </Button>
                        </FormControl></PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="..." />
                            <CommandList>
                              <CommandEmpty>Nenhum.</CommandEmpty>
                              <CommandGroup>
                                {inventoryWithAvailability.map(i => (
                                  <CommandItem key={i.id} onSelect={() => { 
                                      form.setValue(`equipment.${index}.equipmentId`, i.id, {shouldValidate: true}); 
                                      form.setValue(`equipment.${index}.customDailyRentalRate`, i.dailyRentalRate, {shouldValidate: true}); 
                                      setOpenEquipmentCombobox(p => ({...p, [index]: false})); 
                                  }}>
                                    <div className="flex items-center gap-3 w-full">
                                      <div className="h-8 w-8 relative rounded border bg-muted flex-shrink-0">
                                        {i.imageUrl ? <Image src={i.imageUrl} alt="" fill className="object-contain p-0.5" /> : <Package className="h-4 w-4 m-auto text-muted-foreground" />}
                                      </div>
                                      <div className="flex flex-col flex-grow min-w-0">
                                        <span className="text-sm font-medium truncate">{i.name}</span>
                                        <span className="text-[10px] text-muted-foreground">Livre: {i.availableQuantity} un.</span>
                                      </div>
                                      <Check className={cn("h-4 w-4", i.id === field.value ? "opacity-100" : "opacity-0")}/>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent></Popover>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`equipment.${index}.customDailyRentalRate`} render={({ field }) => (
                    <FormItem className="min-w-[120px]">
                      {index === 0 && <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Taxa</FormLabel>}
                      <FormControl><Input type={focusedCurrencyField === `rate-${index}` ? 'number' : 'text'} value={focusedCurrencyField === `rate-${index}` ? (field.value ?? '') : formatToBRL(field.value)} onFocus={() => setFocusedCurrencyField(`rate-${index}`)} onBlur={() => setFocusedCurrencyField(null)} onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} step="0.01" className="h-10"/></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`equipment.${index}.quantity`} render={({ field }) => (
                    <FormItem className="min-w-[80px]">
                      {index === 0 && <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Qtd.</FormLabel>}
                      <FormControl><Input type="number" {...field} min="1" className="h-10"/></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:bg-destructive/10 h-10 w-10 shrink-0 self-end"><Trash2 className="h-5 w-5"/></Button>
                </div>
              )})}
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-3 border-dashed" onClick={() => append({ equipmentId: '', quantity: 1, customDailyRentalRate: undefined })}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Item</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="rentalStartDate" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Data de Início</FormLabel>
                  <Popover modal={true}><PopoverTrigger asChild><FormControl>
                    <Button variant="outline" className={cn("h-11 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha...</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50"/></Button></FormControl></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR}/></PopoverContent></Popover>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="rentalDays" render={({ field }) => (<FormItem><FormLabel>Dias de Aluguel</FormLabel><FormControl><Input type="number" {...field} min="0.5" step="0.5" className="h-11"/></FormControl><FormMessage /></FormItem>)} />
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-6 p-3 border rounded-lg bg-card shadow-sm">
                  <FormField control={form.control} name="chargeSaturdays" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="text-sm font-medium cursor-pointer">Cobrar Sábados?</FormLabel>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="chargeSundays" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="text-sm font-medium cursor-pointer">Cobrar Domingos?</FormLabel>
                    </FormItem>
                  )} />
              </div>

              <div className="p-4 bg-primary/5 border rounded-lg border-primary/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground">Previsão de Devolução</p>
                      <p className="text-lg font-semibold">{watchedExpectedReturnDate ? format(watchedExpectedReturnDate, "EEEE, d 'de' MMMM", { locale: ptBR }) : "..."}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-background">{watchedRentalDays} dias</Badge>
              </div>
            </div>

            <FormField control={form.control} name="deliveryAddress" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground"/>Endereço</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem>)} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="freightValue" render={({ field }) => (<FormItem><FormLabel>Frete (R$)</FormLabel><FormControl><Input type={focusedCurrencyField === 'freight' ? 'number' : 'text'} value={focusedCurrencyField === 'freight' ? (field.value ?? '') : formatToBRL(field.value)} onFocus={() => setFocusedCurrencyField('freight')} onBlur={() => setFocusedCurrencyField(null)} onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="discountValue" render={({ field }) => (<FormItem><FormLabel>Desconto (R$)</FormLabel><FormControl><Input type={focusedCurrencyField === 'discount' ? 'number' : 'text'} value={focusedCurrencyField === 'discount' ? (field.value ?? '') : formatToBRL(field.value)} onFocus={() => setFocusedCurrencyField('discount')} onBlur={() => setFocusedCurrencyField(null)} onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))} /></FormControl></FormItem>)} />
            </div>

            <FormField control={form.control} name="value" render={({ field }) => (
              <FormItem><FormLabel className="text-lg font-bold">Valor Total do Orçamento</FormLabel>
                <FormControl><Input type="text" value={formatToBRL(field.value)} readOnly disabled className="bg-primary/5 font-bold text-2xl h-14 border-primary/30 text-primary" /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />

            <CardFooter className="px-0 pt-6 border-t gap-3 flex-wrap">
              <Button type="submit" size="lg" disabled={isLoading} className="flex-1 sm:flex-none">{isLoading ? 'Salvando...' : <><Save className="mr-2 h-5 w-5" /> {submitButtonText}</>}</Button>
              <Button type="button" variant="outline" size="lg" onClick={() => router.back()} className="flex-1 sm:flex-none"><ArrowLeft className="mr-2 h-5 w-5" /> Cancelar</Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
