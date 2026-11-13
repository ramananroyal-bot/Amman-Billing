export interface BankDetails {
  bankName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
  upiId: string;
}

export interface BusinessProfile {
  id: 'current';
  businessName: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  state: string;
  stateCode: string;
  logo: string; // base64 / data URL
  bankDetails: BankDetails;
  terms: string;
  signatoryText: string;
  invoicePrefix: string;
  purchasePrefix: string;
  challanPrefix?: string;
  paymentInPrefix?: string;
  paymentOutPrefix?: string;
  creditNotePrefix?: string;
  debitNotePrefix?: string;
  estimatePrefix?: string;
  expensePrefix?: string;
  jobWorkOutPrefix?: string;
  jobWorkInPrefix?: string;
  nextInvoiceNumber: number;
  nextPurchaseNumber: number;
  nextChallanNumber?: number;
  nextPaymentInNumber?: number;
  nextPaymentOutNumber?: number;
  nextCreditNoteNumber?: number;
  nextDebitNoteNumber?: number;
  nextEstimateNumber?: number;
  nextExpenseNumber?: number;
  nextJobWorkOutNumber?: number;
  nextJobWorkInNumber?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  isDefault?: boolean;
}

export type GSTType = 'Registered' | 'Unregistered' | 'Composition' | 'Consumer';

export interface Party {
  id: string;
  name: string;
  gstin?: string;
  phone: string;
  email?: string;
  group?: string; // e.g. 'Customer', 'Supplier'
  gstType: GSTType;
  state: string;
  stateCode: string;
  billingAddress: string;
  shippingAddresses: string[];
  openingBalance: number; // positive number
  openingBalanceType: 'to_receive' | 'to_pay';
  openingBalanceDate?: string;
  creditLimit: number;
  panNumber?: string;
  notes?: string;
  currentBalance?: number; // computed dynamically
  createdAt: string;
  updatedAt: string;
}

export type ItemType = 'product' | 'service';
export type PriceTaxType = 'with_tax' | 'without_tax';

export interface StockAdjustment {
  id: string;
  itemId: string;
  itemName: string;
  date: string;
  type: 'add' | 'reduce';
  qty: number;
  reason: string;
  createdAt: string;
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  hsn: string;
  unit: string;
  category: string;
  itemCode: string;
  barcode?: string;
  taxRate: number;
  salePrice: number;
  salePriceTaxType: PriceTaxType;
  wholesalePrice?: number;
  purchasePrice: number;
  purchasePriceTaxType: PriceTaxType;
  openingStockQty: number;
  openingStockDate: string;
  minStockAlert: number;
  location: string;
  imageUrl?: string;
  currentStock: number;
  stockValue?: number;
  manufacturer?: string;
  batchNumber?: string;
  serialNumber?: string;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionItem {
  id: string;
  itemId: string;
  name: string;
  hsn: string;
  qty: number;
  freeQty: number;
  unit: string;
  priceUnit: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  batchNumber?: string;
  serialNumber?: string;
  expiryDate?: string;
}

export type TransactionType =
  | 'sale_invoice'
  | 'purchase_bill'
  | 'delivery_challan'
  | 'job_work_out'
  | 'job_work_in'
  | 'payment_in'
  | 'payment_out'
  | 'sale_return'
  | 'purchase_return'
  | 'estimate'
  | 'expense';

export type PaymentType = 'credit' | 'cash' | 'upi' | 'bank_transfer' | 'cheque';

export interface PaymentInvoiceLink {
  invoiceId: string;
  invoiceNo: string;
  amountAllocated: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  invoiceNo: string;
  date: string; // ISO YYYY-MM-DD
  dueDate?: string; // Optional due date for Challans or bills
  partyId: string;
  partyName: string;
  partyGstin?: string;
  partyPhone?: string;
  partyState: string;
  partyStateCode: string;
  billingAddress: string;
  shippingAddress: string;
  stateOfSupply: string;
  paymentType: PaymentType;
  items: TransactionItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  roundOff: number;
  totalAmount: number;
  receivedAmount: number;
  balanceDue: number;
  description?: string;
  terms?: string;
  vehicleNo?: string;
  deliveryDate?: string;
  eWayBillNo?: string;
  godown?: string;
  documentUrl?: string;
  challanStatus?: 'open' | 'converted' | 'cancelled';
  linkedChallanId?: string;
  jobWorkStatus?: 'sent' | 'partial_received' | 'completed';
  linkedJobWorkId?: string;
  processType?: string;
  estimateStatus?: 'open' | 'converted' | 'expired';
  referenceNo?: string;
  receiptNo?: string;
  invoiceLinks?: PaymentInvoiceLink[];
  originalInvoiceId?: string;
  originalInvoiceNo?: string;
  returnReason?: string;
  status: 'active' | 'cancelled';
  copiesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  expenseNo: string;
  category: string;
  date: string;
  amount: number;
  paymentType: PaymentType;
  partyId?: string;
  partyName?: string;
  notes?: string;
  gstAmount?: number;
  taxRate?: number;
  gstin?: string;
  createdAt: string;
  updatedAt: string;
}

export type FilterPeriod = 'this_month' | 'last_30_days' | 'this_quarter' | 'this_year' | 'all';

export interface OverdueInvoiceInfo {
  transactionId: string;
  invoiceNo: string;
  partyId: string;
  partyName: string;
  partyPhone: string;
  dueDate: string;
  daysOverdue: number;
  balanceDue: number;
  totalAmount: number;
}

export interface DashboardMetrics {
  totalReceivable: number;
  totalPayable: number;
  totalSale: number;
  totalPurchase: number;
  totalExpenses: number;
  netProfit: number | null;
  lastMonthSale: number;
  saleChangePercent: number | null;
  saleCount: number;
  period: FilterPeriod;
  salesByDay: { date: string; amount: number; count: number }[];
  recentTransactions: Transaction[];
  overduePayments?: OverdueInvoiceInfo[];
  lowStockItems?: Item[];
}

export interface FirmInfo {
  id: string;
  name: string;
  dbName: string;
  gstin?: string;
  createdAt: string;
}

export type AuditAction = 'CREATE' | 'EDIT' | 'DELETE' | 'CANCEL' | 'CONVERT' | 'SETTINGS' | 'BACKUP_RESTORE';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  entityType: 'transaction' | 'party' | 'item' | 'expense' | 'settings' | 'system';
  entityId?: string;
  entityLabel: string;
  actor: string;
  details: string;
}

