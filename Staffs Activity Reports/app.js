// ===================================
// Staff Activity Reporter - Professional Edition
// Developed by Deva Veera Kumaran
// Version: 1.0.0
// ===================================

// Global Variables
let currentUser = null;
let activities = [];
let recognition = null;
let charts = {};
let pendingRestoreData = null;

// Initialize Speech Recognition
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
}

// ===================================
// Initialization
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    setTodayDate();
    populateMonthFilter();
});

// ===================================
// Authentication Functions
// ===================================
function checkAuth() {
    const user = localStorage.getItem('currentUser');
    if (user) {
        currentUser = JSON.parse(user);
        showMainApp();
    } else {
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
}

function showMainApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('headerStaffName').textContent = currentUser.name;
    loadActivities();
    updateStats();
    renderActivities();
    showTab('activities');
}

function handleLogin(e) {
    e.preventDefault();

    const name = document.getElementById('loginName').value.trim();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!name || !username || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    const storedCredentials = localStorage.getItem('userCredentials');

    if (storedCredentials) {
        const credentials = JSON.parse(storedCredentials);

        if (credentials.username === username && credentials.password === password) {
            currentUser = { name: credentials.name, username };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showToast('Login successful!', 'success');
            setTimeout(showMainApp, 500);
        } else {
            showToast('Invalid credentials!', 'error');
        }
    } else {
        const credentials = { name, username, password };
        localStorage.setItem('userCredentials', JSON.stringify(credentials));
        currentUser = { name, username };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showToast('Account created successfully!', 'success');
        setTimeout(showMainApp, 500);
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('currentUser');
        currentUser = null;
        activities = [];
        destroyAllCharts();
        showToast('Logged out successfully', 'success');
        setTimeout(() => {
            showLoginScreen();
            document.getElementById('loginForm').reset();
        }, 500);
    }
}

// ===================================
// Activity Management
// ===================================
function loadActivities() {
    const stored = localStorage.getItem(`activities_${currentUser.username}`);
    activities = stored ? JSON.parse(stored) : [];
}

function saveActivities() {
    localStorage.setItem(`activities_${currentUser.username}`, JSON.stringify(activities));
}

function handleAddActivity(e) {
    e.preventDefault();

    const title = document.getElementById('activityTitle').value.trim();
    const category = document.getElementById('activityCategory').value;
    const description = document.getElementById('activityDescription').value.trim();
    const date = document.getElementById('activityDate').value;
    const timeFrom = document.getElementById('activityTimeFrom').value;
    const timeTo = document.getElementById('activityTimeTo').value;
    const priority = document.getElementById('activityPriority').value;
    const status = document.getElementById('activityStatus').value;
    const tags = document.getElementById('activityTags').value;

    if (!title || !category || !description || !date || !timeFrom || !timeTo) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    // Validate time range
    if (timeFrom >= timeTo) {
        showToast('End time must be after start time', 'error');
        return;
    }

    // Calculate duration in hours
    const duration = calculateDuration(timeFrom, timeTo);

    const activity = {
        id: Date.now(),
        title,
        category,
        description,
        date,
        timeFrom,
        timeTo,
        duration,
        priority,
        status,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [],
        createdAt: new Date().toISOString()
    };

    activities.unshift(activity);
    saveActivities();
    renderActivities();
    updateStats();
    updateCharts();

    document.getElementById('activityForm').reset();
    setTodayDate();

    showToast('Activity added successfully!', 'success');
}

function calculateDuration(timeFrom, timeTo) {
    const [fromHour, fromMin] = timeFrom.split(':').map(Number);
    const [toHour, toMin] = timeTo.split(':').map(Number);

    const fromMinutes = fromHour * 60 + fromMin;
    const toMinutes = toHour * 60 + toMin;

    const durationMinutes = toMinutes - fromMinutes;
    return (durationMinutes / 60).toFixed(2);
}

