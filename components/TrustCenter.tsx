
import React from 'react';
import { ShieldCheckIcon, LockIcon, BankIcon, EyeIcon } from './Icons';

const TrustCenter = () => {
  return (
    <div className="max-w-4xl mx-auto animate-fade-in py-8">
      <div className="text-center mb-12">
        <ShieldCheckIcon className="w-16 h-16 text-navy-900 mx-auto mb-4" />
        <h1 className="text-4xl font-serif font-bold text-navy-900">Trust & Security</h1>
        <p className="text-xl text-gray-600 mt-2">Your vision is personal. Your data is secure.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
          <div className="w-12 h-12 bg-gold-100 rounded-xl flex items-center justify-center mb-4">
            <LockIcon className="w-6 h-6 text-gold-600" />
          </div>
          <h3 className="text-xl font-bold text-navy-900 mb-2">Bank-Level Encryption</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            All financial data is encrypted using AES-256 standards at rest and TLS 1.3 in transit. We strictly adhere to SOC2 Type II compliance protocols to ensure your financial information remains confidential.
          </p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
            <BankIcon className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-navy-900 mb-2">Read-Only Access</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            Visionary connects to your institutions in read-only mode. We cannot move money, make changes, or initiate transactions without your explicit, multi-factor authorization for specific goals.
          </p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
            <EyeIcon className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-navy-900 mb-2">Private Vision Data</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            Your Vision Boards and chat history are isolated using Row Level Security (RLS). No other user or AI agent can access your personal dreams or files.
          </p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
            <ShieldCheckIcon className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-xl font-bold text-navy-900 mb-2">Verified Partners</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            We partner only with industry leaders like Plaid for banking, Google Cloud for AI, and Prodigi for printing to ensure a secure chain of custody for your data.
          </p>
        </div>
      </div>

      <div className="bg-navy-900 text-white rounded-2xl p-8 text-center">
        <h3 className="text-xl font-bold mb-4">Have security concerns?</h3>
        <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
          Our dedicated security team is available to answer any questions about how we protect your legacy.
        </p>
        <a href="mailto:security@visionary.com" className="bg-gold-500 text-navy-900 font-bold py-3 px-8 rounded-full hover:bg-gold-400 transition-colors inline-block">
          Contact Security Team
        </a>
      </div>
    </div>
  );
};

export default TrustCenter;
