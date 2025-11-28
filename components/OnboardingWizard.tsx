
import React, { useState } from 'react';
import { VisionTemplate } from '../types';
import { BriefcaseIcon, PlaneIcon, HeartIcon, SunIcon, SparklesIcon } from './Icons';

interface Props {
  onComplete: (prompt: string) => void;
  onSkip: () => void;
}

const CATEGORIES: {id: string, icon: any, label: string}[] = [
  { id: 'RETIREMENT', icon: SunIcon, label: 'Dream Retirement' },
  { id: 'CAREER', icon: BriefcaseIcon, label: 'Career Growth' },
  { id: 'TRAVEL', icon: PlaneIcon, label: 'Travel & Adventure' },
  { id: 'HEALTH', icon: HeartIcon, label: 'Health & Wellness' },
];

const STYLES = [
  { id: 'LUXURY', label: 'Luxury & High-End', desc: 'Sophisticated, elegant, expensive textures.' },
  { id: 'TROPICAL', label: 'Tropical Paradise', desc: 'Nature, vivid colors, sunlight, water.' },
  { id: 'MINIMALIST', label: 'Modern Minimalist', desc: 'Clean lines, bright spaces, clutter-free.' },
  { id: 'CYBERPUNK', label: 'Futuristic / Tech', desc: 'Neon lights, night cityscapes, modern tech.' },
];

const OnboardingWizard: React.FC<Props> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<string>('');
  const [style, setStyle] = useState<string>('');

  const handleCategorySelect = (id: string) => {
    setCategory(id);
    setStep(2);
  };

  const handleStyleSelect = (id: string) => {
    setStyle(id);
    generatePrompt(category, id);
  };

  const generatePrompt = (catId: string, styleId: string) => {
    let base = "";
    if (catId === 'RETIREMENT') base = "A joyous couple enjoying retirement, financial freedom, relaxation";
    if (catId === 'CAREER') base = "A successful professional in a modern office, leadership, achievement";
    if (catId === 'TRAVEL') base = "Exploring the world, adventure, famous landmarks, freedom";
    if (catId === 'HEALTH') base = "Vibrant health, yoga, running, healthy food, energetic lifestyle";

    let aesthetic = "";
    if (styleId === 'LUXURY') aesthetic = ", luxury resort style, golden hour lighting, high-end clothing, 8k resolution";
    if (styleId === 'TROPICAL') aesthetic = ", tropical beach setting, palm trees, crystal clear water, vibrant colors";
    if (styleId === 'MINIMALIST') aesthetic = ", minimalist architecture, soft natural light, clean composition, peaceful";
    if (styleId === 'CYBERPUNK') aesthetic = ", futuristic city background, neon blue and purple lighting, cinematic look";

    const fullPrompt = `${base}${aesthetic}. Photorealistic, cinematic composition.`;
    onComplete(fullPrompt);
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif font-bold text-navy-900 mb-4">
            {step === 1 ? "What are you manifesting?" : "Choose your aesthetic."}
          </h1>
          <p className="text-gray-500">
            {step === 1 ? "Let's define the core theme of your vision board." : "How should your future look and feel?"}
          </p>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className="bg-white p-8 rounded-2xl shadow-md border-2 border-transparent hover:border-gold-500 hover:shadow-xl transition-all group flex flex-col items-center gap-4"
              >
                <div className="p-4 bg-gray-50 rounded-full group-hover:bg-gold-100 transition-colors">
                  <cat.icon className="w-8 h-8 text-navy-900" />
                </div>
                <span className="font-bold text-navy-900">{cat.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => handleStyleSelect(s.id)}
                className="bg-white p-6 rounded-2xl shadow-md border-2 border-transparent hover:border-gold-500 hover:shadow-xl transition-all text-left"
              >
                <h3 className="font-bold text-navy-900 mb-1">{s.label}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </button>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <button onClick={onSkip} className="text-gray-400 hover:text-navy-900 text-sm font-medium">
            Skip this, I'll write my own vision
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
