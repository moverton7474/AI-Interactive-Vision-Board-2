
import React, { useState, useEffect } from 'react';
import { getVisionGallery, deleteVisionImage } from '../services/storageService';
import { VisionImage } from '../types';
import { TrashIcon, DownloadIcon, SparklesIcon, SaveIcon, ShareIcon, CopyIcon, MailIcon, TwitterIcon, FacebookIcon, GoogleIcon, PrinterIcon } from './Icons';
import PrintOrderModal from './PrintOrderModal';
import OptimizedImage from './OptimizedImage';

interface Props {
  onSelect: (image: VisionImage) => void;
}

const Gallery: React.FC<Props> = ({ onSelect }) => {
  const [images, setImages] = useState<VisionImage[]>([]);
  const [loading, setLoading] = useState(true);
  // Track which image has the share menu open
  const [activeShareId, setActiveShareId] = useState<string | null>(null);
  const [printImage, setPrintImage] = useState<VisionImage | null>(null);
  // Lightbox state
  const [lightboxImage, setLightboxImage] = useState<VisionImage | null>(null);

  useEffect(() => {
    loadGallery();
  }, []);

  const loadGallery = async () => {
    setLoading(true);
    const data = await getVisionGallery();
    setImages(data);
    setLoading(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this vision?")) {
      await deleteVisionImage(id);
      loadGallery();
    }
  };

  const downloadImage = async (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('🔍 Download button clicked!', { url, timestamp: new Date().toISOString() });

    try {
      // Fetch blob to force download and avoid cross-origin issues
      const response = await fetch(url);
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
    } catch (error) {
      console.error("❌ Download failed, falling back to direct link", error);
      window.open(url, '_blank');
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
      alert("Link copied to clipboard!");
    }
    setActiveShareId(null);
    console.log('✅ Share action completed');
  };

  const handlePrint = (e: React.MouseEvent, img: VisionImage) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('🔍 Print button clicked!', { imgId: img.id, timestamp: new Date().toISOString() });
    setPrintImage(img);
    console.log('✅ Print modal opened');
  }

  const handleImageClick = (e: React.MouseEvent, img: VisionImage) => {
    // Show lightbox instead of immediately selecting for refine
    e.stopPropagation();
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
            <div className="flex gap-3 mt-2">
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
          <p className="text-gray-600 mt-2">All your manifested dreams in one place. Select one to refine.</p>
        </div>
        <div className="text-sm text-gray-500">
          {images.length} Vision{images.length !== 1 ? 's' : ''} Saved
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-gold-500 rounded-full animate-spin"></div>
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

              {/* Background gradient overlay - non-interactive */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />

              {/* Content overlay - appears on hover */}
              <div className="absolute inset-0 flex flex-col justify-end p-4 z-20 pointer-events-none">
                {/* Vision prompt text */}
                <p className="text-white text-sm line-clamp-2 font-medium mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0 pointer-events-none">
                  {img.prompt}
                </p>

                {/* Action buttons - ALWAYS CLICKABLE */}
                <div
                  className="flex justify-end gap-2 relative z-30 pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >

                  {/* Share Button & Menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => toggleShare(e, img.id)}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="p-2.5 bg-white/20 hover:bg-white text-white hover:text-navy-900 rounded-full backdrop-blur-sm transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 pointer-events-auto"
                      title="Share"
                      type="button"
                    >
                      <ShareIcon className="w-4 h-4" />
                    </button>

                    {activeShareId === img.id && (
                      <div
                        className="absolute bottom-14 right-0 bg-white rounded-lg shadow-2xl p-2 flex flex-col gap-1 w-40 z-50 animate-fade-in border border-gray-100"
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

                  <button
                    onClick={(e) => handlePrint(e, img)}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="p-2.5 bg-gold-500 hover:bg-gold-600 text-navy-900 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 pointer-events-auto"
                    title="Order Poster Print"
                    type="button"
                  >
                    <PrinterIcon className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => downloadImage(e, img.url)}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="p-2.5 bg-white/20 hover:bg-white text-white hover:text-navy-900 rounded-full backdrop-blur-sm transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 pointer-events-auto"
                    title="Download"
                    type="button"
                  >
                    <DownloadIcon className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => handleDelete(e, img.id)}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="p-2.5 bg-red-500/20 hover:bg-red-500 text-white rounded-full backdrop-blur-sm transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 pointer-events-auto"
                    title="Delete"
                    type="button"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* View Badge */}
              <div className="absolute top-3 right-3 bg-white/90 text-navy-900 text-xs font-bold px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-lg z-20 pointer-events-none flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
                View Full Size
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Gallery;
