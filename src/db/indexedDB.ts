import {
  AppSettings,
  BusinessProfile,
  DashboardMetrics,
  FilterPeriod,
  Item,
  Party,
  StockAdjustment,
  Transaction,
  LocalSnapshot,
  BackupMetadata,
  IntegrityReport,
  Expense,
  ExpenseCategory,
} from '../types';

const DB_NAME = 'VyaparGST_DB';
const DB_VERSION = 3;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      dbPromise = null;
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onblocked = () => {
      console.warn('IndexedDB open blocked: please close other tabs of this application.');
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('business_profile')) {
        db.createObjectStore('business_profile', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('parties')) {
        const partyStore = db.createObjectStore('parties', { keyPath: 'id' });
        partyStore.createIndex('name', 'name', { unique: false });
        partyStore.createIndex('phone', 'phone', { unique: false });
      }
      if (!db.objectStoreNames.contains('items')) {
        const itemStore = db.createObjectStore('items', { keyPath: 'id' });
        itemStore.createIndex('name', 'name', { unique: false });
        itemStore.createIndex('category', 'category', { unique: false });
      }
      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('invoiceNo', 'invoiceNo', { unique: false });
        txStore.createIndex('date', 'date', { unique: false });
        txStore.createIndex('type', 'type', { unique: false });
        txStore.createIndex('partyId', 'partyId', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('stock_adjustments')) {
        const saStore = db.createObjectStore('stock_adjustments', { keyPath: 'id' });
        saStore.createIndex('itemId', 'itemId', { unique: false });
        saStore.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('expenses')) {
        const expStore = db.createObjectStore('expenses', { keyPath: 'id' });
        expStore.createIndex('expenseNo', 'expenseNo', { unique: false });
        expStore.createIndex('date', 'date', { unique: false });
        expStore.createIndex('category', 'category', { unique: false });
      }
      if (!db.objectStoreNames.contains('expense_categories')) {
        db.createObjectStore('expense_categories', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
        console.warn('IndexedDB database version changed elsewhere; closed connection.');
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });

  return dbPromise;
}

// -------------------------------------------------------------
// BUSINESS PROFILE
// -------------------------------------------------------------

export async function getBusinessProfile(): Promise<BusinessProfile | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('business_profile', 'readonly');
    const store = tx.objectStore('business_profile');
    const request = store.get('current');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBusinessProfile(data: Partial<BusinessProfile>): Promise<BusinessProfile> {
  const db = await getDB();
  const existing = await getBusinessProfile();
  const now = new Date().toISOString();

  const profile: BusinessProfile = {
    id: 'current',
    businessName: data.businessName || existing?.businessName || '',
    address: data.address || existing?.address || '',
    phone: data.phone || existing?.phone || '',
    email: data.email || existing?.email || '',
    gstin: (data.gstin || existing?.gstin || '').trim().toUpperCase(),
    state: data.state || existing?.state || 'Maharashtra',
    stateCode: data.stateCode || existing?.stateCode || '27',
    logo: data.logo !== undefined ? data.logo : existing?.logo || '',
    bankDetails: {
      bankName: data.bankDetails?.bankName || existing?.bankDetails?.bankName || '',
      accountNo: data.bankDetails?.accountNo || existing?.bankDetails?.accountNo || '',
      ifsc: (data.bankDetails?.ifsc || existing?.bankDetails?.ifsc || '').trim().toUpperCase(),
      branch: data.bankDetails?.branch || existing?.bankDetails?.branch || '',
      upiId: data.bankDetails?.upiId || existing?.bankDetails?.upiId || '',
    },
    terms: data.terms !== undefined ? data.terms : existing?.terms || '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if payment is not made within the due date.',
    signatoryText: data.signatoryText || existing?.signatoryText || 'Authorized Signatory',
    invoicePrefix: data.invoicePrefix || existing?.invoicePrefix || 'INV-',
    purchasePrefix: data.purchasePrefix || existing?.purchasePrefix || 'PUR-',
    nextInvoiceNumber: data.nextInvoiceNumber || existing?.nextInvoiceNumber || 1,
    nextPurchaseNumber: data.nextPurchaseNumber || existing?.nextPurchaseNumber || 1,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('business_profile', 'readwrite');
    const store = tx.objectStore('business_profile');
    const request = store.put(profile);
    request.onsuccess = () => resolve(profile);
    request.onerror = () => reject(request.error);
  });
}

// -------------------------------------------------------------
// PARTIES
// -------------------------------------------------------------

export async function getParties(): Promise<Party[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('parties', 'readonly');
    const store = tx.objectStore('parties');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getParty(id: string | number): Promise<Party | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('parties', 'readonly');
    const store = tx.objectStore('parties');
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result);
        return;
      }
      if (typeof id === 'string' && !isNaN(Number(id)) && id.trim() !== '') {
        const numReq = store.get(Number(id));
        numReq.onsuccess = () => resolve(numReq.result || null);
        numReq.onerror = () => reject(numReq.error);
        return;
      }
      if (typeof id === 'number') {
        const strReq = store.get(String(id));
        strReq.onsuccess = () => resolve(strReq.result || null);
        strReq.onerror = () => reject(strReq.error);
        return;
      }
      resolve(null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveParty(partyData: Partial<Party>): Promise<Party> {
  const db = await getDB();
  const id = partyData.id || `party_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();

  const party: Party = {
    id,
    name: partyData.name || '',
    gstin: (partyData.gstin || '').trim().toUpperCase(),
    phone: partyData.phone || '',
    email: partyData.email || '',
    group: partyData.group || 'Customer',
    gstType: partyData.gstType || (partyData.gstin ? 'Registered' : 'Unregistered'),
    state: partyData.state || 'Maharashtra',
    stateCode: partyData.stateCode || '27',
    billingAddress: partyData.billingAddress || '',
    shippingAddresses: partyData.shippingAddresses && partyData.shippingAddresses.length > 0
      ? partyData.shippingAddresses
      : partyData.billingAddress ? [partyData.billingAddress] : [],
    openingBalance: Number(partyData.openingBalance) || 0,
    openingBalanceType: partyData.openingBalanceType || 'to_receive',
    openingBalanceDate: partyData.openingBalanceDate || now.split('T')[0],
    creditLimit: Number(partyData.creditLimit) || 0,
    panNumber: partyData.panNumber || (partyData.gstin && partyData.gstin.length >= 12 ? partyData.gstin.substring(2, 12) : ''),
    notes: partyData.notes || '',
    createdAt: partyData.createdAt || now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('parties', 'readwrite');
    const store = tx.objectStore('parties');
    const request = store.put(party);
    request.onsuccess = () => resolve(party);
    request.onerror = () => reject(request.error);
  });
}

export async function duplicateParty(id: string): Promise<Party> {
  const original = await getParty(id);
  if (!original) throw new Error('Party not found');

  const copy: Partial<Party> = {
    ...original,
    id: undefined,
    name: `${original.name} - Copy`,
    createdAt: undefined,
    updatedAt: undefined,
  };

  return saveParty(copy);
}

export async function deleteParty(id: string | number): Promise<{ success: boolean; error?: string }> {
  const db = await getDB();
  const idStr = String(id);
  // Check if party has transactions
  const txList = await getTransactions({ partyId: idStr });
  if (txList.length > 0) {
    return {
      success: false,
      error: 'This party has transactions and cannot be deleted',
    };
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('parties', 'readwrite');
    const store = tx.objectStore('parties');
    store.delete(id);
    if (typeof id === 'string' && !isNaN(Number(id))) {
      store.delete(Number(id));
    }
    tx.oncomplete = () => resolve({ success: true });
    tx.onerror = () => reject(tx.error);
  });
}

// -------------------------------------------------------------
// ITEMS
// -------------------------------------------------------------

export async function getItems(): Promise<Item[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readonly');
    const store = tx.objectStore('items');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getItem(id: string | number): Promise<Item | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readonly');
    const store = tx.objectStore('items');
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result);
        return;
      }
      if (typeof id === 'string' && !isNaN(Number(id)) && id.trim() !== '') {
        const numReq = store.get(Number(id));
        numReq.onsuccess = () => resolve(numReq.result || null);
        numReq.onerror = () => reject(numReq.error);
        return;
      }
      if (typeof id === 'number') {
        const strReq = store.get(String(id));
        strReq.onsuccess = () => resolve(strReq.result || null);
        strReq.onerror = () => reject(strReq.error);
        return;
      }
      resolve(null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveItem(itemData: Partial<Item>): Promise<Item> {
  const db = await getDB();
  const id = itemData.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();

  const openingQty = Number(itemData.openingStockQty) || 0;
  const currentStock = itemData.currentStock !== undefined ? Number(itemData.currentStock) : openingQty;
  const purchasePrice = Number(itemData.purchasePrice) || 0;

  const item: Item = {
    id,
    name: itemData.name || '',
    type: itemData.type || 'product',
    hsn: itemData.hsn || '',
    unit: (itemData.unit || 'PCS').toUpperCase(),
    category: itemData.category || 'General',
    itemCode: itemData.itemCode || '',
    taxRate: Number(itemData.taxRate) || 0,
    salePrice: Number(itemData.salePrice) || 0,
    salePriceTaxType: itemData.salePriceTaxType || 'without_tax',
    wholesalePrice: Number(itemData.wholesalePrice) || 0,
    purchasePrice,
    purchasePriceTaxType: itemData.purchasePriceTaxType || 'without_tax',
    openingStockQty: openingQty,
    openingStockDate: itemData.openingStockDate || now.split('T')[0],
    minStockAlert: Number(itemData.minStockAlert) || 0,
    location: itemData.location || 'Main Godown',
    imageUrl: itemData.imageUrl || '',
    currentStock,
    stockValue: Math.round(currentStock * purchasePrice * 100) / 100,
    manufacturer: itemData.manufacturer || '',
    batchNumber: itemData.batchNumber || '',
    expiryDate: itemData.expiryDate || '',
    createdAt: itemData.createdAt || now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite');
    const store = tx.objectStore('items');
    const request = store.put(item);
    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(request.error);
  });
}

export async function adjustItemStock(adjustmentData: {
  itemId: string;
  itemName: string;
  date: string;
  type: 'add' | 'reduce';
  qty: number;
  reason: string;
}): Promise<{ item: Item; adjustment: StockAdjustment }> {
  const item = await getItem(adjustmentData.itemId);
  if (!item) throw new Error('Item not found');

  const delta = adjustmentData.type === 'add' ? adjustmentData.qty : -adjustmentData.qty;
  item.currentStock = Math.round((item.currentStock + delta) * 100) / 100;
  item.stockValue = Math.round(item.currentStock * item.purchasePrice * 100) / 100;
  await saveItem(item);

  const adjustment: StockAdjustment = {
    id: `adj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    itemId: item.id,
    itemName: item.name,
    date: adjustmentData.date,
    type: adjustmentData.type,
    qty: adjustmentData.qty,
    reason: adjustmentData.reason,
    createdAt: new Date().toISOString(),
  };

  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('stock_adjustments', 'readwrite');
    const store = tx.objectStore('stock_adjustments');
    const req = store.put(adjustment);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  return { item, adjustment };
}

