export const landingJs = `
(function () {
  'use strict';

  // ── Theme ─────────────────────────────────────────────────────────────
  var THEME_KEY = 'sg-theme';
  var htmlEl = document.documentElement;
  htmlEl.classList.add('js-ready');

  function applyTheme(theme) {
    htmlEl.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-toggle').forEach(function(btn) {
      btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    });
  }

  function getTheme() {
    return localStorage.getItem(THEME_KEY) ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  // Apply on load
  applyTheme(getTheme());

  function bindThemeToggle(btnId) {
    var btn = document.getElementById(btnId);
    if (!btn) { return; }
    btn.addEventListener('click', function () {
      var current = htmlEl.getAttribute('data-theme') || 'light';
      var next = current === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
      track('theme_change');
    });
  }
  bindThemeToggle('theme-toggle');
  bindThemeToggle('theme-toggle-mobile');

  // ── Navbar scroll shadow ──────────────────────────────────────────────
  var nav = document.getElementById('main-nav');
  function updateNav() {
    if (!nav) { return; }
    if (window.scrollY > 10) {
      nav.style.boxShadow = '';
    }
  }
  window.addEventListener('scroll', updateNav, { passive: true });

  // ── Hamburger menu ────────────────────────────────────────────────────
  var hamburger = document.getElementById('nav-hamburger');
  var mobileDropdown = document.getElementById('nav-mobile-dropdown');
  if (hamburger && mobileDropdown) {
    hamburger.addEventListener('click', function () {
      var isOpen = mobileDropdown.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    // Close on link click
    mobileDropdown.querySelectorAll('.nav-mobile-link').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileDropdown.classList.remove('open');
      });
    });
  }

  var sectionLinks = document.querySelectorAll('.nav-link[href^="#"]');
  var observedSections = Array.from(sectionLinks)
    .map(function(link) { return document.querySelector(link.getAttribute('href')); })
    .filter(Boolean);
  if ('IntersectionObserver' in window && observedSections.length) {
    var navObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) { return; }
        sectionLinks.forEach(function(link) {
          var active = link.getAttribute('href') === '#' + entry.target.id;
          link.classList.toggle('active', active);
          if (active) { link.setAttribute('aria-current', 'location'); }
          else { link.removeAttribute('aria-current'); }
        });
      });
    }, { rootMargin: '-25% 0px -65% 0px' });
    observedSections.forEach(function(section) { navObserver.observe(section); });
  }

  function track(eventName) {
    fetch('/landing/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: eventName, path: window.location.pathname })
    }).catch(function() {});
  }

  document.querySelectorAll('[data-track]').forEach(function(el) {
    el.addEventListener('click', function() {
      track(el.getAttribute('data-track'));
    });
  });

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function(char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char];
    });
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('en-US', { notation: value > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value || 0);
  }

  function renderMarquee(targetId, values) {
    var target = document.getElementById(targetId);
    if (!target) { return; }
    var source = values.length ? values : ['No data available'];
    var doubled = source.concat(source);
    target.innerHTML = doubled.map(function(value) {
      return '<span class="marquee-pill"><span class="pill-dot"></span>' + escapeHtml(value) + '</span>';
    }).join('');
  }

  function renderUsage(rows) {
    var requests = rows.reduce(function(sum, row) { return sum + Number(row.request_count || 0); }, 0);
    var tokens = rows.reduce(function(sum, row) { return sum + Number(row.input_tokens || 0) + Number(row.output_tokens || 0); }, 0);
    var cost = rows.reduce(function(sum, row) { return sum + Number(row.estimated_cost || 0); }, 0);
    var set = function(id, value) { var el = document.getElementById(id); if (el) { el.textContent = value; } };
    set('request-count-7d', formatNumber(requests));
    set('usage-requests', formatNumber(requests));
    set('usage-tokens', formatNumber(tokens));
    set('usage-cost', '$' + cost.toFixed(4));

    var chart = document.getElementById('usage-chart');
    if (!chart) { return; }
    if (!rows.length) {
      chart.innerHTML = '<div class="chart-empty">No production usage recorded in the last 7 days.</div>';
      return;
    }
    var max = Math.max.apply(null, rows.map(function(row) { return Number(row.request_count || 0); }).concat([1]));
    chart.innerHTML = rows.slice().reverse().map(function(row) {
      var height = Math.max(8, Math.round(Number(row.request_count || 0) / max * 100));
      return '<div class="usage-bar" style="height:' + height + '%" title="' + escapeHtml(row.bucket) + ': ' + Number(row.request_count || 0) + ' requests"><span>' + escapeHtml(String(row.bucket).slice(5)) + '</span></div>';
    }).join('');
  }

  function loadLandingStatus() {
    var dot = document.getElementById('hero-status-dot');
    var text = document.getElementById('hero-status-text');
    fetch('/landing/status')
      .then(function(response) {
        if (!response.ok) { throw new Error('status unavailable'); }
        return response.json();
      })
      .then(function(payload) {
        var data = payload.data;
        if (dot) { dot.classList.add('ready'); }
        if (text) { text.textContent = 'Gateway ready · ' + data.database; }
        var set = function(id, value) { var el = document.getElementById(id); if (el) { el.textContent = value; } };
        set('provider-count', data.provider_count);
        set('live-model-count', data.model_count);
        set('model-count-heading', data.model_count);
        set('capability-count', data.capabilities.length);
        set('hero-live-summary', data.provider_count + ' providers · ' + data.model_count + ' models');
        renderMarquee('model-marquee', data.models.map(function(model) { return model.id; }));
        renderMarquee('capability-marquee', data.active_capabilities.length ? data.active_capabilities : data.capabilities);
        renderUsage(data.usage_7d || []);
      })
      .catch(function() {
        if (dot) { dot.classList.add('error'); }
        if (text) { text.textContent = 'Gateway status unavailable'; }
        renderMarquee('model-marquee', ['Registry temporarily unavailable']);
        renderMarquee('capability-marquee', ['chat', 'coding', 'image-generation', 'vision']);
        renderUsage([]);
      });
  }

  loadLandingStatus();

  // ── Scroll-triggered fade-in ──────────────────────────────────────────
  var fadeEls = document.querySelectorAll('.fade-up');
  if ('IntersectionObserver' in window) {
    var fadeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          fadeObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    fadeEls.forEach(function (el) { fadeObserver.observe(el); });
  } else {
    fadeEls.forEach(function (el) { el.classList.add('visible'); });
  }

  // ── Stats count-up ────────────────────────────────────────────────────
  var statItems = document.querySelectorAll('.stat-item[data-target]');
  var statsAnimated = false;

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateCount(el, target, suffix, duration) {
    var start = null;
    var isLt = el.classList.contains('stat-lt');
    if (isLt) { return; } // static display
    function step(ts) {
      if (!start) { start = ts; }
      var elapsed = ts - start;
      var progress = Math.min(elapsed / duration, 1);
      var current = Math.round(easeOut(progress) * target);
      el.textContent = current + suffix;
      if (progress < 1) { requestAnimationFrame(step); }
    }
    requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window) {
    var statsObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !statsAnimated) {
          statsAnimated = true;
          statItems.forEach(function (item) {
            var numEl = item.querySelector('.stat-number');
            var target = parseInt(item.getAttribute('data-target') || '0', 10);
            var suffix = item.getAttribute('data-suffix') || '';
            if (numEl) { animateCount(numEl, target, suffix, 1200); }
          });
          statsObserver.disconnect();
        }
      });
    }, { threshold: 0.3 });
    var statsSection = document.querySelector('.stats-section');
    if (statsSection) { statsObserver.observe(statsSection); }
  }

  // ── Code tabs ─────────────────────────────────────────────────────────
  var tabs = document.querySelectorAll('.code-tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.code-block').forEach(function (b) { b.classList.remove('active'); });
      tab.classList.add('active');
      var target = tab.getAttribute('data-tab');
      var block = document.getElementById('tab-' + target);
      if (block) { block.classList.add('active'); }
    });
  });

  // ── Typewriter terminal ───────────────────────────────────────────────
  var termBody = document.getElementById('term-body');
  if (!termBody) { return; }

  var lines = [
    { text: '$ curl https://somail.us/v1/chat \\\\', cls: 'term-cmd' },
    { text: '    -H "x-api-key: gw_live_8f3a..." \\\\',    cls: 'term-flag' },
    { text: '    -H "content-type: application/json" \\\\', cls: 'term-flag' },
    { text: "    -d '{\\"model\\":\\"auto\\",\\"task_type\\":\\"coding\\",...}'", cls: 'term-string' }
  ];

  var responseLines = [
    { text: '\\u27f3 Resolving model for task=coding...', cls: 'term-response', delay: 400 },
    { text: '\\u2713 Policy accepted · route resolved from registry', cls: 'term-success', delay: 900 },
    { text: '\\u2713 Response: 200 OK · x-request-id attached', cls: 'term-success', delay: 1400 }
  ];

  var LOOP_PAUSE = 6000;
  var cursorEl = null;
  var demoRowShown = false;

  function clearTerminal() {
    termBody.innerHTML = '';
    cursorEl = document.createElement('span');
    cursorEl.className = 'term-cursor';
    termBody.appendChild(cursorEl);
  }

  function typeText(el, text, speed, onDone) {
    var i = 0;
    function tick() {
      if (i < text.length) {
        el.textContent += text[i];
        i++;
        setTimeout(tick, speed + Math.random() * 12);
      } else {
        if (onDone) { onDone(); }
      }
    }
    tick();
  }

  function addLine(cls, text) {
    var el = document.createElement('div');
    el.className = 'term-line ' + cls;
    el.textContent = text;
    return el;
  }

  function runSequence(lineIndex) {
    if (lineIndex >= lines.length) {
      var respIndex = 0;
      function showResponse() {
        if (respIndex >= responseLines.length) {
          setTimeout(function () {
            if (!demoRowShown) { demoRowShown = true; showDemoRow(); }
            clearTerminal();
            setTimeout(function () { runSequence(0); }, 300);
          }, LOOP_PAUSE);
          return;
        }
        var rl = responseLines[respIndex];
        setTimeout(function () {
          var el = addLine(rl.cls, rl.text);
          el.style.opacity = '0';
          el.style.transition = 'opacity 0.4s ease';
          if (cursorEl && cursorEl.parentNode === termBody) {
            termBody.insertBefore(el, cursorEl);
          } else {
            termBody.appendChild(el);
          }
          requestAnimationFrame(function () {
            requestAnimationFrame(function () { el.style.opacity = '1'; });
          });
          respIndex++;
          showResponse();
        }, rl.delay);
      }
      setTimeout(showResponse, 300);

      // Show hero badge after terminal sequence starts
      var badge = document.getElementById('hero-badge');
      if (badge) { badge.classList.add('visible'); }
      return;
    }

    var lineData = lines[lineIndex];
    var lineEl = document.createElement('div');
    lineEl.className = 'term-line ' + lineData.cls;
    if (cursorEl && cursorEl.parentNode === termBody) {
      termBody.insertBefore(lineEl, cursorEl);
    } else {
      termBody.appendChild(lineEl);
    }

    typeText(lineEl, lineData.text, 22, function () {
      var br = document.createElement('div');
      br.style.height = '0';
      if (cursorEl && cursorEl.parentNode === termBody) {
        termBody.insertBefore(br, cursorEl);
      } else {
        termBody.appendChild(br);
      }
      setTimeout(function () { runSequence(lineIndex + 1); }, 60);
    });
  }

  clearTerminal();
  setTimeout(function () { runSequence(0); }, 700);

  // ── Demo row helpers ─────────────────────────────────────────────────
  function showDemoRow() {
    var row = document.getElementById('term-demo-row');
    if (row) { row.classList.add('visible'); }
  }

  function addDemoLine(cls, text) {
    var el = document.createElement('div');
    el.className = 'term-line ' + cls;
    el.textContent = text;
    if (cursorEl && cursorEl.parentNode === termBody) {
      termBody.insertBefore(el, cursorEl);
    } else {
      termBody.appendChild(el);
    }
    return el;
  }

  function fakeStream(el, text, done) {
    var i = 0;
    var words = text.split(' ');
    function tick() {
      if (i < words.length) {
        el.textContent += (i > 0 ? ' ' : '') + words[i];
        i++;
        setTimeout(tick, 35 + Math.random() * 25);
      } else if (done) { done(); }
    }
    tick();
  }

  var demoInput = document.getElementById('term-demo-input');
  var demoBtn = document.getElementById('term-demo-btn');
  var lastDemoAt = 0;

  function submitDemo() {
    var now = Date.now();
    if (now - lastDemoAt < 3000) { return; }
    if (!demoInput || !demoBtn) { return; }
    var prompt = demoInput.value.trim();
    if (!prompt) { return; }
    lastDemoAt = now;
    track('demo_submit');
    demoInput.value = '';
    demoBtn.disabled = true;

    addDemoLine('term-cmd', '> ' + prompt);
    var loadEl = addDemoLine('term-response', '⟳ routing...');

    fetch('/landing/demo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: prompt })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      loadEl.textContent = '✓ ' + data.model + ' via ' + data.provider + ' [' + data.latency_ms + 'ms  ' + data.output_tokens + ' tokens]';
      loadEl.className = 'term-line term-success';
      var respEl = addDemoLine('term-line', '');
      fakeStream(respEl, data.response, function() {
        demoBtn.disabled = false;
      });
    })
    .catch(function() {
      loadEl.textContent = '✗ demo unavailable — check provider config';
      loadEl.className = 'term-line term-error';
      demoBtn.disabled = false;
    });
  }

  if (demoBtn) {
    demoBtn.addEventListener('click', submitDemo);
  }
  if (demoInput) {
    demoInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { submitDemo(); }
    });
  }

  // ── Sticky bar ────────────────────────────────────────────────────────
  var stickyBar = document.getElementById('sticky-bar');
  var stickyClose = document.getElementById('sticky-bar-close');
  var heroSection = document.querySelector('.hero');
  var stickyDismissed = false;

  function updateStickyBar() {
    if (stickyDismissed || !stickyBar || !heroSection) { return; }
    var heroBottom = heroSection.getBoundingClientRect().bottom;
    if (heroBottom < 0) {
      stickyBar.classList.add('visible');
    } else {
      stickyBar.classList.remove('visible');
    }
  }

  window.addEventListener('scroll', updateStickyBar, { passive: true });

  if (stickyClose) {
    stickyClose.addEventListener('click', function() {
      stickyDismissed = true;
      if (stickyBar) { stickyBar.classList.add('hidden'); }
    });
  }

  document.querySelectorAll('.code-tab').forEach(function(tab) {
    tab.addEventListener('click', function() { track('integration_tab'); });
  });

})();
`;
