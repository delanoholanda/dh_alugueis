
'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import type { ItemPerformanceData } from '../page';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Package, DollarSign, Calendar, Filter, RotateCcw, Truck, Fuel } from 'lucide-react';
import { formatToBRL } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export default function ItemPerformanceClientPage({ initialData }: { initialData: ItemPerformanceData[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm) {
      return initialData;
    }
    return initialData.filter(d =>
      d.item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [initialData, searchTerm]);
  
  const totals = useMemo(() => {
    return filteredData.reduce(
        (acc, item) => {
            if (item.item.id.startsWith('virtual_')) {
                acc.totalRevenue += item.totalRevenue;
            } else {
                acc.totalPaidDays += item.totalPaidDays;
                acc.totalRevenue += item.totalRevenue;
            }
            return acc;
        },
        { totalPaidDays: 0, totalRevenue: 0 }
    );
  }, [filteredData]);
  
  const getIconForItem = (item: ItemPerformanceData['item']) => {
    if (item.id === 'virtual_freight') return <Truck className="h-5 w-5 text-muted-foreground" />;
    if (item.id === 'virtual_fuel') return <Fuel className="h-5 w-5 text-muted-foreground" />;
    return <Package className="h-5 w-5 text-muted-foreground" />;
  }


  return (
    <div className="space-y-6">
       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5 text-primary" /> Filtros e Busca</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Buscar por nome do item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="md:max-w-xs"
          />
          <Button onClick={() => setSearchTerm('')} variant="outline" className="md:ml-auto">
            <RotateCcw className="mr-2 h-4 w-4" /> Limpar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Relatório de Desempenho</CardTitle>
          <CardDescription>
            Análise baseada em aluguéis com status "Pago". Mostrando {filteredData.length} de {initialData.length} itens que geraram receita.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Item / Serviço</TableHead>
                  <TableHead className="text-right">Diárias / Cobranças</TableHead>
                  <TableHead className="text-right">Receita Total Gerada</TableHead>
                  <TableHead className="text-right">Receita Média / Diária</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? (
                  filteredData.map(({ item, totalPaidDays, totalRevenue }) => {
                    const isVirtual = item.id.startsWith('virtual_');
                    const averageRevenuePerDay = totalPaidDays > 0 ? totalRevenue / totalPaidDays : 0;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 rounded-md">
                              <AvatarImage src={item.imageUrl || undefined} alt={item.name} className="object-contain p-1" />
                              <AvatarFallback className="rounded-md">{getIconForItem(item)}</AvatarFallback>
                            </Avatar>
                            <span>{item.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                           {isVirtual ? Math.round(totalPaidDays) : Math.round(totalPaidDays)}
                           <span className="text-xs text-muted-foreground">{isVirtual ? 'x' : ' dias'}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                           {formatToBRL(totalRevenue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-primary font-bold">
                           {formatToBRL(averageRevenuePerDay)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">Nenhum item encontrado.</TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/50 font-bold hover:bg-muted/50">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right font-mono">{Math.round(totals.totalPaidDays)} <span className="text-xs text-muted-foreground">dias</span></TableCell>
                    <TableCell className="text-right font-mono">{formatToBRL(totals.totalRevenue)}</TableCell>
                    <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

