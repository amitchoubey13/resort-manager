'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { randomUUID: uuidv4 } = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// ── Paths ──────────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(FRONTEND_DIR));

// ── Multer config ──────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ── JSON file helpers ──────────────────────────────────────────────────────
function readJSON(filename) {
  const filepath = path.join(DATA_DIR, filename);
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeJSON(filename, data) {
  const filepath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

function readSettings() {
  const filepath = path.join(DATA_DIR, 'settings.json');
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    return { setupDone: false, shiftStartTime: '10:00', resortName: 'My Resort' };
  }
}

function writeSettings(data) {
  const filepath = path.join(DATA_DIR, 'settings.json');
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

// ── Date helpers ───────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function addWeeks(dateStr, weeks) {
  return addDays(dateStr, weeks * 7);
}

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function advanceDueDate(dueDate, repeatType) {
  switch (repeatType) {
    case 'Daily':   return addDays(dueDate, 1);
    case 'Weekly':  return addWeeks(dueDate, 1);
    case 'Monthly': return addMonths(dueDate, 1);
    default:        return dueDate;
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  AUTH & SETUP ROUTES
// ══════════════════════════════════════════════════════════════════════════

// GET /api/settings
app.get('/api/settings', (req, res) => {
  res.json(readSettings());
});

// PUT /api/settings
app.put('/api/settings', (req, res) => {
  const settings = readSettings();
  const updates = req.body;
  Object.assign(settings, updates);
  writeSettings(settings);
  res.json(settings);
});

// POST /api/setup — first-run owner creation
app.post('/api/setup', (req, res) => {
  const { name, phone, pin, resortName } = req.body;
  if (!name || !pin) {
    return res.status(400).json({ error: 'name and pin are required' });
  }

  const users = readJSON('users.json');
  const settings = readSettings();

  if (settings.setupDone) {
    return res.status(400).json({ error: 'Setup already completed' });
  }

  const owner = {
    id: uuidv4(),
    name: name.trim(),
    phone: phone || '',
    pin: String(pin),
    role: 'Owner',
    monthlySalary: 0,
    createdAt: new Date().toISOString()
  };

  users.push(owner);
  writeJSON('users.json', users);

  settings.setupDone = true;
  if (resortName) settings.resortName = resortName.trim();
  writeSettings(settings);

  const { pin: _p, ...safeOwner } = owner;
  res.json({ user: safeOwner, settings });
});

// POST /api/signin
app.post('/api/signin', (req, res) => {
  const { name, pin } = req.body;
  if (!name || !pin) {
    return res.status(400).json({ error: 'name and pin are required' });
  }

  const users = readJSON('users.json');
  const user = users.find(
    u => u.name.toLowerCase() === String(name).toLowerCase().trim() &&
         String(u.pin) === String(pin)
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid name or PIN' });
  }

  const { pin: _p, ...safeUser } = user;
  res.json(safeUser);
});

// ══════════════════════════════════════════════════════════════════════════
//  USERS ROUTES
// ══════════════════════════════════════════════════════════════════════════

// GET /api/users
app.get('/api/users', (req, res) => {
  const users = readJSON('users.json');
  const safe = users.map(({ pin: _p, ...u }) => u);
  res.json(safe);
});

// GET /api/users/:id
app.get('/api/users/:id', (req, res) => {
  const users = readJSON('users.json');
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { pin: _p, ...safeUser } = user;
  res.json(safeUser);
});

// POST /api/users
app.post('/api/users', (req, res) => {
  const { name, phone, pin, role, monthlySalary } = req.body;
  if (!name || !pin || !role) {
    return res.status(400).json({ error: 'name, pin and role are required' });
  }

  const validRoles = ['Owner', 'Manager', 'Staff', 'Kitchen Staff'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const users = readJSON('users.json');
  const newUser = {
    id: uuidv4(),
    name: name.trim(),
    phone: phone || '',
    pin: String(pin),
    role,
    monthlySalary: Number(monthlySalary) || 0,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeJSON('users.json', users);

  const { pin: _p, ...safeUser } = newUser;
  res.status(201).json(safeUser);
});

// PUT /api/users/:id
app.put('/api/users/:id', (req, res) => {
  const users = readJSON('users.json');
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const updates = req.body;
  delete updates.id;
  Object.assign(users[idx], updates);
  writeJSON('users.json', users);

  const { pin: _p, ...safeUser } = users[idx];
  res.json(safeUser);
});

// DELETE /api/users/:id
app.delete('/api/users/:id', (req, res) => {
  const users = readJSON('users.json');
  const filtered = users.filter(u => u.id !== req.params.id);
  if (filtered.length === users.length) {
    return res.status(404).json({ error: 'User not found' });
  }
  writeJSON('users.json', filtered);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════
//  TASKS ROUTES
// ══════════════════════════════════════════════════════════════════════════

// GET /api/tasks?assignedTo=&status=&category=&requestedBy=
app.get('/api/tasks', (req, res) => {
  let tasks = readJSON('tasks.json');
  const { assignedTo, status, category, requestedBy } = req.query;

  if (assignedTo)  tasks = tasks.filter(t => t.assignedTo === assignedTo);
  if (status)      tasks = tasks.filter(t => t.status === status);
  if (category)    tasks = tasks.filter(t => t.category === category);
  if (requestedBy) tasks = tasks.filter(t => t.requestedBy === requestedBy);

  res.json(tasks);
});

// POST /api/tasks
// category accepts: 'Housekeeping', 'Maintenance', 'Guest Request', 'General',
//                   'Purchase Request', 'Kitchen Equipment', 'Inventory Purchase'
app.post('/api/tasks', (req, res) => {
  const tasks = readJSON('tasks.json');
  const newTask = {
    id: uuidv4(),
    title: req.body.title || '',
    description: req.body.description || '',
    category: req.body.category || 'General',
    assignedTo: req.body.assignedTo || null,
    requestedBy: req.body.requestedBy || null,
    status: req.body.status || 'Pending',
    priority: req.body.priority || 'Normal',
    dueDate: req.body.dueDate || null,
    repeatType: req.body.repeatType || 'None',
    completedAt: null,
    notes: req.body.notes || '',
    attachmentUrl: req.body.attachmentUrl || null,
    buyingListItems: req.body.buyingListItems || [],
    lastKitchenAlert: req.body.lastKitchenAlert || null,
    lastLowStockAlert: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  tasks.push(newTask);
  writeJSON('tasks.json', tasks);
  res.status(201).json(newTask);
});

// PUT /api/tasks/:id
app.put('/api/tasks/:id', (req, res) => {
  const tasks = readJSON('tasks.json');
  const idx = tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });

  const updates = req.body;
  delete updates.id;

  const wasNotDone = tasks[idx].status !== 'Done';
  Object.assign(tasks[idx], updates);
  tasks[idx].updatedAt = new Date().toISOString();

  const task = tasks[idx];
  let nextTask = null;
  const flags = {};

  // If task just became Done
  if (updates.status === 'Done' && wasNotDone) {
    task.completedAt = new Date().toISOString();

    // Auto-create next recurring task
    if (task.repeatType && task.repeatType !== 'None' && task.dueDate) {
      const nextDue = advanceDueDate(task.dueDate, task.repeatType);
      nextTask = {
        id: uuidv4(),
        title: task.title,
        description: task.description,
        category: task.category,
        assignedTo: task.assignedTo,
        requestedBy: task.requestedBy,
        status: 'Pending',
        priority: task.priority,
        dueDate: nextDue,
        repeatType: task.repeatType,
        completedAt: null,
        notes: '',
        attachmentUrl: null,
        buyingListItems: task.buyingListItems || [],
        lastKitchenAlert: null,
        lastLowStockAlert: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      tasks.push(nextTask);
    }

    // Flag for inventory purchase tasks
    if (task.category === 'Inventory Purchase') {
      flags.doneInventoryPurchase = true;
    }

    // Flag for kitchen equipment tasks
    if (task.category === 'Kitchen Equipment') {
      flags.doneKitchenEquipment = true;
    }
  }

  writeJSON('tasks.json', tasks);
  res.json({ task, nextTask, ...flags });
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', (req, res) => {
  const tasks = readJSON('tasks.json');
  const filtered = tasks.filter(t => t.id !== req.params.id);
  if (filtered.length === tasks.length) {
    return res.status(404).json({ error: 'Task not found' });
  }
  writeJSON('tasks.json', filtered);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════
//  ATTENDANCE ROUTES
// ══════════════════════════════════════════════════════════════════════════

// GET /api/attendance?userId=&date=&month=
app.get('/api/attendance', (req, res) => {
  let records = readJSON('attendance.json');
  const { userId, date, month } = req.query;

  if (userId) records = records.filter(r => r.userId === userId);
  if (date)   records = records.filter(r => r.date === date);
  if (month)  records = records.filter(r => r.date && r.date.startsWith(month));

  res.json(records);
});

// POST /api/attendance
app.post('/api/attendance', (req, res) => {
  const records = readJSON('attendance.json');
  const newRecord = {
    id: uuidv4(),
    userId: req.body.userId,
    date: req.body.date,
    dutyIn: req.body.dutyIn || null,
    dutyOut: req.body.dutyOut || null,
    breakStart: req.body.breakStart || null,
    breakEnd: req.body.breakEnd || null,
    onLeave: req.body.onLeave !== undefined ? Boolean(req.body.onLeave) : false,
    leaveReason: req.body.leaveReason || '',
    lateReason: req.body.lateReason || '',
    loggedBy: req.body.loggedBy || null,
    createdAt: new Date().toISOString()
  };

  records.push(newRecord);
  writeJSON('attendance.json', records);
  res.status(201).json(newRecord);
});

// PUT /api/attendance/:id
app.put('/api/attendance/:id', (req, res) => {
  const records = readJSON('attendance.json');
  const idx = records.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Record not found' });

  const updates = req.body;
  delete updates.id;
  Object.assign(records[idx], updates);
  writeJSON('attendance.json', records);
  res.json(records[idx]);
});

// ══════════════════════════════════════════════════════════════════════════
//  PAYMENTS (SALARY) ROUTES
// ══════════════════════════════════════════════════════════════════════════

// GET /api/payments?userId=&month=
app.get('/api/payments', (req, res) => {
  let payments = readJSON('payments.json');
  const { userId, month } = req.query;

  if (userId) payments = payments.filter(p => p.userId === userId);
  if (month)  payments = payments.filter(p => p.date && p.date.startsWith(month));

  res.json(payments);
});

// POST /api/payments
app.post('/api/payments', (req, res) => {
  const payments = readJSON('payments.json');
  const newPayment = {
    id: uuidv4(),
    userId: req.body.userId,
    amount: Number(req.body.amount) || 0,
    date: req.body.date || new Date().toISOString().split('T')[0],
    note: req.body.note || '',
    photoData: req.body.photoData || null,
    loggedBy: req.body.loggedBy || null,
    createdAt: new Date().toISOString()
  };

  payments.push(newPayment);
  writeJSON('payments.json', payments);
  res.status(201).json(newPayment);
});

// DELETE /api/payments/:id
app.delete('/api/payments/:id', (req, res) => {
  const payments = readJSON('payments.json');
  const filtered = payments.filter(p => p.id !== req.params.id);
  if (filtered.length === payments.length) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  writeJSON('payments.json', filtered);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════
//  INVENTORY ROUTES
// Note: specific sub-routes (/history, /bulk-add) MUST be declared
//       before the generic /:id route to avoid shadowing.
// ══════════════════════════════════════════════════════════════════════════

// GET /api/inventory/history
app.get('/api/inventory/history', (req, res) => {
  let history = readJSON('inventoryHistory.json');
  const { startDate, endDate, category } = req.query;

  if (category)  history = history.filter(h => h.category === category);
  if (startDate) history = history.filter(h => h.date >= startDate);
  if (endDate)   history = history.filter(h => h.date <= endDate);

  res.json(history);
});

// POST /api/inventory/history
app.post('/api/inventory/history', (req, res) => {
  const history = readJSON('inventoryHistory.json');
  const entry = {
    id: uuidv4(),
    date: req.body.date || new Date().toISOString().split('T')[0],
    category: req.body.category || '',
    name: req.body.name || '',
    nameHindi: req.body.nameHindi || '',
    qty: Number(req.body.qty) || 0,
    unit: req.body.unit || '',
    rate: Number(req.body.rate) || 0,
    source: req.body.source || 'Manual',
    loggedBy: req.body.loggedBy || null,
    createdAt: new Date().toISOString()
  };

  history.push(entry);
  writeJSON('inventoryHistory.json', history);
  res.status(201).json(entry);
});

// POST /api/inventory/bulk-add
app.post('/api/inventory/bulk-add', (req, res) => {
  const items = readJSON('inventory.json');
  const history = readJSON('inventoryHistory.json');
  const { entries, loggedBy, source, date } = req.body;

  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'entries must be an array' });
  }

  const today = date || new Date().toISOString().split('T')[0];
  const updatedItems = [];
  const newHistoryEntries = [];

  entries.forEach(entry => {
    const idx = items.findIndex(item => item.id === entry.id);
    if (idx !== -1 && Number(entry.qty) > 0) {
      items[idx].quantity = (Number(items[idx].quantity) || 0) + Number(entry.qty);
      if (entry.rate !== undefined) {
        items[idx].rate = Number(entry.rate);
      }
      updatedItems.push(items[idx]);

      const histEntry = {
        id: uuidv4(),
        date: today,
        category: items[idx].category,
        name: items[idx].name,
        nameHindi: items[idx].nameHindi || '',
        qty: Number(entry.qty),
        unit: items[idx].unit,
        rate: Number(entry.rate) !== undefined ? Number(entry.rate) : items[idx].rate,
        source: source || 'Bulk Add',
        loggedBy: loggedBy || null,
        createdAt: new Date().toISOString()
      };
      newHistoryEntries.push(histEntry);
      history.push(histEntry);
    }
  });

  writeJSON('inventory.json', items);
  writeJSON('inventoryHistory.json', history);
  res.json({ updatedItems, newHistoryEntries });
});

// GET /api/inventory?category=
app.get('/api/inventory', (req, res) => {
  let items = readJSON('inventory.json');
  const { category } = req.query;
  if (category) items = items.filter(i => i.category === category);
  res.json(items);
});

// POST /api/inventory
app.post('/api/inventory', (req, res) => {
  const items = readJSON('inventory.json');
  const newItem = {
    id: uuidv4(),
    category: req.body.category || 'Grocery',
    name: req.body.name || '',
    nameHindi: req.body.nameHindi || '',
    quantity: Number(req.body.quantity) || 0,
    unit: req.body.unit || 'kg',
    threshold: Number(req.body.threshold) || 1,
    rate: Number(req.body.rate) || 0
  };

  items.push(newItem);
  writeJSON('inventory.json', items);
  res.status(201).json(newItem);
});

// PUT /api/inventory/:id
app.put('/api/inventory/:id', (req, res) => {
  const items = readJSON('inventory.json');
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });

  const updates = req.body;
  delete updates.id;
  Object.assign(items[idx], updates);
  writeJSON('inventory.json', items);
  res.json(items[idx]);
});

// DELETE /api/inventory/:id
app.delete('/api/inventory/:id', (req, res) => {
  const items = readJSON('inventory.json');
  const filtered = items.filter(i => i.id !== req.params.id);
  if (filtered.length === items.length) {
    return res.status(404).json({ error: 'Item not found' });
  }
  writeJSON('inventory.json', filtered);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════
//  EXPENSES ROUTES
// ══════════════════════════════════════════════════════════════════════════

// GET /api/expenseCategories
app.get('/api/expenseCategories', (req, res) => {
  res.json(readJSON('expenseCategories.json'));
});

// POST /api/expenseCategories
app.post('/api/expenseCategories', (req, res) => {
  const cats = readJSON('expenseCategories.json');
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (cats.includes(name.trim())) {
    return res.status(400).json({ error: 'Category already exists' });
  }
  cats.push(name.trim());
  writeJSON('expenseCategories.json', cats);
  res.status(201).json(cats);
});

// GET /api/expenses?month=&category=
app.get('/api/expenses', (req, res) => {
  let expenses = readJSON('expenses.json');
  const { month, category } = req.query;

  if (month)    expenses = expenses.filter(e => e.date && e.date.startsWith(month));
  if (category) expenses = expenses.filter(e => e.category === category);

  res.json(expenses);
});

// POST /api/expenses
app.post('/api/expenses', (req, res) => {
  const expenses = readJSON('expenses.json');
  const newExpense = {
    id: uuidv4(),
    date: req.body.date || new Date().toISOString().split('T')[0],
    category: req.body.category || 'Misc',
    amount: Number(req.body.amount) || 0,
    description: req.body.description || '',
    photoData: req.body.photoData || null,
    loggedBy: req.body.loggedBy || null,
    createdAt: new Date().toISOString()
  };

  expenses.push(newExpense);
  writeJSON('expenses.json', expenses);
  res.status(201).json(newExpense);
});

// PUT /api/expenses/:id
app.put('/api/expenses/:id', (req, res) => {
  const expenses = readJSON('expenses.json');
  const idx = expenses.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Expense not found' });

  const updates = req.body;
  delete updates.id;
  Object.assign(expenses[idx], updates);
  writeJSON('expenses.json', expenses);
  res.json(expenses[idx]);
});

// DELETE /api/expenses/:id
app.delete('/api/expenses/:id', (req, res) => {
  const expenses = readJSON('expenses.json');
  const filtered = expenses.filter(e => e.id !== req.params.id);
  if (filtered.length === expenses.length) {
    return res.status(404).json({ error: 'Expense not found' });
  }
  writeJSON('expenses.json', filtered);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════
//  INVENTORY CATEGORIES ROUTES
// ══════════════════════════════════════════════════════════════════════════

// GET /api/inventoryCategories
app.get('/api/inventoryCategories', (req, res) => {
  res.json(readJSON('inventoryCategories.json'));
});

// POST /api/inventoryCategories
app.post('/api/inventoryCategories', (req, res) => {
  const cats = readJSON('inventoryCategories.json');
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (cats.includes(name.trim())) {
    return res.status(400).json({ error: 'Category already exists' });
  }
  cats.push(name.trim());
  writeJSON('inventoryCategories.json', cats);
  res.status(201).json(cats);
});

// ══════════════════════════════════════════════════════════════════════════
//  PHOTO UPLOAD
// ══════════════════════════════════════════════════════════════════════════

// POST /api/upload
app.post('/api/upload', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ══════════════════════════════════════════════════════════════════════════
//  SHIFTS ROUTES
// ══════════════════════════════════════════════════════════════════════════

// GET /api/shifts
app.get('/api/shifts', (req, res) => {
  res.json(readJSON('shifts.json'));
});

// POST /api/shifts
app.post('/api/shifts', (req, res) => {
  const shifts = readJSON('shifts.json');
  const { name, startTime, endTime, color } = req.body;
  if (!name || !startTime || !endTime) return res.status(400).json({ error: 'name, startTime and endTime required' });
  const newShift = { id: uuidv4(), name: name.trim(), startTime, endTime, color: color || '#2e7d32' };
  shifts.push(newShift);
  writeJSON('shifts.json', shifts);
  res.status(201).json(newShift);
});

// PUT /api/shifts/:id
app.put('/api/shifts/:id', (req, res) => {
  const shifts = readJSON('shifts.json');
  const idx = shifts.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Shift not found' });
  Object.assign(shifts[idx], req.body);
  writeJSON('shifts.json', shifts);
  res.json(shifts[idx]);
});

// DELETE /api/shifts/:id
app.delete('/api/shifts/:id', (req, res) => {
  const shifts = readJSON('shifts.json');
  const filtered = shifts.filter(s => s.id !== req.params.id);
  if (filtered.length === shifts.length) return res.status(404).json({ error: 'Shift not found' });
  writeJSON('shifts.json', filtered);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════
//  HEALTH CHECK
// ══════════════════════════════════════════════════════════════════════════

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ══════════════════════════════════════════════════════════════════════════
//  CATCH-ALL — serve SPA for all non-API GET requests
// ══════════════════════════════════════════════════════════════════════════
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ── Start server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Resort Manager server running on http://localhost:${PORT}`);
});

module.exports = app;
