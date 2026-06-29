# Resort Staff Manager — Implementation Plan

**For Agents 2 and 3.** Agent 1 has already created all data files, `backend/server.js`, `frontend/index.html`, and `package.json`. Agent 2 owns the backend (already complete — review and verify only); Agent 3 owns the frontend (`frontend/app.js` and `frontend/style.css`).

---

## 1. Project Structure

```
demo1/
├── package.json
├── PLAN.md
├── backend/
│   ├── server.js               COMPLETE (Agent 1)
│   ├── uploads/                created at runtime by server
│   └── data/
│       ├── users.json
│       ├── tasks.json
│       ├── attendance.json
│       ├── payments.json
│       ├── inventory.json          pre-seeded 48 items
│       ├── inventoryHistory.json
│       ├── inventoryCategories.json
│       ├── expenses.json
│       ├── expenseCategories.json
│       └── settings.json
└── frontend/
    ├── index.html              COMPLETE (Agent 1)
    ├── style.css               Agent 3 must create
    └── app.js                  Agent 3 must create
```

---

## 2. Data Schemas

### 2.1 User
```json
{
  "id": "uuid-v4",
  "name": "string",
  "phone": "string (optional)",
  "pin": "string (NEVER sent to client — stripped on all API responses)",
  "role": "Owner | Manager | Staff | Kitchen Staff",
  "monthlySalary": 0,
  "createdAt": "ISO-8601"
}
```

### 2.2 Task
```json
{
  "id": "uuid-v4",
  "title": "string",
  "description": "string",
  "category": "General | Inventory Purchase | Kitchen Equipment | Maintenance | Cleaning | Other",
  "assignedTo": "userId | null",
  "requestedBy": "userId | null",
  "status": "Pending | In Progress | Done",
  "priority": "Low | Normal | High | Urgent",
  "dueDate": "YYYY-MM-DD | null",
  "repeatType": "None | Daily | Weekly | Monthly",
  "completedAt": "ISO-8601 | null",
  "notes": "string",
  "attachmentUrl": "string | null",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

### 2.3 Attendance Record
```json
{
  "id": "uuid-v4",
  "userId": "uuid-v4",
  "date": "YYYY-MM-DD",
  "status": "Present | Absent | Half Day | Late",
  "checkIn": "HH:MM | null",
  "checkOut": "HH:MM | null",
  "note": "string",
  "loggedBy": "userId | null",
  "createdAt": "ISO-8601"
}
```

### 2.4 Payment (Salary Payment)
```json
{
  "id": "uuid-v4",
  "userId": "uuid-v4",
  "amount": 5000,
  "date": "YYYY-MM-DD",
  "note": "string",
  "photoData": "base64 string | null",
  "loggedBy": "userId | null",
  "createdAt": "ISO-8601"
}
```

### 2.5 Inventory Item
```json
{
  "id": "string (e.g. inv-veg-001 or uuid)",
  "category": "Vegetables | Grocery | Dairy | (custom)",
  "name": "Potato",
  "nameHindi": "आलू",
  "quantity": 0,
  "unit": "kg | litre | pcs | packet",
  "threshold": 1,
  "rate": 0
}
```
Item is **low stock** when `quantity <= threshold`.

### 2.6 Inventory History Entry
```json
{
  "id": "uuid-v4",
  "date": "YYYY-MM-DD",
  "category": "Vegetables",
  "name": "Potato",
  "nameHindi": "आलू",
  "qty": 10,
  "unit": "kg",
  "rate": 25,
  "source": "Bulk Add | Manual | Task",
  "loggedBy": "userId | null",
  "createdAt": "ISO-8601"
}
```

### 2.7 Expense
```json
{
  "id": "uuid-v4",
  "date": "YYYY-MM-DD",
  "category": "Electricity | Repairs & Maintenance | Vendor Payment | Fuel/Diesel | Internet/Phone | Misc",
  "amount": 1500,
  "description": "string",
  "photoData": "base64 string | null",
  "loggedBy": "userId | null",
  "createdAt": "ISO-8601"
}
```

### 2.8 Settings
```json
{
  "setupDone": true,
  "shiftStartTime": "10:00",
  "resortName": "My Resort"
}
```

---

## 3. All API Routes

Base URL: `http://localhost:3000`. All request/response bodies are `application/json`.

