/**
 * ProductMockup - Renders realistic product mockups with user's vision board
 *
 * Part of Print Shop v1.5 - Shows personalized product previews
 */

import React from 'react';
import { getProductMockup, getProductGradient, MockupContext } from '../../lib/print/mockups';

interface Props {
  productType: string;
  imageUrl?: string;
  goalStatement?: string;
  className?: string;
  showOverlay?: boolean;
}

const ProductMockup: React.FC<Props> = ({
  productType,
  imageUrl,
  goalStatement,
  className = '',
  showOverlay = true,
}) => {
  const ctx: MockupContext = { imageUrl, goalStatement };
  const mockup = getProductMockup(productType, ctx);
  const gradient = getProductGradient(productType);

  // If no image URL, show gradient with product type indicator
  if (!imageUrl) {
    return (
      <div
        className={`relative bg-gradient-to-br ${gradient} rounded-lg overflow-hidden ${className}`}
        style={{ aspectRatio: mockup.aspectRatio }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-white/50 rounded-full flex items-center justify-center mx-auto mb-2">
              <ProductIcon type={productType} />
            </div>
            <p className="text-sm text-gray-600 font-medium capitalize">{productType}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative bg-gradient-to-br ${gradient} rounded-lg overflow-hidden ${className}`}
      style={{ aspectRatio: mockup.aspectRatio }}
    >
      {/* Base mockup template (using gradient as placeholder since we don't have actual images) */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-black/10" />

      {/* Frame/border effect for poster/canvas */}
      {(productType === 'poster' || productType === 'canvas') && (
        <div className="absolute inset-4 md:inset-6 lg:inset-8 border-8 border-gray-800 shadow-2xl bg-white">
          {/* User's vision board image */}
          {showOverlay && imageUrl && (
            <img
              src={imageUrl}
              alt="Your vision board"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
        </div>
      )}

      {/* Workbook cover */}
      {productType === 'workbook' && (
        <div className="absolute inset-6 bg-slate-800 rounded shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900" />
          {/* Cover image area */}
          <div className="absolute top-4 left-4 right-4 h-2/3 rounded overflow-hidden">
            {showOverlay && imageUrl && (
              <img
                src={imageUrl}
                alt="Workbook cover"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>
          {/* Title area */}
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <div className="text-gold-500 text-xs font-bold tracking-wider">VISIONARY</div>
            <div className="text-white text-sm font-serif mt-1">My Vision Workbook</div>
          </div>
        </div>
      )}

      {/* Pad/notepad */}
      {productType === 'pad' && (
        <div className="absolute inset-6 bg-white rounded shadow-lg overflow-hidden">
          <div className="h-8 bg-navy-900" />
          <div className="p-3">
            {showOverlay && imageUrl && (
              <div className="w-full aspect-video rounded overflow-hidden mb-2">
                <img
                  src={imageUrl}
                  alt="Pad header"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {goalStatement && (
              <p className="text-xs text-navy-900 font-medium text-center mt-2">
                "{goalStatement}"
              </p>
            )}
            <div className="mt-3 space-y-1.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-2 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cards spread */}
      {productType === 'cards' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="relative w-full h-full">
            {/* Stacked cards effect */}
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute bg-white rounded-lg shadow-lg overflow-hidden"
                style={{
                  width: '60%',
                  aspectRatio: '2.5/3.5',
                  left: `${15 + i * 10}%`,
                  top: `${20 + i * 5}%`,
                  transform: `rotate(${-5 + i * 5}deg)`,
                  zIndex: i,
                }}
              >
                {showOverlay && imageUrl && i === 2 && (
                  <img
                    src={imageUrl}
                    alt="Card"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bundle box */}
      {productType === 'bundle' && (
        <div className="absolute inset-8 perspective-1000">
          <div className="relative w-full h-full transform rotate-y-[-10deg]">
            <div className="absolute inset-0 bg-gradient-to-br from-gold-400 to-gold-600 rounded-lg shadow-xl" />
            <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 rounded overflow-hidden shadow-inner">
              {showOverlay && imageUrl && (
                <img
                  src={imageUrl}
                  alt="Bundle"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <div className="text-white text-xs font-bold tracking-wider">STARTER BUNDLE</div>
            </div>
          </div>
        </div>
      )}

      {/* Stickers sheet */}
      {productType === 'sticker' && (
        <div className="absolute inset-6 bg-white rounded-lg shadow p-2">
          <div className="grid grid-cols-3 gap-1 h-full">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="bg-gradient-to-br from-gold-100 to-amber-100 rounded flex items-center justify-center">
                {i === 4 && showOverlay && imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Sticker"
                    className="w-3/4 h-3/4 object-cover rounded"
                  />
                ) : (
                  <span className="text-2xl">⭐</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Default fallback for other types */}
      {!['poster', 'canvas', 'workbook', 'pad', 'cards', 'bundle', 'sticker'].includes(productType) && (
        <div className="absolute inset-0 flex items-center justify-center">
          {showOverlay && imageUrl && (
            <div
              className="absolute rounded-lg overflow-hidden shadow-xl"
              style={mockup.overlayStyle}
            >
              <img
                src={imageUrl}
                alt="Product preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Simple product icon component
const ProductIcon: React.FC<{ type: string }> = ({ type }) => {
  const icons: Record<string, React.ReactNode> = {
    poster: (
      <svg className="w-8 h-8 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    canvas: (
      <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    workbook: (
      <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    pad: (
      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    cards: (
      <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    default: (
      <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  };

  return icons[type] || icons.default;
};

export default ProductMockup;
