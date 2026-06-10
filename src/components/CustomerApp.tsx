import React, { useState, useEffect } from "react";
import { 
  Coffee, 
  MapPin, 
  ShoppingCart, 
  ChevronRight, 
  RotateCcw, 
  Plus, 
  Minus, 
  Check, 
  Clock, 
  Send,
  Lock,
  Compass,
  AlertCircle,
  Sparkles,
  Search
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MenuItem, Table, TableStatus, Order, OrderItem } from "../types";
import { playSound } from "../lib/sound";

interface CustomerAppProps {
  onNotifyAdmin: () => void;
}

const getGuestId = (): string => {
  let id = localStorage.getItem("resto_guest_id");
  if (!id) {
    id = `guest-${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem("resto_guest_id", id);
  }
  return id;
};

export default function CustomerApp({ onNotifyAdmin }: CustomerAppProps) {
  // State management
  const [tablesList, setTablesList] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedSection, setSelectedSection] = useState<'Food' | 'Drinks'>('Food');
  const [selectedCategory, setSelectedCategory] = useState<string>('Veg');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Local active cart state
  const [cart, setCart] = useState<{ [itemId: string]: number }>({});
  
  // Server-fetched running state
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [activeBill, setActiveBill] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCompleteReceipt, setOrderCompleteReceipt] = useState<any | null>(null);

  // New States: order history & toasts
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Fetch Order History
  const fetchOrderHistory = async () => {
    try {
      const guestId = getGuestId();
      const res = await fetch(`/api/orders/history?guestId=${guestId}`);
      if (res.ok) {
        const data = await res.json();
        setOrderHistory(data);
      }
    } catch (e) {
      console.error("Error loading order history:", e);
    }
  };

  // Centralized Table Refresh
  const refreshCurrentTableState = async () => {
    if (!selectedTable) return;
    try {
      const resT = await fetch("/api/tables");
      const tables: Table[] = await resT.json();
      const currentTable = tables.find(t => t.id === selectedTable.id);
      
      if (currentTable) {
        setSelectedTable(currentTable);
        
        if (currentTable.status === "Idle") {
          if (selectedTable.status === "Bill Requested" || selectedTable.status === "Eating") {
            if (activeBill) {
              setOrderCompleteReceipt(activeBill);
            }
            setActiveOrder(null);
            setActiveBill(null);
            setSelectedTable(null);
            setCart({});
          }
        } else if (currentTable.activeOrderId) {
          const resO = await fetch("/api/orders");
          const allOrders: Order[] = await resO.json();
          const order = allOrders.find(o => o.id === currentTable.activeOrderId);
          if (order) {
            setActiveOrder(order);
          }

          const resB = await fetch(`/api/tables/${currentTable.id}/bill`);
          if (resB.ok) {
            const billData = await resB.json();
            setActiveBill(billData);
          }
        }
      }
      fetchOrderHistory();
    } catch (err) {
      console.error("Error refreshing table state:", err);
    }
  };

  // Fetch Tables & Menu
  const loadInitialData = async () => {
    try {
      const resT = await fetch("/api/tables");
      const dataT = await resT.json();
      setTablesList(dataT);
      
      const resM = await fetch("/api/menu");
      const dataM = await resM.json();
      setMenuItems(dataM);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadInitialData();
    fetchOrderHistory();
  }, []);

  // Poll for Table Status and Active Bills
  useEffect(() => {
    if (!selectedTable) return;

    const pollInterval = setInterval(() => {
      refreshCurrentTableState();
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [selectedTable, activeBill]);

  // Real-time updates via WebSockets
  useEffect(() => {
    if (!selectedTable) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;
    let socket: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connectWs = () => {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("[WS] Connected for table:", selectedTable.id);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "order_status_update") {
            // Trigger status refresh when order update belongs to this table state
            if (payload.tableId === selectedTable.id) {
              refreshCurrentTableState();
            }
          }
        } catch (e) {
          console.error("[WS] Error processing change message:", e);
        }
      };

      socket.onclose = () => {
        reconnectTimer = setTimeout(connectWs, 4000);
      };

      socket.onerror = (err) => {
        console.error("[WS] Socket exception:", err);
      };
    };

    connectWs();

    return () => {
      if (socket) socket.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [selectedTable?.id]);

  // Handle table selection
  const handleSelectTable = async (table: Table) => {
    playSound('tap');
    setSelectedTable(table);
    setCart({});
    setOrderCompleteReceipt(null);
    
    // Set status to ordering if it is currently Idle
    if (table.status === 'Idle') {
      try {
        const res = await fetch(`/api/tables/${table.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Ordering" })
        });
        const updated = await res.json();
        setSelectedTable(updated);
        onNotifyAdmin();
      } catch (e) {
        console.error(e);
      }
    } else if (table.activeOrderId) {
      // Load active order details
      try {
        const resO = await fetch("/api/orders");
        const allOrders: Order[] = await resO.json();
        const order = allOrders.find(o => o.id === table.activeOrderId);
        if (order) setActiveOrder(order);

        const resB = await fetch(`/api/tables/${table.id}/bill`);
        if (resB.ok) {
          const billData = await resB.json();
          setActiveBill(billData);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Cart operations
  const addToCart = (itemId: string) => {
    playSound('tap');
    setCart(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1
    }));
  };

  const removeFromCart = (itemId: string) => {
    playSound('tap');
    setCart(prev => {
      const updated = { ...prev };
      if (!updated[itemId]) return prev;
      if (updated[itemId] === 1) {
        delete updated[itemId];
      } else {
        updated[itemId]--;
      }
      return updated;
    });
  };

  const getCartCount = (): number => {
    return Object.values(cart).reduce<number>((sum, q) => sum + (q as number), 0);
  };

  const getCartSubtotal = (): number => {
    return Object.entries(cart).reduce<number>((sum, [itemId, quantity]) => {
      const item = menuItems.find(i => i.id === itemId);
      return sum + (item ? item.price * (quantity as number) : 0);
    }, 0);
  };

  // Submit/Append Order Action
  const submitCartOrder = async () => {
    if (!selectedTable || getCartCount() === 0) return;
    setIsSubmitting(true);
    try {
      const itemsPayload = Object.entries(cart).map(([menuItemId, quantity]) => ({
        menuItemId,
        quantity
      }));

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedTable.id,
          items: itemsPayload,
          guestId: getGuestId()
        })
      });

      if (res.ok) {
        playSound('bell');
        setCart({});
        // Direct refresh to show updated values quickly
        const data = await res.json();
        setActiveOrder(data.order);
        
        // Refresh table status on state
        const resT = await fetch("/api/tables");
        const tables: Table[] = await resT.json();
        const currentTable = tables.find(t => t.id === selectedTable.id);
        if (currentTable) setSelectedTable(currentTable);

        // Fetch refreshed bill info
        if (selectedTable) {
          const resB = await fetch(`/api/tables/${selectedTable.id}/bill`);
          if (resB.ok) {
            const billData = await resB.json();
            setActiveBill(billData);
          }
        }
        fetchOrderHistory();
        onNotifyAdmin();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Request final billing checkout
  const requestCheckoutBill = async () => {
    if (!selectedTable) return;
    setIsSubmitting(true);
    try {
      playSound('cash');
      const res = await fetch(`/api/tables/${selectedTable.id}/request-bill`, {
        method: "POST"
      });
      if (res.ok) {
        const resT = await fetch("/api/tables");
        const tables: Table[] = await resT.json();
        const currentTable = tables.find(t => t.id === selectedTable.id);
        if (currentTable) setSelectedTable(currentTable);
        onNotifyAdmin();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter items in active browsing view
  const filteredItems = menuItems.filter(item => {
    const matchesQuery = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedSection === 'Food') {
      return item.section === 'Food' && item.category === selectedCategory && matchesQuery;
    } else {
      return item.section === 'Drinks' && item.category === selectedCategory && matchesQuery;
    }
  });

  return (
    <div id="customer-view-root" className="min-h-screen bg-slate-50 flex flex-col relative pb-32 font-sans">
      
      {/* HEADER BAR */}
      <header id="customer-header" className="bg-white px-4 py-4 border-b border-slate-100 sticky top-0 z-40 shadow-xs flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-100">
            Q
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">RestoCore Bistro</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] text-slate-500 font-mono">Digital QR Seating Session</span>
            </div>
          </div>
        </div>

        {selectedTable && (
          <div className="flex items-center gap-2">
            <span className="bg-indigo-55 text-indigo-700 bg-indigo-50 border border-indigo-100 text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5 shadow-xs">
              <MapPin className="w-3 h-3 text-indigo-600" />
              {selectedTable.name}
            </span>
            <button 
              id="btn-return"
              onClick={() => {
                playSound('tap');
                setSelectedTable(null);
                setCart({});
                setActiveBill(null);
                setActiveOrder(null);
              }}
              className="p-1 px-2.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Change Table
            </button>
          </div>
        )}
      </header>

      <div id="customer-content" className="flex-1 max-w-lg mx-auto w-full p-4 space-y-6">

        {/* RECEIPT FROM RECENT PAID BILL */}
        <AnimatePresence>
          {orderCompleteReceipt && (
            <motion.div 
              id="payment-receipt-overlay"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm space-y-4"
            >
              <div className="flex items-start gap-3 justify-between">
                <div className="flex items-center gap-2 text-emerald-800">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="w-4.5 h-4.5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Session Closed Successfully!</h3>
                    <p className="text-xs text-emerald-605 text-emerald-600">Table session has been settled & cleared</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    playSound('tap');
                    setOrderCompleteReceipt(null);
                  }}
                  className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold px-2 py-1 rounded cursor-pointer"
                >
                  Dismiss
                </button>
              </div>

              <div className="bg-white rounded-xl p-4 border border-emerald-100 text-xs space-y-2 text-slate-700">
                <h4 className="font-bold uppercase tracking-wider text-slate-400 font-mono">Transaction Summary</h4>
                <div className="space-y-1.5 divide-y divide-slate-100 pb-2">
                  {orderCompleteReceipt.items.map((item: any, i: number) => (
                     <div key={i} className="flex justify-between py-1 pt-1.5 font-mono">
                       <span>{item.name} <span className="text-slate-400 font-sans">×{item.quantity}</span></span>
                       <span className="text-slate-900 font-semibold">Rs. {(item.price * item.quantity).toFixed(2)}</span>
                     </div>
                  ))}
                </div>
                <div className="flex justify-between font-mono text-slate-500">
                  <span>Subtotal:</span>
                  <span>Rs. {Number(orderCompleteReceipt.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-mono text-slate-500 pb-1.5 border-b border-dashed border-slate-100">
                  <span>Tax (8%):</span>
                  <span>Rs. {Number(orderCompleteReceipt.tax).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold font-mono text-slate-900 text-sm">
                  <span>Grand Total Paid:</span>
                  <span className="text-emerald-600">Rs. {Number(orderCompleteReceipt.total).toFixed(2)}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. TABLE REGISTRATION SELECTION */}
        {!selectedTable ? (
          <motion.div layout id="table-selection-grid" className="space-y-6">
            <div className="text-center py-6 space-y-2">
              <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 font-mono text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full shadow-3xs">
                QR Simulator Seating Mode
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">Choose Your Dine-In Table</h1>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Scan the QR code on any of our dining sections below to initiate your persistent session order.
              </p>
            </div>

            {/* SECTIONS LAYOUT */}
            <motion.div layout className="space-y-6">
              {['Counter', 'Garden', 'Hall', 'Coffee'].map(catType => {
                const zoneTables = tablesList.filter(t => t.category === catType);
                const occupiedCount = zoneTables.filter(t => t.status === 'Ordering' || t.status === 'Eating').length;
                const totalCount = zoneTables.length;

                return (
                  <motion.div layout key={catType} className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{catType} Seating Section</h3>
                      <span className="text-[10px] font-mono font-semibold flex items-center gap-1.5">
                        {occupiedCount > 0 ? (
                          <span className="text-rose-600 bg-rose-50 border border-slate-200 px-2 py-0.5 rounded-full text-[9px]">
                            ● {occupiedCount} Occupied
                          </span>
                        ) : (
                          <span className="text-emerald-600 bg-emerald-50 border border-slate-200 px-2 py-0.5 rounded-full text-[9px]">
                            ● Free
                          </span>
                        )}
                        <span className="text-slate-400 font-sans font-medium text-[10px]">({totalCount - occupiedCount} available)</span>
                      </span>
                    </div>
                    <motion.div layout className="columns-1 sm:columns-2 gap-3 [column-fill:_balance]">
                      {zoneTables.map(t => {
                        let statusColor = "bg-slate-100 text-slate-600 border-slate-200";
                        if (t.status === "Eating") statusColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                        if (t.status === "Bill Requested") statusColor = "bg-amber-50 text-amber-700 border-amber-200";
                        if (t.status === "Ordering") statusColor = "bg-indigo-50 text-indigo-700 border-indigo-100";

                        const isOccupied = t.status === "Ordering" || t.status === "Eating";

                        return (
                          <motion.button
                            layout
                            layoutId={`table-card-${t.id}`}
                            key={t.id}
                            id={`table-${t.id}`}
                            onClick={() => handleSelectTable(t)}
                            className={`inline-block w-full mb-3 break-inside-avoid bg-white border rounded-xl p-4 text-left shadow-xs hover:border-indigo-150 hover:shadow-md transition duration-155 cursor-pointer active:scale-98 space-y-2 ${
                              isOccupied ? "border-slate-300 ring-2 ring-rose-50/50" : "border-slate-200"
                            }`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <span className="font-bold text-slate-850 text-slate-800 text-sm flex items-center gap-1 flex-wrap">
                                <Compass className="w-3.5 h-3.5 text-slate-500" />
                                {t.name}
                              </span>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase ${statusColor}`}>
                                  {t.status === 'Idle' ? 'Idle' : t.status}
                                </span>
                                {isOccupied && (
                                  <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[8px] px-1 py-0.2 rounded font-extrabold uppercase tracking-wider animate-pulse font-sans">
                                    Occupied
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex justify-between items-center text-[10px] text-slate-500">
                              {t.status === 'Idle' ? (
                                <span className="text-indigo-650 text-indigo-600 font-semibold flex items-center gap-1">
                                  TAP TO SCAN <ChevronRight className="w-3 h-3" />
                                </span>
                              ) : (
                                <div className="space-y-0.5 w-full">
                                  <span>Active Session Seated</span>
                                  {t.activeBillTotal > 0 && <span className="block font-semibold font-mono text-slate-800">Rs. {t.activeBillTotal.toFixed(2)}</span>}
                                </div>
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        ) : (
          /* 2. CUSTOMER ACTIVE MENU BROWSING & CART FLOW */
          <div id="customer-active-menu" className="space-y-6">
            
            {/* TABLE SESSION Banner */}
            <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 flex items-center gap-3 justify-between shadow-sm">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-indigo-400">TABLE STATUS CYCLE</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${selectedTable.status === "Bill Requested" ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-pulse"}`}></div>
                  <h3 className="font-bold text-sm tracking-tight">{selectedTable.status}</h3>
                </div>
              </div>

              {activeBill && (
                <div className="text-right">
                  <span className="text-[9px] block text-slate-400 font-mono">Running Total Bill</span>
                  <span className="text-base font-mono font-black text-emerald-400">Rs. {activeBill.total.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* IF BILL IS REQUESTED: LOCKED SCREEN OVERLAY */}
            {selectedTable.status === "Bill Requested" ? (
              <div id="lockdown-bill-requested" className="bg-white rounded-2xl p-6 border border-amber-200 text-center space-y-4 shadow-sm">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                  <Lock className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-extrabold text-slate-900 text-sm">Table Order Locked</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    You have requested the cashier to close and print your table bill. Our staff is bringing the POS payment machine over soon.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs text-left max-w-sm mx-auto space-y-2">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>Active Receipts:</span>
                    <span>{selectedTable.name}</span>
                  </div>
                  {activeBill && (
                    <>
                      <div className="space-y-1 divide-y divide-slate-100 max-h-32 overflow-y-auto pb-1.5 font-mono">
                        {activeBill.items.map((it: any, i: number) => (
                          <div key={i} className="flex justify-between text-[11px] text-slate-600 py-1 pt-1.5">
                            <span>{it.name} <span className="text-slate-400 font-sans">×{it.quantity}</span></span>
                            <span>Rs. {(it.price * it.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between font-mono text-slate-500 border-t border-slate-150 pt-1.5">
                        <span>Subtotal:</span>
                        <span>Rs. {activeBill.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-mono text-slate-500 font-mono">
                        <span>Tax (8%):</span>
                        <span>Rs. {activeBill.tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold font-mono text-slate-900 border-t border-slate-150 pt-1.5">
                        <span>Grand Total Due:</span>
                        <span className="text-amber-700">Rs. {activeBill.total.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="text-amber-605 text-amber-600 text-[10px] flex items-center justify-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Ordering is frozen until cash register clarifies the status.
                </div>
              </div>
            ) : (
              /* CONTINUOUS MENU BROWSING CONTENT */
              <div className="space-y-6">

                {/* 2a. ORDER STATUS REALTIME TRACKING STEPPER */}
                {activeOrder && (
                  <div className="bg-white rounded-2xl p-5 border border-slate-205 mt-2 space-y-4 shadow-xs">
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-indigo-500 animate-pulse" />
                        Live Seated Order Progress
                      </span>
                      <span className="text-[10px] text-indigo-605 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-bold font-mono tracking-wider capitalize">
                        {activeOrder.status === 'pending' ? 'Order Placed' : activeOrder.status}
                      </span>
                    </div>

                    {/* Stepper Progress */}
                    <div className="relative pt-2 pb-1 bg-white">
                      {/* Gray line */}
                      <div className="absolute top-[18px] left-8 right-8 h-1 bg-slate-100 rounded-full" />
                      {/* Blue progress line */}
                      <div 
                        className="absolute top-[18px] left-8 h-1 bg-indigo-600 rounded-full transition-all duration-500"
                        style={{
                          width: `${
                            activeOrder.status === 'pending' ? 0 :
                            activeOrder.status === 'preparing' ? 33 :
                            activeOrder.status === 'ready' ? 66 : 100
                          }%`
                        }}
                      />

                      <div className="grid grid-cols-4 relative z-10 bg-transparent">
                        {[
                          { key: 'pending', label: 'Placed', icon: '📋' },
                          { key: 'preparing', label: 'Preparing', icon: '🍳' },
                          { key: 'ready', label: 'Ready', icon: '🍽️' },
                          { key: 'completed', label: 'Completed', icon: '🎉' }
                        ].map((step, idx) => {
                          const orderStatus = activeOrder.status;
                          const stepStates = ['pending', 'preparing', 'ready', 'completed'];
                          const currentIdx = stepStates.indexOf(orderStatus);
                          
                          const isDone = idx < currentIdx;
                          const isCurrent = idx === currentIdx;

                          return (
                            <div key={idx} className="flex flex-col items-center">
                              <div 
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 border-2 text-xs font-bold ${
                                  isDone 
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-xs" 
                                    : isCurrent
                                    ? "bg-white border-indigo-600 text-indigo-600 ring-4 ring-indigo-50"
                                    : "bg-white border-slate-200 text-slate-300"
                                }`}
                              >
                                {isDone ? (
                                  <Check className="w-4 h-4 stroke-[3px]" />
                                ) : (
                                  <span className="text-sm leading-none">{step.icon}</span>
                                )}
                              </div>
                              <span className={`text-[10px] mt-1.5 font-bold leading-tight ${
                                isCurrent ? "text-indigo-600 font-extrabold" : isDone ? "text-slate-800" : "text-slate-400"
                              }`}>
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2b. PAST SESSION HISTORY SECTION (WITH REORDER TRIGGER) */}
                {orderHistory.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-205 p-4 space-y-3 shadow-3xs">
                    <button 
                      onClick={() => { playSound('tap'); setShowHistory(!showHistory); }}
                      className="w-full flex justify-between items-center text-xs font-bold text-slate-800 outline-none cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <RotateCcw className="w-4 h-4 text-indigo-600" />
                        Dine-In Session Order History ({orderHistory.length})
                      </span>
                      <span className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider hover:underline">
                        {showHistory ? "Collapse" : "Browse Past Orders"}
                      </span>
                    </button>
                    
                    <AnimatePresence>
                      {showHistory && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden space-y-2 divide-y divide-slate-100 pr-1 max-h-56 overflow-y-auto"
                        >
                          {orderHistory.map((past, pIdx) => (
                            <div key={past.orderId} className="pt-2.5 first:pt-0 space-y-2">
                              <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                                <span className="font-mono">Order #{past.orderId.slice(-4).toUpperCase()} ({new Date(past.createdAt).toLocaleDateString()})</span>
                                <span className="font-bold font-mono text-emerald-600">Rs. {past.total.toFixed(2)}</span>
                              </div>
                              
                              <div className="flex justify-between items-center gap-4">
                                <div className="text-[11px] text-slate-600 flex-1 space-y-0.5 pl-2 border-l border-slate-200 font-mono">
                                  {past.items.map((it: any, i: number) => (
                                    <span key={i} className="block">
                                      {it.name} <span className="text-slate-400 font-sans text-[10px]">×{it.quantity}</span>
                                    </span>
                                  ))}
                                </div>
                                
                                <button
                                  type="button"
                                  onClick={() => {
                                    playSound('tap');
                                    setCart(prev => {
                                      const updated = { ...prev };
                                      past.items.forEach((it: any) => {
                                        updated[it.menuItemId] = (updated[it.menuItemId] || 0) + it.quantity;
                                      });
                                      return updated;
                                    });
                                    triggerToast(`Re-added items to your cart!`);
                                  }}
                                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 rounded-lg py-1.5 px-3 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5 stroke-[2.5px]" />
                                  Reorder
                                </button>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    id="search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search menu items..."
                    className="w-full bg-white border border-slate-250 text-slate-805 text-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium focus:outline-none focus:border-indigo-500 transition-colors shadow-3xs"
                  />
                </div>

                {/* FOOD / DRINKS TOGGLE */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      playSound('tap');
                      setSelectedSection('Food');
                      setSelectedCategory('Veg');
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                      selectedSection === 'Food' 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100' 
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    🍴 Food Classics
                  </button>
                  <button
                    onClick={() => {
                      playSound('tap');
                      setSelectedSection('Drinks');
                      setSelectedCategory('Soft Drinks');
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                      selectedSection === 'Drinks' 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100' 
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    🍹 Crafted Drinks
                  </button>
                </div>

                {/* SUBCATEGORIES SLIDER */}
                <div className="flex gap-2">
                  {selectedSection === 'Food' ? (
                    <>
                      <button
                        onClick={() => { playSound('tap'); setSelectedCategory('Veg'); }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border ${selectedCategory === 'Veg' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer'}`}
                      >
                        🥦 pure green veg
                      </button>
                      <button
                        onClick={() => { playSound('tap'); setSelectedCategory('Non-Veg'); }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border ${selectedCategory === 'Non-Veg' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer'}`}
                      >
                        🍖 non-veg choices
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { playSound('tap'); setSelectedCategory('Soft Drinks'); }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border ${selectedCategory === 'Soft Drinks' ? 'bg-sky-50 border-sky-300 text-sky-850' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer'}`}
                      >
                        🥤 mocktails & coolers
                      </button>
                      <button
                        onClick={() => { playSound('tap'); setSelectedCategory('Hard Drinks'); }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border ${selectedCategory === 'Hard Drinks' ? 'bg-violet-50 border-violet-200 text-violet-850' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer'}`}
                      >
                        🍷 premium spirits
                      </button>
                    </>
                  )}
                </div>

                {/* MENU ITEMS GRIDLIST */}
                <div className="space-y-3">
                  {filteredItems.length === 0 ? (
                    <div className="text-center py-10 bg-white border border-slate-200 rounded-xl space-y-1.5 text-slate-500 text-xs shadow-3xs">
                      <p>No matching items found in this section.</p>
                      <p className="text-[10px] text-slate-400 font-mono">Choose a different category or search query.</p>
                    </div>
                  ) : (
                    filteredItems.map(item => {
                      const itemQuantity = cart[item.id] || 0;
                      return (
                        <div 
                          key={item.id} 
                          id={`menu-item-${item.id}`}
                          className="bg-white p-4 rounded-xl border border-slate-200 flex gap-4 items-center justify-between shadow-xs hover:border-slate-300 transition"
                        >
                          <div className="space-y-1 flex-1 pr-2">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-sm text-slate-900">{item.name}</h4>
                              <span className={`text-[9px] px-1.5 rounded-full font-bold uppercase border ${
                                item.category === 'Veg' ? 'bg-emerald-50 text-emerald-805 text-emerald-800 border-emerald-200' :
                                item.category === 'Non-Veg' ? 'bg-rose-50 text-rose-805 text-rose-800 border-rose-200' :
                                item.category === 'Soft Drinks' ? 'bg-sky-50 text-sky-850 border-sky-200' :
                                'bg-violet-50 text-violet-855 text-violet-850 border-violet-200'
                              }`}>
                                {item.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-normal line-clamp-2">{item.description}</p>
                            <span className="text-xs font-bold font-mono text-slate-800 block">Rs. {item.price.toFixed(2)}</span>
                          </div>

                          {/* ACTION BUTTON SYSTEM */}
                          <div className="flex items-center gap-2 h-10">
                            {itemQuantity === 0 ? (
                              <button
                                onClick={() => addToCart(item.id)}
                                className="bg-indigo-600 hover:bg-indigo-700 font-bold text-xs p-1 px-3 text-white rounded-lg cursor-pointer h-full flex items-center justify-center gap-1 transition shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5px]" />
                                Add
                              </button>
                            ) : (
                              <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg h-full overflow-hidden">
                                <button
                                  onClick={() => removeFromCart(item.id)}
                                  className="w-8 h-full flex items-center justify-center text-slate-600 hover:bg-slate-205 transition cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-6 font-bold text-center text-xs text-slate-800 font-mono">
                                  {itemQuantity}
                                </span>
                                <button
                                  onClick={() => addToCart(item.id)}
                                  className="w-8 h-full flex items-center justify-center text-slate-600 hover:bg-slate-205 transition cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* ACTIVE RUNNING TAB PREVIEW PANEL */}
                {activeOrder && (
                  <div className="bg-white rounded-2xl p-5 border border-slate-205 space-y-3 shadow-xs">
                    <div className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-100">
                      <span className="font-bold text-slate-855 text-slate-800 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        Running Order Session items
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {activeOrder.id}</span>
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {activeOrder.items.map((item, i) => {
                        const minsAgo = Math.max(0, Math.round((new Date().getTime() - new Date(item.addedAt).getTime()) / 60000));
                        return (
                          <div key={i} className="flex justify-between text-xs py-1 text-slate-700">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-850 text-slate-800">{item.name}</span>
                                <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-1 rounded font-mono">×{item.quantity}</span>
                              </div>
                              <span className="text-[9px] text-slate-400 block font-mono">Ordered {minsAgo === 0 ? "Just now" : `${minsAgo}m ago`}</span>
                            </div>
                            <span className="font-mono text-slate-900 font-semibold">Rs. {(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {activeBill && (
                      <div className="flex justify-between items-center bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100 font-mono text-xs mt-2">
                        <span className="text-slate-700 font-semibold">Running Total Bill (Inc Tax):</span>
                        <span className="text-indigo-600 font-bold">Rs. {activeBill.total.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FLOAT FLOATING CART & CHECKOUT ACTION BAR */}
      {selectedTable && selectedTable.status !== "Bill Requested" && (
        <div id="customer-flying-cart" className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 shadow-xl z-30 font-sans">
          <div className="max-w-lg mx-auto flex items-center gap-4 justify-between">
            {getCartCount() > 0 ? (
              <div className="space-y-0.5 flex-1 pl-1">
                <span className="text-[9px] uppercase font-mono font-bold tracking-widest text-slate-400">UNSUBMITTED ITEMS</span>
                <div className="flex items-center gap-1.5 font-sans">
                  <span className="text-sm font-black font-mono text-indigo-650 text-indigo-600">Rs. {getCartSubtotal().toFixed(2)}</span>
                  <span className="text-[10px] text-slate-500">({getCartCount()} items ready)</span>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-xs flex-1 flex items-center gap-2 pl-1.5">
                <ShoppingCart className="w-4 h-4 text-slate-400" />
                <span>Cart empty. Add items to order.</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {getCartCount() > 0 && (
                <button
                  id="btn-place-order"
                  onClick={submitCartOrder}
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition whitespace-nowrap shadow-md shadow-indigo-100 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {activeOrder ? "Append to Session" : "Place Order"}
                </button>
              )}

              {activeOrder && getCartCount() === 0 && (
                <button
                  id="btn-request-bill"
                  type="button"
                  onClick={requestCheckoutBill}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition whitespace-nowrap shadow-md shadow-indigo-100"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Request Final Bill
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REALTIME TOAST NOTIFICATION HUD */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-white rounded-xl py-2.5 px-4 shadow-xl text-[11px] font-bold flex items-center gap-2 z-50 whitespace-nowrap"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3px]" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
