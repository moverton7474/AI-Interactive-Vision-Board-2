
import React, { useState, useEffect } from 'react';
import { editVisionImage, enhanceVisionPrompt, getVisionSuggestions, fetchUserGoalsAndVision } from '../services/geminiService';
import { useToast } from '../components/ToastContext';
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

// Style Presets with Tier Locking
const STYLE_PRESETS = [
  { id: 'photorealistic', name: 'Photorealistic', tier: 'FREE' },
  { id: 'cinematic', name: 'Cinematic', tier: 'PRO' },
  { id: 'oil_painting', name: 'Oil Painting', tier: 'PRO' },
  { id: 'watercolor', name: 'Watercolor', tier: 'PRO' },
  { id: 'cyberpunk', name: 'Cyberpunk', tier: 'ELITE' },
  { id: '3d_render', name: '3D Render', tier: 'ELITE' }
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
  const [selectedStyle, setSelectedStyle] = useState<string>('photorealistic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const { showToast } = useToast();
  // const [toastMessage, setToastMessage] = useState<string | null>(null); // Removed local toast
  const [isSaving, setIsSaving] = useState(false);

  // Modals
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  // Reference Library State
  const [showLibrary, setShowLibrary] = useState(true);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [selectedRefIds, setSelectedRefIds] = useState<string[]>([]);
  const [newRefTag, setNewRefTag] = useState('');
  const [newRefIdentityDesc, setNewRefIdentityDesc] = useState('');
  const [isRefUploading, setIsRefUploading] = useState(false);

  // Credit State
  const [credits, setCredits] = useState<number | null>(null);
  const [userTier, setUserTier] = useState<string>('FREE');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  // User Goals State
  const [userGoals, setUserGoals] = useState<{
    visionText?: string;
    financialTarget?: number;
    financialTargetLabel?: string;
    domain?: string;
    tasks: Array<{ id: string; title: string; description?: string; type: string; isCompleted: boolean }>;
  } | null>(null);
  const [showGoalsPanel, setShowGoalsPanel] = useState(true);

  const handleGetSuggestions = async () => {
    setIsSuggesting(true);
    try {
      const profile = await getUserProfile();
      const newSuggestions = await getVisionSuggestions(profile || {});
      setSuggestions(newSuggestions);
      showToast("Here are some ideas for you!", 'success');
    } catch (e) {
      showToast("Could not get suggestions.", 'error');
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleEnhancePrompt = async () => {
    if (!promptInput) return;

    setIsEnhancing(true);
    try {
      const enhanced = await enhanceVisionPrompt(promptInput);
      setPromptInput(enhanced);
      showToast("Prompt enhanced with AI magic!", 'success');
    } catch (e) {
      showToast("Failed to enhance prompt.", 'error');
    } finally {
      setIsEnhancing(false);
    }
  };

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

  // Fetch user goals on mount AND auto-populate prompt from vision text
  useEffect(() => {
    const loadUserGoals = async () => {
      try {
        const goals = await fetchUserGoalsAndVision();
        if (goals) {
          setUserGoals(goals);
          console.log('User goals loaded:', goals.tasks.length, 'tasks');

          // Auto-populate prompt input from user's vision text (if not already set)
          if (!promptInput && !initialPrompt && !initialImage && goals.visionText) {
            setPromptInput(goals.visionText);
            console.log('Prompt auto-populated from vision text');
          }

          // Auto-populate goal text from financial target label
          if (!goalText && goals.financialTargetLabel) {
            setGoalText(goals.financialTargetLabel);
          }

          // Auto-populate header text based on domain
          if (!headerText && goals.domain) {
            const domainHeaders: Record<string, string> = {
              'RETIREMENT': 'My Retirement Vision',
              'CAREER': 'My Career Vision',
              'TRAVEL': 'My Adventure Vision',
              'HEALTH': 'My Wellness Vision'
            };
            setHeaderText(domainHeaders[goals.domain] || 'My Vision Board');
          }
        }
      } catch (err) {
        console.error('Error loading user goals:', err);
      }
    };

    loadUserGoals();
  }, []);



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
          // Pass identity description for likeness preservation
          await saveReferenceImage(base64, tags, newRefIdentityDesc || undefined);
          setNewRefTag('');
          setNewRefIdentityDesc('');
          await loadReferences();
          const hasIdentity = newRefIdentityDesc ? ' with identity description' : '';
          showToast(`Reference added to library${hasIdentity}`, 'success');
        } catch (e) {
          showToast("Failed to upload reference", 'error');
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

  const isStyleLocked = (styleTier: string) => {
    if (styleTier === 'FREE') return false;
    if (styleTier === 'PRO' && (userTier === 'PRO' || userTier === 'ELITE')) return false;
    if (styleTier === 'ELITE' && userTier === 'ELITE') return false;
    return true;
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

      // Build identity prompt from selected references with identity descriptions
      const identityPrompt = selectedRefs
        .map(r => r.identityDescription)
        .filter(Boolean)
        .join('\n\n');

      const imagesToProcess = [baseImage, ...refUrls];

      let fullPrompt = promptInput;
      if (selectedRefs.length > 0) {
        fullPrompt += `. Use the subsequent images as visual references for: ${refTags}.`;
      }

      const editedImage = await editVisionImage(
        imagesToProcess,
        fullPrompt,
        goalText,
        headerText,
        selectedStyle, // Pass selected style
        undefined, // aspectRatio
        identityPrompt || undefined // Pass identity prompt for likeness preservation
      );

      if (editedImage) {
        setResultImage(editedImage);
        setCurrentPrompt(fullPrompt + (goalText ? ` (Goal: ${goalText})` : '') + (headerText ? ` (Title: ${headerText})` : ''));
        showToast("Vision board generated successfully!", 'success');

        // Deduct Credit
        const success = await decrementCredits();
        if (success) {
          setCredits(prev => (prev !== null ? prev - 1 : 0));
        }
      } else {
        const errorMsg = "Could not generate image. Please try a different prompt.";
        setError(errorMsg);
        showToast(errorMsg, 'error');
      }
    } catch (e: any) {
      // Extract meaningful error message
      let errorMsg = "An error occurred during generation.";
      if (e?.message) {
        // Check for common error patterns
        if (e.message.includes('API_KEY_INVALID')) {
          errorMsg = "API configuration issue. Please contact support.";
        } else if (e.message.includes('PERMISSION_DENIED')) {
          errorMsg = "Image generation unavailable. Please try again later.";
        } else if (e.message.includes('RESOURCE_EXHAUSTED')) {
          errorMsg = "Service busy. Please wait a moment and try again.";
        } else if (e.message.includes('network') || e.message.includes('fetch')) {
          errorMsg = "Network error. Please check your connection.";
        } else {
          errorMsg = `Generation failed: ${e.message.substring(0, 100)}`;
        }
      }
      setError(errorMsg);
      showToast(errorMsg, 'error');
      console.error('Vision generation error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = () => {
    if (resultImage) {
      setBaseImage(resultImage);
      setResultImage(null);
      setBaseImage(resultImage);
      setResultImage(null);
      showToast("Image set as new base. Refine away!", 'info');
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

        showToast("Vision successfully saved to cloud.", 'success');
      } catch (e) {
        showToast("Failed to save. Please try again.", 'error');
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

      {/* Image Lightbox Modal */}
      {showLightbox && resultImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={() => setShowLightbox(false)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={resultImage}
            alt="Vision Board Full Size"
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadImage(resultImage);
              }}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg backdrop-blur-sm transition-colors"
            >
              <DownloadIcon className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowLightbox(false);
                setShowPrintModal(true);
              }}
              className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-navy-900 px-4 py-2 rounded-lg transition-colors"
            >
              <PrinterIcon className="w-4 h-4" />
              Order Print
            </button>
          </div>
        </div>
      )}

      {/* Floating Goals Panel - Compact sidebar version */}
      {userGoals && (userGoals.visionText || userGoals.tasks.length > 0 || userGoals.financialTarget) && (
        <div className={`fixed left-0 top-24 z-40 transition-all duration-300 ${showGoalsPanel ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="bg-white/95 backdrop-blur-sm rounded-r-xl shadow-lg border border-l-0 border-purple-200 p-3 max-w-[220px]">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-navy-900 flex items-center gap-1">
                <span>🎯</span> My Goals
              </h4>
              <button
                onClick={() => setShowGoalsPanel(false)}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            </div>

            {/* Action Tasks - Compact list */}
            {userGoals.tasks.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Tasks ({userGoals.tasks.length})</p>
                <ul className="space-y-0.5">
                  {userGoals.tasks.slice(0, 3).map(task => (
                    <li key={task.id} className="flex items-center gap-1.5 text-xs">
                      <span className={`w-2.5 h-2.5 rounded-full border flex-shrink-0 ${task.isCompleted ? 'bg-green-500 border-green-500' : 'border-gray-300'}`} />
                      <span className={`truncate ${task.isCompleted ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                        {task.title}
                      </span>
                    </li>
                  ))}
                  {userGoals.tasks.length > 3 && (
                    <li className="text-[10px] text-indigo-500">+{userGoals.tasks.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}

            {/* Financial Target - Compact */}
            {userGoals.financialTarget && (
              <div className="text-xs bg-green-50 rounded-lg p-2 mb-2">
                <span className="text-green-700 font-bold">${userGoals.financialTarget.toLocaleString()}</span>
                {userGoals.financialTargetLabel && (
                  <span className="text-green-600 text-[10px] ml-1">{userGoals.financialTargetLabel}</span>
                )}
              </div>
            )}

            <p className="text-[9px] text-purple-400 text-center">
              Auto-populating your vision
            </p>
          </div>
        </div>
      )}

      {/* Collapsed Goals Toggle - Fixed button */}
      {userGoals && (userGoals.visionText || userGoals.tasks.length > 0) && !showGoalsPanel && (
        <button
          onClick={() => setShowGoalsPanel(true)}
          className="fixed left-0 top-24 z-40 bg-purple-600 text-white text-xs font-bold px-2 py-3 rounded-r-lg shadow-lg hover:bg-purple-700 transition-colors"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          🎯 Goals
        </button>
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

              {/* Style Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">2. Artistic Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {STYLE_PRESETS.map(style => {
                    const locked = isStyleLocked(style.tier);
                    return (
                      <button
                        key={style.id}
                        onClick={() => !locked && setSelectedStyle(style.id)}
                        className={`relative px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left flex justify-between items-center
                            ${selectedStyle === style.id
                            ? 'bg-navy-900 text-white border-navy-900'
                            : locked
                              ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gold-400'
                          }`}
                      >
                        {style.name}
                        {locked && <span className="text-[10px] bg-gray-200 text-gray-500 px-1 rounded">PRO</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prompt Section */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">3. Design Your Scene</label>

                {/* Preset Tags */}
                <div className="flex flex-wrap gap-2 mb-4 items-center">
                  <button
                    onClick={handleGetSuggestions}
                    disabled={isSuggesting}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md hover:shadow-lg transition-all transform hover:scale-105"
                  >
                    <SparklesIcon className={`w-3 h-3 ${isSuggesting ? 'animate-spin' : ''}`} />
                    {isSuggesting ? 'Thinking...' : 'Inspire Me'}
                  </button>
                  <div className="w-px h-4 bg-gray-300 mx-1"></div>
                  {PRESET_TAGS.map((tag, i) => {
                    const isActive = promptInput.includes(tag);
                    return (
                      <button
                        key={i}
                        onClick={() => togglePreset(tag)}
                        className={`text-xs px-3 py-1.5 rounded-full transition-all border ${isActive
                          ? 'bg-navy-900 text-white border-navy-900 shadow-md'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gold-400 hover:text-navy-900'
                          }`}
                      >
                        {isActive ? '✓ ' : '+ '}{tag}
                      </button>
                    );
                  })}
                </div>

                {/* AI Suggestions */}
                {suggestions.length > 0 && (
                  <div className="mb-4 animate-fade-in">
                    <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">AI Suggestions for You:</p>
                    <div className="flex flex-col gap-2">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => setPromptInput(s)}
                          className="text-left text-xs p-2 bg-purple-50 text-purple-900 rounded-lg border border-purple-100 hover:bg-purple-100 hover:border-purple-300 transition-colors"
                        >
                          ✨ {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-400 focus:border-transparent outline-none resize-none h-32 text-sm pr-10 pb-10"
                    placeholder="Describe your vision..."
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                  />

                  <div className="absolute bottom-2 left-2 flex gap-2">
                    <button
                      onClick={handleEnhancePrompt}
                      disabled={isEnhancing || !promptInput}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${isEnhancing ? 'bg-gray-100 text-gray-400' : 'bg-gold-100 text-gold-700 hover:bg-gold-200'}`}
                      title="Rewrite with AI"
                    >
                      <SparklesIcon className={`w-3 h-3 ${isEnhancing ? 'animate-spin' : ''}`} />
                      {isEnhancing ? 'Enhancing...' : 'Enhance'}
                    </button>
                  </div>

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
                <label className="block text-sm font-medium text-gray-700 mb-2">4. Embed Goal (Optional)</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">5. Vision Board Title (Optional)</label>
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
                    <img
                      src={resultImage}
                      alt="Vision"
                      className="max-w-full max-h-[600px] object-contain rounded-lg shadow-2xl border-4 border-gold-500 cursor-pointer transition-transform hover:scale-[1.02]"
                      onClick={() => setShowLightbox(true)}
                      title="Click to enlarge"
                    />

                    {/* Enlarge hint */}
                    <div className="absolute top-4 left-4 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                      Click to enlarge
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(currentPrompt);
                        showToast("Prompt copied!", 'info');
                      }}
                      className="absolute bottom-4 right-4 p-2 bg-white/90 rounded-full text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-navy-900 shadow-lg"
                      title="Copy Prompt"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
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
                    onClick={() => {
                      if (confirm('Discard this vision? This cannot be undone.')) {
                        setResultImage(null);
                        setCurrentPrompt('');
                        showToast('Vision discarded', 'info');
                      }
                    }}
                    className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg transition-colors font-medium text-sm"
                    title="Discard this vision"
                  >
                    <TrashIcon className="w-4 h-4" />
                    Delete
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
                {/* Identity Description for Likeness Preservation */}
                <div className="mb-2">
                  <textarea
                    placeholder="Identity (e.g. 'tall Black male, 50s, athletic, glasses')"
                    className="w-full bg-white border border-gray-200 rounded-lg p-2 text-[10px] outline-none resize-none h-12 focus:border-gold-400"
                    value={newRefIdentityDesc}
                    onChange={(e) => setNewRefIdentityDesc(e.target.value)}
                  />
                  <p className="text-[9px] text-gray-400 mt-1">Describe physical features for better likeness</p>
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
                  <p className="text-xs text-center text-gray-400 py-4">No references yet.<br />Upload headshots here.</p>
                )}
                {references.map(ref => {
                  const isSelected = selectedRefIds.includes(ref.id);
                  const hasIdentity = !!ref.identityDescription;
                  return (
                    <div
                      key={ref.id}
                      onClick={() => toggleReferenceSelection(ref.id)}
                      className={`relative group rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${isSelected ? 'border-gold-500 ring-1 ring-gold-200' : 'border-transparent hover:border-gray-300'}`}
                      title={hasIdentity ? ref.identityDescription : 'No identity description'}
                    >
                      <img src={ref.url} className="w-full h-24 object-cover" alt="ref" />
                      {/* Tags & Identity Indicator */}
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1">
                        <div className="flex items-center gap-1">
                          {hasIdentity && (
                            <span className="text-[9px] bg-green-500 text-white px-1 rounded" title={ref.identityDescription}>
                              ID
                            </span>
                          )}
                          <p className="text-[10px] text-white truncate flex-1">{ref.tags.join(', ')}</p>
                        </div>
                      </div>
                      {/* Identity tooltip on hover */}
                      {hasIdentity && (
                        <div className="absolute inset-x-0 top-0 bg-green-600/90 text-white text-[9px] p-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <p className="truncate">{ref.identityDescription}</p>
                        </div>
                      )}
                      {/* Delete */}
                      <button
                        onClick={(e) => handleDeleteReference(ref.id, e)}
                        className="absolute top-1 right-1 p-1 bg-white/80 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white z-10"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </button>
                      {/* Selected Indicator */}
                      {isSelected && (
                        <div className="absolute top-1 left-1 bg-gold-500 text-navy-900 rounded-full p-0.5 z-10">
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
