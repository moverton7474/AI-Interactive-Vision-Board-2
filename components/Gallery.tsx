
import React, { useState, useEffect } from 'react';
import { getVisionGallery, deleteVisionImage } from '../services/storageService';
import { VisionImage } from '../types';
import { TrashIcon, DownloadIcon, SparklesIcon, SaveIcon, ShareIcon, CopyIcon, MailIcon, TwitterIcon, FacebookIcon, GoogleIcon, PrinterIcon } from './Icons';
import PrintOrderModal from './PrintOrderModal';
import OptimizedImage from './OptimizedImage';
import { useToast } from './ToastContext';

interface Props {
  onSelect: (image: VisionImage) => void;
  onSetPrimary?: (image: VisionImage) => void;
  primaryVisionId?: string;
  onNavigateToVisionBoard?: () => void;
}

const Gallery: React.FC<Props> = ({ onSelect, onSetPrimary, primaryVisionId, onNavigateToVisionBoard }) => {
  const [images, setImages] = useState<VisionImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Track which image has the share menu open
  const [activeShareId, setActiveShareId] = useState<string | null>(null);
  const [printImage, setPrintImage] = useState<VisionImage | null>(null);
  // Lightbox state
  const [lightboxImage, setLightboxImage] = useState<VisionImage | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadGallery();
  }, []);

  const loadGallery = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getVisionGallery();
      setImages(data);
    } catch (error: any) {
      console.error('Failed to load gallery:', error);
      setLoadError('Failed to load gallery. Please try again.');
      showToast('Failed to load gallery. Please try again.', 'error');
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this vision?")) {
      // Optimistic update: remove from UI immediately
      const previousImages = [...images];
      setImages(images.filter(img => img.id !== id));

      // Also close lightbox if this image was being viewed
      if (lightboxImage?.id === id) {
        setLightboxImage(null);
      }

      try {
        await deleteVisionImage(id);
        showToast('Vision deleted successfully', 'success');
      } catch (error: any) {
        // Rollback on failure
        console.error('Failed to delete image:', error);
        setImages(previousImages);
        showToast('Failed to delete. Please try again.', 'error');
      }
    }
  };

  const downloadImage = async (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    e.preventDefault();

    // Guard against missing or invalid URL
    if (!url || typeof url !== 'string') {
      showToast('Image URL is missing or invalid', 'error');
      return;
    }

    console.log('🔍 Download button clicked!', { url, timestamp: new Date().toISOString() });

    try {
      // Fetch blob to force download and avoid cross-origin issues
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `vision-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      console.log('✅ Download completed successfully');
      showToast('Download started', 'success');
    } catch (error) {
      console.error("❌ Download failed, falling back to direct link", error);
      // Try fallback
      try {
        window.open(url, '_blank');
        showToast('Opening image in new tab', 'info');
      } catch {
        showToast('Failed to download image', 'error');
      }
    }
  };

  const toggleShare = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('🔍 Share button clicked!', { id, currentActiveId: activeShareId, timestamp: new Date().toISOString() });
    setActiveShareId(prev => {
      const newValue = prev === id ? null : id;
      console.log('📊 Share menu state changed:', { from: prev, to: newValue });
      return newValue;
    });
  };

  const handleShareAction = (e: React.MouseEvent, type: 'email' | 'gmail' | 'twitter' | 'copy', url: string) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('🔍 Share action triggered:', { type, url, timestamp: new Date().toISOString() });

    const text = "Check out my retirement vision board created with Visionary!";

    if (type === 'email') {
      window.open(`mailto:?subject=My Vision Board&body=${encodeURIComponent(text + "\n\n" + url)}`, '_self');
    } else if (type === 'gmail') {
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent("My Vision Board")}&body=${encodeURIComponent(text + "\n\n" + url)}`, '_blank');
    } else if (type === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    } else if (type === 'copy') {
      navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard!", 'success');
    }
    setActiveShareId(null);
    console.log('✅ Share action completed');
  };

  const handlePrint = (e: React.MouseEvent, img: VisionImage) => {
    e.stopPropagation();
    e.preventDefault();

    // Guard against missing or invalid image URL
    if (!img?.url || typeof img.url !== 'string') {
      showToast('Image URL is missing or invalid', 'error');
      return;
    }

    console.log('🔍 Print button clicked!', { imgId: img.id, timestamp: new Date().toISOString() });
    setPrintImage(img);
    console.log('✅ Print modal opened');
  }

  const handleImageClick = (e: React.MouseEvent, img: VisionImage) => {
    // Navigate directly to VisionBoard with this image for editing
    e.stopPropagation();
    onSelect(img);
  };

  const handleViewLightbox = (e: React.MouseEvent, img: VisionImage) => {
    // Show lightbox for viewing full-size image
    e.stopPropagation();
    e.preventDefault();
    setLightboxImage(img);
  };

  const handleRefineFromLightbox = () => {
    if (lightboxImage) {
      onSelect(lightboxImage);
      setLightboxImage(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-12" onClick={() => setActiveShareId(null)}>
      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
            onClick={() => setLightboxImage(null)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex flex-col items-center gap-4 max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.prompt}
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
            />

            {/* Prompt display */}
            <p className="text-white/80 text-sm text-center max-w-2xl px-4">
              {lightboxImage.prompt}
            </p>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {onSetPrimary && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetPrimary(lightboxImage);
                    setLightboxImage(null);
                  }}
                  disabled={primaryVisionId === lightboxImage.id}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    primaryVisionId === lightboxImage.id
                      ? 'bg-green-500 text-white cursor-default'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  {primaryVisionId === lightboxImage.id ? 'Current Primary' : 'Set as Primary'}
                </button>
              )}
              <button
                onClick={handleRefineFromLightbox}
                className="flex items-center gap-2 bg-gradient-to-r from-navy-900 to-navy-800 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <SparklesIcon className="w-4 h-4 text-gold-400" />
                Refine This
              </button>
              <button
                onClick={(e) => downloadImage(e, lightboxImage.url)}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg backdrop-blur-sm transition-colors"
              >
                <DownloadIcon className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxImage(null);
                  setPrintImage(lightboxImage);
                }}
                className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-navy-900 px-4 py-2 rounded-lg transition-colors"
              >
                <PrinterIcon className="w-4 h-4" />
                Order Print
              </button>
              <button
                onClick={(e) => handleDelete(e, lightboxImage.id)}
                className="flex items-center gap-2 bg-red-500/80 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {printImage && (
        <PrintOrderModal
          image={printImage}
          onClose={() => setPrintImage(null)}
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-serif font-bold text-navy-900 flex items-center gap-3">
            <SaveIcon className="w-8 h-8 text-gold-500" />
            Vision Gallery
          </h2>
          <p className="text-gray-600 mt-2">All your manifested dreams in one place. Click any vision to refine it.</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {images.length} Vision{images.length !== 1 ? 's' : ''} Saved
          </span>
          {onNavigateToVisionBoard && (
            <button
              onClick={onNavigateToVisionBoard}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold transition-colors shadow-lg hover:shadow-green-500/25"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Vision Board
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-gold-500 rounded-full animate-spin"></div>
        </div>
      ) : loadError ? (
        <div className="text-center py-24 bg-red-50 rounded-2xl border-2 border-dashed border-red-200">
          <svg className="w-12 h-12 text-red-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-medium text-red-900">{loadError}</h3>
          <p className="text-red-600 mb-4">Please check your connection and try again.</p>
          <button
            onClick={loadGallery}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-24 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <SparklesIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No visions yet</h3>
          <p className="text-gray-500">Go to the Visualizer to create your first masterpiece.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {images.map((img) => (
            <div
              key={img.id}
              onClick={(e) => handleImageClick(e, img)}
              className="group relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl hover:border-gold-400 transition-all cursor-pointer aspect-[16/9]"
            >
              <OptimizedImage
                src={img.url}
                alt={img.prompt}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                width={800}
                priority={true}
              />

              {/* Background gradient overlay - always visible at bottom for button visibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />

              {/* Content overlay - prompt appears on hover */}
              <div className="absolute inset-0 flex flex-col justify-end p-4 z-20 pointer-events-none">
                {/* Vision prompt text - appears on hover */}
                <p className="text-white text-sm line-clamp-2 font-medium mb-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0 drop-shadow-lg">
                  {img.prompt}
                </p>
              </div>

              {/* Action buttons - POSITIONED ABSOLUTELY TO AVOID OVERLAY INTERFERENCE */}
              <div className="absolute bottom-3 right-3 flex gap-2 z-[60]">
                {/* Print Button - Gold for emphasis */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('🖨️ Print button clicked for image:', img.id);
                    handlePrint(e, img);
                  }}
                  className="p-2.5 bg-gold-500 hover:bg-gold-600 text-navy-900 rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
                  title="Order Poster Print"
                  type="button"
                >
                  <PrinterIcon className="w-4 h-4" />
                </button>

                {/* Download Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('⬇️ Download button clicked for image:', img.id);
                    downloadImage(e, img.url);
                  }}
                  className="p-2.5 bg-white hover:bg-gray-100 text-navy-900 rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
                  title="Download"
                  type="button"
                >
                  <DownloadIcon className="w-4 h-4" />
                </button>

                {/* Share Button */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('🔗 Share button clicked for image:', img.id);
                      toggleShare(e, img.id);
                    }}
                    className="p-2.5 bg-white hover:bg-gray-100 text-navy-900 rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
                    title="Share"
                    type="button"
                  >
                    <ShareIcon className="w-4 h-4" />
                  </button>

                  {activeShareId === img.id && (
                    <div
                      className="absolute bottom-14 right-0 bg-white rounded-lg shadow-2xl p-2 flex flex-col gap-1 w-40 z-[70] animate-fade-in border border-gray-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => handleShareAction(e, 'email', img.url)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded text-left w-full font-medium transition-colors"
                        type="button"
                      >
                        <MailIcon className="w-3 h-3 text-gray-400" /> Email App
                      </button>
                      <button
                        onClick={(e) => handleShareAction(e, 'gmail', img.url)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded text-left w-full font-medium transition-colors"
                        type="button"
                      >
                        <GoogleIcon className="w-3 h-3" /> Gmail Web
                      </button>
                      <button
                        onClick={(e) => handleShareAction(e, 'twitter', img.url)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded text-left w-full font-medium transition-colors"
                        type="button"
                      >
                        <TwitterIcon className="w-3 h-3 text-blue-400" /> Twitter
                      </button>
                      <button
                        onClick={(e) => handleShareAction(e, 'copy', img.url)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded text-left w-full font-medium transition-colors"
                        type="button"
                      >
                        <CopyIcon className="w-3 h-3 text-gray-400" /> Copy Link
                      </button>
                    </div>
                  )}
                </div>

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('🗑️ Delete button clicked for image:', img.id);
                    handleDelete(e, img.id);
                  }}
                  className="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
                  title="Delete"
                  type="button"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Primary Badge - always visible if this is the primary */}
              {primaryVisionId === img.id && (
                <div className="absolute top-3 left-3 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg z-20 pointer-events-none flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Primary
                </div>
              )}

              {/* Edit Hint Badge */}
              <div className="absolute top-3 right-3 bg-white/90 text-navy-900 text-xs font-bold px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-lg z-20 pointer-events-none flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Click to Edit
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Action Button (FAB) - Always visible at bottom right */}
      {onNavigateToVisionBoard && (
        <button
          onClick={onNavigateToVisionBoard}
          className="fixed bottom-8 right-8 z-50 flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-6 py-4 rounded-full shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 hover:scale-105 group"
        >
          <svg
            className="w-5 h-5 transform group-hover:rotate-90 transition-transform duration-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Vision Board</span>
        </button>
      )}
    </div>
  );
};

export default Gallery;
