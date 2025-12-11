/**
 * VisionBoardSelector - Modal for selecting a vision board to print
 *
 * Part of Print Shop v1.5 - Makes vision board prints the primary product
 */

import React, { useState, useEffect } from 'react';
import { VisionImage } from '../../types';
import { getVisionGallery } from '../../services/storageService';

interface Props {
  onSelect: (image: VisionImage) => void;
  onClose: () => void;
  onCreateNew: () => void;
}

const VisionBoardSelector: React.FC<Props> = ({ onSelect, onClose, onCreateNew }) => {
  const [visions, setVisions] = useState<VisionImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadVisions();
  }, []);

  const loadVisions = async () => {
    try {
      setLoading(true);
      const gallery = await getVisionGallery();
      // Filter out placeholder SVGs
      const realVisions = gallery.filter(v => !v.url.startsWith('data:image/svg'));
      setVisions(realVisions);
    } catch (error) {
      console.error('Error loading visions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    const selected = visions.find(v => v.id === selectedId);
    if (selected) {
      onSelect(selected);
    }
  };

  // No visions - show create prompt
  if (!loading && visions.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🎨</span>
          </div>
          <h2 className="text-2xl font-serif font-bold text-navy-900 mb-3">
            Create Your First Vision Board
          </h2>
          <p className="text-gray-500 mb-6">
            You don't have any vision boards yet. Create one first, then come back to print it!
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={onCreateNew}
              className="w-full bg-navy-900 text-white py-3 rounded-xl font-semibold hover:bg-navy-800 transition-colors"
            >
              Create Vision Board
            </button>
            <button
              onClick={onClose}
              className="w-full text-gray-500 hover:text-navy-900 py-2 font-medium transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-serif font-bold text-navy-900">
                Select a Vision Board
              </h2>
              <p className="text-gray-500 mt-1">
                Choose the vision board you'd like to print
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {visions.map((vision) => (
                <button
                  key={vision.id}
                  onClick={() => setSelectedId(vision.id)}
                  className={`group relative aspect-[4/3] rounded-xl overflow-hidden border-3 transition-all ${
                    selectedId === vision.id
                      ? 'border-navy-900 ring-4 ring-navy-200 scale-[1.02]'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <img
                    src={vision.url}
                    alt={vision.prompt}
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay */}
                  <div className={`absolute inset-0 transition-opacity ${
                    selectedId === vision.id
                      ? 'bg-navy-900/20'
                      : 'bg-black/0 group-hover:bg-black/10'
                  }`} />
                  {/* Selection indicator */}
                  {selectedId === vision.id && (
                    <div className="absolute top-3 right-3 w-8 h-8 bg-navy-900 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  {/* Favorite indicator */}
                  {vision.isFavorite && (
                    <div className="absolute top-3 left-3 text-gold-500">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </div>
                  )}
                  {/* Prompt preview on hover */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs line-clamp-2">{vision.prompt}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {visions.length} vision board{visions.length !== 1 ? 's' : ''} available
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-gray-600 hover:text-navy-900 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedId}
                className={`px-8 py-2.5 rounded-xl font-semibold transition-all ${
                  selectedId
                    ? 'bg-navy-900 text-white hover:bg-navy-800'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Continue to Print Options
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisionBoardSelector;
