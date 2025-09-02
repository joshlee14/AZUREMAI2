// contentScript.js
//
// This content script injects the MAI Copilot HUD on Sunfire pages.  The HUD
// itself is mounted and unmounted on demand—clicking the extension
// toolbar button sends a message from the background service worker
// which toggles the HUD.  When mounted, the HUD floats on top of the
// page inside a Shadow DOM for style isolation.  The panel can be
// dragged, resized and collapsed.  A small test button in the header
// pings the configured API base (defaulting to the Azure App Service
// specified in the manifest host_permissions) and displays the result.
//
// The API base is stored in chrome.storage.sync and can be changed
// through the options page.  This allows the user to point the
// extension at a different backend (e.g., an Azure API Management
// endpoint) without modifying the code.  A ping button in the HUD
// header provides a quick connectivity check.

(() => {
  // Prevent double injection if the content script is executed multiple
  // times (e.g. in iframes or on SPA route changes).  We set a global
  // flag so subsequent executions will return early.
  if (window.__maiHudInjected) return;
  window.__maiHudInjected = true;

  // Keep track of the host container so we can remove it on toggle.
  let HOST_CONTAINER = null;
  const STATE = { mounted: false, activeTab: 'checklist' };

  // The default API base used when no custom value is stored.  This
  // should match the Azure App Service hostname defined in host_permissions.
  const DEFAULT_API_BASE = 'https://icarusmai5-fkh7gge6edh6aabj.centralus-01.azurewebsites.net';

  // Helpers for persisting layout values.  Use try/catch in case
  // localStorage is disabled or unavailable.
  function save(key, value) {
    try { localStorage.setItem(key, value); } catch (err) { /* ignore */ }
  }
  function load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? v : fallback;
    } catch (err) {
      return fallback;
    }
  }

  // Read the API base from chrome.storage.sync.  If no value is stored,
  // return the default.  Strip any trailing slash to avoid double slashes.
  async function getApiBase() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ apiBase: DEFAULT_API_BASE }, ({ apiBase }) => {
        const base = (apiBase || DEFAULT_API_BASE).replace(/\/$/, '');
        resolve(base);
      });
    });
  }

  // Ping the /api/health endpoint on the current API base.  Returns
  // true if the request succeeds (HTTP 200) and false otherwise.
  async function pingAzure() {
    try {
      const base = await getApiBase();
      const res = await fetch(`${base}/api/health`, { method: 'GET' });
      return res.ok;
    } catch (err) {
      return false;
    }
  }

  // Remove the HUD from the page and clear state.  We mark mounted false
  // so the HUD can be re-mounted later.
  function unmountHud() {
    try {
      if (HOST_CONTAINER) {
        HOST_CONTAINER.remove();
        HOST_CONTAINER = null;
      }
      STATE.mounted = false;
    } catch (err) {
      console.warn('[MAI] Failed to unmount HUD', err);
    }
  }

  // Create and insert the HUD into the page.  Use a Shadow DOM for
  // isolation.  Bind events for dragging, resizing, collapsing and
  // testing connectivity.
  function mountHud() {
    if (STATE.mounted) return;

    // Host element: high z-index and no inherited styles.
    const host = document.createElement('div');
    HOST_CONTAINER = host;
    host.style.all = 'initial';
    host.style.zIndex = '2147483647';
    document.documentElement.appendChild(host);

    // Shadow root for isolating styles.
    const shadow = host.attachShadow({ mode: 'open' });

    // Link to our HUD stylesheet.
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('hud.css');
    shadow.appendChild(link);

    // Wrapper for the HUD with persisted layout values.
    const wrapper = document.createElement('div');
    wrapper.className = 'maihud';
    wrapper.style.top = load('mai_top', '80px');
    const left = load('mai_left', '');
    const right = load('mai_right', '20px');
    if (left) {
      wrapper.style.left = left;
      wrapper.style.right = '';
    } else {
      wrapper.style.right = right;
      wrapper.style.left = '';
    }
    wrapper.style.width = load('mai_width', '360px');
    wrapper.style.height = load('mai_height', '540px');
    shadow.appendChild(wrapper);

    // Build the HUD's HTML.  The header includes a test button for
    // pinging the API base, plus collapse and close buttons.  Tabs are
    // placeholders until we implement the checklist, rebuttals and drugs
    // features in future patches.
    wrapper.innerHTML = `
      <div class="maihud-header" id="maiDragHandle">
        <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="MAI">
        <div class="maihud-title">Powered by MAI — Medicare Advantage AI</div>
        <div class="maihud-controls">
          <button class="maihud-btn" id="maiPingBtn">🔌 Test</button>
          <button class="maihud-btn" id="maiCollapseBtn">▾</button>
          <button class="maihud-btn" id="maiCloseBtn">✕</button>
        </div>
      </div>
      <div class="maihud-tabs">
        <button class="maihud-tab active" data-tab="checklist">Checklist</button>
        <button class="maihud-tab" data-tab="rebuttals">Rebuttals</button>
        <button class="maihud-tab" data-tab="drugs">Drugs</button>
      </div>
      <div class="maihud-body">
        <div data-view="checklist" class="placeholder">
          Azure is the default API base. Use the options page to override it.
          Click the plug button above to test connectivity.
        </div>
        <div data-view="rebuttals" class="placeholder" style="display:none">
          Rebuttals UI will be implemented in a future update.
        </div>
        <div data-view="drugs" class="placeholder" style="display:none">
          Drug lookup will be implemented in a future update.
        </div>
      </div>
      <div class="resizer" id="maiResizer"></div>
    `;

    // Tab switching: highlight the active tab and show the correct view.
    const tabs = Array.from(wrapper.querySelectorAll('.maihud-tab'));
    const views = {
      checklist: wrapper.querySelector('[data-view="checklist"]'),
      rebuttals: wrapper.querySelector('[data-view="rebuttals"]'),
      drugs: wrapper.querySelector('[data-view="drugs"]')
    };
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const key = tab.dataset.tab;
        Object.keys(views).forEach(k => {
          views[k].style.display = (k === key) ? '' : 'none';
        });
        STATE.activeTab = key;
      });
    });

    // Collapse/expand logic.  When collapsed, hide the tabs and body.
    const collapseBtn = wrapper.querySelector('#maiCollapseBtn');
    collapseBtn.addEventListener('click', () => {
      wrapper.classList.toggle('collapsed');
      collapseBtn.textContent = wrapper.classList.contains('collapsed') ? '▸' : '▾';
    });

    // Close button: unmount the HUD completely.
    wrapper.querySelector('#maiCloseBtn').addEventListener('click', () => {
      unmountHud();
    });

    // Ping button: check connectivity to the API base and alert result.
    wrapper.querySelector('#maiPingBtn').addEventListener('click', async () => {
      const ok = await pingAzure();
      alert(ok ? 'Azure API reachable ✅' : 'Azure API not reachable ❌');
    });

    // Dragging.  Track start position and update top/left or right.
    const dragHandle = wrapper.querySelector('#maiDragHandle');
    let dragState = null;
    dragHandle.addEventListener('mousedown', (e) => {
      dragState = {
        startX: e.clientX,
        startY: e.clientY,
        origTop: wrapper.offsetTop,
        origLeft: wrapper.offsetLeft,
        anchoredRight: !!wrapper.style.right && wrapper.style.right !== ''
      };
      e.preventDefault();
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onStopDrag);
    });
    function onDrag(e) {
      if (!dragState) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      wrapper.style.top = `${dragState.origTop + dy}px`;
      if (dragState.anchoredRight) {
        const origRight = parseInt(wrapper.style.right || '20', 10);
        wrapper.style.right = `${origRight - dx}px`;
      } else {
        wrapper.style.left = `${dragState.origLeft + dx}px`;
      }
    }
    function onStopDrag() {
      save('mai_top', wrapper.style.top);
      if (dragState) {
        if (dragState.anchoredRight) {
          save('mai_right', wrapper.style.right);
          save('mai_left', '');
        } else {
          save('mai_left', wrapper.style.left);
          save('mai_right', '');
        }
      }
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', onStopDrag);
      dragState = null;
    }

    // Resizing: allow the user to change width/height.
    const resizer = wrapper.querySelector('#maiResizer');
    let resizeState = null;
    resizer.addEventListener('mousedown', (e) => {
      resizeState = {
        startX: e.clientX,
        startY: e.clientY,
        origWidth: wrapper.offsetWidth,
        origHeight: wrapper.offsetHeight
      };
      e.preventDefault();
      document.addEventListener('mousemove', onResize);
      document.addEventListener('mouseup', onStopResize);
    });
    function onResize(e) {
      if (!resizeState) return;
      const dw = e.clientX - resizeState.startX;
      const dh = e.clientY - resizeState.startY;
      wrapper.style.width = `${Math.max(300, resizeState.origWidth + dw)}px`;
      wrapper.style.height = `${Math.max(300, resizeState.origHeight + dh)}px`;
    }
    function onStopResize() {
      save('mai_width', wrapper.style.width);
      save('mai_height', wrapper.style.height);
      document.removeEventListener('mousemove', onResize);
      document.removeEventListener('mouseup', onStopResize);
      resizeState = null;
    }

    STATE.mounted = true;
    console.log('[MAI] HUD mounted on', location.href);
  }

  // Listen for messages from the background service worker.  When the
  // toolbar icon is clicked the background script sends a toggle
  // message.  If the HUD is mounted, unmount it; otherwise mount it.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'MAI_TOGGLE_HUD') {
      if (STATE.mounted) {
        unmountHud();
      } else {
        mountHud();
      }
    }
  });
})();