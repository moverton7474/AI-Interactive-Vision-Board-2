import { supabase } from '../lib/supabase';

export interface PlaidAccount {
  plaid_item_id: string;
  institution_id: string;
  account_id: string;
  name: string;
  official_name: string | null;
  type: 'depository' | 'credit' | 'investment' | 'loan' | 'brokerage' | 'other';
  subtype: string;
  mask: string | null;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
    iso_currency_code: string | null;
    unofficial_currency_code: string | null;
  };
}

export interface PlaidBalanceTotals {
  checking: number;
  savings: number;
  credit: number;
  investment: number;
  loan: number;
  other: number;
  net_worth: number;
}

export interface PlaidBalanceError {
  item_id: string;
  institution_id: string;
  error: string;
  error_code?: string;
}

export interface PlaidBalanceResponse {
  success: boolean;
  accounts: PlaidAccount[];
  totals: PlaidBalanceTotals;
  errors?: PlaidBalanceError[];
  fetched_at: string;
  message?: string;
}

/**
 * Response from createLinkToken including environment info
 */
export interface CreateLinkTokenResponse {
  link_token: string;
  plaid_env: 'sandbox' | 'development' | 'production';
}

/**
 * Create a Plaid Link token for connecting bank accounts
 * Returns link_token and plaid_env for sandbox detection
 */
export async function createLinkToken(): Promise<CreateLinkTokenResponse> {
  const { data, error } = await supabase.functions.invoke('create-link-token', {
    method: 'POST'
  });

  if (error) {
    console.error('Create link token error:', error);
    throw new Error(error.message || 'Failed to create link token');
  }

  if (!data?.link_token) {
    throw new Error('No link token returned');
  }

  return {
    link_token: data.link_token,
    plaid_env: data.plaid_env || 'sandbox'
  };
}

/**
 * Exchange a Plaid public token for an access token
 * Called after successful Plaid Link flow
 */
export async function exchangePublicToken(
  publicToken: string,
  metadata: { institution?: { institution_id?: string } }
): Promise<{ success: boolean; item_id: string }> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Authentication required');
  }

  const { data, error } = await supabase.functions.invoke('exchange-public-token', {
    method: 'POST',
    body: { public_token: publicToken, metadata },
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });

  if (error) {
    console.error('Exchange token error:', error);
    throw new Error(error.message || 'Failed to exchange token');
  }

  return data;
}

/**
 * Get account balances for all linked Plaid accounts
 */
export async function getAccountBalances(): Promise<PlaidBalanceResponse> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Authentication required');
  }

  const { data, error } = await supabase.functions.invoke('get-plaid-balances', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });

  if (error) {
    console.error('Get balances error:', error);
    throw new Error(error.message || 'Failed to get account balances');
  }

  return data;
}

/**
 * Format currency for display
 */
export function formatCurrency(
  amount: number | null,
  currencyCode: string | null = 'USD'
): string {
  if (amount === null) return '--';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Get display name for account type
 */
export function getAccountTypeLabel(type: string, subtype?: string): string {
  const labels: Record<string, string> = {
    'depository:checking': 'Checking',
    'depository:savings': 'Savings',
    'depository:money market': 'Money Market',
    'depository:cd': 'CD',
    'credit:credit card': 'Credit Card',
    'investment:401k': '401(k)',
    'investment:ira': 'IRA',
    'investment:roth': 'Roth IRA',
    'investment:brokerage': 'Brokerage',
    'loan:mortgage': 'Mortgage',
    'loan:student': 'Student Loan',
    'loan:auto': 'Auto Loan',
    'loan:personal': 'Personal Loan'
  };

  const key = subtype ? `${type}:${subtype}` : type;
  return labels[key] || subtype?.replace(/_/g, ' ') || type;
}

/**
 * Get icon for account type
 */
export function getAccountTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    'depository': '🏦',
    'credit': '💳',
    'investment': '📈',
    'loan': '🏠',
    'brokerage': '📊',
    'other': '💰'
  };
  return icons[type] || '💰';
}
