
import React, { useState, useEffect } from 'react';
import { editVisionImage } from '../services/geminiService';
import { 
  saveVisionImage, 
  getVisionGallery, 
  deleteVisionImage,
  saveReferenceImage,
  getReferenceLibrary,
  deleteReferenceImage,
  getUserProfile,
  decrementCredits
} from '../services/storageService';
import { VisionImage, ReferenceImage } from '../types';
import { SparklesIcon, UploadIcon, SaveIcon, TrashIcon, DownloadIcon, RobotIcon, MicIcon, LibraryIcon, TagIcon, PlusIcon, PrinterIcon } from './Icons';
import PrintOrderModal from './PrintOrderModal';
import SubscriptionModal from './SubscriptionModal'; // Import subscription modal

// Granular tags that can be combined
const PRESET_TAGS = [
  "Luxury beachfront villa in Phuket",
  "Sunset with lanterns",
  "Tropical garden",
  "Modern vision board style",
  "Soft cinematic lighting",
  "Relaxing atmosphere",
  "Clear blue ocean",
  "Golden hour"
];

interface Props {
  onAgentStart: (prompt: string) => void;
  initialImage?: VisionImage | null;
  initialPrompt?: string;
}

const VisionBoard: React.FC<Props> = ({ onAgentStart, initialImage, initialPrompt }) => {
  const [baseImage, setBaseImage] = useState<string | null>(initialImage?.url || null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState(initialImage?.prompt || '');
  const [promptInput, setPromptInput] = useState(initialImage?.prompt || initialPrompt || '');
  const [goalText, setGoalText] = useState(''); 
  const [headerText, setHeaderText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Modals
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);

  // Reference Library State
  const [showLibrary, setShowLibrary] = useState(true);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [selectedRefIds, setSelectedRefIds] = useState<string[]>([]);
  const [newRefTag, setNewRefTag] = useState('');
  const [isRefUploading, setIsRefUploading] = useState(false);

  // Credit State
  const [credits, setCredits] = useState<number | null>(null);
  const [userTier, setUserTier] = useState<string>('FREE');

  useEffect(() => {
    loadReferences();
    loadProfile();
    if (initialImage) {
      setBaseImage(initialImage.url);
      setPromptInput(initialImage.prompt);
    } else if (initialPrompt && !promptInput) {
       setPromptInput(initialPrompt);
    }
  }, [initialImage, initialPrompt]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const loadProfile = async () => {
    const profile = await getUserProfile();
    if (profile) {
        setCredits(profile.credits);
        setUserTier(profile.subscription_tier || 'FREE');
    }
  };

  const loadReferences = async () => {
    const refs = await getReferenceLibrary();
    setReferences(refs);
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

  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) {
       setIsRefUploading(true);
       const reader = new FileReader();
       reader.onloadend = async () => {
         const base64 = reader.result as string;
         try {
           const tags = newRefTag ? [newRefTag] : ['reference'];
           await saveReferenceImage(base64, tags);
           setNewRefTag('');
           await loadReferences();
           setToastMessage("Reference added to library");
         } catch (e) {
           setToastMessage("Failed to upload reference");
         } finally {
           setIsRefUploading(false);
         }
       };
       reader.readAsDataURL(file);
     }
  };

  const handleDeleteReference = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Remove this reference?")) {
      await deleteReferenceImage(id);
      loadReferences();
      setSelectedRefIds(prev => prev.filter(refId => refId !== id));
    }
  };

  const toggleReferenceSelection = (id: string) => {
    setSelectedRefIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const startListening = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setPromptInput(prev => prev + (prev ? ' ' : '') + transcript);
      };
      
      recognition.start();
    } else {
      alert("Voice input is not supported in this browser.");
    }
  };

  const togglePreset = (tag: string) => {
    setPromptInput(prev => {
      if (prev.includes(tag)) {
        let newPrompt = prev.replace(tag, '').replace(', ,', ',').trim();
        if (newPrompt.startsWith(',')) newPrompt = newPrompt.substring(1).trim();
        if (newPrompt.endsWith(',')) newPrompt = newPrompt.substring(0, newPrompt.length - 1).trim();
        return newPrompt;
      } else {
        const prefix = prev.trim().length > 0 ? ', ' : '';
        return prev.trim() + prefix + tag;
      }
    });
  };

  const handleGenerate = async () => {
    if (!baseImage || !promptInput) return;

    // Credit Check
    if (credits !== null && credits <= 0) {
        setShowSubModal(true);
        return;
    }

    setLoading(true);
    setError(null);
    try {
      // Collect selected reference URLs
      const selectedRefs = references.filter(r => selectedRefIds.includes(r.id));
      const refUrls = selectedRefs.map(r => r.url);
      const refTags = selectedRefs.flatMap(r => r.tags).join(', ');

      const imagesToProcess = [baseImage, ...refUrls];

      let fullPrompt = promptInput;
      if (selectedRefs.length > 0) {
        fullPrompt += `. Use the subsequent images as visual references for: ${refTags}.`;
      }

      const editedImage = await editVisionImage(imagesToProcess, fullPrompt, goalText, headerText);
      
      if (editedImage) {
        setResultImage(editedImage);
        setCurrentPrompt(fullPrompt + (goalText ? ` (Goal: ${goalText})` : '') + (headerText ? ` (Title: ${headerText})` : ''));
        
        // Deduct Credit
        const success = await decrementCredits();
        if(success) {
            setCredits(prev => (prev !== null ? prev - 1 : 0));
        }
      } else {
        setError("Could not generate image. Please try a different prompt.");
      }
    } catch (e) {
      setError("An error occurred during generation.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = () => {
    if (resultImage) {
      setBaseImage(resultImage); 
      setResultImage(null); 
      setToastMessage("Image set as new base. Refine away!");
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveToGallery = async () => {
    if (resultImage && !isSaving) {
      setIsSaving(true);
      try {
        const newImage: VisionImage = {
          id: crypto.randomUUID(),
          url: resultImage,
          prompt: currentPrompt || "Vision Board Image",
          createdAt: Date.now(),
          isFavorite: true
        };
        await saveVisionImage(newImage);
        setToastMessage("Vision successfully saved to cloud.");
      } catch (e) {
        setToastMessage("Failed to save. Please try again.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const downloadImage = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `vision-board-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const onSubClose = () => {
      setShowSubModal(false);
      loadProfile(); // Refresh credits after potential upgrade
  };

  return (
    <div className="max-w-7xl mx-auto h-full animate-fade-in pb-12 relative flex gap-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-8 z-50 bg-navy-900 text-white px-6 py-3 rounded-lg shadow-xl animate-bounce-in flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-gold-500" />
          {toastMessage}
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && resultImage && (
        <PrintOrderModal 
          image={{
            id: 'current',
            url: resultImage,
            prompt: currentPrompt,
            createdAt: Date.now()
          }}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* Subscription Modal */}
      {showSubModal && (
          <SubscriptionModal tier="PRO" onClose={onSubClose} />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Controls */}
            <div className="w-full md:w-5/12 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 relative overflow-hidden">
                {/* Credits Badge */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${userTier === 'FREE' ? 'bg-gray-100 text-gray-600' : 'bg-gold-100 text-gold-700'}`}>
                        {userTier}
                    </span>
                    <div className="bg-navy-900 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow">
                        <SparklesIcon className="w-3 h-3 text-gold-400" />
                        {credits !== null ? credits : '...'} Credits
                    </div>
                </div>

                <h3 className="text-xl font-serif font-bold text-navy-900 mb-4">Create Your Vision</h3>
                
                {/* Upload Section */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">1. Base Image (Scene)</label>
                  <div className="relative group cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors text-center">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <UploadIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-sm text-gray-500">{baseImage ? "Change Base Image" : "Upload Photo of You"}</span>
                  </div>
                </div>

                {/* Prompt Section */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">2. Design Your Scene</label>
                  
                  {/* Preset Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {PRESET_TAGS.map((tag, i) => {
                      const isActive = promptInput.includes(tag);
                      return (
                        <button
                          key={i}
                          onClick={() => togglePreset(tag)}
                          className={`text-xs px-3 py-1.5 rounded-full transition-all border ${
                            isActive 
                              ? 'bg-navy-900 text-white border-navy-900 shadow-md' 
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gold-400 hover:text-navy-900'
                          }`}
                        >
                          {isActive ? '✓ ' : '+ '}{tag}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative">
                    <textarea
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-400 focus:border-transparent outline-none resize-none h-24 text-sm pr-10"
                      placeholder="Describe your vision..."
                      value={promptInput}
                      onChange={(e) => setPromptInput(e.target.value)}
                    />
                    <button
                      onClick={startListening}
                      className={`absolute right-2 bottom-2 p-2 rounded-full transition-colors ${isListening ? 'bg-red-100 text-red-500 animate-pulse' : 'text-gray-400 hover:text-navy-900'}`}
                      title="Use Voice Dictation"
                    >
                      <MicIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Goal Text Overlay */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">3. Embed Goal (Optional)</label>
                  <input 
                    type="text" 
                    value={goalText}
                    onChange={(e) => setGoalText(e.target.value)}
                    placeholder="e.g., Retire 2027"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-gold-500 outline-none"
                  />
                </div>

                {/* Header Title Overlay */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">4. Vision Board Title (Optional)</label>
                  <input 
                    type="text" 
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    placeholder="e.g. The Overton Family Vision 2025"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-gold-500 outline-none"
                  />
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
                      {resultImage ? 'Regenerate' : 'Generate Vision'}
                    </>
                  )}
                </button>
                
                {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
                {credits === 0 && (
                    <button onClick={() => setShowSubModal(true)} className="w-full mt-2 text-xs text-gold-600 font-bold underline hover:text-gold-700">
                        Out of credits? Upgrade now.
                    </button>
                )}
              </div>
            </div>

            {/* Canvas / Preview */}
            <div className="w-full md:w-7/12 flex flex-col gap-4">
              <div className="bg-gray-100 rounded-2xl border-4 border-white shadow-2xl overflow-hidden flex flex-col relative min-h-[500px]">
                <div className="flex-1 flex items-center justify-center p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] relative">
                  
                   {/* Badge for Base Image */}
                   {baseImage && !resultImage && (
                     <span className="absolute top-4 left-4 bg-gray-800 text-white text-xs px-2 py-1 rounded shadow">Base Image Loaded</span>
                   )}

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
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Bar */}
              {resultImage && (
                <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex gap-3 w-full justify-center md:justify-end flex-wrap">
                    <button 
                      onClick={handleRefine}
                      className="flex items-center gap-2 bg-white border border-navy-200 hover:border-navy-900 text-navy-900 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                    >
                      <SparklesIcon className="w-4 h-4 text-gold-500" />
                      Refine This
                    </button>

                    <button 
                      onClick={() => onAgentStart(currentPrompt)}
                      className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-4 py-2 rounded-lg shadow-md transition-transform transform hover:scale-105 text-sm"
                    >
                      <RobotIcon className="w-4 h-4" />
                      Execute
                    </button>

                    <button 
                      onClick={handleSaveToGallery}
                      disabled={isSaving}
                      className="flex items-center gap-2 bg-navy-100 hover:bg-navy-200 text-navy-900 px-4 py-2 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
                    >
                      {isSaving ? (
                        <div className="w-4 h-4 border-2 border-navy-900/30 border-t-navy-900 rounded-full animate-spin" />
                      ) : (
                        <SaveIcon className="w-4 h-4" />
                      )}
                      Save
                    </button>
                    
                    <button 
                      onClick={() => setShowPrintModal(true)}
                      className="p-2 bg-gold-500 hover:bg-gold-600 text-navy-900 rounded-lg shadow transition-colors"
                      title="Order Poster Print"
                    >
                      <PrinterIcon className="w-4 h-4" />
                    </button>

                    <button 
                      onClick={() => downloadImage(resultImage!)}
                      className="p-2 bg-white border border-gray-200 hover:bg-gray-50 text-navy-900 rounded-lg shadow-sm transition-colors"
                      title="Download"
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>

      {/* Reference Library Sidebar */}
      <div className={`transition-all duration-300 flex flex-col gap-4 ${showLibrary ? 'w-64' : 'w-12 items-center'}`}>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden flex flex-col h-full min-h-[600px]">
             
             {/* Header */}
             <div className={`p-4 border-b border-gray-100 flex items-center ${showLibrary ? 'justify-between' : 'justify-center'}`}>
                {showLibrary && <h3 className="font-bold text-navy-900 text-sm flex items-center gap-2"><LibraryIcon className="w-4 h-4" /> Reference Library</h3>}
                <button onClick={() => setShowLibrary(!showLibrary)} className="text-gray-400 hover:text-navy-900">
                  {showLibrary ? '←' : <LibraryIcon className="w-5 h-5 text-gold-500" />}
                </button>
             </div>

             {showLibrary && (
                <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
                   {/* Upload Area */}
                   <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <TagIcon className="w-3 h-3 text-gray-400" />
                        <input 
                           type="text" 
                           placeholder="Tag (e.g. Milton)" 
                           className="bg-transparent text-xs w-full outline-none"
                           value={newRefTag}
                           onChange={(e) => setNewRefTag(e.target.value)}
                        />
                      </div>
                      <label className="block w-full text-center bg-white border border-gray-200 hover:border-gold-500 rounded-lg py-2 cursor-pointer transition-colors">
                         <span className="text-xs font-medium text-navy-900 flex items-center justify-center gap-1">
                            {isRefUploading ? <div className="w-3 h-3 border-2 border-gray-300 border-t-navy-900 rounded-full animate-spin" /> : <PlusIcon className="w-3 h-3" />}
                            Upload Ref
                         </span>
                         <input type="file" className="hidden" accept="image/*" onChange={handleReferenceUpload} disabled={isRefUploading} />
                      </label>
                   </div>

                   {/* List */}
                   <div className="space-y-3">
                      {references.length === 0 && (
                         <p className="text-xs text-center text-gray-400 py-4">No references yet.<br/>Upload headshots here.</p>
                      )}
                      {references.map(ref => {
                        const isSelected = selectedRefIds.includes(ref.id);
                        return (
                          <div 
                            key={ref.id} 
                            onClick={() => toggleReferenceSelection(ref.id)}
                            className={`relative group rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${isSelected ? 'border-gold-500 ring-1 ring-gold-200' : 'border-transparent hover:border-gray-300'}`}
                          >
                             <img src={ref.url} className="w-full h-24 object-cover" alt="ref" />
                             {/* Tags */}
                             <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1">
                                <p className="text-[10px] text-white truncate">{ref.tags.join(', ')}</p>
                             </div>
                             {/* Delete */}
                             <button 
                               onClick={(e) => handleDeleteReference(ref.id, e)}
                               className="absolute top-1 right-1 p-1 bg-white/80 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                             >
                               <TrashIcon className="w-3 h-3" />
                             </button>
                             {/* Selected Indicator */}
                             {isSelected && (
                               <div className="absolute top-1 left-1 bg-gold-500 text-navy-900 rounded-full p-0.5">
                                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M4.5 12.75l6 6 9-13.5" /></svg>
                               </div>
                             )}
                          </div>
                        )
                      })}
                   </div>
                </div>
             )}
          </div>
      </div>

    </div>
  );
};

export default VisionBoard;
