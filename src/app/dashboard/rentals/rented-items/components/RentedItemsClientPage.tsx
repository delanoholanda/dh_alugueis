
'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { RentedItemInfo } from '../page';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Package, User, Calendar, Hash, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RentedItemsClientPage({ initialData }: { initialData: RentedItemInfo[] }) {

  return (
    <div className="space-y-6">
      {initialData.length > 0 ? (
        initialData.map(({ item, rentals, totalRented }) => (
          <Card key={item.id} className="shadow-lg">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 rounded-md">
                  <AvatarImage src={item.imageUrl || undefined} alt={item.name} className="object-contain p-1" />
                  <AvatarFallback className="rounded-md"><Package className="h-8 w-8 text-muted-foreground" /></AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="font-headline text-xl">{item.name}</CardTitle>
                  <CardDescription>ID do Item: {item.id}</CardDescription>
                </div>
              </div>
              <div className="text-center sm:text-right bg-muted text-muted-foreground p-3 rounded-md">
                <p className="text-sm font-semibold">Total Alugado</p>
                <p className="text-2xl font-bold text-primary">{totalRented}</p>
              </div>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="rentals">
                  <AccordionTrigger className="text-base">
                    Ver {rentals.length} contrato(s) ativo(s)
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {rentals.map((rental, index) => (
                        <div key={index} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3 border rounded-md hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div>
                                  <p className="text-sm font-medium">{rental.customerName}</p>
                                  <p className="flex items-center text-xs text-muted-foreground"><Hash className="h-3 w-3 mr-1" /> Contrato ID: {rental.rentalId}</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-3 text-sm flex-1 min-w-[180px]">
                               <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                               <div>
                                  <p>Qtd: <span className="font-semibold">{rental.quantity}</span></p>
                                  <p className="flex items-center text-xs text-muted-foreground"><Calendar className="h-3 w-3 mr-1" /> Devolução: 
                                    <span className="ml-1">
                                      {rental.expectedReturnDate === 'Em Aberto' 
                                        ? rental.expectedReturnDate 
                                        : format(parseISO(rental.expectedReturnDate), 'dd/MM/yyyy', { locale: ptBR })}
                                    </span>
                                  </p>
                               </div>
                          </div>
                           <Button asChild variant="outline" size="sm" className="ml-auto">
                              <Link href={`/dashboard/rentals/${rental.rentalId}/details`}>
                                <Eye className="mr-2 h-4 w-4" /> Ver Aluguel
                              </Link>
                            </Button>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card className="shadow-lg col-span-full">
          <CardContent className="py-12 text-center">
            <Package className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum item alugado no momento.</h3>
            <p className="text-muted-foreground">Todos os seus equipamentos estão disponíveis no inventário.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
