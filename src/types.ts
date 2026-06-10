/**
 * Shared Type Definitions for the Restaurant Ordering App
 */

export type TableStatus = 'Idle' | 'Ordering' | 'Eating' | 'Bill Requested';

export interface Table {
  id: string; // e.g., 'counter-1', 'garden-2', 'hall', 'coffee-3'
  name: string; // e.g., 'Counter 1', 'Garden 2', 'Hall Table', 'Coffee 3'
  category: 'Counter' | 'Garden' | 'Hall' | 'Coffee';
  status: TableStatus;
  activeOrderId?: string | null;
  updatedAt: string;
}

export type MenuCategoryType = 'Veg' | 'Non-Veg' | 'Soft Drinks' | 'Hard Drinks';
export type MenuSection = 'Food' | 'Drinks';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  section: MenuSection; // 'Food' or 'Drinks'
  category: MenuCategoryType; // 'Veg', 'Non-Veg', 'Soft Drinks', 'Hard Drinks'
  description: string;
  isAvailable: boolean;
  image?: string;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  addedAt: string; // ISO string to track incremental additions
}

export interface Order {
  id: string;
  tableId: string;
  items: OrderItem[];
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  createdAt: string;
  updatedAt: string;
  guestId?: string;
}

export interface Bill {
  id: string;
  tableId: string;
  orderId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: 'pending' | 'paid';
  paymentMethod?: 'Esewa' | 'Fonepay' | 'Cash' | 'Bank';
  requestedAt: string;
  finalizedAt?: string;
  guestId?: string;
}

export interface AdminStats {
  todayRevenue: number;
  activeTablesCount: number;
  pendingOrdersCount: number;
  completedBillsCount: number;
}
