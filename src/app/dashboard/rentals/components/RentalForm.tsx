'use client';

import type { Rental, Customer, Equipment as InventoryEquipment, PaymentMethod, EquipmentType } from '@/types';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, PlusCircle, Trash2, Save, Truck, Percent, UserPlus, MapPin, ChevronsUpDown, Check, Package, Fuel, ArrowLeft, CalendarDays } from 'lucide-react';
import { format, addDays, parseISO, isSameDay, isWithinInterval, startOfDay, endOfDay, eachDayOfInterval, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { formatToBRL, cn, findNthBillableDay } from '@/lib/utils';
import { CustomerForm } from '@/app/dashboard/customers/components/CustomerForm';
import { createCustomer, getCustomers } from '@/actions/customerActions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const rentalFormSchema = z.object({
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
  rentalStartDate: z.date({ required_error: "Data de início do aluguel é obrigatória." }),
  expectedReturnDate: z.date().optional(),
  isOpenEnded: z.boolean().default(false),
  chargeSaturdays: z.boolean().default(true),
  chargeSundays: z.boolean().default(true),
  rentalDays: z.coerce.number({invalid_type_error: "Dias de aluguel deve ser um número."})
      .min(0, "Dias de aluguel deve ser no mínimo 0"),
  freightValue: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? 0 : val), 
      z.coerce.number({invalid_type_error: "Valor do frete deve ser um número."})
        .min(0, "Valor do frete não pode ser negativo")
        .optional()
    ),
  fuelValue: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? 0 : val), 
      z.coerce.number({invalid_type_error: "Valor do combustível deve ser um número."})
        .min(0, "Valor do combustível não pode ser negativo")
        .optional()
    ),
  deliveredWithFullTank: z.boolean().default(false),
  discountValue: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? 0 : val),
      z.coerce.number({invalid_type_error: "Valor do desconto deve ser um número."})
      .min(0, "Valor do desconto não pode ser negativo")
      .optional()
    ),
  value: z.coerce.number({invalid_type_error: "Valor deve ser um número.", required_error: "Valor é obrigatório."})
    .min(0, "Valor não pode ser negativo"),
  paymentStatus: z.enum(['paid', 'pending', 'overdue']),
  paymentMethod: z.enum(['pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'nao_definido']).optional(),
  paymentDate: z.date().optional(),
  notes: z.string().optional(),
  deliveryAddress: z.string().optional(),
});

type RentalFormValues = z.infer<typeof rentalFormSchema>;

interface RentalFormProps {
  initialData?: Rental;
  customers: Customer[];
  inventory: InventoryEquipment[];
  equipmentTypes: EquipmentType[];
  allRentals: Rental[]; 
  onSubmitAction: (data: RentalFormValues) => Promise<Rental | null | void>;
  formTitle: string;
  submitButtonText: string;
}

