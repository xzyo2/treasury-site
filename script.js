// --- CONFIGURATION ---
const SUPABASE_URL = 'https://tokedafadxogunwwetef.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRva2VkYWZhZHhvZ3Vud3dldGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0Mzc4NTUsImV4cCI6MjA4MTAxMzg1NX0.HBS6hfKXt2g3oplwYoCg2t7qjqFyDMJvEmtlvgJSb3c';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


let transactions = [];
let currentPage = 0;
let isAdminMode = false;
let selectedType = 'income'; // For the modal form

document.addEventListener('DOMContentLoaded', () => {
    fetchTransactions();
    setupRealtime();
    checkLoginSession();
    
    // Set default date to today
    document.getElementById('tDate').valueAsDate = new Date();
});

// --- DATA FETCHING ---
async function fetchTransactions(isLoadMore = false) {
    if (!isLoadMore) { currentPage = 0; document.getElementById('transList').innerHTML = ""; }

    const from = currentPage * 10;
    const to = from + 9;

    // Fetch with ID included
    const { data, error, count } = await client
        .from('transactions')
        .select('*', { count: 'exact' })
        .order('date', { ascending: false })
        .order('id', { ascending: false }) // Secondary sort by ID
        .range(from, to);

    if (error) return showToast("Error loading data");

    transactions = isLoadMore ? [...transactions, ...data] : data;
    
    data.forEach(t => renderCard(t));
    calculateBalance();
    
    // UI Updates
    document.getElementById('transCount').innerText = `${count} records`;
    document.getElementById('loadMoreBtn').style.display = (to >= count - 1) ? 'none' : 'block';
}

function renderCard(t) {
    const list = document.getElementById('transList');
    const isIncome = t.type === 'income';
    const amountFmt = parseFloat(t.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 });
    
    const card = document.createElement('div');
    card.className = 'trans-card';
    card.innerHTML = `
        <div class="t-left">
            <span class="t-id">#${t.id}</span>
            <span class="t-desc">${t.description}</span>
            <span class="t-date">${new Date(t.date).toLocaleDateString()}</span>
        </div>
        <div class="t-right" style="display:flex; align-items:center;">
            <span class="t-amount ${isIncome ? 'income' : 'expense'}">
                ${isIncome ? '+' : '-'}₱${amountFmt}
            </span>
            <button class="edit-icon" onclick="openEditModal(${t.id})">✎</button>
        </div>
    `;
    list.appendChild(card);
}

// --- ADMIN LOGIC ---
function toggleAdminMode() {
    isAdminMode = !isAdminMode;
    const btn = document.getElementById('adminToggleBtn');
    const list = document.getElementById('transList');
    const addBtn = document.getElementById('addTransBtn');
    
    if (isAdminMode) {
        btn.innerText = "Admin Mode: ON";
        btn.style.color = "#22c55e";
        list.classList.add('admin-mode');
        addBtn.classList.remove('hidden');
    } else {
        btn.innerText = "Admin Mode: OFF";
        btn.style.color = "#eab308";
        list.classList.remove('admin-mode');
        addBtn.classList.add('hidden');
    }
}

// --- MODALS (ADD & EDIT) ---
function openTransactionModal() {
    // Reset form for "Add" mode
    document.getElementById('modalTitle').innerText = "New Transaction";
    document.getElementById('editId').value = ""; // Empty ID means New
    document.getElementById('tDesc').value = "";
    document.getElementById('tAmount').value = "";
    document.getElementById('deleteBtn').classList.add('hidden');
    setTransType('income');
    document.getElementById('transModal').style.display = 'flex';
}

function openEditModal(id) {
    // Find data
    const t = transactions.find(x => x.id === id);
    if(!t) return;

    // Fill form for "Edit" mode
    document.getElementById('modalTitle').innerText = `Edit Transaction #${id}`;
    document.getElementById('editId').value = id;
    document.getElementById('tDate').value = t.date;
    document.getElementById('tDesc').value = t.description;
    document.getElementById('tAmount').value = t.amount;
    document.getElementById('deleteBtn').classList.remove('hidden'); // Show Delete
    setTransType(t.type);
    
    document.getElementById('transModal').style.display = 'flex';
}

