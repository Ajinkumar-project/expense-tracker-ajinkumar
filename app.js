/* ============================================================
   ExpenseIQ – Main Application Logic
   ============================================================ */

'use strict';

// ────────────────────────────────────────────────────────────
// CONSTANTS & CONFIG
// ────────────────────────────────────────────────────────────
const STORAGE_KEY = 'expenseiq_transactions';

const CATEGORIES = {
  income: [
    { id: 'salary',     label: '💼 Salary',      icon: '💼' },
    { id: 'freelance',  label: '💻 Freelance',    icon: '💻' },
    { id: 'investment', label: '📈 Investment',   icon: '📈' },
    { id: 'business',   label: '🏪 Business',     icon: '🏪' },
    { id: 'gift',       label: '🎁 Gift',         icon: '🎁' },
    { id: 'other-in',   label: '💰 Other',        icon: '💰' },
  ],
  expense: [
    { id: 'food',       label: '🍔 Food & Dining', icon: '🍔' },
    { id: 'transport',  label: '🚗 Transport',     icon: '🚗' },
    { id: 'shopping',   label: '🛍️ Shopping',      icon: '🛍️' },
    { id: 'health',     label: '🏥 Health',        icon: '🏥' },
    { id: 'utilities',  label: '⚡ Utilities',     icon: '⚡' },
    { id: 'rent',       label: '🏠 Rent',          icon: '🏠' },
    { id: 'education',  label: '📚 Education',     icon: '📚' },
    { id: 'entertainment', label: '🎬 Entertainment', icon: '🎬' },
    { id: 'travel',     label: '✈️ Travel',         icon: '✈️' },
    { id: 'fitness',    label: '💪 Fitness',        icon: '💪' },
    { id: 'subscriptions', label: '📱 Subscriptions', icon: '📱' },
    { id: 'other-ex',  label: '💸 Other',          icon: '💸' },
  ]
};

const CHART_COLORS = [
  '#6c63ff','#00d4a0','#ff5c7c','#ffb547','#3ecfff',
  '#ff6b6b','#a78bfa','#34d399','#f97316','#38bdf8',
  '#fb7185','#4ade80',
];

// ────────────────────────────────────────────────────────────
// STATE
// ────────────────────────────────────────────────────────────
let transactions = [];
let editingId    = null;
let currentType  = 'income';  // for form
let txnFilter    = 'all';
let categoryFilter = 'all';
let searchQuery  = '';

// Dashboard month
const now = new Date();
let dashMonth = now.getMonth();
let dashYear  = now.getFullYear();

// Analytics month
let anMonth = now.getMonth();
let anYear  = now.getFullYear();

let dashDonutChart = null;
let anDonutChart   = null;
let anBarChart     = null;

