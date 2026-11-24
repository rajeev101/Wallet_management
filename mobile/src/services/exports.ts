import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import type { Transaction } from '../types';
import { dateTime, holder, ledgerBalances, partyName, titleCase } from '../utils/wallet';

const safeName = (value: string) => value.replace(/[^a-z\d_-]/gi, '_').slice(0, 100);
const htmlEscape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export async function shareFile(uri: string, mimeType: string, title: string) {
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: title, UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : mimeType === 'image/png' ? 'public.png' : 'org.openxmlformats.spreadsheetml.sheet' });
}

export async function exportTransactions(items: Transaction[], name: string, includeBalances = false, ledgerItems = items) {
  if (!items.length) throw new Error('No transactions to export.');
  const { default: ExcelJS } = await import('exceljs/dist/exceljs.bare.min.js');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Campus Wallet'; workbook.created = new Date();
  const sheet = workbook.addWorksheet('Transactions');
  sheet.columns = [
    { header: 'Transaction ID', key: 'id', width: 30 }, { header: 'Date & Time', key: 'date', width: 25 },
    { header: 'Account Holder', key: 'holder', width: 25 }, { header: 'Account Email', key: 'email', width: 30 },
    { header: 'Vendor', key: 'vendor', width: 25 }, { header: 'Transaction Type', key: 'type', width: 20 },
    { header: 'Amount (INR)', key: 'amount', width: 18 }, { header: 'Status', key: 'status', width: 15 },
    { header: 'Description', key: 'description', width: 40 },
    ...(includeBalances ? [{ header: 'Initial Balance (INR)', key: 'before', width: 22 }, { header: 'Total Balance (INR)', key: 'after', width: 22 }, { header: 'Balance Source', key: 'source', width: 30 }] : []),
  ];
  const balances = includeBalances ? ledgerBalances(ledgerItems) : null;
  items.forEach(item => {
    const payer = holder(item);
    const balance = balances?.get(item._id);
    sheet.addRow({ id: item._id, date: dateTime(item.createdAt), holder: partyName(payer), email: typeof payer === 'object' && payer ? payer.email : '', vendor: partyName(item.vendor), type: titleCase(item.type), amount: Number(item.amount), status: titleCase(item.status), description: item.description || '', before: balance?.before, after: balance?.after, source: balance?.derived ? 'Derived from available history' : 'Recorded' });
  });
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5200C9' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: `${includeBalances ? 'L' : 'I'}${items.length + 1}` };
  sheet.getColumn('amount').numFmt = '#,##0.00';
  const buffer = await workbook.xlsx.writeBuffer();
  const file = new File(Paths.cache, `${safeName(name)}-${Date.now()}.xlsx`);
  file.write(new Uint8Array(buffer));
  await shareFile(file.uri, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Export Transactions');
}

export async function shareReceipt(transaction: Transaction) {
  const fields = [
    ['Transaction ID', transaction._id], ['Date & Time', dateTime(transaction.createdAt)],
    ['Account Holder', partyName(holder(transaction))], ['Vendor', partyName(transaction.vendor)],
    ['Type', titleCase(transaction.type)], ['Amount', `INR ${Number(transaction.amount).toFixed(2)}`],
    ['Status', titleCase(transaction.status)], ['Description', transaction.description || ''],
  ];
  const result = await Print.printToFileAsync({ html: `<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:40px}body{font-family:Helvetica,sans-serif;color:#070d2e;font-size:13px}h1{color:#5200c9;font-size:24px}h2{font-size:18px}table{width:100%;border-collapse:collapse;table-layout:fixed}td{padding:12px 0;border-bottom:1px solid #d9e2f2;overflow-wrap:anywhere;vertical-align:top}td:first-child{width:35%;color:#657398}footer{margin-top:30px;font-size:11px;color:#657398}</style></head><body><h1>Campus Wallet</h1><h2>Transaction Receipt</h2><table>${fields.map(([label, value]) => `<tr><td>${htmlEscape(label)}</td><td>${htmlEscape(value)}</td></tr>`).join('')}</table><footer>Generated ${htmlEscape(new Date().toLocaleString())}</footer></body></html>` });
  const file = new File(Paths.cache, `receipt-${safeName(transaction._id)}-${Date.now()}.pdf`);
  new File(result.uri).move(file);
  await shareFile(file.uri, 'application/pdf', 'Transaction Receipt');
}

export async function shareQr(base64: string, vendorId: string) {
  const file = new File(Paths.cache, `vendor-qr-${safeName(vendorId)}.png`);
  file.write(base64, { encoding: 'base64' });
  await shareFile(file.uri, 'image/png', 'Vendor Payment QR Code');
}