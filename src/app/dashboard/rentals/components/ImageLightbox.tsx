'use client';

import * as React from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as AlertDialogTitleComponent, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Loader2, Trash2, Download, X } from 'lucide-react';
import type { RentalPhoto } from '@/types';
import { deleteRentalPhoto } from '@/actions/rentalActions';


interface ImageLightboxProps {
  images: RentalPhoto[];
  startIndex: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onPhotoDeleted: () => Promise<void>;
}

export function ImageLightbox({ images, startIndex, isOpen, onOpenChange, onPhotoDeleted }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = React.useState(startIndex);
  const [isLoading, setIsLoading] = React.useState(true);
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      setCurrentIndex(startIndex);
    }
  }, [isOpen, startIndex]);
  
  const goToPrevious = React.useCallback(() => {
    setIsLoading(true);
    const isFirst = currentIndex === 0;
    const newIndex = isFirst ? images.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  }, [currentIndex, images.length]);

  const goToNext = React.useCallback(() => {
    setIsLoading(true);
    const isLast = currentIndex === images.length - 1;
    const newIndex = isLast ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  }, [currentIndex, images.length]);
  
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isOpen) {
        if (event.key === 'ArrowRight') {
          goToNext();
        } else if (event.key === 'ArrowLeft') {
          goToPrevious();
        } else if (event.key === 'Escape') {
          onOpenChange(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, goToNext, goToPrevious, onOpenChange]);

  const currentImage = images[currentIndex];
  
  React.useEffect(() => {
    setIsLoading(true);
  }, [currentImage?.imageUrl]);
  
  const handleDelete = async () => {
    if (!currentImage) return;
    try {
        await deleteRentalPhoto(currentImage.id);
        toast({
            title: 'Foto Removida',
            description: 'A imagem foi removida com sucesso.',
            variant: 'success'
        });
        // Close the lightbox if it was the last image
        if (images.length === 1) {
            onOpenChange(false);
        }
        await onPhotoDeleted();
    } catch (error) {
        toast({
            title: 'Erro ao Remover Foto',
            description: (error as Error).message || 'Ocorreu um problema ao remover a imagem.',
            variant: 'destructive'
        });
    }
  }

  const handleDownload = () => {
    if (!currentImage) return;
    const link = document.createElement('a');
    link.href = currentImage.imageUrl;
    // Extract filename from URL or create a generic one
    const filename = currentImage.imageUrl.split('/').pop() || `rental-photo-${currentImage.id}.webp`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-full h-full max-h-screen p-0 bg-black/80 backdrop-blur-sm border-0 shadow-none flex items-center justify-center flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>Visualizador de Imagens do Aluguel</DialogTitle>
        </DialogHeader>

        {/* Close Button */}
        <DialogClose asChild>
            <Button variant="ghost" size="icon" className="absolute top-4 left-4 z-50 h-10 w-10 bg-black/50 text-white hover:bg-black/70 hover:text-white rounded-full">
                <X className="h-6 w-6" />
                <span className="sr-only">Fechar</span>
            </Button>
        </DialogClose>

        {/* Header with actions */}
         <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleDownload} className="h-10 w-10 bg-black/50 text-white hover:bg-black/70 hover:text-white rounded-full">
                <Download className="h-5 w-5" />
                <span className="sr-only">Baixar Imagem</span>
            </Button>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon" className="h-10 w-10 bg-destructive/80 hover:bg-destructive rounded-full">
                        <Trash2 className="h-5 w-5" />
                         <span className="sr-only">Excluir Imagem</span>
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitleComponent>Excluir esta foto?</AlertDialogTitleComponent>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A imagem será removida permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                        Confirmar Exclusão
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>


        {images.length > 0 && currentImage && (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Image display */}
            <div className="relative w-full h-[85%]">
              {isLoading && (
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-12 w-12 text-white animate-spin" />
                 </div>
              )}
               <Image
                key={currentImage.id}
                src={currentImage.imageUrl}
                alt={`Foto de ${currentImage.photoType} - ${currentIndex + 1}/${images.length}`}
                fill
                className="object-contain"
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
                data-ai-hint="equipment photo"
              />
            </div>
            
            {/* Navigation Buttons */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPrevious}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 rounded-full h-10 w-10 sm:h-12 sm:w-12 bg-black/50 text-white hover:bg-black/70 hover:text-white"
                >
                  <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNext}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 rounded-full h-10 w-10 sm:h-12 sm:w-12 bg-black/50 text-white hover:bg-black/70 hover:text-white"
                >
                  <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
                </Button>
              </>
            )}
             {/* Counter */}
            {images.length > 1 && (
                 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm rounded-full px-3 py-1">
                    {currentIndex + 1} / {images.length}
                </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
