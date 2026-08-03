(() => {
  'use strict';

  async function bootPortal() {
    try {
      if (typeof startRealtimeFallback === 'function') {
        startRealtimeFallback();
      }
      if (typeof restoreSession === 'function') {
        await restoreSession();
      }
      console.info('Lait Divin Staff Portal Ver.26.0 initialized');
    } catch (error) {
      console.error('Portal initialization failed:', error);
      const statusNodes = document.querySelectorAll('[data-realtime-status]');
      statusNodes.forEach((node) => {
        node.textContent = '● 初期化エラー';
        node.classList.add('sync-warn');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(bootPortal, 0), { once: true });
  } else {
    setTimeout(bootPortal, 0);
  }
})();