// ────────────────────────────────────────────────────────────
// LOCAL STORAGE
// ────────────────────────────────────────────────────────────
// Known dummy/seed transaction descriptions to filter out legacy seeded data from localStorage
const DUMMY_DESCRIPTIONS = new Set([
  'Monthly Salary – September', 'Website Design Project', 'Monthly Rent',
  'Grocery Shopping', 'Uber rides', 'Netflix & Spotify', 'New Sneakers',
  'Dividend Income', 'Pharmacy', 'Movie & dinner', 'Monthly Salary – August',
  'Clothing haul', 'Restaurant dinners', 'Logo Design', 'Electricity & Water'
]);

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Remove any previously seeded dummy transactions
      transactions = Array.isArray(parsed)
        ? parsed.filter(t => !DUMMY_DESCRIPTIONS.has(t.description))
        : [];
      if (Array.isArray(parsed) && transactions.length !== parsed.length) {
        saveData();
      }
    } else {
      transactions = [];
    }
  } catch (e) {
    transactions = [];
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// ────────────────────────────────────────────────────────────
// UTILITIES
// ────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatCurrency(amount) {
  return '₹' + Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getMonthName(month, year) {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function getCategoryLabel(type, id) {
  const cats = CATEGORIES[type] || [];
  const c = cats.find(c => c.id === id);
  return c ? c.label : id;
}

function getCategoryIcon(type, id) {
  const cats = CATEGORIES[type] || [];
  const c = cats.find(c => c.id === id);
  return c ? c.icon : (type === 'income' ? '💰' : '💸');
}

function allCategories() {
  return [...CATEGORIES.income, ...CATEGORIES.expense];
}

function today() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// ────────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ────────────────────────────────────────────────────────────
function showToast(type, title, message, duration = 3500) {
  const container = document.getElementById('toast-container');

  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ────────────────────────────────────────────────────────────
// CONFIRM MODAL
// ────────────────────────────────────────────────────────────
function showConfirm(title, message) {
  return new Promise(resolve => {
    document.getElementById('confirm-title').textContent   = title;
    document.getElementById('confirm-message').textContent = message;
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('hidden');

    const okBtn     = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    function cleanup(result) {
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', ok);
      cancelBtn.removeEventListener('click', cancel);
      resolve(result);
    }
    function ok()     { cleanup(true); }
    function cancel() { cleanup(false); }

    okBtn.addEventListener('click', ok);
    cancelBtn.addEventListener('click', cancel);
    modal.addEventListener('click', e => { if (e.target === modal) cleanup(false); }, { once: true });
  });
}

// ────────────────────────────────────────────────────────────
// NAVIGATION
// ────────────────────────────────────────────────────────────
function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`view-${viewName}`).classList.remove('hidden');
  const navEl = document.getElementById(`nav-${viewName}`);
  if (navEl) navEl.classList.add('active');

  if (viewName === 'analytics') renderAnalytics();
  if (viewName === 'dashboard') renderDashboard();

  closeSidebar();
}

// ────────────────────────────────────────────────────────────
// SIDEBAR TOGGLE (mobile)
// ────────────────────────────────────────────────────────────
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

// ────────────────────────────────────────────────────────────
// TRANSACTION MODAL
// ────────────────────────────────────────────────────────────
function openAddModal(type = 'income') {
  editingId = null;
  currentType = type;
  document.getElementById('modal-title').textContent  = 'Add Transaction';
  document.getElementById('submit-label').textContent = 'Add Transaction';
  document.getElementById('txn-id').value    = '';
  document.getElementById('txn-amount').value = '';
  document.getElementById('txn-date').value  = today();
  document.getElementById('txn-desc').value  = '';
  clearErrors();
  setFormType(currentType);
  document.getElementById('txn-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('txn-amount').focus(), 100);
}

function openEditModal(id) {
  const t = transactions.find(t => t.id === id);
  if (!t) return;

  editingId   = id;
  currentType = t.type;
  document.getElementById('modal-title').textContent  = 'Edit Transaction';
  document.getElementById('submit-label').textContent = 'Save Changes';
  document.getElementById('txn-id').value     = t.id;
  document.getElementById('txn-amount').value = t.amount;
  document.getElementById('txn-date').value   = t.date;
  document.getElementById('txn-desc').value   = t.description;
  clearErrors();
  setFormType(t.type);

  // Set category after populating select
  setTimeout(() => {
    document.getElementById('txn-category').value = t.category;
  }, 10);

  document.getElementById('txn-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('txn-modal').classList.add('hidden');
  editingId = null;
}

function setFormType(type) {
  currentType = type;

  // Toggle buttons
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  // Populate category options
  const catSelect = document.getElementById('txn-category');
  catSelect.innerHTML = '<option value="">Select category…</option>';
  (CATEGORIES[type] || []).forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.label;
    catSelect.appendChild(opt);
  });
}

// ────────────────────────────────────────────────────────────
// FORM VALIDATION
// ────────────────────────────────────────────────────────────
function clearErrors() {
  ['amount-error', 'date-error', 'category-error', 'desc-error'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
}

function validateForm() {
  clearErrors();
  let valid = true;

  const amount   = parseFloat(document.getElementById('txn-amount').value);
  const date     = document.getElementById('txn-date').value;
  const category = document.getElementById('txn-category').value;
  const desc     = document.getElementById('txn-desc').value.trim();

  if (isNaN(amount) || amount <= 0) {
    document.getElementById('amount-error').textContent = 'Please enter a valid amount greater than 0.';
    valid = false;
  }
  if (!date) {
    document.getElementById('date-error').textContent = 'Please select a date.';
    valid = false;
  }
  if (!category) {
    document.getElementById('category-error').textContent = 'Please select a category.';
    valid = false;
  }
  if (!desc) {
    document.getElementById('desc-error').textContent = 'Please enter a description.';
    valid = false;
  } else if (desc.length < 2) {
    document.getElementById('desc-error').textContent = 'Description must be at least 2 characters.';
    valid = false;
  }
  return valid;
}

// ────────────────────────────────────────────────────────────
// CRUD OPERATIONS
// ────────────────────────────────────────────────────────────
function addTransaction(data) {
  transactions.unshift({ id: uid(), ...data, createdAt: Date.now() });
  saveData();
  renderAll();
  showToast('success', 'Transaction Added!', `${data.type === 'income' ? 'Income' : 'Expense'} of ${formatCurrency(data.amount)} recorded.`);
}

function updateTransaction(id, data) {
  const idx = transactions.findIndex(t => t.id === id);
  if (idx === -1) return;
  transactions[idx] = { ...transactions[idx], ...data };
  saveData();
  renderAll();
  showToast('info', 'Transaction Updated', 'Your changes have been saved.');
}

async function deleteTransaction(id) {
  const t = transactions.find(t => t.id === id);
  if (!t) return;

  const confirmed = await showConfirm(
    'Delete Transaction?',
    `Are you sure you want to delete "${t.description}"? This action cannot be undone.`
  );
  if (!confirmed) return;

  transactions = transactions.filter(t => t.id !== id);
  saveData();
  renderAll();
  showToast('warning', 'Transaction Deleted', 'The transaction has been removed.');
}

// ────────────────────────────────────────────────────────────
// CALCULATIONS
// ────────────────────────────────────────────────────────────
function calcTotals(txns = transactions) {
  const income  = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { income, expense, balance: income - expense };
}

function calcMonthly(month, year) {
  const txns = transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });
  return { ...calcTotals(txns), txns };
}