export interface AppSettings {
  id: 'current';
  language?: 'en' | 'ta';
  invoicePrintLanguage?: 'en' | 'ta' | 'bilingual';
  decimalPlaces: number;
  currencySymbol: string;
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
  fiscalYearStart: 'april' | 'january';
  blockNegativeStock: boolean;
  warnNegativeStock: boolean;
  enableGodowns: boolean;
  autoRoundOff: boolean;
  defaultPaymentMode: PaymentType;
  defaultDueDays: number;
  overdueReminderDays?: number;
  enableCreditLimitAlerts: boolean;
  enableBatchExpiry: boolean;
  enableWholesalePrice: boolean;
  enableFreeQty: boolean;
  defaultTaxRate: number;
  defaultUnit: string;
  isCompositionScheme: boolean;
  enableRCM: boolean;
  printTheme: 'classic' | 'modern' | 'simple';
  invoiceColor: string;
  printCopies: number;
  printShowLogo: boolean;
  printShowBankDetails: boolean;
  printShowUPIQR: boolean;
  printShowTerms: boolean;
  printShowSignatory: boolean;
  enableEWayBill: boolean;
  eWayBillThreshold: number;
  autoBackupPrompt: boolean;
  whatsappMessageTemplate: string;
  // Add-on C Optional Features (each controlled behind a switch in Settings)
  enableMultipleFirms?: boolean;
  enablePasscodeLock?: boolean;
  requirePinForEditDelete?: boolean;
  enableAuditTrail?: boolean;
  enableBarcode?: boolean;
  enableBatchSerial?: boolean;
  darkMode?: boolean;
  enableExtendedShortcuts?: boolean;
  enableWeightUnits?: boolean;
  enableJobWork?: boolean;
  updatedAt: string;
}

export interface LocalSnapshot {
  id: string;
  name: string;
  timestamp: string;
  reason: string;
  partiesCount: number;
  itemsCount: number;
  transactionsCount: number;
  totalSalesAmount: number;
  data: string; // JSON serialized string
}

export interface BackupMetadata {
  isValid: boolean;
  errorMessage?: string;
  version?: string;
  exportedAt?: string;
  businessName?: string;
  gstin?: string;
  partiesCount: number;
  itemsCount: number;
  transactionsCount: number;
  stockAdjustmentsCount: number;
  totalSalesAmount: number;
}

export interface IntegrityReport {
  isHealthy: boolean;
  totalTransactions: number;
  totalParties: number;
  totalItems: number;
  orphanTransactions: number;
  negativeStockCount: number;
  mismatchedBalances: number;
  details: string[];
}
