
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FinancialGoal, Document } from '../types';
import { generateFinancialProjection, parseFinancialChat } from '../services/geminiService';
import { saveDocument, getDocuments, deleteDocument } from '../services/storageService';
import { UploadIcon, ChartIcon, CloudArrowUpIcon, PenIcon, BrainIcon, BookOpenIcon, FileTextIcon, TrashIcon, EyeIcon, BankIcon } from './Icons';
import ConnectBank from './ConnectBank';

interface Props {
  onComplete: (data: FinancialGoal[]) => void;
}

const FinancialDashboard: React.FC<Props> = ({ onComplete }) => {
  const [activeTab, setActiveTab] = useState<'UPLOAD' | 'MANUAL' | 'AI' | 'ACCOUNTS'>('UPLOAD');
  const [analyzing, setAnalyzing] = useState(false);
  const [data, setData] = useState<FinancialGoal[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  
  // Bank Integration State
  const [linkedBankBalance, setLinkedBankBalance] = useState<number>(0);

  // Manual Form State
  const [manualForm, setManualForm] = useState({
    savings: 500000,
    monthly: 5000,
    goal: 2000000,
    year: 2027
  });

  // AI Chat State
  const [aiChatStep, setAiChatStep] = useState(0);
  const [aiChatHistory, setAiChatHistory] = useState<{sender: 'bot'|'user', text: string}[]>([
    {sender: 'bot', text: "Let's figure this out together. First, approximately how much have you saved for retirement so far?"}
  ]);
  const [aiInput, setAiInput] = useState('');

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    setLoadingDocs(true);
    const docs = await getDocuments();
    setDocuments(docs);
    setLoadingDocs(false);
  };

  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm("Delete this document?")) {
      await deleteDocument(id);
      loadDocs();
    }
  }

  const handleSelectDoc = async (doc: Document) => {
    // If it's a vision statement, we just alert for now, 
    // but typically you'd redirect to vision board or show a modal.
    if (doc.type === 'VISION') {
       alert(`Vision Statement:\n\n${doc.structuredData?.prompt || 'No prompt saved.'}`);
       return;
    }

    // Re-hydrate state from doc
    if (doc.structuredData && doc.structuredData.projection) {
       setData(doc.structuredData.projection);
    } else {
       // Re-analyze if needed
       setAnalyzing(true);
       const projection = await generateFinancialProjection(`Reloading plan: ${doc.name}`);
       setData(projection);
       setAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAnalyzing(true);
      
      // Simulate analysis
      const description = `Plan from file ${file.name}`;
      const projection = await generateFinancialProjection(description);
      
      // Save to Knowledge Base
      await saveDocument({
        name: file.name,
        type: 'UPLOAD',
        structuredData: { projection }
      }, file);

      setData(projection);
      setAnalyzing(false);
      loadDocs();
    }
  };

  const handleManualSubmit = async () => {
    setAnalyzing(true);
    // Incorporate linked bank balance if available
    const totalSavings = manualForm.savings + linkedBankBalance;
    
    const description = `Manual Plan: Savings $${totalSavings}, Monthly $${manualForm.monthly}, Goal $${manualForm.goal} by ${manualForm.year}`;
    const projection = await generateFinancialProjection(description);
    
    await saveDocument({
      name: `Manual Plan (${new Date().toLocaleDateString()})`,
      type: 'MANUAL',
      structuredData: { ...manualForm, savings: totalSavings, projection }
    });

    setData(projection);
    setAnalyzing(false);
    loadDocs();
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;

    const newHistory = [...aiChatHistory, {sender: 'user' as const, text: aiInput}];
    setAiChatHistory(newHistory);
    setAiInput('');

    // Simple Linear Conversation Logic
    if (aiChatStep === 0) {
      setTimeout(() => setAiChatHistory(h => [...h, {sender: 'bot', text: "Great. And how much can you contribute monthly?"}]), 600);
      setAiChatStep(1);
    } else if (aiChatStep === 1) {
      setTimeout(() => setAiChatHistory(h => [...h, {sender: 'bot', text: "Understood. Finally, what is your 'Financial Freedom Number' (Total Goal)?"}]), 600);
      setAiChatStep(2);
    } else if (aiChatStep === 2) {
      setAnalyzing(true);
      const fullText = newHistory.map(h => h.text).join('\n');
      const parsed = await parseFinancialChat(fullText);
      
      // Incorporate linked balance
      if (linkedBankBalance > 0) {
         parsed.currentSavings = (parsed.currentSavings || 0) + linkedBankBalance;
      }

      const description = `AI Interview: Savings ${parsed.currentSavings}, Goal ${parsed.targetGoal}`;
      const projection = await generateFinancialProjection(description);
      
      await saveDocument({
        name: `AI Interview (${new Date().toLocaleDateString()})`,
        type: 'AI_INTERVIEW',
        structuredData: { ...parsed, projection }
      });

      setData(projection);
      setAnalyzing(false);
      loadDocs();
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 animate-fade-in h-[80vh]">
      
      {/* Sidebar: Knowledge Base */}
      <div className="w-full lg:w-1/4 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col overflow-hidden">
        <div className="p-4 bg-navy-900 text-white flex items-center gap-2">
           <BookOpenIcon className="w-5 h-5 text-gold-500" />
           <h3 className="font-serif font-bold">Knowledge Base</h3>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
           <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider mb-2">Saved Documents</p>
           {loadingDocs ? (
             <div className="flex justify-center p-4"><div className="w-4 h-4 border-2 border-navy-900 rounded-full animate-spin"></div></div>
           ) : documents.length === 0 ? (
             <div className="text-center p-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
               <p className="text-xs text-gray-500">No documents yet.<br/>Upload or create one.</p>
             </div>
           ) : (
             documents.map(doc => (
               <div key={doc.id} onClick={() => handleSelectDoc(doc)} className="group flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gold-400 hover:bg-gold-50 cursor-pointer transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                     {doc.type === 'UPLOAD' && <FileTextIcon className="w-4 h-4 text-blue-500 shrink-0" />}
                     {doc.type === 'MANUAL' && <PenIcon className="w-4 h-4 text-green-500 shrink-0" />}
                     {doc.type === 'AI_INTERVIEW' && <BrainIcon className="w-4 h-4 text-purple-500 shrink-0" />}
                     {doc.type === 'VISION' && <EyeIcon className="w-4 h-4 text-gold-500 shrink-0" />}
                     <span className="text-sm text-gray-700 truncate font-medium">{doc.name}</span>
                  </div>
                  <button onClick={(e) => handleDeleteDoc(doc.id, e)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <TrashIcon className="w-3 h-3" />
                  </button>
               </div>
             ))
           )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white rounded-2xl shadow-xl border border-gray-100 flex flex-col">
        
        {/* Header/Tabs */}
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
           <div>
              <h2 className="text-2xl font-serif font-bold text-navy-900">Financial Reality Check</h2>
              <p className="text-sm text-gray-500">Analyze your path to freedom</p>
           </div>
           
           <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto">
              <button 
                onClick={() => setActiveTab('UPLOAD')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'UPLOAD' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-navy-900'}`}
              >
                 <span className="flex items-center gap-2"><CloudArrowUpIcon className="w-4 h-4" /> Upload</span>
              </button>
              <button 
                onClick={() => setActiveTab('MANUAL')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'MANUAL' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-navy-900'}`}
              >
                 <span className="flex items-center gap-2"><PenIcon className="w-4 h-4" /> Manual</span>
              </button>
              <button 
                onClick={() => setActiveTab('AI')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'AI' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-navy-900'}`}
              >
                 <span className="flex items-center gap-2"><BrainIcon className="w-4 h-4" /> AI Agent</span>
              </button>
              <button 
                onClick={() => setActiveTab('ACCOUNTS')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'ACCOUNTS' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-navy-900'}`}
              >
                 <span className="flex items-center gap-2"><BankIcon className="w-4 h-4" /> Accounts</span>
              </button>
           </div>
        </div>

        {/* Content Area */}
        <div className="p-8 flex-1 overflow-y-auto">
           {data.length > 0 ? (
             // RESULT VIEW
             <div className="space-y-6 h-full flex flex-col">
                <div className="flex justify-between items-center">
                   <h3 className="text-lg font-bold text-navy-900">Analysis Results</h3>
                   <button onClick={() => setData([])} className="text-sm text-gray-500 hover:text-navy-900 underline">Start Over</button>
                </div>
                
                <div className="flex-1 min-h-[300px]">
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                       <defs>
                         <linearGradient id="colorGoal" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#EAB308" stopOpacity={0.8}/>
                           <stop offset="95%" stopColor="#EAB308" stopOpacity={0}/>
                         </linearGradient>
                         <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#0f172a" stopOpacity={0.8}/>
                           <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                         </linearGradient>
                       </defs>
                       <XAxis dataKey="year" />
                       <YAxis />
                       <CartesianGrid strokeDasharray="3 3" vertical={false} />
                       <Tooltip />
                       <Area type="monotone" dataKey="goal" stroke="#EAB308" fillOpacity={1} fill="url(#colorGoal)" name="Goal Target" />
                       <Area type="monotone" dataKey="savings" stroke="#0f172a" fillOpacity={1} fill="url(#colorSavings)" name="Projected Savings" />
                     </AreaChart>
                   </ResponsiveContainer>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                   <button 
                     onClick={() => onComplete(data)}
                     className="bg-gold-500 hover:bg-gold-600 text-navy-900 font-bold px-8 py-3 rounded-full shadow-lg transition-transform transform hover:scale-105">
                     Proceed to Vision Board
                   </button>
                </div>
             </div>
           ) : (
             // INPUT VIEWS
             <div className="h-full flex flex-col justify-center max-w-2xl mx-auto w-full">
                
                {analyzing ? (
                   <div className="text-center">
                      <div className="w-16 h-16 border-4 border-gray-200 border-t-gold-500 rounded-full animate-spin mx-auto mb-4"></div>
                      <h3 className="text-xl font-bold text-navy-900">Crunching Numbers...</h3>
                      <p className="text-gray-500">Visionary is analyzing your trajectory.</p>
                   </div>
                ) : (
                   <>
                      {activeTab === 'UPLOAD' && (
                         <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                            <UploadIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-lg font-medium text-gray-700 mb-2">Upload Plan</p>
                            <p className="text-sm text-gray-400 mb-6">PDF, XLSX, CSV supported</p>
                            <label className="cursor-pointer bg-navy-900 text-white px-6 py-3 rounded-full font-medium hover:bg-navy-800 transition-colors">
                               Choose File
                               <input type="file" className="hidden" onChange={handleFileUpload} />
                            </label>
                         </div>
                      )}

                      {activeTab === 'MANUAL' && (
                         <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-4">
                            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 p-3 rounded-lg text-blue-800 text-sm mb-2">
                               <BankIcon className="w-4 h-4" />
                               <span className="font-bold">Connected Balance:</span> 
                               <span>${linkedBankBalance.toLocaleString()}</span>
                            </div>
                            <div>
                               <label className="block text-sm font-medium text-gray-700 mb-1">Additional Savings</label>
                               <input type="number" className="w-full p-2 border rounded-lg" value={manualForm.savings} onChange={e => setManualForm({...manualForm, savings: +e.target.value})} />
                            </div>
                            <div>
                               <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Contribution</label>
                               <input type="number" className="w-full p-2 border rounded-lg" value={manualForm.monthly} onChange={e => setManualForm({...manualForm, monthly: +e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                               <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Goal Amount</label>
                                  <input type="number" className="w-full p-2 border rounded-lg" value={manualForm.goal} onChange={e => setManualForm({...manualForm, goal: +e.target.value})} />
                               </div>
                               <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Year</label>
                                  <input type="number" className="w-full p-2 border rounded-lg" value={manualForm.year} onChange={e => setManualForm({...manualForm, year: +e.target.value})} />
                               </div>
                            </div>
                            <button onClick={handleManualSubmit} className="w-full bg-navy-900 text-white py-3 rounded-lg font-medium hover:bg-navy-800 mt-4">Generate Projection</button>
                         </div>
                      )}

                      {activeTab === 'AI' && (
                         <div className="flex flex-col h-[400px] bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                               {aiChatHistory.map((m, i) => (
                                  <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                     <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.sender === 'user' ? 'bg-navy-900 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                                        {m.text}
                                     </div>
                                  </div>
                               ))}
                            </div>
                            <form onSubmit={handleAiSubmit} className="p-3 bg-white border-t border-gray-200 flex gap-2">
                               <input 
                                 type="text" 
                                 placeholder="Type your answer..." 
                                 className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm outline-none focus:border-gold-500"
                                 value={aiInput}
                                 onChange={e => setAiInput(e.target.value)}
                               />
                               <button type="submit" className="bg-gold-500 text-navy-900 px-4 py-2 rounded-full font-bold text-sm">Send</button>
                            </form>
                         </div>
                      )}

                      {activeTab === 'ACCOUNTS' && (
                         <div className="flex flex-col items-center justify-center">
                            <div className="w-full max-w-md">
                               <ConnectBank onConnect={(data) => {
                                  setLinkedBankBalance(data.balance);
                                  alert(`Successfully connected ${data.name}! Balance: $${data.balance.toLocaleString()} has been added to your plan.`);
                               }} />
                            </div>
                         </div>
                      )}
                   </>
                )}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;
