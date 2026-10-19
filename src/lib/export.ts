/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Customer, Task, Order, Plan } from '../types';
import { formatPhoneDisplay } from './phone';

/**
 * Exports customers to an Excel (.xlsx) workbook using SheetJS
 */
export function exportCustomersToExcel(customers: Customer[], filename = 'Jaikrishna_Customers.xlsx') {
  const data = customers.map((c) => ({
    'Company / Shop Name': c.companyName,
    'Contact Person': c.contactPerson,
    'Primary Phone': formatPhoneDisplay(c.phone),
    'Normalized Phone': c.phone,
    'WhatsApp Number': formatPhoneDisplay(c.whatsapp),
    'Area': c.place.area,
    'City': c.place.city,
    'District': c.place.district,
    'State': c.place.state,
    'Customer Type': c.customerType,
    'Status': c.status,
    'Lead Stage': c.leadStage,
    'Source': c.source,
    'Campaign ID': c.campaignId || '',
    'Assigned To': c.assignedTo,
    'Next Follow-Up': c.nextFollowUpDate || '',
    'Total Orders': c.totalOrdersCount,
    'Total Revenue (INR)': c.totalRevenue,
    'Tags': c.tags.join(', '),
    'Notes': c.notes,
    'Created At': c.createdAt,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
  XLSX.writeFile(workbook, filename);
}

/**
 * Exports customers to a clean, printable PDF document
 */
export function exportCustomersToPDF(customers: Customer[], filename = 'Jaikrishna_Customers.pdf') {
  const doc = new jsPDF({ orientation: 'landscape' });

  // Header Title
  doc.setFontSize(16);
  doc.setTextColor(136, 19, 55); // #881337 Maroon
  doc.text('Jaikrishna Industries — Customer & Leads Directory', 14, 15);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${new Date().toLocaleString('en-IN')} · Total Records: ${customers.length}`, 14, 22);

  const tableData = customers.map((c, index) => [
    index + 1,
    c.companyName,
    c.contactPerson,
    formatPhoneDisplay(c.phone),
    `${c.place.city}, ${c.place.state}`,
    c.customerType,
    c.status,
    c.leadStage,
    c.nextFollowUpDate || '—',
  ]);

  autoTable(doc, {
    head: [['#', 'Company / Shop', 'Contact', 'Phone', 'City', 'Type', 'Status', 'Stage', 'Follow-Up']],
    body: tableData,
    startY: 26,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [136, 19, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 248, 245] },
  });

  doc.save(filename);
}

/**
 * Exports complete backup of Customers, Tasks, Orders, and Plans into a single multi-sheet Excel file
 */
export function exportFullBackupExcel(data: {
  customers: Customer[];
  tasks: Task[];
  orders: Order[];
  plans: Plan[];
}) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Customers
  const custSheet = XLSX.utils.json_to_sheet(
    data.customers.map((c) => ({
      ID: c.id,
      CompanyName: c.companyName,
      ContactPerson: c.contactPerson,
      Phone: c.phone,
      WhatsApp: c.whatsapp,
      City: c.place.city,
      CustomerType: c.customerType,
      Status: c.status,
      LeadStage: c.leadStage,
      Source: c.source,
      AssignedTo: c.assignedTo,
      NextFollowUp: c.nextFollowUpDate,
      TotalOrders: c.totalOrdersCount,
      TotalRevenue: c.totalRevenue,
      Notes: c.notes,
    }))
  );
  XLSX.utils.book_append_sheet(workbook, custSheet, 'Customers');

  // Sheet 2: Tasks
  const taskSheet = XLSX.utils.json_to_sheet(
    data.tasks.map((t) => ({
      ID: t.id,
      Title: t.title,
      Type: t.type,
      Priority: t.priority,
      Status: t.status,
      Date: t.date,
      StartTime: t.startTime,
      EndTime: t.endTime,
      AssignedTo: t.assignedTo,
      Repeat: t.repeat,
    }))
  );
  XLSX.utils.book_append_sheet(workbook, taskSheet, 'Tasks');

  // Sheet 3: Orders
  const orderSheet = XLSX.utils.json_to_sheet(
    data.orders.map((o) => ({
      OrderNumber: o.orderNumber,
      CustomerName: o.customerName,
      TotalAmount: o.totalAmount,
      PaymentStatus: o.paymentStatus,
      DeliveryStatus: o.deliveryStatus,
      OrderDate: o.orderDate,
      RecordedBy: o.recordedBy,
    }))
  );
  XLSX.utils.book_append_sheet(workbook, orderSheet, 'Orders');

  // Sheet 4: Plans
  const planSheet = XLSX.utils.json_to_sheet(
    data.plans.map((p) => ({
      ID: p.id,
      Type: p.planType,
      Title: p.title,
      Period: p.period,
      Status: p.status,
      AssignedTo: p.assignedTo,
    }))
  );
  XLSX.utils.book_append_sheet(workbook, planSheet, 'Plans');

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `Jaikrishna_Full_Backup_${timestamp}.xlsx`);
}

/**
 * Exports orders to an Excel (.xlsx) file with invoice, customer, payment and dispatch details
 */
export function exportOrdersToExcel(orders: Order[], filename = 'Jaikrishna_Orders.xlsx') {
  const data = orders.map((o) => ({
    'Order #': o.orderNumber,
    'Invoice #': o.invoiceNumber || '—',
    'Invoice Date': o.invoiceDate || o.orderDate,
    'Financial Year': o.financialYear || '—',
    'Customer Name': o.customerName,
    'City': o.customerCity || '—',
    'GSTIN': o.customerGstin || '—',
    'Total Bill Value (₹)': o.totalAmount,
    'Payment Status': o.paymentStatus,
    'Paid Amount (₹)': o.paidAmount || (o.paymentStatus === 'Paid' ? o.totalAmount : 0),
    'Outstanding (₹)': o.outstandingAmount || 0,
    'Delivery / Dispatch Status': o.deliveryStatus,
    'Transporter': o.dispatch?.transporter || '—',
    'Vehicle #': o.dispatch?.vehicleNumber || '—',
    'LR #': o.dispatch?.lrNumber || '—',
    'Boxes': o.dispatch?.boxesCount || '—',
    'Dispatch Date': o.dispatch?.dispatchDate || '—',
    'Delivery Date': o.dispatch?.deliveryDate || '—',
    'Recorded By': o.recordedBy,
    'Created At': o.createdAt,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
  XLSX.writeFile(workbook, filename);
}

/**
 * Exports orders to a clean, printable PDF document with Jaikrishna Industries branding
 */
export function exportOrdersToPDF(orders: Order[], filename = 'Jaikrishna_Orders.pdf') {
  const doc = new jsPDF({ orientation: 'landscape' });

  // Header Title
  doc.setFontSize(16);
  doc.setTextColor(136, 19, 55); // #881337 Maroon
  doc.text('Jaikrishna Industries — Orders, Invoicing & Dispatch Directory', 14, 15);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${new Date().toLocaleString('en-IN')} · Total Orders: ${orders.length}`, 14, 22);

  const tableData = orders.map((o, index) => [
    index + 1,
    o.orderNumber,
    o.invoiceNumber ? `#${o.invoiceNumber}` : '—',
    o.invoiceDate || o.orderDate,
    o.customerName,
    o.customerCity || '—',
    `₹${o.totalAmount.toLocaleString('en-IN')}`,
    o.paymentStatus,
    o.deliveryStatus,
  ]);

  autoTable(doc, {
    head: [['#', 'Order #', 'Invoice #', 'Date', 'Customer', 'City', 'Bill Value', 'Payment', 'Dispatch']],
    body: tableData,
    startY: 26,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [136, 19, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 248, 245] },
  });

  doc.save(filename);
}

/**
 * Generates and downloads a clean sample Excel template for customer import
 */
export function downloadCustomerImportTemplate() {
  const sampleData = [
    {
      'Company Name': 'Sri Ganesh Pooja Store',
      'Contact Person': 'Ganesh',
      'Phone': '9842154321',
      'City': 'Salem',
      'Area': 'Shevapet',
      'Customer Type': 'Distributor',
      'Status': 'New customer',
      'Source': 'Meta Ads',
      'Notes': 'Needs bulk 50g camphor tablet cartons',
    },
    {
      'Company Name': 'Kovai Deepam Stores',
      'Contact Person': 'R. Sundaram',
      'Phone': '9443212345',
      'City': 'Coimbatore',
      'Area': 'Town Hall',
      'Customer Type': 'Wholesaler',
      'Status': 'New customer',
      'Source': 'Meta Ads',
      'Notes': 'Inquired about lamp oil 1L and sambrani cups',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Import_Template');
  XLSX.writeFile(workbook, 'Jaikrishna_Customer_Import_Template.xlsx');
}
