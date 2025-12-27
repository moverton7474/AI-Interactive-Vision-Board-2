
import React, { useCallback, useState, useEffect } from 'react';
import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from 'react-plaid-link';
import { BankIcon, LockIcon, CheckCircleIcon, RobotIcon, ExclamationCircleIcon } from './Icons';
import {
  createLinkToken,
  exchangePublicToken,
  getAccountBalances,
  formatCurrency,
  PlaidBalanceResponse
} from '../services/plaidService';

interface Props {
  onConnect: (accountData: any) => void;
}

const ConnectBank: React.FC<Props> = ({ onConnect }) => {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [plaidEnv, setPlaidEnv] = useState<'sandbox' | 'development' | 'production'>('sandbox');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulatedAccount, setSimulatedAccount] = useState<any>(null);
  const [balanceData, setBalanceData] = useState<PlaidBalanceResponse | null>(null);

  // Fetch Link Token from Backend using plaidService
  const generateToken = async () => {
    try {
      setError(null);
      const result = await createLinkToken();
      setLinkToken(result.link_token);
      setPlaidEnv(result.plaid_env);
    } catch (e: any) {
      console.log("Backend not ready/reachable for token generation.", e.message);
      // In a real app, we would show an error.
      // For this demo, we allow the Simulation Mode to take over.
    }
  };

  useEffect(() => {
    generateToken();
  }, []);

  // Fetch real balances after connection
  const fetchBalances = async () => {
    try {
      const data = await getAccountBalances();
      setBalanceData(data);
      return data;
    } catch (e: any) {
      console.error('Failed to fetch balances:', e.message);
      // Balance fetch failed, but connection succeeded - don't block
      return null;
    }
  };

  // Plaid Success Handler using plaidService with proper auth
  const onSuccess = useCallback<PlaidLinkOnSuccess>(async (public_token, metadata) => {
    try {
      setLoading(true);
      setError(null);

      // Exchange public_token for access_token using plaidService (includes auth)
      const result = await exchangePublicToken(public_token, metadata);

      if (!result.success) {
        throw new Error('Token exchange failed');
      }

      setConnected(true);

      // Fetch real balances after successful connection
      const balances = await fetchBalances();

      // Build account data with real balances if available
      const accountData = {
        id: metadata.institution?.institution_id,
        name: metadata.institution?.name,
        accounts: balances?.accounts || metadata.accounts?.map(acc => ({
          name: acc.name,
          mask: acc.mask,
          subtype: acc.subtype || acc.type
        })),
        balance: balances?.totals?.net_worth ??
                 (balances?.totals?.checking ?? 0) + (balances?.totals?.savings ?? 0),
        totals: balances?.totals || null
      };

      onConnect(accountData);
    } catch (err: any) {
      console.error("Token exchange failed", err);
      setError(err.message || "Failed to link account securely.");
      setConnected(false);
    } finally {
      setLoading(false);
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
      ],
      totals: {
        checking: 10420.50,
        savings: 5000.00,
        credit: 0,
        investment: 0,
        loan: 0,
        other: 0,
        net_worth: 15420.50
      }
    };
    setSimulatedAccount(mockData);
    setConnected(true);
    onConnect(mockData);
  };

  // Calculate total balance from real data or simulation
  const displayBalance = balanceData?.totals?.net_worth ??
                          balanceData?.totals?.checking ??
                          simulatedAccount?.balance ?? 0;

  const displayAccounts = balanceData?.accounts?.map(acc => ({
    name: acc.name,
    mask: acc.mask,
    subtype: acc.subtype
  })) || simulatedAccount?.accounts || [];

  if (connected) {
    return (
      <div className="bg-white p-6 rounded-xl border border-green-200 bg-green-50/50 flex flex-col gap-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-full text-green-600">
            <BankIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-navy-900">
              {simulatedAccount?.name || balanceData?.accounts?.[0]?.name || "Bank Account"} Connected
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
               {formatCurrency(displayBalance)}
             </span>
           </div>
           <div className="space-y-2">
             {displayAccounts.map((acc: any, i: number) => (
               <div key={i} className="flex justify-between text-xs text-gray-600 border-b border-gray-50 last:border-0 pb-1 last:pb-0">
                 <span>{acc.name} {acc.mask ? `(...${acc.mask})` : ''}</span>
                 <span className="capitalize bg-gray-100 px-1.5 rounded text-[10px]">{acc.subtype}</span>
               </div>
             ))}
           </div>
        </div>

        {/* Show balance breakdown if available */}
        {balanceData?.totals && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            {balanceData.totals.checking > 0 && (
              <div className="bg-blue-50 p-2 rounded text-center">
                <div className="font-medium text-blue-700">Checking</div>
                <div className="text-blue-900">{formatCurrency(balanceData.totals.checking)}</div>
              </div>
            )}
            {balanceData.totals.savings > 0 && (
              <div className="bg-green-50 p-2 rounded text-center">
                <div className="font-medium text-green-700">Savings</div>
                <div className="text-green-900">{formatCurrency(balanceData.totals.savings)}</div>
              </div>
            )}
            {balanceData.totals.investment > 0 && (
              <div className="bg-purple-50 p-2 rounded text-center">
                <div className="font-medium text-purple-700">Investment</div>
                <div className="text-purple-900">{formatCurrency(balanceData.totals.investment)}</div>
              </div>
            )}
          </div>
        )}

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
      <p className="text-sm text-gray-300 mb-4 max-w-xs">
        Link your primary accounts securely to let the AI Agent analyze surplus and automate your vision.
      </p>

      {/* Sandbox Mode Guidance */}
      {plaidEnv === 'sandbox' && linkToken && (
        <div className="w-full max-w-xs mb-4 p-3 bg-amber-900/30 border border-amber-500/50 rounded-lg text-left">
          <p className="text-amber-200 text-sm font-medium flex items-center gap-1">
            <span>🧪</span> Sandbox Mode
          </p>
          <p className="text-amber-300/80 text-xs mt-1">
            Use test phone: <code className="bg-amber-900/50 px-1.5 py-0.5 rounded font-mono">415-555-0010</code>
          </p>
          <p className="text-amber-300/80 text-xs mt-0.5">
            OTP code: <code className="bg-amber-900/50 px-1.5 py-0.5 rounded font-mono">123456</code>
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="w-full max-w-xs mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-start gap-2">
          <ExclamationCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-left">
            <p className="text-sm text-red-200">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs text-red-400 hover:text-red-300 mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {/* Real Button (Only works if Token is fetched) */}
        <button
          onClick={() => open()}
          disabled={!ready || loading}
          className="w-full bg-gold-500 hover:bg-gold-600 text-navy-900 font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-navy-900/30 border-t-navy-900 rounded-full animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <LockIcon className="w-4 h-4" />
              {linkToken ? 'Connect via Plaid' : 'Initialize Secure Link...'}
            </>
          )}
        </button>

        {/* Simulation Button (Fallback) */}
        {!linkToken && (
          <button
            onClick={handleSimulate}
            disabled={loading}
            className="w-full border border-gray-600 hover:bg-white/5 text-gray-300 text-xs py-2 rounded-lg transition-colors disabled:opacity-50"
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
