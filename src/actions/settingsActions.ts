
'use server';

import { getDb } from '@/lib/database';
import type { CompanyDetails } from '@/types';
import { revalidatePath } from 'next/cache';

const defaultSettings: CompanyDetails = {
    companyName: 'DH Alugueis',
    responsibleName: 'Delano Holanda',
    phone: '88982248384',
    address: 'Rua Ana Ventura de Oliveira, 189, Ipu, CE',
    email: 'dhalugueis@gmail.com',
    pixKey: '+5588982248384',
    contractTermsAndConditions: `1. O locatário é responsável por quaisquer danos, perda ou roubo do equipamento alugado.
2. O equipamento deve ser devolvido na data e hora especificadas no contrato. Atrasos podem incorrer em taxas adicionais.
3. O pagamento deve ser efetuado conforme acordado. Em caso de inadimplência, medidas legais poderão ser tomadas.
4. A DH Aluguéis não se responsabiliza por acidentes ou danos causados pelo uso inadequado do equipamento.
5. Este documento não tem valor fiscal. Solicite sua nota fiscal, se necessário.`,
    contractFooterText: 'Obrigado por escolher a DH Aluguéis!',
    companyLogoUrl: '',
    contractLogoUrl: '',
};


export async function getCompanySettings(): Promise<CompanyDetails> {
    const db = getDb();
    try {
        const stmt = db.prepare('SELECT key, value FROM company_settings');
        const rows = stmt.all() as { key: string, value: string }[];
        
        const settings: Partial<CompanyDetails> = {};
        for (const row of rows) {
            settings[row.key as keyof CompanyDetails] = row.value;
        }

        // Return default settings overridden by any settings found in the database
        return { ...defaultSettings, ...settings };
    } catch (error) {
        console.error("Failed to fetch company settings:", error);
        return defaultSettings;
    }
}

export async function updateCompanySettings(settings: Partial<CompanyDetails>): Promise<{ success: boolean }> {
    const db = getDb();
    try {
        const stmt = db.prepare('INSERT OR REPLACE INTO company_settings (key, value) VALUES (@key, @value)');
        
        const updateMany = db.transaction((settingsToUpdate) => {
            for (const key in settingsToUpdate) {
                // Ensure the value is a string, especially for potentially undefined optional fields
                const value = settingsToUpdate[key as keyof typeof settingsToUpdate] ?? '';
                stmt.run({ key, value: String(value) });
            }
        });

        updateMany(settings);
        
        revalidatePath('/dashboard/settings');
        revalidatePath('/dashboard/rentals/[id]/receipt', 'page');
        
        return { success: true };
    } catch (error) {
        console.error("Failed to update company settings:", error);
        throw new Error('Failed to update company settings in database.');
    }
}
