
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Rental, Customer, Equipment as InventoryItem, EquipmentType } from '@/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, Eye, Package, ChevronsUpDown, Check, X } from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


export default function SchedulingClientPage({
  initialRentals,
  initialInventory,
}: {
  initialRentals: Rental[];
  initialCustomers: Customer[];
  initialInventory: InventoryItem[];
  initialEquipmentTypes: EquipmentType[];
}) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{ date: Date; events: Rental[] } | null>(null);

  const eventsByDay = useMemo(() => {
    const events: Record<string, Rental[]> = {};
    const rentalsToDisplay = selectedEquipmentIds.length > 0
      ? initialRentals.filter(rental => rental.equipment.some(eq => selectedEquipmentIds.includes(eq.equipmentId)))
      : initialRentals;

    rentalsToDisplay.forEach(rental => {
      const start = parseISO(rental.rentalStartDate);
      // For display purposes, render open-ended rentals for a long time.
      const end = rental.isOpenEnded ? new Date(new Date().setFullYear(new Date().getFullYear() + 5)) : parseISO(rental.expectedReturnDate);
      
      let currentDate = start;
      while (currentDate <= end) {
        const dayKey = format(currentDate, 'yyyy-MM-dd');
        if (!events[dayKey]) {
          events[dayKey] = [];
        }
        events[dayKey].push(rental);
        currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
      }
    });
    return events;
  }, [initialRentals, selectedEquipmentIds]);
  
  const DayWithEvents = (props: { date: Date } & React.ComponentProps<'div'>) => {
    const { date, ...divProps } = props;
    const dayKey = format(date, 'yyyy-MM-dd');
    const dayEvents = eventsByDay[dayKey] || [];
    
    // Explicitly destructure and remove props that shouldn't be passed to the DOM element
    const { displayMonth, ...validDivProps } = divProps as any;

    const handleDayClick = () => {
      setSelectedDay({ date, events: dayEvents });
      setIsDialogOpen(true);
    };
    
    const getFirstName = (fullName?: string) => {
        if (!fullName) return 'Cliente';
        return fullName.split(' ')[0];
    }
    
    const totalItemsForDay = useMemo(() => {
      if (!dayEvents || dayEvents.length === 0) return 0;
      return dayEvents.reduce((total, rental) => {
        return total + rental.equipment.reduce((rentalTotal, eq) => {
          if (selectedEquipmentIds.length === 0 || selectedEquipmentIds.includes(eq.equipmentId)) {
            return rentalTotal + eq.quantity;
          }
          return rentalTotal;
        }, 0);
      }, 0);
    }, [dayEvents, selectedEquipmentIds]);

    return (
      <div
        {...validDivProps}
        className="relative flex flex-col h-24 p-1 border-t border-l group hover:bg-accent/50 transition-colors cursor-pointer"
        onClick={handleDayClick}
      >
        <time dateTime={format(date, 'yyyy-MM-dd')} className={cn("text-xs font-semibold", isToday(date) && "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center")}>
          {format(date, 'd')}
        </time>
        <div className="flex-grow overflow-y-auto mt-1 space-y-0.5 hide-scrollbar">
          {dayEvents.slice(0, 2).map(event => (
            <div key={event.id} className="text-[10px] leading-tight px-1 rounded-sm bg-primary/20 text-primary-foreground truncate" title={event.customerName}>
              {getFirstName(event.customerName)}
            </div>
          ))}
          {dayEvents.length > 2 && (
            <div className="text-[10px] text-muted-foreground font-semibold">+ {dayEvents.length - 2} mais</div>
          )}
        </div>
        {totalItemsForDay > 0 && (
          <div className="flex items-center justify-center text-xs text-muted-foreground font-bold mt-auto pt-1 border-t border-dashed">
            <Package className="h-3 w-3 mr-1" />
            {totalItemsForDay}
          </div>
        )}
         <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <PlusCircle className="h-4 w-4 text-primary" />
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Add this style block to hide the scrollbar */}
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
        }
      `}</style>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex-grow">
              <CardTitle className="font-headline">Calendário de Aluguéis</CardTitle>
              <p className="text-sm text-muted-foreground">Filtre por equipamento para ver a disponibilidade.</p>
            </div>
            <div className="flex items-center gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-[300px] justify-start">
                            <Package className="mr-2 h-4 w-4" />
                            {selectedEquipmentIds.length > 0 ? `${selectedEquipmentIds.length} equipamento(s) selecionado(s)` : 'Filtrar por equipamento...'}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="end">
                        <Command>
                            <CommandInput placeholder="Buscar equipamento..." />
                            <CommandList>
                                <CommandEmpty>Nenhum equipamento encontrado.</CommandEmpty>
                                <CommandGroup>
                                    {initialInventory.map((item) => {
                                        const isSelected = selectedEquipmentIds.includes(item.id);
                                        return (
                                        <CommandItem
                                            key={item.id}
                                            onSelect={() => {
                                                if (isSelected) {
                                                    setSelectedEquipmentIds(selectedEquipmentIds.filter(id => id !== item.id));
                                                } else {
                                                    setSelectedEquipmentIds([...selectedEquipmentIds, item.id]);
                                                }
                                            }}
                                        >
                                            <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                               <Check className={cn("h-4 w-4")} />
                                            </div>
                                            <span>{item.name}</span>
                                        </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                                {selectedEquipmentIds.length > 0 && (
                                    <>
                                    <CommandGroup>
                                        <CommandItem onSelect={() => setSelectedEquipmentIds([])} className="justify-center text-center text-sm font-medium text-destructive">
                                            Limpar Filtros
                                        </CommandItem>
                                    </CommandGroup>
                                    </>
                                )}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

                <Button asChild>
                <Link href="/dashboard/rentals/new">
                    <PlusCircle className="mr-2 h-4 w-4" /> Novo Aluguel
                </Link>
                </Button>
            </div>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
              <Calendar
                mode="single"
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="p-0 w-full min-w-[800px]"
                classNames={{
                  months: 'w-full',
                  month: 'w-full space-y-4',
                  table: 'w-full border-collapse',
                  head_row: 'flex border-b',
                  head_cell: 'text-muted-foreground w-full basis-0 flex-1 justify-center text-sm font-normal py-2',
                  row: 'flex w-full mt-0',
                  cell: 'h-24 w-full basis-0 flex-1 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
                  day: 'h-full w-full p-0',
                  day_selected: 'bg-accent text-accent-foreground',
                  day_today: 'bg-accent text-accent-foreground',
                  day_outside: 'text-muted-foreground opacity-50',
                  day_disabled: 'text-muted-foreground opacity-50',
                }}
                components={{
                  Day: DayWithEvents,
                }}
                locale={ptBR}
              />
          </div>
        </CardContent>
      </Card>
      
      {/* Day Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle>Aluguéis em {selectedDay ? format(selectedDay.date, 'PPP', { locale: ptBR }) : ''}</DialogTitle>
                  <DialogDescription>
                      {selectedDay?.events.length || 0} contrato(s) ativo(s) para esta data.
                  </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto space-y-1 py-4 pr-3">
                  {selectedDay && selectedDay.events.length > 0 ? (
                      <Accordion type="single" collapsible className="w-full">
                        {selectedDay.events.map(event => (
                            <AccordionItem value={`item-${event.id}`} key={event.id} className="border rounded-md hover:bg-muted/50 transition-colors">
                                <AccordionTrigger className="p-3 w-full hover:no-underline [&[data-state=open]]:border-b">
                                   <div className="flex justify-between items-center w-full">
                                        <div>
                                            <p className="font-semibold text-left">{event.customerName}</p>
                                            <p className="text-xs text-muted-foreground text-left">ID: {String(event.id).padStart(4, '0')}</p>
                                        </div>
                                        <Button asChild variant="ghost" size="sm" onClick={(e) => e.stopPropagation()} className="mr-2">
                                            <Link href={`/dashboard/rentals/${event.id}/details`}>
                                                <Eye className="mr-2 h-4 w-4"/>
                                                Ver
                                            </Link>
                                        </Button>
                                   </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="px-4 pb-3 pt-2 text-sm">
                                        <h4 className="font-semibold mb-2 flex items-center"><Package className="h-4 w-4 mr-2 text-muted-foreground"/> Itens Alugados:</h4>
                                        {event.equipment.length > 0 ? (
                                            <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-2">
                                                {event.equipment.map((eq, index) => (
                                                    <li key={index}>
                                                        {eq.quantity}x {eq.name || 'Equipamento desconhecido'}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-muted-foreground italic">Nenhum item listado neste aluguel.</p>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                      </Accordion>
                  ) : (
                      <p className="text-muted-foreground text-center py-4">Nenhum aluguel agendado para este dia.</p>
                  )}
              </div>
              <DialogFooter>
                  <Button asChild>
                      <Link href={`/dashboard/rentals/new?startDate=${selectedDay ? format(selectedDay.date, 'yyyy-MM-dd') : ''}`}>
                          <PlusCircle className="mr-2 h-4 w-4" /> Novo Aluguel
                      </Link>
                  </Button>
                  <DialogClose asChild>
                      <Button variant="outline">Fechar</Button>
                  </DialogClose>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
}
