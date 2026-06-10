import express from "express";
import path from "path";
import { Table, MenuItem, Order, Bill, TableStatus, OrderItem } from "./src/types";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();
const PORT = 3000;
const server = createServer(app);

// Conditionally initialize WebSocket for non-serverless environments (like local/Docker)
let wss: WebSocketServer | null = null;
if (process.env.VERCEL !== "1") {
  try {
    wss = new WebSocketServer({ server });
    wss.on("connection", (ws) => {
      console.log("WebSocket client connected");
      ws.on("error", console.error);
    });
  } catch (err) {
    console.warn("Could not start WebSocket server (non-fatal, proceeding):", err);
  }
}

function broadcastOrderStatus(order: Order) {
  if (!wss) return;
  const payload = JSON.stringify({
    type: "order_status_update",
    orderId: order.id,
    tableId: order.tableId,
    guestId: order.guestId,
    status: order.status,
    updatedAt: order.updatedAt,
  });
  wss.clients.forEach(client => {
    if (client.readyState === 1 /* WebSocket.OPEN */) {
      client.send(payload);
    }
  });
}

app.use(express.json());

// ==========================================
// IN-MEMORY DATABASE STATE (REST STATE ENGINE)
// ==========================================

// Seed Tables
let tables: Table[] = [
  // Counter
  { id: "counter-1", name: "Counter 1", category: "Counter", status: "Idle", activeOrderId: null, updatedAt: new Date().toISOString() },
  { id: "counter-2", name: "Counter 2", category: "Counter", status: "Idle", activeOrderId: null, updatedAt: new Date().toISOString() },
  { id: "counter-3", name: "Counter 3", category: "Counter", status: "Idle", activeOrderId: null, updatedAt: new Date().toISOString() },
  // Garden
  { id: "garden-1", name: "Garden 1", category: "Garden", status: "Idle", activeOrderId: null, updatedAt: new Date().toISOString() },
  { id: "garden-2", name: "Garden 2", category: "Garden", status: "Idle", activeOrderId: null, updatedAt: new Date().toISOString() },
  // Hall
  { id: "hall-1", name: "Main Hall Table", category: "Hall", status: "Idle", activeOrderId: null, updatedAt: new Date().toISOString() },
  // Coffee Tables
  { id: "coffee-1", name: "Coffee 1", category: "Coffee", status: "Idle", activeOrderId: null, updatedAt: new Date().toISOString() },
  { id: "coffee-2", name: "Coffee 2", category: "Coffee", status: "Idle", activeOrderId: null, updatedAt: new Date().toISOString() },
  { id: "coffee-3", name: "Coffee 3", category: "Coffee", status: "Idle", activeOrderId: null, updatedAt: new Date().toISOString() },
  { id: "coffee-4", name: "Coffee 4", category: "Coffee", status: "Idle", activeOrderId: null, updatedAt: new Date().toISOString() },
];

