import React from 'react';
import { SparklesIcon } from '../Icons';

interface VisionHeroProps {
  onGetStarted: () => void;
  onWatchDemo?: () => void;
}

export const VisionHero: React.FC<VisionHeroProps> = ({ onGetStarted, onWatchDemo }) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30"></div>

      {/* Decorative Gradient Blurs */}
      <div className="absolute top-20 -left-40 w-96 h-96 bg-gold-400/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 -right-40 w-96 h-96 bg-navy-900/10 rounded-full blur-3xl"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-gold-500/10 border border-gold-500/20 rounded-full px-4 py-2 mb-6">
              <SparklesIcon className="w-4 h-4 text-gold-600" />
              <span className="text-sm font-medium text-gold-700">AI-Powered Vision Boarding</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-navy-900 leading-tight mb-6">
              Your Vision
              <span className="block text-gold-500">Awaits</span>
            </h1>

            <p className="text-xl text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Transform your dreams into stunning visual boards, build actionable roadmaps, and manifest your future with AI-powered coaching and premium print products.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button
                onClick={onGetStarted}
                className="group bg-navy-900 text-white text-lg font-semibold px-8 py-4 rounded-full shadow-xl hover:bg-navy-800 hover:shadow-2xl transition-all duration-300 flex items-center justify-center gap-3"
              >
                <SparklesIcon className="w-5 h-5 text-gold-400 group-hover:scale-110 transition-transform" />
                Start Your Ascension
              </button>

              {onWatchDemo && (
                <button
                  onClick={onWatchDemo}
                  className="group text-navy-900 text-lg font-semibold px-8 py-4 rounded-full border-2 border-navy-900/20 hover:border-navy-900 transition-all duration-300 flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Watch Demo
                </button>
              )}
            </div>

            {/* Trust Indicators */}
            <div className="mt-10 flex items-center gap-6 justify-center lg:justify-start text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Free to start</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>No credit card required</span>
              </div>
            </div>
          </div>

          {/* Right Column - Hero Visual */}
          <div className="relative">
            <div className="relative">
              {/* Main Vision Board Preview */}
              <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-4 transform hover:scale-[1.02] transition-transform duration-500">
                <div className="aspect-[4/3] bg-gradient-to-br from-navy-900 via-navy-800 to-slate-900 rounded-2xl overflow-hidden relative">
                  {/* Vision Board Grid Preview */}
                  <div className="absolute inset-0 grid grid-cols-3 gap-2 p-4">
                    <div className="bg-gradient-to-br from-gold-400/30 to-gold-600/30 rounded-xl"></div>
                    <div className="col-span-2 bg-gradient-to-br from-slate-700/50 to-slate-800/50 rounded-xl flex items-center justify-center">
                      <div className="text-center px-4">
                        <span className="text-white/90 font-serif text-2xl font-bold block">Dream Life</span>
                        <span className="text-white/60 text-sm">2025 Vision</span>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-400/30 to-emerald-600/30 rounded-xl"></div>
                    <div className="bg-gradient-to-br from-purple-400/30 to-purple-600/30 rounded-xl"></div>
                    <div className="bg-gradient-to-br from-blue-400/30 to-blue-600/30 rounded-xl"></div>
                  </div>

                  {/* AI Generating Badge */}
                  <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-navy-900">AI Generating...</span>
                  </div>
                </div>
              </div>

              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 bg-gold-500 text-navy-900 px-4 py-2 rounded-full shadow-lg font-bold text-sm animate-bounce">
                Powered by AI
              </div>

              <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-navy-900 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-navy-900">Action Plan Ready</span>
                    <span className="text-xs text-gray-500">12 tasks generated</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VisionHero;
