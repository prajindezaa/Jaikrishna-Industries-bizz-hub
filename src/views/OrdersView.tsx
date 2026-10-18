/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Receipt,
  CheckCircle,
  Package,
  Search,
  Filter,
  Check,
  X,
  FileSpreadsheet,
  Trash2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Order, OrderItem, Product } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useApp, POOJA_PRODUCTS } from '../context/AppContext';

export const OrdersView: React.FC = () => {
  const { t } = useLanguage();
  const { orders, loadingOrders, customers, createOrderTransaction, softDeleteOrder } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('All');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Form State for New Order Modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [selectedProductId, setSelectedProductId] = useState('p1');
  const [itemQuantity, setItemQuantity] = useState(50);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<Order['paymentStatus']>('Paid');
  const [deliveryStatus, setDeliveryStatus] = useState<Order['deliveryStatus']>('Pending');
  const [orderNotes, setOrderNotes] = useState('');

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);

    const cust = customers.find((c) => c.id === selectedCustomerId);
    if (!cust) {
      setOrderError('Please select a valid customer.');
      return;
    }

    const prod = POOJA_PRODUCTS.find((p) => p.id === selectedProductId) || POOJA_PRODUCTS[0];
    const itemTotal = prod.wholesalePrice * itemQuantity;
    const finalAmount = Math.max(0, itemTotal - discountAmount);

    try {
      setIsSubmitting(true);
      await createOrderTransaction({
        customerId: cust.id,
        customerName: cust.companyName,
        items: [
          {
            productId: prod.id,
            productName: prod.name,
            quantity: itemQuantity,
            unitPrice: prod.wholesalePrice,
            total: itemTotal,
          },
        ],
        subtotal: itemTotal,
        discount: discountAmount,
        totalAmount: finalAmount,
        paymentStatus,
        deliveryStatus,
        orderDate: new Date().toISOString().slice(0, 10),
        notes: orderNotes.trim(),
        recordedBy: 'prajindezaa142@gmail.com',
      });

      setShowAddModal(false);
      setSuccessToast(
        `Order confirmed! Customer "${cust.companyName}" was atomically promoted to "Old customer" in Firestore.`
      );
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = selectedPaymentStatus === 'All' || o.paymentStatus === selectedPaymentStatus;
    return matchesSearch && matchesStatus && !o.isDeleted;
  });

  const totalRevenue = orders.reduce((acc, o) => acc + (o.paymentStatus === 'Paid' ? o.totalAmount : 0), 0);
  const pendingRevenue = orders.reduce((acc, o) => acc + (o.paymentStatus !== 'Paid' ? o.totalAmount : 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-stone-900 tracking-tight">
              Orders, Invoicing &amp; Dispatches
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#881337]/10 text-[#881337]">
              {orders.length} orders
            </span>
          </div>
          <p className="text-xs text-stone-700 mt-1">
            Atomic Firestore transactions automatically update customer revenue, order count, and promote lead stage.
          </p>
        </div>

        <button
          onClick={() => {
            if (customers.length === 0) {
              alert('Please add or seed customer leads before recording an order.');
              return;
            }
            if (!selectedCustomerId && customers[0]) {
              setSelectedCustomerId(customers[0].id);
            }
            setShowAddModal(true);
          }}
          className="px-4 py-2 text-xs font-bold rounded-lg bg-[#881337] text-white hover:bg-[#70102e] flex items-center gap-1.5 shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create New Order
        </button>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{successToast}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Total Settled Revenue
          </span>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
            ₹{totalRevenue.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-stone-400 mt-1 block">From verified paid orders</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Pending / Credit Receivables
          </span>
          <div className="text-xl font-bold font-mono text-amber-700 mt-1">
            ₹{pendingRevenue.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-stone-400 mt-1 block">Awaiting payment or settlement</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Total Orders Processed
          </span>
          <div className="text-xl font-bold font-mono text-stone-900 mt-1">
            {orders.length}
          </div>
          <span className="text-[10px] text-stone-400 mt-1 block">Factory dispatches recorded</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 min-w-[220px] items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-sm">
          <Search className="w-4 h-4 text-stone-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by order number or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-stone-800 focus:outline-hidden placeholder:text-stone-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-stone-500" />
          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-700 focus:outline-hidden"
          >
            <option value="All">All Payments</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Credit">Credit</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      {loadingOrders ? (
        <div className="p-12 text-center bg-white rounded-xl border border-stone-200">
          <Loader2 className="w-8 h-8 animate-spin text-[#881337] mx-auto mb-3" />
          <p className="text-xs font-semibold text-stone-600">Loading orders from Firestore...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-800 mb-3 shadow-xs">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-stone-800 mb-1">No orders found</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto mb-4">
            Record a pooja products wholesale order to atomically update customer revenue and promote lead stage.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#881337] text-white hover:bg-[#70102e] shadow-sm"
          >
            Create First Order
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items Summary</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Dispatch</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-800">
                {filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#881337]">{ord.orderNumber}</td>
                    <td className="py-3 px-4 font-medium text-stone-900">{ord.customerName}</td>
                    <td className="py-3 px-4 text-stone-600">
                      {ord.items.map((i) => `${i.productName} (×${i.quantity})`).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-stone-500 font-mono text-[11px]">{ord.orderDate}</td>
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">
                      ₹{ord.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          ord.paymentStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        {ord.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-stone-100 text-stone-700">
                        {ord.deliveryStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          if (window.confirm(`Move order "${ord.orderNumber}" to trash?`)) {
                            softDeleteOrder(ord.id);
                          }
                        }}
                        className="p-1 text-stone-400 hover:text-rose-600 rounded transition-colors"
                        title="Move to trash"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#881337]" />
                <h3 className="font-bold text-base text-stone-900 font-display">Record Wholesale Order</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {orderError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {orderError}
              </div>
            )}

            <form onSubmit={handleCreateOrder} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Customer / Shop <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-[#881337]"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({c.place?.city || 'Salem'}) — Status: {c.status}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-stone-500 mt-1">
                  Creating an order runs an atomic Firestore transaction promoting customer status to "Old customer".
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Pooja Product</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                  >
                    {POOJA_PRODUCTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.wholesalePrice} wholesale)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as Order['paymentStatus'])}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Dispatch Status</label>
                  <select
                    value={deliveryStatus}
                    onChange={(e) => setDeliveryStatus(e.target.value as Order['deliveryStatus'])}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Packed">Packed</option>
                    <option value="Dispatched">Dispatched</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Order Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. ST Courier dispatch, payment received via UPI..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                />
              </div>

              {/* Live Calculation Preview */}
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 flex items-center justify-between font-mono">
                <span className="text-stone-600 font-sans">Final Total:</span>
                <span className="text-base font-bold text-[#881337]">
                  ₹
                  {Math.max(
                    0,
                    ((POOJA_PRODUCTS.find((p) => p.id === selectedProductId)?.wholesalePrice || 180) * itemQuantity) -
                      discountAmount
                  ).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-semibold rounded-lg border border-stone-300 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 font-bold rounded-lg bg-[#881337] text-white hover:bg-[#70102e] shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Confirm Order &amp; Promote Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
