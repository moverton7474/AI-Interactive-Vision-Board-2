
import React, { useState, useEffect } from 'react';
import { WorkbookTemplate, ShippingAddress, VisionImage, Habit } from '../types';
import { BookOpenIcon, CheckBadgeIcon, TruckIcon, LockIcon, SparklesIcon } from './Icons';
import {
  getWorkbookTemplates,
  createWorkbookOrder,
  generateWorkbookPdf,
  getVisionGallery,
  getHabits,
  getLastShippingAddress,
  createStripeCheckoutSession
} from '../services/storageService';

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

type WizardStep = 'TEMPLATE' | 'CUSTOMIZE' | 'CONTENT' | 'SHIPPING' | 'PAYMENT' | 'SUCCESS';

const WorkbookOrderModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<WizardStep>('TEMPLATE');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Data
  const [templates, setTemplates] = useState<WorkbookTemplate[]>([]);
  const [visionBoards, setVisionBoards] = useState<VisionImage[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);

  // Selections
  const [selectedTemplate, setSelectedTemplate] = useState<WorkbookTemplate | null>(null);
  const [selectedVisionBoards, setSelectedVisionBoards] = useState<string[]>([]);
  const [selectedHabits, setSelectedHabits] = useState<string[]>([]);

  // Customization
  const [title, setTitle] = useState('My Vision Workbook');
  const [subtitle, setSubtitle] = useState(new Date().getFullYear().toString());
  const [dedicationText, setDedicationText] = useState('');
  const [includeWeeklyJournal, setIncludeWeeklyJournal] = useState(true);
  const [includeHabitTracker, setIncludeHabitTracker] = useState(true);

  // Shipping
  const [shipping, setShipping] = useState<ShippingAddress>({
    name: '',
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US'
  });

  // Order
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [templatesData, visionData, habitsData, lastAddress] = await Promise.all([
        getWorkbookTemplates(),
        getVisionGallery(),
        getHabits(),
        getLastShippingAddress()
      ]);

      setTemplates(templatesData);
      setVisionBoards(visionData);
      setHabits(habitsData);

      if (lastAddress) {
        setShipping(lastAddress);
      }

      // Pre-select all vision boards and habits
      setSelectedVisionBoards(visionData.slice(0, 5).map(v => v.id));
      setSelectedHabits(habitsData.map(h => h.id));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = (template: WorkbookTemplate) => {
    setSelectedTemplate(template);
    setStep('CUSTOMIZE');
  };

  const handleSubmitOrder = async () => {
    if (!selectedTemplate) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // 1. Create the order
      const order = await createWorkbookOrder({
        template_id: selectedTemplate.id,
        title,
        subtitle,
        dedication_text: dedicationText || undefined,
        include_weekly_journal: includeWeeklyJournal,
        include_habit_tracker: includeHabitTracker,
        vision_board_ids: selectedVisionBoards,
        included_habits: selectedHabits,
        shipping_address: shipping
      });

      if (!order) {
        throw new Error('Failed to create order');
      }

      setOrderId(order.id);

      // 2. Generate the workbook content
      await generateWorkbookPdf(order.id);

      // 3. Initiate Stripe Checkout
      const checkoutUrl = await createStripeCheckoutSession('payment', order.id);

      if (checkoutUrl === "SIMULATION") {
        // Demo mode - show success
        setStep('SUCCESS');
      } else if (checkoutUrl) {
        // Redirect to Stripe
        window.location.href = checkoutUrl;
      }
    } catch (error: any) {
      console.error('Order failed:', error);
      setErrorMessage(error.message || 'Failed to create order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate pricing
  const subtotal = selectedTemplate?.base_price || 0;
  const shippingCost = selectedTemplate?.shipping_estimate || 9.99;
  const total = subtotal + shippingCost;

  const renderTemplateStep = () => (
    <div className="p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-serif font-bold text-navy-900">Choose Your Workbook</h2>
          <p className="text-gray-500 text-sm">Step 1 of 5: Select a template</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => handleSelectTemplate(template)}
              className="border-2 border-gray-200 rounded-xl p-6 cursor-pointer hover:border-navy-900 hover:shadow-lg transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-navy-100 rounded-lg flex items-center justify-center">
                  <BookOpenIcon className="w-6 h-6 text-navy-900" />
                </div>
                <span className="text-2xl font-bold text-navy-900">${template.base_price.toFixed(2)}</span>
              </div>
              <h3 className="text-lg font-bold text-navy-900 mb-1">{template.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{template.description}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{template.size}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{template.page_count} pages</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded capitalize">{template.binding}</span>
              </div>
              <ul className="text-xs text-gray-500 space-y-1">
                {template.features?.slice(0, 4).map((feature, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <CheckBadgeIcon className="w-3 h-3 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCustomizeStep = () => (
    <div className="p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-serif font-bold text-navy-900">Personalize Your Workbook</h2>
          <p className="text-gray-500 text-sm">Step 2 of 5: Add your personal touch</p>
        </div>
        <button onClick={() => setStep('TEMPLATE')} className="text-sm text-gray-500 hover:text-navy-900 underline">Back</button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-navy-900 mb-2">Workbook Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
            placeholder="My Vision Workbook"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-navy-900 mb-2">Subtitle</label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
            placeholder="2024"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-navy-900 mb-2">Dedication (Optional)</label>
          <textarea
            value={dedicationText}
            onChange={(e) => setDedicationText(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg p-3 focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
            placeholder="To my future self..."
          />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <label className="block text-sm font-bold text-navy-900 mb-3">Include Sections</label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeWeeklyJournal}
                onChange={(e) => setIncludeWeeklyJournal(e.target.checked)}
                className="w-5 h-5 text-navy-900 rounded"
              />
              <span className="text-sm text-gray-700">52-Week Reflection Journal</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHabitTracker}
                onChange={(e) => setIncludeHabitTracker(e.target.checked)}
                className="w-5 h-5 text-navy-900 rounded"
              />
              <span className="text-sm text-gray-700">12-Month Habit Tracker</span>
            </label>
          </div>
        </div>
      </div>

      <button
        onClick={() => setStep('CONTENT')}
        className="w-full mt-8 bg-navy-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-navy-800 transition-all"
      >
        Continue to Content Selection
      </button>
    </div>
  );

  const renderContentStep = () => (
    <div className="p-8 overflow-y-auto max-h-[70vh]">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-serif font-bold text-navy-900">Select Content</h2>
          <p className="text-gray-500 text-sm">Step 3 of 5: Choose what to include</p>
        </div>
        <button onClick={() => setStep('CUSTOMIZE')} className="text-sm text-gray-500 hover:text-navy-900 underline">Back</button>
      </div>

      {/* Vision Boards Section */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wide mb-3">
          Vision Boards ({selectedVisionBoards.length} selected)
        </h3>
        {visionBoards.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {visionBoards.slice(0, 9).map((vision) => (
              <div
                key={vision.id}
                onClick={() => {
                  setSelectedVisionBoards(prev =>
                    prev.includes(vision.id)
                      ? prev.filter(id => id !== vision.id)
                      : [...prev, vision.id]
                  );
                }}
                className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-4 transition-all ${
                  selectedVisionBoards.includes(vision.id)
                    ? 'border-navy-900 ring-2 ring-navy-300'
                    : 'border-transparent hover:border-gray-300'
                }`}
              >
                <img src={vision.url} alt={vision.prompt} className="w-full h-full object-cover" />
                {selectedVisionBoards.includes(vision.id) && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-navy-900 rounded-full flex items-center justify-center">
                    <CheckBadgeIcon className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4">
            No vision boards yet. Create some vision boards to include them in your workbook!
          </p>
        )}
      </div>

      {/* Habits Section */}
      {includeHabitTracker && (
        <div>
          <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wide mb-3">
            Habits to Track ({selectedHabits.length} selected)
          </h3>
          {habits.length > 0 ? (
            <div className="space-y-2">
              {habits.map((habit) => (
                <label
                  key={habit.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedHabits.includes(habit.id)
                      ? 'border-navy-900 bg-navy-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedHabits.includes(habit.id)}
                    onChange={() => {
                      setSelectedHabits(prev =>
                        prev.includes(habit.id)
                          ? prev.filter(id => id !== habit.id)
                          : [...prev, habit.id]
                      );
                    }}
                    className="w-5 h-5 text-navy-900 rounded"
                  />
                  <div>
                    <span className="font-medium text-navy-900">{habit.title}</span>
                    {habit.description && (
                      <p className="text-xs text-gray-500">{habit.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4">
              No habits yet. Create habits in the Habits section to include tracking pages!
            </p>
          )}
        </div>
      )}

      <button
        onClick={() => setStep('SHIPPING')}
        className="w-full mt-8 bg-navy-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-navy-800 transition-all"
      >
        Continue to Shipping
      </button>
    </div>
  );

  const renderShippingStep = () => (
    <div className="p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-serif font-bold text-navy-900">Shipping Details</h2>
          <p className="text-gray-500 text-sm">Step 4 of 5: Where should we send it?</p>
        </div>
        <button onClick={() => setStep('CONTENT')} className="text-sm text-gray-500 hover:text-navy-900 underline">Back</button>
      </div>

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setStep('PAYMENT'); }}>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
          <input
            required
            type="text"
            value={shipping.name}
            onChange={e => setShipping({ ...shipping, name: e.target.value })}
            className="w-full border rounded-lg p-3"
            placeholder="John Doe"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Address Line 1</label>
          <input
            required
            type="text"
            value={shipping.line1}
            onChange={e => setShipping({ ...shipping, line1: e.target.value })}
            className="w-full border rounded-lg p-3"
            placeholder="123 Dream St"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Address Line 2 (Optional)</label>
          <input
            type="text"
            value={shipping.line2 || ''}
            onChange={e => setShipping({ ...shipping, line2: e.target.value })}
            className="w-full border rounded-lg p-3"
            placeholder="Apt 4B"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">City</label>
            <input
              required
              type="text"
              value={shipping.city}
              onChange={e => setShipping({ ...shipping, city: e.target.value })}
              className="w-full border rounded-lg p-3"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">State/Province</label>
            <input
              required
              type="text"
              value={shipping.state}
              onChange={e => setShipping({ ...shipping, state: e.target.value })}
              className="w-full border rounded-lg p-3"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Zip/Postal Code</label>
            <input
              required
              type="text"
              value={shipping.postalCode}
              onChange={e => setShipping({ ...shipping, postalCode: e.target.value })}
              className="w-full border rounded-lg p-3"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Country</label>
            <select
              value={shipping.country}
              onChange={e => setShipping({ ...shipping, country: e.target.value })}
              className="w-full border rounded-lg p-3"
            >
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="w-full mt-6 bg-navy-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-navy-800 transition-all"
        >
          Continue to Payment
        </button>
      </form>
    </div>
  );

  const renderPaymentStep = () => (
    <div className="p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-serif font-bold text-navy-900">Review & Pay</h2>
          <p className="text-gray-500 text-sm">Step 5 of 5: Complete your order</p>
        </div>
        <button onClick={() => setStep('SHIPPING')} className="text-sm text-gray-500 hover:text-navy-900 underline">Back</button>
      </div>

      <div className="space-y-6 mb-8">
        {/* Order Summary */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="font-bold text-navy-900 mb-3 text-sm uppercase">Order Summary</h4>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-navy-100 rounded-lg flex items-center justify-center">
              <BookOpenIcon className="w-8 h-8 text-navy-900" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-navy-900">{selectedTemplate?.name}</p>
              <p className="text-sm text-gray-500">{selectedTemplate?.size} &bull; {selectedTemplate?.binding}</p>
            </div>
          </div>
          <div className="text-sm text-gray-500 space-y-1 mb-2">
            <p>&bull; {selectedVisionBoards.length} vision boards included</p>
            <p>&bull; {selectedHabits.length} habits to track</p>
            {includeWeeklyJournal && <p>&bull; 52-week reflection journal</p>}
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="font-bold text-navy-900 mb-2 text-sm uppercase">Ship To</h4>
          <p className="text-sm text-gray-600">{shipping.name}</p>
          <p className="text-sm text-gray-600">{shipping.line1} {shipping.line2}</p>
          <p className="text-sm text-gray-600">{shipping.city}, {shipping.state} {shipping.postalCode}</p>
          <p className="text-sm text-gray-600">{shipping.country}</p>
        </div>

        {/* Pricing */}
        <div className="bg-gold-50 border border-gold-200 rounded-lg p-4">
          <div className="flex justify-between text-sm mb-2 text-gray-600">
            <span>{selectedTemplate?.name}</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm mb-3 text-gray-600">
            <span>Shipping (Standard)</span>
            <span>${shippingCost.toFixed(2)}</span>
          </div>
          <div className="border-t border-gold-200 pt-3 flex justify-between items-end">
            <span className="font-bold text-navy-900">Total</span>
            <span className="text-3xl font-serif font-bold text-navy-900">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
          <span className="font-bold">Error:</span> {errorMessage}
        </div>
      )}

      <button
        onClick={handleSubmitOrder}
        disabled={isProcessing}
        className="w-full bg-gradient-to-r from-navy-900 to-navy-800 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <LockIcon className="w-5 h-5" />
            Pay & Create Workbook via Stripe
          </>
        )}
      </button>
      <p className="mt-4 text-center text-[10px] text-gray-400">
        Secure Payment processed by Stripe. Your workbook will be generated and printed by Prodigi.
      </p>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="p-8 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckBadgeIcon className="w-10 h-10 text-green-600" />
      </div>
      <h3 className="text-2xl font-serif font-bold text-navy-900 mb-2">Workbook Created!</h3>
      <p className="text-gray-500 mb-6">
        Your personalized Vision Workbook is being generated and will be printed shortly. You'll receive an email with tracking information.
      </p>

      <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-left">
        <div className="flex justify-between mb-2">
          <span className="text-gray-500">Order ID:</span>
          <span className="font-mono font-bold text-navy-900">{orderId?.slice(0, 8) || 'PENDING'}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-gray-500">Product:</span>
          <span className="font-bold text-navy-900">{selectedTemplate?.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Est. Delivery:</span>
          <span className="font-bold text-navy-900">7-14 Business Days</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => {
            onSuccess?.();
            onClose();
          }}
          className="w-full bg-navy-900 text-white font-bold py-3 rounded-lg hover:bg-navy-800 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
        {/* Progress Bar */}
        <div className="h-1 bg-gray-100 flex">
          {['TEMPLATE', 'CUSTOMIZE', 'CONTENT', 'SHIPPING', 'PAYMENT', 'SUCCESS'].map((s, i) => {
            const steps: WizardStep[] = ['TEMPLATE', 'CUSTOMIZE', 'CONTENT', 'SHIPPING', 'PAYMENT', 'SUCCESS'];
            const currentIndex = steps.indexOf(step);
            return (
              <div
                key={s}
                className={`flex-1 transition-colors ${i <= currentIndex ? 'bg-navy-900' : 'bg-gray-200'}`}
              />
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'TEMPLATE' && renderTemplateStep()}
          {step === 'CUSTOMIZE' && renderCustomizeStep()}
          {step === 'CONTENT' && renderContentStep()}
          {step === 'SHIPPING' && renderShippingStep()}
          {step === 'PAYMENT' && renderPaymentStep()}
          {step === 'SUCCESS' && renderSuccessStep()}
        </div>
      </div>
    </div>
  );
};

export default WorkbookOrderModal;
