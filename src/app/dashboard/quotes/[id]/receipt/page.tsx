
import { getQuoteById } from '@/actions/quoteActions';
import { getCustomerById } from '@/actions/customerActions';
import { getCompanySettings } from '@/actions/settingsActions';
import { getInventoryItems } from '@/actions/inventoryActions';
import { notFound } from 'next/navigation';
import QuoteReceiptClient from './QuoteReceiptClient';

export default async function QuoteReceiptPage({ params }: { params: { id: string } }) {
  const quoteIdNum = parseInt(params.id || '', 10);
  if (isNaN(quoteIdNum)) {
    notFound();
  }

  const quote = await getQuoteById(quoteIdNum);
  
  if (!quote) {
    notFound();
  }
  
  const [companySettings, customer, inventory] = await Promise.all([
    getCompanySettings(),
    quote.customerId ? getCustomerById(quote.customerId) : Promise.resolve(null),
    getInventoryItems()
  ]);

  return (
    <QuoteReceiptClient 
      quote={quote}
      customer={customer}
      companySettings={companySettings}
      inventory={inventory}
    />
  );
}
