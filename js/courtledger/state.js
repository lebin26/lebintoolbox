/**
 * Court Ledger - Domain State Module
 * Manages venue pricing dataset (venues.csv) and selected venue state.
 */

(function () {
  let venues = [
    { name: 'Lavana Sport Center Setapak', rateMorning: 14.84, rateEvening: 29.68 },
    { name: 'Setapak Badminton Center (SBC)', rateMorning: 14.00, rateEvening: 28.00 }
  ];

  let selectedVenueIndex = 0;
  let rateMorning = 14.84;
  let rateEvening = 29.68;

  let onVenueChangeCallback = null;

  function getActiveRates() {
    const v = venues[selectedVenueIndex] || venues[0];
    return {
      venueName: v ? v.name : '标准场地',
      rateMorning: v ? v.rateMorning : 14.84,
      rateEvening: v ? v.rateEvening : 29.68
    };
  }

  function updateActiveVenueRates() {
    const v = venues[selectedVenueIndex] || venues[0];
    if (v) {
      rateMorning = v.rateMorning;
      rateEvening = v.rateEvening;
      const venueRateBadge = document.getElementById('venue-rate-badge');
      if (venueRateBadge) {
        venueRateBadge.textContent = `🌞 RM ${v.rateMorning.toFixed(2)} / 🌙 RM ${v.rateEvening.toFixed(2)}`;
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

  function initVenueState(onChange) {
    onVenueChangeCallback = onChange;
    const venueSelect = document.getElementById('venue-select');

    populateVenueSelect();

    fetch('venues.csv')
      .then(response => {
        if (response.ok) return response.text();
        throw new Error('venues.csv database file not found or failed to load');
      })
      .then(text => {
        if (text && text.trim()) {
          const parsedVenues = [];
          const lines = text.split('\n');
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
        console.warn('Using fallback venue list. Reason:', err.message);
      });

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

  window.CourtLedgerState = {
    venues,
    getActiveRates,
    updateActiveVenueRates,
    populateVenueSelect,
    initVenueState
  };
})();
