
import React, { useState, useEffect } from 'react';
import { generateActionPlan } from '../services/geminiService';
import { Milestone, ActionTask, FinancialGoal } from '../types';
import { RobotIcon, CalendarIcon, CheckCircleIcon, SparklesIcon } from './Icons';

interface Props {
  visionPrompt: string;
  financialData: FinancialGoal[];
  onBack: () => void;
}

const ActionPlanAgent: React.FC<Props> = ({ visionPrompt, financialData, onBack }) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAgent = async () => {
      // Construct dynamic context from real data
      let financialContext = "No specific financial data provided.";
      if (financialData.length > 0) {
         const current = financialData[0];
         const target = financialData[financialData.length - 1];
         financialContext = `Current Savings (Year ${current.year}): $${current.savings.toLocaleString()}. Target Goal (Year ${target.year}): $${target.goal.toLocaleString()}. Status: ${current.savings >= current.projected ? "On Track" : "Behind Schedule"}.`;
      }

      const plan = await generateActionPlan(visionPrompt || "Retire abroad", financialContext);
      setMilestones(plan);
      setLoading(false);
    };

    initAgent();
  }, [visionPrompt, financialData]);

  const addToCalendar = (task: ActionTask) => {
    // Generate Google Calendar Link
    const title = encodeURIComponent(task.title);
    const details = encodeURIComponent(`Visionary Task: ${task.description}`);
    const dateStr = task.dueDate.replace(/-|:|\.\d\d\d/g, ""); // Basic format YYYYMMDD
    const dates = `${dateStr}/${dateStr}`; // Single day event
    
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="w-16 h-16 bg-navy-900 rounded-full flex items-center justify-center animate-bounce mb-6">
          <RobotIcon className="w-8 h-8 text-gold-500" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-navy-900 mb-2">Agent Working...</h2>
        <p className="text-gray-500 max-w-md text-center">
          Analyzing housing markets in {visionPrompt.includes("Thailand") ? "Thailand" : "your destination"}, 
          calculating compound interest, and building your execution roadmap.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in pb-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-gradient-to-br from-navy-900 to-navy-700 p-3 rounded-xl shadow-lg">
          <RobotIcon className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-serif font-bold text-navy-900">Your Vision Agent</h2>
          <p className="text-gray-600">Executing your goal: <span className="font-semibold text-navy-800">"{visionPrompt}"</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Milestones Column */}
        <div className="lg:col-span-2 space-y-8">
          {milestones.map((ms, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-gold-500"></div>
              
              <div className="flex justify-between items-start mb-4 pl-4">
                <div>
                  <h3 className="text-xl font-bold text-navy-900">{ms.year}: {ms.title}</h3>
                  {ms.marketResearchSnippet && (
                    <div className="mt-2 bg-blue-50 text-blue-800 text-xs px-3 py-2 rounded-lg flex items-start gap-2">
                       <SparklesIcon className="w-4 h-4 shrink-0 mt-0.5" />
                       <p className="font-medium">{ms.marketResearchSnippet}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 pl-4">
                {ms.tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-gray-200 group">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${task.type === 'FINANCE' ? 'bg-green-500' : task.type === 'LIFESTYLE' ? 'bg-purple-500' : 'bg-gray-500'}`} />
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{task.title}</p>
                        <p className="text-xs text-gray-400">{task.description}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => addToCalendar(task)}
                      className="text-gray-400 hover:text-navy-900 p-2 rounded-full hover:bg-gray-200 transition-colors"
                      title="Add to Google Calendar"
                    >
                      <CalendarIcon className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Status */}
        <div className="space-y-6">
           <div className="bg-navy-900 text-white p-6 rounded-2xl shadow-xl">
              <h3 className="font-serif font-bold text-lg mb-4">Agent Status</h3>
              <ul className="space-y-4 text-sm">
                <li className="flex items-center gap-2 text-green-400">
                  <CheckCircleIcon className="w-5 h-5" />
                  <span>Vision Analyzed</span>
                </li>
                <li className="flex items-center gap-2 text-green-400">
                  <CheckCircleIcon className="w-5 h-5" />
                  <span>Financial Gap Calculated</span>
                </li>
                <li className="flex items-center gap-2 text-gold-400 animate-pulse">
                  <RobotIcon className="w-5 h-5" />
                  <span>Monitoring Housing Market</span>
                </li>
              </ul>
              
              <div className="mt-6 pt-6 border-t border-navy-700">
                <h4 className="font-bold text-gold-500 mb-2">Recommended Next Steps</h4>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Based on your interest in Thailand, I recommend enabling <strong>Google Search Grounding</strong> to get live real estate listings in Phuket directly in this dashboard.
                </p>
              </div>
           </div>

           <button 
             onClick={onBack}
             className="w-full py-3 border border-gray-300 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition-colors"
           >
             Back to Vision Board
           </button>
        </div>
      </div>
    </div>
  );
};

export default ActionPlanAgent;
