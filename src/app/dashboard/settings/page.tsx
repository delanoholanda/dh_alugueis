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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { updateUser } from '@/actions/userActions';


const COMPANY_LOGO_STORAGE_KEY = 'dhAlugueisCompanyLogo';
const DEFAULT_COMPANY_LOGO = '/dh-alugueis-logo.png';
const COMPANY_DETAILS_STORAGE_KEY = 'dhAlugueisCompanyDetails';

const DEFAULT_COMPANY_DETAILS: CompanyDetails = {
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
  contractLogoUrl: '',
};

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
  const [companyLogo, setCompanyLogo] = useState<string>(DEFAULT_COMPANY_LOGO);
  
  const companyDetailsForm = useForm<CompanyDetails>({
    defaultValues: DEFAULT_COMPANY_DETAILS, 
  });

  const watchedContractLogoUrl = companyDetailsForm.watch("contractLogoUrl");


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

    const storedLogo = localStorage.getItem(COMPANY_LOGO_STORAGE_KEY);
    if (storedLogo) {
      setCompanyLogo(storedLogo);
    }

    const storedCompanyDetails = localStorage.getItem(COMPANY_DETAILS_STORAGE_KEY);
    let detailsToUse = { ...DEFAULT_COMPANY_DETAILS }; 
    if (storedCompanyDetails) {
      try {
        detailsToUse = { ...DEFAULT_COMPANY_DETAILS, ...JSON.parse(storedCompanyDetails) };
      } catch (e) {
        console.error("Erro ao carregar detalhes da empresa do localStorage:", e);
      }
    }
    companyDetailsForm.reset(detailsToUse);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, companyDetailsForm.reset]);

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
          setCompanyLogo(result);
          localStorage.setItem(COMPANY_LOGO_STORAGE_KEY, result);
          toast({
            title: 'Logo da Empresa Atualizada',
            description: 'A nova logo da empresa foi carregada e salva localmente.',
            variant: 'success',
          });
        } else {
          companyDetailsForm.setValue('contractLogoUrl', result, { shouldValidate: true });
           toast({
            title: 'Logo do Contrato Atualizada',
            description: 'A nova logo para contratos foi carregada.',
            variant: 'success',
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = (type: 'company' | 'contract') => {
    if (type === 'company') {
      localStorage.removeItem(COMPANY_LOGO_STORAGE_KEY);
      setCompanyLogo(DEFAULT_COMPANY_LOGO);
      toast({
        title: 'Logo da Empresa Removida',
        description: 'A logo personalizada da empresa foi removida. Usando a logo padrão.',
        variant: 'success',
      });
    } else {
      companyDetailsForm.setValue('contractLogoUrl', '');
      toast({
        title: 'Logo do Contrato Removida',
        description: 'A logo específica para contratos foi removida.',
        variant: 'success',
      });
    }
  };

  const handleCompanyDetailsSave = (data: CompanyDetails) => {
    let finalPixKey = data.pixKey.trim();
    const onlyDigitsRegex = /^\\d+$/;

    if (
      onlyDigitsRegex.test(finalPixKey) &&
      (finalPixKey.length === 10 || finalPixKey.length === 11) && 
      !finalPixKey.startsWith('+55')
    ) {
      finalPixKey = `+55${finalPixKey}`;
    }
    
    const updatedData = { ...data, pixKey: finalPixKey };

    localStorage.setItem(COMPANY_DETAILS_STORAGE_KEY, JSON.stringify(updatedData));
    companyDetailsForm.reset(updatedData); 
    toast({
      title: 'Informações da Empresa Atualizadas',
      description: 'Os dados da sua empresa foram salvos com sucesso.',
      variant: 'success',
    });
  };


  return (
    <div className="container mx-auto py-2">
      <PageHeader 
        title="Configurações" 
        icon={SettingsIcon}
        description="Gerencie seu perfil, preferências e configurações do aplicativo."
      />

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {/* Perfil Card */}
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
                   <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:bg-transparent"
                      onClick={() => setShowPassword((prev) => !prev)}
                      tabIndex={-1}
                    >
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

        {/* Informações da Empresa Card */}
        <Card className="shadow-lg xl:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline flex items-center"><Building className="mr-2 h-5 w-5 text-primary"/> Detalhes da Empresa e Contratos</CardTitle>
            <CardDescription>Edite os dados da sua empresa, PIX, e personalizações para contratos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...companyDetailsForm}>
              <form onSubmit={companyDetailsForm.handleSubmit(handleCompanyDetailsSave)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={companyDetailsForm.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Empresa</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome da sua Empresa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={companyDetailsForm.control}
                    name="responsibleName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Responsável</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do Responsável" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={companyDetailsForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone da Empresa</FormLabel>
                        <FormControl>
                          <Input placeholder="Telefone para contato" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={companyDetailsForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email da Empresa</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Email para contato" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={companyDetailsForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço da Empresa</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, Número, Bairro, Cidade, Estado" {...field} />
                      </FormControl>
                       <FormDescription className="text-xs mt-1">
                         Ex: Rua Exemplo, 123, Centro, Sua Cidade, SC
                       </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={companyDetailsForm.control}
                  name="pixKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chave PIX</FormLabel>
                      <FormControl>
                        <Input placeholder="Sua chave PIX" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs mt-1">
                        Pode ser CPF/CNPJ (só números), Telefone (+55DDD000000000 ou DDD000000000), Email ou Chave Aleatória. Se for telefone sem +55, será adicionado automaticamente.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <hr className="my-6"/>
                <h3 className="text-lg font-medium flex items-center"><FileText className="mr-2 h-5 w-5 text-primary"/>Personalização de Contratos</h3>

                <FormField
                  control={companyDetailsForm.control}
                  name="contractTermsAndConditions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Termos e Condições do Contrato</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Insira os termos e condições aqui..." {...field} rows={5}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={companyDetailsForm.control}
                  name="contractFooterText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Texto do Rodapé do Contrato</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Obrigado pela preferência!" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>Logo Específica para Contratos (Opcional)</FormLabel>
                  <div className="flex flex-col items-center space-y-2 mt-1">
                     <div className="w-40 h-20 relative rounded-md overflow-hidden border bg-muted flex items-center justify-center p-1">
                        {watchedContractLogoUrl ? (
                        <Image 
                            src={watchedContractLogoUrl} 
                            alt="Pré-visualização Logo do Contrato" 
                            layout="fill" 
                            objectFit="contain" 
                            key={watchedContractLogoUrl}
                            data-ai-hint="contract company logo"
                        />
                        ) : (
                        <ImageIconLucide className="w-10 h-10 text-muted-foreground" data-ai-hint="logo placeholder"/>
                        )}
                    </div>
                    <div className="w-full flex flex-col sm:flex-row gap-2 items-center">
                        <FormField
                        control={companyDetailsForm.control}
                        name="contractLogoUrl"
                        render={({ field }) => (
                            <FormItem className="flex-grow">
                            <FormLabel className="sr-only">URL da Logo do Contrato</FormLabel>
                            <FormControl>
                                <Input 
                                placeholder="Cole uma URL ou carregue abaixo" 
                                {...field} 
                                />
                            </FormControl>
                            <FormMessage className="text-xs"/>
                            </FormItem>
                        )}
                        />
                        <Input 
                            id="contractLogoUpload" 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => handleLogoChange(e, 'contract')}
                            className="w-full sm:w-auto file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        />
                    </div>
                     <Button 
                        type="button"
                        variant="outline" 
                        size="sm"
                        onClick={() => handleRemoveLogo('contract')} 
                        disabled={!watchedContractLogoUrl}
                        className="w-full sm:w-auto"
                    >
                        Remover Logo do Contrato
                    </Button>
                    <FormDescription className="text-xs">
                        Se nenhuma logo específica for definida aqui, a logo geral da empresa será usada no contrato. Máx 2MB.
                    </FormDescription>
                  </div>
                </FormItem>

                <Button type="submit" className="w-full sm:w-auto">Salvar Dados da Empresa e Contratos</Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Notificações e Tema Cards (agrupados se necessário ou separados como estão) */}
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

        {/* Logo Geral Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
              <ImageIconLucide className="mr-2 h-5 w-5 text-primary"/> Logo Geral da Empresa
            </CardTitle>
            <CardDescription>Personalize a logo que aparece no sistema (ex: login, sidebar). Máx 2MB.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center space-y-3">
              <Label>Pré-visualização da Logo Atual:</Label>
              <div className="w-48 h-24 relative rounded-md overflow-hidden border bg-muted flex items-center justify-center p-2">
                {companyLogo ? (
                  <Image 
                    src={companyLogo} 
                    alt="Logo da Empresa" 
                    layout="fill" 
                    objectFit="contain" 
                    key={companyLogo}
                    data-ai-hint="company logo"
                  />
                ) : (
                   <ImageIconLucide className="w-10 h-10 text-muted-foreground" data-ai-hint="logo placeholder"/>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="logoUpload">Carregar Nova Logo Geral</Label>
              <Input 
                id="logoUpload" 
                type="file" 
                accept="image/png, image/jpeg, image/gif, image/svg+xml" 
                onChange={(e) => handleLogoChange(e, 'company')}
                className="mt-1"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              onClick={() => handleRemoveLogo('company')} 
              disabled={companyLogo === DEFAULT_COMPANY_LOGO && !localStorage.getItem(COMPANY_LOGO_STORAGE_KEY)}
              className="w-full"
            >
              Remover Logo Geral (Usar Padrão)
            </Button>
          </CardFooter>
        </Card>

      </div>
    </div>
  );
}