// Seed Menu Items
let menuItems: MenuItem[] = [
  // Food - Veg
  {
    id: "item-1",
    name: "Truffle Mushroom Risotto",
    price: 450,
    section: "Food",
    category: "Veg",
    description: "Creamy Arborio rice with wild forest mushrooms, fresh herbs, and premium truffle oil drizzle.",
    isAvailable: true
  },
  {
    id: "item-2",
    name: "Paneer Tikka Sizzler",
    price: 380,
    section: "Food",
    category: "Veg",
    description: "Spiced cottage cheese cubes charred in tandoor, served with butter rice and smoking veggies.",
    isAvailable: true
  },
  {
    id: "item-3",
    name: "Avocado & Green Quinoa Salad",
    price: 290,
    section: "Food",
    category: "Veg",
    description: "Creamy sliced avocado, organic quinoa, crisp cucumbers, cherry tomatoes, and mint lime dressing.",
    isAvailable: true
  },
  {
    id: "item-4",
    name: "Margherita Pizza with Fresh Basil",
    price: 340,
    section: "Food",
    category: "Veg",
    description: "Wood-fired sourdough crust topped with rich Roma tomato sauce, fresh buffalo mozzarella, and aromatic basil leaves.",
    isAvailable: true
  },

  // Food - Non-Veg
  {
    id: "item-5",
    name: "Pan-Seared Atlantic Salmon",
    price: 690,
    section: "Food",
    category: "Non-Veg",
    description: "Crispy skin salmon served over asparagus heads, whipped baby potatoes, and a citrus butter cream reduction.",
    isAvailable: true
  },
  {
    id: "item-6",
    name: "Tender Spicy BBQ Chicken Ribs",
    price: 480,
    section: "Food",
    category: "Non-Veg",
    description: "Fall off the bone tandoor glazed chicken ribs in savory hickory masala, served with mint chutney.",
    isAvailable: true
  },
  {
    id: "item-7",
    name: "Classic Butter Chicken Tikka",
    price: 420,
    section: "Food",
    category: "Non-Veg",
    description: "Tender chicken chunks simmered in a silky, creamy, cardamom-infused authentic tomato gravy.",
    isAvailable: true
  },
  {
    id: "item-8",
    name: "Spiced Lamb Double Patty Burger",
    price: 490,
    section: "Food",
    category: "Non-Veg",
    description: "Premium double lamb patties, grilled cheddar cheese, caramelized onions, sweet pickles, on toasted brioche.",
    isAvailable: true
  },

  // Drinks - Soft
  {
    id: "item-9",
    name: "Watermelon Mint Cooler",
    price: 180,
    section: "Drinks",
    category: "Soft Drinks",
    description: "Muddled fresh seedless watermelon juice, cooling peppermint sprigs, and splash of lemon soda.",
    isAvailable: true
  },
  {
    id: "item-10",
    name: "Organic Iced Matcha Latte",
    price: 220,
    section: "Drinks",
    category: "Soft Drinks",
    description: "Japanese stone-ground Uji matcha whisked with ice cold oat milk, sweetened with organic agave.",
    isAvailable: true
  },
  {
    id: "item-11",
    name: "Classic Virgin Mojito",
    price: 160,
    section: "Drinks",
    category: "Soft Drinks",
    description: "Fresh lime wedges crushed with sparkling mint syrup, club soda, and raw sugarcane granules.",
    isAvailable: true
  },

  // Drinks - Hard
  {
    id: "item-12",
    name: "Wood-Smoked Old Fashioned",
    price: 350,
    section: "Drinks",
    category: "Hard Drinks",
    description: "Kentucky bourbon alternative, aromatic Angostura bitters, orange peel, smoked right in the glass with oak-wood chips.",
    isAvailable: true
  },
  {
    id: "item-13",
    name: "Smoked Rosemary Mezcal Rita",
    price: 380,
    section: "Drinks",
    category: "Hard Drinks",
    description: "Artisanal Mezcal substitute, triple sec, organic lime nectar, rimmed with pink Himalayan salt and a charred rosemary stick.",
    isAvailable: true
  },
  {
    id: "item-14",
    name: "Local Craft Draft Tap",
    price: 280,
    section: "Drinks",
    category: "Hard Drinks",
    description: "Crisp, hoppy, fresh mock-brew with undertones of citrus grapefruit and pine, poured fresh on tap.",
    isAvailable: true
  },
];

// Active Orders Map
let orders: Order[] = [];

// Historial/Completed Bills
let completedBills: Bill[] = [];

// Track server session alerts
interface RealtimeAlert {
  id: string;
  tableId: string;
  tableName: string;
  type: "new_order" | "amended_order" | "bill_request" | "table_eating";
  message: string;
  timestamp: string;
  read: boolean;
}
let liveAlerts: RealtimeAlert[] = [];

// Helper to push alert
function pushAlert(tableId: string, type: RealtimeAlert["type"], message: string) {
  const table = tables.find(t => t.id === tableId);
  const alert: RealtimeAlert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    tableId,
    tableName: table ? table.name : "Unknown Table",
    type,
    message,
    timestamp: new Date().toISOString(),
    read: false,
  };
  liveAlerts.unshift(alert);
  if (liveAlerts.length > 50) liveAlerts.pop(); // keep last 50
}

// ==========================================
// REST API ENDPOINTS
// ==========================================

// Authenticate Admin (simple credentials for workspace flow)
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "ordering123") {
    res.json({ success: true, token: "admin-jwt-token-stub" });
  } else {
    res.status(401).json({ success: false, error: "Invalid admin credentials. Use admin / ordering123" });
  }
});

