
'use server';

import { getRentals } from '@/actions/rentalActions';
import { PageHeader } from '@/components/layout/PageHeader';
import ContractsClientPage from './components/ContractsClientPage';
import { Handshake } from 'lucide-react';
import type { Rental } from '@/types';
import { format } from 'date-fns';
import { countBillableDays } from '@/lib/utils';

export interface RentalWithFinancials extends Rental {
  totalPaid: number;
  pendingValue: number;
  itemsValue: number;
  totalContractValue: number;
}

export default async function FinancialContractsPage() {
  const rentals = await getRentals();

  const rentalsWithFinancials: RentalWithFinancials[] = rentals.map(rental => {
    let totalContractValue: number;
    let itemsValue: number;
    
    if (rental.isOpenEnded && !rental.actualReturnDate) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const billableDays = countBillableDays(
          rental.rentalStartDate,
          todayStr,
          rental.chargeSaturdays ?? true,
          rental.chargeSundays ?? true
      );
      // For open-ended, rental.value is the daily rate.
      itemsValue = billableDays * rental.value;
      totalContractValue = itemsValue + (rental.freightValue ?? 0) - (rental.discountValue ?? 0);
    } else {
      // For fixed-term contracts, rental.value already includes freight and discount.
      totalContractValue = rental.value;
      itemsValue = totalContractValue - (rental.freightValue ?? 0) + (rental.discountValue ?? 0);
    }
    
    // Legacy support: if a rental was fully paid before the 'payments' table existed.
    const hasLegacyFullPayment = rental.paymentStatus === 'paid' && (!rental.payments || rental.payments.length === 0);
    const totalPaid = hasLegacyFullPayment
      ? totalContractValue 
      : rental.payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
      
    const pendingValue = totalContractValue - totalPaid;

    return {
      ...rental,
      itemsValue,
      totalContractValue,
      totalPaid,
      pendingValue: pendingValue < 0.01 ? 0 : pendingValue,
    };
  });

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Visão Financeira dos Contratos"
        icon={Handshake}
        description="Analise o status de pagamento de todos os seus contratos de aluguel."
      />
      <ContractsClientPage initialRentals={rentalsWithFinancials} />
    </div>
  );
}
