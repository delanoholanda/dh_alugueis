
'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { addRentalPhoto } from '@/actions/rentalActions';
import type { RentalPhoto } from '@/types';
import { Camera, Loader2, ImageIcon, ZoomIn } from 'lucide-react';
import { ImageLightbox } from './ImageLightbox'; 

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

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const openLightbox = (index: number) => {
    setSelectedImageIndex(index);
    setIsLightboxOpen(true);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    let successfulUploads = 0;
    const maxFileSize = 8 * 1024 * 1024; // 8MB

    try {
      const uploadPromises = Array.from(files).map(file => {
        return new Promise<void>((resolve, reject) => {
          if (file.size > maxFileSize) {
            toast({
              title: 'Arquivo Muito Grande',
              description: `A imagem "${file.name}" excede o limite de 8MB.`,
              variant: 'destructive',
            });
            resolve();
            return;
          }

          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onloadend = async () => {
            try {
              const base64Image = reader.result as string;
              await addRentalPhoto(rentalId, base64Image, photoType);
              successfulUploads++;
              resolve();
            } catch (uploadError) {
              reject(uploadError);
            }
          };
          reader.onerror = () => {
            reject(new Error(`Falha ao ler o arquivo ${file.name}.`));
          };
        });
      });

      await Promise.all(uploadPromises);

      if (successfulUploads > 0) {
        toast({
          title: 'Fotos Adicionadas',
          description: `${successfulUploads} imagem(ns) foram salvas com sucesso.`,
          variant: 'success',
        });
        router.refresh();
      }
    } catch (error) {
      toast({
        title: 'Erro ao Salvar Fotos',
        description: (error as Error).message || 'Ocorreu um problema ao salvar uma ou mais imagens.',
        variant: 'destructive',
      });
    } finally {
      if(event.target) event.target.value = '';
      setIsLoading(false);
    }
  };

  return (
    <>
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
            Adicionar nova(s) foto(s) (máx 8MB cada)
          </label>
          <div className="relative">
            <Input
              id={`upload-${photoType}`}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isLoading}
              className="cursor-pointer file:mr-2 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary file:border-0 file:rounded file:px-2 file:py-1 hover:file:bg-primary/20"
              multiple
            />
            {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin" />}
          </div>
        </div>

        {photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map((photo, index) => (
              <div key={photo.id} className="relative group aspect-square" onClick={() => openLightbox(index)}>
                <Image
                  src={photo.imageUrl}
                  alt={`Foto de ${photoType} - ${photo.id}`}
                  layout="fill"
                  objectFit="cover"
                  className="rounded-md cursor-pointer"
                  data-ai-hint="equipment photo"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                   <ZoomIn className="h-8 w-8 text-white" />
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

    {isLightboxOpen && (
      <ImageLightbox
        images={photos}
        startIndex={selectedImageIndex}
        isOpen={isLightboxOpen}
        onOpenChange={setIsLightboxOpen}
      />
    )}
    </>
  );
}