// GET Tables status
app.get("/api/tables", (req, res) => {
  // Append active session summary (like total amount)
  const enrichedTables = tables.map(t => {
    let activeBillTotal = 0;
    if (t.activeOrderId) {
      const activeOrder = orders.find(o => o.id === t.activeOrderId);
      if (activeOrder) {
        activeBillTotal = activeOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      }
    }
    return {
      ...t,
      activeBillTotal
    };
  });
  res.json(enrichedTables);
});

// POST update table status directly
app.post("/api/tables/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body as { status: TableStatus };
  const table = tables.find(t => t.id === id);
  if (!table) {
    return res.status(404).json({ error: "Table not found" });
  }
  table.status = status;
  table.updatedAt = new Date().toISOString();
  if (status === 'Idle') {
    table.activeOrderId = null;
  }
  res.json(table);
});

// GET MENU WITH CATEGORIES
app.get("/api/menu", (req, res) => {
  res.json(menuItems);
});

// CREATE Menu Item (Admin)
app.post("/api/menu", (req, res) => {
  const { name, price, section, category, description, isAvailable } = req.body;
  if (!name || isNaN(Number(price)) || !section || !category) {
    return res.status(400).json({ error: "Missing or invalid fields. 'name', 'price', 'section' (Food/Drinks), and 'category' are required." });
  }
  const newItem: MenuItem = {
    id: `item-${Date.now()}`,
    name,
    price: Number(price),
    section,
    category,
    description: description || "",
    isAvailable: isAvailable !== undefined ? isAvailable : true
  };
  menuItems.push(newItem);
  res.status(201).json(newItem);
});

// UPDATE Menu Item (Admin)
app.put("/api/menu/:id", (req, res) => {
  const { id } = req.params;
  const { name, price, section, category, description, isAvailable } = req.body;
  const index = menuItems.findIndex(i => i.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Menu item not found" });
  }
  menuItems[index] = {
    ...menuItems[index],
    name: name !== undefined ? name : menuItems[index].name,
    price: price !== undefined ? Number(price) : menuItems[index].price,
    section: section !== undefined ? section : menuItems[index].section,
    category: category !== undefined ? category : menuItems[index].category,
    description: description !== undefined ? description : menuItems[index].description,
    isAvailable: isAvailable !== undefined ? isAvailable : menuItems[index].isAvailable,
  };
  res.json(menuItems[index]);
});

// DELETE Menu Item (Admin)
app.delete("/api/menu/:id", (req, res) => {
  const { id } = req.params;
  const index = menuItems.findIndex(i => i.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Menu item not found" });
  }
  const deleted = menuItems.splice(index, 1);
  res.json({ message: "Menu item deleted successfully", item: deleted[0] });
});

// GET Orders
app.get("/api/orders", (req, res) => {
  res.json(orders);
});

// GET active orders for admin live feed
app.get("/api/orders/active", (req, res) => {
  const activeOrders = orders.filter(o => o.status !== "completed");
  res.json(activeOrders);
});

