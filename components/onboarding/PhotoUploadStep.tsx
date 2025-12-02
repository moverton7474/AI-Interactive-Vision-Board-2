import React, { useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

interface Props {
  photoRefId?: string;
  onPhotoUploaded: (refId: string, url: string) => void;
  onSkip: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 1200; // Max width or height
const JPEG_QUALITY = 0.85;

const PhotoUploadStep: React.FC<Props> = ({ photoRefId, onPhotoUploaded, onSkip }) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Compress and resize image
  const processImage = useCallback((file: File | Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          JPEG_QUALITY
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Upload processed image
  const uploadImage = useCallback(async (imageBlob: Blob) => {
    setError(null);
    setUploading(true);

    try {
      // Create preview
      const previewReader = new FileReader();
      previewReader.onloadend = () => {
        setPreviewUrl(previewReader.result as string);
      };
      previewReader.readAsDataURL(imageBlob);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload to Supabase Storage - using 'visions' bucket
      const fileName = `references/${user.id}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('visions')
        .upload(fileName, imageBlob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw new Error(uploadError.message || 'Failed to upload image');
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('visions')
        .getPublicUrl(fileName);

      // Save reference to database
      const { data: refData, error: refError } = await supabase
        .from('reference_images')
        .insert({
          user_id: user.id,
          image_url: urlData.publicUrl,
          tags: ['onboarding', 'self-reference']
        })
        .select()
        .single();

      if (refError) {
        console.error('Reference save error:', refError);
        // Still continue - image is uploaded even if DB save fails
      }

      onPhotoUploaded(refData?.id || fileName, urlData.publicUrl);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload image. Please try again.');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  }, [onPhotoUploaded]);

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, etc.)');
      return;
    }

    try {
      // Process (resize/compress) the image
      const processedBlob = await processImage(file);
      await uploadImage(processedBlob);
    } catch (err: any) {
      setError(err.message || 'Failed to process image');
    }
  };

  // Start camera
  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      setCameraStream(stream);
      setShowCamera(true);

      // Wait for ref to be available
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError('Could not access camera. Please try uploading a file instead.');
      }
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  // Switch camera (front/back)
  const switchCamera = async () => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    // Restart with new facing mode
    setTimeout(() => startCamera(), 100);
  };

  // Capture photo from camera
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror the image if using front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0);

    // Stop camera
    stopCamera();

    // Convert canvas to blob and upload
    canvas.toBlob(async (blob) => {
      if (blob) {
        try {
          const processedBlob = await processImage(blob);
          await uploadImage(processedBlob);
        } catch (err: any) {
          setError(err.message || 'Failed to process captured photo');
        }
      }
    }, 'image/jpeg', JPEG_QUALITY);
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-gray-600">
          Upload a photo of yourself to help create more personalized vision images.
        </p>
        <p className="text-sm text-gray-400 mt-1">
          This is optional - you can skip this step if you prefer.
        </p>
      </div>

      {/* Camera View */}
      {showCamera ? (
        <div className="relative bg-black rounded-2xl overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full aspect-[4/3] object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Camera Controls */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4">
            {/* Cancel */}
            <button
              onClick={stopCamera}
              className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Capture */}
            <button
              onClick={capturePhoto}
              className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <div className="w-14 h-14 bg-white border-4 border-navy-900 rounded-full" />
            </button>

            {/* Switch Camera */}
            <button
              onClick={switchCamera}
              className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Upload/Preview Area */}
          <div
            onClick={() => !uploading && !previewUrl && fileInputRef.current?.click()}
            className={`relative bg-white rounded-2xl border-2 border-dashed transition-all overflow-hidden ${
              previewUrl
                ? 'border-green-300 bg-green-50'
                : 'border-gray-300 hover:border-navy-400 hover:bg-gray-50 cursor-pointer'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {previewUrl ? (
              <div className="relative aspect-square max-h-80 mx-auto">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewUrl(null);
                  }}
                  className="absolute top-4 left-4 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="absolute top-4 right-4 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center">
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin mb-4" />
                    <p className="text-gray-500">Processing & uploading...</p>
                    <p className="text-xs text-gray-400 mt-1">Optimizing image size...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-gray-700 font-medium mb-1">Upload a photo of yourself</p>
                    <p className="text-sm text-gray-400">Click or drag and drop</p>
                    <p className="text-xs text-gray-300 mt-2">PNG, JPG, HEIC - any size (auto-optimized)</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {!previewUrl && !uploading && (
            <div className="flex gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 px-4 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:border-navy-400 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Choose File
              </button>
              <button
                onClick={startCamera}
                className="flex-1 py-3 px-4 bg-navy-900 rounded-xl font-medium text-white hover:bg-navy-800 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Take Photo
              </button>
            </div>
          )}
        </>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 border border-red-200 flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <p className="text-sm font-medium text-blue-800 mb-2">Tips for best results:</p>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Clear, well-lit photo of your face</li>
          <li>• Front-facing or slight angle</li>
          <li>• Natural expression works best</li>
        </ul>
      </div>

      {/* Skip Button */}
      {!showCamera && (
        <div className="text-center pt-4">
          <button
            onClick={onSkip}
            className="text-gray-500 hover:text-gray-700 text-sm underline"
          >
            Skip this step for now
          </button>
        </div>
      )}
    </div>
  );
};

export default PhotoUploadStep;
