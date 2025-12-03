import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import WorkbookWizard from './workbook/WorkbookWizard';

interface Props {
  onBack?: () => void;
}

interface Product {
  id: string;
  name: string;
  description: string;
  product_type: string;
  prodigi_sku: string;
  size: string;
  pages?: number;
  quantity?: number;
  base_price: number;
  shipping_estimate: number;
  preview_image: string;
  personalization_fields: string[];
  features: string[];
  elite_exclusive: boolean;
  bundle_items?: string[];
}

interface Category {
  id: string;
  name: string;
  count: number;
}

interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * PrintProducts - Product catalog and ordering UI
 *
 * Displays Focus Pads, Habit Cue Cards, and other personalized
 * print products. Integrates with user's vision boards, habits,
 * and AMIE profile for customization.
 */
const PrintProducts: React.FC<Props> = ({ onBack }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Customization state
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showWorkbookWizard, setShowWorkbookWizard] = useState(false);
  const [customization, setCustomization] = useState<any>({});
  const [contentData, setContentData] = useState<any>(null);
  const [customizing, setCustomizing] = useState(false);

  // Order state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    name: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US'
  });
  const [ordering, setOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);

  // User subscription
  const [isElite, setIsElite] = useState(false);

  useEffect(() => {
    fetchCatalog();
    checkSubscription();
  }, []);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const response = await supabase.functions.invoke('print-products', {
        body: {},
      });

      if (response.data?.products) {
        setProducts(response.data.products);
        setCategories(response.data.categories || []);
      }
    } catch (err: any) {
      console.error('Error fetching catalog:', err);
      setError('Failed to load product catalog');
    } finally {
      setLoading(false);
    }
  };

  const checkSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', session.user.id)
        .single();

      setIsElite(profile?.subscription_tier === 'ELITE');
    } catch (err) {
      console.error('Error checking subscription:', err);
    }
  };

  const handleCustomize = async (product: Product) => {
    // Intercept Workbook products to use the new Wizard
    if (product.product_type === 'workbook' || product.name.toLowerCase().includes('workbook')) {
      setShowWorkbookWizard(true);
      return;
    }

    setSelectedProduct(product);
    setCustomizing(true);
    setShowCustomizeModal(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to customize products');
      }

      const response = await supabase.functions.invoke('print-products', {
        body: { productId: product.id, customization: {} },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.data?.contentData) {
        setContentData(response.data.contentData);
      }
    } catch (err: any) {
      console.error('Error loading customization:', err);
      setError(err.message || 'Failed to load customization options');
    } finally {
      setCustomizing(false);
    }
  };

  const handleOrder = async () => {
    if (!selectedProduct) return;

    // Validate address
    if (!shippingAddress.name || !shippingAddress.line1 || !shippingAddress.city ||
      !shippingAddress.state || !shippingAddress.postalCode) {
      setError('Please fill in all required shipping fields');
      return;
    }

    setOrdering(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to place an order');
      }

      const response = await supabase.functions.invoke('print-products', {
        body: {
          productId: selectedProduct.id,
          customization,
          shippingAddress
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Order failed');
      }

      setOrderSuccess(response.data.order);
      setShowOrderModal(false);
      setShowCustomizeModal(false);
    } catch (err: any) {
      console.error('Error placing order:', err);
      setError(err.message || 'Failed to place order');
    } finally {
      setOrdering(false);
    }
  };

  const filteredProducts = selectedCategory
    ? products.filter(p => p.product_type === selectedCategory)
    : products;

  const getProductIcon = (type: string) => {
    switch (type) {
      case 'pad': return '📝';
      case 'cards': return '🃏';
      case 'sticker': return '⭐';
      case 'canvas': return '🖼️';
      case 'bundle': return '🎁';
      case 'workbook': return '📘';
      default: return '📦';
    }
  };

  // Order Success Screen
  if (orderSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-serif font-bold text-navy-900 mb-2">Order Confirmed!</h2>
          <p className="text-gray-500 mb-6">Your {orderSuccess.productName} is on its way.</p>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Order ID</span>
              <span className="font-mono text-navy-900">{orderSuccess.id?.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Total</span>
              <span className="font-bold text-navy-900">${orderSuccess.total?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Estimated Delivery</span>
              <span className="text-navy-900">{orderSuccess.estimatedDelivery}</span>
            </div>
          </div>

          <button
            onClick={() => {
              setOrderSuccess(null);
              setSelectedProduct(null);
            }}
            className="bg-navy-900 text-white px-8 py-3 rounded-lg font-medium hover:bg-navy-800 transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-navy-900">Print Shop</h1>
          <p className="text-gray-500 mt-1">Personalized products to support your journey</p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-navy-900 font-medium transition-colors"
          >
            ← Back
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            ✕
          </button>
        </div>
      )}

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-full font-medium text-sm transition-colors ${!selectedCategory
              ? 'bg-navy-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          All Products
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-full font-medium text-sm transition-colors ${selectedCategory === cat.id
                ? 'bg-navy-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            {cat.name} ({cat.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin" />
        </div>
      ) : (
        /* Product Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-lg transition-shadow ${product.elite_exclusive && !isElite ? 'opacity-75' : ''
                }`}
            >
              {/* Product Image */}
              <div className="h-48 bg-gradient-to-br from-navy-50 to-gold-50 flex items-center justify-center relative">
                <span className="text-6xl">{getProductIcon(product.product_type)}</span>
                {product.elite_exclusive && (
                  <span className="absolute top-3 right-3 bg-gold-500 text-navy-900 text-xs font-bold px-2 py-1 rounded">
                    ELITE
                  </span>
                )}
                {product.product_type === 'bundle' && (
                  <span className="absolute top-3 left-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                    SAVE 20%
                  </span>
                )}
              </div>

              {/* Product Info */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-navy-900">{product.name}</h3>
                  <span className="text-lg font-bold text-navy-900">
                    ${product.base_price.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                  {product.description}
                </p>

                {/* Features */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {product.features.slice(0, 3).map((feature, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {feature}
                    </span>
                  ))}
                </div>

                {/* Size/Details */}
                <div className="text-xs text-gray-400 mb-4">
                  {product.size}
                  {product.pages && ` • ${product.pages} sheets`}
                  {product.quantity && ` • ${product.quantity} pieces`}
                </div>

                {/* Action Button */}
                {product.elite_exclusive && !isElite ? (
                  <button
                    disabled
                    className="w-full bg-gray-100 text-gray-400 py-2.5 rounded-lg font-medium cursor-not-allowed"
                  >
                    Elite Members Only
                  </button>
                ) : (
                  <button
                    onClick={() => handleCustomize(product)}
                    className="w-full bg-navy-900 text-white py-2.5 rounded-lg font-medium hover:bg-navy-800 transition-colors"
                  >
                    Customize & Order
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NEW: Workbook Wizard */}
      {showWorkbookWizard && (
        <WorkbookWizard onClose={() => setShowWorkbookWizard(false)} />
      )}

      {/* Customization Modal */}
      {showCustomizeModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-navy-900">Customize Your {selectedProduct.name}</h2>
                <button
                  onClick={() => {
                    setShowCustomizeModal(false);
                    setSelectedProduct(null);
                    setContentData(null);
                    setCustomization({});
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              {customizing ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Product Summary */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-navy-100 rounded-lg flex items-center justify-center">
                        <span className="text-3xl">{getProductIcon(selectedProduct.product_type)}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-navy-900">{selectedProduct.name}</h3>
                        <p className="text-sm text-gray-500">{selectedProduct.size}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-navy-900">${selectedProduct.base_price.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">+ ${selectedProduct.shipping_estimate?.toFixed(2)} shipping</p>
                      </div>
                    </div>
                  </div>

                  {/* Customization Options */}
                  {contentData?.visions && contentData.visions.length > 0 && (
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-navy-900 mb-3">
                        Select Vision Image
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {contentData.visions.map((vision: any) => (
                          <button
                            key={vision.id}
                            onClick={() => setCustomization({ ...customization, visionImageId: vision.id })}
                            className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${customization.visionImageId === vision.id
                                ? 'border-navy-900 ring-2 ring-navy-200'
                                : 'border-gray-200 hover:border-gray-300'
                              }`}
                          >
                            <img
                              src={vision.image_url}
                              alt="Vision"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedProduct.personalization_fields.includes('headline') && (
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-navy-900 mb-2">
                        Custom Headline
                      </label>
                      <input
                        type="text"
                        value={customization.headline || ''}
                        onChange={(e) => setCustomization({ ...customization, headline: e.target.value })}
                        placeholder="My Vision for Tomorrow"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                      />
                    </div>
                  )}

                  {contentData?.habits && contentData.habits.length > 0 && (
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-navy-900 mb-2">
                        Your Habits ({contentData.habits.length} available)
                      </label>
                      <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                        {contentData.habits.map((habit: any, i: number) => (
                          <div key={habit.id} className="text-sm text-gray-700 py-1 flex items-center gap-2">
                            <span className="text-green-500">✓</span>
                            {habit.title}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        These habits will be included in your {selectedProduct.name}
                      </p>
                    </div>
                  )}

                  {contentData?.theme && (
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-navy-900 mb-2">
                        AMIE Theme
                      </label>
                      <div className="bg-gradient-to-r from-navy-50 to-gold-50 rounded-lg p-4">
                        <p className="font-medium text-navy-900">{contentData.theme.display_name || contentData.theme.name}</p>
                        <p className="text-sm text-gray-600">Your personalized coaching theme will be applied</p>
                      </div>
                    </div>
                  )}

                  {/* Price Summary */}
                  <div className="bg-navy-50 rounded-xl p-4 mb-6">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Product</span>
                      <span className="font-medium">${selectedProduct.base_price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Shipping</span>
                      <span className="font-medium">${selectedProduct.shipping_estimate?.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-navy-200 my-2 pt-2 flex justify-between">
                      <span className="font-bold text-navy-900">Total</span>
                      <span className="font-bold text-navy-900">
                        ${(selectedProduct.base_price + (selectedProduct.shipping_estimate || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowOrderModal(true)}
                    className="w-full bg-gold-500 text-navy-900 py-3 rounded-lg font-bold hover:bg-gold-600 transition-colors"
                  >
                    Continue to Shipping
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order/Shipping Modal */}
      {showOrderModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-navy-900">Shipping Address</h2>
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={shippingAddress.name}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                  <input
                    type="text"
                    value={shippingAddress.line1}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, line1: e.target.value })}
                    placeholder="Street address"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={shippingAddress.line2}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, line2: e.target.value })}
                    placeholder="Apt, suite, unit (optional)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input
                      type="text"
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                    <input
                      type="text"
                      value={shippingAddress.state}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code *</label>
                    <input
                      type="text"
                      value={shippingAddress.postalCode}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, postalCode: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <select
                      value={shippingAddress.country}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500"
                    >
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="GB">United Kingdom</option>
                      <option value="AU">Australia</option>
                    </select>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleOrder}
                  disabled={ordering}
                  className="flex-1 bg-gold-500 text-navy-900 py-3 rounded-lg font-bold hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {ordering ? 'Processing...' : `Place Order • $${(selectedProduct.base_price + (selectedProduct.shipping_estimate || 0)).toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-12 bg-navy-50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">🎨</span>
          </div>
          <div>
            <h4 className="font-semibold text-navy-900">Personalized to Your Journey</h4>
            <p className="text-sm text-navy-700 mt-1">
              Each product is customized with your vision board images, active habits,
              and AMIE coaching theme. Products ship within 5-7 business days and are
              printed on premium materials for lasting quality.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintProducts;
