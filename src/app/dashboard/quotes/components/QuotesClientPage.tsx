
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getQuotes as fetchQuotesAction } from '@/actions/quoteActions';
import type { Quote, Equipment as InventoryEquipment, Customer } from '@/types';
import { Filter, RotateCcw, PackageX } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { QuoteActionsCell } from './QuoteActionsCell'; 

interface QuotesClientPageProps {
  initialQuotes: Quote[];
  initialInventory: InventoryEquipment[];
  initialCustomers: Customer[];
}

export default function QuotesClientPage({ initialQuotes, initialInventory, initialCustomers }: QuotesClientPageProps) {
  const [allQuotes, setAllQuotes] = useState<Quote[]>(initialQuotes);
  const [inventoryItems, setInventoryItems] = useState<InventoryEquipment[]>(initialInventory);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const quotesData = await fetchQuotesAction();
      setAllQuotes(quotesData);
    } catch (error) {
      console.error("Failed to refresh data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let currentFiltered = [...allQuotes];

    if (searchTerm) {
      currentFiltered = currentFiltered.filter(quote =>
        quote.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.id.toString().includes(searchTerm)
      );
    }
    
    currentFiltered.sort((a, b) => {
        if (a.status === 'converted' && b.status !== 'converted') return 1;
        if (a.status !== 'converted' && b.status === 'converted') return -1;
        return parseISO(b.quoteDate).getTime() - parseISO(a.quoteDate).getTime();
    });

    setFilteredQuotes(currentFiltered);
  }, [searchTerm, allQuotes]);

  const resetFilters = () => {
    setSearchTerm('');
  };
  
  return (
    <>
      <Card className="mb-6 shadow-md">
        <CardHeader>
            <CardTitle className="text-lg flex items-center"><Filter className="mr-2 h-5 w-5 text-primary"/> Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1 col-span-1 sm:col-span-2 md:col-span-3">
                <label htmlFor="search-customer" className="text-sm font-medium text-muted-foreground">ID ou Cliente</label>
                <Input
                id="search-customer"
                placeholder="Buscar por ID do orçamento ou nome do cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Button onClick={resetFilters} variant="outline" className="self-end">
                <RotateCcw className="mr-2 h-4 w-4" /> Limpar Filtros
            </Button>
        </CardContent>
      </Card>

      <div className="mb-4 text-sm text-muted-foreground">
          Exibindo {filteredQuotes.length} de {allQuotes.length} orçamentos.
      </div>

      {filteredQuotes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredQuotes.map((quote) => {
            const customer = customers.find(c => c.id === quote.customerId);
            return (
              <Card key={quote.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-3 flex-grow min-w-0">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={customer?.imageUrl || undefined} alt={customer?.name || 'Avatar'} />
                        <AvatarFallback>{customer ? customer.name.charAt(0).toUpperCase() : 'C'}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <CardTitle className="text-base font-headline truncate" title={quote.customerName}>
                          {quote.customerName}
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                          Orçamento ID: {String(quote.id).padStart(4, '0')}
                        </CardDescription>
                      </div>
                    </div>
                     <Badge variant={quote.status === 'converted' ? 'success' : 'secondary'} className="capitalize">{quote.status === 'converted' ? 'Convertido' : 'Pendente'}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm flex-grow">
                    <p><strong>Data:</strong> {format(parseISO(quote.quoteDate), 'P', { locale: ptBR })}</p>
                    <p><strong>Valor Total:</strong> {formatToBRL(quote.value)}</p>
                    <p><strong>Itens:</strong> {quote.equipment.reduce((acc, eq) => acc + eq.quantity, 0)}</p>
                </CardContent>
                <CardFooter className="border-t pt-3 pb-3 px-4">
                  <QuoteActionsCell quote={quote} onActionSuccess={refreshData} />
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="shadow-lg col-span-full">
            <CardContent className="py-12 text-center">
                <PackageX className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum orçamento encontrado.</h3>
                <p className="text-muted-foreground">
                {allQuotes.length === 0 
                    ? "Nenhum orçamento foi registrado ainda." 
                    : "Tente ajustar os filtros para encontrar o que procura."}
                </p>
                 {allQuotes.length > 0 && (
                     <Button onClick={resetFilters} variant="outline" className="mt-4">
                        <RotateCcw className="mr-2 h-4 w-4" /> Limpar Filtros
                    </Button>
                )}
            </CardContent>
        </Card>
      )}
    </>
  );
}
