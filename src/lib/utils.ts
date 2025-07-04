import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { eachDayOfInterval, getDay, parseISO, addDays } from 'date-fns';
import type { PaymentStatus } from '@/types';
import type { BadgeProps } from '@/components/ui/badge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Function to format a number to BRL currency string
export function formatToBRL(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0,00'; // Default for invalid/missing values
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Function to parse a BRL currency string to a number
export function parseFromBRL(value: string): number {
  if (typeof value !== 'string' || !value.trim()) {
    // Return NaN so Zod can catch it if a number is strictly required and input is empty/invalid
    return NaN; 
  }
  // Remove "R$", non-breaking spaces, then all dots (thousands separators), then replace comma with dot
  const cleanedValue = value
    .replace(/\R\$\s?/g, '') // Remove "R$" and optional space
    .replace(/\u00A0/g, '') // Remove non-breaking spaces often inserted by toLocaleString
    .replace(/\./g, '')       // Remove all dots (thousands separators)
    .replace(/,/g, '.');      // Replace comma with dot (decimal separator)
  
  const parsed = parseFloat(cleanedValue);
  // parseFloat itself returns NaN for invalid strings like "abc"
  return parsed; 
}

export function findNthBillableDay(startDate: Date, totalBillableDays: number, chargeSaturdays: boolean, chargeSundays: boolean): Date {
  if (totalBillableDays < 1) {
    return startDate; 
  }

  let endDate = startDate;
  let daysCounted = 1;

  while (daysCounted < totalBillableDays) {
    endDate = addDays(endDate, 1);
    const dayOfWeek = getDay(endDate);
    // Only count if it's NOT a non-billable weekend day
    if (!((dayOfWeek === 6 && !chargeSaturdays) || (dayOfWeek === 0 && !chargeSundays))) {
      daysCounted++;
    }
  }

  return endDate;
}


export function countBillableDays(startDateStr: string, endDateStr: string, chargeSaturdays: boolean, chargeSundays: boolean): number {
    try {
        const startDate = parseISO(startDateStr);
        const endDate = parseISO(endDateStr);
        
        // Ensure start date is not after end date
        if (startDate > endDate) return 0;

        const interval = { start: startDate, end: endDate };
        const daysInInterval = eachDayOfInterval(interval);
        
        let billableDays = 0;
        for (const day of daysInInterval) {
            const dayOfWeek = getDay(day); // 0=Sun, 6=Sat
            if (dayOfWeek === 6 && !chargeSaturdays) {
                continue;
            }
            if (dayOfWeek === 0 && !chargeSundays) {
                continue;
            }
            billableDays++;
        }
        
        return billableDays;
    } catch (error) {
        console.error("Error calculating billable days:", error);
        return 0;
    }
}

export const paymentStatusMap: Record<PaymentStatus, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  overdue: 'Atrasado'
};

export function getPaymentStatusVariant(status: PaymentStatus): BadgeProps['variant'] {
  switch (status) {
    case 'paid': return 'default';
    case 'pending': return 'secondary';
    case 'overdue': return 'destructive';
    default: return 'outline';
  }
}