// ────────────────────────────────────────────────────────────
// RENDER FUNCTIONS
// ────────────────────────────────────────────────────────────

// === DASHBOARD ===
function renderDashboard() {
  // Overall totals
  const { income, expense, balance } = calcTotals();

  document.getElementById('balance-amount').textContent  = formatCurrency(balance);
  document.getElementById('income-amount').textContent   = formatCurrency(income);
  document.getElementById('expense-amount').textContent  = formatCurrency(expense);

  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
  document.getElementById('savings-rate').textContent = `${Math.max(0, savingsRate)}%`;

  document.getElementById('balance-trend').textContent  = balance >= 0 ? '↑ Positive balance' : '↓ Negative balance';
  document.getElementById('income-trend').textContent   = `${transactions.filter(t=>t.type==='income').length} transactions`;
  document.getElementById('expense-trend').textContent  = `${transactions.filter(t=>t.type==='expense').length} transactions`;
  document.getElementById('savings-trend').textContent  = income > 0 ? 'of total income saved' : 'No income recorded';

  // Monthly
  renderMonthlySummary();

  // Recent (last 5)
  const recent = [...transactions].sort((a,b) => b.createdAt - a.createdAt).slice(0, 5);
  renderTransactionItems(document.getElementById('recent-list'), recent, true);

  // Dashboard donut
  renderDashDonut();

  // Subtitle
  document.getElementById('dashboard-subtitle').textContent =
    `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} recorded`;
}

