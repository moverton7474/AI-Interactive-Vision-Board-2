
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
    } catch (error) {
      console.error("Download failed, falling back to direct link", error);
      window.open(url, '_blank');
    }
  };

  const toggleShare = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveShareId(prev => prev === id ? null : id);
  };

  const handleShareAction = (e: React.MouseEvent, type: 'email' | 'gmail' | 'twitter' | 'copy', url: string) => {
    e.stopPropagation();
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
  };

  const handlePrint = (e: React.MouseEvent, img: VisionImage) => {
    e.stopPropagation();
    setPrintImage(img);
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-12" onClick={() => setActiveShareId(null)}>
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
              onClick={() => onSelect(img)}
              className="group relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl hover:border-gold-400 transition-all cursor-pointer aspect-[16/9]"
            >
              <OptimizedImage
                src={img.url}
                alt={img.prompt}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                width={800}
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                <p className="text-white text-sm line-clamp-2 font-medium mb-3">{img.prompt}</p>
                <div className="flex justify-end gap-2 relative">

                  {/* Share Button & Menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => toggleShare(e, img.id)}
                      className="p-2 bg-white/20 hover:bg-white text-white hover:text-navy-900 rounded-full backdrop-blur-sm transition-colors"
                      title="Share"
                    >
                      <ShareIcon className="w-4 h-4" />
                    </button>

                    {activeShareId === img.id && (
                      <div className="absolute bottom-12 right-0 bg-white rounded-lg shadow-xl p-2 flex flex-col gap-1 w-36 z-10 animate-fade-in border border-gray-100">
                        <button onClick={(e) => handleShareAction(e, 'email', img.url)} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded text-left w-full font-medium">
                          <MailIcon className="w-3 h-3 text-gray-400" /> Email App
                        </button>
                        <button onClick={(e) => handleShareAction(e, 'gmail', img.url)} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded text-left w-full font-medium">
                          <GoogleIcon className="w-3 h-3" /> Gmail Web
                        </button>
                        <button onClick={(e) => handleShareAction(e, 'twitter', img.url)} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded text-left w-full font-medium">
                          <TwitterIcon className="w-3 h-3 text-blue-400" /> Twitter
                        </button>
                        <button onClick={(e) => handleShareAction(e, 'copy', img.url)} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded text-left w-full font-medium">
                          <CopyIcon className="w-3 h-3 text-gray-400" /> Copy Link
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => handlePrint(e, img)}
                    className="p-2 bg-gold-500 hover:bg-gold-600 text-navy-900 rounded-full backdrop-blur-sm transition-colors shadow-lg"
                    title="Order Poster Print"
                  >
                    <PrinterIcon className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => downloadImage(e, img.url)}
                    className="p-2 bg-white/20 hover:bg-white text-white hover:text-navy-900 rounded-full backdrop-blur-sm transition-colors"
                    title="Download"
                  >
                    <DownloadIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, img.id)}
                    className="p-2 bg-red-500/20 hover:bg-red-500 text-white rounded-full backdrop-blur-sm transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Refine Badge */}
              <div className="absolute top-3 right-3 bg-gold-500 text-navy-900 text-xs font-bold px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all shadow-lg">
                Refine This
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Gallery;
