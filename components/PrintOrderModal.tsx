
import React, { useState, useEffect } from 'react';
import { VisionImage, ShippingAddress } from '../types';
import { PrinterIcon, CheckBadgeIcon, TruckIcon, LockIcon, RobotIcon, ReceiptIcon } from './Icons';
import { checkFirstTimeDiscount, calculatePrice, createPosterOrder } from '../services/printService';

interface Props {
  image: VisionImage | null;
  onClose: () => void;
  onViewHistory?: () => void; // Added prop
}

type WizardStep = 'CONFIG' | 'SHIPPING' | 'PAYMENT' | 'SUCCESS';

const SIZES = [
  { id: '12x18', label: '12" x 18" Poster' },
  { id: '18x24', label: '18" x 24" Poster' },
  { id: '24x36', label: '24" x 36" Poster' },
];

const PrintOrderModal: React.FC<Props> = ({ image, onClose, onViewHistory }) => {
  const [step, setStep] = useState<WizardStep>('CONFIG');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEligibleForDiscount, setIsEligibleForDiscount] = useState(false);
  
  // Config State
  const [selectedSize, setSelectedSize] = useState('18x24');
  const [finish, setFinish] = useState<'matte' | 'gloss'>('matte');
  
  // Shipping State
  const [shipping, setShipping] = useState<ShippingAddress>({
    name: '',
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US'
  });

  useEffect(() => {
    checkDiscount();
  }, []);

  const checkDiscount = async () => {
    const eligible = await checkFirstTimeDiscount();
    setIsEligibleForDiscount(eligible);
  };

  if (!image) return null;

  // Pricing Calc
  const { subtotal, sku } = calculatePrice(selectedSize, finish);
  const discountAmount = isEligibleForDiscount ? subtotal * 0.30 : 0;
  const shippingCost = 0; // Free for now
  const total = subtotal - discountAmount + shippingCost;

  const handleSubmitOrder = async () => {
    setIsProcessing(true);
    try {
      await createPosterOrder(
        image.id,
        image.url,
        shipping,
        { sku, size: selectedSize, finish, quantity: 1 },
        total,
        isEligibleForDiscount
      );
      
      // Simulate payment delay
      setTimeout(() => {
        setStep('SUCCESS');
        setIsProcessing(false);
      }, 2000);
    } catch (e) {
      console.error(e);
      alert("Failed to place order. Please try again.");
      setIsProcessing(false);
    }
  };

  const renderConfigStep = () => (
    <div className="w-full p-8 flex flex-col">
       <div className="flex justify-between items-start mb-6">
         <div>
           <h2 className="text-2xl font-serif font-bold text-navy-900">Print Configuration</h2>
           <p className="text-gray-500 text-sm">Step 1 of 3: Customize</p>
         </div>
         <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
       </div>

       <div className="space-y-4 mb-8 flex-1">
         <div>
            <p className="text-sm font-bold text-navy-900 uppercase tracking-wide mb-2">Select Size</p>
            <div className="space-y-2">
                {SIZES.map((s) => {
                    const price = calculatePrice(s.id, finish).subtotal;
                    return (
                       <div 
                         key={s.id} 
                         onClick={() => setSelectedSize(s.id)}
                         className={`flex justify-between items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedSize === s.id ? 'border-navy-900 bg-navy-50' : 'border-gray-200 hover:border-gray-300'}`}
                       >
                         <span className="font-medium text-navy-900">{s.label}</span>
                         <span className="text-gray-600">${price.toFixed(2)}</span>
                       </div>
                    )
                })}
            </div>
         </div>

         <div>
            <p className="text-sm font-bold text-navy-900 uppercase tracking-wide mb-2">Paper Finish</p>
            <div className="flex gap-4">
                <button 
                  onClick={() => setFinish('matte')}
                  className={`flex-1 py-3 rounded-lg border-2 font-medium ${finish === 'matte' ? 'border-navy-900 bg-navy-900 text-white' : 'border-gray-200 text-gray-600'}`}
                >
                  Matte (Classic)
                </button>
                <button 
                  onClick={() => setFinish('gloss')}
                  className={`flex-1 py-3 rounded-lg border-2 font-medium ${finish === 'gloss' ? 'border-navy-900 bg-navy-900 text-white' : 'border-gray-200 text-gray-600'}`}
                >
                  Gloss (+$5.00)
                </button>
            </div>
         </div>
       </div>

       <button 
         onClick={() => setStep('SHIPPING')}
         className="w-full bg-navy-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-navy-800 transition-all"
       >
         Continue to Shipping
       </button>
    </div>
  );

  const renderShippingStep = () => (
    <div className="w-full p-8 flex flex-col">
       <div className="flex justify-between items-start mb-6">
         <div>
           <h2 className="text-2xl font-serif font-bold text-navy-900">Shipping Details</h2>
           <p className="text-gray-500 text-sm">Step 2 of 3: Where should we send it?</p>
         </div>
         <button onClick={() => setStep('CONFIG')} className="text-sm text-gray-500 hover:text-navy-900 underline">Back</button>
       </div>

       <form className="space-y-4 mb-8 flex-1 overflow-y-auto" onSubmit={(e) => { e.preventDefault(); setStep('PAYMENT'); }}>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
            <input required type="text" className="w-full border rounded-lg p-3" value={shipping.name} onChange={e => setShipping({...shipping, name: e.target.value})} placeholder="John Doe" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Address Line 1</label>
            <input required type="text" className="w-full border rounded-lg p-3" value={shipping.line1} onChange={e => setShipping({...shipping, line1: e.target.value})} placeholder="123 Dream St" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Address Line 2 (Optional)</label>
            <input type="text" className="w-full border rounded-lg p-3" value={shipping.line2} onChange={e => setShipping({...shipping, line2: e.target.value})} placeholder="Apt 4B" />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">City</label>
                <input required type="text" className="w-full border rounded-lg p-3" value={shipping.city} onChange={e => setShipping({...shipping, city: e.target.value})} />
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">State/Prov</label>
                <input required type="text" className="w-full border rounded-lg p-3" value={shipping.state} onChange={e => setShipping({...shipping, state: e.target.value})} />
             </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Zip/Postal</label>
                <input required type="text" className="w-full border rounded-lg p-3" value={shipping.postalCode} onChange={e => setShipping({...shipping, postalCode: e.target.value})} />
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Country</label>
                <select className="w-full border rounded-lg p-3" value={shipping.country} onChange={e => setShipping({...shipping, country: e.target.value})}>
                   <option value="US">United States</option>
                   <option value="GB">United Kingdom</option>
                   <option value="CA">Canada</option>
                   <option value="AU">Australia</option>
                </select>
             </div>
          </div>
          
          <button 
             type="submit"
             className="w-full bg-navy-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-navy-800 transition-all mt-4"
           >
             Continue to Payment
           </button>
       </form>
    </div>
  );

  const renderPaymentStep = () => (
    <div className="w-full p-8 flex flex-col">
       <div className="flex justify-between items-start mb-6">
         <div>
           <h2 className="text-2xl font-serif font-bold text-navy-900">Review & Pay</h2>
           <p className="text-gray-500 text-sm">Step 3 of 3: Confirm Order</p>
         </div>
         <button onClick={() => setStep('SHIPPING')} className="text-sm text-gray-500 hover:text-navy-900 underline">Back</button>
       </div>

       <div className="space-y-6 mb-8 flex-1">
          {/* Order Summary Card */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
             <h4 className="font-bold text-navy-900 mb-2 text-sm uppercase">Ship To</h4>
             <p className="text-sm text-gray-600">{shipping.name}</p>
             <p className="text-sm text-gray-600">{shipping.line1} {shipping.line2}</p>
             <p className="text-sm text-gray-600">{shipping.city}, {shipping.state} {shipping.postalCode}</p>
             <p className="text-sm text-gray-600">{shipping.country}</p>
          </div>

          {/* Pricing Breakdown */}
          <div className="bg-gold-50 border border-gold-200 rounded-lg p-4">
              <div className="flex justify-between text-sm mb-2 text-gray-600">
                <span>{SIZES.find(s => s.id === selectedSize)?.label} ({finish})</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {isEligibleForDiscount && (
                <div className="flex justify-between text-sm mb-2 text-green-700 font-medium animate-pulse">
                    <span>First Vision Discount (30%)</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm mb-3 text-gray-600">
                <span>Shipping (Standard)</span>
                <span>Free</span>
              </div>
              <div className="border-t border-gold-200 pt-3 flex justify-between items-end">
                <span className="font-bold text-navy-900">Total</span>
                <span className="text-3xl font-serif font-bold text-navy-900">${total.toFixed(2)}</span>
              </div>
           </div>
       </div>

       <button 
         onClick={handleSubmitOrder}
         disabled={isProcessing}
         className="w-full bg-gradient-to-r from-navy-900 to-navy-800 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-3"
       >
         {isProcessing ? (
           <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
         ) : (
           <>
             <LockIcon className="w-5 h-5" />
             Pay & Place Order
           </>
         )}
       </button>
       <div className="mt-4 text-center">
         <p className="text-[10px] text-gray-400">Secure 256-bit SSL Encrypted Payment</p>
       </div>
    </div>
  );

  if (step === 'SUCCESS') {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckBadgeIcon className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-2xl font-serif font-bold text-navy-900 mb-2">Order Confirmed!</h3>
          <p className="text-gray-500 mb-6">
            Your high-resolution vision board is being prepared. You will receive an email with tracking shortly.
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-left">
            <div className="flex justify-between mb-2">
              <span className="text-gray-500">Order Ref:</span>
              <span className="font-mono font-bold text-navy-900">PROD-{Math.floor(Math.random() * 10000)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Est. Delivery:</span>
              <span className="font-bold text-navy-900">5-7 Business Days</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {onViewHistory && (
              <button 
                onClick={onViewHistory}
                className="w-full bg-gold-500 hover:bg-gold-600 text-navy-900 font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <ReceiptIcon className="w-4 h-4" />
                View Order History
              </button>
            )}
            <button 
              onClick={onClose}
              className="w-full text-gray-500 hover:text-navy-900 font-medium py-2 text-sm"
            >
              Close & Return to Gallery
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        
        {/* Left: Visual Mockup (Always Visible) */}
        <div className="w-full md:w-1/2 bg-gray-100 p-8 flex flex-col items-center justify-center relative">
           <h3 className="absolute top-6 left-6 text-xs font-bold text-gray-400 uppercase tracking-widest">
              {step === 'CONFIG' ? 'Live Preview' : `Shipping to ${shipping.city || '...'}`}
           </h3>
           
           {/* Room Mockup Effect */}
           <div className={`relative bg-white shadow-2xl border-8 border-black rounded-sm transform transition-all duration-700 ${step === 'PAYMENT' ? 'scale-90 rotate-0' : 'rotate-1 hover:rotate-0'}`} style={{ maxWidth: '80%' }}>
              <img src={image.url} alt="Preview" className="w-full h-auto block" />
              {finish === 'gloss' && (
                 <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none"></div>
              )}
           </div>
           
           <div className="mt-8 flex gap-4 text-xs text-gray-400">
             <span className="flex items-center gap-1"><TruckIcon className="w-4 h-4" /> Global Shipping</span>
             <span className="flex items-center gap-1"><RobotIcon className="w-4 h-4" /> AI Enhanced 300DPI</span>
           </div>
        </div>

        {/* Right: Wizard Steps */}
        <div className="w-full md:w-1/2 flex flex-col">
           {step === 'CONFIG' && renderConfigStep()}
           {step === 'SHIPPING' && renderShippingStep()}
           {step === 'PAYMENT' && renderPaymentStep()}
        </div>
      </div>
    </div>
  );
};

export default PrintOrderModal;
