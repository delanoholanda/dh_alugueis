
import { notFound } from 'next/navigation';
import { getRentalById } from '@/actions/rentalActions';
import { getCustomerById } from '@/actions/customerActions';
import { getCompanySettings } from '@/actions/settingsActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { generatePixPayload } from '@/lib/pix';
import ConsolidatedReceiptClient from './ConsolidatedReceiptClient';
import type { Rental } from '@/types';
import { countBillableDays } from '@/lib/utils';
import { format } from 'date-fns';


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
  searchParams: { rental_ids?: string };
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

  // Fetch all necessary data in parallel
  const [customer, companySettings, inventory, ...rentals] = await Promise.all([
    getCustomerById(customerId),
    getCompanySettings(),
    getInventoryItems(),
    ...rentalIds.map(id => getRentalById(id)),
  ]);

  if (!customer || rentals.every(r => r === undefined)) {
    notFound();
  }
  
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const validRentals = rentals
    .filter((r): r is Rental => r !== undefined && r !== null)
    .map(rental => {
        if (rental.isOpenEnded) {
            const billableDays = countBillableDays(
                rental.rentalStartDate,
                todayStr,
                rental.chargeSaturdays ?? true,
                rental.chargeSundays ?? true
            );
            // 'rental.value' for open-ended is the daily rate
            const calculatedValue = billableDays * rental.value; 
            return {
                ...rental,
                value: calculatedValue,
                rentalDays: billableDays,
                // Set expectedReturnDate to today for display purposes in the consolidated receipt
                expectedReturnDate: todayStr
            };
        }
        return rental;
    });

  if (validRentals.length === 0) {
      notFound();
  }


  const totalValue = validRentals.reduce((sum, rental) => sum + rental.value, 0);

  let pixPayload: string | null = null;
  if (companySettings.pixKey && totalValue > 0) {
    const city = extractCityFromAddress(companySettings.address);
    // Create a unique-ish TXID for the consolidated payment
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
