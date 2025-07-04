'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { getRentalById } from '@/actions/rentalActions';
import { getCustomerById } from '@/actions/customerActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatToBRL, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info, ListChecks, Banknote, ArrowLeft, CreditCard, Landmark, CircleDollarSign, Phone, Home, Fingerprint, MapPin, Camera, PackageX, Loader2, CheckSquare, Edit } from 'lucide-react';
import type { Rental, PaymentMethod, Customer, RentalPhoto, Equipment as InventoryEquipment } from '@/types';
import RentalPhotoGallery from '../../components/RentalPhotoGallery';
import { MarkAsPaidDialog } from '../../components/MarkAsPaidDialog';
import { Skeleton } from '@/components/ui/skeleton';
import FinalizeRentalButton from '../../components/FinalizeRentalButton';


const paymentStatusMap: Record<Rental['paymentStatus'], string> = {
  paid: 'Pago',
  pending: 'Pendente',
  overdue: 'Atrasado'
};

const paymentMethodMap: Record<PaymentMethod, { label: string, icon?: React.ElementType }> = {
  pix: { label: 'PIX', icon: Landmark },
  dinheiro: { label: 'Dinheiro', icon: CircleDollarSign },
  cartao_credito: { label: 'Cartão de Crédito', icon: CreditCard },
  cartao_debito: { label: 'Cartão de Débito', icon: CreditCard },
  nao_definido: { label: 'Não Definido', icon: Info },
};


function getPaymentStatusVariant(status: Rental['paymentStatus']) {
  switch (status) {
    case 'paid': return 'default';
    case 'pending': return 'secondary';
    case 'overdue': return 'destructive';
    default: return 'outline';
  }
}