export async function getStockAdjustments(itemId?: string): Promise<StockAdjustment[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('stock_adjustments', 'readonly');
    const store = tx.objectStore('stock_adjustments');
    const req = store.getAll();
    req.onsuccess = () => {
      let list: StockAdjustment[] = req.result || [];
      if (itemId) {
        list = list.filter((a) => a.itemId === itemId);
      }
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteItem(id: string | number): Promise<{ success: boolean; error?: string }> {
  const idStr = String(id);
  const txList = await getItemTransactions(idStr);
  if (txList.length > 0) {
    return {
      success: false,
      error: 'This item is used in transactions and cannot be deleted',
    };
  }

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite');
    const store = tx.objectStore('items');
    store.delete(id);
    if (typeof id === 'string' && !isNaN(Number(id))) {
      store.delete(Number(id));
    }
    tx.oncomplete = () => resolve({ success: true });
    tx.onerror = () => reject(tx.error);
  });
}

// -------------------------------------------------------------
// TRANSACTIONS & STOCK ADJUSTMENT
// -------------------------------------------------------------

export async function getTransactions(filter?: {
  type?: string;
  partyId?: string;
  search?: string;
  status?: 'active' | 'cancelled';
}): Promise<Transaction[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readonly');
    const store = tx.objectStore('transactions');
    const request = store.getAll();

    request.onsuccess = () => {
      let list: Transaction[] = request.result || [];

      if (filter?.type) {
        list = list.filter((t) => t.type === filter.type);
      }
      if (filter?.partyId) {
        list = list.filter((t) => t.partyId === filter.partyId);
      }
      if (filter?.status) {
        list = list.filter((t) => t.status === filter.status);
      }
      if (filter?.search) {
        const q = filter.search.toLowerCase();
        list = list.filter(
          (t) =>
            t.invoiceNo.toLowerCase().includes(q) ||
            t.partyName.toLowerCase().includes(q) ||
            (t.partyPhone && t.partyPhone.includes(q)) ||
            t.totalAmount.toString().includes(q)
        );
      }

      // Sort newest first by date and creation
      list.sort((a, b) => {
        const dDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dDiff !== 0) return dDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      resolve(list);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getTransaction(id: string | number): Promise<Transaction | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readonly');
    const store = tx.objectStore('transactions');
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result);
        return;
      }
      if (typeof id === 'string' && !isNaN(Number(id)) && id.trim() !== '') {
        const numReq = store.get(Number(id));
        numReq.onsuccess = () => resolve(numReq.result || null);
        numReq.onerror = () => reject(numReq.error);
        return;
      }
      if (typeof id === 'number') {
        const strReq = store.get(String(id));
        strReq.onsuccess = () => resolve(strReq.result || null);
        strReq.onerror = () => reject(strReq.error);
        return;
      }
      resolve(null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save Transaction with Atomic Stock & Balance Updates
 */
export async function saveTransaction(txData: Partial<Transaction>): Promise<Transaction> {
  const db = await getDB();
  const id = txData.id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();

  // If editing an existing transaction, we must reverse previous stock adjustments
  const oldTx = txData.id ? await getTransaction(txData.id) : null;

  const tx: Transaction = {
    id,
    type: txData.type || 'sale_invoice',
    invoiceNo: txData.invoiceNo || 'INV-0001',
    date: txData.date || now.split('T')[0],
    dueDate: txData.dueDate || '',
    partyId: txData.partyId || '',
    partyName: txData.partyName || 'Cash Sale',
    partyGstin: txData.partyGstin || '',
    partyPhone: txData.partyPhone || '',
    partyState: txData.partyState || 'Maharashtra',
    partyStateCode: txData.partyStateCode || '27',
    billingAddress: txData.billingAddress || '',
    shippingAddress: txData.shippingAddress || '',
    stateOfSupply: txData.stateOfSupply || txData.partyState || 'Maharashtra',
    paymentType: txData.paymentType || 'credit',
    items: txData.items || [],
    subtotal: Number(txData.subtotal) || 0,
    cgst: Number(txData.cgst) || 0,
    sgst: Number(txData.sgst) || 0,
    igst: Number(txData.igst) || 0,
    totalTax: Number(txData.totalTax) || 0,
    roundOff: Number(txData.roundOff) || 0,
    totalAmount: Number(txData.totalAmount) || 0,
    receivedAmount: Number(txData.receivedAmount) || 0,
    balanceDue: Number(txData.balanceDue) || 0,
    description: txData.description || '',
    terms: txData.terms || '',
    vehicleNo: txData.vehicleNo || '',
    deliveryDate: txData.deliveryDate || '',
    eWayBillNo: txData.eWayBillNo || '',
    godown: txData.godown || 'Main Godown',
    documentUrl: txData.documentUrl || '',
    challanStatus: txData.challanStatus || (txData.type === 'delivery_challan' ? 'open' : undefined),
    linkedChallanId: txData.linkedChallanId || '',
    estimateStatus: txData.estimateStatus || (txData.type === 'estimate' ? 'open' : undefined),
    referenceNo: txData.referenceNo || '',
    receiptNo: txData.receiptNo || '',
    invoiceLinks: txData.invoiceLinks || [],
    originalInvoiceId: txData.originalInvoiceId || '',
    originalInvoiceNo: txData.originalInvoiceNo || '',
    returnReason: txData.returnReason || '',
    status: txData.status || 'active',
    copiesCount: txData.copiesCount || 1,
    createdAt: txData.createdAt || now,
    updatedAt: now,
  };

  // Adjust stock for products
  // 1. Revert old stock if old transaction was active
  if (oldTx && oldTx.status === 'active') {
    for (const itemRow of oldTx.items) {
      if (itemRow.itemId) {
        const itemRecord = await getItem(itemRow.itemId);
        if (itemRecord && itemRecord.type === 'product') {
          const qtyDiff = (itemRow.qty || 0) + (itemRow.freeQty || 0);
          if (oldTx.type === 'sale_invoice' || oldTx.type === 'purchase_return') {
            // Revert deduction: add back
            itemRecord.currentStock += qtyDiff;
          } else if (oldTx.type === 'purchase_bill' || oldTx.type === 'sale_return') {
            // Revert addition: subtract back
            itemRecord.currentStock = Math.max(0, itemRecord.currentStock - qtyDiff);
          }
          itemRecord.stockValue = Math.round(itemRecord.currentStock * itemRecord.purchasePrice * 100) / 100;
          await saveItem(itemRecord);
        }
      }
    }

    // Revert previous invoice payment allocations if old tx was payment
    if ((oldTx.type === 'payment_in' || oldTx.type === 'payment_out') && oldTx.invoiceLinks) {
      for (const link of oldTx.invoiceLinks) {
        const targetInv = await getTransaction(link.invoiceId);
        if (targetInv && targetInv.status === 'active') {
          targetInv.receivedAmount = Math.max(0, Math.round(((targetInv.receivedAmount || 0) - (link.amountAllocated || 0)) * 100) / 100);
          targetInv.balanceDue = Math.max(0, Math.round((targetInv.totalAmount - targetInv.receivedAmount) * 100) / 100);
          targetInv.updatedAt = new Date().toISOString();
          const writeDb = await getDB();
          await new Promise<void>((res, rej) => {
            const wTx = writeDb.transaction('transactions', 'readwrite');
            wTx.objectStore('transactions').put(targetInv);
            wTx.oncomplete = () => res();
            wTx.onerror = () => rej(wTx.error);
          });
        }
      }
    }
  }

  // 2. Apply new stock adjustments if active
  if (tx.status === 'active') {
    for (const itemRow of tx.items) {
      if (itemRow.itemId) {
        const itemRecord = await getItem(itemRow.itemId);
        if (itemRecord && itemRecord.type === 'product') {
          const qtyDiff = (itemRow.qty || 0) + (itemRow.freeQty || 0);
          if (tx.type === 'sale_invoice' || tx.type === 'purchase_return') {
            // Sale or Purchase Return reduces stock
            itemRecord.currentStock = Math.max(0, itemRecord.currentStock - qtyDiff);
          } else if (tx.type === 'purchase_bill' || tx.type === 'sale_return') {
            // Purchase Bill or Sale Return increases stock
            itemRecord.currentStock += qtyDiff;
          }
          itemRecord.stockValue = Math.round(itemRecord.currentStock * itemRecord.purchasePrice * 100) / 100;
          await saveItem(itemRecord);
        }
      }
    }

    // Apply new invoice allocations if payment_in or payment_out
    if ((tx.type === 'payment_in' || tx.type === 'payment_out') && tx.invoiceLinks && tx.invoiceLinks.length > 0) {
      for (const link of tx.invoiceLinks) {
        const targetInv = await getTransaction(link.invoiceId);
        if (targetInv && targetInv.status === 'active') {
          targetInv.receivedAmount = Math.round(((targetInv.receivedAmount || 0) + (link.amountAllocated || 0)) * 100) / 100;
          targetInv.balanceDue = Math.max(0, Math.round((targetInv.totalAmount - targetInv.receivedAmount) * 100) / 100);
          targetInv.updatedAt = new Date().toISOString();
          const writeDb = await getDB();
          await new Promise<void>((res, rej) => {
            const wTx = writeDb.transaction('transactions', 'readwrite');
            wTx.objectStore('transactions').put(targetInv);
            wTx.oncomplete = () => res();
            wTx.onerror = () => rej(wTx.error);
          });
        }
      }
    }
  }

  // 3. Save the transaction record
  await new Promise<void>((resolve, reject) => {
    const dbTx = db.transaction('transactions', 'readwrite');
    const store = dbTx.objectStore('transactions');
    const request = store.put(tx);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // 4. Update Business profile next serial numbers
  const profile = await getBusinessProfile();
  if (profile) {
    const match = (tx.invoiceNo || tx.receiptNo || '').match(/\d+$/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (!isNaN(num)) {
        let changed = false;
        if (tx.type === 'sale_invoice' && num >= (profile.nextInvoiceNumber || 1)) {
          profile.nextInvoiceNumber = num + 1;
          changed = true;
        } else if (tx.type === 'purchase_bill' && num >= (profile.nextPurchaseNumber || 1)) {
          profile.nextPurchaseNumber = num + 1;
          changed = true;
        } else if (tx.type === 'delivery_challan' && num >= (profile.nextChallanNumber || 1)) {
          profile.nextChallanNumber = num + 1;
          changed = true;
        } else if (tx.type === 'payment_in' && num >= (profile.nextPaymentInNumber || 1)) {
          profile.nextPaymentInNumber = num + 1;
          changed = true;
        } else if (tx.type === 'payment_out' && num >= (profile.nextPaymentOutNumber || 1)) {
          profile.nextPaymentOutNumber = num + 1;
          changed = true;
        } else if (tx.type === 'sale_return' && num >= (profile.nextCreditNoteNumber || 1)) {
          profile.nextCreditNoteNumber = num + 1;
          changed = true;
        } else if (tx.type === 'purchase_return' && num >= (profile.nextDebitNoteNumber || 1)) {
          profile.nextDebitNoteNumber = num + 1;
          changed = true;
        } else if (tx.type === 'estimate' && num >= (profile.nextEstimateNumber || 1)) {
          profile.nextEstimateNumber = num + 1;
          changed = true;
        }
        if (changed) {
          await saveBusinessProfile(profile);
        }
      }
    }
  }

  return tx;
}

export async function convertChallanToSale(challanId: string): Promise<Transaction> {
  const challan = await getTransaction(challanId);
  if (!challan) throw new Error('Delivery challan not found');

  // Mark challan as converted
  challan.challanStatus = 'converted';
  challan.updatedAt = new Date().toISOString();
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const req = store.put(challan);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  const profile = await getBusinessProfile();
  const nextNum = profile?.nextInvoiceNumber || 1;
  const prefix = profile?.invoicePrefix || 'INV-';
  const newInvoiceNo = `${prefix}${String(nextNum).padStart(4, '0')}`;

  // Create sale invoice from challan. Saving as sale_invoice will accurately reduce stock and update party receivable!
  const saleTx = await saveTransaction({
    type: 'sale_invoice',
    invoiceNo: newInvoiceNo,
    date: new Date().toISOString().split('T')[0],
    partyId: challan.partyId,
    partyName: challan.partyName,
    partyGstin: challan.partyGstin,
    partyPhone: challan.partyPhone,
    partyState: challan.partyState,
    partyStateCode: challan.partyStateCode,
    billingAddress: challan.billingAddress,
    shippingAddress: challan.shippingAddress,
    stateOfSupply: challan.stateOfSupply,
    paymentType: challan.paymentType || 'credit',
    items: challan.items,
    subtotal: challan.subtotal,
    cgst: challan.cgst,
    sgst: challan.sgst,
    igst: challan.igst,
    totalTax: challan.totalTax,
    roundOff: challan.roundOff,
    totalAmount: challan.totalAmount,
    receivedAmount: challan.receivedAmount || 0,
    balanceDue: challan.balanceDue || challan.totalAmount,
    description: `Converted from Delivery Challan ${challan.invoiceNo}. ${challan.description || ''}`.trim(),
    terms: challan.terms,
    vehicleNo: challan.vehicleNo,
    deliveryDate: challan.deliveryDate,
    godown: challan.godown,
    linkedChallanId: challan.id,
    status: 'active',
  });

  return saleTx;
}

export async function bulkConvertChallansToSale(challanIds: string[]): Promise<Transaction[]> {
  const converted: Transaction[] = [];
  for (const id of challanIds) {
    try {
      const sale = await convertChallanToSale(id);
      converted.push(sale);
    } catch (e) {
      console.error(`Failed to convert challan ${id}:`, e);
    }
  }
  return converted;
}

export async function cancelTransaction(id: string): Promise<Transaction | null> {
  const tx = await getTransaction(id);
  if (!tx || tx.status === 'cancelled') return tx;

  // Revert stock
  for (const itemRow of tx.items) {
    if (itemRow.itemId) {
      const itemRecord = await getItem(itemRow.itemId);
      if (itemRecord && itemRecord.type === 'product') {
        const qtyDiff = (itemRow.qty || 0) + (itemRow.freeQty || 0);
        if (tx.type === 'sale_invoice') {
          itemRecord.currentStock += qtyDiff;
        } else if (tx.type === 'purchase_bill') {
          itemRecord.currentStock -= qtyDiff;
        }
        itemRecord.stockValue = Math.round(itemRecord.currentStock * itemRecord.purchasePrice * 100) / 100;
        await saveItem(itemRecord);
      }
    }
  }

  tx.status = 'cancelled';
  tx.updatedAt = new Date().toISOString();

  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const idbTx = db.transaction('transactions', 'readwrite');
    const store = idbTx.objectStore('transactions');
    const request = store.put(tx);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  return tx;
}

export async function deleteTransaction(id: string | number): Promise<{ success: boolean; error?: string }> {
  // 1. Fetch record first BEFORE opening write transaction
  const tx = await getTransaction(id);
  if (!tx) {
    return { success: false, error: 'Transaction not found in database' };
  }

  // Guard for converted delivery challans
  if (tx.type === 'delivery_challan' && tx.challanStatus === 'converted') {
    return {
      success: false,
      error: 'Converted challans cannot be deleted. Delete the linked sale first.',
    };
  }

  const db = await getDB();

  return new Promise((resolve, reject) => {
    // Single atomic transaction listing all stores touched
    const idbTx = db.transaction(['transactions', 'items', 'parties'], 'readwrite');
    const txStore = idbTx.objectStore('transactions');
    const itemStore = idbTx.objectStore('items');
    const partyStore = idbTx.objectStore('parties');

    idbTx.oncomplete = () => {
      resolve({ success: true });
    };

    idbTx.onerror = () => {
      reject(idbTx.error || new Error('Database transaction failed'));
    };

    idbTx.onabort = () => {
      reject(idbTx.error || new Error('Database transaction aborted'));
    };

    // If transaction was active (not cancelled), reverse inventory and balance
    if (tx.status === 'active') {
      // 1. Stock reversal
      for (const itemRow of tx.items) {
        if (itemRow.itemId) {
          const itemReq = itemStore.get(itemRow.itemId);
          itemReq.onsuccess = () => {
            const itemRecord = itemReq.result;
            if (itemRecord && itemRecord.type === 'product') {
              const qtyDiff = (itemRow.qty || 0) + (itemRow.freeQty || 0);
              if (tx.type === 'sale_invoice' || tx.type === 'purchase_return') {
                // Sale or Purchase Return deletion: add back to stock
                itemRecord.currentStock += qtyDiff;
              } else if (tx.type === 'purchase_bill' || tx.type === 'sale_return') {
                // Purchase or Sale Return deletion: deduct from stock
                itemRecord.currentStock = Math.max(0, itemRecord.currentStock - qtyDiff);
              }
              itemRecord.stockValue = Math.round(itemRecord.currentStock * itemRecord.purchasePrice * 100) / 100;
              itemRecord.updatedAt = new Date().toISOString();
              itemStore.put(itemRecord);
            }
          };
        }
      }

      // 1b. Revert linked invoice allocations if deleting a payment
      if ((tx.type === 'payment_in' || tx.type === 'payment_out') && tx.invoiceLinks && tx.invoiceLinks.length > 0) {
        for (const link of tx.invoiceLinks) {
          const invReq = txStore.get(link.invoiceId);
          invReq.onsuccess = () => {
            const inv = invReq.result;
            if (inv && inv.status === 'active') {
              inv.receivedAmount = Math.max(0, Math.round(((inv.receivedAmount || 0) - (link.amountAllocated || 0)) * 100) / 100);
              inv.balanceDue = Math.max(0, Math.round((inv.totalAmount - inv.receivedAmount) * 100) / 100);
              inv.updatedAt = new Date().toISOString();
              txStore.put(inv);
            }
          };
        }
      }

      // 2. Party record touch if party exists
      if (tx.partyId) {
        const partyReq = partyStore.get(tx.partyId);
        partyReq.onsuccess = () => {
          const partyRecord = partyReq.result;
          if (partyRecord) {
            partyRecord.updatedAt = new Date().toISOString();
            partyStore.put(partyRecord);
          }
        };
      }
    }

    // 3. Delete the transaction record (supporting string or number key)
    txStore.delete(tx.id);
    if (typeof tx.id === 'string' && !isNaN(Number(tx.id))) {
      txStore.delete(Number(tx.id));
    }

    // 4. Also remove any linked payments
    const cursorReq = txStore.openCursor();
    cursorReq.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const rec = cursor.value;
        if (
          rec.linkedTransactionId === tx.id ||
          (rec.type === 'payment_in' && rec.description && rec.description.includes(tx.invoiceNo)) ||
          (rec.type === 'payment_out' && rec.description && rec.description.includes(tx.invoiceNo))
        ) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  });
}

export async function duplicateTransaction(id: string): Promise<Transaction> {
  const original = await getTransaction(id);
  if (!original) throw new Error('Transaction not found');

  const profile = await getBusinessProfile();
  const nextNum = profile?.nextInvoiceNumber || 1;
  const prefix = profile?.invoicePrefix || 'INV-';
  const newInvoiceNo = `${prefix}${String(nextNum).padStart(4, '0')}`;

  const copy: Partial<Transaction> = {
    ...original,
    id: undefined,
    invoiceNo: newInvoiceNo,
    date: new Date().toISOString().split('T')[0],
    createdAt: undefined,
    updatedAt: undefined,
    status: 'active',
  };

  return saveTransaction(copy);
}

export async function convertInvoiceToReturn(
  id: string,
  returnedItems?: { itemId: string; qty: number }[],
  reason?: string
): Promise<Transaction> {
  const original = await getTransaction(id);
  if (!original) throw new Error('Original sale invoice not found');

  const profile = await getBusinessProfile();
  const prefix = profile?.creditNotePrefix || 'CR-';
  const nextNum = profile?.nextCreditNoteNumber || 1;
  const returnInvoiceNo = `${prefix}${String(nextNum).padStart(4, '0')}`;
  const now = new Date().toISOString().split('T')[0];

  let itemsToReturn = original.items;
  if (returnedItems && returnedItems.length > 0) {
    itemsToReturn = returnedItems.map((ret) => {
      const orig = original.items.find((i) => i.itemId === ret.itemId);
      if (!orig) throw new Error('Item not found on original invoice');
      if (ret.qty > orig.qty) {
        throw new Error(`Return quantity for ${orig.name} cannot exceed original sold quantity (${orig.qty})`);
      }
      const unitPrice = orig.priceUnit;
      const taxRate = orig.taxRate;
      const lineTotalBeforeTax = Math.round(unitPrice * ret.qty * 100) / 100;
      const lineTax = Math.round((lineTotalBeforeTax * (taxRate / 100)) * 100) / 100;
      return {
        ...orig,
        id: `ret_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        qty: ret.qty,
        freeQty: 0,
        taxAmount: lineTax,
        totalAmount: lineTotalBeforeTax + lineTax,
      };
    });
  }

  const subtotal = itemsToReturn.reduce((sum, i) => sum + (i.priceUnit * i.qty), 0);
  const totalTax = itemsToReturn.reduce((sum, i) => sum + (i.taxAmount || 0), 0);
  const isInterState = original.partyStateCode !== (profile?.stateCode || '27');
  const cgst = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const sgst = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const igst = isInterState ? Math.round(totalTax * 100) / 100 : 0;
  const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;

  return await saveTransaction({
    ...original,
    id: undefined,
    type: 'sale_return',
    invoiceNo: returnInvoiceNo,
    receiptNo: returnInvoiceNo,
    date: now,
    items: itemsToReturn,
    subtotal,
    cgst,
    sgst,
    igst,
    totalTax,
    totalAmount,
    receivedAmount: 0,
    balanceDue: totalAmount,
    originalInvoiceId: original.id,
    originalInvoiceNo: original.invoiceNo,
    returnReason: reason || 'Goods Returned / Defective',
    description: `Credit Note against ${original.invoiceNo}. ${reason ? 'Reason: ' + reason : ''}`.trim(),
    status: 'active',
  });
}

export async function convertBillToReturn(
  id: string,
  returnedItems?: { itemId: string; qty: number }[],
  reason?: string
): Promise<Transaction> {
  const original = await getTransaction(id);
  if (!original) throw new Error('Original purchase bill not found');

  const profile = await getBusinessProfile();
  const prefix = profile?.debitNotePrefix || 'DB-';
  const nextNum = profile?.nextDebitNoteNumber || 1;
  const returnBillNo = `${prefix}${String(nextNum).padStart(4, '0')}`;
  const now = new Date().toISOString().split('T')[0];

  let itemsToReturn = original.items;
  if (returnedItems && returnedItems.length > 0) {
    itemsToReturn = returnedItems.map((ret) => {
      const orig = original.items.find((i) => i.itemId === ret.itemId);
      if (!orig) throw new Error('Item not found on original purchase bill');
      if (ret.qty > orig.qty) {
        throw new Error(`Return quantity for ${orig.name} cannot exceed original bought quantity (${orig.qty})`);
      }
      const unitPrice = orig.priceUnit;
      const taxRate = orig.taxRate;
      const lineTotalBeforeTax = Math.round(unitPrice * ret.qty * 100) / 100;
      const lineTax = Math.round((lineTotalBeforeTax * (taxRate / 100)) * 100) / 100;
      return {
        ...orig,
        id: `pret_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        qty: ret.qty,
        freeQty: 0,
        taxAmount: lineTax,
        totalAmount: lineTotalBeforeTax + lineTax,
      };
    });
  }

  const subtotal = itemsToReturn.reduce((sum, i) => sum + (i.priceUnit * i.qty), 0);
  const totalTax = itemsToReturn.reduce((sum, i) => sum + (i.taxAmount || 0), 0);
  const isInterState = original.partyStateCode !== (profile?.stateCode || '27');
  const cgst = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const sgst = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const igst = isInterState ? Math.round(totalTax * 100) / 100 : 0;
  const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;

  return await saveTransaction({
    ...original,
    id: undefined,
    type: 'purchase_return',
    invoiceNo: returnBillNo,
    receiptNo: returnBillNo,
    date: now,
    items: itemsToReturn,
    subtotal,
    cgst,
    sgst,
    igst,
    totalTax,
    totalAmount,
    receivedAmount: 0,
    balanceDue: totalAmount,
    originalInvoiceId: original.id,
    originalInvoiceNo: original.invoiceNo,
    returnReason: reason || 'Goods Returned to Vendor',
    description: `Debit Note against ${original.invoiceNo}. ${reason ? 'Reason: ' + reason : ''}`.trim(),
    status: 'active',
  });
}

// -------------------------------------------------------------
// DASHBOARD METRICS CALCULATION
// -------------------------------------------------------------

export async function getDashboardMetrics(period: FilterPeriod = 'this_month'): Promise<DashboardMetrics> {
  const transactions = await getTransactions();
  const parties = await getParties();
  const allExpenses = await getExpenses();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Calculate Total Receivable & Total Payable across all parties
  let totalReceivable = 0;
  let totalPayable = 0;
  for (const party of parties) {
    const { balance, type } = await calculatePartyBalance(party);
    if (type === 'to_receive') {
      totalReceivable += balance;
    } else {
      totalPayable += balance;
    }
  }

  // Date boundary calculation for selected period
  const filterStart = new Date();
  filterStart.setHours(0, 0, 0, 0);

  if (period === 'this_month') {
    filterStart.setDate(1);
  } else if (period === 'last_30_days') {
    filterStart.setDate(now.getDate() - 30);
  } else if (period === 'this_quarter') {
    const qMonth = Math.floor(currentMonth / 3) * 3;
    filterStart.setMonth(qMonth, 1);
  } else if (period === 'this_year') {
    // Indian Fiscal Year starts April 1st
    if (currentMonth < 3) {
      filterStart.setFullYear(currentYear - 1, 3, 1);
    } else {
      filterStart.setFullYear(currentYear, 3, 1);
    }
  } else {
    // all time
    filterStart.setFullYear(2000, 0, 1);
  }

  // Previous month calculation for "% vs last month" comparison
  const lastMonthStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
  const lastMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

  let totalSale = 0;
  let saleCount = 0;
  let lastMonthSale = 0;
  let totalPurchase = 0;
  let totalExpenses = 0;

  // Aggregate sales by day for chart
  const salesMap = new Map<string, { amount: number; count: number }>();

  for (const t of transactions) {
    if (t.status === 'active') {
      const tDate = new Date(t.date);

      if (t.type === 'sale_invoice') {
        // Check current period
        if (tDate >= filterStart && tDate <= now) {
          totalSale += t.totalAmount;
          saleCount++;

          const dateKey = t.date;
          const existing = salesMap.get(dateKey) || { amount: 0, count: 0 };
          existing.amount += t.totalAmount;
          existing.count += 1;
          salesMap.set(dateKey, existing);
        }

        // Check last month
        if (tDate >= lastMonthStart && tDate <= lastMonthEnd) {
          lastMonthSale += t.totalAmount;
        }
      } else if (t.type === 'purchase_bill') {
        if (tDate >= filterStart && tDate <= now) {
          totalPurchase += t.totalAmount;
        }
      }
    }
  }

  // Aggregate expenses for the period
  for (const exp of allExpenses) {
    const expDate = new Date(exp.date);
    if (expDate >= filterStart && expDate <= now) {
      totalExpenses += exp.amount;
    }
  }

  // Calculate percentage vs last month ONLY if last month has data (> 0)
  let saleChangePercent: number | null = null;
  if (lastMonthSale > 0) {
    saleChangePercent = Math.round(((totalSale - lastMonthSale) / lastMonthSale) * 1000) / 10;
  }

  // Net profit = sales - purchases - expenses, shown only when data exists
  let netProfit: number | null = null;
  if (totalSale > 0 || totalPurchase > 0 || totalExpenses > 0) {
    netProfit = Math.round((totalSale - totalPurchase - totalExpenses) * 100) / 100;
  }

  // Prepare sorted day-by-day sales data points
  const salesByDay: { date: string; amount: number; count: number }[] = [];
  Array.from(salesMap.entries())
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .forEach(([date, val]) => {
      salesByDay.push({
        date,
        amount: Math.round(val.amount * 100) / 100,
        count: val.count,
      });
    });

  return {
    totalReceivable: Math.round(totalReceivable * 100) / 100,
    totalPayable: Math.round(totalPayable * 100) / 100,
    totalSale: Math.round(totalSale * 100) / 100,
    totalPurchase: Math.round(totalPurchase * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netProfit,
    lastMonthSale: Math.round(lastMonthSale * 100) / 100,
    saleChangePercent,
    saleCount,
    period,
    salesByDay,
    recentTransactions: transactions.slice(0, 10),
  };
}

// -------------------------------------------------------------
// APP SETTINGS
// -------------------------------------------------------------

export async function getAppSettings(): Promise<AppSettings> {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.get('current');
    const defaultSettings: AppSettings = {
      id: 'current',
      decimalPlaces: 2,
      currencySymbol: '₹',
      dateFormat: 'DD/MM/YYYY',
      fiscalYearStart: 'april',
      blockNegativeStock: false,
      warnNegativeStock: true,
      enableGodowns: true,
      autoRoundOff: true,
      defaultPaymentMode: 'cash',
      defaultDueDays: 30,
      enableCreditLimitAlerts: true,
      enableBatchExpiry: false,
      enableWholesalePrice: false,
      enableFreeQty: true,
      defaultTaxRate: 18,
      defaultUnit: 'Pcs',
      isCompositionScheme: false,
      enableRCM: false,
      printTheme: 'classic',
      invoiceColor: '#e11d48',
      printCopies: 1,
      printShowLogo: true,
      printShowBankDetails: true,
      printShowUPIQR: true,
      printShowTerms: true,
      printShowSignatory: true,
      enableEWayBill: false,
      eWayBillThreshold: 50000,
      autoBackupPrompt: true,
      whatsappMessageTemplate:
        'Dear Customer, your invoice [Invoice_Number] of [Invoice_Amount] dated [Invoice_Date] from [Firm_Name] is generated. Balance due: [Balance_Due]. Thank you for your business!',
      updatedAt: new Date().toISOString(),
    };

    request.onsuccess = () => {
      if (request.result) {
        resolve({ ...defaultSettings, ...request.result });
      } else {
        resolve(defaultSettings);
      }
    };
    request.onerror = () => {
      resolve(defaultSettings);
    };
  });
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const db = await getDB();
  const current = await getAppSettings();
  const updated: AppSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const request = store.put(updated);
    request.onsuccess = () => resolve(updated);
    request.onerror = () => reject(request.error);
  });
}

// -------------------------------------------------------------
// BACKUP, RESTORE & DATA SYNCHRONIZATION
// -------------------------------------------------------------

export async function exportBackupJSON(): Promise<string> {
  const profile = await getBusinessProfile();
  const parties = await getParties();
  const items = await getItems();
  const transactions = await getTransactions();
  const settings = await getAppSettings();
  const stockAdjustments = await getStockAdjustments();
  const expenses = await getExpenses();
  const expenseCategories = await getExpenseCategories();

  const totalSales = transactions
    .filter((t) => t.type === 'sale_invoice' && t.status === 'active')
    .reduce((sum, t) => sum + (t.totalAmount || 0), 0);

  const backupData = {
    app: 'VyaparGST',
    version: '3.0',
    exportedAt: new Date().toISOString(),
    profile,
    parties,
    items,
    transactions,
    stockAdjustments,
    expenses,
    expenseCategories,
    settings,
    stats: {
      partiesCount: parties.length,
      itemsCount: items.length,
      transactionsCount: transactions.length,
      stockAdjustmentsCount: stockAdjustments.length,
      expensesCount: expenses.length,
      totalSalesAmount: Math.round(totalSales * 100) / 100,
    },
  };

  return JSON.stringify(backupData, null, 2);
}

export function inspectBackupJSON(jsonStr: string): BackupMetadata {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        errorMessage: 'Invalid JSON format.',
        partiesCount: 0,
        itemsCount: 0,
        transactionsCount: 0,
        stockAdjustmentsCount: 0,
        totalSalesAmount: 0,
      };
    }

    if (!data.profile && !data.parties && !data.items && !data.transactions) {
      return {
        isValid: false,
        errorMessage: 'The file does not contain recognized Vyapar GST database records.',
        partiesCount: 0,
        itemsCount: 0,
        transactionsCount: 0,
        stockAdjustmentsCount: 0,
        totalSalesAmount: 0,
      };
    }

    const partiesCount = Array.isArray(data.parties) ? data.parties.length : 0;
    const itemsCount = Array.isArray(data.items) ? data.items.length : 0;
    const transactionsCount = Array.isArray(data.transactions) ? data.transactions.length : 0;
    const stockAdjustmentsCount = Array.isArray(data.stockAdjustments) ? data.stockAdjustments.length : 0;

    let totalSales = 0;
    if (Array.isArray(data.transactions)) {
      totalSales = data.transactions
        .filter((t: any) => t && t.type === 'sale_invoice' && t.status === 'active')
        .reduce((sum: number, t: any) => sum + (Number(t.totalAmount) || 0), 0);
    }

    return {
      isValid: true,
      version: data.version || '1.0',
      exportedAt: data.exportedAt || data.profile?.updatedAt || new Date().toISOString(),
      businessName: data.profile?.businessName || 'Business Profile',
      gstin: data.profile?.gstin || 'N/A',
      partiesCount,
      itemsCount,
      transactionsCount,
      stockAdjustmentsCount,
      totalSalesAmount: Math.round(totalSales * 100) / 100,
    };
  } catch (err: any) {
    return {
      isValid: false,
      errorMessage: err.message || 'Corrupt or unreadable JSON file.',
      partiesCount: 0,
      itemsCount: 0,
      transactionsCount: 0,
      stockAdjustmentsCount: 0,
      totalSalesAmount: 0,
    };
  }
}

