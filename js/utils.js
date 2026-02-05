/**
 * Utility Functions Module
 * Helper functions for data processing and DOM manipulation
 * @module utils
 */

const Utils = {
    /**
     * Convert Arabic digits to English digits
     * @param {string} str - Input string with Arabic digits
     * @returns {string} String with English digits
     */
    toEnglishDigits(str) {
        const map = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
        return String(str).replace(/[٠-٩]/g, d => map[d]);
    },

    /**
     * Extract date from text
     * @param {string} text - Text to search for date
     * @returns {Object} Object with day name and date
     */
    extractDate(text) {
        try {
            const match = String(text).match(/\d{2,4}[\/\-]\d{1,2}[\/\-]\d{1,2}/);
            const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            const dayName = days[new Date().getDay()];
            if (match) {
                // normalize separator to /
                const m = match[0].replace(/-/g, '/');
                return { day: dayName, date: m };
            }

            // Build Hijri date parts in YYYY/MM/DD format using Intl (year/month/day)
            const fmt = new Intl.DateTimeFormat('en-GB-u-ca-islamic', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const parts = fmt.formatToParts(new Date());
            const dayPart = parts.find(p => p.type === 'day')?.value || '';
            const monthPart = parts.find(p => p.type === 'month')?.value || '';
            const yearPart = parts.find(p => p.type === 'year')?.value || '';
            const dateStr = `${yearPart}/${monthPart}/${dayPart}هـ`;
            return { day: dayName, date: dateStr };
        } catch (error) {
            console.error('خطأ في استخراج التاريخ:', error);
            return { day: 'اليوم', date: new Date().toLocaleDateString('ar-SA') };
        }
    },

    /**
     * Remove Arabic diacritics and elongation characters
     */
    stripDiacritics(s) {
        return String(s).replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g,'').replace(/ـ/g,'');
    },

    /**
     * Normalize Arabic text (digits, basic letter forms, trim/lowercase)
     */
    normalizeArabic(s) {
        if (!s) return '';
        let t = String(s);
        t = this.toEnglishDigits(t);
        t = this.stripDiacritics(t);
        t = t.replace(/[أإآ]/g, 'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي');
        t = t.replace(/\s+/g, ' ');
        return t.toLowerCase().trim();
    },

    /**
     * Build a word-boundary regex from keywords (array of already-normalized strings)
     */
    buildKeywordRegex(keys) {
        if (!keys || keys.length === 0) return /$^/;
        const esc = k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // join with alternation and use word-like boundaries
        return new RegExp('(?:^|\\s|[.,؛:!"' + "'" + '()\\-])(' + keys.map(esc).join('|') + ')(?:$|\\s|[.,؛:!"' + "'" + '()\\-])', 'u');
    },

    /**
     * Extract integer number from a line (supports Arabic-Indic digits and parentheses)
     * Returns null if none found.
     */
    extractNumberFromText(line) {
        if (!line) return null;
        // parentheses first
        const paren = line.match(/\(\s*([0-9٠-٩]+)\s*\)/);
        if (paren) return parseInt(this.toEnglishDigits(paren[1]), 10);
        // standalone number
        const num = line.match(/([0-9٠-٩]{1,6})/);
        if (num) return parseInt(this.toEnglishDigits(num[1]), 10);
        return null;
    },

    /**
     * Animate numeric value change
     * @param {string} elementId - ID of the element to animate
     * @param {number} start - Starting value
     * @param {number} end - Ending value
     */
    animateValue(elementId, start, end) {
        if (start === end) return;
        const obj = document.getElementById(elementId);
        if (!obj) return;

        const range = end - start;
        const duration = 1000;
        let startTime = null;

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            obj.innerHTML = Math.floor(progress * range + start);
            if (progress < 1) window.requestAnimationFrame(step);
        }
        window.requestAnimationFrame(step);
    },

    /**
     * Schedule task for idle time
     * @param {Function} callback - Function to execute
     */
    scheduleTask(callback) {
        if (window.requestIdleCallback) {
            requestIdleCallback(callback, { timeout: 1000 });
        } else {
            setTimeout(callback, 0);
        }
    },

    /**
     * Parse text and extract data
     * @param {string} text - Text to parse
     * @param {Array} keywords - Keywords to search for
     * @returns {Object} Parsing result
     */
    parseTextLine(text) {
        try {
            let clean = (text || "").trim();
            if (clean.length < 3) return null;

            let count = 0;
            let hasExplicitNumber = false;

            // Try to find number in parentheses
            let parenMatch = clean.match(/\(\s*(\d+)\s*\)/);
            if (parenMatch) {
                count = parseInt(parenMatch[1]);
                hasExplicitNumber = true;
            } else if (!clean.includes("/")) {
                // Try to find standalone number
                let numMatch = clean.match(/(\d+)/);
                if (numMatch && !clean.includes("ملم")) {
                    count = parseInt(numMatch[0]);
                    hasExplicitNumber = true;
                }
            }

            return {
                text: clean,
                count: count,
                hasNumber: hasExplicitNumber
            };
        } catch (error) {
            console.warn('خطأ في تحليل السطر:', error);
            return null;
        }
    },

    /**
     * Check if text contains any keyword
     * @param {string} text - Text to check
     * @param {Array} keywords - Keywords to look for
     * @returns {boolean}
     */
    containsKeyword(text, keywords) {
        if (!keywords || keywords.length === 0) return false;
        const n = this.normalizeArabic(text);
        return keywords.some(k => n.includes(this.normalizeArabic(k)));
    },

    /**
     * Generate output report
     * @param {Object} data - Report data
     * @returns {string} Formatted report
     */
    generateReport(securityItems, violationItems, dateInfo) {
        let output = `*(الـقوة الخاصـة لأمن الطرق بمنطـقة عسير)*\n`;
        output += `*(تقـرير إنتاجية حملة المهربين ليوم ${dateInfo.day} الموافق ${dateInfo.date} وهي كالآتي:-*\n\n`;

        output += `♦️ *: الحالات الأمنيه*\n`;
        securityItems.forEach(x => {
            if (x.count > 0) {
                output += `•(${x.count}) ${x.key}.\n`;
            }
        });

        output += `\n♦️ *: المخالفات*\n`;
        violationItems.forEach(x => {
            if (x.count > 0) {
                output += `•(${x.count}) ${x.key}.\n`;
            }
        });

        output += `\n*وتقبلو وافر احترامي وتقديري*`;
        return output;
    },

    /**
     * Show user notification
     * @param {string} message - Message to display
     * @param {string} type - Type: 'success', 'error', 'info'
     * @param {number} duration - Duration in ms
     */
    notify(message, type = 'info', duration = 2000) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Could be extended to show visual notifications
    }
};
