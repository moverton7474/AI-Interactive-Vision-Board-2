import React from 'react';
import { SparklesIcon } from '../Icons';

interface Props {
  onContinue: () => void;
}

const WelcomeStep: React.FC<Props> = ({ onContinue }) => {
  return (
    <div className="text-center max-w-xl mx-auto">
      {/* Animated Logo */}
      <div className="relative mb-8">
        <div className="w-24 h-24 bg-gradient-to-br from-navy-900 to-navy-800 rounded-3xl flex items-center justify-center mx-auto shadow-2xl">
          <span className="text-gold-400 font-serif font-bold text-4xl">V</span>
        </div>
        {/* Sparkle decorations */}
        <div className="absolute -top-2 -right-2 animate-pulse">
          <SparklesIcon className="w-6 h-6 text-gold-400" />
        </div>
        <div className="absolute -bottom-1 -left-3 animate-pulse" style={{ animationDelay: '0.5s' }}>
          <SparklesIcon className="w-5 h-5 text-gold-300" />
        </div>
      </div>

      {/* Welcome Message */}
      <h1 className="text-4xl md:text-5xl font-serif font-bold text-navy-900 mb-4">
        Welcome to Visionary AI
      </h1>

      <p className="text-xl text-gray-600 mb-8 leading-relaxed">
        You're about to begin a transformative journey.
        <br />
        This is the first step in customizing your personal AI Coach.
      </p>

      {/* What to expect */}
      <div className="bg-gradient-to-br from-gold-50 to-white rounded-2xl p-6 mb-8 border border-gold-100 text-left">
        <h3 className="font-bold text-navy-900 mb-4 flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-gold-500" />
          What you'll do in the next few minutes:
        </h3>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 bg-navy-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-navy-700 text-sm font-bold">1</span>
            </div>
            <span className="text-gray-600">Choose your coaching identity and communication style</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 bg-navy-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-navy-700 text-sm font-bold">2</span>
            </div>
            <span className="text-gray-600">Describe your vision and set your goals</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 bg-navy-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-navy-700 text-sm font-bold">3</span>
            </div>
            <span className="text-gray-600">Generate your personalized AI vision board</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 bg-navy-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-navy-700 text-sm font-bold">4</span>
            </div>
            <span className="text-gray-600">Build your action plan and daily habits</span>
          </li>
        </ul>
      </div>

      {/* Inspirational Quote */}
      <div className="mb-10">
        <p className="text-gray-500 italic text-lg">
          "The future belongs to those who believe in the beauty of their dreams."
        </p>
        <p className="text-gray-400 text-sm mt-1">— Eleanor Roosevelt</p>
      </div>

      {/* CTA Button */}
      <button
        onClick={onContinue}
        className="group bg-navy-900 text-white text-lg font-semibold px-12 py-4 rounded-full shadow-xl hover:bg-navy-800 hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center justify-center gap-3 mx-auto"
      >
        <SparklesIcon className="w-6 h-6 text-gold-400 group-hover:rotate-12 transition-transform" />
        Begin My Vision
      </button>

      <p className="text-gray-400 text-sm mt-4">
        Takes about 5 minutes to complete
      </p>
    </div>
  );
};

export default WelcomeStep;