### 3.1 Auth & Setup

| Method | Path | Request Body | Success Response |
|--------|------|-------------|-----------------|
| GET | `/api/settings` | — | `{setupDone, shiftStartTime, resortName}` |
| PUT | `/api/settings` | any settings fields | updated settings object |
| POST | `/api/setup` | `{name, phone?, pin, resortName?}` | `{user: UserNoPIN, settings}` |
| POST | `/api/signin` | `{name, pin}` | UserNoPIN object or 401 `{error}` |

### 3.2 Users

| Method | Path | Request Body / Query | Success Response |
|--------|------|---------------------|-----------------|
| GET | `/api/users` | — | `[UserNoPIN, ...]` |
| POST | `/api/users` | `{name, phone?, pin, role, monthlySalary?}` | `201 UserNoPIN` |
| PUT | `/api/users/:id` | any user fields | updated UserNoPIN |
| DELETE | `/api/users/:id` | — | `{success: true}` |

### 3.3 Tasks

| Method | Path | Query / Body | Success Response |
|--------|------|-------------|-----------------|
| GET | `/api/tasks` | `?assignedTo=&status=&category=&requestedBy=` | `[Task, ...]` |
| POST | `/api/tasks` | task fields | `201 Task` |
| PUT | `/api/tasks/:id` | task fields | `{task, nextTask?, doneInventoryPurchase?, doneKitchenEquipment?}` |
| DELETE | `/api/tasks/:id` | — | `{success: true}` |

**PUT special flags in response:**
- `nextTask`: populated when a repeating task is marked Done — it is the auto-created next occurrence.
- `doneInventoryPurchase: true`: when `category === 'Inventory Purchase'` is marked Done. Frontend should prompt to bulk-add inventory.
- `doneKitchenEquipment: true`: when `category === 'Kitchen Equipment'` is marked Done.

### 3.4 Attendance

| Method | Path | Query / Body | Success Response |
|--------|------|-------------|-----------------|
| GET | `/api/attendance` | `?userId=&date=YYYY-MM-DD&month=YYYY-MM` | `[Record, ...]` |
| POST | `/api/attendance` | record fields | `201 Record` |
| PUT | `/api/attendance/:id` | any record fields | updated Record |

### 3.5 Payments

| Method | Path | Query / Body | Success Response |
|--------|------|-------------|-----------------|
| GET | `/api/payments` | `?userId=&month=YYYY-MM` | `[Payment, ...]` |
| POST | `/api/payments` | `{userId, amount, date, note?, photoData?, loggedBy?}` | `201 Payment` |
| DELETE | `/api/payments/:id` | — | `{success: true}` |

### 3.6 Inventory

| Method | Path | Query / Body | Success Response |
|--------|------|-------------|-----------------|
| GET | `/api/inventory` | `?category=` | `[Item, ...]` |
| POST | `/api/inventory` | item fields | `201 Item` |
| PUT | `/api/inventory/:id` | any item fields | updated Item |
| DELETE | `/api/inventory/:id` | — | `{success: true}` |
| GET | `/api/inventory/history` | `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&category=` | `[HistoryEntry, ...]` |
| POST | `/api/inventory/history` | history entry fields | `201 HistoryEntry` |
| POST | `/api/inventory/bulk-add` | `{entries:[{id,qty,rate?}], loggedBy?, source?, date?}` | `{updatedItems, newHistoryEntries}` |

### 3.7 Expenses

| Method | Path | Query / Body | Success Response |
|--------|------|-------------|-----------------|
| GET | `/api/expenses` | `?month=YYYY-MM&category=` | `[Expense, ...]` |
| POST | `/api/expenses` | expense fields | `201 Expense` |
| PUT | `/api/expenses/:id` | any expense fields | updated Expense |
| DELETE | `/api/expenses/:id` | — | `{success: true}` |
| GET | `/api/expenseCategories` | — | `["Electricity", ...]` |
| POST | `/api/expenseCategories` | `{name}` | updated categories array |

### 3.8 Inventory Categories

