import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Share2,
  Heart,
  MoreHorizontal,
} from 'lucide-react';
import clsx from 'clsx';

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface ImageGalleryProps {
  images: GalleryImage[];
  className?: string;
  columns?: 2 | 3 | 4 | 5;
  spacing?: 'sm' | 'md' | 'lg';
  aspectRatio?: 'square' | 'video' | 'auto';
  showThumbnails?: boolean;
  showControls?: boolean;
  enableZoom?: boolean;
  enableDownload?: boolean;
  enableShare?: boolean;
  enableLike?: boolean;
  onImageClick?: (image: GalleryImage, index: number) => void;
  onImageLike?: (image: GalleryImage) => void;
  onImageShare?: (image: GalleryImage) => void;
  onImageDownload?: (image: GalleryImage) => void;
  renderImageActions?: (image: GalleryImage) => React.ReactNode;
}

export interface LightboxProps {
  images: GalleryImage[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  enableZoom?: boolean;
  enableDownload?: boolean;
  enableShare?: boolean;
  onImageLike?: (image: GalleryImage) => void;
  onImageShare?: (image: GalleryImage) => void;
  onImageDownload?: (image: GalleryImage) => void;
}

const Lightbox: React.FC<LightboxProps> = ({
  images,
  currentIndex,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  enableZoom = true,
  enableDownload = false,
  enableShare = false,
  onImageLike,
  onImageShare,
  onImageDownload,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const currentImage = images[currentIndex];

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        onPrevious();
        break;
      case 'ArrowRight':
        onNext();
        break;
      case '+':
      case '=':
        handleZoomIn();
        break;
      case '-':
        handleZoomOut();
        break;
      case '0':
        resetZoom();
        break;
    }
  }, [isOpen, onClose, onPrevious, onNext]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    resetZoom();
  }, [currentIndex]);

  if (!isOpen || !currentImage) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4 bg-gradient-to-b from-black/50 to-transparent">
          <div className="text-white">
            <h3 className="font-medium">{currentImage.title}</h3>
            <p className="text-sm text-gray-300">
              {currentIndex + 1} of {images.length}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {enableZoom && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleZoomOut();
                  }}
                  className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
                  disabled={scale <= 0.5}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <span className="text-white text-sm min-w-[3rem] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleZoomIn();
                  }}
                  className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
                  disabled={scale >= 3}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
              </>
            )}

            {enableDownload && onImageDownload && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onImageDownload(currentImage);
                }}
                className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Download image"
              >
                <Download className="w-5 h-5" />
              </button>
            )}

            {enableShare && onImageShare && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onImageShare(currentImage);
                }}
                className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Share image"
              >
                <Share2 className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close lightbox"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPrevious();
              }}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors z-10"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors z-10"
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Image */}
        <motion.div
          className="max-w-full max-h-full p-8 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.img
            key={currentIndex}
            src={currentImage.src}
            alt={currentImage.alt}
            className="max-w-full max-h-full object-contain cursor-move"
            style={{
              transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            drag={scale > 1}
            dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
            onDrag={(_, info) => {
              setPosition({
                x: position.x + info.delta.x,
                y: position.y + info.delta.y,
              });
            }}
          />
        </motion.div>

        {/* Footer */}
        {currentImage.description && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
            <p className="text-white text-sm text-center max-w-2xl mx-auto">
              {currentImage.description}
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  className,
  columns = 3,
  spacing = 'md',
  aspectRatio = 'square',
  showThumbnails = true,
  showControls = true,
  enableZoom = true,
  enableDownload = false,
  enableShare = false,
  enableLike = false,
  onImageClick,
  onImageLike,
  onImageShare,
  onImageDownload,
  renderImageActions,
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [likedImages, setLikedImages] = useState<Set<string>>(new Set());

  const handleImageClick = (image: GalleryImage, index: number) => {
    if (onImageClick) {
      onImageClick(image, index);
    } else {
      setLightboxIndex(index);
    }
  };

  const handlePrevious = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex - 1 + images.length) % images.length);
    }
  };

  const handleNext = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex + 1) % images.length);
    }
  };

  const handleLike = (image: GalleryImage) => {
    setLikedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(image.id)) {
        newSet.delete(image.id);
      } else {
        newSet.add(image.id);
      }
      return newSet;
    });

    if (onImageLike) {
      onImageLike(image);
    }
  };

  const gridClassName = clsx(
    'grid gap-4',
    {
      'grid-cols-2': columns === 2,
      'grid-cols-3': columns === 3,
      'grid-cols-4': columns === 4,
      'grid-cols-5': columns === 5,
      'gap-2': spacing === 'sm',
      'gap-4': spacing === 'md',
      'gap-6': spacing === 'lg',
    },
    className
  );

  const imageContainerClassName = clsx(
    'relative group overflow-hidden rounded-lg bg-gray-200 cursor-pointer transition-transform hover:scale-105',
    {
      'aspect-square': aspectRatio === 'square',
      'aspect-video': aspectRatio === 'video',
    }
  );

  if (images.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No images to display</p>
      </div>
    );
  }

  return (
    <>
      <div className={gridClassName}>
        {images.map((image, index) => (
          <div key={image.id} className={imageContainerClassName}>
            <img
              src={image.thumbnail || image.src}
              alt={image.alt}
              className="w-full h-full object-cover transition-transform group-hover:scale-110"
              onClick={() => handleImageClick(image, index)}
              loading="lazy"
            />

            {/* Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                {showControls && (
                  <div className="flex items-center space-x-2">
                    {enableLike && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLike(image);
                        }}
                        className={clsx(
                          'p-2 rounded-full transition-colors',
                          likedImages.has(image.id)
                            ? 'bg-red-500 text-white'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        )}
                        aria-label={likedImages.has(image.id) ? 'Unlike image' : 'Like image'}
                      >
                        <Heart
                          className={clsx(
                            'w-4 h-4',
                            likedImages.has(image.id) && 'fill-current'
                          )}
                        />
                      </button>
                    )}

                    {enableShare && onImageShare && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onImageShare(image);
                        }}
                        className="p-2 bg-white/20 text-white hover:bg-white/30 rounded-full transition-colors"
                        aria-label="Share image"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    )}

                    {enableDownload && onImageDownload && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onImageDownload(image);
                        }}
                        className="p-2 bg-white/20 text-white hover:bg-white/30 rounded-full transition-colors"
                        aria-label="Download image"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}

                    {renderImageActions && (
                      <div onClick={(e) => e.stopPropagation()}>
                        {renderImageActions(image)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Image info */}
            {image.title && (
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-white text-sm font-medium truncate">
                  {image.title}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <Lightbox
        images={images}
        currentIndex={lightboxIndex || 0}
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        onPrevious={handlePrevious}
        onNext={handleNext}
        enableZoom={enableZoom}
        enableDownload={enableDownload}
        enableShare={enableShare}
        onImageLike={onImageLike}
        onImageShare={onImageShare}
        onImageDownload={onImageDownload}
      />
    </>
  );
};