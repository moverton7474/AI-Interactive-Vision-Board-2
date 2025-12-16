import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

interface UserWithCredits {
  id: string;
  email: string;
  credits: number;
  subscription_tier: string;
  subscription_status: string;
  created_at: string;
  full_name?: string;
}

interface CreditTransaction {
  id: string;
  created_at: string;
  user_id: string;
  amount: number;
  description: string;
  metadata?: any;
}

/**
 * CreditManager - Admin component for managing user credits
 *
 * Features:
 * - View all users with their credit balances
 * - Search and filter users
 * - Add or deduct credits with reason
 * - View credit transaction history
 */
const CreditManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithCredits[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithCredits[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithCredits | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Credit adjustment modal state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // Stats
  const [totalCredits, setTotalCredits] = useState(0);
  const [avgCredits, setAvgCredits] = useState(0);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    // Filter users based on search term
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredUsers(users.filter(u =>
        (u.email || '').toLowerCase().includes(term) ||
        (u.full_name || '').toLowerCase().includes(term) ||
        (u.subscription_tier || '').toLowerCase().includes(term)
      ));
    }
  }, [searchTerm, users]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Fetch all users with their credit info from profiles
      // Note: RLS policy "Platform admins can view all profiles" must be applied for this to work
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, credits, subscription_tier, subscription_status, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error.message, error.details, error.hint);
        // If RLS blocks the query, we'll get an error or empty results
        // Show helpful message to admin
        if (error.code === 'PGRST301' || error.message.includes('permission')) {
          console.warn('RLS policy may not be applied. Run the admin credit management SQL migration.');
        }
        throw error;
      }

      // Map data to ensure all fields have defaults
      const usersData: UserWithCredits[] = (data || []).map(u => ({
        id: u.id,
        email: u.email || 'Unknown',
        credits: u.credits ?? 0,
        subscription_tier: u.subscription_tier || 'FREE',
        subscription_status: u.subscription_status || 'inactive',
        created_at: u.created_at,
        full_name: undefined // Will be populated if available
      }));

      setUsers(usersData);
      setFilteredUsers(usersData);

      // Calculate stats
      const total = usersData.reduce((sum, u) => sum + (u.credits || 0), 0);
      setTotalCredits(total);
      setAvgCredits(usersData.length > 0 ? Math.round(total / usersData.length) : 0);
    } catch (err: any) {
      console.error('Error loading users:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserTransactions = async (userId: string) => {
    setLoadingTransactions(true);
    try {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Error loading transactions:', err);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleSelectUser = (user: UserWithCredits) => {
    setSelectedUser(user);
    loadUserTransactions(user.id);
  };

  const handleAdjustCredits = async () => {
    if (!selectedUser || adjustAmount === 0 || !adjustReason.trim()) return;

    setAdjusting(true);
    try {
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      if (!adminUser) throw new Error('Not authenticated');

      // Calculate new credit balance
      const newCredits = Math.max(0, selectedUser.credits + adjustAmount);

      // Update user's credits
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ credits: newCredits })
        .eq('id', selectedUser.id);

      if (updateError) throw updateError;

      // Log the transaction
      const { error: logError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: selectedUser.id,
          amount: adjustAmount,
          description: adjustReason,
          metadata: {
            adjusted_by: adminUser.id,
            admin_email: adminUser.email,
            previous_balance: selectedUser.credits,
            new_balance: newCredits,
            type: 'admin_adjustment'
          }
        });

      if (logError) {
        console.warn('Failed to log transaction:', logError);
        // Don't throw - the adjustment succeeded
      }

      // Update local state
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, credits: newCredits } : u
      ));
      setSelectedUser(prev => prev ? { ...prev, credits: newCredits } : null);

      // Refresh transactions
      loadUserTransactions(selectedUser.id);

      // Close modal and reset
      setShowAdjustModal(false);
      setAdjustAmount(0);
      setAdjustReason('');

      // Update stats
      const newTotal = totalCredits + adjustAmount;
      setTotalCredits(newTotal);
      setAvgCredits(users.length > 0 ? Math.round(newTotal / users.length) : 0);

    } catch (err) {
      console.error('Error adjusting credits:', err);
      alert('Failed to adjust credits. Please try again.');
    } finally {
      setAdjusting(false);
    }
  };

  const getTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      'FREE': 'bg-gray-500/20 text-gray-300',
      'PRO': 'bg-blue-500/20 text-blue-300',
      'ELITE': 'bg-purple-500/20 text-purple-300'
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${colors[tier] || colors['FREE']}`}>
        {tier || 'FREE'}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'active': 'bg-green-500/20 text-green-300',
      'inactive': 'bg-gray-500/20 text-gray-300',
      'cancelled': 'bg-red-500/20 text-red-300'
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${colors[status] || colors['inactive']}`}>
        {status || 'inactive'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-indigo-200">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <p className="text-indigo-200 text-sm mb-1">Total Users</p>
          <p className="text-3xl font-bold text-white">{users.length}</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <p className="text-indigo-200 text-sm mb-1">Total Credits</p>
          <p className="text-3xl font-bold text-white">{totalCredits.toLocaleString()}</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <p className="text-indigo-200 text-sm mb-1">Avg Credits/User</p>
          <p className="text-3xl font-bold text-white">{avgCredits}</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <p className="text-indigo-200 text-sm mb-1">PRO/ELITE Users</p>
          <p className="text-3xl font-bold text-white">
            {users.filter(u => u.subscription_tier === 'PRO' || u.subscription_tier === 'ELITE').length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User List */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white mb-3">User Credits</h3>
            <input
              type="text"
              placeholder="Search by email, name, or tier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-indigo-200">
                {searchTerm ? 'No users match your search' : 'No users found'}
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className={`p-4 cursor-pointer hover:bg-white/5 transition-colors ${
                      selectedUser?.id === user.id ? 'bg-white/10' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {user.full_name || user.email.split('@')[0]}
                        </p>
                        <p className="text-sm text-indigo-200 truncate">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        {getTierBadge(user.subscription_tier)}
                        <div className="text-right">
                          <p className="text-xl font-bold text-white">{user.credits}</p>
                          <p className="text-xs text-indigo-300">credits</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* User Detail / Transaction History */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
          {selectedUser ? (
            <>
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">User Details</h3>
                  <button
                    onClick={() => setShowAdjustModal(true)}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors text-sm"
                  >
                    Adjust Credits
                  </button>
                </div>

                <div className="bg-white/5 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-indigo-200">Email:</span>
                    <span className="text-white">{selectedUser.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-indigo-200">Name:</span>
                    <span className="text-white">{selectedUser.full_name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-indigo-200">Current Credits:</span>
                    <span className="text-2xl font-bold text-white">{selectedUser.credits}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-indigo-200">Subscription:</span>
                    <div className="flex gap-2">
                      {getTierBadge(selectedUser.subscription_tier)}
                      {getStatusBadge(selectedUser.subscription_status)}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-indigo-200">Joined:</span>
                    <span className="text-white">
                      {new Date(selectedUser.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction History */}
              <div className="p-4">
                <h4 className="text-md font-semibold text-white mb-3">Transaction History</h4>

                {loadingTransactions ? (
                  <div className="text-center py-6">
                    <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : transactions.length === 0 ? (
                  <p className="text-indigo-200 text-center py-6">No transactions found</p>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="text-sm text-white">{tx.description}</p>
                          <p className="text-xs text-indigo-300">
                            {new Date(tx.created_at).toLocaleString()}
                          </p>
                        </div>
                        <span className={`text-lg font-bold ${
                          tx.amount >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[400px] text-indigo-200">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p>Select a user to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Adjust Credits Modal */}
      {showAdjustModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-purple-900 rounded-xl p-6 max-w-md w-full border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Adjust Credits</h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-3 bg-white/5 rounded-lg">
              <p className="text-indigo-200 text-sm">User: {selectedUser.email}</p>
              <p className="text-white text-lg">Current Balance: <strong>{selectedUser.credits}</strong> credits</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-indigo-200 mb-2">
                  Amount (positive to add, negative to deduct)
                </label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., 10 or -5"
                />
                <p className="mt-1 text-sm text-indigo-300">
                  New balance will be: <strong>{Math.max(0, selectedUser.credits + adjustAmount)}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-indigo-200 mb-2">
                  Reason (required)
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., Bonus credits, Refund, etc."
                />
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setAdjustAmount(10)}
                  className="px-3 py-1 bg-green-500/20 text-green-300 rounded-lg text-sm hover:bg-green-500/30"
                >
                  +10
                </button>
                <button
                  onClick={() => setAdjustAmount(50)}
                  className="px-3 py-1 bg-green-500/20 text-green-300 rounded-lg text-sm hover:bg-green-500/30"
                >
                  +50
                </button>
                <button
                  onClick={() => setAdjustAmount(100)}
                  className="px-3 py-1 bg-green-500/20 text-green-300 rounded-lg text-sm hover:bg-green-500/30"
                >
                  +100
                </button>
                <button
                  onClick={() => setAdjustAmount(-1)}
                  className="px-3 py-1 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30"
                >
                  -1
                </button>
                <button
                  onClick={() => setAdjustAmount(-5)}
                  className="px-3 py-1 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30"
                >
                  -5
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustCredits}
                  disabled={adjusting || adjustAmount === 0 || !adjustReason.trim()}
                  className="flex-1 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  {adjusting ? 'Saving...' : 'Apply Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditManager;
