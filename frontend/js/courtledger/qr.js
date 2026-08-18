/**
 * Court Ledger - QR System Module
 * Handles DuitNow QR code zoom overlays, origin-aware morph transitions, and custom QR persistence.
 */

(function () {
  function initQRSystem() {
    const qrImage = document.querySelector('.qr-image');
    const qrFullscreen = document.getElementById('qr-fullscreen');
    const qrFullscreenImage = document.querySelector('.qr-fullscreen-image');

    function updateQRImages(src) {
      if (qrImage) qrImage.src = src;
      if (qrFullscreenImage) qrFullscreenImage.src = src;
    }

    const customQr = localStorage.getItem('custom-qr');
    if (customQr) {
      updateQRImages(customQr);
    } else {
      updateQRImages('assets/duitnow-qr.png');
    }

    if (qrImage && qrFullscreen) {
      const fsImage = qrFullscreen.querySelector('.qr-fullscreen-image');

      qrImage.addEventListener('click', () => {
        const triggerRect = qrImage.getBoundingClientRect();
        const tx = triggerRect.left + triggerRect.width / 2;
        const ty = triggerRect.top + triggerRect.height / 2;
        
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        
        if (fsImage) {
          fsImage.style.transformOrigin = `calc(50% + ${tx - cx}px) calc(50% + ${ty - cy}px)`;
          fsImage.classList.remove('qr-animate-in');
          void fsImage.offsetWidth;
        }
        
        qrFullscreen.classList.remove('hidden');
        
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (fsImage) fsImage.classList.add('qr-animate-in');
          });
        });
      });

      qrFullscreen.addEventListener('click', () => {
        if (fsImage) fsImage.classList.remove('qr-animate-in');
        qrFullscreen.classList.add('hidden');
      });
    }

    return { updateQRImages };
  }

  window.CourtLedgerQR = { initQRSystem };
})();