// POST CREATE OR APPEND ORDER ITEMS
app.post("/api/orders", (req, res) => {
  const { tableId, items, guestId } = req.body as { tableId: string, items: { menuItemId: string; quantity: number }[], guestId?: string };
  const table = tables.find(t => t.id === tableId);
  if (!table) {
    return res.status(404).json({ error: "Table not found" });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ error: "No items provided in order" });
  }

  // Resolve items info & inject individual timestamps
  const timestampNow = new Date().toISOString();
  const orderItemsToAdd: OrderItem[] = items.map(input => {
    const menuInfo = menuItems.find(m => m.id === input.menuItemId);
    const price = menuInfo ? menuInfo.price : 0;
    const name = menuInfo ? menuInfo.name : "Unknown Item";
    return {
      menuItemId: input.menuItemId,
      name,
      price,
      quantity: input.quantity,
      addedAt: timestampNow
    };
  });

  let order: Order;
  const isAppend = !!table.activeOrderId;

  if (isAppend) {
    // Append to existing order
    const existingOrder = orders.find(o => o.id === table.activeOrderId);
    if (!existingOrder) {
      return res.status(500).json({ error: "Active order reference was lost on server. Recreating order." });
    }
    
    // Add items (timestamps support recording sequential additions)
    existingOrder.items.push(...orderItemsToAdd);
    existingOrder.updatedAt = timestampNow;
    existingOrder.status = "pending"; // set back to pending so kitchen sees new additions
    if (guestId) existingOrder.guestId = guestId;
    order = existingOrder;
    
    // Switch table status to 'Eating' or 'Ordering' depending on active cycle
    table.status = 'Eating';
    table.updatedAt = timestampNow;
    
    pushAlert(tableId, "amended_order", `${table.name} appended ${orderItemsToAdd.reduce((sum, i) => sum + i.quantity, 0)} new items to their order.`);
  } else {
    // Create direct new order
    const newOrderId = `order-${Date.now()}`;
    const newOrder: Order = {
      id: newOrderId,
      tableId,
      items: orderItemsToAdd,
      status: "pending",
      createdAt: timestampNow,
      updatedAt: timestampNow,
      guestId
    };
    orders.push(newOrder);
    
    table.activeOrderId = newOrderId;
    table.status = "Eating"; // Switch status immediately to Eating
    table.updatedAt = timestampNow;
    order = newOrder;

    pushAlert(tableId, "new_order", `${table.name} placed a new order containing ${orderItemsToAdd.length} items.`);
  }

  // Broadcast the created or amended order status update via WS!
  broadcastOrderStatus(order);

  res.status(201).json({ order, isAppend });
});

// GET: Query order history by guestId
app.get("/api/orders/history", (req, res) => {
  const { guestId } = req.query;
  if (!guestId) {
    return res.status(400).json({ error: "Missing guestId parameter" });
  }

  // Find matching active orders and completed bills
  const activeMatchingOrders = orders.filter(o => o.guestId === guestId);
  const completedMatchingBills = completedBills.filter(b => b.guestId === guestId);

  const history = [
    ...activeMatchingOrders.map(o => ({
      orderId: o.id,
      tableId: o.tableId,
      createdAt: o.createdAt,
      status: o.status,
      items: o.items,
      total: o.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      isCompleted: o.status === "completed"
    })),
    ...completedMatchingBills.map(b => ({
      orderId: b.orderId,
      tableId: b.tableId,
      createdAt: b.finalizedAt || b.requestedAt,
      status: "completed" as const,
      items: b.items,
      total: b.total,
      isCompleted: true
    }))
  ];

  // Sort history by date descending
  history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Filter out duplicate orders to make history clean
  const uniqueHistory: typeof history = [];
  const seenOrderIds = new Set<string>();
  for (const entry of history) {
    if (!seenOrderIds.has(entry.orderId)) {
      seenOrderIds.add(entry.orderId);
      uniqueHistory.push(entry);
    }
  }

  res.json(uniqueHistory);
});

// POST update order status directly (Admin)
app.post("/api/orders/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body as { status: Order["status"] };
  if (!['pending', 'preparing', 'ready', 'completed'].includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();

  const table = tables.find(t => t.id === order.tableId);
  if (table) {
    if (status === 'completed') {
      table.status = 'Idle';
      table.activeOrderId = null;
    }
    table.updatedAt = new Date().toISOString();
  }

  pushAlert(order.tableId, "amended_order", `Order #${order.id.slice(-4).toUpperCase()} status transitioned to ${status}.`);
  broadcastOrderStatus(order);
  res.json(order);
});

// POST Mark order as served / completed (Admin) - Backwards compatible
app.post("/api/orders/:id/serve", (req, res) => {
  const { id } = req.params;
  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  order.status = "ready";
  order.updatedAt = new Date().toISOString();
  
  // Set table status to Eating now that the kitchen has served all pending modifications
  const table = tables.find(t => t.id === order.tableId);
  if (table && table.status === 'Ordering') {
    table.status = 'Eating';
    table.updatedAt = new Date().toISOString();
  }

  pushAlert(order.tableId, "table_eating", `${order.items.length} items served. Table is now enjoying their meal.`);
  broadcastOrderStatus(order);
  res.json(order);
});

