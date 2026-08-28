/**
 * Financial Overview - Client Domain State Machine
 */

(function () {
  const DEFAULT_MONTH = new Date().toISOString().slice(0, 7);

  const FinancialState = {
    currentMonth: localStorage.getItem('fin_selected_month') || DEFAULT_MONTH,
    activeTab: 'dashboard', // 'dashboard', 'monthly', 'platforms', 'products', 'analytics'
    baseCurrency: 'MYR',
    matrixMode: 'amount', // 'amount', 'diff', 'pct'

    // Cached state
    platforms: [],
    products: [],
    monthList: [],
    dashboardData: null,
    monthSnapshotData: null,
    analyticsData: null,

    setMonth(monthKey) {
      if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
        this.currentMonth = monthKey;
        localStorage.setItem('fin_selected_month', monthKey);
      }
    },

    setActiveTab(tabName) {
      this.activeTab = tabName;
    }
  };

  window.FinancialState = FinancialState;
})();
