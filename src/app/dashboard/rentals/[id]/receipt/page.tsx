
import { getRentalById } from '@/actions/rentalActions';
import { getCustomerById } from '@/actions/customerActions';
import { getCompanySettings } from '@/actions/settingsActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { notFound } from 'next/navigation';
import { generatePixPayload } from '@/lib/pix';
import RentalContractClient from './RentalContractClient';
import type { Rental, CompanyDetails, Customer, Equipment } from '@/types';
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
  return cityCandidate.trim().toUpperCase().substring(0,15);
}

export default async function RentalContractPage({ params }: { params: { id: string } }) {
  const rentalIdNum = parseInt(params.id || '', 10);
  if (isNaN(rentalIdNum)) {
    notFound();
  }

  // Fetch rental data first
  const initialRental = await getRentalById(rentalIdNum);
  
  // Guard clause to ensure rental exists
  if (!initialRental) {
    notFound();
  }

  // --- Start: Dynamic Value Calculation for Rendering ---
  let finalRentalForDisplay = { ...initialRental };
  if (initialRental.isOpenEnded && !initialRental.actualReturnDate) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const billableDays = countBillableDays(
          initialRental.rentalStartDate,
          todayStr,
          initialRental.chargeSaturdays ?? true,
          initialRental.chargeSundays ?? true
      );
      // For open-ended, rental.value is the daily rate.
      const calculatedValue = (billableDays * initialRental.value);
      finalRentalForDisplay.value = calculatedValue;
      finalRentalForDisplay.rentalDays = billableDays;
  }
  // --- End: Dynamic Value Calculation ---
  
  // Now that rental is confirmed to exist, fetch dependent data in parallel
  const [companySettings, customer, inventory] = await Promise.all([
    getCompanySettings(),
    initialRental.customerId ? getCustomerById(initialRental.customerId) : Promise.resolve(null),
    getInventoryItems()
  ]);

  let pixPayload: string | null = null;

  // Calculate totals based on the final, possibly calculated, rental value
  const totalPaid = finalRentalForDisplay.payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const itemsSubtotal = finalRentalForDisplay.equipment.reduce((sum, eq) => {
      const inventoryItem = inventory.find(i => i.id === eq.equipmentId);
      const dailyRate = eq.customDailyRentalRate ?? inventoryItem?.dailyRentalRate ?? 0;
      const days = finalRentalForDisplay.isOpenEnded ? 1 : (finalRentalForDisplay.rentalDays || 0);
      return sum + (dailyRate * eq.quantity * days);
  }, 0);
  
  const grandTotal = itemsSubtotal + (finalRentalForDisplay.freightValue ?? 0);
  const pendingValue = grandTotal - (finalRentalForDisplay.discountValue ?? 0) - totalPaid;

  if (finalRentalForDisplay.paymentMethod === 'pix' && companySettings.pixKey && pendingValue > 0 && !finalRentalForDisplay.isOpenEnded) {
    const city = extractCityFromAddress(companySettings.address);
    const txidForPix = `DHALUGUEIS${finalRentalForDisplay.id.toString().padStart(6, '0')}${finalRentalForDisplay.payments?.length ?? 0}`;
    const descriptionForPix = `Pagamento Aluguel ID ${finalRentalForDisplay.id}`;
    
    pixPayload = generatePixPayload({
      pixKey: companySettings.pixKey,
      merchantName: companySettings.companyName || 'Nome Empresa',
      merchantCity: city,
      amount: pendingValue,
      txid: txidForPix,
      description: descriptionForPix,
    });
  }

  return (
    <RentalContractClient 
      rental={finalRentalForDisplay}
      customer={customer}
      companySettings={companySettings}
      pixPayload={pixPayload}
      inventory={inventory}
    />
  );
}
