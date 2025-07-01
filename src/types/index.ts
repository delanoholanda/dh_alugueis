

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  cpf?: string | null; 
  imageUrl?: string;
  responsiveness: 'very responsive' | 'responsive' | 'not very responsive' | 'never responds';
  rentalHistory: 'always on time' | 'sometimes late' | 'often late' | 'always late';
}

export interface EquipmentType {
  id: string;
  name: string;
  iconName?: string;
}

export interface Equipment {
  id: string;
  name: string;
  typeId: string;
  quantity: number;
  status: 'available' | 'rented';
  imageUrl?: string;
  dailyRentalRate: number;
}

export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'nao_definido';

export type PaymentStatus = 'paid' | 'pending' | 'overdue';

export interface RentalPhoto {
  id: string;
  rentalId: number;
  imageUrl: string;
  photoType: 'delivery' | 'return';
  uploadedAt: string;
}

export interface Rental {
  id: number; 
  customerId: string;
  customerName?: string;
  equipment: Array<{
    equipmentId: string;
    quantity: number;
    name?: string;
    customDailyRentalRate?: number | null; 
  }>;
  rentalStartDate: string; 
  rentalDays: number;
  expectedReturnDate: string; 
  actualReturnDate?: string | null; 
  freightValue?: number;
  discountValue?: number; 
  value: number; 
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentDate?: string | null; 
  notes?: string | null; 
  deliveryAddress?: string;
  isOpenEnded?: boolean;
  chargeSaturdays?: boolean;
  chargeSundays?: boolean;
  returnNotificationSent?: string | null;
  photos?: RentalPhoto[];
}

export interface ExpenseCategory {
  id: string;
  name: string;
  iconName?: string; 
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  categoryId: string;
  categoryName?: string; 
}

export interface NotificationSettings {
  whatsAppKeys: string;
  defaultCustomerResponsiveness: Customer['responsiveness'];
  defaultCustomerRentalHistory: Customer['rentalHistory'];
}

export interface CompanyDetails {
  companyName: string;
  responsibleName: string;
  phone: string;
  address: string;
  email: string;
  pixKey: string;
  contractTermsAndConditions?: string;
  contractFooterText?: string;
  companyLogoUrl?: string;
  contractLogoUrl?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  
}

export interface UserWithPasswordHash extends User {
  passwordHash: string;
  passwordSalt: string;
}


export interface UserProfile {
  id: string;
  name: string;
  email: string;
}
