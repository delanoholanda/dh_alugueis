
'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Settings as SettingsIcon, UserCircle, Bell, Image as ImageIconLucide, Building, FileText, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import Image from 'next/image';
import type { CompanyDetails, UserProfile } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { updateUser } from '@/actions/userActions';
import { getCompanySettings, updateCompanySettings } from '@/actions/settingsActions';

const companyDetailsSchema = z.object({
  companyName: z.string().min(1, "Nome da empresa é obrigatório."),
  responsibleName: z.string().min(1, "Nome do responsável é obrigatório."),
  phone: z.string().min(1, "Telefone é obrigatório."),
  address: z.string().min(1, "Endereço é obrigatório."),
  email: z.string().email("Email inválido."),
  pixKey: z.string().min(1, "Chave PIX é obrigatória."),
  contractTermsAndConditions: z.string().optional(),
  contractFooterText: z.string().optional(),
});

type CompanyDetailsFormValues = z.infer<typeof companyDetailsSchema>;


export default function SettingsPage() {
  const { user, updateUserContext } = useAuth();
  const { toast } = useToast();
  
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false); 
  
  // State for logos, now managed separately from the form
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [contractLogoUrl, setContractLogoUrl] = useState('');

  const companyDetailsForm = useForm<CompanyDetailsFormValues>({
    resolver: zodResolver(companyDetailsSchema),
    defaultValues: {
      companyName: '',
      responsibleName: '',
      phone: '',
      address: '',
      email: '',
      pixKey: '',
      contractTermsAndConditions: '',
      contractFooterText: '',
    }
  });

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
    const isDarkModePreferred = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setDarkMode(savedTheme === 'dark');
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      setDarkMode(isDarkModePreferred);
      document.documentElement.classList.toggle('dark', isDarkModePreferred);
    }

    const loadSettings = async () => {
      try {
        const settings = await getCompanySettings();
        companyDetailsForm.reset(settings);
        // Set the separate state for logos
        setCompanyLogoUrl(settings.companyLogoUrl || '');
        setContractLogoUrl(settings.contractLogoUrl || '');
      } catch (error) {
        console.error("Failed to load company settings:", error);
        toast({
          title: "Erro ao Carregar Configurações",
          description: "Não foi possível buscar as configurações da empresa.",
          variant: "destructive"
        })
      }
    };
    loadSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    if (!user) {
        toast({ title: "Erro", description: "Usuário não conectado.", variant: "destructive" });
        setIsUpdatingProfile(false);
        return;
    }
    
    const updateData: Partial<Omit<UserProfile, 'id'>> & { password?: string } = {};

    if (name !== user.name) updateData.name = name;
    if (email !== user.email) updateData.email = email;
    if (password) {
        if (password.length < 6) {
            toast({ title: "Erro", description: "A nova senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
            setIsUpdatingProfile(false);
            return;
        }
        updateData.password = password;
    }
    
    if (Object.keys(updateData).length === 0) {
        toast({ title: "Nenhuma Alteração", description: "Nenhuma informação foi alterada.", variant: "default" });
        setIsUpdatingProfile(false);
        return;
    }

    try {
        const updatedUser = await updateUser(user.id, updateData);
        if (updatedUser) {
            updateUserContext(updatedUser);
            toast({
                title: "Perfil Atualizado",
                description: "Suas informações de perfil foram atualizadas com sucesso.",
                variant: 'success',
            });
            setPassword('');
        }
    } catch (error) {
        toast({
            title: "Erro ao Atualizar Perfil",
            description: (error as Error).message,
            variant: 'destructive',
        });
    } finally {
        setIsUpdatingProfile(false);
    }
  };

  const toggleDarkMode = (checked: boolean) => {
    setDarkMode(checked);
    document.documentElement.classList.toggle('dark', checked);
    localStorage.setItem('theme', checked ? 'dark' : 'light');
    toast({
      title: "Tema Alterado",
      description: `Tema definido para ${checked ? 'Modo Escuro' : 'Modo Claro'}.`,
      variant: 'success',
    });
  };

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>, type: 'company' | 'contract') => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { 
        toast({
          title: 'Arquivo Muito Grande',
          description: 'Por favor, selecione uma imagem menor que 2MB.',
          variant: 'destructive',
        });
        event.target.value = ''; 
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (type === 'company') {
          setCompanyLogoUrl(result);
        } else {
          setContractLogoUrl(result);
        }
        // No toast here, user must click save.
      };
      reader.readAsDataURL(file);
       event.target.value = '';
    }
  };

  const handleCompanyDetailsSave = async (data: CompanyDetailsFormValues) => {
    try {
        const settingsToSave: CompanyDetails = {
            ...data,
            companyLogoUrl: companyLogoUrl,
            contractLogoUrl: contractLogoUrl,
        };
        await updateCompanySettings(settingsToSave);
        toast({
            title: 'Informações da Empresa Atualizadas',
            description: 'Os dados da sua empresa foram salvos com sucesso.',
            variant: 'success',
        });
    } catch (error) {
        toast({ title: "Erro ao Salvar", description: (error as Error).message, variant: "destructive" });
    }
  };


  return (
    <div className="container mx-auto py-2">
      <PageHeader 
        title="Configurações" 
        icon={SettingsIcon}
        description="Gerencie seu perfil, preferências e configurações do aplicativo."
      />

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline flex items-center"><UserCircle className="mr-2 h-5 w-5 text-primary"/> Informações do Perfil</CardTitle>
            <CardDescription>Atualize seus dados pessoais.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome Completo</Label>
                <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu Nome" />
              </div>
              <div>
                <Label htmlFor="email">Endereço de Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
              </div>
               <div>
                <Label htmlFor="password">Nova Senha (Opcional)</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Deixe em branco para manter a atual" />
                   <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:bg-transparent" onClick={() => setShowPassword((prev) => !prev)} tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">{showPassword ? 'Ocultar senha' : 'Mostrar senha'}</span>
                    </Button>
                </div>
              </div>
              <Button type="submit" className="w-full sm:w-auto" disabled={isUpdatingProfile}>
                {isUpdatingProfile ? 'Salvando...' : 'Salvar Alterações do Perfil'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-lg xl:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline flex items-center"><Building className="mr-2 h-5 w-5 text-primary"/> Detalhes da Empresa e Contratos</CardTitle>
            <CardDescription>Edite os dados da sua empresa, PIX, e personalizações para contratos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...companyDetailsForm}>
              <form onSubmit={companyDetailsForm.handleSubmit(handleCompanyDetailsSave)} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={companyDetailsForm.control} name="companyName" render={({ field }) => ( <FormItem> <FormLabel>Nome da Empresa</FormLabel> <FormControl> <Input placeholder="Nome da sua Empresa" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
                  <FormField control={companyDetailsForm.control} name="responsibleName" render={({ field }) => ( <FormItem> <FormLabel>Nome do Responsável</FormLabel> <FormControl> <Input placeholder="Nome do Responsável" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={companyDetailsForm.control} name="phone" render={({ field }) => ( <FormItem> <FormLabel>Telefone da Empresa</FormLabel> <FormControl> <Input placeholder="Telefone para contato" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
                   <FormField control={companyDetailsForm.control} name="email" render={({ field }) => ( <FormItem> <FormLabel>Email da Empresa</FormLabel> <FormControl> <Input type="email" placeholder="Email para contato" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
                </div>
                <FormField control={companyDetailsForm.control} name="address" render={({ field }) => ( <FormItem> <FormLabel>Endereço da Empresa</FormLabel> <FormControl> <Input placeholder="Rua, Número, Bairro, Cidade, Estado" {...field} /> </FormControl> <FormDescription className="text-xs mt-1"> Ex: Rua Exemplo, 123, Centro, Sua Cidade, SC </FormDescription> <FormMessage /> </FormItem> )}/>
                <FormField control={companyDetailsForm.control} name="pixKey" render={({ field }) => ( <FormItem> <FormLabel>Chave PIX</FormLabel> <FormControl> <Input placeholder="Sua chave PIX" {...field} /> </FormControl> <FormDescription className="text-xs mt-1"> Pode ser CPF/CNPJ (só números), Telefone (+55DDD... ou DDD...), Email ou Chave Aleatória. </FormDescription> <FormMessage /> </FormItem> )}/>
                
                <div className="pt-6 border-t">
                    <h3 className="text-lg font-medium flex items-center mb-4"><ImageIconLucide className="mr-2 h-5 w-5 text-primary"/>Logos da Empresa</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Logo Geral (Login, etc.)</Label>
                             <div className="flex flex-col items-center space-y-2 mt-1">
                                <div className="w-40 h-20 relative rounded-md overflow-hidden border bg-muted flex items-center justify-center p-1">
                                    {companyLogoUrl ? (<Image src={companyLogoUrl} alt="Pré-visualização Logo Empresa" layout="fill" objectFit="contain" key={companyLogoUrl} data-ai-hint="company logo"/>) : (<ImageIconLucide className="w-10 h-10 text-muted-foreground" data-ai-hint="logo placeholder"/>)}
                                </div>
                                <Input placeholder="Cole a URL da imagem aqui" value={companyLogoUrl || ''} onChange={(e) => setCompanyLogoUrl(e.target.value)} />
                                <Input id="companyLogoUpload" type="file" accept="image/*" onChange={(e) => handleLogoChange(e, 'company')} className="w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                             </div>
                        </div>
                         <div className="space-y-2">
                            <Label>Logo Específica do Contrato</Label>
                            <div className="flex flex-col items-center space-y-2 mt-1">
                                <div className="w-40 h-20 relative rounded-md overflow-hidden border bg-muted flex items-center justify-center p-1">
                                    {contractLogoUrl ? (<Image src={contractLogoUrl} alt="Pré-visualização Logo Contrato" layout="fill" objectFit="contain" key={contractLogoUrl} data-ai-hint="contract logo"/>) : (<ImageIconLucide className="w-10 h-10 text-muted-foreground" data-ai-hint="logo placeholder"/>)}
                                </div>
                                <Input placeholder="Cole a URL da imagem aqui" value={contractLogoUrl || ''} onChange={(e) => setContractLogoUrl(e.target.value)} />
                                <Input id="contractLogoUpload" type="file" accept="image/*" onChange={(e) => handleLogoChange(e, 'contract')} className="w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"/>
                            </div>
                            <p className="text-xs text-muted-foreground text-center mt-1">Se vazio, a logo geral será usada.</p>
                        </div>
                    </div>
                </div>

                <hr className="my-2"/>
                <h3 className="text-lg font-medium flex items-center"><FileText className="mr-2 h-5 w-5 text-primary"/>Personalização de Contratos</h3>

                <FormField control={companyDetailsForm.control} name="contractTermsAndConditions" render={({ field }) => ( <FormItem> <FormLabel>Termos e Condições do Contrato</FormLabel> <FormControl> <Textarea placeholder="Insira os termos e condições aqui..." {...field} value={field.value || ''} rows={5}/> </FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={companyDetailsForm.control} name="contractFooterText" render={({ field }) => ( <FormItem> <FormLabel>Texto do Rodapé do Contrato</FormLabel> <FormControl> <Input placeholder="Ex: Obrigado pela preferência!" {...field} value={field.value || ''}/> </FormControl> <FormMessage /> </FormItem> )}/>

                <Button type="submit" className="w-full sm:w-auto" disabled={companyDetailsForm.formState.isSubmitting}>
                    {companyDetailsForm.formState.isSubmitting ? "Salvando Dados..." : "Salvar Dados da Empresa e Contratos"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center"><Bell className="mr-2 h-5 w-5 text-primary"/> Preferências de Notificação</CardTitle>
              <CardDescription>Controle como você recebe notificações.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications" className="text-base">Notificações por Email</Label>
                  <p className="text-sm text-muted-foreground">Receba atualizações importantes por email.</p>
                </div>
                <Switch id="email-notifications" checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label htmlFor="whatsapp-notifications" className="text-base">Lembretes por WhatsApp</Label>
                  <p className="text-sm text-muted-foreground">Ative/desative lembretes de WhatsApp via IA.</p>
                </div>
                <Switch id="whatsapp-notifications" />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full sm:w-auto" onClick={() => toast({title: "Preferências Salvas", description: "Configurações de notificação (mock) salvas.", variant: 'success'})}>
                Salvar Preferências de Notificação
              </Button>
            </CardFooter>
          </Card>
          
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center">
                <SettingsIcon className="mr-2 h-5 w-5 text-primary"/> Preferências de Tema
              </CardTitle>
              <CardDescription>Personalize a aparência do aplicativo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label htmlFor="dark-mode" className="text-base">Modo Escuro</Label>
                  <p className="text-sm text-muted-foreground">Alterne entre temas claro e escuro.</p>
                </div>
                <Switch id="dark-mode" checked={darkMode} onCheckedChange={toggleDarkMode} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