| Method | Path | Body | Success Response |
|--------|------|------|-----------------|
| GET | `/api/inventoryCategories` | — | `["Vegetables", "Grocery", "Dairy", ...]` |
| POST | `/api/inventoryCategories` | `{name}` | updated categories array |

### 3.9 Upload

| Method | Path | Body | Success Response |
|--------|------|------|-----------------|
| POST | `/api/upload` | multipart form, field name `photo` | `{url: "/uploads/filename.jpg"}` |

---

## 4. Role Permissions Matrix

| Feature | Owner | Manager | Staff | Kitchen Staff |
|---------|-------|---------|-------|---------------|
| **Tasks tab visible** | Yes | Yes | Yes | Yes |
| See all tasks | Yes | Yes | No | No |
| See own tasks only (assigned to OR requested by) | — | — | Yes | Yes |
| Create task for others | Yes | Yes | No | No |
| Use generic purchase request form | Yes | Yes | Yes | No |
| Use Kitchen Equipment request form | No | No | No | Yes |
| Edit/delete any task | Yes | Yes | No | No |
| Update own task status + notes | Yes | Yes | Yes | Yes |
| **Attendance tab visible** | Yes | Yes | Yes | Yes |
| View all staff attendance | Yes | Yes | No | No |
| View own attendance only | — | — | Yes | Yes |
| Mark/edit others' attendance | Yes | Yes | No | No |
| **Salary tab visible** | Yes | Yes | No | No |
| View/add salary payments | Yes | Yes | — | — |
| **Notify tab visible** | Yes | Yes | Yes | Yes |
| Send to specific staff | Yes | Yes | No (send to owner only) | No (send to owner only) |
| **Inventory tab visible** | Yes | Yes | No | Yes |
| View/edit inventory items | Yes | Yes | — | Yes |
| Bulk-add stock | Yes | Yes | — | Yes |
| **Expenses tab visible** | Yes | Yes | No | No |
| View/add/edit expenses | Yes | Yes | — | — |
| **Staff management (add/edit/delete users)** | Yes | Yes | No | No |
| **Settings (resort name, shift time)** | Yes | No | No | No |

---

## 5. Frontend State Variables (app.js)

Agent 3 must declare these at the module level in `app.js`:

```js
// ── Authentication & App ─────────────────────────────────────────────
let currentUser = null;         // full user object (no pin) after sign-in
let settings = null;            // object from GET /api/settings
let currentTab = 'tasks';       // currently active tab string

// ── Cached Data ──────────────────────────────────────────────────────
let allUsers = [];              // from GET /api/users
let allTasks = [];              // from GET /api/tasks (filtered by role in UI)
let allAttendance = [];         // from GET /api/attendance for current month
let allPayments = [];           // from GET /api/payments
let allInventory = [];          // from GET /api/inventory
let inventoryHistory = [];      // from GET /api/inventory/history
let allExpenses = [];           // from GET /api/expenses for current month
let expenseCategories = [];     // from GET /api/expenseCategories
let inventoryCategories = [];   // from GET /api/inventoryCategories

// ── UI / Filter State ────────────────────────────────────────────────
let selectedMonth = '';                     // "YYYY-MM" for salary/attendance/expense
let selectedAttendanceDate = '';            // "YYYY-MM-DD" for attendance day view
let selectedInventoryCategory = 'All';     // category filter for inventory tab
let taskStatusFilter = 'All';              // All | Pending | In Progress | Done
let pendingConfirmCallback = null;         // function to call when confirm-modal says Yes

// ── Background Timers ────────────────────────────────────────────────
let syncIntervalId = null;       // returned by setInterval for 30s sync
let alertIntervalId = null;      // returned by setInterval for 60min alert check
```

---

## 6. Polling & Background Checks

### 30-second data sync
After sign-in, start:
```js
syncIntervalId = setInterval(syncActiveTab, 30_000);
```
`syncActiveTab()` re-fetches only the data relevant to `currentTab` and re-renders. On sign-out clear with `clearInterval(syncIntervalId)`.

### 60-minute alert check
```js
checkAlertsAndBanners();   // run immediately on sign-in
alertIntervalId = setInterval(checkAlertsAndBanners, 60 * 60_000);
```

