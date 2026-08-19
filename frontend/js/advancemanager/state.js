/**
 * Advance Manager - State Store Module
 */

window.AMState = (function () {
  const state = {
    activeTab: 'dashboard', // dashboard, expenses, people, settlements
    dashboardData: null,
    persons: [],
    expenses: [],
    settlements: [],
    categories: [],
    projects: [],
    mePersonId: null,
    activeExpense: null,
    activePerson: null,
    filters: {
      search: '',
      status: '',
      personId: ''
    },
    loading: false
  };

  return {
    get: () => state,
    setTab: (tab) => { state.activeTab = tab; },
    setDashboardData: (data) => {
      state.dashboardData = data;
      if (data && data.mePersonId) state.mePersonId = data.mePersonId;
    },
    setPersons: (persons) => { state.persons = persons || []; },
    setExpenses: (expenses) => { state.expenses = expenses || []; },
    setSettlements: (settlements) => { state.settlements = settlements || []; },
    setCategories: (cats) => { state.categories = cats || []; },
    setProjects: (projs) => { state.projects = projs || []; },
    setLoading: (l) => { state.loading = l; }
  };
})();
