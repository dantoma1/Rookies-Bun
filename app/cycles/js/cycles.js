/* =====================================================
   ROOKIES · CYCLES — front-end behaviour
   Screen switching, live countdown to the next cycle clear,
   drag-rank preference list, modest counter animations.
===================================================== */

// ─── Screen switching ────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) {
    el.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function scrollToId(id) {
  // If targeting the rookie closing while company view is active, redirect to company closing
  if (id === 'closing') {
    const companyView = document.getElementById('view-company');
    if (companyView && companyView.classList.contains('active')) id = 'closing-company';
  }
  // Ensure landing is visible
  if (!document.getElementById('screen-landing').classList.contains('active')) {
    showScreen('landing');
    setTimeout(() => {
      const t = document.getElementById(id);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  } else {
    const t = document.getElementById(id);
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ─── Live countdown to Cycle 01 clear ─────────────────
// Target: 14 June 2026 18:00 CET (UTC+2 in summer)
const CYCLE_CLEAR = new Date('2026-06-14T18:00:00+02:00');

function pad(n) { return String(n).padStart(2, '0'); }

function updateCountdown() {
  const now = new Date();
  let diff = Math.max(0, CYCLE_CLEAR.getTime() - now.getTime());

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  diff -= days * 1000 * 60 * 60 * 24;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  diff -= hours * 1000 * 60 * 60;
  const mins = Math.floor(diff / (1000 * 60));
  diff -= mins * 1000 * 60;
  const secs = Math.floor(diff / 1000);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = pad(v); };
  set('cd-days', days);
  set('cd-hours', hours);
  set('cd-mins', mins);
  set('cd-secs', secs);

  const nav = document.getElementById('nav-countdown');
  if (nav) nav.textContent = days + 'd ' + pad(hours) + 'h';

  const timeline = document.getElementById('timeline-countdown');
  if (timeline) timeline.textContent = days + ' days remaining';

  const timelineCo = document.getElementById('timeline-countdown-company');
  if (timelineCo) timelineCo.textContent = days + ' days remaining';

  const status = document.getElementById('status-countdown');
  if (status) status.textContent = days + 'd ' + pad(hours) + 'h ' + pad(mins) + 'm';
}

updateCountdown();
setInterval(updateCountdown, 1000);

// ─── Counter animations on stats ──────────────────────
function animateCounter(id, target, duration) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = Date.now();
  const initial = 0;
  function step() {
    const elapsed = Date.now() - start;
    const t = Math.min(1, elapsed / duration);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round(initial + (target - initial) * eased);
    el.textContent = value;
    if (t < 1) requestAnimationFrame(step);
  }
  step();
}

// Trigger counter animations when stats bar enters viewport
function setupStatsObserver() {
  const stats = document.querySelector('.stats-bar');
  if (!stats || !('IntersectionObserver' in window)) return;
  let fired = false;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && !fired) {
        fired = true;
        animateCounter('stat-students', 412, 1200);
        animateCounter('stat-employers', 38, 900);
        animateCounter('stat-roles', 96, 1100);
      }
    });
  }, { threshold: 0.4 });
  obs.observe(stats);
}
setupStatsObserver();

// ─── Role toggle (Rookie / Company views) ────────────
function setCycleRole(role) {
  const toggle = document.getElementById('role-toggle');
  const btnR = document.getElementById('role-btn-rookie');
  const btnC = document.getElementById('role-btn-company');
  const viewR = document.getElementById('view-rookie');
  const viewC = document.getElementById('view-company');
  if (!toggle || !viewR || !viewC) return;

  if (role === 'company') {
    toggle.classList.add('is-company');
    btnR.classList.remove('active');
    btnC.classList.add('active');
    viewR.classList.remove('active');
    viewC.classList.add('active');
  } else {
    toggle.classList.remove('is-company');
    btnC.classList.remove('active');
    btnR.classList.add('active');
    viewC.classList.remove('active');
    viewR.classList.add('active');
  }
}

// ─── Preference list is read-only ─────────────────────
// Ranking is computed from fit score + AI rationale + pool state.
// Students can request a re-score but cannot reorder.
// (No drag-and-drop wiring by design.)

// ─── Hero scroll progress (optional) ──────────────────
// Just a subtle visual cue — fades countdown when hero scrolls out.
function setupHeroFade() {
  const countdown = document.querySelector('.hero-countdown');
  if (!countdown) return;
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const opacity = Math.max(0, 1 - scrolled / 400);
    countdown.style.opacity = opacity;
  });
}
setupHeroFade();

// ─── Tilt the demo shell slightly on mouse move ───────
function setupShellTilt() {
  document.querySelectorAll('.demo-shell, .reveal-shell').forEach(shell => {
    shell.addEventListener('mousemove', (e) => {
      const rect = shell.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      shell.style.transform = 'perspective(1200px) rotateX(' + (-y * 1.2) + 'deg) rotateY(' + (x * 1.2) + 'deg)';
    });
    shell.addEventListener('mouseleave', () => {
      shell.style.transform = '';
    });
  });
}
setupShellTilt();
