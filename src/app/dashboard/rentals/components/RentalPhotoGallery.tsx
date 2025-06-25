
'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { addRentalPhoto, deleteRentalPhoto } from '@/actions/rentalActions';
import type { RentalPhoto } from '@/types';
import { Camera, Upload, Trash2, Loader2, Image as ImageIcon, PackageX } from 'lucide-react';

interface RentalPhotoGalleryProps {
  rentalId: number;
  photos: RentalPhoto[];
  photoType: 'delivery' | 'return';
  title: string;
}

export default function RentalPhotoGallery({ rentalId, photos, photoType, title }: RentalPhotoGalleryProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) { // 4MB limit for base64
        toast({
          title: 'Arquivo Muito Grande',
          description: 'Por favor, selecione uma imagem menor que 4MB.',
          variant: 'destructive',
        });
        event.target.value = ''; 
        return;
    }

    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Image = reader.result as string;
        await addRentalPhoto(rentalId, base64Image, photoType);
        toast({
          title: 'Foto Adicionada',
          description: 'A imagem foi salva com sucesso.',
          variant: 'success',
        });
        router.refresh(); 
      };
      reader.onerror = () => {
        throw new Error("Falha ao ler o arquivo de imagem.");
      }
    } catch (error) {
      toast({
        title: 'Erro ao Salvar Foto',
        description: (error as Error).message || 'Ocorreu um problema ao salvar a imagem.',
        variant: 'destructive',
      });
    } finally {
        // Reset file input to allow re-uploading the same file if needed
        event.target.value = '';
        setIsLoading(false);
    }
  };

  const handleDelete = async (photoId: string) => {
    try {
        await deleteRentalPhoto(photoId);
        toast({
            title: 'Foto Removida',
            description: 'A imagem foi removida com sucesso.',
            variant: 'success'
        });
        router.refresh();
    } catch (error) {
        toast({
            title: 'Erro ao Remover Foto',
            description: (error as Error).message || 'Ocorreu um problema ao remover a imagem.',
            variant: 'destructive'
        });
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline flex items-center">
          <Camera className="mr-2 h-5 w-5 text-primary" /> {title}
        </CardTitle>
        <CardDescription>
          Adicione e visualize fotos do estado dos equipamentos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <label htmlFor={`upload-${photoType}`} className="block text-sm font-medium text-muted-foreground mb-2">
            Adicionar nova foto
          </label>
          <div className="relative">
            <Input
              id={`upload-${photoType}`}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isLoading}
              className="cursor-pointer file:mr-2 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary file:border-0 file:rounded file:px-2 file:py-1 hover:file:bg-primary/20"
            />
            {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin" />}
          </div>
        </div>

        {photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group aspect-square">
                <Image
                  src={photo.imageUrl}
                  alt={`Foto de ${photoType} - ${photo.id}`}
                  layout="fill"
                  objectFit="cover"
                  className="rounded-md"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon">
                                <Trash2 className="h-5 w-5" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Excluir esta foto?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. A imagem será removida permanentemente.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(photo.id)} className="bg-destructive hover:bg-destructive/90">
                                Confirmar Exclusão
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm">Nenhuma foto adicionada ainda.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
