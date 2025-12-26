import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BookOpenIcon,
  ChartBarIcon,
  TruckIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon
} from '../Icons';

interface WorkbookOrder {
  id: string;
  user_id: string;
  status: string;
  title: string;
  theme_pack?: string;
  total_price: number;
  created_at: string;
  submitted_at?: string;
  prodigi_order_id?: string;
  user_email?: string;
}

interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  submittedOrders: number;
  completedOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  ordersByTheme: Record<string, number>;
  ordersByStatus: Record<string, number>;
}

/**
 * PrintProductsAnalytics - Admin dashboard for workbook orders and print products
 *
 * Displays:
 * - Order statistics and revenue metrics
 * - Order status breakdown (draft, generating, submitted, shipped, completed)
 * - Theme pack popularity
 * - Recent orders list with status
 */
const PrintProductsAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<WorkbookOrder[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Calculate date filter
      let dateFilter: Date | null = null;
      if (dateRange !== 'all') {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - days);
      }

      // Fetch orders with optional date filter
      let query = supabase
        .from('workbook_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (dateFilter) {
        query = query.gte('created_at', dateFilter.toISOString());
      }

      const { data: ordersData, error } = await query;

      if (error) throw error;

      // Calculate statistics
      const orders = ordersData || [];
      const orderStats: OrderStats = {
        totalOrders: orders.length,
        pendingOrders: orders.filter(o => o.status === 'draft' || o.status === 'generating').length,
        submittedOrders: orders.filter(o => o.status === 'submitted' || o.status === 'printing').length,
        completedOrders: orders.filter(o => o.status === 'shipped' || o.status === 'completed').length,
        totalRevenue: orders.reduce((sum, o) => sum + (o.total_price || 0), 0),
        avgOrderValue: orders.length > 0
          ? orders.reduce((sum, o) => sum + (o.total_price || 0), 0) / orders.length
          : 0,
        ordersByTheme: {},
        ordersByStatus: {}
      };

      // Count by theme
      orders.forEach(order => {
        const theme = order.theme_pack || order.customization_data?.theme_pack || 'executive';
        orderStats.ordersByTheme[theme] = (orderStats.ordersByTheme[theme] || 0) + 1;
        orderStats.ordersByStatus[order.status] = (orderStats.ordersByStatus[order.status] || 0) + 1;
      });

      setOrders(orders);
      setStats(orderStats);
    } catch (error) {
      console.error('Failed to load print products data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500';
      case 'generating': return 'bg-yellow-500';
      case 'printing':
      case 'submitted': return 'bg-blue-500';
      case 'shipped': return 'bg-purple-500';
      case 'completed': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <ClockIcon className="w-4 h-4" />;
      case 'generating': return <ClockIcon className="w-4 h-4 animate-spin" />;
      case 'printing':
      case 'submitted': return <BookOpenIcon className="w-4 h-4" />;
      case 'shipped': return <TruckIcon className="w-4 h-4" />;
      case 'completed': return <CheckCircleIcon className="w-4 h-4" />;
      case 'error': return <ExclamationCircleIcon className="w-4 h-4" />;
      default: return <ClockIcon className="w-4 h-4" />;
    }
  };

  const themeColors: Record<string, string> = {
    executive: 'bg-navy-700',
    faith: 'bg-purple-600',
    retirement: 'bg-teal-600',
    health: 'bg-green-600',
    entrepreneur: 'bg-orange-500',
    relationship: 'bg-rose-500'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Filter */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Print Products Analytics</h2>
          <p className="text-indigo-200 text-sm mt-1">Workbook orders and revenue metrics</p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d', 'all'] as const).map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                dateRange === range
                  ? 'bg-white text-purple-900'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {range === 'all' ? 'All Time' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <BookOpenIcon className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{stats.totalOrders}</p>
            <p className="text-indigo-200 text-sm">Total Orders</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <ClockIcon className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{stats.pendingOrders}</p>
            <p className="text-indigo-200 text-sm">Pending</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">${stats.totalRevenue.toLocaleString()}</p>
            <p className="text-indigo-200 text-sm">Total Revenue</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <TruckIcon className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">${stats.avgOrderValue.toFixed(2)}</p>
            <p className="text-indigo-200 text-sm">Avg Order Value</p>
          </div>
        </div>
      )}

      {/* Theme Popularity & Status Breakdown */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Theme Breakdown */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4">Orders by Theme Pack</h3>
            <div className="space-y-3">
              {Object.entries(stats.ordersByTheme)
                .sort((a, b) => b[1] - a[1])
                .map(([theme, count]) => (
                  <div key={theme} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${themeColors[theme] || 'bg-gray-500'}`} />
                    <span className="text-white capitalize flex-1">{theme}</span>
                    <span className="text-indigo-200 font-medium">{count}</span>
                    <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${themeColors[theme] || 'bg-gray-500'}`}
                        style={{ width: `${(count / stats.totalOrders) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4">Orders by Status</h3>
            <div className="space-y-3">
              {Object.entries(stats.ordersByStatus)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3">
                    <div className={`p-1 rounded ${getStatusColor(status)}`}>
                      {getStatusIcon(status)}
                    </div>
                    <span className="text-white capitalize flex-1">{status}</span>
                    <span className="text-indigo-200 font-medium">{count}</span>
                    <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getStatusColor(status)}`}
                        style={{ width: `${(count / stats.totalOrders) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Orders Table */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Recent Orders</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left px-4 py-3 text-indigo-200 font-medium text-sm">Order ID</th>
                <th className="text-left px-4 py-3 text-indigo-200 font-medium text-sm">Title</th>
                <th className="text-left px-4 py-3 text-indigo-200 font-medium text-sm">Theme</th>
                <th className="text-left px-4 py-3 text-indigo-200 font-medium text-sm">Status</th>
                <th className="text-right px-4 py-3 text-indigo-200 font-medium text-sm">Price</th>
                <th className="text-left px-4 py-3 text-indigo-200 font-medium text-sm">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {orders.slice(0, 20).map(order => (
                <tr key={order.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white text-sm font-mono">
                    {order.id.substring(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-white text-sm">
                    {order.title || 'Untitled'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-white ${
                      themeColors[(order as any).theme_pack || (order as any).customization_data?.theme_pack || 'executive'] || 'bg-gray-500'
                    }`}>
                      <div className="w-2 h-2 rounded-full bg-white/30" />
                      {((order as any).theme_pack || (order as any).customization_data?.theme_pack || 'executive')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-white ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white text-sm text-right font-medium">
                    ${(order.total_price || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-indigo-200 text-sm">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-indigo-200">
                    No orders found for this time period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PrintProductsAnalytics;
