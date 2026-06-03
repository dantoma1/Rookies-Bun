/* =====================================================
   ROOKIES · CYCLES — front-end behaviour
   Screen switching, live countdown to the next cycle clear,
   drag-rank preference list, modest counter animations.
===================================================== */

// ─── Supabase ────────────────────────────────────────
const SUPABASE_URL     = 'https://ymkysqejyfsgyoauhjvp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlta3lzcWVqeWZzZ3lvYXVoanZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjMyMjksImV4cCI6MjA4OTU5OTIyOX0.dAYXobPTOv3YW_PqxSF654In29qwdkfyVwNo2opW7so';
let db = null;
let currentCyclesUserData = null;
let currentCyclesUserType = null; // 'student' | 'company'

document.addEventListener('DOMContentLoaded', () => {
  const _sb = window.supabase;
  if (_sb) {
    db = _sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: window.sessionStorage } });
    checkCyclesSession();
  }
  document.getElementById('auth-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAuthModal();
  });
});

// ─── Session restore ─────────────────────────────────
async function checkCyclesSession() {
  if (!db) return;
  const { data: { session } } = await db.auth.getSession();
  if (!session) return;
  const userId = session.user.id;
  const stu = await db.from('students').select('*').eq('id', userId).single();
  if (stu.data) { _setCyclesUser(stu.data.name, stu.data, 'student'); return; }
  const emp = await db.from('employers').select('*').eq('id', userId).single();
  if (emp.data) { _setCyclesUser(emp.data.company_name, emp.data, 'company'); return; }
}

function _setCyclesUser(name, data, type) {
  currentCyclesUserData = data || null;
  currentCyclesUserType = type || null;
  document.getElementById('nav-guest').style.display = 'none';
  const userNav = document.getElementById('nav-user');
  userNav.style.display = 'flex';
  document.getElementById('nav-user-name').textContent = name || 'there';
  const avatarEl = document.getElementById('nav-avatar');
  if (avatarEl) {
    avatarEl.textContent = (name || '?').charAt(0).toUpperCase();
    avatarEl.style.background = (data && data.color) ? data.color : 'var(--orange)';
  }
}

function _clearCyclesUser() {
  currentCyclesUserData = null;
  currentCyclesUserType = null;
  document.getElementById('nav-guest').style.display = 'flex';
  document.getElementById('nav-user').style.display = 'none';
  document.getElementById('nav-user-name').textContent = '';
}

// ─── Auth modal ──────────────────────────────────────
let _authMode = 'login'; // 'login' | 'signup'
let _authRole = 'student'; // 'student' | 'company'

function openAuthModal(mode = 'login') {
  _authMode = mode;
  _syncAuthModal();
  document.getElementById('auth-modal').classList.add('open');
  setTimeout(() => document.getElementById('auth-email').focus(), 80);
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('open');
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-name').value = '';
}

function switchAuthMode() {
  _authMode = _authMode === 'login' ? 'signup' : 'login';
  _syncAuthModal();
}

function _syncAuthModal() {
  const isSignup = _authMode === 'signup';
  document.getElementById('auth-title').textContent     = isSignup ? 'Sign up' : 'Log in';
  document.getElementById('auth-sub').textContent       = isSignup ? 'Create your Rookies Cycles account.' : 'Welcome back to Rookies Cycles.';
  document.getElementById('auth-submit-btn').textContent = isSignup ? 'Create account' : 'Log in';
  document.getElementById('auth-role-wrap').style.display = 'block';
  document.getElementById('auth-name-wrap').style.display = isSignup ? 'block' : 'none';
  document.getElementById('auth-switch').innerHTML = isSignup
    ? 'Already have an account? <a href="#" onclick="switchAuthMode();return false;" style="color:var(--orange);font-weight:600;text-decoration:none;">Log in</a>'
    : "Don't have an account? <a href=\"#\" onclick=\"switchAuthMode();return false;\" style=\"color:var(--orange);font-weight:600;text-decoration:none;\">Sign up</a>";
  document.getElementById('auth-error').style.display = 'none';
}

