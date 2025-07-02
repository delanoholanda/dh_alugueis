
import { getRentalById } from '@/actions/rentalActions';
import { getCustomerById } from '@/actions/customerActions';
import { getCompanySettings } from '@/actions/settingsActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { notFound } from 'next/navigation';
import { generatePixPayload } from '@/lib/pix';
import RentalContractClient from './RentalContractClient';
import type { Rental, CompanyDetails, Customer, Equipment } from '@/types';

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
  const rental = await getRentalById(rentalIdNum);
  
  // Guard clause to ensure rental exists
  if (!rental) {
    notFound();
  }
  
  // Now that rental is confirmed to exist, fetch dependent data in parallel
  const [companySettings, customer, inventory] = await Promise.all([
    getCompanySettings(),
    rental.customerId ? getCustomerById(rental.customerId) : Promise.resolve(null),
    getInventoryItems()
  ]);

  let pixPayload: string | null = null;
  const pixAmount = rental.isOpenEnded ? 0 : rental.value;
  if (rental.paymentMethod === 'pix' && companySettings.pixKey && pixAmount > 0) {
    const city = extractCityFromAddress(companySettings.address);
    const txidForPix = `DHALUGUEIS${rental.id.toString().padStart(6, '0')}`;
    const descriptionForPix = `Aluguel ${companySettings.companyName || 'Empresa'} - ID ${rental.id}`;
    
    pixPayload = generatePixPayload({
      pixKey: companySettings.pixKey,
      merchantName: companySettings.companyName || 'Nome Empresa',
      merchantCity: city,
      amount: pixAmount,
      txid: txidForPix,
      description: descriptionForPix,
    });
  }

  return (
    <RentalContractClient 
      rental={rental}
      customer={customer}
      companySettings={companySettings}
      pixPayload={pixPayload}
      inventory={inventory}
    />
  );
}
