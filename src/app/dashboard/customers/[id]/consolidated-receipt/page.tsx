
import { notFound } from 'next/navigation';
import { getRentalById } from '@/actions/rentalActions';
import { getCustomerById } from '@/actions/customerActions';
import { getCompanySettings } from '@/actions/settingsActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { generatePixPayload } from '@/lib/pix';
import ConsolidatedReceiptClient from './ConsolidatedReceiptClient';
import type { Rental } from '@/types';
import { countBillableDays } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';


function extractCityFromAddress(address?: string): string {
  if (!address) return 'CIDADE';
  const parts = address.split(',');
  let cityCandidate = '';
  if (parts.length >= 2) {
    cityCandidate = parts.length > 2 ? parts[parts.length - 2] : parts[parts.length - 1];
  } else {
    cityCandidate = address;
  }
  return cityCandidate.trim().toUpperCase().substring(0, 15);
}

interface ConsolidatedReceiptPageProps {
  params: { id: string };
  searchParams: { rental_ids?: string; close_until?: string };
}

export default async function ConsolidatedReceiptPage({ params, searchParams }: ConsolidatedReceiptPageProps) {
  const customerId = params.id;
  const rentalIdsStr = searchParams.rental_ids;

  if (!customerId || !rentalIdsStr) {
    notFound();
  }

  const rentalIds = rentalIdsStr.split(',').map(Number).filter(id => !isNaN(id));
  if (rentalIds.length === 0) {
    notFound();
  }
  
  let closeUntilDate = new Date();
  if (searchParams.close_until) {
      const parsedDate = parseISO(searchParams.close_until);
      if (isValid(parsedDate)) {
          closeUntilDate = parsedDate;
      }
  }
  const closeUntilDateStr = format(closeUntilDate, 'yyyy-MM-dd');

  const [customer, companySettings, inventory, ...rentals] = await Promise.all([
    getCustomerById(customerId),
    getCompanySettings(),
    getInventoryItems(),
    ...rentalIds.map(id => getRentalById(id)),
  ]);

  if (!customer || rentals.every(r => r === undefined)) {
    notFound();
  }

  const validRentals = rentals
    .filter((r): r is Rental => r !== undefined && r !== null)
    .map(rental => {
        let itemsSubtotal: number;
        let totalContractValue: number;
        let finalRentalDays = rental.rentalDays;
        let finalExpectedReturnDate = rental.expectedReturnDate;

        if (rental.isOpenEnded && !rental.actualReturnDate) {
            const billableDays = countBillableDays(
                rental.rentalStartDate,
                closeUntilDateStr,
                rental.chargeSaturdays ?? true,
                rental.chargeSundays ?? true
            );
            itemsSubtotal = billableDays * rental.value; // For open-ended, rental.value is the daily rate.
            totalContractValue = itemsSubtotal + (rental.freightValue ?? 0);
            finalRentalDays = billableDays;
            finalExpectedReturnDate = closeUntilDateStr;
        } else {
            // This is the logic split as requested
            const hasPayments = rental.payments && rental.payments.length > 0;
            if (hasPayments) {
                // If there are payments, assume rental.value is the GRAND TOTAL (items + freight)
                totalContractValue = rental.value;
                itemsSubtotal = totalContractValue - (rental.freightValue ?? 0);
            } else {
                // If no payments, assume rental.value is ONLY the items' cost
                itemsSubtotal = rental.value;
                totalContractValue = itemsSubtotal + (rental.freightValue ?? 0);
            }
        }

        const totalPaid = rental.payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
        
        return {
            ...rental,
            itemsSubtotal,
            totalContractValue,
            totalPaid: totalPaid,
            pendingValue: Math.max(0, totalContractValue - totalPaid), 
            rentalDays: finalRentalDays,
            expectedReturnDate: finalExpectedReturnDate,
            value: rental.value, 
        };
    });

  if (validRentals.length === 0) {
      notFound();
  }

  const totalValue = validRentals.reduce((sum, rental) => sum + rental.pendingValue, 0);

  let pixPayload: string | null = null;
  if (companySettings.pixKey && totalValue > 0) {
    const city = extractCityFromAddress(companySettings.address);
    const txidForPix = `CONSOLIDADO-${customerId.substring(5, 10)}-${new Date().getTime().toString().slice(-6)}`;
    const descriptionForPix = `Pagamento Consolidado - ${customer.name}`;

    pixPayload = generatePixPayload({
      pixKey: companySettings.pixKey,
      merchantName: companySettings.companyName || 'Nome Empresa',
      merchantCity: city,
      amount: totalValue,
      txid: txidForPix,
      description: descriptionForPix,
    });
  }

  return (
    <ConsolidatedReceiptClient
      customer={customer}
      rentals={validRentals}
      companySettings={companySettings}
      inventory={inventory}
      pixPayload={pixPayload}
      totalValue={totalValue}
    />
  );
}
