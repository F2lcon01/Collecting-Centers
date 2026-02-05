/**
 * Main Application Module
 * Core functionality for Security Stats X-TREME
 * @module app
 */

// Global state
const AppState = {
    centers: [],
    nextId: 1,
    maxConfetti: 300,
    confettiCount: 0
};

/**
 * Application Controller
 */
const App = {
    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('🚀 جاري بدء التطبيق...');
            
            // Load all data
            await dataLoader.loadAllData();
            
            // Initialize UI
            this.setupEventListeners();
            this.updateStats();

            // Build normalized matchers for fast processing
            this.buildMatchers();

            // If no centers exist (fresh start), add 3 default centers like original behaviour
            if (AppState.centers.length === 0) {
                this.addCenter('مركز رقم 1');
                this.addCenter('مركز رقم 2');
                this.addCenter('مركز رقم 3');
            }

            console.log('✅ تم تهيئة التطبيق بنجاح');
        } catch (error) {
            console.error('❌ خطأ في تهيئة التطبيق:', error);
            Utils.notify('حدث خطأ في تحميل البيانات', 'error', 3000);
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const processBtn = document.getElementById('processBtn');
        const clearBtn = document.getElementById('clearBtn');
        const centerInput = document.getElementById('centerInput');
        const reportInput = document.getElementById('reportInput');

        if (processBtn) processBtn.addEventListener('click', () => this.processAll());
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearInputs());
        if (centerInput) {
            centerInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addCenter();
            });
        }
        if (reportInput) {
            reportInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) this.processAll();
            });
        }

        // Global error handling
        window.addEventListener('error', (e) => {
            console.error('خطأ عام:', e.error);
        });

        window.addEventListener('unhandledrejection', (e) => {
            console.error('Promise rejection:', e.reason);
        });
    },

    /**
     * Add center to list
     */
    addCenter(name) {
        // If name provided use it, otherwise read from input
        const input = document.getElementById('centerInput');
        let centerName = '';
        if (typeof name === 'string' && name.trim().length > 0) {
            centerName = name.trim();
        } else {
            if (!input) return;
            centerName = input.value.trim();
            if (!centerName) {
                Utils.notify('الرجاء إدخال اسم المركز', 'error');
                return;
            }
            input.value = '';
        }

        const center = {
            id: AppState.nextId++,
            name: centerName,
            addedAt: new Date()
        };

        AppState.centers.push(center);

        this.renderCentersList();

        // Visual confirmation: flash the new item briefly
        Utils.scheduleTask(() => {
            const el = document.querySelector(`#centersList .center-item[data-id="${center.id}"]`);
            if (el) {
                const prev = el.style.boxShadow;
                el.style.transition = 'box-shadow 0.45s ease, transform 0.45s ease';
                el.style.boxShadow = '0 0 18px rgba(124, 255, 165, 0.18)';
                el.style.transform = 'translateY(-4px)';
                setTimeout(() => { el.style.boxShadow = prev || ''; el.style.transform = ''; }, 650);
            }
        });

        this.playAddAnimation();
    },

    /**
     * Remove center from list
     */
    removeCenter(centerId) {
        const index = AppState.centers.findIndex(c => c.id === centerId);
        if (index !== -1) {
            AppState.centers.splice(index, 1);
            this.renderCentersList();
        }
    },

    /**
     * Render centers list
     */
    renderCentersList() {
        const centersList = document.getElementById('centersList');
        if (!centersList) return;

        if (AppState.centers.length === 0) {
            centersList.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">لا توجد مراكز مضافة</p>';
            return;
        }

        centersList.innerHTML = AppState.centers.map(center => `
            <div class="center-item" data-id="${center.id}">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px;">
                    <span class="center-name">${this.escapeHtml(center.name)}</span>
                    <button class="btn btn-icon" onclick="App.removeCenter(${center.id})" title="حذف">✕</button>
                </div>
                <textarea class="center-text" data-id="${center.id}" placeholder="الصق تقرير المركز هنا..."></textarea>
            </div>
        `).join('');
    },

    /**
     * Process all data
     */
    async processAll() {
        try {
            // Collect total chars to detect huge inputs
            const totalChars = Array.from(document.querySelectorAll('.center-text')).reduce((s, el) => s + (el.value || '').length, 0);
            if (totalChars === 0) {
                Utils.notify('الرجاء إدخال نص واحد على الأقل في أحد المراكز', 'error');
                return;
            }
            if (totalChars > 500000 && !confirm('النصوص كبيرة جداً وقد تتسبب في بطء. الاستمرار؟')) return;

            // Reset counts
            dataLoader.resetCounts();

            // Prepare maps for dynamic items
            const newSecurity = new Map();
            const newViolation = new Map();
            const ignoredLog = [];

            // Process each center independently
            document.querySelectorAll('.center-text').forEach(el => {
                const txt = el.value || '';
                if (!txt.trim()) return;
                const lines = String(txt).split(/\r?\n/);
                for (let rawLine of lines) {
                    const line = rawLine.trim();
                    if (line.length < 3) continue;
                    const norm = Utils.normalizeArabic(line);

                    // check ignore phrases
                    if (this.ignoreSet.some(ph => norm.includes(ph))) { ignoredLog.push(line); continue; }

                    // extract number if exists
                    const num = Utils.extractNumberFromText(line);
                    let matched = false;

                    // security categories
                    for (const m of this.securityMatchers) {
                        if (m.regex.test(norm)) {
                            const item = dataLoader.securityCategories.find(x => x.key === m.key);
                            if (item) item.count = (item.count || 0) + (num !== null ? num : 1);
                            matched = true; break;
                        }
                    }
                    if (matched) continue;

                    // violation categories
                    for (const m of this.violationMatchers) {
                        if (m.regex.test(norm)) {
                            const item = dataLoader.violationCategories.find(x => x.key === m.key);
                            if (item) item.count = (item.count || 0) + (num !== null ? num : 1);
                            matched = true; break;
                        }
                    }
                    if (matched) continue;

                    // fallback: treat as dynamic item if numeric
                    const nameOnly = line.replace(/[0-9٠-٩()]/g, '').trim();
                    if (nameOnly.length > 2 && num) {
                        const isViolationLike = /مخالفة|مرور|رصد|لوحات|تجاوز/.test(norm);
                        const target = isViolationLike ? newViolation : newSecurity;
                        target.set(nameOnly, (target.get(nameOnly) || 0) + num);
                    } else {
                        ignoredLog.push(line);
                    }
                }
            });

            // build output
            this.generateAndDisplayOutput(newSecurity, newViolation, ignoredLog);

            Utils.notify('✅ تم معالجة البيانات بنجاح', 'success');
        } catch (error) {
            console.error('خطأ في معالجة البيانات:', error);
            Utils.notify('حدث خطأ في المعالجة', 'error');
        }
    },

    /**
     * Parse report text
     */
    parseReport(text) {
        // Legacy single-text parser kept for backward compatibility (not used by new flow)
        const lines = String(text).split('\n');
        const security = dataLoader.getSecurityCategories();
        const violations = dataLoader.getViolationCategories();
        for (const line of lines) {
            const parsed = Utils.parseTextLine(line);
            if (!parsed) continue;
            for (const item of security) if (parsed.text.includes(item.key)) item.count += Math.max(parsed.count || 1, 1);
            for (const item of violations) if (parsed.text.includes(item.key)) item.count += Math.max(parsed.count || 1, 1);
        }
    },

    /**
     * Generate and display output
     */
    generateAndDisplayOutput(newSecurity = new Map(), newViolation = new Map(), ignoredLog = []) {
        // use aggregated text for date extraction (fallback)
        const allText = Array.from(document.querySelectorAll('.center-text')).map(e => e.value || '').join('\n');
        const dateInfo = Utils.extractDate(allText || '');

        // merge counts into arrays for formatting
        const security = dataLoader.getSecurityCategories();
        const violations = dataLoader.getViolationCategories();

        // Append dynamic items to arrays for display (but keep original categories as-is)
        const securityDisplay = security.map(s => ({ key: s.key, count: s.count || 0 }));
        const violationDisplay = violations.map(v => ({ key: v.key, count: v.count || 0 }));
        newSecurity.forEach((count, name) => securityDisplay.push({ key: name, count }));
        newViolation.forEach((count, name) => violationDisplay.push({ key: name, count }));

        const report = Utils.generateReport(securityDisplay, violationDisplay, dateInfo);

        const outputArea = document.getElementById('outputText');
        if (outputArea) outputArea.value = report;

        // Update statistics
        this.updateStats();

        // Update ignored list
        const ul = document.getElementById('ignoredList'); if (ul) { ul.innerHTML = ''; ignoredLog.forEach(txt => { const li = document.createElement('li'); li.innerText = txt.slice(0, 80); ul.appendChild(li); }); }
    },

    /**
     * Update statistics display
     */
    updateStats() {
        const security = dataLoader.getSecurityCategories();
        const violations = dataLoader.getViolationCategories();

        const totalSecurity = security.reduce((sum, item) => sum + item.count, 0);
        const totalViolations = violations.reduce((sum, item) => sum + item.count, 0);

        // Animate values
        Utils.scheduleTask(() => {
            Utils.animateValue('totalSecurity', parseInt(document.getElementById('totalSecurity')?.innerText || 0), totalSecurity);
            Utils.animateValue('totalViolations', parseInt(document.getElementById('totalViolations')?.innerText || 0), totalViolations);
        });
    },

    /**
     * Build normalized regex matchers from loaded data
     */
    buildMatchers() {
        const sec = dataLoader.getSecurityCategories() || [];
        const vio = dataLoader.getViolationCategories() || [];
        this.securityMatchers = sec.map(item => ({ key: item.key, regex: Utils.buildKeywordRegex((item.keywords || [item.key]).map(k => Utils.normalizeArabic(k))) }));
        this.violationMatchers = vio.map(item => ({ key: item.key, regex: Utils.buildKeywordRegex((item.keywords || [item.key]).map(k => Utils.normalizeArabic(k))) }));
        this.ignoreSet = (dataLoader.getIgnorePhrases() || []).map(p => Utils.normalizeArabic(p));
    },

    /**
     * Copy output to clipboard
     */
    async copyToClipboard() {
        try {
            const outputText = document.getElementById('outputText')?.value;
            if (!outputText) {
                Utils.notify('لا يوجد محتوى للنسخ', 'error');
                return;
            }

            // Use Clipboard API with fallback
            try {
                await navigator.clipboard.writeText(outputText);
            } catch (err) {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = outputText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }

            Utils.notify('✅ تم النسخ إلى الحافظة', 'success', 1500);
        } catch (error) {
            console.error('خطأ في النسخ:', error);
            Utils.notify('❌ فشل النسخ إلى الحافظة', 'error');
        }
    },

    /**
     * Clear all inputs
     */
    clearInputs() {
        const reportInput = document.getElementById('reportInput');
        const outputArea = document.getElementById('outputText');
        const centerInput = document.getElementById('centerInput');

        if (reportInput) reportInput.value = '';
        if (outputArea) outputArea.value = '';
        if (centerInput) centerInput.value = '';

        AppState.centers = [];
        AppState.nextId = 1;
        dataLoader.resetCounts();
        this.renderCentersList();
        this.updateStats();

        Utils.notify('✅ تم مسح جميع البيانات', 'success', 1000);
    },

    /**
     * Play add animation with confetti
     */
    playAddAnimation() {
        if (AppState.confettiCount >= AppState.maxConfetti) return;

        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = ['#00f3ff', '#ff00ff', '#bc13fe'][Math.floor(Math.random() * 3)];
        
        document.body.appendChild(confetti);
        AppState.confettiCount++;

        setTimeout(() => {
            confetti.remove();
            AppState.confettiCount--;
        }, 3000);
    },

    /**
     * Play success animation
     */
    playSuccessAnimation() {
        for (let i = 0; i < 20; i++) {
            Utils.scheduleTask(() => this.playAddAnimation());
        }
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}
