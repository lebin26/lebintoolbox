/**
 * Court Ledger - Domain State Module
 * Manages venue pricing dataset (Cloudflare D1 Database API) and selected venue state.
 */

(function () {
  let venues = [];

  let selectedVenueIndex = 0;
  let rateMorning = 0.0;
  let rateEvening = 0.0;

  let onVenueChangeCallback = null;

  function getApiBaseUrl() {
    if (window.WORKER_API_URL) return window.WORKER_API_URL.replace(/\/$/, '');

    // Auto-detect local testing or Cloudflare Workers same-origin deployment
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.endsWith('workers.dev') || window.location.hostname.endsWith('pages.dev')) {
      return '';
    }

    // Default production Cloudflare Worker API endpoint fallback (e.g. for GitHub Pages)
    return 'https://hostcalculator-worker.lebin2626.workers.dev';
  }

  function getActiveRates() {
    const v = venues[selectedVenueIndex] || venues[0];
    return {
      venueName: v ? v.name : '球场库为空',
      rateMorning: v ? (typeof v.rateMorning === 'number' ? v.rateMorning : parseFloat(v.rateMorning)) : 0,
      rateEvening: v ? (typeof v.rateEvening === 'number' ? v.rateEvening : parseFloat(v.rateEvening)) : 0
    };
  }

  function updateActiveVenueRates() {
    const v = venues[selectedVenueIndex] || venues[0];
    if (v) {
      rateMorning = typeof v.rateMorning === 'number' ? v.rateMorning : parseFloat(v.rateMorning);
      rateEvening = typeof v.rateEvening === 'number' ? v.rateEvening : parseFloat(v.rateEvening);
      const venueRateBadge = document.getElementById('venue-rate-badge');
      if (venueRateBadge) {
        venueRateBadge.textContent = `🌞 RM ${rateMorning.toFixed(2)} / 🌙 RM ${rateEvening.toFixed(2)}`;
      }
    }
    if (typeof onVenueChangeCallback === 'function') {
      onVenueChangeCallback();
    }
  }

  function populateVenueSelect() {
    const venueSelect = document.getElementById('venue-select');
    if (!venueSelect) return;
    venueSelect.innerHTML = '';
    venues.forEach((v, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = v.name;
      venueSelect.appendChild(opt);
    });

    const savedIdx = parseInt(localStorage.getItem('selected-venue-index'));
    if (!isNaN(savedIdx) && savedIdx >= 0 && savedIdx < venues.length) {
      selectedVenueIndex = savedIdx;
    } else {
      selectedVenueIndex = 0;
    }
    venueSelect.value = selectedVenueIndex;
    updateActiveVenueRates();
  }

  async function fetchVenuesFromDatabase() {
    try {
      const endpoint = getApiBaseUrl() + '/api/venues';
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data && Array.isArray(data.venues) && data.venues.length > 0) {
        venues = data.venues;
        populateVenueSelect();
        return venues;
      }
    } catch (err) {
      console.warn('⚠️ Cloudflare Worker / D1 Database API unavailable:', err.message);
    }
    return venues;
  }

  async function fetchVenues() {
    return await fetchVenuesFromDatabase();
  }

  async function initVenueState(onChange) {
    onVenueChangeCallback = onChange;
    const venueSelect = document.getElementById('venue-select');

    populateVenueSelect();

    // Fetch venues and bills directly from Cloudflare D1 Database API & local storage
    await fetchVenuesFromDatabase();
    await fetchBills();

    if (venueSelect) {
      venueSelect.addEventListener('change', () => {
        const idx = parseInt(venueSelect.value);
        if (!isNaN(idx) && idx >= 0 && idx < venues.length) {
          selectedVenueIndex = idx;
          localStorage.setItem('selected-venue-index', idx);
          updateActiveVenueRates();
        }
      });
    }
  }

  // Database CRUD Actions (Cloudflare D1 / Worker API)

  async function addVenue(name, rateMorning, rateEvening) {
    try {
      const endpoint = getApiBaseUrl() + '/api/venues';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, rateMorning, rateEvening })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '添加球场失败');
      
      await fetchVenuesFromDatabase();
      selectedVenueIndex = venues.length - 1;
      localStorage.setItem('selected-venue-index', selectedVenueIndex);
      populateVenueSelect();
      return data;
    } catch (err) {
      const localId = Date.now();
      const newVenue = {
        id: localId,
        name: name.trim(),
        rateMorning: parseFloat(rateMorning),
        rateEvening: parseFloat(rateEvening)
      };
      venues.push(newVenue);
      selectedVenueIndex = venues.length - 1;
      populateVenueSelect();
      return { venue: newVenue, warning: '已保存在当前会话（离线模式）' };
    }
  }

  async function updateVenue(id, name, rateMorning, rateEvening) {
    try {
      const endpoint = getApiBaseUrl() + `/api/venues/${id}`;
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, rateMorning, rateEvening })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '更新球场失败');

      await fetchVenuesFromDatabase();
      populateVenueSelect();
      return data;
    } catch (err) {
      const idx = venues.findIndex(v => v.id === id);
      if (idx !== -1) {
        venues[idx].name = name.trim();
        venues[idx].rateMorning = parseFloat(rateMorning);
        venues[idx].rateEvening = parseFloat(rateEvening);
        populateVenueSelect();
      }
      return { warning: '已在本地更新（离线模式）' };
    }
  }

  async function deleteVenue(id) {
    try {
      const endpoint = getApiBaseUrl() + `/api/venues/${id}`;
      const response = await fetch(endpoint, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '删除球场失败');

      await fetchVenuesFromDatabase();
      selectedVenueIndex = 0;
      populateVenueSelect();
      return data;
    } catch (err) {
      venues = venues.filter(v => v.id !== id);
      selectedVenueIndex = 0;
      populateVenueSelect();
      return { warning: '已在本地删除（离线模式）' };
    }
  }

  let savedBills = [];

  const LOCAL_BILLS_KEY = 'courtledger_saved_bills';

  function getLocalBills() {
    const keys = ['courtledger_saved_bills', 'courtledger_bills', 'courtledger_history_bills', 'bills_history'];
    const merged = [];
    const seen = new Set();
    keys.forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            list.forEach(item => {
              if (item) {
                const keyStr = item.id ? String(item.id) : (item.title + '_' + (item.createdAt || ''));
                if (!seen.has(keyStr)) {
                  seen.add(keyStr);
                  merged.push(item);
                }
              }
            });
          }
        }
      } catch (e) {}
    });
    return merged;
  }

  function saveLocalBills(list) {
    try {
      localStorage.setItem(LOCAL_BILLS_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  async function fetchBills() {
    let apiBills = [];
    try {
      const endpoint = getApiBaseUrl() + '/api/bills';
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.bills)) {
          apiBills = data.bills;
        }
      }
    } catch (err) {
      console.warn('⚠️ Cloudflare Worker API bills fetch failed, using local storage:', err.message);
    }

    const localBills = getLocalBills();
    const billMap = new Map();

    localBills.forEach((b, idx) => {
      if (b) {
        const idKey = (b.id !== undefined && b.id !== null && String(b.id).trim() !== '') ? String(b.id) : `local_${idx}_${Date.now()}`;
        if (!b.id) b.id = idKey;
        billMap.set(idKey, b);
      }
    });

    apiBills.forEach((b, idx) => {
      if (b) {
        const idKey = (b.id !== undefined && b.id !== null && String(b.id).trim() !== '') ? String(b.id) : `api_${idx}_${Date.now()}`;
        if (!b.id) b.id = idKey;
        billMap.set(idKey, b);
      }
    });

    savedBills = Array.from(billMap.values());
    savedBills.sort((a, b) => {
      const tA = a.createdAt ? new Date(String(a.createdAt).replace(' ', 'T')).getTime() : 0;
      const tB = b.createdAt ? new Date(String(b.createdAt).replace(' ', 'T')).getTime() : 0;
      return tB - tA;
    });

    saveLocalBills(savedBills);
    return savedBills;
  }

  async function saveBill(billData) {
    let newBill = null;
    try {
      const endpoint = getApiBaseUrl() + '/api/bills';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData)
      });
      const data = await response.json();
      if (response.ok && data.bill) {
        newBill = data.bill;
      }
    } catch (err) {
      console.warn('⚠️ Failed to save bill to Cloudflare Worker API, storing locally:', err.message);
    }

    if (!newBill) {
      newBill = {
        ...billData,
        id: Date.now(),
        createdAt: new Date().toISOString()
      };
    }

    savedBills.unshift(newBill);
    saveLocalBills(savedBills);
    return newBill;
  }

  async function updateBill(id, billData) {
    try {
      const endpoint = getApiBaseUrl() + `/api/bills/${id}`;
      await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData)
      });
    } catch (err) {
      console.warn('⚠️ Update bill to worker failed, fallback to local storage:', err.message);
    }

    const idx = savedBills.findIndex(b => String(b.id) === String(id));
    if (idx !== -1) {
      savedBills[idx] = { ...savedBills[idx], ...billData, updatedAt: new Date().toISOString() };
      saveLocalBills(savedBills);
    }
    return true;
  }

  async function deleteBill(id) {
    try {
      const endpoint = getApiBaseUrl() + `/api/bills/${id}`;
      await fetch(endpoint, { method: 'DELETE' });
    } catch (err) {
      console.warn('⚠️ Delete bill on worker failed, fallback to local storage:', err.message);
    }

    savedBills = savedBills.filter(b => String(b.id) !== String(id));
    saveLocalBills(savedBills);
    return true;
  }

  window.CourtLedgerState = {
    get venues() { return venues; },
    get savedBills() { return savedBills; },
    getActiveRates,
    updateActiveVenueRates,
    populateVenueSelect,
    initVenueState,
    fetchVenuesFromDatabase,
    fetchVenues,
    addVenue,
    updateVenue,
    deleteVenue,
    fetchBills,
    saveBill,
    updateBill,
    deleteBill
  };
})();
