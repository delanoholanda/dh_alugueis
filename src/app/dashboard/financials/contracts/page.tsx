
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
}

export default async function FinancialContractsPage() {
  const rentals = await getRentals();

  const rentalsWithFinancials: RentalWithFinancials[] = rentals.map(rental => {
    let finalValue = rental.value;
    
    // If rental is open-ended and not returned, calculate value up to today
    if (rental.isOpenEnded && !rental.actualReturnDate) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const billableDays = countBillableDays(
          rental.rentalStartDate,
          todayStr,
          rental.chargeSaturdays ?? true,
          rental.chargeSundays ?? true
      );
      // For open-ended, rental.value is the daily rate.
      finalValue = (billableDays * rental.value) + (rental.freightValue ?? 0);
    }
    
    const totalPaid = rental.paymentStatus === 'paid' && (!rental.payments || rental.payments.length === 0)
      ? finalValue
      : rental.payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
      
    const pendingValue = finalValue - totalPaid;

    return {
      ...rental,
      value: finalValue, // Override original value with the calculated one
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