function renderMonthlySummary() {
  document.getElementById('month-label').textContent = getMonthName(dashMonth, dashYear);
  const { income, expense } = calcMonthly(dashMonth, dashYear);
  const net = income - expense;

  document.getElementById('monthly-income').textContent  = formatCurrency(income);
  document.getElementById('monthly-expense').textContent = formatCurrency(expense);
  document.getElementById('monthly-net').textContent     = formatCurrency(net);
  document.getElementById('monthly-net').style.color     = net >= 0 ? 'var(--green)' : 'var(--red)';

  const ratio = income > 0 ? Math.min(100, Math.round((expense / income) * 100)) : (expense > 0 ? 100 : 0);
  document.getElementById('expense-ratio-text').textContent = `${ratio}%`;
  document.getElementById('expense-ratio-bar').style.width  = `${ratio}%`;
}

function renderDashDonut() {
  const wrapper = document.getElementById('dash-donut-wrapper');
  const expenses = transactions.filter(t => t.type === 'expense');
  if (!expenses.length) {
    wrapper.style.display = 'none';
    return;
  }
  wrapper.style.display = '';

  const cats = buildCategoryData(expenses);
  renderDonut('dashboard-donut-chart', 'dash-donut-legend', cats, dashDonutChart, (c) => dashDonutChart = c, true);
}

// === TRANSACTION LIST ===
function renderTransactions() {
  let filtered = [...transactions];

  // Type filter
  if (txnFilter !== 'all') filtered = filtered.filter(t => t.type === txnFilter);

  // Category filter
  if (categoryFilter !== 'all') filtered = filtered.filter(t => t.category === categoryFilter);

  // Search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      t.description.toLowerCase().includes(q) ||
      getCategoryLabel(t.type, t.category).toLowerCase().includes(q)
    );
  }

  // Sort by date desc
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);

  const list  = document.getElementById('transactions-list');
  const empty = document.getElementById('txn-empty-state');

  if (!filtered.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    list.innerHTML = ''; // clear before re-render
    renderTransactionItems(list, filtered, false);
  }

  // Update category filter dropdown
  populateCategoryFilterDropdown();
}

function renderTransactionItems(container, txns, readonly) {
  if (!txns.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v4H3zM3 9h18v12H3z"/></svg>
        </div>
        <h3>No transactions yet</h3>
        <p>Add your first transaction to get started!</p>
      </div>`;
    return;
  }

  container.innerHTML = txns.map(t => {
    const icon = getCategoryIcon(t.type, t.category);
    // Strip leading emoji + space from label for the badge
    const catLabel = getCategoryLabel(t.type, t.category).replace(/^.+?\s/, '');
    return `
      <div class="txn-item" data-id="${t.id}" data-type="${t.type}">
        <div class="txn-icon ${t.type}">${icon}</div>
        <div class="txn-info">
          <div class="txn-desc" title="${escapeHtml(t.description)}">${escapeHtml(t.description)}</div>
          <div class="txn-meta">
            <span class="txn-category">${catLabel}</span>
            <span class="txn-date">${formatDate(t.date)}</span>
          </div>
        </div>
        <span class="txn-amount ${t.type}">${t.type === 'income' ? '+' : '−'}&nbsp;${formatCurrency(t.amount)}</span>
        ${!readonly ? `
        <div class="txn-actions">
          <button class="btn-icon-action edit-btn" data-id="${t.id}" title="Edit" aria-label="Edit transaction">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon-action danger delete-btn" data-id="${t.id}" title="Delete" aria-label="Delete transaction">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>` : ''}
      </div>`;
  }).join('');
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function populateCategoryFilterDropdown() {
  const sel = document.getElementById('category-filter');
  const used = [...new Set(transactions.map(t => JSON.stringify({ id: t.category, type: t.type })))].map(s => JSON.parse(s));
  const current = sel.value;

  sel.innerHTML = '<option value="all">All Categories</option>';
  used.forEach(({ id, type }) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = getCategoryLabel(type, id).replace(/^.{1,2}\s/, '') + (type === 'income' ? ' (Income)' : ' (Expense)');
    sel.appendChild(opt);
  });
  sel.value = current;
}

// === ANALYTICS ===
function renderAnalytics() {
  document.getElementById('analytics-month-label').textContent = getMonthName(anMonth, anYear);

  // Monthly transactions
  const { txns: monthTxns } = calcMonthly(anMonth, anYear);
  const expenses = monthTxns.filter(t => t.type === 'expense');

  // Donut
  if (expenses.length) {
    const cats = buildCategoryData(expenses);
    renderDonut('analytics-donut-chart', 'analytics-donut-legend', cats, anDonutChart, (c) => anDonutChart = c);
    renderBreakdown(cats, calcTotals(expenses).expense);
  } else {
    destroyChart(anDonutChart);
    anDonutChart = null;
    document.getElementById('analytics-donut-legend').innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px">No expenses this month.</p>';
    document.getElementById('category-breakdown-table').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">No data to display.</p>';
  }

  // Bar chart – last 6 months
  renderBarChart();
}

function buildCategoryData(expenses) {
  const map = {};
  expenses.forEach(t => {
    if (!map[t.category]) map[t.category] = { id: t.category, type: t.type, total: 0, count: 0 };
    map[t.category].total += t.amount;
    map[t.category].count++;
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

function renderDonut(canvasId, legendId, cats, chartInstance, setter, compact = false) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  destroyChart(chartInstance);

  const labels = cats.map(c => getCategoryLabel(c.type, c.id).replace(/^.+?\s/, ''));
  const data   = cats.map(c => c.total);
  const colors = cats.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  const newChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderColor: 'transparent', borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: !compact,
      maintainAspectRatio: !compact,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(14,17,32,0.95)',
          titleColor: '#e8eaf6',
          bodyColor: '#7986b0',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: ctx => ` ${formatCurrency(ctx.raw)} (${Math.round(ctx.raw / data.reduce((a,b)=>a+b,0)*100)}%)`
          }
        }
      }
    }
  });
  setter(newChart);

  // Legend
  const legendEl = document.getElementById(legendId);
  legendEl.innerHTML = cats.map((c, i) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      <span>${labels[i]}</span>
    </div>`).join('');
}