export async function getLocalSnapshots(): Promise<LocalSnapshot[]> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get('snapshots');
      req.onsuccess = () => {
        resolve(req.result?.snapshots || []);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveLocalSnapshots(snapshots: LocalSnapshot[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put({ id: 'snapshots', snapshots });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function createLocalSnapshot(reason: string = 'Manual Snapshot'): Promise<LocalSnapshot> {
  const profile = await getBusinessProfile();
  const parties = await getParties();
  const items = await getItems();
  const transactions = await getTransactions();
  const settings = await getAppSettings();
  const stockAdjustments = await getStockAdjustments();

  const totalSales = transactions
    .filter((t) => t.type === 'sale_invoice' && t.status === 'active')
    .reduce((sum, t) => sum + (t.totalAmount || 0), 0);

  const snapshotData = JSON.stringify({
    profile,
    parties,
    items,
    transactions,
    stockAdjustments,
    settings,
  });

  const snapshot: LocalSnapshot = {
    id: `snap_${Date.now()}`,
    name: `${profile?.businessName || 'Business'} Snapshot`,
    timestamp: new Date().toISOString(),
    reason,
    partiesCount: parties.length,
    itemsCount: items.length,
    transactionsCount: transactions.length,
    totalSalesAmount: Math.round(totalSales * 100) / 100,
    data: snapshotData,
  };

  const existing = await getLocalSnapshots();
  const updated = [snapshot, ...existing].slice(0, 10);
  await saveLocalSnapshots(updated);

  return snapshot;
}

export async function restoreLocalSnapshot(snapshotId: string): Promise<{ success: boolean; message: string }> {
  try {
    const snapshots = await getLocalSnapshots();
    const snap = snapshots.find((s) => s.id === snapshotId);
    if (!snap) {
      return { success: false, message: 'Snapshot not found.' };
    }

    await createLocalSnapshot('Auto-point before snapshot rollback');
    return await importBackupJSON(snap.data, 'clean');
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to restore snapshot.' };
  }
}

export async function deleteLocalSnapshot(snapshotId: string): Promise<void> {
  const snapshots = await getLocalSnapshots();
  const filtered = snapshots.filter((s) => s.id !== snapshotId);
  await saveLocalSnapshots(filtered);
}

export async function importBackupJSON(
  jsonStr: string,
  mode: 'clean' | 'merge' = 'clean'
): Promise<{ success: boolean; message: string }> {
  try {
    const data = JSON.parse(jsonStr);
    if (!data.profile && !data.parties && !data.items && !data.transactions) {
      throw new Error('Invalid backup file format.');
    }

    try {
      await createLocalSnapshot(
        mode === 'clean' ? 'Auto-snapshot before Clean Restore' : 'Auto-snapshot before Merge Restore'
      );
    } catch (e) {
      console.warn('Could not create pre-restore snapshot', e);
    }

    const db = await getDB();

    if (mode === 'clean') {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(
          ['business_profile', 'parties', 'items', 'transactions', 'stock_adjustments', 'expenses', 'expense_categories'],
          'readwrite'
        );
        tx.objectStore('business_profile').clear();
        tx.objectStore('parties').clear();
        tx.objectStore('items').clear();
        tx.objectStore('transactions').clear();
        tx.objectStore('stock_adjustments').clear();
        tx.objectStore('expenses').clear();
        tx.objectStore('expense_categories').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    if (data.profile) {
      const tx = db.transaction('business_profile', 'readwrite');
      tx.objectStore('business_profile').put(data.profile);
    }
    if (Array.isArray(data.parties)) {
      const tx = db.transaction('parties', 'readwrite');
      const store = tx.objectStore('parties');
      for (const p of data.parties) store.put(p);
    }
    if (Array.isArray(data.items)) {
      const tx = db.transaction('items', 'readwrite');
      const store = tx.objectStore('items');
      for (const i of data.items) store.put(i);
    }
    if (Array.isArray(data.transactions)) {
      const tx = db.transaction('transactions', 'readwrite');
      const store = tx.objectStore('transactions');
      for (const t of data.transactions) store.put(t);
    }
    if (Array.isArray(data.stockAdjustments)) {
      const tx = db.transaction('stock_adjustments', 'readwrite');
      const store = tx.objectStore('stock_adjustments');
      for (const s of data.stockAdjustments) store.put(s);
    }
    if (Array.isArray(data.expenses)) {
      const tx = db.transaction('expenses', 'readwrite');
      const store = tx.objectStore('expenses');
      for (const exp of data.expenses) store.put(exp);
    }
    if (Array.isArray(data.expenseCategories)) {
      const tx = db.transaction('expense_categories', 'readwrite');
      const store = tx.objectStore('expense_categories');
      for (const cat of data.expenseCategories) store.put(cat);
    }
    if (data.settings) {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put(data.settings);
    }

    return {
      success: true,
      message:
        mode === 'clean'
          ? 'Backup restored cleanly. All records replaced.'
          : 'Backup merged successfully with existing records.',
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to import backup.' };
  }
}

// -------------------------------------------------------------
// DATABASE INTEGRITY & MAINTENANCE
// -------------------------------------------------------------

export async function verifyDatabaseIntegrity(): Promise<IntegrityReport> {
  const parties = await getParties();
  const items = await getItems();
  const transactions = await getTransactions();

  const partyIds = new Set(parties.map((p) => String(p.id)));
  const itemIds = new Set(items.map((i) => String(i.id)));

  let orphanTransactions = 0;
  let negativeStockCount = 0;
  let mismatchedBalances = 0;
  const details: string[] = [];

  for (const t of transactions) {
    if (t.partyId && !partyIds.has(String(t.partyId))) {
      orphanTransactions++;
      details.push(`Transaction ${t.invoiceNo} refers to missing party ID: ${t.partyId}`);
    }
    for (const line of t.items || []) {
      if (line.itemId && !itemIds.has(String(line.itemId))) {
        details.push(`Transaction ${t.invoiceNo} line references missing item ID: ${line.itemId}`);
      }
    }
  }

  for (const item of items) {
    if (item.currentStock < 0) {
      negativeStockCount++;
      details.push(`Item "${item.name}" has negative stock (${item.currentStock} ${item.unit})`);
    }
  }

  for (const party of parties) {
    const calc = await calculatePartyBalance(party);
    if (party.currentBalance !== undefined && Math.abs(party.currentBalance - calc.balance) > 0.05) {
      mismatchedBalances++;
      details.push(
        `Party "${party.name}" balance mismatch (cached: ₹${party.currentBalance}, computed: ₹${calc.balance})`
      );
    }
  }

  const isHealthy = orphanTransactions === 0 && negativeStockCount === 0 && mismatchedBalances === 0;

  return {
    isHealthy,
    totalTransactions: transactions.length,
    totalParties: parties.length,
    totalItems: items.length,
    orphanTransactions,
    negativeStockCount,
    mismatchedBalances,
    details,
  };
}

export async function reconcileDatabase(): Promise<{ partiesUpdated: number; itemsUpdated: number }> {
  const parties = await getParties();
  const items = await getItems();
  const transactions = await getTransactions({ status: 'active' });
  const adjustments = await getStockAdjustments();

  let partiesUpdated = 0;
  for (const party of parties) {
    const { balance } = await calculatePartyBalance(party);
    const existing = await getParty(party.id);
    if (existing) {
      await saveParty({ ...existing, currentBalance: balance });
      partiesUpdated++;
    }
  }

  let itemsUpdated = 0;
  for (const item of items) {
    let stock = item.openingStockQty || 0;

    for (const t of transactions) {
      for (const line of t.items || []) {
        if (String(line.itemId) === String(item.id)) {
          const qty = (Number(line.qty) || 0) + (Number(line.freeQty) || 0);
          if (t.type === 'sale_invoice' || t.type === 'delivery_challan') {
            stock -= qty;
          } else if (t.type === 'purchase_bill' || t.type === 'sale_return') {
            stock += qty;
          }
        }
      }
    }

    for (const adj of adjustments) {
      if (String(adj.itemId) === String(item.id)) {
        if (adj.type === 'add') stock += adj.qty;
        else if (adj.type === 'reduce') stock -= adj.qty;
      }
    }

    const roundedStock = Math.round(stock * 100) / 100;
    const existing = await getItem(item.id);
    if (existing) {
      await saveItem({ ...existing, currentStock: roundedStock });
      itemsUpdated++;
    }
  }

  return { partiesUpdated, itemsUpdated };
}

export async function resetTransactionsOnly(): Promise<void> {
  await createLocalSnapshot('Auto-snapshot before Reset Transactions');

  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['transactions', 'stock_adjustments'], 'readwrite');
    tx.objectStore('transactions').clear();
    tx.objectStore('stock_adjustments').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  const items = await getItems();
  for (const item of items) {
    const existing = await getItem(item.id);
    if (existing) {
      await saveItem({ ...existing, currentStock: item.openingStockQty || 0 });
    }
  }

  const parties = await getParties();
  for (const party of parties) {
    const existing = await getParty(party.id);
    if (existing) {
      await saveParty({ ...existing, currentBalance: party.openingBalance || 0 });
    }
  }
}

export async function factoryResetDatabase(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ['business_profile', 'parties', 'items', 'transactions', 'settings', 'stock_adjustments'],
      'readwrite'
    );
    tx.objectStore('business_profile').clear();
    tx.objectStore('parties').clear();
    tx.objectStore('items').clear();
    tx.objectStore('transactions').clear();
    tx.objectStore('settings').clear();
    tx.objectStore('stock_adjustments').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// -------------------------------------------------------------
// PARTY BALANCE & ITEM TRANSACTION HELPERS
// -------------------------------------------------------------

export async function calculatePartyBalance(
  party: Party
): Promise<{ balance: number; type: 'to_receive' | 'to_pay' }> {
  const transactions = await getTransactions({ partyId: party.id });

  // Start with opening balance: positive = to_receive, negative = to_pay
  let net = party.openingBalanceType === 'to_receive' ? (party.openingBalance || 0) : -(party.openingBalance || 0);

  for (const t of transactions) {
    if (t.status === 'active') {
      if (t.type === 'sale_invoice') {
        // Sale balanceDue increases net receivable
        net += (t.balanceDue !== undefined ? t.balanceDue : (t.totalAmount - (t.receivedAmount || 0)));
      } else if (t.type === 'sale_return') {
        // Sale return (Credit Note) reduces net receivable
        net -= (t.totalAmount || 0);
      } else if (t.type === 'purchase_bill') {
        // Purchase bill balanceDue increases net payable (reduces net receivable)
        net -= (t.balanceDue !== undefined ? t.balanceDue : (t.totalAmount - (t.receivedAmount || 0)));
      } else if (t.type === 'purchase_return') {
        // Purchase return (Debit Note) reduces net payable (increases net receivable)
        net += (t.totalAmount || 0);
      } else if (t.type === 'payment_in') {
        // For payment_in, if linked to invoices, those invoices' balanceDue is already reduced!
        // We only deduct any UNALLOCATED portion (advance on account)
        let allocated = 0;
        if (t.invoiceLinks && t.invoiceLinks.length > 0) {
          allocated = t.invoiceLinks.reduce((sum, link) => sum + (link.amountAllocated || 0), 0);
        }
        const unallocated = Math.max(0, (t.totalAmount || 0) - allocated);
        net -= unallocated;
      } else if (t.type === 'payment_out') {
        // For payment_out, if linked to bills, those bills' balanceDue is already reduced!
        // We only add any UNALLOCATED portion
        let allocated = 0;
        if (t.invoiceLinks && t.invoiceLinks.length > 0) {
          allocated = t.invoiceLinks.reduce((sum, link) => sum + (link.amountAllocated || 0), 0);
        }
        const unallocated = Math.max(0, (t.totalAmount || 0) - allocated);
        net += unallocated;
      }
    }
  }

  const rounded = Math.round(net * 100) / 100;
  if (rounded >= 0) {
    return { balance: rounded, type: 'to_receive' };
  } else {
    return { balance: Math.abs(rounded), type: 'to_pay' };
  }
}

export async function getItemTransactions(itemId: string): Promise<Transaction[]> {
  const all = await getTransactions();
  return all.filter((t) => t.items.some((item) => item.itemId === itemId));
}

export async function getUnpaidInvoicesForParty(
  partyId: string,
  type: 'sale_invoice' | 'purchase_bill' = 'sale_invoice'
): Promise<Transaction[]> {
  const all = await getTransactions({ partyId });
  return all.filter(
    (t) => t.type === type && t.status === 'active' && (t.balanceDue === undefined || t.balanceDue > 0)
  );
}

export async function recordPartyPayment(data: {
  id?: string;
  partyId: string;
  partyName: string;
  amount: number;
  paymentType: 'cash' | 'upi' | 'bank_transfer' | 'cheque';
  type: 'payment_in' | 'payment_out';
  date: string;
  notes?: string;
  referenceNo?: string;
  receiptNo?: string;
  invoiceLinks?: { invoiceId: string; invoiceNo: string; amountAllocated: number }[];
  targetTransactionId?: string;
}): Promise<Transaction> {
  const profile = await getBusinessProfile();
  let invoiceNo = data.receiptNo;

  if (!invoiceNo) {
    if (data.type === 'payment_in') {
      const prefix = profile?.paymentInPrefix || 'REC-';
      const nextNum = profile?.nextPaymentInNumber || 1;
      invoiceNo = `${prefix}${String(nextNum).padStart(4, '0')}`;
    } else {
      const prefix = profile?.paymentOutPrefix || 'PAY-';
      const nextNum = profile?.nextPaymentOutNumber || 1;
      invoiceNo = `${prefix}${String(nextNum).padStart(4, '0')}`;
    }
  }

  // If a single targetTransactionId was passed without invoiceLinks, convert to invoiceLinks
  let links = data.invoiceLinks || [];
  if (data.targetTransactionId && links.length === 0) {
    const targetTx = await getTransaction(data.targetTransactionId);
    if (targetTx) {
      links = [
        {
          invoiceId: targetTx.id,
          invoiceNo: targetTx.invoiceNo,
          amountAllocated: data.amount,
        },
      ];
    }
  }

  const tx = await saveTransaction({
    id: data.id,
    type: data.type,
    invoiceNo,
    receiptNo: invoiceNo,
    referenceNo: data.referenceNo || '',
    date: data.date,
    partyId: data.partyId,
    partyName: data.partyName,
    paymentType: data.paymentType,
    items: [],
    subtotal: data.amount,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalTax: 0,
    roundOff: 0,
    totalAmount: data.amount,
    receivedAmount: data.amount,
    balanceDue: 0,
    invoiceLinks: links,
    description: data.notes || '',
    status: 'active',
  });

  return tx;
}

// -------------------------------------------------------------
// EXPENSES & EXPENSE CATEGORIES
// -------------------------------------------------------------

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity & Water',
  'Transport & Courier',
  'Tea & Refreshments',
  'Salaries & Wages',
  'Printing & Stationery',
  'Marketing & Ads',
  'Repairs & Maintenance',
  'Office Expenses',
  'Miscellaneous',
];

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('expense_categories', 'readonly');
    const store = tx.objectStore('expense_categories');
    const req = store.getAll();
    req.onsuccess = async () => {
      let categories: ExpenseCategory[] = req.result || [];
      if (categories.length === 0) {
        const seeded: ExpenseCategory[] = DEFAULT_EXPENSE_CATEGORIES.map((name, idx) => ({
          id: `cat_${idx + 1}`,
          name,
          isDefault: true,
        }));
        const writeTx = db.transaction('expense_categories', 'readwrite');
        const writeStore = writeTx.objectStore('expense_categories');
        for (const c of seeded) {
          writeStore.put(c);
        }
        writeTx.oncomplete = () => resolve(seeded);
        writeTx.onerror = () => resolve(seeded);
      } else {
        resolve(categories);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveExpenseCategory(cat: { id?: string; name: string }): Promise<ExpenseCategory> {
  const db = await getDB();
  const id = cat.id || `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const record: ExpenseCategory = {
    id,
    name: cat.name.trim(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('expense_categories', 'readwrite');
    const store = tx.objectStore('expense_categories');
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('expense_categories', 'readwrite');
    const store = tx.objectStore('expense_categories');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getExpenses(filter?: {
  category?: string;
  fromDate?: string;
  toDate?: string;
  partyId?: string;
}): Promise<Expense[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('expenses', 'readonly');
    const store = tx.objectStore('expenses');
    const req = store.getAll();
    req.onsuccess = () => {
      let results: Expense[] = req.result || [];
      if (filter) {
        if (filter.category && filter.category !== 'all') {
          results = results.filter((e) => e.category === filter.category);
        }
        if (filter.partyId) {
          results = results.filter((e) => e.partyId === filter.partyId);
        }
        if (filter.fromDate) {
          results = results.filter((e) => e.date >= filter.fromDate!);
        }
        if (filter.toDate) {
          results = results.filter((e) => e.date <= filter.toDate!);
        }
      }
      results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getExpense(id: string): Promise<Expense | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('expenses', 'readonly');
    const store = tx.objectStore('expenses');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveExpense(data: Partial<Expense>): Promise<Expense> {
  const db = await getDB();
  const id = data.id || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  let expenseNo = data.expenseNo;
  if (!expenseNo) {
    const profile = await getBusinessProfile();
    const prefix = profile?.expensePrefix || 'EXP-';
    const nextNum = profile?.nextExpenseNumber || 1;
    expenseNo = `${prefix}${String(nextNum).padStart(4, '0')}`;
    if (profile) {
      profile.nextExpenseNumber = nextNum + 1;
      await saveBusinessProfile(profile);
    }
  }

  const expense: Expense = {
    id,
    expenseNo,
    category: data.category || 'Miscellaneous',
    date: data.date || now.split('T')[0],
    amount: Number(data.amount) || 0,
    paymentType: data.paymentType || 'cash',
    partyId: data.partyId,
    partyName: data.partyName,
    notes: data.notes || '',
    gstAmount: data.gstAmount !== undefined ? Number(data.gstAmount) : undefined,
    taxRate: data.taxRate !== undefined ? Number(data.taxRate) : undefined,
    gstin: data.gstin ? data.gstin.trim().toUpperCase() : undefined,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');
    const req = store.put(expense);
    req.onsuccess = () => resolve(expense);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteExpense(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

