import React from 'react';

interface VisionData {
  id: string;
  imageUrl?: string;
  title?: string;
}

interface PrintOrder {
  id: string;
  productType: string;
  status: 'pending' | 'submitted' | 'shipped' | 'delivered';
  createdAt: string;
  trackingUrl?: string;
}

interface Props {
  vision?: VisionData | null;
  recentOrders: PrintOrder[];
  isLoading?: boolean;
  onPrintPoster: () => void;
  onPrintCanvas: () => void;
  onPrintWorkbook: () => void;
  onViewOrders: () => void;
}

const PrintPanel: React.FC<Props> = ({
  vision,
  recentOrders,
  isLoading,
  onPrintPoster,
  onPrintCanvas,
  onPrintWorkbook,
  onViewOrders
}) => {
  const getStatusBadge = (status: PrintOrder['status']) => {
    switch (status) {
      case 'pending':
        return { label: 'Processing', color: 'bg-yellow-100 text-yellow-700' };
      case 'submitted':
        return { label: 'Submitted', color: 'bg-blue-100 text-blue-700' };
      case 'shipped':
        return { label: 'Shipped', color: 'bg-purple-100 text-purple-700' };
      case 'delivered':
        return { label: 'Delivered', color: 'bg-green-100 text-green-700' };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-600' };
    }
  };

  const formatProductType = (type: string): string => {
    const types: Record<string, string> = {
      poster: 'Vision Poster',
      canvas: 'Canvas Print',
      workbook: 'Vision Workbook',
      pad: 'Focus Pad',
      cards: 'Vision Cards'
    };
    return types[type.toLowerCase()] || type;
  };

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-2xl">🖨️</span>
          </div>
          <div>
            <h3 className="font-bold text-amber-900">Print Center</h3>
            <p className="text-sm text-amber-700">
              Turn your vision into a physical reminder
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left - Vision Preview & CTAs */}
          <div className="flex-1">
            {vision?.imageUrl && (
              <div className="mb-4 rounded-xl overflow-hidden shadow-md border-2 border-white">
                <img
                  src={vision.imageUrl}
                  alt={vision.title || 'Your Vision'}
                  className="w-full h-32 object-cover"
                />
              </div>
            )}

            {/* Print Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onPrintPoster}
                disabled={!vision?.imageUrl}
                className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                  vision?.imageUrl
                    ? 'bg-white text-amber-900 hover:bg-amber-100 shadow-sm hover:shadow-md'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <span className="block text-lg mb-1">🖼️</span>
                Print Poster
              </button>

              <button
                onClick={onPrintCanvas}
                disabled={!vision?.imageUrl}
                className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                  vision?.imageUrl
                    ? 'bg-white text-amber-900 hover:bg-amber-100 shadow-sm hover:shadow-md'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <span className="block text-lg mb-1">🎨</span>
                Print Canvas
              </button>

              <button
                onClick={onPrintWorkbook}
                className="flex-1 min-w-[120px] px-4 py-3 bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-xl font-semibold text-sm hover:shadow-md transition-all"
              >
                <span className="block text-lg mb-1">📓</span>
                Print Workbook
              </button>
            </div>

            {!vision?.imageUrl && (
              <p className="text-xs text-amber-700 mt-3 text-center">
                Create a vision board first to unlock printing
              </p>
            )}
          </div>

          {/* Right - Recent Orders */}
          <div className="lg:w-72 flex-shrink-0">
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-amber-900 text-sm">Recent Orders</h4>
                {recentOrders.length > 0 && (
                  <button
                    onClick={onViewOrders}
                    className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                  >
                    View All
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-200 rounded-lg" />
                      <div className="flex-1">
                        <div className="h-3 bg-amber-200 rounded w-3/4 mb-2" />
                        <div className="h-2 bg-amber-100 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentOrders.length > 0 ? (
                <div className="space-y-3">
                  {recentOrders.slice(0, 3).map((order) => {
                    const status = getStatusBadge(order.status);
                    return (
                      <div
                        key={order.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/50 transition-colors"
                      >
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-lg">
                          {order.productType === 'workbook' ? '📓' :
                           order.productType === 'canvas' ? '🎨' : '🖼️'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-amber-900 text-sm truncate">
                            {formatProductType(order.productType)}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${status.color}`}>
                              {status.label}
                            </span>
                            {order.trackingUrl && order.status === 'shipped' && (
                              <a
                                href={order.trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-amber-600 hover:text-amber-800 underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Track
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-amber-700 text-sm">No orders yet</p>
                  <p className="text-amber-600 text-xs mt-1">
                    Print your vision to keep it visible
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintPanel;
