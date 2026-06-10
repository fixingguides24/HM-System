/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import CustomerApp from "./components/CustomerApp";
import AdminDashboard from "./components/AdminDashboard";
import { playSound } from "./lib/sound";
import { Sparkles, Layers, Shield, User, HelpCircle, AlertCircle } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<'customer' | 'admin'>('customer');
  const [notificationBubble, setNotificationBubble] = useState<string | null>(null);

  const handleTabChange = (tab: typeof activeTab) => {
    playSound('tap');
    setActiveTab(tab);
    setNotificationBubble(null);
  };

  // Helper trigger to notify user to check Admin panel on new order actions
  const triggerOrderAlertBubble = () => {
    if (activeTab === 'customer') {
      setNotificationBubble("New Order Dispatched! Switch to the Admin tab to view the live kitchen queue & settle bills.");
    }
  };

  return (
    <div id="app-root" className="min-h-screen bg-slate-900 flex flex-col font-sans">
      
      {/* SIMULATOR SWITCHER BAR */}
      <div id="simulator-bar" className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 z-50 sticky top-0 sm:h-14 text-xs shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center font-bold text-white text-xs">Q</div>
          <span className="font-extrabold tracking-tight text-white font-mono">RestoCore</span>
        </div>

        {/* TABS CONTROL */}
        <div className="flex bg-slate-900 rounded-xl border border-slate-800 p-1 overflow-hidden">
          <button
            id="tab-customer"
            onClick={() => handleTabChange('customer')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'customer' 
                ? 'bg-indigo-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Customer Portal
          </button>
          
          <button
            id="tab-admin"
            onClick={() => handleTabChange('admin')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'admin' 
                ? 'bg-indigo-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Manager Dashboard
          </button>
        </div>

        <div className="hidden md:block w-4" />
      </div>

      {/* PERSISTENT HELPER NOTIFICATION ALERTS */}
      {notificationBubble && (
        <div id="interactive-helper-alert" className="bg-indigo-950/90 border-b border-indigo-900 text-indigo-200 px-4 py-2.5 text-xs text-center font-medium flex items-center justify-center gap-2 animate-pulse relative z-40">
          <AlertCircle className="w-4 h-4 shrink-0 text-indigo-400" />
          <span>{notificationBubble}</span>
          <button 
            onClick={() => setNotificationBubble(null)}
            className="underline font-bold text-white ml-2 cursor-pointer hover:text-slate-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* CORE DISPLAY WINDOW */}
      <main className="flex-1 bg-slate-50">
        {activeTab === 'customer' && (
          <div className="animate-fade-in bg-slate-50 min-h-screen">
            <CustomerApp onNotifyAdmin={triggerOrderAlertBubble} />
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="animate-fade-in">
            <AdminDashboard />
          </div>
        )}
      </main>

    </div>
  );
}