function selectAuthRole(btn) {
  document.querySelectorAll('.auth-role-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  _authRole = btn.dataset.val;
}

async function submitAuth() {
  if (!db) return;
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const name     = document.getElementById('auth-name').value.trim();
  const errEl    = document.getElementById('auth-error');
  const btn      = document.getElementById('auth-submit-btn');

  errEl.style.display = 'none';
  if (!email || !password) { _showAuthError('Please enter your email and password.'); return; }
  if (_authMode === 'signup' && !name) { _showAuthError('Please enter your full name.'); return; }

  btn.textContent = _authMode === 'signup' ? 'Creating account…' : 'Signing in…';
  btn.disabled = true;

  try {
    if (_authMode === 'login') {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const userId = data.user.id;
      if (_authRole === 'student') {
        const stu = await db.from('students').select('*').eq('id', userId).single();
        if (stu.data) { _setCyclesUser(stu.data.name, stu.data, 'student'); closeAuthModal(); return; }
        throw new Error('No student account found for this email. Are you trying to log in as a company?');
      } else {
        const emp = await db.from('employers').select('*').eq('id', userId).single();
        if (emp.data) { _setCyclesUser(emp.data.company_name, emp.data, 'company'); closeAuthModal(); return; }
        throw new Error('No company account found for this email. Are you trying to log in as a student?');
      }

    } else {
      const { data, error } = await db.auth.signUpWithPassword
        ? await db.auth.signUpWithPassword({ email, password })
        : await db.auth.signUp({ email, password });
      if (error) throw error;
      const userId = data.user.id;

      if (_authRole === 'student') {
        const colors = ['#e8622a','#1565c0','#2e7d52','#6a1b9a','#c0392b'];
        const color  = colors[Math.floor(Math.random() * colors.length)];
        const stuData = {
          id: userId, name, color,
          initial: name.charAt(0).toUpperCase(),
          pref_roles: [], skills_technical: [], skills_professional: [],
          skills_languages: [], education: [], experience: [], organisations: [],
          is_active: true, is_admin: false
        };
        await db.from('students').insert([stuData]);
        _setCyclesUser(name, stuData, 'student');
      } else {
        const empData = { id: userId, email, company_name: name, status: 'pending' };
        await db.from('employers').insert([empData]);
        _setCyclesUser(name, empData, 'company');
      }
      closeAuthModal();
    }
  } catch (err) {
    _showAuthError(err.message || 'Something went wrong. Please try again.');
  } finally {
    btn.textContent = _authMode === 'signup' ? 'Create account' : 'Log in';
    btn.disabled = false;
  }
}

function _showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

async function cyclesSignOut() {
  if (db) await db.auth.signOut();
  _clearCyclesUser();
}

// ─── Waitlist gate (live cycle only) ─────────────────
async function joinWaitlist() {
  const btn = document.querySelector('.waitlist-btn');
  const msg = document.getElementById('waitlist-message');
  if (!btn || !msg) return;

  // Not signed in → send to sign-in
  if (!currentCyclesUserData) {
    openAuthModal('login');
    return;
  }

  // Signed in → register on waitlist
  btn.disabled = true;
  btn.textContent = 'Adding you…';

  try {
    if (db) {
      const role = currentCyclesUserType || 'student';
      const userId = currentCyclesUserData.id;
      const name = currentCyclesUserData.name || currentCyclesUserData.company_name || '';
      // Insert into waitlist table; ignore conflict if already on it
      await db.from('waitlist').upsert(
        [{ user_id: userId, role, name, cycle: 'cycle-01' }],
        { onConflict: 'user_id,cycle' }
      );
    }
    msg.textContent = "✓ You're on the waitlist. We'll reach out the moment Cycle 01 opens.";
    msg.classList.add('show');
    btn.textContent = "You're on the list";
  } catch (err) {
    msg.textContent = "Couldn't save your spot just now. Try again in a moment.";
    msg.style.background = 'rgba(220,38,38,0.1)';
    msg.style.color = '#dc2626';
    msg.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Join the waitlist →';
  }
}

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

// ─── Profile screen ───────────────────────────────────
function openProfileScreen() {
  var stuEl = document.getElementById('real-profile-layout');
  var coEl  = document.getElementById('company-profile-content');
  if (currentCyclesUserType === 'student') {
    currentStudent = currentCyclesUserData;
    if (stuEl) stuEl.style.display = '';
    if (coEl)  coEl.style.display  = 'none';
    loadStudentProfile();
  } else {
    currentCompany = currentCyclesUserData;
    currentStudent = null;
    if (stuEl) stuEl.style.display = 'none';
    if (coEl) {
      coEl.style.display = '';
      loadCompanyProfile();
    }
  }
  showScreen('profile');
}

function _buildCompanyProfile(d) {
  const name    = d.company_name || 'Company';
  const initial = name.charAt(0).toUpperCase();
  const isActive = d.status === 'active' || d.status === 'approved';

  return '<div class="pcycle-hero">' +
    '<div class="pcycle-avatar pcycle-avatar-co">' + initial + '</div>' +
    '<div class="pcycle-hero-info">' +
      '<h1 class="pcycle-name">' + name + '</h1>' +
      (d.sector ? '<div class="pcycle-meta">' + d.sector + '</div>' : '') +
      '<div class="pcycle-status-badge ' + (isActive ? 'active' : 'pending') + '">' +
        (isActive ? 'Active' : 'Pending approval') +
      '</div>' +
    '</div>' +
  '</div>' +

  (d.description ?
    '<div class="pcycle-section">' +
      '<div class="pcycle-section-title">About</div>' +
      '<p class="pcycle-desc">' + d.description + '</p>' +
    '</div>' : '') +

  '<div class="pcycle-section">' +
    '<div class="pcycle-section-title">Contact</div>' +
    (d.email   ? '<div class="pcycle-meta">' + d.email + '</div>'   : '') +
    (d.website ? '<div class="pcycle-meta"><a href="' + d.website + '" target="_blank" rel="noopener" style="color:var(--orange);">' + d.website + '</a></div>' : '') +
  '</div>' +

  '<div class="pcycle-cycle-card">' +
    '<div class="pcycle-cycle-label">Cycle 01 · Spring 2026</div>' +
    '<div class="pcycle-cycle-status">Post a role to join the pool · shortlist drops 14 June 2026</div>' +
    '<button class="btn btn-primary" style="margin-top:16px;" onclick="setCycleRole(\'company\');showScreen(\'landing\');setTimeout(()=>scrollToId(\'closing-company\'),120)">Post a role →</button>' +
  '</div>' +
  '<div style="margin-top:28px;text-align:center;">' +
    '<button class="btn btn-outline-navy" onclick="showScreen(\'landing\')">← Back</button>' +
  '</div>';
}