const formatCpfForDisplay = (cpf: string | null | undefined): string => {
  if (!cpf) return 'Não informado';
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

export default function RentalDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const rentalId = Number(params.id);

  const [rental, setRental] = useState<Rental | null>(null);
  const [customer, setCustomer] = useState<Customer | undefined | null>(null);
  const [inventory, setInventory] = useState<InventoryEquipment[]>([]);
  const [totalDailyRate, setTotalDailyRate] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaidDialogOpen, setIsPaidDialogOpen] = useState(false);

  const fetchFullPageData = useCallback(async () => {
    if (isNaN(rentalId)) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    try {
        const fetchedRental = await getRentalById(rentalId);
        if (!fetchedRental) {
            setRental(null);
            setIsLoading(false);
            return;
        }

        const [fetchedInventory, fetchedCustomer] = await Promise.all([
            getInventoryItems(),
            fetchedRental.customerId ? getCustomerById(fetchedRental.customerId) : Promise.resolve(null),
        ]);

        let calculatedDailyRate = 0;
        fetchedRental.equipment.forEach(eq => {
            const inventoryItem = fetchedInventory.find(i => i.id === eq.equipmentId);
            const rateToUse = eq.customDailyRentalRate ?? inventoryItem?.dailyRentalRate ?? 0;
            calculatedDailyRate += rateToUse * eq.quantity;
        });

        setRental(fetchedRental);
        setCustomer(fetchedCustomer);
        setInventory(fetchedInventory);
        setTotalDailyRate(calculatedDailyRate);

    } catch (error) {
        console.error("Failed to fetch rental details:", error);
    } finally {
        setIsLoading(false);
    }
  }, [rentalId]);

  const refreshRentalOnly = useCallback(async () => {
    if (isNaN(rentalId)) {
        return;
    }
    try {
        const fetchedRental = await getRentalById(rentalId);
        if (fetchedRental) {
            setRental(fetchedRental);
        }
    } catch (error) {
        console.error("Failed to refresh rental photos:", error);
    }
  }, [rentalId]);

  useEffect(() => {
    fetchFullPageData();
  }, [fetchFullPageData]);

  const handleActionSuccess = async () => {
    await fetchFullPageData();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-2">
        {/* Page Header Skeleton */}
        <div className="mb-6 p-6 rounded-lg shadow bg-card">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8" />
                    <div>
                        <Skeleton className="h-7 w-64 md:w-80" />
                        <Skeleton className="h-4 w-80 md:w-96 mt-2" />
                    </div>
                </div>
                <div className="flex gap-2">
                   <Skeleton className="h-10 w-24" />
                   <Skeleton className="h-10 w-24" />
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Main info cards skeleton */}
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* General Info Card Skeleton */}
                <Card className="shadow-lg">
                    <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-4/6" />
                        <Skeleton className="h-4 w-full" />
                    </CardContent>
                </Card>
                {/* Equipment Card Skeleton */}
                <Card className="shadow-lg">
                    <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                </Card>
                {/* Financial Card Skeleton */}
                <Card className="shadow-lg">
                    <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-12 w-1/2" />
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-8 w-2/3" />
                        <Skeleton className="h-8 w-4/5" />
                    </CardContent>
                </Card>
            </div>

            {/* Photo Galleries Skeletons */}
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <Card className="shadow-lg">
                    <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
                    <CardContent><Skeleton className="aspect-square w-full" /></CardContent>
                </Card>
                <Card className="shadow-lg">
                    <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
                    <CardContent><Skeleton className="aspect-square w-full" /></CardContent>
                </Card>
            </div>
        </div>
      </div>
    );
  }

  if (!rental) {
    return (
        <div className="container mx-auto py-2">
        <PageHeader
            title="Aluguel não encontrado"
            icon={Info}
            description="O aluguel que você está procurando não existe ou foi removido."
            actions={
            <Button variant="outline" asChild>
                <Link href="/dashboard/rentals">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Aluguéis
                </Link>
            </Button>
            }
        />
        </div>
    );
  }

  const isPayable = (rental.paymentStatus === 'pending' || rental.paymentStatus === 'overdue') && !rental.isOpenEnded;
  const handleBadgeClick = () => {
    if (isPayable) {
        setIsPaidDialogOpen(true);
    }
  };

  const valorConsideradoPago = rental.paymentStatus === 'paid' ? rental.value : 0;
  const valorPendente = rental.paymentStatus !== 'paid' && !rental.isOpenEnded ? rental.value : 0;
  
  const paymentMethodDetails = paymentMethodMap[rental.paymentMethod || 'nao_definido'];
  const PaymentIcon = paymentMethodDetails?.icon;

  const deliveryPhotos = rental.photos?.filter(p => p.photoType === 'delivery') || [];
  const returnPhotos = rental.photos?.filter(p => p.photoType === 'return') || [];

  return (
    <>
    <div className="container mx-auto py-2">
      <PageHeader
        title={`Detalhes do Aluguel - ID: ${rental.id.toString().padStart(4,'0')}`}
        icon={Info}
        description="Visualize todas as informações sobre este contrato de aluguel."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" disabled={!!rental.actualReturnDate} title={rental.actualReturnDate ? "Não é possível editar um aluguel finalizado" : "Editar Aluguel"}>
              <Link href={`/dashboard/rentals/${rental.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Editar
              </Link>
            </Button>
            <FinalizeRentalButton
              rental={rental}
              isFinalized={!!rental.actualReturnDate}
              onFinalized={handleActionSuccess}
            />
            <Button variant="outline" asChild>
              <Link href="/dashboard/rentals">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Aluguéis
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center"><Info className="mr-2 h-5 w-5 text-primary" />Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{rental.customerName || 'Não especificado'}</p>
              </div>
              {customer?.phone && (
                <div>
                  <p className="text-sm text-muted-foreground">Telefone do Cliente</p>
                  <p className="font-medium flex items-center">
                    <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                    {customer.phone}
                  </p>
                </div>
              )}
              {customer?.cpf && (
                <div>
                  <p className="text-sm text-muted-foreground">CPF do Cliente</p>
                  <p className="font-medium flex items-center">
                    <Fingerprint className="mr-2 h-4 w-4 text-muted-foreground" />
                    {formatCpfForDisplay(customer.cpf)}
                  </p>
                </div>
              )}
              {customer?.address && (
                <div>
                  <p className="text-sm text-muted-foreground">Endereço do Cliente</p>
                  <p className="font-medium flex items-start">
                    <Home className="mr-2 h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="whitespace-pre-wrap">{customer.address}</span>
                  </p>
                </div>
              )}
               {rental.deliveryAddress && rental.deliveryAddress !== 'A definir' ? (
                <div>
                  <p className="text-sm text-muted-foreground">Endereço de Entrega</p>
                  <p className="font-medium flex items-start">
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="whitespace-pre-wrap">{rental.deliveryAddress}</span>
                  </p>
                </div>
              ) : (
                   <div>
                      <p className="text-sm text-muted-foreground">Endereço de Entrega</p>
                      <p className="font-medium italic text-muted-foreground flex items-start">
                          <MapPin className="mr-2 h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          A definir
                      </p>
                  </div>
               )}
              <div>
                <p className="text-sm text-muted-foreground">Data de Início</p>
                <p className="font-medium">{format(parseISO(rental.rentalStartDate), 'PPP', { locale: ptBR })}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duração Contratada</p>
                <p className="font-medium">
                  {rental.isOpenEnded ? 'Em Aberto' : `${rental.rentalDays} dia(s)`}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data de Retorno Esperada</p>
                 <p className="font-medium">
                  {rental.isOpenEnded ? 'Não definida (Em Aberto)' : format(parseISO(rental.expectedReturnDate), 'PPP', { locale: ptBR })}
                </p>
              </div>
              {rental.actualReturnDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Data de Retorno Efetiva</p>
                  <p className="font-medium text-green-600">{format(parseISO(rental.actualReturnDate), 'PPP', { locale: ptBR })}</p>
                </div>
              )}
               {rental.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="font-medium whitespace-pre-wrap">{rental.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary" />Equipamentos Alugados</CardTitle>
            </CardHeader>
            <CardContent>
              {rental.equipment.length > 0 ? (
                <div className="space-y-3">
                  {rental.equipment.map((eq, index) => {
                    const inventoryItem = inventory.find(i => i.id === eq.equipmentId);
                    const rateToUse = eq.customDailyRentalRate ?? inventoryItem?.dailyRentalRate ?? 0;
                    const standardRate = inventoryItem?.dailyRentalRate ?? 0;
                    const isCustomRate = eq.customDailyRentalRate !== null && eq.customDailyRentalRate !== undefined && eq.customDailyRentalRate !== standardRate;

                    return (
                      <div key={index} className="flex justify-between items-start p-2 border-b last:border-b-0">
                        <div>
                          <p className="font-medium">{eq.name || `ID: ${eq.equipmentId}`}</p>
                          <p className="text-xs text-muted-foreground">
                            {isCustomRate && <span className="text-primary font-bold" title={`Taxa Padrão: ${formatToBRL(standardRate)}`}>(Custom) </span>}
                            Diária: {formatToBRL(rateToUse)}
                          </p>
                        </div>
                        <Badge variant="secondary">Qtd: {eq.quantity}</Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground">Nenhum equipamento listado.</p>
              )}
            </CardContent>
          </Card>
          
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center"><Banknote className="mr-2 h-5 w-5 text-primary" />Sumário Financeiro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div>
                  <p className="text-sm text-muted-foreground">
                      {rental.isOpenEnded ? 'Valor da Diária (Base)' : 'Valor Total do Contrato (Atual)'}
                  </p>
                  <p className="text-xl font-bold text-primary">{formatToBRL(rental.value)}</p>
                  {rental.isOpenEnded && (
                      <p className="text-xs text-muted-foreground">O valor total será calculado ao fechar o contrato.</p>
                  )}
              </div>
              {!rental.isOpenEnded && (
                <div>
                  <p className="text-sm text-muted-foreground">Renda por Dia (Base)</p>
                  <p className="font-medium">{formatToBRL(totalDailyRate)}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Status do Pagamento</p>
                <Badge 
                    variant={getPaymentStatusVariant(rental.paymentStatus)} 
                    className={cn("text-sm", isPayable && "cursor-pointer hover:opacity-80 transition-opacity")}
                    onClick={handleBadgeClick}
                    title={isPayable ? "Clique para marcar como pago" : ""}
                >
                    {paymentStatusMap[rental.paymentStatus]}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Forma de Pagamento</p>
                <div className="flex items-center">
                  {PaymentIcon && <PaymentIcon className="mr-2 h-4 w-4 text-muted-foreground" />}
                  <p className="font-medium">{paymentMethodDetails.label}</p>
                </div>
              </div>
               {rental.freightValue !== undefined && rental.freightValue > 0 && (
                  <div>
                      <p className="text-sm text-muted-foreground">Valor do Frete (Incluso no Total)</p>
                      <p className="font-medium">{formatToBRL(rental.freightValue)}</p>
                  </div>
              )}
              {rental.discountValue !== undefined && rental.discountValue > 0 && (
                  <div>
                      <p className="text-sm text-muted-foreground">Desconto Aplicado (Incluso no Total)</p>
                      <p className="font-medium">{formatToBRL(rental.discountValue)}</p>
                  </div>
              )}
              <hr />
              <div>
                <p className="text-sm text-muted-foreground">Valor Considerado Pago</p>
                <p className="font-medium text-green-600">{formatToBRL(valorConsideradoPago)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo Pendente/Devido</p>
                <p className="font-medium text-red-600">{formatToBRL(valorPendente)}</p>
              </div>
             
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <RentalPhotoGallery 
                rentalId={rental.id}
                photos={deliveryPhotos}
                photoType="delivery"
                title="Fotos da Entrega"
                onPhotosChange={refreshRentalOnly}
            />
             <RentalPhotoGallery 
                rentalId={rental.id}
                photos={returnPhotos}
                photoType="return"
                title="Fotos da Devolução"
                onPhotosChange={refreshRentalOnly}
            />
        </div>
      </div>
    </div>
    {isPayable && (
        <MarkAsPaidDialog
            rental={rental}
            isOpen={isPaidDialogOpen}
            onOpenChange={setIsPaidDialogOpen}
            onSuccess={handleActionSuccess}
        />
    )}
    </>
  );
}
