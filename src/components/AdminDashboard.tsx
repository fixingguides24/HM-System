import React, { useState, useEffect } from "react";
import { 
  DollarSign, 
  Users, 
  Utensils, 
  CheckCircle, 
  Trash2, 
  Edit, 
  Plus, 
  Check, 
  Volume2, 
  VolumeX, 
  AlertCircle, 
  Lock, 
  Menu as MenuIcon, 
  RefreshCw, 
  Clock, 
  Printer, 
  Filter,
  CheckCheck,
  Power,
  X,
  Search,
  Eye,
  EyeOff,
  Receipt,
  FileText
} from "lucide-react";
import { MenuItem, Table, TableStatus, Order, Bill, AdminStats } from "../types";
import { playSound } from "../lib/sound";

export default function AdminDashboard() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showCredentials, setShowCredentials] = useState(false);

  // Sound Config
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Operational State
  const [tablesList, setTablesList] = useState<Table[]>([]);
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    todayRevenue: 0,
    activeTablesCount: 0,
    pendingOrdersCount: 0,
    completedBillsCount: 0
  });

  // Selected state for editing & checkout
  const [selectedBillTable, setSelectedBillTable] = useState<Table | null>(null);
  const [activeBillDetail, setActiveBillDetail] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Esewa' | 'Fonepay' | 'Cash' | 'Bank'>('Esewa');

  // Menu CRUD Modal State
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState({
    name: "",
    price: "",
    section: "Food" as "Food" | "Drinks",
    category: "Veg" as any,
    description: "",
    isAvailable: true
  });

  // UX Navigation & Compliant Validation States
  const [activeTab, setActiveTab] = useState<"operations" | "kitchen" | "menu" | "billing">("operations");
  const [billingHistory, setBillingHistory] = useState<Bill[]>([]);
  const [billingSearch, setBillingSearch] = useState("");
  const [billingMethodFilter, setBillingMethodFilter] = useState<"All" | "Esewa" | "Fonepay" | "Cash" | "Bank">("All");
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<"All" | "Veg" | "Non-Veg" | "Soft Drinks" | "Hard Drinks">("All");
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [deletingMenuItemObj, setDeletingMenuItemObj] = useState<MenuItem | null>(null);
  const [forceResetTableObj, setForceResetTableObj] = useState<Table | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Refresh operational feed data
  const refreshDashboardData = async () => {
    try {
      // 1. Tables Status
      const resT = await fetch("/api/tables");
      const dataT = await resT.json();
      setTablesList(dataT);

      // 2. Orders feed
      const resO = await fetch("/api/orders");
      const dataO = await resO.json();
      setOrdersList(dataO);

      // 3. Menu grid
      const resM = await fetch("/api/menu");
      const dataM = await resM.json();
      setMenuItems(dataM);

      // 4. Alerts (sound trigger)
      const resA = await fetch("/api/admin/alerts");
      const dataA = await resA.json();
      
      // Check if there are any new unread alerts to trigger pings!
      const unreadAlerts = dataA.filter((a: any) => !a.read);
      if (unreadAlerts.length > 0 && soundEnabled && isAuthenticated) {
        // Trigger matching pings based on severe actions
        const hasBillReq = unreadAlerts.some((a: any) => a.type === 'bill_request');
        const hasNewOrder = unreadAlerts.some((a: any) => a.type === 'new_order' || a.type === 'amended_order');
        if (hasBillReq) {
          playSound('cash');
        } else if (hasNewOrder) {
          playSound('bell');
        } else {
          playSound('tap');
        }
        
        // Auto-ack on server to prevent recurring bell loops on polling
        await fetch("/api/admin/alerts/read", { method: "POST" });
      }
      setAlerts(dataA);

      // 5. Admin KPIs Stats
      const resS = await fetch("/api/admin/stats");
      const dataS = await resS.json();
      setStats(dataS);

      // 6. Billing history
      const resB = await fetch("/api/admin/bills");
      if (resB.ok) {
        const dataB = await resB.json();
        setBillingHistory(dataB);
      }
    } catch (e) {
      console.error("Dashboard error syncing: ", e);
    }
  };

  // Poll for real time updates
  useEffect(() => {
    if (isAuthenticated) {
      refreshDashboardData();
      const interval = setInterval(refreshDashboardData, 3000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, soundEnabled]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        playSound('bell');
        setIsAuthenticated(true);
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch (err) {
      setLoginError("Server communication failed.");
    }
  };

  // Kitchen Mark Order Served
  const handleMarkServed = async (orderId: string) => {
    try {
      playSound('tap');
      const res = await fetch(`/api/orders/${orderId}/serve`, { method: "POST" });
      if (res.ok) {
        refreshDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Kitchen Update Order Status Progression
  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      playSound('tap');
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        refreshDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Initiate table checkout bill generation
  const handleInitiatePayment = async (table: Table) => {
    playSound('tap');
    setSelectedBillTable(table);
    try {
      const res = await fetch(`/api/tables/${table.id}/bill`);
      if (res.ok) {
        const bill = await res.json();
        setActiveBillDetail(bill);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Process and clear Table Checkout Session
  const handleFinalizeBill = async () => {
    if (!selectedBillTable) return;
    try {
      playSound('cash');
      const res = await fetch(`/api/tables/${selectedBillTable.id}/finalize-bill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod })
      });
      if (res.ok) {
        setSelectedBillTable(null);
        setActiveBillDetail(null);
        refreshDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Force Clear Table Session (Admin Override Option)
  const handleForceResetTableConfirmed = async () => {
    if (!forceResetTableObj) return;
    try {
      playSound('tap');
      const res = await fetch(`/api/tables/${forceResetTableObj.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Idle" })
      });
      if (res.ok) {
        setForceResetTableObj(null);
        refreshDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Menu Form handles
  const handleOpenAddMenu = () => {
    setEditingMenuItem(null);
    setFormError(null);
    setMenuForm({
      name: "",
      price: "",
      section: "Food",
      category: "Veg",
      description: "",
      isAvailable: true
    });
    setIsMenuModalOpen(true);
  };

  const handleOpenEditMenu = (item: MenuItem) => {
    setEditingMenuItem(item);
    setFormError(null);
    setMenuForm({
      name: item.name,
      price: item.price.toString(),
      section: item.section,
      category: item.category,
      description: item.description,
      isAvailable: item.isAvailable
    });
    setIsMenuModalOpen(true);
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuForm.name || isNaN(Number(menuForm.price)) || Number(menuForm.price) < 0) {
      setFormError("Please enter a valid Name and positive Price.");
      return;
    }

    try {
      playSound('tap');
      let res;
      if (editingMenuItem) {
        // Edit PUT
        res = await fetch(`/api/menu/${editingMenuItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...menuForm,
            price: Number(menuForm.price)
          })
        });
      } else {
        // Create POST
        res = await fetch("/api/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...menuForm,
            price: Number(menuForm.price)
          })
        });
      }

      if (res.ok) {
        setFormError(null);
        setIsMenuModalOpen(false);
        refreshDashboardData();
      } else {
        const errData = await res.json();
        setFormError(errData.error || "Failed to save menu catalog record.");
      }
    } catch (err) {
      console.error(err);
      setFormError("Communication error with server.");
    }
  };

  const handleDeleteMenuItemConfirmed = async () => {
    if (!deletingMenuItemObj) return;
    try {
      playSound('tap');
      const res = await fetch(`/api/menu/${deletingMenuItemObj.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeletingMenuItemObj(null);
        refreshDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMenuAvailability = async (item: MenuItem) => {
    try {
      playSound('tap');
      const res = await fetch(`/api/menu/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !item.isAvailable })
      });
      if (res.ok) refreshDashboardData();
    } catch (e) {
      console.error(e);
    }
  };

  // Section Selector Logic for subcategories inside Admin Grid Form
  const triggerCategorySectionSwap = (sect: "Food" | "Drinks") => {
    setMenuForm(prev => ({
      ...prev,
      section: sect,
      category: sect === "Food" ? "Veg" : "Soft Drinks"
    }));
  };

  if (!isAuthenticated) {
    return (
      <div id="admin-login" className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-250 p-8 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full font-mono">
              RestoCore Control Desk
            </span>
            <h1 className="text-xl font-bold text-slate-900">Owner Security Login</h1>
            <p className="text-xs text-slate-500">Enter credentials to govern active tables, kitchen orders, & menus.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-xs font-medium text-slate-700">
            <div className="space-y-1.5 animate-slide-in">
              <label className="block text-slate-500 uppercase tracking-wider text-[10px] font-bold">Manager Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Manager username"
                className="w-full bg-slate-50 border border-slate-205 text-slate-900 rounded-xl p-3 focus:outline-none focus:border-indigo-500 font-semibold focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-slate-500 uppercase tracking-wider text-[10px] font-bold">Passkey</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Manager passkey"
                className="w-full bg-slate-50 border border-slate-205 text-slate-900 rounded-xl p-3 focus:outline-none focus:border-indigo-500 font-semibold focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {loginError && (
              <div className="text-rose-600 bg-rose-50 p-2.5 rounded-lg text-xs font-semibold border border-rose-100 flex items-center gap-1.5 animate-bounce">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              id="admin-btn-login"
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-3 rounded-xl transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-100 text-xs uppercase tracking-wider"
            >
              <Lock className="w-3.5 h-3.5" />
              Unlock Console
            </button>
          </form>


        </div>
      </div>
    );
  }

  // Filter menu catalog inside Menu Tab
  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(menuSearchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(menuSearchQuery.toLowerCase());
    const matchesCategory = menuCategoryFilter === "All" || item.category === menuCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Dynamic stats calculation for Billing Ledger
  const esewaTotal = billingHistory.filter(b => b.paymentMethod === 'Esewa').reduce((sum, b) => sum + b.total, 0);
  const fonepayTotal = billingHistory.filter(b => b.paymentMethod === 'Fonepay').reduce((sum, b) => sum + b.total, 0);
  const cashTotal = billingHistory.filter(b => b.paymentMethod === 'Cash').reduce((sum, b) => sum + b.total, 0);
  const bankTotal = billingHistory.filter(b => b.paymentMethod === 'Bank').reduce((sum, b) => sum + b.total, 0);
  const ledgerTotalCombined = billingHistory.reduce((sum, b) => sum + b.total, 0);

  // Filtered bills
  const filteredBills = billingHistory.filter(b => {
    // Payment method filter
    if (billingMethodFilter !== 'All' && b.paymentMethod !== billingMethodFilter) {
      return false;
    }
    // Search query matching
    if (billingSearch.trim() !== '') {
      const query = billingSearch.toLowerCase();
      const matchId = b.id.toLowerCase().includes(query);
      const matchTableId = b.tableId.toLowerCase().includes(query);
      const matchMethod = b.paymentMethod?.toLowerCase().includes(query) || false;
      const matchItems = b.items.some(it => it.name.toLowerCase().includes(query));
      
      const tableObj = tablesList.find(t => t.id === b.tableId);
      const matchTableName = tableObj ? tableObj.name.toLowerCase().includes(query) : false;

      return matchId || matchTableId || matchMethod || matchItems || matchTableName;
    }
    return true;
  });

  return (
    <div id="admin-dashboard-root" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* HEADER Control bar */}
      <header className="h-16 bg-white border-b border-slate-205 px-6 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-lg font-bold text-sm tracking-tight shadow-md">
            RK
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              RestoCore Gov-Desk
              <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-205 font-mono font-bold uppercase py-0.5 px-2 rounded-full">
                Live Server Connection
              </span>
            </h1>
            <p className="text-[10px] text-slate-500 font-mono">Operations and Menu Intelligence Hub</p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-4">
          {/* Sounds */}
          <button
            onClick={() => { playSound('tap'); setSoundEnabled(!soundEnabled); }}
            className={`p-2 rounded-lg border flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition ${
              soundEnabled 
                ? "bg-slate-50 border-slate-250 text-slate-705 text-slate-700" 
                : "bg-rose-50 border-rose-200 text-rose-700"
            }`}
            title="Toggle Notification Sounds"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-500" />}
            <span className="hidden sm:inline">{soundEnabled ? "Sound On" : "Muted"}</span>
          </button>

          {/* Sync Trigger */}
          <button 
            onClick={() => { playSound('tap'); refreshDashboardData(); }}
            className="p-2 border border-slate-255 border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer active:scale-95"
            title="Manual Feed Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Lock/Exit */}
          <button 
            onClick={() => { playSound('tap'); setIsAuthenticated(false); }}
            className="p-2 border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-750 text-rose-700 rounded-lg transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
          >
            <Power className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lock Console</span>
          </button>
        </div>
      </header>

      {/* STATS STRIP bar */}
      <section id="stats-ribbon" className="bg-white border-b border-slate-205 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <div 
          onClick={() => { playSound('tap'); setActiveTab("billing"); }}
          className="flex items-center p-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-150 gap-3.5 rounded-xl cursor-pointer transition active:scale-98 select-none"
          title="See detailed Billing Ledger"
        >
          <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-lg border border-emerald-200">
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono">Today Revenue</span>
            <div className="text-lg font-mono font-black text-slate-900">Rs. {stats.todayRevenue.toFixed(2)}</div>
          </div>
        </div>

        <div className="flex items-center p-3.5 bg-slate-50 rounded-xl border border-slate-150 gap-3.5">
          <div className="bg-indigo-100 text-indigo-700 p-2.5 rounded-lg">
            <Utensils className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono">Governed Tables</span>
            <div className="text-lg font-mono font-black text-slate-900">{stats.activeTablesCount} / {tablesList.length}</div>
          </div>
        </div>

        <div className="flex items-center p-3.5 bg-slate-50 rounded-xl border border-slate-150 gap-3.5">
          <div className="bg-amber-100 text-amber-700 p-2.5 rounded-lg animate-pulse">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono">Kitchen Orders</span>
            <div className="text-lg font-mono font-black text-slate-900">{stats.pendingOrdersCount} cooking</div>
          </div>
        </div>

        <div 
          onClick={() => { playSound('tap'); setActiveTab("billing"); }}
          className="flex items-center p-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-150 gap-3.5 rounded-xl cursor-pointer transition active:scale-98 select-none"
          title="See detailed Billing Ledger"
        >
          <div className="bg-indigo-100 text-indigo-700 p-2.5 rounded-lg border border-indigo-200">
            <CheckCircle className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono">Succeeded Bills</span>
            <div className="text-lg font-mono font-black text-slate-900">{stats.completedBillsCount} bills</div>
          </div>
        </div>
      </section>

      {/* CORE DESK NAVIGATION TABS */}
      <div id="desk-navigation-tabs" className="bg-slate-100/50 border-b border-slate-205 flex px-6 py-2 gap-2 justify-between items-center bg-white shrink-0">
        <div className="flex gap-1.5">
          <button 
            onClick={() => { playSound('tap'); setActiveTab("operations"); }}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold leading-none cursor-pointer border flex items-center gap-1.5 transition ${
              activeTab === "operations" 
                ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                : "bg-white text-slate-655 text-slate-600 border-slate-205 hover:bg-slate-50"
            }`}
          >
            <Users className="w-3.5 h-3.5 font-bold" />
            Operations Floor Monitor
          </button>

          <button 
            onClick={() => { playSound('tap'); setActiveTab("kitchen"); }}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold leading-none cursor-pointer border flex items-center gap-1.5 transition ${
              activeTab === "kitchen" 
                ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                : "bg-white text-slate-655 text-slate-600 border-slate-205 hover:bg-slate-50"
            }`}
          >
            <Clock className="w-3.5 h-3.5 animate-spin-slow" />
            Kitchen Order Queue [{ordersList.filter(o => o.status !== 'completed').length}]
          </button>

          <button 
            onClick={() => { playSound('tap'); setActiveTab("menu"); }}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold leading-none cursor-pointer border flex items-center gap-1.5 transition ${
              activeTab === "menu" 
                ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                : "bg-white text-slate-655 text-slate-600 border-slate-205 hover:bg-slate-50"
            }`}
          >
            <MenuIcon className="w-3.5 h-3.5" />
            Menu Catalog Manager
          </button>

          <button 
            id="tab-billing-ledger-btn"
            onClick={() => { playSound('tap'); setActiveTab("billing"); }}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold leading-none cursor-pointer border flex items-center gap-1.5 transition ${
              activeTab === "billing" 
                ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                : "bg-white text-slate-655 text-slate-600 border-slate-205 hover:bg-slate-50"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Billing & Sales Ledger
          </button>
        </div>

        <div className="text-[10px] text-slate-400 font-mono hidden md:block">
          Owner Control Dashboard
        </div>
      </div>

      {/* THREE-TAB CONTENT DISPLAY CONTAINER */}
      <main className="flex-1 p-6 overflow-y-auto space-y-6">

        {/* TAB 1: OPERATIONS SEATING FLOOR MONITOR */}
        {activeTab === "operations" && (
          <div id="tab-operations-floor" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Active Seating Floor Table Layout</h2>
                <p className="text-xs text-slate-500">Monitor eating sessions, bill checkouts, and execute supervisor overrides.</p>
              </div>
              <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-150 font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Total Seating capacity: {tablesList.length} Tables
              </span>
            </div>

            {/* SECTIONS GRIDS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {['Counter', 'Garden', 'Hall', 'Coffee'].map(cat => {
                const grpTables = tablesList.filter(t => t.category === cat);
                return (
                  <div key={cat} className="bg-white border border-slate-205 rounded-xl p-4 space-y-3 shadow-xs">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none pb-1.5 border-b border-slate-100">{cat} Table Zone</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {grpTables.map(table => {
                        let badgeColor = "bg-slate-100 text-slate-600 border-slate-200";
                        if (table.status === "Eating") badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
                        if (table.status === "Ordering") badgeColor = "bg-indigo-100 text-indigo-800 border-indigo-200";
                        if (table.status === "Bill Requested") badgeColor = "bg-amber-100 text-amber-800 border-amber-250 animate-pulse";

                        return (
                          <div 
                            key={table.id}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 hover:shadow-sm hover:border-slate-350 transition flex flex-col justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex justify-between items-center gap-2">
                                <span className="font-bold text-slate-800 text-sm leading-tight">{table.name}</span>
                                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border leading-none ${badgeColor}`}>
                                  {table.status}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-mono leading-none">Last revised: {new Date(table.updatedAt).toLocaleTimeString()}</p>
                            </div>

                            <div className="flex justify-between items-end border-t border-slate-150 pt-2 text-xs">
                              <div className="font-mono">
                                {table.status !== "Idle" && table.activeBillTotal > 0 ? (
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] text-slate-500 block font-sans">Running total</span>
                                    <span className="text-emerald-705 font-bold text-emerald-700">Rs. {table.activeBillTotal.toFixed(2)}</span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 block pt-1">No pending total</span>
                                )}
                              </div>

                              <div className="flex gap-1.5">
                                {/* Initiate Payment Bill */}
                                {table.status === 'Bill Requested' && (
                                  <button
                                    onClick={() => handleInitiatePayment(table)}
                                    className="bg-amber-500 hover:bg-amber-600 border border-amber-500 text-white text-[10px] font-bold py-1.5 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer transition shadow-xs"
                                  >
                                    <DollarSign className="w-3.5 h-3.5" />
                                    Checkout
                                  </button>
                                )}

                                {table.status === 'Eating' && (
                                  <button
                                    onClick={() => handleInitiatePayment(table)}
                                    className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 border border-slate-250 text-slate-600 text-[10px] font-semibold py-1.5 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer transition"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                    Pre-Print Bill
                                  </button>
                                )}

                                {/* Force supervisor status override */}
                                <button
                                  onClick={() => { playSound('tap'); setForceResetTableObj(table); }}
                                  className="p-1 px-1.5 rounded-lg border border-slate-250 hover:bg-rose-50 hover:text-rose-700 text-slate-450 text-slate-500 transition cursor-pointer"
                                  title="Force Manual Admin Override"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: KITCHEN ORDER PREPARATION QUEUE */}
        {activeTab === "kitchen" && (
          <div id="tab-kitchen-queue" className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Standard Kitchen Preparation Flow Queue</h2>
                <p className="text-xs text-slate-500">Coordinate and progress cooking status states in real-time, emitting WebSocket status triggers to user phones.</p>
              </div>

              <div className="flex gap-3">
                <span className="bg-slate-100 text-slate-700 border border-slate-255 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 font-mono">
                  Pending: {ordersList.filter(o => o.status === 'pending').length}
                </span>
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 font-mono">
                  Cooking: {ordersList.filter(o => o.status === 'preparing').length}
                </span>
              </div>
            </div>

            {/* ORDERS ACCORDIONS */}
            {ordersList.filter(o => o.status !== 'completed').length === 0 ? (
              <div className="text-center py-20 bg-white border border-slate-205 rounded-xl space-y-2 text-slate-500 shadow-3xs max-w-md mx-auto">
                <Clock className="w-8 h-8 text-indigo-400 mx-auto animate-pulse" />
                <h3 className="font-bold text-slate-800 text-sm">Chef Queue is Empty</h3>
                <p className="text-xs max-w-xs mx-auto">Tasty greetings! There are no uncompleted or prep-phase dine-in food tickets at the moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {ordersList.filter(o => o.status !== 'completed').map(order => {
                  const itemsCount = order.items.reduce((s, it) => s + it.quantity, 0);
                  const orderTimeElapse = Math.max(0, Math.round((new Date().getTime() - new Date(order.createdAt).getTime()) / 60000));
                  
                  let cardBorder = "border-slate-200";
                  let bgLeftGlow = "bg-slate-100";
                  if (order.status === 'pending') {
                    cardBorder = "border-red-200 hover:border-red-300 ring-1 ring-red-50";
                    bgLeftGlow = "bg-red-500";
                  } else if (order.status === 'preparing') {
                    cardBorder = "border-amber-200 hover:border-amber-305";
                    bgLeftGlow = "bg-amber-500";
                  } else if (order.status === 'ready') {
                    cardBorder = "border-indigo-200 hover:border-indigo-305";
                    bgLeftGlow = "bg-indigo-600";
                  }

                  return (
                    <div 
                      key={order.id} 
                      className={`bg-white border text-xs rounded-xl shadow-xs overflow-hidden ${cardBorder} transition flex flex-col justify-between`}
                    >
                      {/* Top banner */}
                      <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-slate-850 flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${bgLeftGlow}`}></span>
                            Order #{order.id.slice(-4).toUpperCase()}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-semibold font-mono block">
                            Table: {tablesList.find(t => t.id === order.tableId)?.name || order.tableId}
                          </span>
                        </div>

                        <div className="text-right space-y-0.5 font-mono text-[10px] text-slate-400">
                          <span className="block font-bold text-slate-650 text-slate-700">{itemsCount} units</span>
                          <span className={`${orderTimeElapse > 10 ? 'text-red-500 font-bold' : ''}`}>
                            🏁 {orderTimeElapse === 0 ? "just now" : `${orderTimeElapse}m ago`}
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="p-4 space-y-2.5 flex-1 select-all font-mono min-h-24">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-start border-b border-dashed border-slate-100 pb-1.5 last:border-0 last:pb-0">
                            <div>
                              <div className="flex items-center gap-1.5 font-bold">
                                <span className="text-slate-800 text-[12px]">{it.name}</span>
                                <span className="text-indigo-600 text-[11px] bg-indigo-50 border border-indigo-100 p-0.5 px-1.5 rounded-md">×{it.quantity}</span>
                              </div>
                              <span className="text-[9px] text-slate-400 block">Ordered {Math.max(0, Math.round((new Date().getTime() - new Date(it.addedAt).getTime()) / 60000))}m ago</span>
                            </div>
                            <span className="text-slate-500 font-medium text-[11px] pt-1">Rs. {(it.price * it.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Bottom workflow progressions */}
                      <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex gap-2">
                        {order.status === "pending" && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, "preparing")}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold p-2 rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer flex-1 transition shadow-3xs"
                          >
                            🍳 Melt Ingredients (Start Cook)
                          </button>
                        )}

                        {order.status === "preparing" && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, "ready")}
                            className="bg-indigo-605 bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold p-2 rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer flex-1 transition shadow-3xs"
                          >
                            🍽️ Set Ready (Finish Cooking)
                          </button>
                        )}

                        {order.status === "ready" && (
                          <button
                            onClick={() => handleMarkServed(order.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold p-2 rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer flex-1 transition shadow-3xs"
                          >
                            <CheckCheck className="w-3.5 h-3.5 stroke-[3px]" />
                            Deliver to Table (Mark Served)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MENU INVENTORY CATALOG MANAGER */}
        {activeTab === "menu" && (
          <div id="tab-menu-catalog" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Active Menu Selections Catalog</h2>
                <p className="text-xs text-slate-500">Perform seamless additions, view stock details, toggle status ranges, and govern live prices in Rupees.</p>
              </div>

              <button
                id="btn-add-menu-item"
                onClick={handleOpenAddMenu}
                className="bg-indigo-600 hover:bg-indigo-505 hover:bg-indigo-500 text-white font-black text-xs p-3 px-4 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer tracking-wider uppercase shadow-md shadow-indigo-100 select-none align-middle"
              >
                <Plus className="w-4 h-4 stroke-[3px]" />
                Add New Product Menu
              </button>
            </div>

            {/* SEARCH AND PILLS FILTER CONTROLS */}
            <div className="bg-white rounded-xl border border-slate-205 p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-3xs">
              
              {/* Category Pills */}
              <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
                {["All", "Veg", "Non-Veg", "Soft Drinks", "Hard Drinks"].map((cat) => (
                  <button 
                    key={cat}
                    onClick={() => { playSound('tap'); setMenuCategoryFilter(cat as any); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border leading-none transition ${
                      menuCategoryFilter === cat 
                        ? "bg-slate-900 text-white border-slate-900 shadow-2xs font-extrabold" 
                        : "bg-slate-50 text-slate-600 border-slate-205 hover:bg-slate-100"
                    }`}
                  >
                    {cat === "All" ? "🌍 See All Records" :
                     cat === "Veg" ? "🥦 pure green veg" :
                     cat === "Non-Veg" ? "🍖 non-veg choices" :
                     cat === "Soft Drinks" ? "🥤 mocktails & coolers" : "🍷 premium spirits"}
                  </button>
                ))}
              </div>

              {/* Text Search queries */}
              <div className="relative w-full md:max-w-xs shrink-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Filter records by name..."
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-205 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold text-slate-850 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* CATALOG LIST GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredMenuItems.map(item => (
                <div 
                  key={item.id} 
                  id={`catalog-item-${item.id}`}
                  className={`bg-white border rounded-xl overflow-hidden shadow-2xs hover:shadow-md hover:border-slate-300 transition flex flex-col justify-between text-xs ${
                    !item.isAvailable ? "border-slate-200 bg-slate-506 bg-slate-50 opacity-80" : "border-slate-205"
                  }`}
                >
                  <div className="p-4 space-y-2.5">
                    
                    {/* Catalog Header Info */}
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-extrabold text-slate-900 text-sm leading-tight">{item.name}</h4>
                          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border leading-none ${
                            item.category === 'Veg' ? 'bg-emerald-50 text-emerald-800 border-emerald-250' :
                            item.category === 'Non-Veg' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                            item.category === 'Soft Drinks' ? 'bg-sky-50 text-sky-850 border-sky-200' :
                            'bg-violet-50 text-violet-850 border-violet-200'
                          }`}>
                            {item.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">Reference item-ID: {item.id}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-mono font-black text-slate-950 block">Rs. {item.price.toFixed(2)}</span>
                        <span className="text-[10px] block font-semibold text-slate-400 font-mono">MRP Rate</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-normal line-clamp-3 select-all">{item.description}</p>
                  </div>

                  {/* Stock Availability Toggle & Manager Actions */}
                  <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-2">
                    <button
                      onClick={() => handleToggleMenuAvailability(item)}
                      className={`py-1.5 px-3 rounded-lg border text-[10px] font-black uppercase tracking-wider transition cursor-pointer flex-1 flex items-center justify-center gap-1 ${
                        item.isAvailable 
                          ? "bg-emerald-50 border-emerald-150 hover:bg-emerald-100 text-emerald-700" 
                          : "bg-rose-50 border-rose-150 hover:bg-rose-100 text-rose-700"
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {item.isAvailable ? "Active In-Stock" : "Sold-Out Blocked"}
                    </button>

                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleOpenEditMenu(item)}
                        className="p-1 px-2.5 rounded-lg border border-slate-250 hover:bg-slate-100 text-slate-600 transition cursor-pointer flex items-center justify-center"
                        title="Edit catalog metadata"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* Correctly setting state opens confirmation modal, fixing product deletion */}
                      <button
                        onClick={() => { playSound('tap'); setDeletingMenuItemObj(item); }}
                        className="p-1 px-2.5 rounded-lg border border-rose-150 hover:bg-rose-50 text-rose-600 transition cursor-pointer flex items-center justify-center"
                        title="Delete product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: BILLING & SALES LEDGER ARCHIVE */}
        {activeTab === "billing" && (
          <div id="tab-billing-ledger" className="space-y-6 animate-fade-in">
            {/* Upper row: Page Header & Combined Sales info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                  Restaurant Billing & Sales Ledger
                </h2>
                <p className="text-xs text-slate-505 text-slate-500">Audit settled payment channels, track Nepalese Rupees (Rs.) streams, and drill down on historic itemized receipts.</p>
              </div>

              <div id="ledger-combined-sum" className="bg-slate-900 text-white p-3 px-5 rounded-2xl flex items-center gap-4 border border-slate-950 shadow-sm font-mono shrink-0">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Combined Ledger Total</span>
                  <span className="text-base font-black text-emerald-400">Rs. {ledgerTotalCombined.toFixed(2)}</span>
                </div>
                <div className="border-l border-slate-800 pl-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Succeeded Receipts</span>
                  <span className="text-sm font-black text-white">{billingHistory.length} total</span>
                </div>
              </div>
            </div>

            {/* CHANNEL LEDGER STRIP CARDS */}
            <div id="payment-channel-breakdown" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-205 p-3.5 rounded-2xl flex items-center justify-between shadow-3xs transition hover:shadow-xs">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block">🟢 Esewa Account</span>
                  <span className="text-sm font-mono font-black text-slate-800">Rs. {esewaTotal.toFixed(2)}</span>
                </div>
                <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-mono font-bold">
                  {billingHistory.filter(b => b.paymentMethod === 'Esewa').length} Bills
                </span>
              </div>

              <div className="bg-white border border-slate-205 p-3.5 rounded-2xl flex items-center justify-between shadow-3xs transition hover:shadow-xs">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block">🔴 Fonepay Gateway</span>
                  <span className="text-sm font-mono font-black text-slate-800">Rs. {fonepayTotal.toFixed(2)}</span>
                </div>
                <span className="text-[9px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-mono font-bold">
                  {billingHistory.filter(b => b.paymentMethod === 'Fonepay').length} Bills
                </span>
              </div>

              <div className="bg-white border border-slate-205 p-3.5 rounded-2xl flex items-center justify-between shadow-3xs transition hover:shadow-xs">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block">💵 Cash Register</span>
                  <span className="text-sm font-mono font-black text-slate-800">Rs. {cashTotal.toFixed(2)}</span>
                </div>
                <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-mono font-bold">
                  {billingHistory.filter(b => b.paymentMethod === 'Cash').length} Bills
                </span>
              </div>

              <div className="bg-white border border-slate-205 p-3.5 rounded-2xl flex items-center justify-between shadow-3xs transition hover:shadow-xs">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block">🏦 Bank Transfers</span>
                  <span className="text-sm font-mono font-black text-slate-800">Rs. {bankTotal.toFixed(2)}</span>
                </div>
                <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-mono font-bold">
                  {billingHistory.filter(b => b.paymentMethod === 'Bank').length} Bills
                </span>
              </div>
            </div>

            {/* LEDGER FILTER ACTION HEADER BAR */}
            <div className="bg-white border border-slate-205 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-3xs">
              {/* Left filter options */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-450 text-slate-450 text-slate-400 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Filter Channel:
                </span>
                
                {(['All', 'Esewa', 'Fonepay', 'Cash', 'Bank'] as const).map((method) => {
                  const isActive = billingMethodFilter === method;
                  return (
                    <button
                      key={method}
                      onClick={() => { playSound('tap'); setBillingMethodFilter(method); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold leading-none cursor-pointer transition ${
                        isActive 
                          ? "bg-slate-900 text-white shadow-3xs" 
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-205"
                      }`}
                    >
                      {method}
                    </button>
                  );
                })}
              </div>

              {/* Right: Search box */}
              <div className="relative">
                <input 
                  type="text"
                  value={billingSearch}
                  onChange={(e) => setBillingSearch(e.target.value)}
                  placeholder="Search receipt, table, or items..."
                  className="bg-slate-50 border border-slate-205 text-slate-900 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold focus:outline-none focus:border-indigo-500 w-full md:w-64 focus:ring-1 focus:ring-indigo-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                {billingSearch && (
                  <button 
                    onClick={() => setBillingSearch("")}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 text-sm font-bold"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* BILLS LEDGER ARCHIVE TABLE/LIST */}
            {filteredBills.length === 0 ? (
              <div id="ledger-empty-state" className="bg-white border border-slate-205 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-3xs">
                <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto border border-slate-150">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-sm font-extrabold text-slate-900">No Billing Records Found ({billingMethodFilter})</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {billingSearch 
                      ? `No receipts in our database matched your query "${billingSearch}". Try clearing or broadening search keywords.` 
                      : "No customer sessions have requested bill clearance and payments under this channel yet today."}
                  </p>
                </div>
                {billingSearch && (
                  <button 
                    onClick={() => { playSound('tap'); setBillingSearch(""); setBillingMethodFilter("All"); }}
                    className="bg-indigo-600 hover:bg-indigo-705 bg-indigo-600 text-white font-bold text-xs p-2.5 px-4 rounded-xl cursor-pointer shadow-3xs"
                  >
                    Reset Filter Search
                  </button>
                )}
              </div>
            ) : (
              <div id="ledger-history-table-container" className="bg-white border border-slate-205 rounded-2xl overflow-hidden shadow-3xs">
                {/* Header row */}
                <div className="bg-slate-50 border-b border-slate-205 px-4 py-3 grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-slate-450 text-slate-400 font-extrabold font-mono">
                  <div className="col-span-3">Receipt Index</div>
                  <div className="col-span-2">Origin Table</div>
                  <div className="col-span-3">Clearance Instant</div>
                  <div className="col-span-2 text-right font-mono">Settled Amount</div>
                  <div className="col-span-2 text-center">Payment Channel</div>
                </div>

                {/* Items rows */}
                <div className="divide-y divide-slate-150">
                  {filteredBills.map((bill) => {
                    const isExpanded = expandedBillId === bill.id;
                    const itemsTextSummary = bill.items.map(it => `${it.name} (x${it.quantity})`).join(", ");
                    const originTable = tablesList.find(t => t.id === bill.tableId);
                    
                    // payment channel badges
                    let channelColor = "bg-slate-150 text-slate-705 border-slate-250 border";
                    if (bill.paymentMethod === "Esewa") channelColor = "bg-emerald-50 text-emerald-700 border-emerald-150 border";
                    if (bill.paymentMethod === "Fonepay") channelColor = "bg-rose-50 text-rose-700 border-rose-150 border";
                    if (bill.paymentMethod === "Cash") channelColor = "bg-amber-50 text-amber-700 border-amber-100 border";
                    if (bill.paymentMethod === "Bank") channelColor = "bg-indigo-50 text-indigo-700 border-indigo-150 border";

                    return (
                      <div key={bill.id} className="transition-all duration-155 hover:bg-slate-50/50">
                        {/* Main row summary */}
                        <div 
                          onClick={() => { playSound('tap'); setExpandedBillId(isExpanded ? null : bill.id); }}
                          className="px-4 py-3.5 grid grid-cols-12 gap-2 items-center text-xs text-slate-800 font-semibold cursor-pointer"
                        >
                          <div className="col-span-3 space-y-0.5">
                            <span className="font-bold text-indigo-600 block">{bill.id}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-normal block max-w-xs truncate" title={itemsTextSummary}>
                              {bill.items.length} items: {itemsTextSummary}
                            </span>
                          </div>
                          
                          <div className="col-span-2 font-bold text-slate-900">
                            {originTable ? originTable.name : `Table (${bill.tableId})`}
                          </div>

                          <div className="col-span-3 text-[10px] text-slate-500 font-mono font-normal">
                            {new Date(bill.finalizedAt || bill.requestedAt).toLocaleString()}
                          </div>

                          <div className="col-span-2 text-right font-black text-emerald-700 font-mono text-xs">
                            Rs. {bill.total.toFixed(2)}
                          </div>

                          <div className="col-span-2 text-center">
                            <span className={`inline-block text-[9px] px-2 py-0.5 rounded-full font-mono font-extrabold uppercase ${channelColor}`}>
                              {bill.paymentMethod === 'Esewa' ? 'Esewa' : bill.paymentMethod === 'Fonepay' ? 'Fonepay' : bill.paymentMethod === 'Cash' ? 'Cash' : 'Bank'}
                            </span>
                          </div>
                        </div>

                        {/* Collapsible item details */}
                        {isExpanded && (
                          <div className="bg-slate-50/70 border-t border-slate-150 p-4 px-6 md:px-12 space-y-3.5 animate-scale-up">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Left item details summary */}
                              <div className="space-y-2">
                                <h5 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Receipt Breakdown (Dine-in Order)</h5>
                                <div className="space-y-1.5 border border-slate-205 border-slate-200 rounded-xl bg-white p-3 font-mono text-[11px] leading-relaxed shadow-3xs max-h-48 overflow-y-auto">
                                  {bill.items.map((it, idx) => (
                                    <div key={idx} className="flex justify-between text-slate-700">
                                      <span>{it.name} <span className="text-slate-400 font-sans font-medium text-[10px]">x{it.quantity}</span></span>
                                      <span>Rs. {(it.price * it.quantity).toFixed(2)}</span>
                                    </div>
                                  ))}
                                  
                                  <div className="border-t border-slate-200 border-dashed pt-2 mt-2 space-y-1 text-slate-500 text-[10px]">
                                    <div className="flex justify-between">
                                      <span>Dine-In Subtotal:</span>
                                      <span>Rs. {bill.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between pb-1">
                                      <span>Government Tax (8%):</span>
                                      <span>Rs. {bill.tax.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-black text-slate-900 text-[11px] border-t border-slate-200 pt-1">
                                      <span>Paid Ledger Grand Total:</span>
                                      <span className="text-emerald-700 font-mono">Rs. {bill.total.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right compliance & actions */}
                              <div className="space-y-3">
                                <h5 className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Ledger Identity Registry</h5>
                                <div className="space-y-2 text-[11px] bg-white border border-slate-205 border-slate-200 p-3.5 rounded-xl shadow-3xs text-slate-600">
                                  <div className="flex justify-between">
                                    <span>Session Bill ID:</span>
                                    <span className="font-mono text-slate-900 font-bold">{bill.id}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Payment Method:</span>
                                    <span className="font-mono font-bold text-slate-900">{bill.paymentMethod} Payment Gateway</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Settled Status:</span>
                                    <span className="text-emerald-600 font-bold uppercase tracking-wider text-[10px]">✔ Approved Paid</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Associated Table ID:</span>
                                    <span className="font-mono text-slate-900 font-bold">{bill.tableId}</span>
                                  </div>
                                  
                                  <div className="pt-2 border-t border-slate-150 flex gap-2">
                                    <button 
                                      onClick={() => { playSound('tap'); alert(`Receipt audit verified: ${bill.id}. Fully authorized in Local Ledger.`); }}
                                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-extrabold py-2 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition border border-slate-250 border-slate-200"
                                    >
                                      Verify Ledger Auth
                                    </button>
                                    <button 
                                      onClick={() => { playSound('tap'); alert(`Simulating paper receipt print command for printer device: ${bill.id}`); }}
                                      className="bg-indigo-50 border border-indigo-150 text-indigo-700 hover:bg-indigo-100 p-2 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer transition shadow-3xs"
                                      title="Simulate paper printer feed"
                                    >
                                      <Printer className="w-3.5 h-3.5" /> Paper Invoice
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* BILL SETTLEMENT MODAL SCREEN OVERLAY */}
      {selectedBillTable && activeBillDetail && (
        <div id="checkout-popup-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-55 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-sm border border-slate-205 p-6 shadow-2xl space-y-5 animate-scale-up z-50">
            <div className="flex justify-between items-start">
              <div>
                <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-extrabold uppercase font-mono tracking-wider px-2 py-0.5 rounded-full">
                  Cash Register Terminal
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">Conclude Settlement Bill</h3>
              </div>
              <button 
                onClick={() => { playSound('tap'); setSelectedBillTable(null); setActiveBillDetail(null); }}
                className="p-1 text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-xs space-y-2.5 max-h-56 overflow-y-auto font-mono">
              <div className="flex justify-between font-extrabold font-sans text-slate-800 border-b border-slate-200 pb-2">
                <span>Dine-In Table:</span>
                <span>{selectedBillTable.name}</span>
              </div>

              {/* Items row */}
              <div className="space-y-1.5 pb-2 border-b border-slate-200 border-dashed max-h-36 overflow-y-auto">
                {activeBillDetail.items.map((it: any, i: number) => (
                  <div key={i} className="flex justify-between text-[11px] text-slate-655 font-medium">
                    <span>{it.name} <span className="text-slate-400 font-sans">×{it.quantity}</span></span>
                    <span>Rs. {(it.price * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* pricing */}
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Running items subtotal:</span>
                <span>Rs. {activeBillDetail.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px] pb-1.5 border-b border-dashed border-slate-200">
                <span>Tax service fee (8%):</span>
                <span>Rs. {activeBillDetail.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-slate-950 text-sm font-mono pt-1">
                <span>Final grand total due:</span>
                <span className="text-emerald-700">Rs. {activeBillDetail.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment options */}
            <div className="space-y-2.5 text-xs">
              <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-extrabold">Acquiring Payment Method</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['Esewa', 'Fonepay', 'Cash', 'Bank'].map((meth) => (
                  <button
                    key={meth}
                    id={`payment-method-${meth.toLowerCase()}`}
                    onClick={() => { playSound('tap'); setPaymentMethod(meth as any); }}
                    className={`p-2.5 font-bold rounded-xl text-center border cursor-pointer capitalize transition-all ${
                      paymentMethod === meth 
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-xs" 
                        : "bg-slate-50 border-slate-205 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {meth === "Esewa" ? "🟢 Esewa" : meth === "Fonepay" ? "🔴 Fonepay" : meth === "Cash" ? "💵 Cash" : "🏦 Bank"}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleFinalizeBill}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold p-3 rounded-xl transition cursor-pointer text-xs uppercase font-extrabold tracking-wider shadow-sm flex items-center justify-center gap-1.5"
            >
              <CheckCheck className="w-4 h-4 stroke-[2.5px]" />
              Conclude Payment & Settle Table
            </button>
          </div>
        </div>
      )}

      {/* SUPERVISOR FORCE TABLE RESET OVERLAY CUSTOM MODAL */}
      {forceResetTableObj && (
        <div id="reset-confirm-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-55">
          <div id="reset-confirm-modal" className="bg-white rounded-2xl w-full max-w-sm border border-slate-205 p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-rose-600" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-extrabold text-slate-900 text-sm">Supervisor Force Clear Table Seeding Override</h3>
              <p className="text-xs text-slate-555 text-slate-500 leading-normal">
                This will forcefully clear active ordering reference, wipe running balances, & set <span className="font-bold text-slate-800">"{forceResetTableObj.name}"</span> state to <span className="text-indigo-600 font-bold">"Idle"</span>. 
              </p>
            </div>

            <div className="flex gap-2.5 pt-2 text-xs">
              <button
                onClick={() => { playSound('tap'); setForceResetTableObj(null); }}
                className="flex-1 bg-slate-50 border border-slate-205 py-2.5 rounded-xl font-bold hover:bg-slate-100 cursor-pointer text-slate-600 transition"
              >
                Close Cancel
              </button>
              <button
                onClick={handleForceResetTableConfirmed}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl font-extrabold uppercase tracking-wider cursor-pointer transition shadow-3xs"
              >
                Yes, Force Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM NON-BLOCKING CATALOG RECORD DELETION OVERLAY MODAL */}
      {deletingMenuItemObj && (
        <div id="delete-confirm-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-55">
          <div id="delete-confirm-modal" className="bg-white rounded-2xl w-full max-w-sm border border-slate-205 p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-rose-500" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-extrabold text-slate-900 text-sm">Eliminate Menu Product Record</h3>
              <p className="text-xs text-slate-555 text-slate-500 leading-normal">
                Are you absolutely sure you want to delete <span className="font-bold text-slate-950 font-sans">"{deletingMenuItemObj.name}"</span> from the database index? This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2 text-xs">
              <button
                onClick={() => setDeletingMenuItemObj(null)}
                className="flex-1 bg-slate-50 border border-slate-205 py-2.5 rounded-xl font-bold hover:bg-slate-100 cursor-pointer text-slate-600 transition"
              >
                Abort Cancel
              </button>
              <button
                onClick={handleDeleteMenuItemConfirmed}
                className="flex-1 bg-rose-600 hover:bg-rose-505 hover:bg-rose-500 text-white py-2.5 rounded-xl font-extrabold uppercase tracking-wider cursor-pointer transition shadow-sm"
              >
                Confirm Delete Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATALOG CREATE & UPDATE SLIDE-IN POPUP PANEL OVERLAY */}
      {isMenuModalOpen && (
        <div id="catalog-form-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-55 overflow-y-auto">
          <form 
            onSubmit={handleSaveMenuItem}
            className="bg-white rounded-2xl w-full max-w-md border border-slate-205 p-6 shadow-2xl space-y-5 animate-scale-up z-50 text-xs"
          >
            <div className="flex justify-between items-start pb-1">
              <div>
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-extrabold uppercase font-mono tracking-wider px-2 py-0.5 rounded-full">
                  Inventory Control desk
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  {editingMenuItem ? "Modify Catalog product" : "Enroll New catalog product"}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => { playSound('tap'); setIsMenuModalOpen(false); }}
                className="p-1 text-slate-400 hover:text-slate-660 hover:text-slate-600 text-sm cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100 font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-slate-500 uppercase tracking-wider text-[9px] font-bold">Catalog Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="Specify authentic product identifier (e.g. Garlic Naan)"
                  value={menuForm.name}
                  onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-205 text-slate-900 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 font-semibold focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Sub-classifications */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-550 block text-slate-500 uppercase tracking-wider text-[9px] font-bold">MRP Rate (Rupees RS)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Enter RS. absolute price value"
                    value={menuForm.price}
                    onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-205 text-slate-900 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 font-semibold focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* Section selection Category */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-slate-550 block text-slate-500 uppercase tracking-wider text-[9px] font-bold">Taxonomical Group</label>
                  </div>
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => triggerCategorySectionSwap("Food")}
                      className={`py-1.5 rounded-lg text-center font-bold cursor-pointer transition ${
                        menuForm.section === "Food" 
                          ? "bg-white text-slate-900 shadow-2xs" 
                          : "text-slate-500 hover:bg-white/40"
                      }`}
                    >
                      Food
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerCategorySectionSwap("Drinks")}
                      className={`py-1.5 rounded-lg text-center font-bold cursor-pointer transition ${
                        menuForm.section === "Drinks" 
                          ? "bg-white text-slate-900 shadow-2xs" 
                          : "text-slate-500 hover:bg-white/40"
                      }`}
                    >
                      Drinks
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-550 block text-slate-500 uppercase tracking-wider text-[9px] font-bold">Category Categorizations</label>
                <select
                  value={menuForm.category}
                  onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-205 text-slate-900 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 font-semibold focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {menuForm.section === "Food" ? (
                    <>
                      <option value="Veg">🥦 pure green veg</option>
                      <option value="Non-Veg">🍖 non-veg choices</option>
                    </>
                  ) : (
                    <>
                      <option value="Soft Drinks">🥤 mocktails & coolers</option>
                      <option value="Hard Drinks">🍷 premium spirits</option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-555 block text-slate-500 uppercase tracking-wider text-[9px] font-bold">Menu Description</label>
                <textarea
                  value={menuForm.description}
                  onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  placeholder="Specify brief ingredients, flavors, and allergen details."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-205 text-slate-900 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 font-semibold focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-750 text-white font-black p-3 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer text-xs uppercase font-extrabold tracking-wider shadow-xs"
            >
              <Check className="w-4 h-4" />
              Save Catalog Record
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
