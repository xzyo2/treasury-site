// --- CONFIGURATION ---
const SUPABASE_URL = 'https://tokedafadxogunwwetef.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRva2VkYWZhZHhvZ3Vud3dldGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0Mzc4NTUsImV4cCI6MjA4MTAxMzg1NX0.HBS6hfKXt2g3oplwYoCg2t7qjqFyDMJvEmtlvgJSb3c';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State Variables
let currentBalance = 0;
let displayedBalance = 0;
let currentPage = 0;
const PAGE_SIZE = 5;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    fetchTransactions();
    setupRealtime();
    checkAdminStatus();
    
    // Set date input to today
    document.getElementById('tDate').valueAsDate = new Date();
});

// --- CORE FUNCTIONS ---

async function fetchTransactions(isLoadMore = false) {
    if (!isLoadMore) {
        currentPage = 0;
        document.getElementById('transList').innerHTML = "";
    }

    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;

    // Fetch data from Supabase
    const { data, error, count } = await client
        .from('transactions')
        .select('*', { count: 'exact' })
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(start, end);

    if (error) {
        showToast("Error loading data", true);
        return;
    }

    // Render Rows
    data.forEach(t => renderRow(t));

    // Update Balance logic (Ideally, do this via a DB aggregation for accuracy)
    calculateBalance();

    // Pagination Button Logic
    if (end >= count - 1) {
        document.getElementById('loadMoreBtn').style.display = 'none';
    } else {
        document.getElementById('loadMoreBtn').style.display = 'block';
    }
}

async function calculateBalance() {
    // Get ALL transactions to calc sum
    const { data } = await client.from('transactions').select('amount, type');
    let total = 0;
    data.forEach(t => {
        if(t.type === 'income') total += parseFloat(t.amount);
        else total -= parseFloat(t.amount);
    });
    
    currentBalance = total;
    animateValue(displayedBalance, currentBalance, 1500);
    displayedBalance = currentBalance;
}

// --- ANIMATION ---
function animateValue(start, end, duration) {
    let startTime = null;
    const element = document.getElementById("displayBalance");

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
        // Easing function (starts fast, slows down)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        const current = start + (end - start) * easeOut;
        element.innerHTML = formatMoney(current);

        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    }
    window.requestAnimationFrame(step);
}

function formatMoney(amount) {
    return amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- UI HELPERS ---
function renderRow(t) {
    const list = document.getElementById('transList');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${t.date}</td>
        <td>${t.description}</td>
        <td class="${t.type}">${t.type.toUpperCase()}</td>
        <td>₱${formatMoney(t.amount)}</td>
    `;
    list.appendChild(row);
}

function showToast(message, isError = false) {
    const x = document.getElementById("toast");
    x.innerText = message;
    x.style.backgroundColor = isError ? "#c0392b" : "#333";
    x.className = "toast show";
    setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
}

function loadMore() {
    currentPage++;
    fetchTransactions(true);
}

// --- ADMIN & SECURITY ---

function openLogin() { document.getElementById('loginModal').style.display = 'block'; }
function closeLogin() { document.getElementById('loginModal').style.display = 'none'; }

async function attemptLogin() {
    const u = document.getElementById('adminUser').value;
    const p = document.getElementById('adminPass').value;

    // Secure Login via Vercel Function
    try {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: u, pass: p })
        });

        const result = await response.json();

        if (result.success) {
            localStorage.setItem('sc_admin_token', 'valid'); // Set simple session
            checkAdminStatus();
            closeLogin();
            showToast("Welcome back, Treasurer.");
        } else {
            showToast("Invalid Credentials!", true);
        }
    } catch (e) {
        showToast("Server Error", true);
    }
}

function checkAdminStatus() {
    const token = localStorage.getItem('sc_admin_token');
    if (token === 'valid') {
        document.getElementById('confidentialBtn').classList.remove('hidden');
        document.getElementById('logoutBtn').classList.remove('hidden');
        document.getElementById('loginBtn').classList.add('hidden');
    } else {
        document.getElementById('confidentialBtn').classList.add('hidden');
        document.getElementById('logoutBtn').classList.add('hidden');
        document.getElementById('loginBtn').classList.remove('hidden');
        // If on admin tab, kick back to home
        if(!document.getElementById('admin').classList.contains('hidden')) switchTab('home');
    }
}

function handleLogout() {
    localStorage.removeItem('sc_admin_token');
    checkAdminStatus();
    showToast("Logged out successfully.");
}

async function addTransaction() {
    const date = document.getElementById('tDate').value;
    const desc = document.getElementById('tDesc').value;
    const type = document.getElementById('tType').value;
    const amount = document.getElementById('tAmount').value;

    if (!desc || !amount) return showToast("Fill all fields", true);

    const { error } = await client.from('transactions').insert({
        date, description: desc, type, amount
    });

    if (error) {
        showToast("Error adding transaction", true);
    } else {
        showToast("Transaction Added!");
        // Clear form
        document.getElementById('tDesc').value = '';
        document.getElementById('tAmount').value = '';
        // Refresh data
        fetchTransactions();
    }
}

// --- TABS & THEME ---
function switchTab(tabId) {
    document.querySelectorAll('.section').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
}

document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('themeToggle').innerText = isDark ? "Light Mode" : "Dark Mode";
});

// Realtime listener
function setupRealtime() {
    client.channel('custom-all-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
        calculateBalance(); // Update balance immediately on change
    })
    .subscribe();
}
