
import React from 'react';

type ProductType = 'poster' | 'canvas';
type FinishType = 'matte' | 'gloss';

interface PrintPreviewProps {
  imageUrl: string;
  productType: ProductType;
  finish?: FinishType;
  size?: string;
  className?: string;
}

/**
 * PrintPreview Component
 *
 * Displays a product-specific mockup preview (poster or canvas)
 * using the actual vision board image.
 */
const PrintPreview: React.FC<PrintPreviewProps> = ({
  imageUrl,
  productType,
  finish = 'matte',
  size = '18x24',
  className = ''
}) => {
  // Poster: thin border, reflection for gloss
  // Canvas: thicker border with shadow to simulate depth
  const isPoster = productType === 'poster';
  const isGloss = finish === 'gloss';

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Room background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-100 to-gray-200 rounded-lg overflow-hidden">
        {/* Wall texture overlay */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000' fill-opacity='0.05' fill-rule='evenodd'%3E%3Cpath d='M5 0h1L0 6V5zM6 5v1H5z'/%3E%3C/g%3E%3C/svg%3E")`
          }}
        />
      </div>

      {/* Product frame */}
      <div
        className={`relative transform transition-all duration-500 ${
          isPoster
            ? 'rotate-0 hover:-rotate-1'
            : 'rotate-0 hover:rotate-1'
        }`}
        style={{ maxWidth: '85%', maxHeight: '85%' }}
      >
        {/* Shadow layer for depth effect */}
        {!isPoster && (
          <div
            className="absolute inset-0 bg-black/30 rounded-sm transform translate-x-3 translate-y-3 blur-md"
            style={{ zIndex: -1 }}
          />
        )}

        {/* Frame container */}
        <div
          className={`relative overflow-hidden ${
            isPoster
              ? 'bg-white border-4 border-black rounded-sm shadow-lg'
              : 'bg-white border-8 border-gray-800 rounded shadow-2xl'
          }`}
          style={{
            // Canvas has thicker, gallery-wrap style frame
            borderWidth: isPoster ? '4px' : '12px',
            borderColor: isPoster ? '#1a1a1a' : '#2d2d2d'
          }}
        >
          {/* Inner mat for poster */}
          {isPoster && (
            <div className="bg-white p-1">
              <img
                src={imageUrl}
                alt="Vision Board Preview"
                className="w-full h-auto block max-w-full"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
              />
            </div>
          )}

          {/* Direct image for canvas */}
          {!isPoster && (
            <img
              src={imageUrl}
              alt="Vision Board Preview"
              className="w-full h-auto block"
              style={{ maxHeight: '400px', objectFit: 'contain' }}
            />
          )}

          {/* Gloss reflection overlay for poster */}
          {isPoster && isGloss && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 40%, transparent 60%, transparent 100%)'
              }}
            />
          )}

          {/* Canvas texture overlay */}
          {!isPoster && (
            <div
              className="absolute inset-0 pointer-events-none opacity-10"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='8' viewBox='0 0 8 8' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000' fill-opacity='0.3'%3E%3Cpath fill-rule='evenodd' d='M0 0h4v4H0V0zm4 4h4v4H4V4z'/%3E%3C/g%3E%3C/svg%3E")`
              }}
            />
          )}
        </div>

        {/* Canvas edge shadow effect */}
        {!isPoster && (
          <>
            <div
              className="absolute -right-1 top-2 bottom-2 w-4 bg-gradient-to-r from-gray-600 to-gray-800 rounded-r-sm"
              style={{ transform: 'skewY(45deg)', transformOrigin: 'top left', opacity: 0.7 }}
            />
            <div
              className="absolute left-2 right-2 -bottom-1 h-4 bg-gradient-to-b from-gray-600 to-gray-800 rounded-b-sm"
              style={{ transform: 'skewX(-45deg)', transformOrigin: 'top left', opacity: 0.7 }}
            />
          </>
        )}
      </div>

      {/* Product label */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md">
        <span className="text-xs font-medium text-gray-700">
          {size}" {isPoster ? (isGloss ? 'Gloss Poster' : 'Matte Poster') : 'Canvas Print'}
        </span>
      </div>
    </div>
  );
};

export default PrintPreview;
