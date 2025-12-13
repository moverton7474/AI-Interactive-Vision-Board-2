
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { editVisionImage, enhanceVisionPrompt, getVisionSuggestions, fetchUserGoalsAndVision, validateLikeness, VisionGenerationResult, LikenessValidationResult } from '../services/geminiService';
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

// Camera Icon Component
const CameraIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// Screenshot Icon Component
const ScreenshotIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// Image Library Icon Component
const ImageLibraryIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
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

  // Reference Library State - collapsed by default on mobile
  const [showLibrary, setShowLibrary] = useState(false);
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

  // Likeness & Model Tracking State
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [likenessOptimized, setLikenessOptimized] = useState<boolean>(false);
  const [likenessValidation, setLikenessValidation] = useState<LikenessValidationResult | null>(null);
  const [isValidatingLikeness, setIsValidatingLikeness] = useState(false);

  // Camera & Screenshot State
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showImageSourcePicker, setShowImageSourcePicker] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Use reference image as base image
  const useReferenceAsBase = (ref: ReferenceImage) => {
    setBaseImage(ref.url);
    setResultImage(null);
    showToast(`Using "${ref.tags.join(', ')}" as base image`, 'success');
  };

  // Start camera for photo capture
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setCameraStream(stream);
      setShowCameraModal(true);
      setCapturedImage(null);

      // Wait for modal to render, then attach stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error('Camera access error:', err);
      showToast('Could not access camera. Please check permissions.', 'error');
    }
  }, [showToast]);

  // Capture photo from camera
  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/png');
        setCapturedImage(imageData);
      }
    }
  }, []);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCameraModal(false);
    setCapturedImage(null);
  }, [cameraStream]);

  // Use captured image as base
  const useCapturedAsBase = useCallback(() => {
    if (capturedImage) {
      setBaseImage(capturedImage);
      setResultImage(null);
      stopCamera();
      showToast('Photo set as base image!', 'success');
    }
  }, [capturedImage, stopCamera, showToast]);

  // Screenshot capture using Screen Capture API
  const captureScreenshot = useCallback(async () => {
    try {
      // @ts-ignore - getDisplayMedia is available in modern browsers
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' }
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/png');
        setBaseImage(imageData);
        setResultImage(null);
        showToast('Screenshot captured as base image!', 'success');
      }

      // Stop screen capture
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error('Screenshot error:', err);
      showToast('Screenshot cancelled or not supported.', 'info');
    }
  }, [showToast]);

  // Save current base image to Reference Library
  const saveBaseToLibrary = useCallback(async () => {
    if (!baseImage) return;

    setIsSavingToLibrary(true);
    try {
      const tag = prompt('Enter a tag for this reference (e.g., "Milton", "Lisa"):') || 'reference';
      const identityDesc = prompt('Describe physical features for better likeness (optional):') || '';

      await saveReferenceImage(baseImage, [tag], identityDesc || undefined);
      await loadReferences();
      showToast('Image saved to Reference Library!', 'success');
    } catch (err) {
      console.error('Save to library error:', err);
      showToast('Failed to save to library.', 'error');
    } finally {
      setIsSavingToLibrary(false);
    }
  }, [baseImage, showToast]);

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

  // Validate references before generation (Gemini 3 Pro supports up to 5 human subjects)
  const validateForGeneration = useCallback(() => {
    const selectedRefs = references.filter(r => selectedRefIds.includes(r.id));

    // Check max reference limit (Gemini 3 Pro Image supports up to 14 images, 5 human subjects)
    if (selectedRefs.length > 5) {
      showToast("Maximum 5 person references supported for best likeness. Consider selecting fewer references.", 'info');
      return false;
    }

    // Warn if references lack identity descriptions (non-blocking)
    const refsWithoutDescription = selectedRefs.filter(r => !r.identityDescription);
    if (refsWithoutDescription.length > 0 && selectedRefs.length > 0) {
      showToast(
        `Tip: Add identity descriptions to your reference photos for better likeness preservation. ${refsWithoutDescription.length} reference(s) missing descriptions.`,
        'info'
      );
      // Don't block - just inform
    }

    return true;
  }, [references, selectedRefIds, showToast]);

  const handleGenerate = async () => {
    if (!baseImage || !promptInput) return;

    // Run validation checks
    if (!validateForGeneration()) {
      return;
    }

    // Credit Check
    if (credits !== null && credits <= 0) {
      setShowSubModal(true);
      return;
    }

    setLoading(true);
    setError(null);
    setLikenessValidation(null); // Reset previous validation
    setModelUsed(null);
    setLikenessOptimized(false);

    try {
      // Collect selected reference data
      const selectedRefs = references.filter(r => selectedRefIds.includes(r.id));
      const refUrls = selectedRefs.map(r => r.url);
      const refTags = selectedRefs.flatMap(r => r.tags); // Keep as array for proper tagging

      // Build identity prompt from selected references with identity descriptions
      const identityPrompt = selectedRefs
        .map(r => r.identityDescription)
        .filter(Boolean)
        .join('\n\n');

      const imagesToProcess = [baseImage, ...refUrls];

      // Build the scene prompt (don't append ref info - the backend handles this now)
      let fullPrompt = promptInput;

      // Call the upgraded editVisionImage with reference tags
      const result = await editVisionImage(
        imagesToProcess,
        fullPrompt,
        goalText,
        headerText,
        selectedStyle,
        undefined, // aspectRatio
        identityPrompt || undefined,
        refTags.length > 0 ? refTags : undefined // Pass reference image tags
      );

      if (result && result.image) {
        setResultImage(result.image);
        setCurrentPrompt(fullPrompt + (goalText ? ` (Goal: ${goalText})` : '') + (headerText ? ` (Title: ${headerText})` : ''));

        // Store model metadata
        setModelUsed(result.model_used || null);
        setLikenessOptimized(result.likeness_optimized || false);

        // Show appropriate success message
        if (result.warning) {
          showToast(`Vision generated with warning: ${result.warning}`, 'info');
        } else if (result.likeness_optimized && selectedRefs.length > 0) {
          showToast("Vision generated with likeness optimization!", 'success');
        } else {
          showToast("Vision board generated successfully!", 'success');
        }

        // Deduct Credit
        const success = await decrementCredits();
        if (success) {
          setCredits(prev => (prev !== null ? prev - 1 : 0));
        }

        // Optional: Run likeness validation if references were used
        if (selectedRefs.length > 0 && result.likeness_optimized) {
          // Don't block on validation - run it in background
          runLikenessValidation(refUrls, result.image, selectedRefs.map(r => r.identityDescription || r.tags.join(', ')));
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
        if (e.message.includes('Failed to send a request to the Edge Function')) {
          errorMsg = "Image generation service is temporarily unavailable. Please try again in a few minutes or contact support if the issue persists.";
        } else if (e.message.includes('API_KEY_INVALID')) {
          errorMsg = "API configuration issue. Please contact support.";
        } else if (e.message.includes('PERMISSION_DENIED')) {
          errorMsg = "Image generation unavailable. Please try again later.";
        } else if (e.message.includes('RESOURCE_EXHAUSTED')) {
          errorMsg = "Service busy. Please wait a moment and try again.";
        } else if (e.message.includes('network') || e.message.includes('fetch')) {
          errorMsg = "Network error. Please check your connection.";
        } else if (e.message.includes('Missing authorization') || e.message.includes('401')) {
          errorMsg = "Session expired. Please sign out and sign back in.";
        } else if (e.message.includes('Invalid or expired')) {
          errorMsg = "Your session has expired. Please refresh the page and sign in again.";
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

  // Background likeness validation (non-blocking)
  const runLikenessValidation = async (refUrls: string[], generatedImage: string, descriptions: string[]) => {
    setIsValidatingLikeness(true);
    try {
      const validation = await validateLikeness(refUrls, generatedImage, descriptions);
      if (validation) {
        setLikenessValidation(validation);

        // Show feedback based on likeness score
        if (validation.likeness_score !== null) {
          if (validation.likeness_score >= 0.7) {
            console.log('Likeness validation passed:', validation.likeness_score);
          } else if (validation.likeness_score >= 0.5) {
            showToast("Likeness could be improved. Try regenerating.", 'info');
          } else {
            showToast("Low likeness score. Consider regenerating with 'stronger likeness emphasis'.", 'info');
          }
        }
      }
    } catch (e) {
      console.error('Likeness validation error:', e);
    } finally {
      setIsValidatingLikeness(false);
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
        // Get selected reference IDs for tracking
        const selectedRefs = references.filter(r => selectedRefIds.includes(r.id));

        const newImage = {
          id: crypto.randomUUID(),
          url: resultImage,
          prompt: currentPrompt || "Vision Board Image",
          createdAt: Date.now(),
          isFavorite: true,
          // Include likeness metadata for tracking
          modelUsed: modelUsed || undefined,
          referenceImageIds: selectedRefs.length > 0 ? selectedRefs.map(r => r.id) : undefined,
          likenessOptimized: likenessOptimized,
          likenessMetadata: likenessValidation ? {
            likeness_score: likenessValidation.likeness_score ?? undefined,
            face_match: likenessValidation.face_match,
            body_type_match: likenessValidation.body_type_match,
            explanation: likenessValidation.explanation
          } : undefined
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
    <div className="max-w-7xl mx-auto h-full animate-fade-in pb-12 relative flex flex-col lg:flex-row gap-4 lg:gap-6 px-4 lg:px-0">



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

      {/* Camera Capture Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-navy-900 flex items-center gap-2">
                <CameraIcon className="w-5 h-5 text-gold-500" />
                Take Photo
              </h3>
              <button
                onClick={stopCamera}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {/* Video/Preview Area */}
              <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video mb-4">
                {!capturedImage ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-full h-full object-cover"
                  />
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {!capturedImage ? (
                  <button
                    onClick={capturePhoto}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-navy-900 to-navy-800 hover:from-navy-800 hover:to-navy-700 text-white font-bold py-3 rounded-xl transition-all"
                  >
                    <CameraIcon className="w-5 h-5" />
                    Capture Photo
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setCapturedImage(null)}
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 rounded-xl transition-colors"
                    >
                      Retake
                    </button>
                    <button
                      onClick={useCapturedAsBase}
                      className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 rounded-xl transition-all"
                    >
                      <SparklesIcon className="w-5 h-5" />
                      Use as Base
                    </button>
                  </>
                )}
              </div>

              <p className="text-xs text-gray-400 text-center mt-3">
                Position yourself in the frame, then click capture
              </p>
            </div>
          </div>
        </div>
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

      {/* Floating Goals Panel - Hidden on mobile, compact sidebar on desktop */}
      {userGoals && (userGoals.visionText || userGoals.tasks.length > 0 || userGoals.financialTarget) && (
        <div className={`hidden lg:block fixed left-0 top-24 z-40 transition-all duration-300 ${showGoalsPanel ? 'translate-x-0' : '-translate-x-full'}`}>
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

      {/* Collapsed Goals Toggle - Hidden on mobile, fixed button on desktop */}
      {userGoals && (userGoals.visionText || userGoals.tasks.length > 0) && !showGoalsPanel && (
        <button
          onClick={() => setShowGoalsPanel(true)}
          className="hidden lg:block fixed left-0 top-24 z-40 bg-purple-600 text-white text-xs font-bold px-2 py-3 rounded-r-lg shadow-lg hover:bg-purple-700 transition-colors"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          🎯 Goals
        </button>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Controls */}
          <div className="w-full md:w-5/12 space-y-4 md:space-y-6">
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-lg border border-gray-100 relative overflow-hidden">
              {/* Credits Badge */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg md:text-xl font-serif font-bold text-navy-900">Create Your Vision</h3>
                <div className="flex items-center gap-1 md:gap-2">
                  <span className={`text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 rounded-full ${userTier === 'FREE' ? 'bg-gray-100 text-gray-600' : 'bg-gold-100 text-gold-700'}`}>
                    {userTier}
                  </span>
                  <div className="bg-navy-900 text-white text-[10px] md:text-xs font-bold px-2 md:px-3 py-1 rounded-full flex items-center gap-1 shadow">
                    <SparklesIcon className="w-3 h-3 text-gold-400" />
                    {credits !== null ? credits : '..'}
                  </div>
                </div>
              </div>

              {/* Upload Section - Enhanced with multiple options */}
              <div className="mb-4 md:mb-6">
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">1. Base Image (Scene)</label>

                {/* Image Source Options */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {/* Upload from Computer */}
                  <label className="relative cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-3 hover:bg-gray-50 hover:border-gold-400 transition-all text-center group">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <UploadIcon className="w-5 h-5 text-gray-400 mx-auto mb-1 group-hover:text-gold-500" />
                    <span className="text-xs text-gray-500 group-hover:text-navy-900">Upload File</span>
                  </label>

                  {/* Take Photo with Camera */}
                  <button
                    onClick={startCamera}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-3 hover:bg-gray-50 hover:border-gold-400 transition-all text-center group"
                  >
                    <CameraIcon className="w-5 h-5 text-gray-400 mx-auto mb-1 group-hover:text-gold-500" />
                    <span className="text-xs text-gray-500 group-hover:text-navy-900">Take Photo</span>
                  </button>

                  {/* Capture Screenshot */}
                  <button
                    onClick={captureScreenshot}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-3 hover:bg-gray-50 hover:border-gold-400 transition-all text-center group"
                  >
                    <ScreenshotIcon className="w-5 h-5 text-gray-400 mx-auto mb-1 group-hover:text-gold-500" />
                    <span className="text-xs text-gray-500 group-hover:text-navy-900">Screenshot</span>
                  </button>

                  {/* Select from Reference Library */}
                  <button
                    onClick={() => {
                      setShowLibrary(true);
                      showToast('Click "Use as Base" on any reference photo', 'info');
                    }}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-3 hover:bg-gray-50 hover:border-gold-400 transition-all text-center group"
                  >
                    <LibraryIcon className="w-5 h-5 text-gray-400 mx-auto mb-1 group-hover:text-gold-500" />
                    <span className="text-xs text-gray-500 group-hover:text-navy-900">From Library</span>
                  </button>
                </div>

                {/* Base Image Preview with Save to Library option */}
                {baseImage && (
                  <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    <img src={baseImage} alt="Base" className="w-full h-32 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-between p-2">
                      <span className="text-white text-xs font-medium">Base Image Loaded</span>
                      <button
                        onClick={saveBaseToLibrary}
                        disabled={isSavingToLibrary}
                        className="flex items-center gap-1 text-xs bg-white/90 hover:bg-white text-navy-900 px-2 py-1 rounded transition-colors"
                        title="Save to Reference Library"
                      >
                        {isSavingToLibrary ? (
                          <div className="w-3 h-3 border border-navy-900/30 border-t-navy-900 rounded-full animate-spin" />
                        ) : (
                          <SaveIcon className="w-3 h-3" />
                        )}
                        Save to Library
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Style Selector */}
              <div className="mb-4 md:mb-6">
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">2. Artistic Style</label>
                <div className="grid grid-cols-3 md:grid-cols-2 gap-1 md:gap-2">
                  {STYLE_PRESETS.map(style => {
                    const locked = isStyleLocked(style.tier);
                    return (
                      <button
                        key={style.id}
                        onClick={() => !locked && setSelectedStyle(style.id)}
                        className={`relative px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-medium border transition-all text-left flex justify-between items-center
                            ${selectedStyle === style.id
                            ? 'bg-navy-900 text-white border-navy-900'
                            : locked
                              ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gold-400'
                          }`}
                      >
                        <span className="truncate">{style.name}</span>
                        {locked && <span className="text-[8px] md:text-[10px] bg-gray-200 text-gray-500 px-1 rounded ml-1">PRO</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prompt Section */}
              <div className="mb-4 md:mb-6">
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">3. Design Your Scene</label>

                {/* Preset Tags - Scrollable on mobile */}
                <div className="flex flex-wrap gap-1.5 md:gap-2 mb-3 md:mb-4 items-center max-h-24 md:max-h-none overflow-y-auto md:overflow-visible">
                  <button
                    onClick={handleGetSuggestions}
                    disabled={isSuggesting}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md hover:shadow-lg transition-all transform hover:scale-105"
                  >
                    <SparklesIcon className={`w-3 h-3 ${isSuggesting ? 'animate-spin' : ''}`} />
                    {isSuggesting ? 'Thinking...' : 'Inspire Me'}
                  </button>
                  <div className="w-px h-4 bg-gray-300 mx-0.5 md:mx-1 hidden md:block"></div>
                  {PRESET_TAGS.map((tag, i) => {
                    const isActive = promptInput.includes(tag);
                    return (
                      <button
                        key={i}
                        onClick={() => togglePreset(tag)}
                        className={`text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-full transition-all border whitespace-nowrap ${isActive
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
                    className="w-full p-2 md:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-400 focus:border-transparent outline-none resize-none h-24 md:h-32 text-xs md:text-sm pr-10 pb-10"
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
              <div className="mb-4 md:mb-6">
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">4. Embed Goal (Optional)</label>
                <input
                  type="text"
                  value={goalText}
                  onChange={(e) => setGoalText(e.target.value)}
                  placeholder="e.g., Retire 2027"
                  className="w-full border border-gray-300 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm focus:border-gold-500 outline-none"
                />
              </div>

              {/* Header Title Overlay */}
              <div className="mb-4 md:mb-6">
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">5. Vision Board Title (Optional)</label>
                <input
                  type="text"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  placeholder="e.g. The Overton Family Vision 2025"
                  className="w-full border border-gray-300 rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm focus:border-gold-500 outline-none"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={!baseImage || loading || !promptInput}
                className={`w-full py-2.5 md:py-3 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all text-sm md:text-base
                    ${!baseImage || !promptInput
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-navy-900 to-navy-800 hover:from-navy-800 hover:to-navy-700 transform active:scale-95'
                  }`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="text-sm md:text-base">Manifesting...</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-4 h-4 md:w-5 md:h-5" />
                    <span>{resultImage ? 'Regenerate' : 'Generate Vision'}</span>
                  </>
                )}
              </button>

              {error && <p className="text-red-500 text-[10px] md:text-xs mt-2 text-center">{error}</p>}
              {credits === 0 && (
                <button onClick={() => setShowSubModal(true)} className="w-full mt-2 text-[10px] md:text-xs text-gold-600 font-bold underline hover:text-gold-700">
                  Out of credits? Upgrade now.
                </button>
              )}
            </div>
          </div>

          {/* Canvas / Preview */}
          <div className="w-full md:w-7/12 flex flex-col gap-4 order-first md:order-last">
            <div className="bg-gray-100 rounded-2xl border-4 border-white shadow-2xl overflow-hidden flex flex-col relative min-h-[300px] md:min-h-[500px]">
              <div className="flex-1 flex items-center justify-center p-4 md:p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] relative">

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
                  <img src={baseImage} alt="Original" className="max-w-full max-h-[250px] md:max-h-[500px] object-contain rounded-lg shadow-lg" />
                )}

                {resultImage && (
                  <div className="relative group">
                    <img
                      src={resultImage}
                      alt="Vision"
                      className="max-w-full max-h-[280px] md:max-h-[600px] object-contain rounded-lg shadow-2xl border-2 md:border-4 border-gold-500 cursor-pointer transition-transform hover:scale-[1.02]"
                      onClick={() => setShowLightbox(true)}
                      title="Click to enlarge"
                    />

                    {/* Model & Likeness Info Badge */}
                    <div className="absolute top-4 left-4 flex flex-col gap-1">
                      {/* Enlarge hint */}
                      <div className="bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                        Click to enlarge
                      </div>

                      {/* Likeness optimization badge */}
                      {likenessOptimized && (
                        <div className="bg-green-500/90 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Likeness Optimized
                        </div>
                      )}

                      {/* Likeness validation score */}
                      {likenessValidation && likenessValidation.likeness_score !== null && (
                        <div
                          className={`text-white text-[10px] px-2 py-1 rounded flex items-center gap-1 ${
                            likenessValidation.likeness_score >= 0.7
                              ? 'bg-green-500/90'
                              : likenessValidation.likeness_score >= 0.5
                                ? 'bg-yellow-500/90'
                                : 'bg-red-500/90'
                          }`}
                          title={likenessValidation.explanation || 'Likeness score'}
                        >
                          Score: {Math.round(likenessValidation.likeness_score * 100)}%
                        </div>
                      )}

                      {/* Validating indicator */}
                      {isValidatingLikeness && (
                        <div className="bg-blue-500/90 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1">
                          <div className="w-2 h-2 border border-white/50 border-t-white rounded-full animate-spin" />
                          Checking likeness...
                        </div>
                      )}
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
              <div className="bg-white p-3 md:p-4 rounded-xl shadow-md border border-gray-100">
                {/* Mobile: 2 rows of buttons */}
                <div className="grid grid-cols-3 md:flex md:flex-row md:justify-end gap-2 md:gap-3">
                  <button
                    onClick={handleSaveToGallery}
                    disabled={isSaving}
                    className="flex items-center justify-center gap-1 md:gap-2 bg-navy-100 hover:bg-navy-200 text-navy-900 px-2 md:px-4 py-2 rounded-lg transition-colors font-medium text-xs md:text-sm disabled:opacity-50"
                  >
                    {isSaving ? (
                      <div className="w-3 h-3 md:w-4 md:h-4 border-2 border-navy-900/30 border-t-navy-900 rounded-full animate-spin" />
                    ) : (
                      <SaveIcon className="w-3 h-3 md:w-4 md:h-4" />
                    )}
                    <span>Save</span>
                  </button>

                  <button
                    onClick={() => setShowPrintModal(true)}
                    className="flex items-center justify-center gap-1 md:gap-2 bg-gradient-to-r from-gold-500 to-amber-500 hover:from-gold-400 hover:to-amber-400 text-navy-900 font-bold px-2 md:px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all text-xs md:text-sm"
                    title="Order Poster Print"
                  >
                    <PrinterIcon className="w-3 h-3 md:w-4 md:h-4" />
                    <span>Print</span>
                  </button>

                  <button
                    onClick={() => downloadImage(resultImage!)}
                    className="flex items-center justify-center gap-1 md:gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-navy-900 px-2 md:px-4 py-2 rounded-lg shadow-sm transition-colors text-xs md:text-sm"
                    title="Download"
                  >
                    <DownloadIcon className="w-3 h-3 md:w-4 md:h-4" />
                    <span className="hidden md:inline">Download</span>
                  </button>

                  <button
                    onClick={handleRefine}
                    className="flex items-center justify-center gap-1 md:gap-2 bg-white border border-navy-200 hover:border-navy-900 text-navy-900 px-2 md:px-4 py-2 rounded-lg transition-colors text-xs md:text-sm font-medium"
                  >
                    <SparklesIcon className="w-3 h-3 md:w-4 md:h-4 text-gold-500" />
                    <span>Refine</span>
                  </button>

                  <button
                    onClick={() => onAgentStart(currentPrompt)}
                    className="flex items-center justify-center gap-1 md:gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-2 md:px-4 py-2 rounded-lg shadow-md transition-transform text-xs md:text-sm"
                  >
                    <RobotIcon className="w-3 h-3 md:w-4 md:h-4" />
                    <span>Execute</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm('Discard this vision? This cannot be undone.')) {
                        setResultImage(null);
                        setCurrentPrompt('');
                        showToast('Vision discarded', 'info');
                      }
                    }}
                    className="flex items-center justify-center gap-1 md:gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-2 md:px-4 py-2 rounded-lg transition-colors font-medium text-xs md:text-sm"
                    title="Discard this vision"
                  >
                    <TrashIcon className="w-3 h-3 md:w-4 md:h-4" />
                    <span className="hidden md:inline">Delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reference Library Sidebar - Mobile: Fixed overlay, Desktop: Sidebar */}
      {/* Mobile Library Toggle Button */}
      <button
        onClick={() => setShowLibrary(!showLibrary)}
        className="lg:hidden fixed bottom-20 right-4 z-40 bg-navy-900 text-white p-3 rounded-full shadow-lg hover:bg-navy-800 transition-colors"
        title="Reference Library"
      >
        <LibraryIcon className="w-5 h-5" />
        {selectedRefIds.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-gold-500 text-navy-900 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {selectedRefIds.length}
          </span>
        )}
      </button>

      {/* Mobile Library Overlay */}
      {showLibrary && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setShowLibrary(false)}>
          <div
            className="absolute right-0 top-0 h-full w-72 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-navy-900 text-sm flex items-center gap-2">
                <LibraryIcon className="w-4 h-4" /> Reference Library
              </h3>
              <button onClick={() => setShowLibrary(false)} className="text-gray-400 hover:text-navy-900 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4 overflow-y-auto h-[calc(100%-60px)]">
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
                <div className="mb-2">
                  <textarea
                    placeholder="Identity (e.g. 'tall Black male, 50s')"
                    className="w-full bg-white border border-gray-200 rounded-lg p-2 text-[10px] outline-none resize-none h-12 focus:border-gold-400"
                    value={newRefIdentityDesc}
                    onChange={(e) => setNewRefIdentityDesc(e.target.value)}
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
                  <p className="text-xs text-center text-gray-400 py-4">No references yet.<br />Upload headshots here.</p>
                )}
                {references.map(ref => {
                  const isSelected = selectedRefIds.includes(ref.id);
                  const hasIdentity = !!ref.identityDescription;
                  return (
                    <div
                      key={ref.id}
                      className={`relative group rounded-lg overflow-hidden border-2 transition-all ${isSelected ? 'border-gold-500 ring-1 ring-gold-200' : 'border-transparent hover:border-gray-300'}`}
                      title={hasIdentity ? ref.identityDescription : 'Click to select as reference'}
                    >
                      <img
                        src={ref.url}
                        className="w-full h-24 object-cover cursor-pointer"
                        alt="ref"
                        onClick={() => toggleReferenceSelection(ref.id)}
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1">
                        <div className="flex items-center gap-1">
                          {hasIdentity && (
                            <span className="text-[9px] bg-green-500 text-white px-1 rounded">ID</span>
                          )}
                          <p className="text-[10px] text-white truncate flex-1">{ref.tags.join(', ')}</p>
                        </div>
                      </div>
                      <div className="absolute top-1 right-1 flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            useReferenceAsBase(ref);
                            setShowLibrary(false);
                          }}
                          className="p-1 bg-gold-500 hover:bg-gold-600 rounded-full text-navy-900 shadow-sm"
                          title="Use as Base Image"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleDeleteReference(ref.id, e)}
                          className="p-1 bg-white/80 rounded-full text-red-500 hover:bg-white"
                          title="Delete"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </button>
                      </div>
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
          </div>
        </div>
      )}

      {/* Desktop Reference Library Sidebar */}
      <div className={`hidden lg:flex transition-all duration-300 flex-col gap-4 ${showLibrary ? 'w-64' : 'w-12 items-center'}`}>
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
                      className={`relative group rounded-lg overflow-hidden border-2 transition-all ${isSelected ? 'border-gold-500 ring-1 ring-gold-200' : 'border-transparent hover:border-gray-300'}`}
                      title={hasIdentity ? ref.identityDescription : 'Click to select as reference'}
                    >
                      <img
                        src={ref.url}
                        className="w-full h-24 object-cover cursor-pointer"
                        alt="ref"
                        onClick={() => toggleReferenceSelection(ref.id)}
                      />
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

                      {/* Action Buttons - Visible on hover */}
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        {/* Use as Base Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            useReferenceAsBase(ref);
                          }}
                          className="p-1 bg-gold-500 hover:bg-gold-600 rounded-full text-navy-900 shadow-sm"
                          title="Use as Base Image"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>
                        {/* Delete Button */}
                        <button
                          onClick={(e) => handleDeleteReference(ref.id, e)}
                          className="p-1 bg-white/80 rounded-full text-red-500 hover:bg-white"
                          title="Delete"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </button>
                      </div>

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
