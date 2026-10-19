/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Truck,
  CreditCard,
  Package,
  Calendar,
  Clock,
  Building2,
  FileText,
  User,
  History,
  CheckCircle,
  Plus,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Phone,
  FileCheck,
} from 'lucide-react';
import { Order, OrderPaymentRecord } from '../../types';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

interface OrderDetailModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, isOpen, onClose }) => {
  const { member } = useAuth();
  const { changeOrderDeliveryStatus, updateOrderDispatch, recordOrderPayment } = useApp();

  const [activeTab, setActiveTab] = useState<'details' | 'dispatch' | 'payment' | 'history'>('details');

  // Dispatch Edit Form State
  const [transporter, setTransporter] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [boxesCount, setBoxesCount] = useState<number>(1);
  const [dispatchDate, setDispatchDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [isSavingDispatch, setIsSavingDispatch] = useState(false);

  // Status Change State
  const [nextDeliveryStatus, setNextDeliveryStatus] = useState<Order['deliveryStatus']>('Pending');
  const [statusReason, setStatusReason] = useState('');
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  // Payment Recording State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque'>('UPI');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync state when order changes
  React.useEffect(() => {
    if (order) {
      setTransporter(order.dispatch?.transporter || '');
      setLrNumber(order.dispatch?.lrNumber || '');
      setVehicleNumber(order.dispatch?.vehicleNumber || '');
      setBoxesCount(order.dispatch?.boxesCount || 1);
      setDispatchDate(order.dispatch?.dispatchDate || order.orderDate || new Date().toISOString().slice(0, 10));
      setDeliveryDate(order.dispatch?.deliveryDate || '');
      setDispatchNotes(order.dispatch?.notes || '');
      setNextDeliveryStatus(order.deliveryStatus);
      setPaymentAmount(order.outstandingAmount !== undefined ? order.outstandingAmount : (order.totalAmount - (order.paidAmount || 0)));
      setFeedbackMsg(null);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const outstanding = order.outstandingAmount !== undefined ? order.outstandingAmount : Math.max(0, order.totalAmount - (order.paidAmount || 0));

  const handleUpdateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDispatch(true);
    setFeedbackMsg(null);
    try {
      await updateOrderDispatch(order.id, {
        transporter: transporter.trim() || undefined,
        lrNumber: lrNumber.trim() || undefined,
        vehicleNumber: vehicleNumber.trim() || undefined,
        boxesCount: Number(boxesCount) || 1,
        dispatchDate: dispatchDate || undefined,
        deliveryDate: deliveryDate || undefined,
        notes: dispatchNotes.trim() || undefined,
      });
      setFeedbackMsg({ type: 'success', text: 'Dispatch details updated successfully!' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to update dispatch details' });
    } finally {
      setIsSavingDispatch(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (nextDeliveryStatus === order.deliveryStatus) return;
    setIsSavingStatus(true);
    setFeedbackMsg(null);
    try {
      await changeOrderDeliveryStatus(order.id, nextDeliveryStatus, statusReason.trim() || undefined);
      setFeedbackMsg({
        type: 'success',
        text: `Status updated to ${nextDeliveryStatus}! ${nextDeliveryStatus === 'Delivered' ? '(Feedback task created)' : ''}`,
      });
      setStatusReason('');
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to update status' });
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) {
      setFeedbackMsg({ type: 'error', text: 'Payment amount must be greater than 0' });
      return;
    }
    setIsSavingPayment(true);
    setFeedbackMsg(null);
    try {
      await recordOrderPayment(order.id, {
        amount: paymentAmount,
        mode: paymentMode,
        reference: paymentRef.trim() || undefined,
        date: paymentDate,
      });
      setFeedbackMsg({ type: 'success', text: `₹${paymentAmount.toLocaleString('en-IN')} payment logged successfully!` });
      setPaymentRef('');
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to record payment' });
    } finally {
      setIsSavingPayment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#881337] text-white flex items-center justify-center shadow-xs">
              <Package className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-stone-900 font-display">
                  Order {order.orderNumber}
                </h3>
                {order.invoiceNumber && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-stone-200 text-stone-800 font-bold">
                    Inv #{order.invoiceNumber}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    order.paymentStatus === 'Paid'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : order.paymentStatus === 'Partial'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-rose-100 text-rose-900 border-rose-300'
                  }`}
                >
                  {order.paymentStatus}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                {order.customerName} {order.customerCity ? `• ${order.customerCity}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-200 px-4 bg-stone-50/50 text-xs font-semibold gap-1">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'details'
                ? 'border-[#881337] text-[#881337] font-bold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Summary</span>
          </button>
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'dispatch'
                ? 'border-[#881337] text-[#881337] font-bold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Dispatch &amp; LR</span>
            {order.deliveryStatus !== 'Delivered' && (
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('payment')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'payment'
                ? 'border-[#881337] text-[#881337] font-bold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Payments</span>
            {outstanding > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 font-mono">
                ₹{outstanding.toLocaleString('en-IN')}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'history'
                ? 'border-[#881337] text-[#881337] font-bold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Timeline</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`mx-4 mt-3 p-2.5 rounded-lg text-xs font-medium border flex items-center justify-between ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button onClick={() => setFeedbackMsg(null)} className="text-stone-400 hover:text-stone-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* TAB 1: DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="text-[10px] text-stone-500 uppercase font-semibold">Bill Value</span>
                  <div className="text-base font-bold font-mono text-stone-900 mt-0.5">
                    ₹{order.totalAmount.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="text-[10px] text-stone-500 uppercase font-semibold">Paid Amount</span>
                  <div className="text-base font-bold font-mono text-emerald-700 mt-0.5">
                    ₹{(order.paidAmount || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="text-[10px] text-stone-500 uppercase font-semibold">Outstanding</span>
                  <div className={`text-base font-bold font-mono mt-0.5 ${outstanding > 0 ? 'text-rose-700' : 'text-stone-900'}`}>
                    ₹{outstanding.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="text-[10px] text-stone-500 uppercase font-semibold">Delivery</span>
                  <div className="text-xs font-bold text-stone-800 mt-1">
                    {order.deliveryStatus}
                  </div>
                </div>
              </div>

              {/* Status Updater Card */}
              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-amber-700" />
                    Change Delivery / Dispatch Status
                  </span>
                  <span className="text-[10px] font-mono font-medium text-amber-800">
                    Current: <strong>{order.deliveryStatus}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-1">
                    <select
                      value={nextDeliveryStatus}
                      onChange={(e) => setNextDeliveryStatus(e.target.value as Order['deliveryStatus'])}
                      className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white font-medium text-stone-800 focus:outline-hidden"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Packed">Packed</option>
                      <option value="Dispatched">Dispatched</option>
                      <option value="Delivered">Delivered</option>
                      <option value="On hold">On hold</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Optional note / status change reason..."
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-amber-300 bg-white focus:outline-hidden"
                    />
                    <button
                      type="button"
                      disabled={isSavingStatus || nextDeliveryStatus === order.deliveryStatus}
                      onClick={handleUpdateStatus}
                      className="px-4 py-2 font-bold bg-[#881337] text-white rounded-lg hover:bg-[#70102e] disabled:opacity-40 transition-colors flex items-center gap-1"
                    >
                      {isSavingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Update
                    </button>
                  </div>
                </div>
                {nextDeliveryStatus === 'Delivered' && order.deliveryStatus !== 'Delivered' && (
                  <p className="text-[10px] text-amber-800 font-medium">
                    ✨ Setting to <strong>Delivered</strong> will automatically trigger a 48h customer feedback follow-up task.
                  </p>
                )}
              </div>

              {/* Order Metadata */}
              <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-2">
                <h4 className="font-bold text-stone-900 border-b border-stone-100 pb-2">Customer &amp; Invoice Info</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-stone-600">
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-semibold">Customer</span>
                    <span className="font-semibold text-stone-900">{order.customerName}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-semibold">City / Place</span>
                    <span className="text-stone-800">{order.customerCity || '—'}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-semibold">Buyer GSTIN</span>
                    <span className="font-mono text-stone-800">{order.customerGstin || 'Unregistered'}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-semibold">Address</span>
                    <span className="text-stone-800">{order.customerAddress || '—'}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-semibold">Invoice Date</span>
                    <span className="font-mono text-stone-800">{order.invoiceDate || order.orderDate}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-semibold">Financial Year</span>
                    <span className="font-mono text-stone-800">{order.financialYear || '—'}</span>
                  </div>
                  {order.invoiceFileName && (
                    <div className="sm:col-span-2">
                      <span className="text-stone-400 block text-[10px] uppercase font-semibold">Source Invoice File</span>
                      <span className="font-mono text-[11px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                        {order.invoiceFileName}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <div className="p-3 bg-stone-50 border-b border-stone-200 font-bold text-stone-800">
                  Items ({order.items?.length || 0})
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50/70 border-b border-stone-200 text-stone-500 uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-3">Item Description</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Rate</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {order.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 font-medium text-stone-900">{item.productName}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono">₹{item.unitPrice}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900">
                          ₹{item.total.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: DISPATCH & LR */}
          {activeTab === 'dispatch' && (
            <form onSubmit={handleUpdateDispatch} className="space-y-4">
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-center gap-2">
                <Truck className="w-4 h-4 text-sky-700 shrink-0" />
                <span>
                  Track logistics details (Transporter, Lorry Receipt / LR Number, Vehicle No., and dispatch date) for this order.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Transporter / Courier Name</label>
                  <input
                    type="text"
                    placeholder="e.g. ST Courier / VRL Logistics / KPN"
                    value={transporter}
                    onChange={(e) => setTransporter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-[#881337]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">LR Number / Waybill #</label>
                  <input
                    type="text"
                    placeholder="e.g. LR-948291"
                    value={lrNumber}
                    onChange={(e) => setLrNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono focus:outline-hidden focus:border-[#881337]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Vehicle Number</label>
                  <input
                    type="text"
                    placeholder="e.g. TN 30 AB 1234"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono uppercase focus:outline-hidden focus:border-[#881337]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Boxes / Parcells Count</label>
                  <input
                    type="number"
                    min={1}
                    value={boxesCount}
                    onChange={(e) => setBoxesCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono focus:outline-hidden focus:border-[#881337]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Dispatch Date</label>
                  <input
                    type="date"
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono focus:outline-hidden focus:border-[#881337]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Estimated / Delivered Date</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono focus:outline-hidden focus:border-[#881337]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-stone-700 mb-1">Logistics Notes</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Sent via Salem junction godown..."
                    value={dispatchNotes}
                    onChange={(e) => setDispatchNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingDispatch}
                  className="px-5 py-2 font-bold rounded-lg bg-[#881337] text-white hover:bg-[#70102e] shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingDispatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save Dispatch Details
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: PAYMENTS */}
          {activeTab === 'payment' && (
            <div className="space-y-4">
              {/* Payment Summary */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-stone-500 uppercase font-semibold">Total Bill</span>
                  <div className="text-base font-bold font-mono text-stone-900">
                    ₹{order.totalAmount.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 uppercase font-semibold">Total Paid</span>
                  <div className="text-base font-bold font-mono text-emerald-700">
                    ₹{(order.paidAmount || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 uppercase font-semibold">Balance Due</span>
                  <div className={`text-base font-bold font-mono ${outstanding > 0 ? 'text-rose-700 font-extrabold' : 'text-stone-900'}`}>
                    ₹{outstanding.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Record Payment Form */}
              <form onSubmit={handleRecordPayment} className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                <h4 className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-700" />
                  Record New Payment
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-emerald-900 mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      min={1}
                      max={outstanding > 0 ? outstanding : order.totalAmount}
                      required
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-lg border border-emerald-300 bg-white font-mono font-bold text-stone-900 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-emerald-900 mb-1">Mode</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg border border-emerald-300 bg-white font-medium text-stone-800 focus:outline-hidden"
                    >
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-emerald-900 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-emerald-300 bg-white font-mono focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-emerald-900 mb-1">Txn / UTR / Ref</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR-491823"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-emerald-300 bg-white font-mono focus:outline-hidden"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSavingPayment || paymentAmount <= 0}
                    className="px-4 py-1.5 font-bold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {isSavingPayment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Log Payment Entry
                  </button>
                </div>
              </form>

              {/* Payment History Table */}
              <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <div className="p-3 bg-stone-50 border-b border-stone-200 font-bold text-stone-800 flex items-center justify-between">
                  <span>Payment Receipts ({order.paymentHistory?.length || 0})</span>
                </div>
                {(!order.paymentHistory || order.paymentHistory.length === 0) ? (
                  <div className="p-4 text-center text-stone-400 italic">
                    No payment entries recorded yet.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50/70 border-b border-stone-200 text-stone-500 uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Mode</th>
                        <th className="py-2 px-3">Reference</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {order.paymentHistory.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 px-3 font-mono text-stone-600">{p.date}</td>
                          <td className="py-2 px-3 font-medium text-stone-800">{p.mode}</td>
                          <td className="py-2 px-3 font-mono text-stone-500">{p.reference || '—'}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            ₹{p.amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: STATUS HISTORY & TIMELINE */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-stone-600 text-xs">
                Audit trail of status transitions for order <strong className="font-mono text-stone-900">{order.orderNumber}</strong>.
              </div>

              {(!order.statusHistory || order.statusHistory.length === 0) ? (
                <div className="p-6 text-center text-stone-400 italic">
                  No status transitions logged yet.
                </div>
              ) : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-stone-200 pl-8">
                  {order.statusHistory.map((entry, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-[#881337] ring-4 ring-white" />
                      <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-900">{entry.status}</span>
                          <span className="text-[10px] font-mono text-stone-400">
                            {new Date(entry.changedAt).toLocaleString('en-IN')}
                          </span>
                        </div>
                        {entry.reason && (
                          <p className="text-stone-600 mt-1 italic">"{entry.reason}"</p>
                        )}
                        <span className="text-[10px] text-stone-400 block mt-1">
                          By: {entry.changedBy}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">
            Created on <span className="font-mono">{order.orderDate}</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-bold rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
