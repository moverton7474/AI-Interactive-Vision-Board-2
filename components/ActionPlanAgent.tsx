
import React, { useState, useEffect } from 'react';
import { generateActionPlan } from '../services/geminiService';
import { saveActionTasks, getActionTasks, updateTaskStatus } from '../services/storageService';
import { Milestone, ActionTask, FinancialGoal } from '../types';
import { RobotIcon, CalendarIcon, CheckCircleIcon, SparklesIcon, MailIcon, MapIcon } from './Icons';

interface Props {
  visionPrompt: string;
  financialData: FinancialGoal[];
  onBack: () => void;
}

const ActionPlanAgent: React.FC<Props> = ({ visionPrompt, financialData, onBack }) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [researchSources, setResearchSources] = useState<string[]>([]);

  useEffect(() => {
    loadPlan();
  }, [visionPrompt, financialData]);

  const loadPlan = async () => {
    setLoading(true);
    // 1. Check DB for existing tasks
    const existingTasks = await getActionTasks();
    
    if (existingTasks.length > 0) {
       // Group by year to reconstruct Milestones view
       const grouped: Record<number, ActionTask[]> = {};
       existingTasks.forEach(t => {
         const y = t.milestoneYear || new Date().getFullYear();
         if (!grouped[y]) grouped[y] = [];
         grouped[y].push(t);
       });
       
       const reconstructed: Milestone[] = Object.keys(grouped).map(y => ({
          year: parseInt(y),
          title: `Roadmap Year ${y}`,
          marketResearchSnippet: grouped[parseInt(y)][0].aiMetadata?.researchSnippet || "Plan loaded from database",
          tasks: grouped[parseInt(y)]
       }));
       setMilestones(reconstructed);
       setLoading(false);
    } else {
       // 2. Generate New Plan
       await generateNewPlan();
    }
  };

  const generateNewPlan = async () => {
      let financialContext = "No specific financial data provided.";
      if (financialData.length > 0) {
         const current = financialData[0];
         const target = financialData[financialData.length - 1];
         financialContext = `Current Savings: $${current.savings}. Goal: $${target.goal}.`;
      }

      const plan = await generateActionPlan(visionPrompt || "Retire abroad", financialContext);
      
      // Save to DB
      for (const m of plan) {
          await saveActionTasks(m.tasks, m.year);
      }
      
      setMilestones(plan);
      setLoading(false);
  };

  const toggleTask = async (task: ActionTask) => {
    const newState = !task.isCompleted;
    await updateTaskStatus(task.id, newState);
    // Optimistic update
    setMilestones(prev => prev.map(m => ({
        ...m,
        tasks: m.tasks.map(t => t.id === task.id ? {...t, isCompleted: newState} : t)
    })));
  };

  /* --- ACTIVE INTEGRATIONS (Deep Links) --- */

  const addToCalendar = (task: ActionTask) => {
    const title = encodeURIComponent(task.title);
    const details = encodeURIComponent(`Visionary Task: ${task.description}`);
    const dateStr = task.dueDate ? task.dueDate.replace(/-|:|\.\d\d\d/g, "") : new Date().toISOString().replace(/-|:|\.\d\d\d/g, ""); 
    const dates = `${dateStr}/${dateStr}`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;
    window.open(url, '_blank');
  };

  const draftEmail = (task: ActionTask) => {
    const subject = encodeURIComponent(`Action Item: ${task.title}`);
    const body = encodeURIComponent(`I am working on my retirement vision: ${visionPrompt}.\n\nI need to execute this task: ${task.description}.\n\nCan you assist?`);
    const url = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
    window.open(url, '_blank');
  };

  const searchMap = () => {
    const locationMatch = visionPrompt.match(/in ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/);
    const query = locationMatch ? locationMatch[0] : visionPrompt;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="relative">
           <div className="w-20 h-20 bg-navy-900 rounded-full flex items-center justify-center animate-bounce mb-6 z-10 relative">
             <RobotIcon className="w-10 h-10 text-gold-500" />
           </div>
           <div className="absolute inset-0 bg-gold-400 rounded-full animate-ping opacity-20"></div>
        </div>
        <h2 className="text-2xl font-serif font-bold text-navy-900 mb-2">Agent Active</h2>
        <p className="text-gray-500 max-w-md text-center">
          Searching real-time market data...<br/>
          Identifying housing costs...<br/>
          Building your execution roadmap...
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
                    <div className="mt-2 bg-blue-50 border border-blue-100 text-blue-800 text-xs px-3 py-2 rounded-lg flex items-start gap-2">
                       <SparklesIcon className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                       <div>
                         <span className="font-bold text-blue-900 uppercase text-[10px] tracking-wide block mb-1">Market Insight</span>
                         <p className="font-medium">{ms.marketResearchSnippet}</p>
                       </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 pl-4">
                {ms.tasks?.map((task) => (
                  <div key={task.id} className={`flex items-start justify-between p-3 rounded-lg border transition-all group ${task.isCompleted ? 'bg-gray-50 border-gray-100 opacity-75' : 'bg-white border-gray-200 hover:shadow-md hover:border-gold-300'}`}>
                    <div className="flex items-start gap-3 flex-1">
                      <button 
                        onClick={() => toggleTask(task)}
                        className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-colors ${task.isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-gold-500'}`}
                      >
                         {task.isCompleted && <CheckCircleIcon className="w-4 h-4" />}
                      </button>
                      <div>
                        <p className={`font-medium text-sm ${task.isCompleted ? 'line-through text-gray-400' : 'text-navy-900'}`}>{task.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
                      </div>
                    </div>
                    
                    {/* ACTION BUTTONS */}
                    <div className="flex gap-2 ml-4">
                      {/* Suggested Tool Highlight */}
                      {task.aiMetadata?.suggestedTool === 'GMAIL' && (
                         <button onClick={() => draftEmail(task)} className="bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-full transition-colors" title="Draft Email">
                            <MailIcon className="w-4 h-4" />
                         </button>
                      )}
                      {task.aiMetadata?.suggestedTool === 'MAPS' && (
                         <button onClick={searchMap} className="bg-blue-50 hover:bg-blue-100 text-blue-600 p-2 rounded-full transition-colors" title="Open Maps">
                            <MapIcon className="w-4 h-4" />
                         </button>
                      )}
                      
                      {/* Default Actions if no specific suggestion or fallback */}
                      {!task.aiMetadata?.suggestedTool && (
                        <>
                           <button onClick={() => draftEmail(task)} className="text-gray-300 hover:text-red-500 p-1" title="Email"><MailIcon className="w-4 h-4" /></button>
                           <button onClick={() => addToCalendar(task)} className="text-gray-300 hover:text-green-500 p-1" title="Calendar"><CalendarIcon className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Status */}
        <div className="space-y-6">
           <div className="bg-navy-900 text-white p-6 rounded-2xl shadow-xl">
              <h3 className="font-serif font-bold text-lg mb-4">Live Agent Status</h3>
              <ul className="space-y-4 text-sm">
                <li className="flex items-center gap-2 text-green-400">
                  <CheckCircleIcon className="w-5 h-5" />
                  <span>Vision & Finance Synced</span>
                </li>
                <li className="flex items-center gap-2 text-green-400">
                  <CheckCircleIcon className="w-5 h-5" />
                  <span>Market Data Grounded</span>
                </li>
                <li className="flex items-center gap-2 text-gold-400">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-gold-500"></span>
                  </span>
                  <span>Tasks Persisted to Database</span>
                </li>
              </ul>
              
              <div className="mt-6 pt-6 border-t border-navy-700">
                <h4 className="font-bold text-gold-500 mb-2">Active Tools</h4>
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={searchMap} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors">
                     <MapIcon className="w-3 h-3" /> Maps Research
                   </button>
                   <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors opacity-50 cursor-not-allowed" title="Requires Plaid">
                     <span className="w-3 h-3 border border-white rounded-sm"></span> Bank Sync
                   </button>
                </div>
              </div>
           </div>

           <button 
             onClick={() => {
               // Clear plan logic could go here
               onBack();
             }}
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