// POST: Request Bill (Checkout trigger)
app.post("/api/tables/:id/request-bill", (req, res) => {
  const { id } = req.params;
  const table = tables.find(t => t.id === id);
  if (!table) {
    return res.status(404).json({ error: "Table not found" });
  }

  if (!table.activeOrderId) {
    return res.status(400).json({ error: "No active order for this table to build a bill." });
  }

  table.status = "Bill Requested";
  table.updatedAt = new Date().toISOString();

  pushAlert(id, "bill_request", `${table.name} requested their final bill statement.`);
  res.json({ message: "Bill requested successfully. Please wait for the admin to complete your transaction.", table });
});

// GET: Generate active bill summary for table
app.get("/api/tables/:id/bill", (req, res) => {
  const { id } = req.params;
  const table = tables.find(t => t.id === id);
  if (!table) {
    return res.status(404).json({ error: "Table not found" });
  }

  if (!table.activeOrderId) {
    return res.status(400).json({ error: "No active order for this table" });
  }

  const order = orders.find(o => o.id === table.activeOrderId);
  if (!order) {
    return res.status(404).json({ error: "Active order detail not found" });
  }

  const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = Number((subtotal * 0.08).toFixed(2)); // tax model (8%)
  const total = Number((subtotal + tax).toFixed(2));

  res.json({
    tableId: id,
    tableName: table.name,
    orderId: order.id,
    items: order.items,
    subtotal,
    tax,
    total,
    status: table.status
  });
});

// POST: Finalize payments and clear tables (Admin)
app.post("/api/tables/:id/finalize-bill", (req, res) => {
  const { id } = req.params;
  const { paymentMethod } = req.body as { paymentMethod: 'Esewa' | 'Fonepay' | 'Cash' | 'Bank' };
  
  const table = tables.find(t => t.id === id);
  if (!table) {
    return res.status(404).json({ error: "Table not found" });
  }

  if (!table.activeOrderId) {
    return res.status(400).json({ error: "No active order to finalize" });
  }

  const order = orders.find(o => o.id === table.activeOrderId);
  if (!order) {
    return res.status(404).json({ error: "Order details lost" });
  }

  const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = Number((subtotal * 0.08).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  const finalBill: Bill = {
    id: `bill-${Date.now()}`,
    tableId: id,
    orderId: order.id,
    items: [...order.items],
    subtotal,
    tax,
    total,
    paymentStatus: "paid",
    paymentMethod: paymentMethod || "Esewa",
    requestedAt: table.updatedAt,
    finalizedAt: new Date().toISOString(),
    guestId: order.guestId
  };

  // Archive bill
  completedBills.push(finalBill);

  // Close active order
  order.status = "completed";
  order.updatedAt = new Date().toISOString();
  broadcastOrderStatus(order);

  // Reset table back to Idle
  table.status = "Idle";
  table.activeOrderId = null;
  table.updatedAt = new Date().toISOString();

  res.json({ message: "Table session closed successfully. Paid and cleared.", bill: finalBill });
});

// GET live alert lists for admin sound system
app.get("/api/admin/alerts", (req, res) => {
  res.json(liveAlerts);
});

// POST mark alerts as read
app.post("/api/admin/alerts/read", (req, res) => {
  liveAlerts.forEach(a => a.read = true);
  res.json({ success: true });
});

// GET Admin dashboard stats
app.get("/api/admin/stats", (req, res) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  // Todays revenue
  const todayRevenue = completedBills.reduce((sum, b) => {
    const billTime = new Date(b.finalizedAt || "").getTime();
    if (billTime >= startOfDay) {
      return sum + b.total;
    }
    return sum;
  }, 0);

  const activeTablesCount = tables.filter(t => t.status !== "Idle").length;
  const pendingOrdersCount = orders.filter(o => o.status === "pending").length;
  const completedBillsCount = completedBills.length;

  res.json({
    todayRevenue,
    activeTablesCount,
    pendingOrdersCount,
    completedBillsCount
  });
});

// GET Admin dashboard bills history
app.get("/api/admin/bills", (req, res) => {
  res.json(completedBills);
});

// ==========================================
// VITE AND PRODUCTION BUILD HANDLER
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Match wildcard to index.html for React SPA
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.VERCEL !== "1") {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

if (process.env.VERCEL !== "1") {
  startServer();
}

export default app;