`checkAlertsAndBanners()` logic:
1. **Low-stock check** (Owner, Manager, Kitchen Staff only): scan `allInventory` for items where `quantity <= threshold`. If any found, show `#lowstock-alert-banner` with text like "3 items low on stock: Milk, Potato, Rice". If none, hide the banner.
2. **Kitchen equipment tasks overdue** (Owner, Manager only): scan `allTasks` for `category === 'Kitchen Equipment'` AND `status !== 'Done'` AND `dueDate < today`. If any found, show `#kitchen-alert-banner`. If none, hide it.
3. **Missed duty check** (Owner, Manager only): fetch today's attendance. Any user in `allUsers` (role Staff or Kitchen Staff) who has no attendance record for today AND current time is more than 60 minutes after `settings.shiftStartTime` — show `#missed-duty-banner`.

---

## 7. WhatsApp URL Patterns

All WhatsApp notifications open `https://wa.me/` in a new tab.

```js
// Helper — always strips non-digits, prepends 91 if not already present
function openWhatsApp(phone, message) {
  const clean = String(phone).replace(/\D/g, '');
  const number = clean.startsWith('91') ? clean : `91${clean}`;
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank');
}
```

**Message templates:**

```js
// Task assigned to staff
`नमस्ते ${staffName}!\nआपको एक नया कार्य सौंपा गया है:\n📋 ${taskTitle}\nDue: ${formatDate(dueDate)}\nPriority: ${priority}\n— ${settings.resortName}`

// Task reminder (owner/manager → staff)
`Reminder: "${taskTitle}" is due today.\nPlease complete it.\n— ${settings.resortName}`

// Salary paid notification
`${staffName} जी,\nआपकी ₹${amount} salary ${formatDate(date)} को दी गई है।\n— ${settings.resortName}`

// Buying list (generated from Inventory Purchase task items)
`खरीदारी सूची / Buying List:\n${items.map(i => `• ${i.nameHindi} (${i.name}): ${i.qty} ${i.unit} @ ₹${i.rate}`).join('\n')}\n— ${settings.resortName}`

// Kitchen equipment request (Kitchen Staff → Owner/Manager)
`Kitchen Equipment Request:\nItem: ${equipmentName}\nReason: ${reason}\nUrgency: ${urgency}\nRequested by: ${currentUser.name}\n— ${settings.resortName}`

// Staff quick-send: "I'll be late"
`Hello, I will be late today. — ${currentUser.name}, ${settings.resortName}`

// Staff quick-send: "Sick today"
`Hello, I am not feeling well and cannot come today. — ${currentUser.name}, ${settings.resortName}`

// Staff quick-send: "Task done"
`Task completed: "${taskTitle}"\n— ${currentUser.name}, ${settings.resortName}`
```

---

## 8. App Boot Sequence (app.js)

```
DOMContentLoaded fires
  │
  ├─ fetch GET /api/settings
  │     │
  │     ├─ setupDone === false
  │     │     └─ show #setup-screen
  │     │         └─ on setup-form submit → POST /api/setup
  │     │               └─ success → update settings, store user → proceed to app
  │     │
  │     └─ setupDone === true
  │           ├─ set #signin-resort-name text
  │           └─ show #signin-screen
  │                 └─ on signin-form submit → POST /api/signin
  │                       ├─ 401 → show #signin-error
  │                       └─ 200 → store currentUser
  │                               → applyRoleVisibility()   (hide/show tabs)
  │                               → show #app
  │                               → loadInitialData()       (fetch all cached data)
  │                               → renderTab('tasks')
  │                               → syncIntervalId = setInterval(syncActiveTab, 30000)
  │                               → checkAlertsAndBanners()
  │                               → alertIntervalId = setInterval(checkAlertsAndBanners, 3600000)
  │
  └─ on #signout-btn click
        → clearInterval(syncIntervalId)
        → clearInterval(alertIntervalId)
        → currentUser = null
        → show #signin-screen, hide #app
```

---

## 9. Tab Implementation Notes

