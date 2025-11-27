
import React, { useState, useEffect } from 'react';
import { getPosterOrders } from '../services/printService';
import { PosterOrder } from '../types';
import { TruckIcon, CheckBadgeIcon, ReceiptIcon, ClockIcon } from './Icons';

const OrderHistory = () => {
  const [orders, setOrders] = useState<PosterOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    const data = await getPosterOrders();
    setOrders(data);
    setLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-navy-900 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-gold-100 rounded-full">
          <ReceiptIcon className="w-8 h-8 text-gold-600" />
        </div>
        <div>
          <h2 className="text-3xl font-serif font-bold text-navy-900">Order History</h2>
          <p className="text-gray-600">Track your printed vision boards.</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-500">No orders placed yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row">
               {/* Thumbnail placeholder - in real app would fetch vision board image */}
               <div className="w-full md:w-48 bg-gray-100 flex items-center justify-center p-4 border-b md:border-b-0 md:border-r border-gray-100">
                  <div className="text-xs text-gray-400 text-center">Vision Board<br/>#{order.visionBoardId.slice(0,8)}</div>
               </div>
               
               <div className="flex-1 p-6">
                 <div className="flex justify-between items-start mb-4">
                    <div>
                       <h3 className="font-bold text-navy-900 flex items-center gap-2">
                         Order #{order.vendorOrderId || order.id.slice(0,8).toUpperCase()}
                       </h3>
                       <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                         <ClockIcon className="w-3 h-3" />
                         Placed on {new Date(order.createdAt).toLocaleDateString()}
                       </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1
                      ${order.status === 'delivered' ? 'bg-green-100 text-green-700' : 
                        order.status === 'shipped' ? 'bg-blue-100 text-blue-700' : 
                        'bg-yellow-100 text-yellow-700'}`}>
                        {order.status === 'delivered' ? <CheckBadgeIcon className="w-3 h-3" /> : <TruckIcon className="w-3 h-3" />}
                        {order.status}
                    </div>
                 </div>

                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-4">
                    <div>
                       <span className="block text-xs text-gray-400 uppercase font-bold">Item</span>
                       {order.config.size} Poster ({order.config.finish})
                    </div>
                    <div>
                       <span className="block text-xs text-gray-400 uppercase font-bold">Ship To</span>
                       {order.shippingAddress.name}, {order.shippingAddress.city}
                    </div>
                    <div>
                       <span className="block text-xs text-gray-400 uppercase font-bold">Total</span>
                       ${order.totalPrice.toFixed(2)}
                    </div>
                 </div>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
