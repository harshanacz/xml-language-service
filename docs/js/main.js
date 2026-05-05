/* ─── Active nav on scroll ───────────────────────────────────────────────── */
(function () {
  const sections = document.querySelectorAll('[data-section]');
  const navLinks = document.querySelectorAll('.sidebar-link[data-target]');
  const scrolltop = document.querySelector('.scrolltop');

  function updateActive() {
    let current = '';
    sections.forEach(sec => {
      if (window.scrollY >= sec.offsetTop - 120) current = sec.dataset.section;
    });
    navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.target === current);
    });

    if (scrolltop) {
      scrolltop.classList.toggle('show', window.scrollY > 300);
    }
  }

  window.addEventListener('scroll', updateActive, { passive: true });
  updateActive();

  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector('[data-section="' + link.dataset.target + '"]');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (window.innerWidth <= 700) closeSidebar();
      }
    });
  });

  if (scrolltop) {
    scrolltop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ─── Mobile sidebar ───────────────────────────────────────────────────── */
  const sidebar = document.querySelector('.sidebar');
  const toggle  = document.querySelector('.menu-toggle');
  const overlay = document.querySelector('.sidebar-overlay');

  function openSidebar()  { sidebar && sidebar.classList.add('open');    overlay && overlay.classList.add('show'); }
  function closeSidebar() { sidebar && sidebar.classList.remove('open'); overlay && overlay.classList.remove('show'); }
  function toggleSidebar() {
    if (sidebar && sidebar.classList.contains('open')) closeSidebar();
    else openSidebar();
  }

  toggle  && toggle.addEventListener('click', toggleSidebar);
  overlay && overlay.addEventListener('click', closeSidebar);

  /* ─── Copy buttons ─────────────────────────────────────────────────────── */
  document.querySelectorAll('.copy-btn').forEach(btn => {
    if (!btn.innerHTML.trim()) btn.innerHTML = svgCopy();

    btn.addEventListener('click', () => {
      const target = btn.closest('.code-wrap, .hero-install');
      const code = target
        ? (target.querySelector('code') || target.querySelector('pre'))?.textContent?.trim()
        : btn.dataset.copy;

      if (!code) return;
      navigator.clipboard.writeText(code).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = svgCheck();
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = svgCopy();
        }, 2000);
      });
    });
  });

  /* ─── Tab code examples ────────────────────────────────────────────────── */
  document.querySelectorAll('.tabs').forEach(tabGroup => {
    const buttons = tabGroup.querySelectorAll('.tab-btn');
    const panes   = tabGroup.querySelectorAll('.tab-pane');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.tab;
        buttons.forEach(b => b.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        tabGroup.querySelector('.tab-pane[data-tab="' + id + '"]')?.classList.add('active');
      });
    });
  });
})();

/* ─── SVG icons ──────────────────────────────────────────────────────────── */
function svgCopy() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
}
function svgCheck() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
}
