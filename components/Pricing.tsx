
import React from 'react';
import { CheckCircleIcon, StarIcon } from './Icons';

interface Props {
  onUpgrade: (tier: 'PRO' | 'ELITE') => void;
}

const Pricing: React.FC<Props> = ({ onUpgrade }) => {
  return (
    <div className="py-16 bg-slate-50 animate-fade-in" id="pricing">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-navy-900">Invest in Your Future</h2>
          <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits your ambition. From visualizing your dreams to automated execution.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Free Tier */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col hover:shadow-md transition-shadow">
            <h3 className="text-xl font-bold text-navy-900 mb-2">Visionary Starter</h3>
            <p className="text-gray-500 text-sm mb-6">Perfect for defining your initial vision.</p>
            <div className="mb-6">
              <span className="text-4xl font-serif font-bold text-navy-900">Free</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-start gap-3 text-sm text-gray-600">
                <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" />
                <span>Voice-Activated Goal Definition</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-gray-600">
                <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" />
                <span>3 AI Vision Board Generations</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-gray-600">
                <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" />
                <span>Static Goal Categorization</span>
              </li>
            </ul>
            <button className="w-full py-3 rounded-xl border border-navy-900 text-navy-900 font-bold hover:bg-gray-50 transition-colors">
              Current Plan
            </button>
          </div>

          {/* Pro Tier (Popular) */}
          <div className="bg-navy-900 rounded-2xl shadow-xl border border-navy-800 p-8 flex flex-col relative transform scale-105 z-10">
            <div className="absolute top-0 right-0 bg-gold-500 text-navy-900 text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
              MOST POPULAR
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Visionary Pro</h3>
            <p className="text-gray-400 text-sm mb-6">Execute your goals with financial clarity.</p>
            <div className="mb-6">
              <span className="text-4xl font-serif font-bold text-white">$19.99</span>
              <span className="text-gray-400 text-sm">/month</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-start gap-3 text-sm text-gray-300">
                <CheckCircleIcon className="w-5 h-5 text-gold-500 shrink-0" />
                <span>Unlimited AI Visualizations & Refinements</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-gray-300">
                <CheckCircleIcon className="w-5 h-5 text-gold-500 shrink-0" />
                <span>Financial Reality Analysis (Uploads)</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-gray-300">
                <CheckCircleIcon className="w-5 h-5 text-gold-500 shrink-0" />
                <span>3-Month Execution Roadmap Agent</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-gray-300">
                <CheckCircleIcon className="w-5 h-5 text-gold-500 shrink-0" />
                <span>Calendar Integration (Google/Outlook)</span>
              </li>
            </ul>
            <button 
              onClick={() => onUpgrade('PRO')}
              className="w-full py-3 rounded-xl bg-gold-500 text-navy-900 font-bold hover:bg-gold-400 transition-colors shadow-lg"
            >
              Upgrade to Pro
            </button>
          </div>

          {/* Elite Tier */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col hover:shadow-md transition-shadow">
            <h3 className="text-xl font-bold text-navy-900 mb-2">Visionary Elite</h3>
            <p className="text-gray-500 text-sm mb-6">Full autonomy and coaching for high achievers.</p>
            <div className="mb-6">
              <span className="text-4xl font-serif font-bold text-navy-900">$49.99</span>
              <span className="text-gray-400 text-sm">/month</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-start gap-3 text-sm text-gray-600">
                <StarIcon className="w-5 h-5 text-purple-600 shrink-0" />
                <span>Everything in Pro</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-gray-600">
                <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" />
                <span>3-Year Strategic Roadmap Planning</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-gray-600">
                <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" />
                <span>Proactive Research Agent (Visa/Housing)</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-gray-600">
                <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" />
                <span>Priority Support & Weekly AI Coaching</span>
              </li>
            </ul>
            <button 
              onClick={() => onUpgrade('ELITE')}
              className="w-full py-3 rounded-xl border border-navy-900 text-navy-900 font-bold hover:bg-navy-900 hover:text-white transition-all"
            >
              Go Elite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
