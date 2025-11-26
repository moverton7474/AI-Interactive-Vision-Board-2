
import React, { useState, useEffect } from 'react';
import { getVisionGallery, deleteVisionImage } from '../services/storageService';
import { VisionImage } from '../types';
import { TrashIcon, DownloadIcon, SparklesIcon, SaveIcon } from './Icons';

interface Props {
  onSelect: (image: VisionImage) => void;
}

const Gallery: React.FC<Props> = ({ onSelect }) => {
  const [images, setImages] = useState<VisionImage[]>([]);
  const [loading, setLoading] = useState(true);

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

  const downloadImage = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = url;
    link.download = `vision-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-12">
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
              <img 
                src={img.url} 
                alt={img.prompt}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                 <p className="text-white text-sm line-clamp-2 font-medium mb-3">{img.prompt}</p>
                 <div className="flex justify-end gap-2">
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
