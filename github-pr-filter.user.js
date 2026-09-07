// ==UserScript==
// @name         GitHub PR Repository Star Filter
// @namespace    https://github.com/
// @version      0.2.0
// @description  Show repository stars on GitHub pull-request search results and optionally hide results below a threshold.
// @author       Contributors
// @license      MIT
// @match        https://github.com/search*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      api.github.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    defaultMinStars: 100,
    cacheTtlMs: 24 * 60 * 60 * 1000,
  };

  const STORAGE_KEY = 'github-pr-filter-settings-v1';
  const TOKEN_STORAGE_KEY = 'github-pr-filter-token-v1';
  const CACHE_KEY_PREFIX = 'github-pr-filter-repo-v1:';
  const PANEL_ID = 'github-pr-filter-panel';
  const BADGE_CLASS = 'github-pr-filter-badge';
  const PROCESSED_ATTR = 'data-github-pr-filter-repo';
  const HIDDEN_CLASS = 'github-pr-filter-hidden';
  const memoryCache = new Map();
  const pendingRequests = new Map();
  let scanTimer;

  function loadSettings() {
    try {
      return { minStars: CONFIG.defaultMinStars, onlyQualified: false, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    } catch (_) {
      return { minStars: CONFIG.defaultMinStars, onlyQualified: false };
    }
  }

  let settings = loadSettings();

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function addStyles() {
    if (document.getElementById('github-pr-filter-styles')) return;
    const style = document.createElement('style');
    style.id = 'github-pr-filter-styles';
    style.textContent = `
      #${PANEL_ID} { position: fixed; right: 18px; bottom: 18px; z-index: 1000; padding: 10px 12px; border: 1px solid var(--borderColor-default, #d0d7de); border-radius: 8px; background: var(--bgColor-default, #fff); color: var(--fgColor-default, #1f2328); box-shadow: 0 3px 12px rgba(0,0,0,.15); font: 12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      #${PANEL_ID} label { display: flex; align-items: center; gap: 6px; margin: 4px 0; }
      #${PANEL_ID} input[type="number"] { width: 76px; padding: 3px 5px; border: 1px solid var(--borderColor-default, #d0d7de); border-radius: 6px; background: var(--bgColor-default, #fff); color: inherit; }
      #${PANEL_ID} input[type="password"] { width: 150px; padding: 3px 5px; border: 1px solid var(--borderColor-default, #d0d7de); border-radius: 6px; background: var(--bgColor-default, #fff); color: inherit; }
      #${PANEL_ID} .github-pr-filter-token-row { display: flex; gap: 6px; margin-top: 7px; }
      #${PANEL_ID} button { padding: 3px 7px; border: 1px solid var(--borderColor-default, #d0d7de); border-radius: 6px; background: var(--button-default-bgColor-rest, #f6f8fa); color: inherit; cursor: pointer; }
      #${PANEL_ID} .github-pr-filter-token-status { margin-top: 5px; color: var(--fgColor-muted, #656d76); }
      .${BADGE_CLASS} { display: inline-flex; align-items: center; margin-left: 8px; padding: 1px 6px; border: 1px solid var(--borderColor-default, #d0d7de); border-radius: 999px; color: var(--fgColor-muted, #656d76); font-size: 12px; font-weight: 500; vertical-align: middle; white-space: nowrap; }
      .${BADGE_CLASS}[data-state="ok"] { color: var(--fgColor-success, #1a7f37); border-color: var(--borderColor-success-muted, #4ac26b); }
      .${BADGE_CLASS}[data-state="low"] { color: var(--fgColor-attention, #9a6700); border-color: var(--borderColor-attention-muted, #d4a72c); }
      .${BADGE_CLASS}[data-state="error"] { color: var(--fgColor-danger, #d1242f); border-color: var(--borderColor-danger-muted, #ff8182); }
      .${HIDDEN_CLASS} { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <strong>PR star filter</strong>
      <label>Min stars <input type="number" min="0" step="1" value="${settings.minStars}"></label>
      <label><input type="checkbox" ${settings.onlyQualified ? 'checked' : ''}> Only qualified PRs</label>
      <label>GitHub token <input type="password" autocomplete="off" placeholder="${GM_getValue(TOKEN_STORAGE_KEY, '') ? 'Token saved' : 'github_pat_…'}"></label>
      <div class="github-pr-filter-token-row"><button type="button" data-action="save-token">Save token</button><button type="button" data-action="clear-token">Clear</button></div>
      <div class="github-pr-filter-token-status">${GM_getValue(TOKEN_STORAGE_KEY, '') ? 'Authenticated token is stored by Tampermonkey.' : 'Using unauthenticated GitHub API.'}</div>
    `;
    const minInput = panel.querySelector('input[type="number"]');
    const toggle = panel.querySelector('input[type="checkbox"]');
    const tokenInput = panel.querySelector('input[type="password"]');
    const saveTokenButton = panel.querySelector('[data-action="save-token"]');
    const clearTokenButton = panel.querySelector('[data-action="clear-token"]');
    minInput.addEventListener('change', () => {
      settings.minStars = Math.max(0, Number.parseInt(minInput.value, 10) || 0);
      minInput.value = settings.minStars;
      saveSettings();
      updateAllResults();
    });
    toggle.addEventListener('change', () => {
      settings.onlyQualified = toggle.checked;
      saveSettings();
      updateAllResults();
    });
    saveTokenButton.addEventListener('click', () => {
      const token = tokenInput.value.trim();
      if (!token) {
        tokenInput.focus();
        tokenInput.placeholder = 'Enter a token first';
        return;
      }
      GM_setValue(TOKEN_STORAGE_KEY, token);
      location.reload();
    });
    clearTokenButton.addEventListener('click', () => {
      GM_deleteValue(TOKEN_STORAGE_KEY);
      location.reload();
    });
    document.body.appendChild(panel);
  }

  function parseRepoFromUrl(href) {
    try {
      const url = new URL(href, location.origin);
      if (url.origin !== location.origin) return null;
      const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/|$)/);
      return match ? `${match[1]}/${match[2]}` : null;
    } catch (_) {
      return null;
    }
  }

  function findResultContainer(link) {
    return link.closest('[data-testid="results-list"] > div, .issue-list-item, li') || link.closest('div');
  }

  function getCachedRepo(repo) {
    if (memoryCache.has(repo)) return memoryCache.get(repo);
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY_PREFIX + repo) || 'null');
      if (cached && Date.now() - cached.savedAt < CONFIG.cacheTtlMs) {
        memoryCache.set(repo, cached.data);
        return cached.data;
      }
    } catch (_) {}
    return null;
  }

  function setCachedRepo(repo, data) {
    memoryCache.set(repo, data);
    try {
      localStorage.setItem(CACHE_KEY_PREFIX + repo, JSON.stringify({ savedAt: Date.now(), data }));
    } catch (_) {}
  }

  function apiRequest(repo) {
    const cached = getCachedRepo(repo);
    if (cached) return Promise.resolve(cached);
    if (pendingRequests.has(repo)) return pendingRequests.get(repo);

    const request = new Promise((resolve, reject) => {
      const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
      const githubToken = GM_getValue(TOKEN_STORAGE_KEY, '');
      if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
      GM_xmlhttpRequest({
        method: 'GET',
        url: `https://api.github.com/repos/${repo}`,
        headers,
        timeout: 15000,
        onload(response) {
          if (response.status >= 200 && response.status < 300) {
            try {
              const json = JSON.parse(response.responseText);
              const data = { stars: json.stargazers_count };
              setCachedRepo(repo, data);
              resolve(data);
            } catch (_) {
              reject(new Error('Invalid API response'));
            }
          } else if (response.status === 403 || response.status === 429) {
            reject(new Error('API rate limit reached'));
          } else if (response.status === 404) {
            reject(new Error('Repository not found or private'));
          } else {
            reject(new Error(`API error ${response.status}`));
          }
        },
        ontimeout: () => reject(new Error('API request timed out')),
        onerror: () => reject(new Error('API request failed')),
      });
    }).finally(() => pendingRequests.delete(repo));

    pendingRequests.set(repo, request);
    return request;
  }

  function renderBadge(badge, data, error) {
    if (error) {
      badge.textContent = `★ unavailable: ${error.message}`;
      badge.dataset.state = 'error';
      badge.dataset.error = 'true';
      return;
    }
    badge.dataset.stars = String(data.stars);
    badge.dataset.error = 'false';
    badge.textContent = `★ ${data.stars.toLocaleString()}`;
    applyFilterToBadge(badge);
  }

  function applyFilterToBadge(badge) {
    const result = badge.closest(`[${PROCESSED_ATTR}]`);
    if (!result) return;
    const stars = Number(badge.dataset.stars);
    const hasStars = Number.isFinite(stars);
    const qualified = hasStars && stars >= settings.minStars;
    if (hasStars) badge.dataset.state = qualified ? 'ok' : 'low';
    result.classList.toggle(HIDDEN_CLASS, settings.onlyQualified && hasStars && !qualified);
  }

  function updateAllResults() {
    document.querySelectorAll(`.${BADGE_CLASS}`).forEach(applyFilterToBadge);
  }

  function scan() {
    if (!location.pathname.startsWith('/search')) return;
    createPanel();
    const links = document.querySelectorAll('a[href*="/pull/"]');
    links.forEach((link) => {
      const repo = parseRepoFromUrl(link.href);
      if (!repo) return;
      const result = findResultContainer(link);
      if (!result || result.hasAttribute(PROCESSED_ATTR)) return;
      result.setAttribute(PROCESSED_ATTR, repo);

      const badge = document.createElement('span');
      badge.className = BADGE_CLASS;
      badge.dataset.state = 'loading';
      badge.textContent = '★ loading…';
      badge.title = `Repository: ${repo}`;
      link.insertAdjacentElement('afterend', badge);

      apiRequest(repo).then(
        (data) => renderBadge(badge, data),
        (error) => renderBadge(badge, null, error),
      );
    });
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 150);
  }

  addStyles();
  scan();
  new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', scheduleScan);
})();
