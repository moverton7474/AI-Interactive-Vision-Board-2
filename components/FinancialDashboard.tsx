import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FinancialGoal } from '../types';
import { generateFinancialProjection } from '../services/geminiService';
import { UploadIcon } from './Icons';

interface Props {
  onComplete: () => void;
}

const FinancialDashboard: React.FC<Props> = ({ onComplete }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [data, setData] = useState<FinancialGoal[]>([]);
  const [fileAttached, setFileAttached] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileAttached(e.target.files[0].name);
      setAnalyzing(true);
      // Simulate API delay and processing
      generateFinancialProjection("Retire in 3 years in Thailand with moderate savings").then(res => {
        setData(res);
        setAnalyzing(false);
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-serif font-bold text-navy-900">Financial Reality Check</h2>
        <p className="text-gray-600 max-w-xl mx-auto">
          Upload your current retirement plan (PDF or Spreadsheet) to see if you are on track for your Thailand dream.
        </p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        {!data.length ? (
          <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
            <UploadIcon className="w-16 h-16 text-gold-500 mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">Drag & Drop your financial plan</p>
            <p className="text-sm text-gray-400 mb-6">Supported formats: CSV, PDF, XLS</p>
            
            <label className="cursor-pointer bg-navy-900 hover:bg-navy-800 text-white px-6 py-3 rounded-full transition-colors font-medium">
              Upload Document
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
            {analyzing && <p className="mt-4 text-gold-600 font-medium animate-pulse">Analyzing with Gemini...</p>}
          </div>
        ) : (
          <div className="space-y-6">
             <div className="flex justify-between items-center mb-6">
                <div>
                   <h3 className="text-xl font-bold text-navy-900">Projected Growth: Thailand Goal</h3>
                   <p className="text-sm text-green-600 font-medium">Status: On Track for 2027</p>
                </div>
                <button 
                  onClick={() => setData([])}
                  className="text-sm text-gray-500 hover:text-navy-900 underline">
                  Reset Data
                </button>
             </div>
             
             <div className="h-[400px] w-full">
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
                   <Area type="monotone" dataKey="savings" stroke="#0f172a" fillOpacity={1} fill="url(#colorSavings)" name="Current Savings" />
                 </AreaChart>
               </ResponsiveContainer>
             </div>

             <div className="flex justify-end pt-4">
                <button 
                  onClick={onComplete}
                  className="bg-gold-500 hover:bg-gold-600 text-navy-900 font-bold px-8 py-3 rounded-full shadow-lg transition-transform transform hover:scale-105">
                  Proceed to Vision Board
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialDashboard;
