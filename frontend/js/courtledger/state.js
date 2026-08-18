/**
 * Court Ledger - Domain State Module
 * Manages venue pricing dataset (Cloudflare D1 / SQLite API / venues.csv fallback) and selected venue state.
 */

(function () {
  let venues = [
    { id: 1, name: 'Lavana Sport Center Setapak', rateMorning: 14.84, rateEvening: 29.68 },
    { id: 2, name: 'Setapak Badminton Center (SBC)', rateMorning: 14.00, rateEvening: 28.00 }
  ];

  let selectedVenueIndex = 0;
  let rateMorning = 14.84;
  let rateEvening = 29.68;

  let onVenueChangeCallback = null;

  function getApiBaseUrl() {
    if (window.WORKER_API_URL) return window.WORKER_API_URL.replace(/\/$/, '');
    // Default production Cloudflare Worker API endpoint
    return 'https://hostcalculator-worker.lebin2626.workers.dev';
  }

  function getActiveRates() {
    const v = venues[selectedVenueIndex] || venues[0];
    return {
      venueName: v ? v.name : '标准场地',
      rateMorning: v ? (typeof v.rateMorning === 'number' ? v.rateMorning : parseFloat(v.rateMorning)) : 14.84,
      rateEvening: v ? (typeof v.rateEvening === 'number' ? v.rateEvening : parseFloat(v.rateEvening)) : 29.68
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
      opt.textContent = `${v.name} (RM ${v.rateMorning}/${v.rateEvening})`;
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
        return true;
      }
    } catch (err) {
      console.warn('⚠️ Cloudflare Worker / DB API unavailable, attempting CSV fallback:', err.message);
    }
    return false;
  }

  function fetchVenuesFromCSV() {
    return fetch('venues.csv')
      .then(response => {
        if (response.ok) return response.text();
        throw new Error('venues.csv database file not found or failed to load');
      })
      .then(text => {
        if (text && text.trim()) {
          const parsedVenues = [];
          const lines = text.split('\n');
          let idCounter = 1;
          for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;
            const parts = line.split(/[,，]/);
            if (parts.length >= 3) {
              const vName = parts[0].trim();
              const vMorning = parseFloat(parts[1].trim());
              const vEvening = parseFloat(parts[2].trim());
              if (vName && vName !== '场地名称' && !isNaN(vMorning) && !isNaN(vEvening)) {
                parsedVenues.push({
                  id: idCounter++,
                  name: vName,
                  rateMorning: vMorning,
                  rateEvening: vEvening
                });
              }
            }
          }
          if (parsedVenues.length > 0) {
            venues = parsedVenues;
            populateVenueSelect();
          }
        }
      })
      .catch(err => {
        console.warn('Using default fallback venue list. Reason:', err.message);
      });
  }

  async function initVenueState(onChange) {
    onVenueChangeCallback = onChange;
    const venueSelect = document.getElementById('venue-select');

    populateVenueSelect();

    // Try Database API first, fallback to CSV if API is unreachable
    const loadedFromDB = await fetchVenuesFromDatabase();
    if (!loadedFromDB) {
      await fetchVenuesFromCSV();
    }

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

  window.CourtLedgerState = {
    get venues() { return venues; },
    getActiveRates,
    updateActiveVenueRates,
    populateVenueSelect,
    initVenueState,
    fetchVenuesFromDatabase,
    addVenue,
    updateVenue,
    deleteVenue
  };
})();
