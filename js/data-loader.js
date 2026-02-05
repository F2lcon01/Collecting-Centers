/**
 * Data Loader Module
 * Handles loading and managing JSON data files
 * @module data-loader
 */

class DataLoader {
    constructor() {
        this.securityCategories = [];
        this.violationCategories = [];
        this.ignorePhrases = [];
    }

    /**
     * Load all data from JSON files
     * @returns {Promise<void>}
     */
    async loadAllData() {
        try {
            await Promise.all([
                this.loadSecurityCategories(),
                this.loadViolationCategories(),
                this.loadIgnorePhrases()
            ]);
            console.log('✅ جميع البيانات تم تحميلها بنجاح');
        } catch (error) {
            console.error('❌ خطأ في تحميل البيانات:', error);
            throw error;
        }
    }

    /**
     * Load security categories from JSON
     * @returns {Promise<void>}
     */
    async loadSecurityCategories() {
        try {
            const response = await fetch('data/security-categories.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            this.securityCategories = data.categories || [];
            console.log(`✅ تم تحميل ${this.securityCategories.length} فئة أمنية`);
        } catch (error) {
            console.error('❌ خطأ في تحميل الفئات الأمنية:', error);
            this.securityCategories = [];
        }
    }

    /**
     * Load violation categories from JSON
     * @returns {Promise<void>}
     */
    async loadViolationCategories() {
        try {
            const response = await fetch('data/violation-categories.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            this.violationCategories = data.categories || [];
            console.log(`✅ تم تحميل ${this.violationCategories.length} فئة مخالفات`);
        } catch (error) {
            console.error('❌ خطأ في تحميل فئات المخالفات:', error);
            this.violationCategories = [];
        }
    }

    /**
     * Load ignore phrases from JSON
     * @returns {Promise<void>}
     */
    async loadIgnorePhrases() {
        try {
            const response = await fetch('data/ignore-phrases.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            this.ignorePhrases = data.phrases || [];
            console.log(`✅ تم تحميل ${this.ignorePhrases.length} عبارة مرشحة`);
        } catch (error) {
            console.error('❌ خطأ في تحميل العبارات المرشحة:', error);
            this.ignorePhrases = [];
        }
    }

    /**
     * Get security categories
     * @returns {Array}
     */
    getSecurityCategories() {
        return this.securityCategories;
    }

    /**
     * Get violation categories
     * @returns {Array}
     */
    getViolationCategories() {
        return this.violationCategories;
    }

    /**
     * Get ignore phrases
     * @returns {Array}
     */
    getIgnorePhrases() {
        return this.ignorePhrases;
    }

    /**
     * Reset all counts to zero
     */
    resetCounts() {
        this.securityCategories.forEach(item => item.count = 0);
        this.violationCategories.forEach(item => item.count = 0);
    }
}

// Create global instance
const dataLoader = new DataLoader();