function renderBreakdown(cats, total) {
  const el = document.getElementById('category-breakdown-table');
  if (!cats.length) { el.innerHTML = ''; return; }

  el.innerHTML = cats.map((c, i) => {
    const pct   = total > 0 ? Math.round((c.total / total) * 100) : 0;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const icon  = getCategoryIcon(c.type, c.id);
    const label = getCategoryLabel(c.type, c.id).replace(/^.{1,2}\s/, '');
    return `
      <div class="breakdown-row">
        <div class="breakdown-label">
          <span>${icon}</span>
          <span>${label}</span>
        </div>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="breakdown-amount">${formatCurrency(c.total)}</span>
        <span class="breakdown-pct">${pct}%</span>
      </div>`;
  }).join('');
}

function renderBarChart() {
  const canvas = document.getElementById('analytics-bar-chart');
  if (!canvas) return;
  destroyChart(anBarChart);

  const months = [];
  const incomeData  = [];
  const expenseData = [];

  for (let i = 5; i >= 0; i--) {
    let m = anMonth - i;
    let y = anYear;
    while (m < 0) { m += 12; y--; }
    const { income, expense } = calcMonthly(m, y);
    months.push(new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }));
    incomeData.push(income);
    expenseData.push(expense);
  }

  anBarChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: 'rgba(0,212,160,0.7)',
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Expense',
          data: expenseData,
          backgroundColor: 'rgba(255,92,124,0.7)',
          borderRadius: 6,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#7986b0',
            font: { family: 'Inter', size: 12, weight: '500' },
            boxWidth: 12,
            boxHeight: 12,
            borderRadius: 3,
          }
        },
        tooltip: {
          backgroundColor: 'rgba(14,17,32,0.95)',
          titleColor: '#e8eaf6',
          bodyColor: '#7986b0',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
          ticks: { color: '#7986b0', font: { family: 'Inter', size: 11 } },
          border: { display: false }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
          ticks: {
            color: '#7986b0',
            font: { family: 'Inter', size: 11 },
            callback: v => '₹' + (v >= 100000 ? (v/100000).toFixed(1)+'L' : v >= 1000 ? (v/1000).toFixed(0)+'k' : v)
          },
          border: { display: false }
        }
      }
    }
  });
}

