
import React, { useState } from 'react';
import { CreditCardIcon, LockIcon, CheckBadgeIcon } from './Icons';

interface Props {
  tier: 'PRO' | 'ELITE';
  onClose: () => void;
}

const SubscriptionModal: React.FC<Props> = ({ tier, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const price = tier === 'PRO' ? 19.99 : 49.99;
  const planName = tier === 'PRO' ? 'Visionary Pro' : 'Visionary Elite';

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate Stripe API call
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 2000);
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckBadgeIcon className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-2xl font-serif font-bold text-navy-900 mb-2">Welcome to {planName}!</h3>
          <p className="text-gray-600 mb-6">
            Your subscription is active. All premium features have been unlocked.
          </p>
          <button 
            onClick={onClose}
            className="w-full bg-navy-900 text-white font-bold py-3 rounded-lg hover:bg-navy-800 transition-colors"
          >
            Start Creating
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-navy-900 p-6 text-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Secure Checkout</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-gray-400 text-sm">You are upgrading to</p>
              <p className="text-2xl font-serif font-bold text-gold-500">{planName}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold">${price}</span>
              <span className="text-gray-400 text-sm">/mo</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-6">
          <form onSubmit={handleSubscribe} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Card Information</label>
              <div className="relative">
                <CreditCardIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="0000 0000 0000 0000" 
                  className="w-full border border-gray-300 rounded-lg py-2.5 pl-10 pr-4 outline-none focus:border-navy-900 transition-colors"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Expiry</label>
                <input 
                  type="text" 
                  placeholder="MM/YY" 
                  className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-navy-900 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CVC</label>
                <input 
                  type="text" 
                  placeholder="123" 
                  className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-navy-900 transition-colors"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gold-500 hover:bg-gold-600 text-navy-900 font-bold py-3.5 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-navy-900/30 border-t-navy-900 rounded-full animate-spin" />
              ) : (
                <>
                  <LockIcon className="w-4 h-4" />
                  Subscribe & Pay ${price}
                </>
              )}
            </button>
            
            <p className="text-center text-[10px] text-gray-400 mt-4 flex items-center justify-center gap-1">
              <LockIcon className="w-3 h-3" />
              Payments secured by Stripe. Cancel anytime.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;
