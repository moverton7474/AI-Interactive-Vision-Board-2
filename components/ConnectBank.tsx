
import React, { useCallback, useState, useEffect } from 'react';
import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from 'react-plaid-link';
import { supabase } from '../lib/supabase';
import { BankIcon, LockIcon, CheckCircleIcon, RobotIcon } from './Icons';

interface Props {
  onConnect: (accountData: any) => void;
}

const ConnectBank: React.FC<Props> = ({ onConnect }) => {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulatedAccount, setSimulatedAccount] = useState<any>(null);

  // Fetch Link Token from Backend (Supabase Edge Function)
  const generateToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-link-token');
      if (error) throw error;
      setLinkToken(data.link_token);
    } catch (e: any) {
      console.log("Backend not ready/reachable for token generation.", e.message);
      // In a real app, we would show an error. 
      // For this demo, we just log it and allow the Simulation Mode to take over.
    }
  };

  useEffect(() => {
    generateToken();
  }, []);

  // Plaid Success Handler
  const onSuccess = useCallback<PlaidLinkOnSuccess>(async (public_token, metadata) => {
    try {
      // Exchange public_token for access_token on backend
      const { error } = await supabase.functions.invoke('exchange-public-token', {
        body: { public_token, metadata }
      });
      
      if (error) throw error;
      
      setConnected(true);
      onConnect({
        id: metadata.institution?.institution_id,
        name: metadata.institution?.name,
        accounts: metadata.accounts,
        balance: 12500 // Mocked balance as Plaid Link doesn't return balance immediately without backend call
      });
    } catch (err) {
      console.error("Token exchange failed", err);
      setError("Failed to link account securely.");
    }
  }, [onConnect]);

  const config: PlaidLinkOptions = {
    token: linkToken,
    onSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  const handleSimulate = () => {
    // Mock data for visual demonstration
    const mockData = {
      id: 'ins_109',
      name: 'Chase Bank',
      type: 'depository',
      balance: 15420.50,
      accounts: [
        { name: 'Total Checking', mask: '1122', subtype: 'checking' },
        { name: 'Premier Savings', mask: '3344', subtype: 'savings' }
      ]
    };
    setSimulatedAccount(mockData);
    setConnected(true);
    onConnect(mockData);
  };

  if (connected) {
    return (
      <div className="bg-white p-6 rounded-xl border border-green-200 bg-green-50/50 flex flex-col gap-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-full text-green-600">
            <BankIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-navy-900">
              {simulatedAccount ? simulatedAccount.name : "Bank Account"} Connected
            </h3>
            <p className="text-xs text-green-700 flex items-center gap-1">
              <CheckCircleIcon className="w-3 h-3" /> Secure connection active
            </p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-green-100 shadow-sm">
           <div className="flex justify-between items-end mb-2">
             <span className="text-sm text-gray-500">Total Balance</span>
             <span className="text-xl font-bold text-navy-900">
               ${(simulatedAccount?.balance || 0).toLocaleString()}
             </span>
           </div>
           <div className="space-y-2">
             {simulatedAccount?.accounts?.map((acc: any, i: number) => (
               <div key={i} className="flex justify-between text-xs text-gray-600 border-b border-gray-50 last:border-0 pb-1 last:pb-0">
                 <span>{acc.name} (...{acc.mask})</span>
                 <span className="capitalize bg-gray-100 px-1.5 rounded text-[10px]">{acc.subtype}</span>
               </div>
             ))}
           </div>
        </div>
        
        <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-white/50 p-2 rounded">
           <RobotIcon className="w-3 h-3 text-gold-500" />
           AI Agent is now monitoring this balance for surplus optimization.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-navy-900 text-white p-6 rounded-xl shadow-lg flex flex-col items-center text-center relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gold-400 to-gold-600"></div>
      
      <div className="mb-4 p-3 bg-white/10 rounded-full backdrop-blur-sm">
        <BankIcon className="w-8 h-8 text-gold-400" />
      </div>
      
      <h3 className="text-lg font-bold mb-2">Connect Your Finances</h3>
      <p className="text-sm text-gray-300 mb-6 max-w-xs">
        Link your primary accounts securely to let the AI Agent analyze surplus and automate your vision.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {/* Real Button (Only works if Token is fetched) */}
        <button
          onClick={() => open()}
          disabled={!ready}
          className="w-full bg-gold-500 hover:bg-gold-600 text-navy-900 font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LockIcon className="w-4 h-4" />
          {linkToken ? 'Connect via Plaid' : 'Initialize Secure Link...'}
        </button>

        {/* Simulation Button (Fallback) */}
        {!linkToken && (
          <button 
            onClick={handleSimulate}
            className="w-full border border-gray-600 hover:bg-white/5 text-gray-300 text-xs py-2 rounded-lg transition-colors"
          >
            Simulate Connection (Demo)
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[10px] text-gray-500">
        <LockIcon className="w-3 h-3" />
        <span>AES-256 Encrypted • SOC2 Compliant</span>
      </div>
    </div>
  );
};

export default ConnectBank;
