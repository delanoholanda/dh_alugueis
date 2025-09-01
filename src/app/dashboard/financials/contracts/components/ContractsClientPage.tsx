
'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Filter, RotateCcw, PackageX, Eye } from 'lucide-react';
import { formatToBRL, getPaymentStatusVariant, paymentStatusMap, cn } from '@/lib/utils';
import type { RentalWithFinancials } from '../page';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ContractStatusFilter = 'all' | 'pending' | 'finalized';

export default function ContractsClientPage({ initialRentals }: { initialRentals: RentalWithFinancials[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatusFilter>('all');

  const sortedData = useMemo(() => {
    return [...initialRentals].sort((a,b) => parseISO(b.rentalStartDate).getTime() - parseISO(a.rentalStartDate).getTime());
  }, [initialRentals]);


  const filteredData = useMemo(() => {
    let data = [...sortedData];

    if (searchTerm) {
      data = data.filter(
        (r) =>
          r.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.id.toString().includes(searchTerm)
      );
    }
    
    if (statusFilter !== 'all') {
      data = data.filter(r => {
        const isReturned = !!r.actualReturnDate;
        const hasPendingPayment = r.pendingValue > 0.01;
        const isClosedContract = !r.isOpenEnded;

        switch (statusFilter) {
          case 'pending':
            return isReturned && isClosedContract && hasPendingPayment;
          case 'finalized':
            return isReturned;
          default:
            return true;
        }
      });
    }

    return data;
  }, [sortedData, searchTerm, statusFilter]);

  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, rental) => {
        acc.totalValue += rental.totalContractValue;
        acc.totalPaid += rental.totalPaid;
        acc.totalPending += rental.pendingValue;
        acc.totalFreight += rental.freightValue ?? 0;
        acc.totalItems += rental.itemsValue;
        return acc;
      },
      { totalValue: 0, totalPaid: 0, totalPending: 0, totalFreight: 0, totalItems: 0 }
    );
  }, [filteredData]);
  
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5 text-primary" /> Filtros e Busca</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Buscar por ID do contrato ou nome do cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="md:max-w-xs"
          />
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ContractStatusFilter)}>
            <SelectTrigger className="md:max-w-xs">
              <SelectValue placeholder="Filtrar por status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Contratos</SelectItem>
              <SelectItem value="pending">Pendentes de Pagamento (Devolvidos)</SelectItem>
              <SelectItem value="finalized">Finalizados (Devolvidos)</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={resetFilters} variant="outline" className="md:ml-auto">
            <RotateCcw className="mr-2 h-4 w-4" /> Limpar
          </Button>
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle>Lista de Contratos</CardTitle>
          <CardDescription>
            Exibindo {filteredData.length} de {initialRentals.length} contratos. Contratos "em aberto" têm o valor projetado para hoje.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {filteredData.length > 0 ? (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">ID</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Status Pag.</TableHead>
                            <TableHead className="text-right">Itens</TableHead>
                            <TableHead className="text-right">Frete</TableHead>
                            <TableHead className="text-right font-semibold">Total Contrato</TableHead>
                            <TableHead className="text-right">Pago / Pendente</TableHead>
                            <TableHead className="text-center w-[50px]">Ações</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredData.map((rental) => (
                            <TableRow key={rental.id}>
                                <TableCell className="font-mono">#{String(rental.id).padStart(4, '0')}</TableCell>
                                <TableCell className="font-medium">{rental.customerName}</TableCell>
                                <TableCell>
                                    <Badge variant={getPaymentStatusVariant(rental.paymentStatus)}>
                                    {paymentStatusMap[rental.paymentStatus]}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono">{formatToBRL(rental.itemsValue)}</TableCell>
                                <TableCell className="text-right font-mono">{formatToBRL(rental.freightValue ?? 0)}</TableCell>
                                <TableCell className="text-right font-mono font-semibold">{formatToBRL(rental.totalContractValue)}</TableCell>
                                <TableCell className={cn(
                                    "text-right font-mono font-semibold",
                                    rental.pendingValue > 0.01 ? 'text-red-600' : 'text-green-600'
                                )}>
                                    {rental.pendingValue > 0.01 ? `-${formatToBRL(rental.pendingValue)}` : formatToBRL(rental.totalPaid)}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Button asChild variant="ghost" size="icon">
                                        <Link href={`/dashboard/rentals/${rental.id}/details`} title="Ver detalhes do aluguel">
                                            <Eye className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-muted/50 font-bold hover:bg-muted/50">
                                <TableCell colSpan={3} className="text-right">Totais</TableCell>
                                <TableCell className="text-right font-mono">{formatToBRL(totals.totalItems)}</TableCell>
                                <TableCell className="text-right font-mono">{formatToBRL(totals.totalFreight)}</TableCell>
                                <TableCell className="text-right font-mono">{formatToBRL(totals.totalValue)}</TableCell>
                                <TableCell className="text-right font-mono">
                                    <span className="text-green-600">{formatToBRL(totals.totalPaid)}</span> / <span className="text-red-600">{formatToBRL(totals.totalPending)}</span>
                                </TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    <PackageX className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-4 text-lg">Nenhum contrato encontrado</p>
                    <p>Tente ajustar os filtros ou adicione novos aluguéis.</p>
                </div>
            )}
        </CardContent>
       </Card>
    </div>
  );
}