function destroyChart(chart) {
  if (chart) {
    try {
      const ctx = chart.ctx;
      chart.destroy();
      if (ctx && ctx.canvas) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
    } catch(e) {}
  }
}

// ────────────────────────────────────────────────────────────
// RENDER ALL
// ────────────────────────────────────────────────────────────
function renderAll() {
  renderDashboard();
  renderTransactions();
  // Analytics re-renders on tab switch
}

// ────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ────────────────────────────────────────────────────────────
function initEventListeners() {

  // ---- Sidebar nav ----
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      showView(item.dataset.view);
    });
  });

  // ---- Hamburger / Sidebar ----
  document.getElementById('hamburger').addEventListener('click', openSidebar);
  document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  // ---- Add Transaction Buttons ----
  ['add-txn-sidebar-btn', 'add-txn-top-btn', 'add-txn-view-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => openAddModal('expense'));
  });

  // ---- Modal close ----
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('txn-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('txn-modal')) closeModal();
  });

  // ---- Type toggle ----
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => setFormType(btn.dataset.type));
  });

  // ---- Form Submit ----
  document.getElementById('txn-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!validateForm()) return;

    const data = {
      type:        currentType,
      amount:      parseFloat(document.getElementById('txn-amount').value),
      date:        document.getElementById('txn-date').value,
      category:    document.getElementById('txn-category').value,
      description: document.getElementById('txn-desc').value.trim(),
    };

    if (editingId) {
      updateTransaction(editingId, data);
    } else {
      addTransaction(data);
    }
    closeModal();
  });

  // ---- Transaction list actions (event delegation) ----
  document.getElementById('recent-list').addEventListener('click', handleListClick);
  document.getElementById('transactions-list').addEventListener('click', handleListClick);

  // ---- View all link ----
  document.getElementById('view-all-link').addEventListener('click', e => {
    e.preventDefault();
    showView('transactions');
  });

  // ---- Type filter chips ----
  document.querySelectorAll('#type-filter-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#type-filter-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      txnFilter = chip.dataset.filter;
      renderTransactions();
    });
  });

  // ---- Category filter ----
  document.getElementById('category-filter').addEventListener('change', e => {
    categoryFilter = e.target.value;
    renderTransactions();
  });

  // ---- Search ----
  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value;
    renderTransactions();
  });

  // ---- Dashboard month nav ----
  document.getElementById('prev-month').addEventListener('click', () => {
    dashMonth--;
    if (dashMonth < 0) { dashMonth = 11; dashYear--; }
    renderMonthlySummary();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    dashMonth++;
    if (dashMonth > 11) { dashMonth = 0; dashYear++; }
    renderMonthlySummary();
  });

  // ---- Analytics month nav ----
  document.getElementById('analytics-prev-month').addEventListener('click', () => {
    anMonth--;
    if (anMonth < 0) { anMonth = 11; anYear--; }
    renderAnalytics();
  });
  document.getElementById('analytics-next-month').addEventListener('click', () => {
    anMonth++;
    if (anMonth > 11) { anMonth = 0; anYear++; }
    renderAnalytics();
  });

  // ---- Keyboard shortcut: Escape closes modals ----
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      document.getElementById('confirm-modal').classList.add('hidden');
    }
  });
}

function handleListClick(e) {
  const editBtn   = e.target.closest('.edit-btn');
  const deleteBtn = e.target.closest('.delete-btn');
  if (editBtn)   openEditModal(editBtn.dataset.id);
  if (deleteBtn) deleteTransaction(deleteBtn.dataset.id);
}

// ────────────────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────────────────
function init() {
  loadData();
  initEventListeners();
  renderAll();
  showToast('info', 'Welcome to ExpenseIQ!', 'Your smart expense tracker is ready.');
}

document.addEventListener('DOMContentLoaded', init);