function formatTime(time) {
    const [hour, minute] = time.split(':');
    const h = parseInt(hour);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minute} ${ampm}`;
}

function deleteActivity(id) {
    if (confirm('Are you sure you want to delete this activity?')) {
        activities = activities.filter(a => a.id !== id);
        saveActivities();
        renderActivities();
        updateStats();
        updateCharts();
        showToast('Activity deleted successfully', 'success');
    }
}

function editActivity(id) {
    const activity = activities.find(a => a.id === id);
    if (!activity) return;

    document.getElementById('activityTitle').value = activity.title;
    document.getElementById('activityCategory').value = activity.category;
    document.getElementById('activityDescription').value = activity.description;
    document.getElementById('activityDate').value = activity.date;
    document.getElementById('activityTimeFrom').value = activity.timeFrom;
    document.getElementById('activityTimeTo').value = activity.timeTo;
    document.getElementById('activityPriority').value = activity.priority;
    document.getElementById('activityStatus').value = activity.status;
    document.getElementById('activityTags').value = activity.tags.join(', ');

    deleteActivity(id);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Activity loaded for editing', 'info');
}

// ===================================
// Rendering Functions
// ===================================
function renderActivities() {
    const container = document.getElementById('activitiesContainer');
    const emptyState = document.getElementById('emptyState');

    const monthFilter = document.getElementById('monthFilter').value;
    const categoryFilter = document.getElementById('categoryFilter').value;
    const statusFilter = document.getElementById('statusFilter') ? document.getElementById('statusFilter').value : '';
    const searchFilter = document.getElementById('searchFilter').value.toLowerCase();

    let filtered = activities.filter(activity => {
        const matchMonth = !monthFilter || activity.date.startsWith(monthFilter);
        const matchCategory = !categoryFilter || activity.category === categoryFilter;
        const matchStatus = !statusFilter || activity.status === statusFilter;
        const matchSearch = !searchFilter ||
            activity.title.toLowerCase().includes(searchFilter) ||
            activity.description.toLowerCase().includes(searchFilter) ||
            (activity.tags && activity.tags.some(tag => tag.toLowerCase().includes(searchFilter)));

        return matchMonth && matchCategory && matchStatus && matchSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    // Group by month
    const grouped = {};
    filtered.forEach(activity => {
        const monthYear = new Date(activity.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (!grouped[monthYear]) grouped[monthYear] = [];
        grouped[monthYear].push(activity);
    });

    container.innerHTML = Object.entries(grouped).map(([month, acts]) => `
        <div class="mb-8 fade-in">
            <h3 class="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                ${month}
            </h3>
            <div class="grid grid-cols-1 gap-4">
                ${acts.map(activity => createActivityCard(activity)).join('')}
            </div>
        </div>
    `).join('');

    // Reattach event listeners
    document.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => deleteActivity(parseInt(btn.dataset.delete)));
    });
    document.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => editActivity(parseInt(btn.dataset.edit)));
    });
}

function createActivityCard(activity) {
    const categoryColors = {
        'Teaching': 'from-blue-500 to-blue-600',
        'Research': 'from-purple-500 to-purple-600',
        'Administrative': 'from-orange-500 to-orange-600',
        'Professional Development': 'from-green-500 to-green-600',
        'Student Mentoring': 'from-pink-500 to-pink-600',
        'Event Management': 'from-indigo-500 to-indigo-600',
        'Other': 'from-gray-500 to-gray-600'
    };

    const categoryIcons = {
        'Teaching': '📚',
        'Research': '🔬',
        'Administrative': '📋',
        'Professional Development': '🎓',
        'Student Mentoring': '👥',
        'Event Management': '🎯',
        'Other': '📌'
    };

    const priorityClass = activity.priority ? `priority-${activity.priority.toLowerCase()}` : 'priority-medium';
    const statusClass = activity.status ? `status-${activity.status.toLowerCase().replace(' ', '-')}` : 'status-completed';

    return `
        <div class="activity-card bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
            <div class="bg-gradient-to-r ${categoryColors[activity.category]} p-4">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-2 flex-wrap">
                            <span class="inline-block px-3 py-1 bg-white/20 rounded-full text-white text-sm font-medium">
                                ${categoryIcons[activity.category]} ${activity.category}
                            </span>
                            ${activity.priority ? `<span class="priority-badge ${priorityClass}">${activity.priority}</span>` : ''}
                            ${activity.status ? `<span class="status-badge ${statusClass}">${activity.status}</span>` : ''}
                        </div>
                        <h4 class="text-xl font-bold text-white">${escapeHtml(activity.title)}</h4>
                    </div>
                    <div class="flex space-x-2">
                        <button data-edit="${activity.id}" class="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all" title="Edit">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <button data-delete="${activity.id}" class="p-2 bg-white/20 hover:bg-red-500/50 rounded-lg transition-all" title="Delete">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            <div class="p-6">
                <p class="text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">${escapeHtml(activity.description)}</p>
                
                ${activity.tags && activity.tags.length > 0 ? `
                    <div class="flex flex-wrap gap-2 mb-4">
                        ${activity.tags.map(tag => `<span class="tag-item">#${escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
                
                <div class="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
                    <div class="flex items-center">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        ${formatDate(activity.date)}
                    </div>
                    ${activity.timeFrom && activity.timeTo ? `
                        <div class="flex items-center">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            ${formatTime(activity.timeFrom)} - ${formatTime(activity.timeTo)}
                        </div>
                        <div class="flex items-center">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                            ${activity.duration} hours
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// ===================================
// Statistics Functions
// ===================================
function updateStats() {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const thisMonth = activities.filter(a => a.date.startsWith(currentMonth)).length;
    const thisWeek = activities.filter(a => new Date(a.date) >= startOfWeek).length;
    const totalHours = activities.reduce((sum, a) => sum + parseFloat(a.duration || 0), 0);
    const completed = activities.filter(a => a.status === 'Completed').length;

    document.getElementById('totalActivities').textContent = activities.length;
    document.getElementById('monthActivities').textContent = thisMonth;

    if (document.getElementById('totalHours')) {
        document.getElementById('totalHours').textContent = totalHours.toFixed(1);
    }

    if (document.getElementById('completedActivities')) {
        document.getElementById('completedActivities').textContent = completed;
    }

    if (document.getElementById('weekActivities')) {
        document.getElementById('weekActivities').textContent = thisWeek;
    }
}

// ===================================
// Voice Input Functions
// ===================================
function startVoiceInput(targetId) {
    if (!recognition) {
        showToast('Voice input not supported in your browser', 'error');
        return;
    }

    const button = event.target.closest('button');
    button.classList.add('mic-pulse');

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const input = document.getElementById(targetId);
        input.value = input.value + (input.value ? ' ' : '') + transcript;
        button.classList.remove('mic-pulse');
        showToast('Voice input captured', 'success');
    };

    recognition.onerror = (event) => {
        button.classList.remove('mic-pulse');
        showToast('Voice input error: ' + event.error, 'error');
    };

    recognition.onend = () => {
        button.classList.remove('mic-pulse');
    };

    recognition.start();
    showToast('Listening...', 'info');
}

// ===================================
// Tab Management
// ===================================
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.classList.add('hidden');
    });

    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    const selectedTab = document.getElementById(tabName + 'Tab');
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
        selectedTab.classList.add('active');
    }

    // Add active class to clicked button
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }

    // Update charts if analytics tab
    if (tabName === 'analytics') {
        setTimeout(updateCharts, 100);
    }
}

// ===================================
// Chart Functions
// ===================================
function updateCharts() {
    updateCategoryChart();
    updateStatusChart();
    updateMonthlyChart();
    updateTimeAllocationChart();
}

function destroyAllCharts() {
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    charts = {};
}

function updateCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    if (charts.category) charts.category.destroy();

    const categoryCounts = {};
    activities.forEach(activity => {
        categoryCounts[activity.category] = (categoryCounts[activity.category] || 0) + 1;
    });

    charts.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryCounts),
            datasets: [{
                data: Object.values(categoryCounts),
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(147, 51, 234, 0.8)',
                    'rgba(251, 146, 60, 0.8)',
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(236, 72, 153, 0.8)',
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(107, 114, 128, 0.8)'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

function updateStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;

    if (charts.status) charts.status.destroy();

    const statusCounts = {
        'Completed': 0,
        'In Progress': 0,
        'Planned': 0
    };

    activities.forEach(activity => {
        if (activity.status && statusCounts.hasOwnProperty(activity.status)) {
            statusCounts[activity.status]++;
        }
    });

    charts.status = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(156, 163, 175, 0.8)'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

function updateMonthlyChart() {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;

    if (charts.monthly) charts.monthly.destroy();

    const monthlyCounts = {};
    activities.forEach(activity => {
        const month = activity.date.substring(0, 7);
        monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
    });

    const sortedMonths = Object.keys(monthlyCounts).sort();

    charts.monthly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedMonths.map(m => {
                const [year, month] = m.split('-');
                return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            }),
            datasets: [{
                label: 'Activities',
                data: sortedMonths.map(m => monthlyCounts[m]),
                borderColor: 'rgba(59, 130, 246, 1)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function updateTimeAllocationChart() {
    const ctx = document.getElementById('timeAllocationChart');
    if (!ctx) return;

    if (charts.timeAllocation) charts.timeAllocation.destroy();

    const categoryHours = {};
    activities.forEach(activity => {
        categoryHours[activity.category] = (categoryHours[activity.category] || 0) + parseFloat(activity.duration || 0);
    });

    charts.timeAllocation = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(categoryHours),
            datasets: [{
                label: 'Hours',
                data: Object.values(categoryHours),
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(147, 51, 234, 0.8)',
                    'rgba(251, 146, 60, 0.8)',
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(236, 72, 153, 0.8)',
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(107, 114, 128, 0.8)'
                ],
                borderWidth: 2,
                borderColor: '#fff',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// ===================================
// Export Functions
// ===================================
function exportReport() {
    const monthFilter = document.getElementById('monthFilter').value;
    const categoryFilter = document.getElementById('categoryFilter').value;
    const statusFilter = document.getElementById('statusFilter') ? document.getElementById('statusFilter').value : '';
    const searchFilter = document.getElementById('searchFilter').value.toLowerCase();

    let filtered = activities.filter(activity => {
        const matchMonth = !monthFilter || activity.date.startsWith(monthFilter);
        const matchCategory = !categoryFilter || activity.category === categoryFilter;
        const matchStatus = !statusFilter || activity.status === statusFilter;
        const matchSearch = !searchFilter ||
            activity.title.toLowerCase().includes(searchFilter) ||
            activity.description.toLowerCase().includes(searchFilter);

        return matchMonth && matchCategory && matchStatus && matchSearch;
    });

    if (filtered.length === 0) {
        showToast('No activities to export', 'error');
        return;
    }

    generateReportPreview(filtered);
    document.getElementById('screenshotModal').classList.remove('hidden');
}

function generateReportPreview(filtered) {
    const reportContent = document.getElementById('reportContent');
    const now = new Date();

    const grouped = {};
    filtered.forEach(activity => {
        const monthYear = new Date(activity.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (!grouped[monthYear]) grouped[monthYear] = [];
        grouped[monthYear].push(activity);
    });

    const totalHours = filtered.reduce((sum, a) => sum + parseFloat(a.duration || 0), 0);

    reportContent.innerHTML = `
        <div style="font-family: Arial, sans-serif; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px;">
                <h1 style="margin: 0; font-size: 28px;">Staff Activity Report</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px;">${currentUser.name}</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">
                    Generated on ${now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}
                </p>
            </div>

            <div style="margin-bottom: 20px; padding: 15px; background: #f1f5f9; border-radius: 8px;">
                <h3 style="margin: 0 0 10px 0; color: #475569;">Summary</h3>
                <p style="margin: 5px 0;"><strong>Total Activities:</strong> ${filtered.length}</p>
                <p style="margin: 5px 0;"><strong>Total Hours:</strong> ${totalHours.toFixed(2)}</p>
                <p style="margin: 5px 0;"><strong>Report Period:</strong> ${Object.keys(grouped).join(', ')}</p>
            </div>

            ${Object.entries(grouped).map(([month, acts]) => `
                <div style="margin-bottom: 25px; page-break-inside: avoid;">
                    <h2 style="color: #475569; border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-bottom: 15px;">
                        ${month}
                    </h2>
                    ${acts.map((activity, index) => `
                        <div style="margin-bottom: 15px; padding: 15px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; page-break-inside: avoid;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                <h3 style="margin: 0; color: #1e293b; font-size: 18px;">${index + 1}. ${escapeHtml(activity.title)}</h3>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    <span style="background: #667eea; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; white-space: nowrap;">
                                        ${activity.category}
                                    </span>
                                    ${activity.status ? `
                                        <span style="background: ${activity.status === 'Completed' ? '#10b981' : activity.status === 'In Progress' ? '#3b82f6' : '#9ca3af'}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; white-space: nowrap;">
                                            ${activity.status}
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                            <p style="margin: 8px 0; color: #475569; line-height: 1.6;">${escapeHtml(activity.description)}</p>
                            ${activity.tags && activity.tags.length > 0 ? `
                                <div style="margin: 8px 0;">
                                    ${activity.tags.map(tag => `<span style="background: #e0e7ff; color: #4f46e5; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-right: 4px;">#${escapeHtml(tag)}</span>`).join('')}
                                </div>
                            ` : ''}
                            <div style="font-size: 14px; color: #64748b; margin-top: 8px;">
                                <span style="margin-right: 15px;">📅 ${formatDate(activity.date)}</span>
                                ${activity.timeFrom && activity.timeTo ? `
                                    <span style="margin-right: 15px;">⏰ ${formatTime(activity.timeFrom)} - ${formatTime(activity.timeTo)}</span>
                                    <span>⏱️ ${activity.duration} hours</span>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>
    `;
}

function confirmExport() {
    const reportContent = document.getElementById('reportContent');

    showToast('Generating report...', 'info');

    // Temporarily remove scroll constraints for full capture
    const originalMaxHeight = reportContent.style.maxHeight;
    const originalOverflow = reportContent.style.overflow;
    reportContent.style.maxHeight = 'none';
    reportContent.style.overflow = 'visible';

    // Give browser time to render full content
    setTimeout(() => {
        html2canvas(reportContent, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: 1200,
            windowHeight: reportContent.scrollHeight, // Capture full height
            scrollY: -window.scrollY,
            scrollX: -window.scrollX,
            useCORS: true,
            allowTaint: true
        }).then(canvas => {
            // Restore original styles
            reportContent.style.maxHeight = originalMaxHeight;
            reportContent.style.overflow = originalOverflow;

            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            link.download = `${currentUser.name.replace(/\s+/g, '_')}_ActivityReport_${timestamp}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            document.getElementById('screenshotModal').classList.add('hidden');
            showToast('Report exported successfully!', 'success');
        }).catch(error => {
            // Restore original styles on error too
            reportContent.style.maxHeight = originalMaxHeight;
            reportContent.style.overflow = originalOverflow;

            console.error('Export error:', error);
            showToast('Export failed. Please try again.', 'error');
        });
    }, 300); // Small delay to ensure DOM is ready
}


