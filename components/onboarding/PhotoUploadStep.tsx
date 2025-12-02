import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';

interface Props {
  photoRefId?: string;
  onPhotoUploaded: (refId: string, url: string) => void;
  onSkip: () => void;
}

const PhotoUploadStep: React.FC<Props> = ({ photoRefId, onPhotoUploaded, onSkip }) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload to Supabase Storage
      const fileName = `${user.id}/onboarding-reference-${Date.now()}.${file.name.split('.').pop()}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('reference-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('reference-images')
        .getPublicUrl(fileName);

      // Save reference to database
      const { data: refData, error: refError } = await supabase
        .from('reference_images')
        .insert({
          user_id: user.id,
          url: publicUrl,
          tags: ['onboarding', 'self-reference'],
          created_at: Date.now()
        })
        .select()
        .single();

      if (refError) throw refError;

      onPhotoUploaded(refData.id, publicUrl);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload image');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

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

      {/* Upload Area */}
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative bg-white rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${
          previewUrl
            ? 'border-green-300 bg-green-50'
            : 'border-gray-300 hover:border-navy-400 hover:bg-gray-50'
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
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-white font-medium">Click to change</span>
            </div>
            <div className="absolute top-4 right-4 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center">
            {uploading ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin mb-4" />
                <p className="text-gray-500">Uploading...</p>
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
                <p className="text-xs text-gray-300 mt-2">PNG, JPG up to 5MB</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 border border-red-200">
          {error}
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
      <div className="text-center pt-4">
        <button
          onClick={onSkip}
          className="text-gray-500 hover:text-gray-700 text-sm underline"
        >
          Skip this step for now
        </button>
      </div>
    </div>
  );
};

export default PhotoUploadStep;
