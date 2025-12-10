import React from 'react';

interface FeatureProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  imagePosition: 'left' | 'right';
  preview: React.ReactNode;
}

const Feature: React.FC<FeatureProps> = ({ title, description, icon, imagePosition, preview }) => {
  const content = (
    <div className={`flex flex-col justify-center ${imagePosition === 'left' ? 'lg:pl-12' : 'lg:pr-12'}`}>
      <div className="w-12 h-12 bg-gold-500/10 rounded-xl flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-2xl md:text-3xl font-serif font-bold text-navy-900 mb-4">{title}</h3>
      <p className="text-gray-600 text-lg leading-relaxed mb-6">{description}</p>
      <ul className="space-y-3">
        {['AI-powered generation', 'Real-time collaboration', 'Export & print ready'].map((item, i) => (
          <li key={i} className="flex items-center gap-3 text-gray-700">
            <svg className="w-5 h-5 text-gold-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="grid lg:grid-cols-2 gap-12 items-center">
      {imagePosition === 'left' ? (
        <>
          <div className="order-2 lg:order-1">{preview}</div>
          <div className="order-1 lg:order-2">{content}</div>
        </>
      ) : (
        <>
          <div>{content}</div>
          <div>{preview}</div>
        </>
      )}
    </div>
  );
};

export const FeaturesSection: React.FC = () => {
  return (
    <section id="how-it-works" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-gold-600 font-semibold text-sm uppercase tracking-wider">How It Works</span>
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-navy-900 mt-2 mb-4">
            From Dream to Reality in 3 Steps
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Our AI-powered platform guides you from visualization to execution
          </p>
        </div>

        <div className="space-y-24">
          {/* Step 1: Visualize */}
          <Feature
            title="1. Visualize Your Dreams"
            description="Describe your ideal future and watch as our AI transforms your words into stunning, personalized vision boards. Add your own photos, refine the imagery, and create a visual representation of your goals."
            icon={
              <svg className="w-6 h-6 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            imagePosition="right"
            preview={
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                </div>
                <div className="bg-gradient-to-br from-navy-900 to-slate-800 rounded-xl aspect-video flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-16 h-16 text-gold-500 mx-auto mb-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    <span className="text-white/80 font-medium">AI Vision Generator</span>
                  </div>
                </div>
              </div>
            }
          />

          {/* Step 2: Plan */}
          <Feature
            title="2. Build Your Roadmap"
            description="Our AI analyzes your vision and creates a personalized action plan with milestones, daily tasks, and habit recommendations. Set financial targets and track your progress toward each goal."
            icon={
              <svg className="w-6 h-6 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            }
            imagePosition="left"
            preview={
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <h4 className="font-bold text-navy-900 mb-4">Your Action Plan</h4>
                <div className="space-y-3">
                  {[
                    { task: "Define retirement date", done: true },
                    { task: "Calculate monthly savings target", done: true },
                    { task: "Research dream locations", done: false },
                    { task: "Set up automated transfers", done: false }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${item.done ? 'bg-green-100' : 'border-2 border-gray-300'}`}>
                        {item.done && (
                          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className={item.done ? 'text-gray-400 line-through' : 'text-gray-700'}>{item.task}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500">Progress</span>
                    <span className="font-bold text-navy-900">50%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-1/2 bg-gradient-to-r from-gold-400 to-gold-500 rounded-full"></div>
                  </div>
                </div>
              </div>
            }
          />

          {/* Step 3: Execute */}
          <Feature
            title="3. Execute with AI Coaching"
            description="Stay on track with daily habit tracking, weekly AI coaching sessions, and intelligent reminders. Get personalized motivation based on your chosen coaching theme - whether spiritual, analytical, or motivational."
            icon={
              <svg className="w-6 h-6 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
            imagePosition="right"
            preview={
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-navy-900 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <span className="block font-bold text-navy-900">AI Coach</span>
                    <span className="text-xs text-green-500">Online now</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="bg-navy-900 text-white p-3 rounded-2xl rounded-tl-none text-sm max-w-[80%]">
                    Great progress this week! You've completed 5 of 7 daily habits. Ready for your weekly review?
                  </div>
                  <div className="bg-slate-100 text-navy-900 p-3 rounded-2xl rounded-tr-none text-sm max-w-[80%] ml-auto">
                    Yes, let's do it!
                  </div>
                  <div className="bg-navy-900 text-white p-3 rounded-2xl rounded-tl-none text-sm max-w-[80%]">
                    Your savings are 12% ahead of schedule. At this rate, you'll hit your first milestone 3 months early!
                  </div>
                </div>
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