function setTransType(type) {
    selectedType = type;
    document.getElementById('btnIncome').className = `type-btn ${type === 'income' ? 'active' : ''}`;
    document.getElementById('btnExpense').className = `type-btn ${type === 'expense' ? 'active' : ''}`;
}

// --- DB ACTIONS ---
async function submitTransaction() {
    const id = document.getElementById('editId').value;
    const date = document.getElementById('tDate').value;
    const desc = document.getElementById('tDesc').value;
    const amount = document.getElementById('tAmount').value;

    if (!desc || !amount) return showToast("Please fill all fields");

    const payload = { date, description: desc, type: selectedType, amount };

    let error;
    if (id) {
        // UPDATE existing
        const res = await client.from('transactions').update(payload).eq('id', id);
        error = res.error;
    } else {
        // INSERT new
        const res = await client.from('transactions').insert(payload);
        error = res.error;
    }

    if (error) {
        showToast("Error saving: " + error.message);
    } else {
        showToast("Success!");
        closeModal('transModal');
        fetchTransactions(); // Refresh list
    }
}

async function deleteTransaction() {
    const id = document.getElementById('editId').value;
    if(!confirm("Are you sure you want to delete this?")) return;

    const { error } = await client.from('transactions').delete().eq('id', id);
    if (error) showToast("Error deleting");
    else {
        showToast("Deleted.");
        closeModal('transModal');
        fetchTransactions();
    }
}

// --- UTILS ---
function openLogin() { document.getElementById('loginModal').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function loadMore() { currentPage++; fetchTransactions(true); }

async function calculateBalance() {
    // We fetch ALL simply for accurate balance (optimized for small app)
    const { data } = await client.from('transactions').select('amount, type');
    let total = 0;
    if(data) {
        data.forEach(t => {
            if(t.type === 'income') total += parseFloat(t.amount);
            else total -= parseFloat(t.amount);
        });
    }
    document.getElementById('displayBalance').innerText = total.toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// --- AUTH & TABS ---
function switchTab(id) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    document.getElementById(id).classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    // Highlight correct nav button (simple logic)
    if(id === 'home') document.querySelector('button[onclick="switchTab(\'home\')"]').classList.add('active');
    if(id === 'be-heard') document.querySelector('button[onclick="switchTab(\'be-heard\')"]').classList.add('active');
}

// Secure Login (Vercel API)
async function attemptLogin() {
    const u = document.getElementById('adminUser').value;
    const p = document.getElementById('adminPass').value;
    
    try {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user: u, pass: p })
        });
        const data = await res.json();
        if(data.success) {
            localStorage.setItem('sc_admin', 'true');
            checkLoginSession();
            closeModal('loginModal');
            showToast("Welcome Treasurer");
        } else {
            showToast("Wrong password");
        }
    } catch(e) { showToast("Server Error"); }
}

function handleLogout() {
    localStorage.removeItem('sc_admin');
    checkLoginSession();
    // Turn off admin mode if on
    if(isAdminMode) toggleAdminMode();
    showToast("Logged out");
}

function checkLoginSession() {
    const isLogged = localStorage.getItem('sc_admin') === 'true';
    if(isLogged) {
        document.getElementById('loginBtn').classList.add('hidden');
        document.getElementById('logoutBtn').classList.remove('hidden');
        document.getElementById('adminToggleBtn').classList.remove('hidden');
    } else {
        document.getElementById('loginBtn').classList.remove('hidden');
        document.getElementById('logoutBtn').classList.add('hidden');
        document.getElementById('adminToggleBtn').classList.add('hidden');
    }
}

// --- REALTIME LISTENER ---
function setupRealtime() {
    client.channel('custom-all-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
        // When a new transaction happens, refresh the data automatically
        fetchTransactions();
    })
    .subscribe();
}
