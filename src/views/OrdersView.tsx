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
import { Order, OrderItem, Product, Customer, CustomerStatus } from '../types';
import { CustomerGroupBadge } from '../components/customers/CustomerGroupBadge';
import { useLanguage } from '../context/LanguageContext';
import { useApp, POOJA_PRODUCTS } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { exportOrdersToExcel, exportOrdersToPDF } from '../lib/export';
import { InvoiceUploadReviewModal, InvoiceReviewItem } from '../components/orders/InvoiceUploadReviewModal';
import { OrderDetailModal } from '../components/orders/OrderDetailModal';
import { calculateFinancialYear } from '../lib/invoice-parser';
import { Upload, Download, Eye } from 'lucide-react';

export const OrdersView: React.FC = () => {
  const { t } = useLanguage();
  const { member } = useAuth();
  const { orders, loadingOrders, customers, customerGroups, createOrderTransaction, softDeleteOrder, addCustomer } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('All');
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState<string>('All');
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
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

  // Handle Confirm Order from Invoice Upload Modal
  const handleConfirmInvoiceOrder = async (item: InvoiceReviewItem) => {
    const fy = calculateFinancialYear(item.invoiceDate);
    const prod = POOJA_PRODUCTS[0];

    await createOrderTransaction({
      invoiceNumber: item.invoiceNumber.trim(),
      invoiceDate: item.invoiceDate,
      financialYear: fy,
      customerId: item.selectedCustomerId,
      customerName: item.customerName,
      customerGstin: item.customerGstin,
      customerAddress: item.customerAddress,
      customerCity: item.customerCity,
      items: [
        {
          productId: prod.id,
          productName: `Invoice #${item.invoiceNumber} Wholesale Goods`,
          quantity: 1,
          unitPrice: item.totalAmount,
          total: item.totalAmount,
        },
      ],
      subtotal: item.totalAmount,
      discount: 0,
      totalAmount: item.totalAmount,
      paymentStatus: 'Unpaid',
      deliveryStatus: 'Pending',
      orderDate: item.invoiceDate,
      paymentDueDate: item.invoiceDate, // immediate (0 days credit)
      paidAmount: 0,
      outstandingAmount: item.totalAmount,
      invoiceFileName: item.file.name,
      notes: item.notes.trim() || `Imported from Tax Invoice #${item.invoiceNumber}`,
      recordedBy: member?.email || 'prajindezaa142@gmail.com',
    });

    setSuccessToast(
      `Order created from Invoice #${item.invoiceNumber} for ₹${item.totalAmount.toLocaleString('en-IN')} (${item.customerName})!`
    );
    setTimeout(() => setSuccessToast(null), 5000);
  };

  // Handle Add New Customer from Invoice Upload Modal
  const handleAddNewCustomerFromInvoice = async (data: Partial<Customer>): Promise<string> => {
    return await addCustomer({
      companyName: data.companyName || 'New Customer',
      contactPerson: data.contactPerson || data.companyName || 'New Contact',
      phone: data.phone || '',
      whatsapp: data.whatsapp || '',
      place: data.place || { area: '', city: data.city || 'Tamil Nadu', district: data.city || 'Tamil Nadu', state: 'Tamil Nadu' },
      address: data.address || '',
      city: data.city || '',
      gstin: data.gstin || '',
      customerType: data.customerType || 'Retailer',
      status: (data.status as CustomerStatus) || 'New customer',
      source: 'Other',
      leadStage: 'New',
      assignedTo: member?.email || 'prajindezaa142@gmail.com',
      tags: data.tags || ['Invoice Import'],
      notes: data.notes || '',
    });
  };

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
        recordedBy: member?.email || 'prajindezaa142@gmail.com',
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

  const distinctCities = Array.from(
    new Set(orders.map((o) => o.customerCity).filter(Boolean))
  ) as string[];

  const activeGroups = customerGroups.filter((g) => g.isActive && !g.isDeleted);

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (o.invoiceNumber && o.invoiceNumber.toLowerCase().includes(search.toLowerCase())) ||
      (o.customerCity && o.customerCity.toLowerCase().includes(search.toLowerCase()));

    const matchesPayment = selectedPaymentStatus === 'All' || o.paymentStatus === selectedPaymentStatus;
    const matchesDelivery = selectedDeliveryStatus === 'All' || o.deliveryStatus === selectedDeliveryStatus;
    const matchesCity = selectedCity === 'All' || o.customerCity === selectedCity;
    const matchesGroup =
      selectedGroup === 'All' ||
      (selectedGroup === 'unknown' ? !o.customerGroupId : o.customerGroupId === selectedGroup);

    return matchesSearch && matchesPayment && matchesDelivery && matchesCity && matchesGroup && !o.isDeleted;
  });

  const totalRevenue = orders.reduce((acc, o) => acc + (o.paymentStatus === 'Paid' ? o.totalAmount : (o.paidAmount || 0)), 0);
  const pendingRevenue = orders.reduce((acc, o) => acc + (o.outstandingAmount || (o.paymentStatus !== 'Paid' ? o.totalAmount : 0)), 0);

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
            Upload born-digital invoice PDFs for automatic extraction, or record manual wholesale orders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Excel Export */}
          <button
            onClick={() => exportOrdersToExcel(filteredOrders)}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 flex items-center gap-1.5 shadow-xs transition-colors"
            title="Export orders to Excel workbook"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Excel
          </button>

          {/* PDF Export */}
          <button
            onClick={() => exportOrdersToPDF(filteredOrders)}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 flex items-center gap-1.5 shadow-xs transition-colors"
            title="Export orders to printable PDF directory"
          >
            <Download className="w-3.5 h-3.5 text-rose-600" />
            PDF
          </button>

          {/* Upload Invoice Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3.5 py-2 text-xs font-bold rounded-lg border border-[#881337]/30 bg-[#881337]/10 text-[#881337] hover:bg-[#881337]/20 flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Upload className="w-4 h-4" />
            Upload Invoice PDF
          </button>

          {/* Manual Order Creation */}
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
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#881337] text-white hover:bg-[#70102e] flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Manual Order
          </button>
        </div>
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
            placeholder="Search by order #, invoice #, customer name, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-stone-800 focus:outline-hidden placeholder:text-stone-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Payment Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-stone-500">Payment:</span>
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-700 focus:outline-hidden"
            >
              <option value="All">All Payments</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Pending">Pending</option>
              <option value="Credit">Credit</option>
            </select>
          </div>

          {/* Delivery Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-stone-500">Dispatch:</span>
            <select
              value={selectedDeliveryStatus}
              onChange={(e) => setSelectedDeliveryStatus(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-700 focus:outline-hidden"
            >
              <option value="All">All Dispatches</option>
              <option value="Pending">Pending</option>
              <option value="Packed">Packed</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Delivered">Delivered</option>
              <option value="On hold">On hold</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* City Filter */}
          {distinctCities.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-stone-500">City:</span>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-700 focus:outline-hidden"
              >
                <option value="All">All Cities</option>
                {distinctCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Customer Group Filter */}
          {activeGroups.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-stone-500">Group:</span>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-700 focus:outline-hidden"
              >
                <option value="All">All Groups</option>
                {activeGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
                <option value="unknown">Unknown Group (pre-groups)</option>
              </select>
            </div>
          )}
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
            Upload an invoice PDF or record a wholesale order to atomically update customer revenue and promote lead stage.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 text-xs font-bold rounded-lg border border-[#881337]/30 bg-[#881337]/10 text-[#881337] hover:bg-[#881337]/20 shadow-xs"
            >
              Upload Invoice PDF
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-[#881337] text-white hover:bg-[#70102e] shadow-sm"
            >
              Create Manual Order
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer &amp; City</th>
                  <th className="py-3 px-4">Group</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Bill Value</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Dispatch</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-800">
                {filteredOrders.map((ord) => (
                  <tr
                    key={ord.id}
                    onClick={() => setSelectedOrderForDetail(ord)}
                    className="hover:bg-amber-50/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-[#881337]">{ord.orderNumber}</td>
                    <td className="py-3 px-4 font-mono font-bold text-stone-800">
                      {ord.invoiceNumber ? (
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200">
                          #{ord.invoiceNumber}
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-stone-900">{ord.customerName}</div>
                      {ord.customerCity && (
                        <div className="text-[10px] text-stone-500">{ord.customerCity}</div>
                      )}
                      {ord.customerGstin && (
                        <div className="text-[10px] font-mono text-stone-400">GST: {ord.customerGstin}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {ord.customerGroupId ? (
                        <CustomerGroupBadge groupId={ord.customerGroupId} groupName={ord.customerGroupName || undefined} />
                      ) : (
                        <span className="text-[10px] text-stone-400 italic">Unknown</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-stone-500 font-mono text-[11px]">
                      {ord.invoiceDate || ord.orderDate}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">
                      ₹{ord.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          ord.paymentStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : ord.paymentStatus === 'Partial'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-rose-100 text-rose-900 border-rose-300'
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
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedOrderForDetail(ord)}
                          className="p-1 text-stone-500 hover:text-[#881337] hover:bg-stone-100 rounded transition-colors"
                          title="View order, dispatch & payments"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Detail & Dispatch / Payment Modal */}
      <OrderDetailModal
        order={selectedOrderForDetail}
        isOpen={Boolean(selectedOrderForDetail)}
        onClose={() => setSelectedOrderForDetail(null)}
      />

      {/* Invoice Upload & Review Modal */}
      <InvoiceUploadReviewModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        customers={customers}
        existingOrders={orders}
        onConfirmOrder={handleConfirmInvoiceOrder}
        onAddNewCustomer={handleAddNewCustomerFromInvoice}
      />

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