// ===================================
// Backup & Restore
// ===================================
function backupData() {
    const data = {
        version: '1.0',
        user: currentUser,
        activities: activities,
        timestamp: new Date().toISOString(),
        totalActivities: activities.length
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    link.href = url;
    link.download = `StaffActivity_Backup_${currentUser.username}_${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);

    showToast('Backup downloaded successfully!', 'success');
}

function initiateRestore() {
    document.getElementById('restoreFileInput').click();
}

function handleRestoreFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
        showToast('Please select a valid JSON backup file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            // Validate backup file structure
            if (!data.activities || !Array.isArray(data.activities)) {
                throw new Error('Invalid backup file format');
            }

            pendingRestoreData = data;
            showRestorePreview(data);
            document.getElementById('restoreModal').classList.remove('hidden');

        } catch (error) {
            console.error('Restore error:', error);
            showToast('Invalid backup file. Please check the file and try again.', 'error');
        }
    };

    reader.onerror = function () {
        showToast('Error reading file. Please try again.', 'error');
    };

    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
}

function showRestorePreview(data) {
    const preview = document.getElementById('restorePreview');
    const backupDate = new Date(data.timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    preview.innerHTML = `
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 class="font-semibold text-slate-800 dark:text-white mb-3">Backup Information</h4>
            <div class="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                <p><strong>Backup Created:</strong> ${backupDate}</p>
                <p><strong>User:</strong> ${data.user?.name || 'Unknown'}</p>
                <p><strong>Total Activities:</strong> ${data.activities.length}</p>
                <p><strong>Current Activities:</strong> ${activities.length}</p>
            </div>
        </div>
        
        ${data.activities.length > 0 ? `
            <div class="mt-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 max-h-48 overflow-y-auto">
                <h5 class="font-semibold text-slate-800 dark:text-white mb-2 text-sm">Preview (First 5 activities):</h5>
                <ul class="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                    ${data.activities.slice(0, 5).map(a => `
                        <li class="flex items-start">
                            <span class="mr-2">•</span>
                            <span><strong>${escapeHtml(a.title)}</strong> - ${a.category} (${a.date})</span>
                        </li>
                    `).join('')}
                    ${data.activities.length > 5 ? `<li class="text-slate-500 italic">... and ${data.activities.length - 5} more</li>` : ''}
                </ul>
            </div>
        ` : ''}
    `;
}

function confirmRestore() {
    if (!pendingRestoreData) {
        showToast('No backup data to restore', 'error');
        return;
    }

    const option = document.getElementById('restoreOption').value;

    if (option === 'replace') {
        // Replace all data
        if (!confirm('This will replace ALL your current activities. Are you sure?')) {
            return;
        }
        activities = pendingRestoreData.activities;
        showToast(`Restored ${activities.length} activities`, 'success');
    } else if (option === 'merge') {
        // Merge data (add new activities, avoid duplicates by ID)
        const existingIds = new Set(activities.map(a => a.id));
        const newActivities = pendingRestoreData.activities.filter(a => !existingIds.has(a.id));
        activities = [...activities, ...newActivities];

        showToast(`Merged ${newActivities.length} new activities`, 'success');
    }

    saveActivities();
    renderActivities();
    updateStats();
    updateCharts();

    document.getElementById('restoreModal').classList.add('hidden');
    pendingRestoreData = null;
}

function cancelRestore() {
    document.getElementById('restoreModal').classList.add('hidden');
    pendingRestoreData = null;
}

// ===================================
// Report Generation
// ===================================
function generateReport() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const category = document.getElementById('reportCategory').value;

    if (!startDate || !endDate) {
        showToast('Please select start and end dates', 'error');
        return;
    }

    const filtered = activities.filter(activity => {
        const matchDate = activity.date >= startDate && activity.date <= endDate;
        const matchCategory = !category || activity.category === category;
        return matchDate && matchCategory;
    });

    const totalHours = filtered.reduce((sum, a) => sum + parseFloat(a.duration || 0), 0);
    const completed = filtered.filter(a => a.status === 'Completed').length;
    const inProgress = filtered.filter(a => a.status === 'In Progress').length;

    document.getElementById('reportTotalActivities').textContent = filtered.length;
    document.getElementById('reportTotalHours').textContent = totalHours.toFixed(2);
    document.getElementById('reportCompleted').textContent = completed;
    document.getElementById('reportInProgress').textContent = inProgress;

    document.getElementById('reportSummary').classList.remove('hidden');
    showToast('Report generated successfully!', 'success');
}

// ===================================
// Utility Functions
// ===================================
function updateDateTime() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    const elem = document.getElementById('currentDateTime');
    if (elem) {
        elem.textContent = now.toLocaleDateString('en-US', options);
    }
}

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('activityDate');
    if (dateInput) {
        dateInput.value = today;
    }
}

function populateMonthFilter() {
    const select = document.getElementById('monthFilter');
    if (!select) return;

    const months = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        months.push(`<option value="${value}">${label}</option>`);
    }

    select.innerHTML += months.join('');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastContainer = toast.querySelector('div');

    toastMessage.textContent = message;

    const colors = {
        success: 'border-green-500',
        error: 'border-red-500',
        info: 'border-blue-500'
    };

    const icons = {
        success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>',
        error: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>',
        info: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
    };

    toastContainer.className = `bg-white dark:bg-slate-800 rounded-lg shadow-2xl px-6 py-4 flex items-center space-x-3 border-l-4 ${colors[type]}`;
    toast.querySelector('svg').innerHTML = icons[type];

    toast.classList.remove('hidden');
    toast.classList.add('slide-in');

    setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('slide-in');
    }, 3000);
}

// ===================================
// Event Listeners Setup
// ===================================
function setupEventListeners() {
    // Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Activity Form
    const activityForm = document.getElementById('activityForm');
    if (activityForm) {
        activityForm.addEventListener('submit', handleAddActivity);
    }

    const clearFormBtn = document.getElementById('clearFormBtn');
    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', () => {
            document.getElementById('activityForm').reset();
            setTodayDate();
        });
    }

    // Voice Input
    const voiceTitleBtn = document.getElementById('voiceTitleBtn');
    if (voiceTitleBtn) {
        voiceTitleBtn.addEventListener('click', () => startVoiceInput('activityTitle'));
    }

    const voiceDescBtn = document.getElementById('voiceDescBtn');
    if (voiceDescBtn) {
        voiceDescBtn.addEventListener('click', () => startVoiceInput('activityDescription'));
    }

    // Filters
    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter) {
        monthFilter.addEventListener('change', renderActivities);
    }

    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', renderActivities);
    }

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', renderActivities);
    }

    const searchFilter = document.getElementById('searchFilter');
    if (searchFilter) {
        searchFilter.addEventListener('input', renderActivities);
    }

    // Export
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportReport);
    }

    const confirmExportBtn = document.getElementById('confirmExport');
    if (confirmExportBtn) {
        confirmExportBtn.addEventListener('click', confirmExport);
    }

    const cancelExportBtn = document.getElementById('cancelExport');
    if (cancelExportBtn) {
        cancelExportBtn.addEventListener('click', () => {
            document.getElementById('screenshotModal').classList.add('hidden');
        });
    }

    // Backup & Restore
    const backupBtn = document.getElementById('backupBtn');
    if (backupBtn) {
        backupBtn.addEventListener('click', backupData);
    }

    const restoreBtn = document.getElementById('restoreBtn');
    if (restoreBtn) {
        restoreBtn.addEventListener('click', initiateRestore);
    }

    const restoreFileInput = document.getElementById('restoreFileInput');
    if (restoreFileInput) {
        restoreFileInput.addEventListener('change', handleRestoreFile);
    }

    const confirmRestoreBtn = document.getElementById('confirmRestore');
    if (confirmRestoreBtn) {
        confirmRestoreBtn.addEventListener('click', confirmRestore);
    }

    const cancelRestoreBtn = document.getElementById('cancelRestore');
    if (cancelRestoreBtn) {
        cancelRestoreBtn.addEventListener('click', cancelRestore);
    }

    // Report Generation
    const generateReportBtn = document.getElementById('generateReportBtn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateReport);
    }

    // Tab Navigation
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            showTab(tabName);
        });
    });

    // Close modals on outside click
    const screenshotModal = document.getElementById('screenshotModal');
    if (screenshotModal) {
        screenshotModal.addEventListener('click', (e) => {
            if (e.target.id === 'screenshotModal') {
                screenshotModal.classList.add('hidden');
            }
        });
    }

    const restoreModal = document.getElementById('restoreModal');
    if (restoreModal) {
        restoreModal.addEventListener('click', (e) => {
            if (e.target.id === 'restoreModal') {
                cancelRestore();
            }
        });
    }
}