### Tasks Tab
- Status filter bar at the top: All | Pending | In Progress | Done (button group).
- **Owner/Manager view**: shows all tasks. Top-right "Add Task" button opens task-modal. Each task card has Edit and Delete icons.
- **Staff/Kitchen Staff view**: filtered to `assignedTo === currentUser.id || requestedBy === currentUser.id`. No Add Task button for others. Can only update status and notes on their own tasks.
- **Task card fields**: title, category badge, status badge, priority badge, due date, assigned-to name (resolved from `allUsers`).
- **Overdue highlighting**: if `dueDate < today` and `status !== 'Done'`, add red border or background to card.
- **On mark Done (PUT response has `doneInventoryPurchase: true`)**: open buying-list-modal showing the task's items so manager can confirm quantities received. On confirm → call `POST /api/inventory/bulk-add`.
- **Purchase request form for Staff**: form with fields `title` (item name), `description` (reason/details), `priority`. Posts task with `category: 'Inventory Purchase'`, `requestedBy: currentUser.id`.
- **Kitchen Equipment form for Kitchen Staff**: fields: `title` (equipment name), `description` (reason), `priority` (urgency: Normal/High/Urgent). Posts task with `category: 'Kitchen Equipment'`, `requestedBy: currentUser.id`. Also offers a WhatsApp button to notify owner directly.

### Attendance Tab
- Default view: today's date.
- **Owner/Manager**: grid of all staff for selected date. Each row: staff name, role, status dropdown (Present/Absent/Half Day/Late), check-in time, check-out time, notes. "Save All" button.
- **Month summary view** (toggle): table showing each staff member vs days of month, each cell a coloured dot (green=Present, red=Absent, yellow=Half Day, orange=Late, grey=no record).
- **Staff/Kitchen Staff**: read-only view of their own records. Shows calendar-style dots for the current month.
- When check-in time is after `settings.shiftStartTime`, auto-suggest status "Late" and show `#late-modal`.

### Salary Tab (Owner/Manager only)
- Staff picker (dropdown or list).
- For selected staff + month: show `monthlySalary`, total paid (sum of payments.amount), balance (monthlySalary - totalPaid), days present (from attendance).
- Payment history list: date, amount, note, optional photo thumbnail.
- "Add Payment" form: amount, date, note, photo (base64).
- WhatsApp button per payment: sends salary-paid message to that staff's phone.

### Notify Tab
- **Owner/Manager**: compose area with text input, recipient selector (individual user or "All Staff"), WhatsApp send button. Task reminder shortcut: select a task → auto-fills reminder message with that task's details → sends to assigned staff.
- **Staff/Kitchen Staff**: three quick-send buttons: "I'll be Late", "Sick Today", "Task Done" (picks most recent in-progress task). Sends to owner/manager phone. Owner/Manager phone is the first user in `allUsers` with role `Owner` who has a phone set.

### Inventory Tab (Owner/Manager/Kitchen Staff)
- Category filter tabs: All | Vegetables | Grocery | Dairy | (custom categories, dynamically rendered).
- Item list: name (English + Hindi below), quantity, unit, rate (₹/unit), threshold. Low-stock: red left border.
- **Bulk Add** button: opens buying-list-modal style form. Checkbox-select items, enter qty received and rate paid for each. On submit → `POST /api/inventory/bulk-add`. Then re-fetch inventory.
- **Add Item**: form with category, name, nameHindi, unit, threshold, starting qty, rate.
- **Edit Item**: inline edit or modal. Can update threshold, rate, unit, names.
- **History** view (toggle): table of all history entries, filterable by date range and category. Columns: date, category, name (Hindi), qty added, unit, rate, source, logged by.
- **Low-stock summary**: a separate "Low Stock" filter that shows only `quantity <= threshold` items across all categories.

### Expenses Tab (Owner/Manager only)
- Month picker defaulting to current month.
- Total for selected month shown prominently.
- Expense list: date, category badge, amount, description, optional photo thumbnail. Edit and Delete icons.
- Add Expense form: date, category (dropdown from `expenseCategories`), amount (₹), description, photo (optional).
- Category management: small "Manage Categories" button → inline list with "Add new" input.
- Breakdown chart (optional, no library needed): simple CSS bar chart showing expense by category.

---

## 10. UI/UX Specification for style.css

### Layout
- Mobile-first, max-width 480px, centered on desktop with `margin: auto`.
- `#app-header`: fixed top, height 52px, z-index 100.
- `#tab-bar`: fixed bottom, height 60px, z-index 100, flex row, 6 items equal width.
- `#tab-content`: `padding-top: 60px; padding-bottom: 68px; overflow-y: auto;` so content scrolls between header and tab bar.
- Alert banners: fixed below header, `top: 52px`, full width, z-index 90, `padding: 8px 12px`.

