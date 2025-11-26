import React, { useState, useEffect } from 'react';
import { editVisionImage } from '../services/geminiService';
import { saveVisionImage, getVisionGallery, deleteVisionImage } from '../services/storageService';
import { VisionImage } from '../types';
import { SparklesIcon, UploadIcon, SaveIcon, TrashIcon, DownloadIcon } from './Icons';

const PRESET_PROMPTS = [
  "Transport us to a luxury beachfront villa in Phuket, Thailand",
  "Make it sunset with lanterns in the background",
  "Add a modern, clean retirement vision board aesthetic",
  "Show us relaxing in a tropical garden"
];

const VisionBoard: React.FC = () => {
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Gallery State
  const [gallery, setGallery] = useState<VisionImage[]>([]);

  // Load gallery on mount
  useEffect(() => {
    loadGallery();
  }, []);

  const loadGallery = async () => {
    const images = await getVisionGallery();
    setGallery(images);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBaseImage(reader.result as string);
        setResultImage(null); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!baseImage || !promptInput) return;

    setLoading(true);
    setError(null);
    try {
      const editedImage = await editVisionImage(baseImage, promptInput);
      if (editedImage) {
        setResultImage(editedImage);
        setCurrentPrompt(promptInput);
      } else {
        setError("Could not generate image. Please try a different prompt.");
      }
    } catch (e) {
      setError("An error occurred during generation.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToGallery = async () => {
    if (resultImage) {
      const newImage: VisionImage = {
        id: crypto.randomUUID(),
        url: resultImage,
        prompt: currentPrompt || "Vision Board Image",
        createdAt: Date.now(),
        isFavorite: true
      };
      await saveVisionImage(newImage);
      await loadGallery();
    }
  };

  const handleDeleteFromGallery = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteVisionImage(id);
    await loadGallery();
    if (resultImage && gallery.find(g => g.id === id)?.url === resultImage) {
      setResultImage(null);
    }
  };

  const selectFromGallery = (image: VisionImage) => {
    setResultImage(image.url);
    setCurrentPrompt(image.prompt);
    // Optionally set base image to original if we stored it
  };

  const downloadImage = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `vision-board-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col gap-8 animate-fade-in pb-12">
      
      <div className="flex flex-col md:flex-row gap-8">
        {/* Controls */}
        <div className="w-full md:w-1/3 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <h3 className="text-xl font-serif font-bold text-navy-900 mb-4">Create Your Vision</h3>
            
            {/* Upload Section */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">1. Upload Source Photo</label>
              <div className="relative group cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors text-center">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <UploadIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm text-gray-500">{baseImage ? "Change Image" : "Upload Photo of You"}</span>
              </div>
            </div>

            {/* Prompt Section */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">2. Describe Your Dream</label>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-400 focus:border-transparent outline-none resize-none h-32 text-sm"
                placeholder="e.g., Change the background to a white sand beach in Thailand..."
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
              />
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2 mb-6">
              {PRESET_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setPromptInput(p)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors text-left"
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={!baseImage || loading || !promptInput}
              className={`w-full py-3 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all
                ${!baseImage || !promptInput 
                  ? 'bg-gray-300 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-navy-900 to-navy-800 hover:from-navy-800 hover:to-navy-700 transform active:scale-95'
                }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Manifesting...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-5 h-5" />
                  Generate Vision
                </>
              )}
            </button>
            
            {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
          </div>
        </div>

        {/* Canvas / Preview */}
        <div className="w-full md:w-2/3 bg-gray-100 rounded-2xl border-4 border-white shadow-2xl overflow-hidden flex flex-col relative min-h-[500px]">
          <div className="flex-1 flex items-center justify-center p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            {!baseImage && !resultImage && (
              <div className="text-center text-gray-400">
                <SparklesIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Your vision board canvas is empty.</p>
              </div>
            )}

            {baseImage && !resultImage && (
              <img src={baseImage} alt="Original" className="max-w-full max-h-[500px] object-contain rounded-lg shadow-lg" />
            )}

            {resultImage && (
              <div className="relative group">
                <img src={resultImage} alt="Vision" className="max-w-full max-h-[600px] object-contain rounded-lg shadow-2xl border-4 border-gold-500" />
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="bg-black/75 text-white text-xs px-2 py-1 rounded">Generated with Gemini</span>
                </div>
              </div>
            )}
          </div>

          {/* Actions Bar */}
          {resultImage && (
            <div className="bg-white p-4 border-t border-gray-200 flex justify-between items-center">
              <div>
                <span className="text-sm font-medium text-navy-900 block">Vision Board Ready</span>
                <span className="text-xs text-gray-500 truncate max-w-[200px] block">{currentPrompt}</span>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setResultImage(null)}
                  className="text-sm text-gray-500 hover:text-navy-900 px-3 py-2"
                >
                  Discard
                </button>
                <button 
                  onClick={handleSaveToGallery}
                  className="flex items-center gap-2 bg-navy-100 hover:bg-navy-200 text-navy-900 px-4 py-2 rounded-lg transition-colors font-medium text-sm"
                >
                  <SaveIcon className="w-4 h-4" />
                  Save to Gallery
                </button>
                <button 
                  onClick={() => downloadImage(resultImage!)}
                  className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-navy-900 font-bold px-6 py-2 rounded-lg shadow transition-colors"
                >
                  <DownloadIcon className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Saved Gallery Strip */}
      {gallery.length > 0 && (
        <div className="mt-8 border-t border-gray-200 pt-8">
           <h3 className="text-2xl font-serif font-bold text-navy-900 mb-6 flex items-center gap-2">
             <SaveIcon className="w-6 h-6 text-gold-500" />
             Saved Visions
           </h3>
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
             {gallery.map((img) => (
               <div 
                 key={img.id} 
                 onClick={() => selectFromGallery(img)}
                 className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${resultImage === img.url ? 'border-gold-500 ring-2 ring-gold-200' : 'border-transparent hover:border-gray-300'}`}
               >
                 <img src={img.url} alt="Saved Vision" className="w-full h-40 object-cover" />
                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); downloadImage(img.url); }}
                      className="p-2 bg-white rounded-full text-navy-900 hover:text-gold-600"
                      title="Download"
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteFromGallery(img.id, e)}
                      className="p-2 bg-white rounded-full text-red-500 hover:bg-red-50"
                      title="Delete"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                 </div>
                 <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                   <p className="text-white text-xs truncate">{img.prompt}</p>
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}
    </div>
  );
};

export default VisionBoard;