export function RentalForm({ 
  initialData, 
  customers: initialCustomers, 
  inventory: initialInventory, 
  allRentals, 
  onSubmitAction, 
  formTitle, 
  submitButtonText 
}: RentalFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [customerList, setCustomerList] = useState<Customer[]>(() => initialCustomers.sort((a, b) => a.name.localeCompare(b.name)));
  const [inventoryList, setInventoryList] = useState<InventoryEquipment[]>(() => initialInventory.sort((a, b) => a.name.localeCompare(b.name)));
  
  const [openCustomerCombobox, setOpenCustomerCombobox] = useState(false);
  const [openEquipmentCombobox, setOpenEquipmentCombobox] = useState<Record<number, boolean>>({});
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
  const [focusedCurrencyField, setFocusedCurrencyField] = useState<string | null>(null);

  const form = useForm<RentalFormValues>({
    resolver: zodResolver(rentalFormSchema),
    defaultValues: initialData ? {
      customerId: initialData.customerId,
      rentalStartDate: initialData.rentalStartDate ? parseISO(initialData.rentalStartDate) : new Date(),
      expectedReturnDate: initialData.expectedReturnDate ? parseISO(initialData.expectedReturnDate) : undefined,
      isOpenEnded: initialData.isOpenEnded ?? false,
      chargeSaturdays: initialData.chargeSaturdays ?? true,
      chargeSundays: initialData.chargeSundays ?? true,
      rentalDays: initialData.isOpenEnded ? 0 : initialData.rentalDays,
      freightValue: initialData.freightValue || 0,
      discountValue: initialData.discountValue || 0,
      fuelValue: initialData.fuelValue || 0,
      deliveredWithFullTank: initialData.deliveredWithFullTank || false,
      value: initialData.value,
      paymentStatus: initialData.paymentStatus,
      paymentMethod: initialData.paymentMethod || 'pix',
      paymentDate: initialData.paymentDate ? parseISO(initialData.paymentDate) : undefined,
      notes: initialData.notes ?? '', 
      deliveryAddress: initialData.deliveryAddress || 'A definir',
      equipment: initialData.equipment.map(eq => ({
        equipmentId: eq.equipmentId,
        quantity: eq.quantity,
        customDailyRentalRate: eq.customDailyRentalRate === null ? undefined : eq.customDailyRentalRate 
      })),
    } : {
      customerId: '',
      equipment: [{ equipmentId: '', quantity: 1, customDailyRentalRate: undefined }],
      rentalStartDate: new Date(),
      expectedReturnDate: undefined, 
      isOpenEnded: false,
      chargeSaturdays: true,
      chargeSundays: true,
      rentalDays: 1,
      freightValue: 0,
      discountValue: 0,
      fuelValue: 0,
      deliveredWithFullTank: false,
      value: 0,
      paymentStatus: 'pending',
      paymentMethod: 'pix',
      paymentDate: undefined,
      notes: '',
      deliveryAddress: 'A definir',
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "equipment" });
  const watchedIsOpenEnded = form.watch("isOpenEnded");
  const watchedEquipment = form.watch("equipment");
  const watchedRentalDays = form.watch("rentalDays");
  const watchedRentalStartDate = form.watch("rentalStartDate");
  const watchedChargeSaturdays = form.watch("chargeSaturdays");
  const watchedChargeSundays = form.watch("chargeSundays");
  const watchedExpectedReturnDate = form.watch("expectedReturnDate");
  const watchedFreightValue = form.watch("freightValue");
  const watchedFuelValue = form.watch("fuelValue");
  const watchedDiscountValue = form.watch("discountValue");

  const inventoryWithAvailability = useMemo(() => {
    const startDate = watchedRentalStartDate;
    const isOpen = watchedIsOpenEnded;
    const endDate = isOpen ? addDays(new Date(), 365) : (watchedExpectedReturnDate || addDays(startDate, 1));
    
    if (!isValid(startDate) || !isValid(endDate)) return inventoryList.map(i => ({ ...i, availableQuantity: i.quantity }));

    const requestedInterval = { start: startOfDay(startDate), end: endOfDay(endDate) };
    const daysToCheck = eachDayOfInterval(requestedInterval);
    const usageOnEachDay = new Map<string, Map<string, number>>(); 
    for (const day of daysToCheck) usageOnEachDay.set(format(day, 'yyyy-MM-dd'), new Map<string, number>());

    for (const rental of allRentals) {
        if (initialData && String(rental.id) === String(initialData.id)) continue; 
        if (rental.actualReturnDate) continue;

        const rStart = startOfDay(parseISO(rental.rentalStartDate));
        const rEnd = rental.isOpenEnded ? addDays(new Date(), 365) : endOfDay(parseISO(rental.expectedReturnDate));
        const rentalInterval = { start: rStart, end: rEnd };

        for (const day of daysToCheck) {
            if (isWithinInterval(day, rentalInterval)) {
                const dayKey = format(day, 'yyyy-MM-dd');
                const dayMap = usageOnEachDay.get(dayKey)!;
                for (const eq of rental.equipment) {
                  dayMap.set(eq.equipmentId, (dayMap.get(eq.equipmentId) || 0) + eq.quantity);
                }
            }
        }
    }

    const maxUsageByOthers = new Map<string, number>();
    for (const [_, dayMap] of usageOnEachDay) {
        for (const [eqId, qty] of dayMap) {
            const currentMax = maxUsageByOthers.get(eqId) || 0;
            if (qty > currentMax) maxUsageByOthers.set(eqId, qty);
        }
    }
    
    return inventoryList.map(item => {
        const usageByOthers = maxUsageByOthers.get(item.id) || 0;
        const capacity = item.status === 'rented' ? 0 : item.quantity;
        const freeForEveryone = Math.max(0, capacity - usageByOthers);
        
        let availableForThisContract = freeForEveryone;
        if (initialData) {
            const currentQtyInThisRental = initialData.equipment.find(e => e.equipmentId === item.id)?.quantity || 0;
            availableForThisContract += currentQtyInThisRental;
        }

        return { ...item, availableQuantity: availableForThisContract };
    });
  }, [inventoryList, allRentals, initialData, watchedRentalStartDate, watchedExpectedReturnDate, watchedIsOpenEnded]);

  useEffect(() => {
    if (watchedIsOpenEnded) {
        form.setValue('rentalDays', 0);
        form.setValue('expectedReturnDate', undefined);
    } else {
        if (form.getValues('rentalDays') === 0) form.setValue('rentalDays', 1);
    }
  }, [watchedIsOpenEnded, form]);

  useEffect(() => {
    if (watchedIsOpenEnded) return;
    const startDate = watchedRentalStartDate;
    const days = watchedRentalDays;
    if (startDate && !isNaN(days) && days > 0) {
        const newEndDate = findNthBillableDay(startDate, days, watchedChargeSaturdays, watchedChargeSundays);
        if (!watchedExpectedReturnDate || !isSameDay(watchedExpectedReturnDate, newEndDate)) {
          form.setValue('expectedReturnDate', newEndDate, { shouldValidate: true });
        }
    }
  }, [watchedRentalDays, watchedRentalStartDate, watchedChargeSaturdays, watchedChargeSundays, watchedIsOpenEnded, form]);
  
  useEffect(() => {
    const days = !watchedIsOpenEnded ? (Number(watchedRentalDays) || 0) : 1;
    let itemsTotalValue = 0;
    watchedEquipment.forEach(item => {
      const qty = Number(item.quantity) || 0;
      if (item.equipmentId && qty > 0) {
        const details = inventoryList.find(inv => inv.id === item.equipmentId);
        if (details) {
          const rate = item.customDailyRentalRate ?? details.dailyRentalRate ?? 0;
          itemsTotalValue += (qty * rate * days);
        }
      }
    });
    const freight = Number(watchedFreightValue) || 0;
    const fuel = Number(watchedFuelValue) || 0;
    const discount = Number(watchedDiscountValue) || 0;
    const final = watchedIsOpenEnded ? itemsTotalValue : itemsTotalValue + freight + fuel - discount;
    form.setValue('value', Math.max(0, final), { shouldValidate: true });
  }, [watchedEquipment, watchedRentalDays, watchedFreightValue, watchedFuelValue, watchedDiscountValue, inventoryList, watchedIsOpenEnded, form]);

  const handleNewCustomerCreated = async (data: Omit<Customer, 'id'>) => {
    const newCustomer = await createCustomer(data); 
    if (newCustomer) {
      const refreshed = await getCustomers(); 
      setCustomerList(refreshed.sort((a, b) => a.name.localeCompare(b.name)));
      form.setValue('customerId', newCustomer.id, { shouldValidate: true });
      setIsCustomerFormOpen(false); 
    }
  };

  const onSubmit = async (data: RentalFormValues) => {
    setIsLoading(true);
    let validationPassed = true;
    const availabilityMap = new Map<string, number>();
    inventoryWithAvailability.forEach(item => availabilityMap.set(item.id, item.availableQuantity));

    data.equipment.forEach((eqInForm, index) => {
        if (!eqInForm.equipmentId) return; 
        const available = availabilityMap.get(eqInForm.equipmentId) || 0;
        if (eqInForm.quantity > available) {
            form.setError(`equipment.${index}.quantity`, { message: `Livre: ${available} un.` });
            validationPassed = false;
        }
    });

    if (!validationPassed) {
        setIsLoading(false);
        toast({ title: "Verificar Disponibilidade", variant: "destructive" });
        return;
    }

    const actionData = {
      ...data,
      rentalStartDate: format(data.rentalStartDate, 'yyyy-MM-dd'),
      expectedReturnDate: data.expectedReturnDate ? format(data.expectedReturnDate, 'yyyy-MM-dd') : undefined,
      paymentDate: data.paymentDate ? format(data.paymentDate, 'yyyy-MM-dd') : undefined,
    } as any;

    try {
      await onSubmitAction(actionData);
      toast({ title: `Aluguel Salvo com Sucesso`, variant: 'success' });
      router.back();
    } catch (error) {
      toast({ title: 'Erro ao Salvar', description: (error as Error).message, variant: 'destructive' });
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
                        <Button variant="outline" role="combobox" className={cn("w-full h-11 justify-between", !field.value && "text-muted-foreground")}>
                          <div className="flex items-center gap-2 overflow-hidden">
                            {selectedCustomer && (
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={selectedCustomer.imageUrl || undefined} />
                                <AvatarFallback>{selectedCustomer.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                            )}
                            <span className="truncate">{selectedCustomer ? selectedCustomer.name : "Selecione um cliente..."}</span>
                          </div>
                          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                        </Button>
                      </FormControl></PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar cliente por nome..." />
                          <CommandList>
                            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                            <CommandGroup>
                              {customerList.map((c) => (
                                <CommandItem key={c.id} onSelect={() => { form.setValue("customerId", c.id, { shouldValidate: true }); setOpenCustomerCombobox(false); }}>
                                  <div className="flex items-center gap-3 w-full">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={c.imageUrl || undefined} />
                                      <AvatarFallback>{c.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="flex-grow">{c.name}</span>
                                    <Check className={cn("h-4 w-4", c.id === field.value ? "opacity-100" : "opacity-0")} />
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => setIsCustomerFormOpen(true)} title="Adicionar Novo Cliente"><UserPlus className="h-5 w-5" /></Button>
                    <Dialog open={isCustomerFormOpen} onOpenChange={setIsCustomerFormOpen}>{isCustomerFormOpen && <CustomerForm onSubmitAction={handleNewCustomerCreated} onClose={() => setIsCustomerFormOpen(false)} isSubForm={true} />}</Dialog>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField control={form.control} name="isOpenEnded" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-primary/5">
                    <div className="space-y-0.5">
                        <FormLabel className="text-base font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary"/> Contrato em Aberto?</FormLabel>
                        <FormDescription className="text-xs">Marque se não houver data definida para a devolução.</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
            )} />

            <div>
              <FormLabel className="text-base font-semibold flex items-center gap-2 mb-2"><Package className="h-5 w-5 text-primary" /> Equipamentos</FormLabel>
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
                          <Button variant="outline" role="combobox" className="w-full h-10 justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                                {selectedInventoryItem?.imageUrl && (
                                    <div className="h-6 w-6 relative rounded overflow-hidden border bg-background shrink-0">
                                        <Image src={selectedInventoryItem.imageUrl} alt="" fill className="object-contain" />
                                    </div>
                                )}
                                <span className="truncate">{selectedInventoryItem ? selectedInventoryItem.name : "Selecionar item..."}</span>
                            </div>
                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0"/>
                          </Button>
                        </FormControl></PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar equipamento..." />
                            <CommandList>
                              <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
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
                                        <span className={cn("text-[10px]", i.availableQuantity > 0 ? "text-green-600" : "text-destructive font-bold")}>Livre para você: {i.availableQuantity} un.</span>
                                      </div>
                                      <Check className={cn("h-4 w-4 shrink-0", i.id === field.value ? "opacity-100" : "opacity-0")}/>
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
                      {index === 0 && <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Taxa Diária</FormLabel>}
                      <FormControl><Input 
                        type={focusedCurrencyField === `rate-${index}` ? 'number' : 'text'} 
                        value={focusedCurrencyField === `rate-${index}` ? (field.value ?? '') : formatToBRL(field.value)} 
                        onFocus={() => setFocusedCurrencyField(`rate-${index}`)} 
                        onBlur={() => setFocusedCurrencyField(null)} 
                        onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} 
                        step="0.01"
                        className="h-10"
                      /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`equipment.${index}.quantity`} render={({ field }) => (
                    <FormItem className="min-w-[80px]">
                      {index === 0 && <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Qtd.</FormLabel>}
                      <FormControl><Input type="number" {...field} min="1" className="h-10"/></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} title="Remover item" className="text-destructive hover:bg-destructive/10 h-10 w-10 shrink-0 self-end"><Trash2 className="h-5 w-5"/></Button>
                </div>
              )})}
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-3 border-dashed" onClick={() => append({ equipmentId: '', quantity: 1, customDailyRentalRate: undefined })}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Outro Item</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="rentalStartDate" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Data de Início</FormLabel>
                  <Popover modal={true}><PopoverTrigger asChild><FormControl>
                    <Button variant="outline" className={cn("h-11 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                      {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha uma data...</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50"/>
                    </Button>
                  </FormControl></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR}/></PopoverContent></Popover>
                  <FormMessage />
                </FormItem>
              )} />
              
              {!watchedIsOpenEnded && (
                <FormField control={form.control} name="rentalDays" render={({ field }) => (
                  <FormItem><FormLabel>Duração (Dias)</FormLabel><FormControl><Input type="number" {...field} min="0.5" step="0.5" className="h-11"/></FormControl><FormMessage /></FormItem>
                )} />
              )}
            </div>

            {!watchedIsOpenEnded && (
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
                  
                  <div className="p-4 bg-muted/30 border rounded-lg border-primary/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground">Previsão de Devolução</p>
                        <p className="text-lg font-semibold">{watchedExpectedReturnDate ? format(watchedExpectedReturnDate, "EEEE, d 'de' MMMM", { locale: ptBR }) : "Aguardando definição..."}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-background">{watchedRentalDays} dias cobráveis</Badge>
                  </div>
               </div>
            )}

            <FormField control={form.control} name="deliveryAddress" render={({ field }) => (
              <FormItem><FormLabel className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground"/> Endereço de Entrega</FormLabel><FormControl><Textarea placeholder="ex: Rua Tal, 123, Obra X..." {...field} rows={2} /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="freightValue" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-1"><Truck className="h-3 w-3"/> Frete (R$)</FormLabel><FormControl><Input type={focusedCurrencyField === 'freight' ? 'number' : 'text'} value={focusedCurrencyField === 'freight' ? (field.value ?? '') : formatToBRL(field.value)} onFocus={() => setFocusedCurrencyField('freight')} onBlur={() => setFocusedCurrencyField(null)} onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="fuelValue" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-1"><Fuel className="h-3 w-3"/> Combustível (R$)</FormLabel><FormControl><Input type={focusedCurrencyField === 'fuel' ? 'number' : 'text'} value={focusedCurrencyField === 'fuel' ? (field.value ?? '') : formatToBRL(field.value)} onFocus={() => setFocusedCurrencyField('fuel')} onBlur={() => setFocusedCurrencyField(null)} onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="discountValue" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-1"><Percent className="h-3 w-3"/> Desconto (R$)</FormLabel><FormControl><Input type={focusedCurrencyField === 'discount' ? 'number' : 'text'} value={focusedCurrencyField === 'discount' ? (field.value ?? '') : formatToBRL(field.value)} onFocus={() => setFocusedCurrencyField('discount')} onBlur={() => setFocusedCurrencyField(null)} onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))} /></FormControl></FormItem>)} />
            </div>

            <FormField control={form.control} name="value" render={({ field }) => (
              <FormItem><FormLabel className="text-lg font-bold">{watchedIsOpenEnded ? "Valor da Diária Base" : "Valor Total do Contrato"}</FormLabel>
                <FormControl><Input type="text" value={formatToBRL(field.value)} readOnly disabled className="bg-primary/5 font-bold text-2xl h-14 border-primary/30 text-primary" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-card shadow-inner">
                <FormField control={form.control} name="paymentStatus" render={({ field }) => (
                  <FormItem><FormLabel>Status de Pagamento</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="pending">Pendente</SelectItem><SelectItem value="paid">Pago / Quitado</SelectItem><SelectItem value="overdue">Atrasado</SelectItem></SelectContent></Select></FormItem>
                )} />
                <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                  <FormItem><FormLabel>Forma de Pagamento</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="pix">PIX</SelectItem><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="cartao_credito">Cartão Crédito</SelectItem><SelectItem value="cartao_debito">Cartão Débito</SelectItem><SelectItem value="nao_definido">A Definir</SelectItem></SelectContent></Select></FormItem>
                )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Observações Adicionais</FormLabel><FormControl><Textarea placeholder="ex: Deixar com o encarregado fulano..." {...field} /></FormControl></FormItem>)} />

            <CardFooter className="px-0 pt-6 border-t gap-3 flex-wrap">
              <Button type="submit" size="lg" disabled={isLoading} className="flex-1 sm:flex-none">
                {isLoading ? 'Salvando...' : <><Save className="mr-2 h-5 w-5" /> {submitButtonText}</>}
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => router.back()} className="flex-1 sm:flex-none" disabled={isLoading}><ArrowLeft className="mr-2 h-5 w-5" /> Cancelar</Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