### Color Palette
```css
:root {
  --primary:     #2e7d32;   /* dark green */
  --primary-lt:  #e8f5e9;   /* light green tint */
  --accent:      #ff8f00;   /* amber */
  --danger:      #c62828;   /* red */
  --warning:     #f57c00;   /* orange */
  --info:        #1565c0;   /* blue */
  --surface:     #ffffff;
  --bg:          #f1f3f4;
  --text:        #212121;
  --text-muted:  #757575;
  --border:      #e0e0e0;
  --shadow:      0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08);
}
```

### Font
```css
body { font-family: 'Noto Sans', 'Noto Sans Devanagari', sans-serif; }
```

### Status Badges
- Pending: `background: #e0e0e0; color: #424242`
- In Progress: `background: #e3f2fd; color: #1565c0`
- Done: `background: #e8f5e9; color: #2e7d32`

### Priority Badges
- Low: grey, Normal: blue, High: orange `#e65100`, Urgent: red `#b71c1c`

### Role Badges
- Owner: `#f57f17` (gold), Manager: `#006064` (teal), Staff: `#1565c0` (blue), Kitchen Staff: `#6a1b9a` (purple)

### Component Patterns
- **Cards**: `background: var(--surface); border-radius: 10px; padding: 14px 16px; box-shadow: var(--shadow); margin: 8px 12px;`
- **Low-stock card**: add `border-left: 4px solid var(--danger);`
- **Overdue task card**: add `border-left: 4px solid var(--warning);`
- **Buttons**: `btn-primary` (green bg, white text), `btn-danger` (red bg, white text), `btn-ghost` (transparent bg, border), `btn-sm` (smaller padding).
- **Modals**: fixed overlay with `backdrop-filter: blur(2px)`, modal box slides up (`transform: translateY(100%)` → `translateY(0)`).
- **Toast**: fixed bottom-center, auto-dismiss 3s, colors by type (success=green, error=red, info=blue).
- **Tab active state**: `color: var(--primary); border-top: 2px solid var(--primary);`
- **Form inputs**: full width, border `1px solid var(--border)`, border-radius 8px, padding 10px 12px, font-size 16px (prevents iOS zoom).
- **Auth card**: centered, max-width 360px, white card with padding 32px, border-radius 16px.

---

## 11. Error Handling Conventions

- Every `fetch()` must `.catch(err => showToast(err.message || 'Network error', 'error'))`.
- 4xx responses: parse JSON `.error` field, display in `showToast()` or relevant `form-error` paragraph.
- 5xx responses: show `showToast('Server error, please try again', 'error')`.
- `showToast(message, type)` — type: `'success' | 'error' | 'info'`. Auto-dismisses after 3 seconds.

---

## 12. Key Implementation Constraints

- **No build step**: `app.js` and `style.css` are plain static files. No bundler, no `import`/`export`, no TypeScript. Use module-level `let`/`const` and plain functions.
- **No auth middleware on server**: server trusts client role. Security is not a requirement for this internal tool.
- **No localStorage for data**: all data comes from server on each tab load. `currentUser` may be stored in `sessionStorage` for page-refresh persistence (optional).
- **PIN never returned**: server strips `pin` from all user API responses. Frontend never stores or displays PINs.
- **Date display**: store as `YYYY-MM-DD`, display as `DD/MM/YYYY` for Indian users. Use a simple `formatDate(str)` helper.
- **Currency**: display as `₹` prefix, whole numbers (no decimals for salaries/expenses/payments). E.g. `₹5,000`.
- **Hindi text**: all inventory items have `name` (English) and `nameHindi` (Hindi). Render both: English in normal weight, Hindi below in smaller muted text.
- **Photo storage**: use base64 in `photoData` field for payments and expenses — no extra upload call needed. For task attachments, use `POST /api/upload` and store the returned URL in `attachmentUrl`.
- **Server port**: always 3000. API calls from `app.js` should use relative paths (`/api/...`) since frontend is served by the same Express instance.
