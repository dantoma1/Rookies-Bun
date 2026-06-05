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

  // Signup form blur validation
  function _blurCheck(id, checkFn) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', checkFn);
    el.addEventListener('input', function() { if (el.classList.contains('error')) checkFn(); });
  }
  _blurCheck('ss-firstname', function() {
    var el = document.getElementById('ss-firstname');
    if (!el.value.trim()) _showFieldError(el, 'Please enter your first name.');
    else _clearFieldError(el);
  });
  _blurCheck('ss-lastname', function() {
    var el = document.getElementById('ss-lastname');
    if (!el.value.trim()) _showFieldError(el, 'Please enter your last name.');
    else _clearFieldError(el);
  });
  _blurCheck('ss-email', function() {
    var el = document.getElementById('ss-email');
    if (!el.value.trim()) _showFieldError(el, 'Please enter your email address.');
    else if (!_isValidEmail(el.value.trim())) _showFieldError(el, 'Please enter a valid email address.');
    else _clearFieldError(el);
  });
  _blurCheck('ss-password', function() {
    var el = document.getElementById('ss-password');
    if (el.value.length > 0 && el.value.length < 8) _showFieldError(el, 'Password must be at least 8 characters.');
    else _clearFieldError(el);
  });
  _blurCheck('ss-password2', function() {
    var el = document.getElementById('ss-password2');
    var pw = document.getElementById('ss-password');
    if (el.value && pw && el.value !== pw.value) _showFieldError(el, 'Passwords do not match.');
    else _clearFieldError(el);
  });
  _blurCheck('cs-company', function() {
    var el = document.getElementById('cs-company');
    if (!el.value.trim()) _showFieldError(el, 'Please enter your company name.');
    else _clearFieldError(el);
  });
  _blurCheck('cs-email', function() {
    var el = document.getElementById('cs-email');
    if (!el.value.trim()) _showFieldError(el, 'Please enter your work email.');
    else if (!_isValidEmail(el.value.trim())) _showFieldError(el, 'Please enter a valid email address.');
    else _clearFieldError(el);
  });
  _blurCheck('cs-password', function() {
    var el = document.getElementById('cs-password');
    if (el.value.length > 0 && el.value.length < 8) _showFieldError(el, 'Password must be at least 8 characters.');
    else _clearFieldError(el);
  });
  _blurCheck('cs-password2', function() {
    var el = document.getElementById('cs-password2');
    var pw = document.getElementById('cs-password');
    if (el.value && pw && el.value !== pw.value) _showFieldError(el, 'Passwords do not match.');
    else _clearFieldError(el);
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

  // No DB row — user may have just verified their email
  var pendingType = sessionStorage.getItem('cycles_pending_type');
  if (pendingType === 'student') {
    var pendingName  = sessionStorage.getItem('cycles_pending_name') || session.user.email;
    var pendingFirst = pendingName.split(' ')[0];
    var colors = ['#e8622a','#1565c0','#2e7d52','#6a1b9a','#c0392b','#4a148c','#0f1f3d'];
    var color  = colors[Math.floor(Math.random() * colors.length)];
    var row = {
      id: userId, name: pendingName, color: color, initial: pendingFirst[0].toUpperCase(),
      pref_roles: [], skills_technical: [], skills_professional: [],
      skills_languages: [], education: [], experience: [], organisations: [],
      is_active: true, is_admin: false
    };
    var ins = await db.from('students').insert([row]);
    if (!ins.error) {
      sessionStorage.removeItem('cycles_pending_type');
      sessionStorage.removeItem('cycles_pending_name');
      sessionStorage.removeItem('cycles_pending_email');
      _setCyclesUser(pendingName, row, 'student');
      if (typeof showToast === 'function') showToast('Email verified! Welcome, ' + pendingFirst + '!');
      openProfileScreen();
    }
  }
}

async function _checkLandingGate() {
  if (!db || !currentCyclesUserData) return;
  try {
    var { data: cycle } = await db.from('cycles').select('*')
      .not('status', 'eq', 'closed').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!cycle) return;

    // Always update the timeline phase to match the real DB status
    _updateLandingTimeline(cycle.status);

    // Fetch real stats for any logged-in user
    var { data: stats } = await db.rpc('get_cycle_stats', { p_cycle_id: cycle.id });
    if (stats) {
      animateCounter('stat-students',  stats.students  || 0, 1000);
      animateCounter('stat-employers', stats.companies || 0, 900);
      animateCounter('stat-roles',     stats.roles     || 0, 800);
    }

    // Check participation — only participants get blur removed and gates hidden
    var { data: part } = await db.from('cycle_participants').select('id')
      .eq('cycle_id', cycle.id).eq('user_id', currentCyclesUserData.id).maybeSingle();
    if (!part) return;

    document.querySelectorAll('.landing-timeline-gate').forEach(function(el) {
      el.classList.add('hidden');
    });
    ['stat-students', 'stat-employers', 'stat-roles'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.style.filter = 'none'; el.style.opacity = '1'; }
    });
  } catch(e) {}
}

function _updateLandingTimeline(status) {
  var phases   = ['scheduled','open','locked','clearing','revealed','closed'];
  var idx      = phases.indexOf(status || 'scheduled');
  var stuLabels = ['Scheduled','Registration','Lock','Clearing','Reveal','Closed'];
  var coLabels  = ['Scheduled','Roles open','Lock','Clearing','Reveal','Closed'];

  function renderTrack(trackId, labelsId, labelNames) {
    var track  = document.getElementById(trackId);
    var labels = document.getElementById(labelsId);
    if (!track || !labels) return;
    track.innerHTML = phases.map(function(_, i) {
      var cls = i < idx ? ' done' : i === idx ? ' live' : '';
      return '<div class="cycle-track-cell' + cls + '"></div>';
    }).join('');
    labels.innerHTML = labelNames.map(function(name, i) {
      var cls = i < idx ? ' done' : i === idx ? ' live' : '';
      return '<div class="cycle-track-label' + cls + '">' + name + '</div>';
    }).join('');
  }

  renderTrack('landing-track-student', 'landing-labels-student', stuLabels);
  renderTrack('landing-track-company', 'landing-labels-company', coLabels);
}

function _setCyclesUser(name, data, type) {
  currentCyclesUserData = data || null;
  currentCyclesUserType = type || null;
  document.getElementById('nav-guest').style.display = 'none';
  const userNav = document.getElementById('nav-user');
  // Re-check gate in case the status screen is currently visible
  if (document.getElementById('screen-status').classList.contains('active')) {
    if (typeof checkCycleGate === 'function') checkCycleGate();
  }
  userNav.style.display = 'flex';
  document.getElementById('nav-user-name').textContent = name || 'there';
  const avatarEl = document.getElementById('nav-avatar');
  if (avatarEl) {
    avatarEl.textContent = (name || '?').charAt(0).toUpperCase();
    avatarEl.style.background = (data && data.color) ? data.color : 'var(--orange)';
  }
  // Check whether to reveal the landing-page cycle timeline
  _checkLandingGate();
}

function _clearCyclesUser() {
  currentCyclesUserData = null;
  currentCyclesUserType = null;
  document.getElementById('nav-guest').style.display = 'flex';
  document.getElementById('nav-user').style.display = 'none';
  document.getElementById('nav-user-name').textContent = '';
  // Restore landing-page gates and blurred stats on sign-out
  document.querySelectorAll('.landing-timeline-gate').forEach(function(el) {
    el.classList.remove('hidden');
  });
  ['stat-students', 'stat-employers', 'stat-roles'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.style.filter = ''; el.style.opacity = ''; }
  });
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
}

function switchAuthMode() {
  // Modal is login-only; route signup to the role picker
  closeAuthModal();
  showScreen('signup-pick');
}

function _syncAuthModal() {
  document.getElementById('auth-title').textContent      = 'Log in';
  document.getElementById('auth-sub').textContent        = 'Welcome back to Rookies Cycles.';
  document.getElementById('auth-submit-btn').textContent = 'Log in';
  document.getElementById('auth-switch').innerHTML =
    "Don't have an account? <a href=\"#\" onclick=\"closeAuthModal();showScreen('signup-pick');return false;\" style=\"color:var(--orange);font-weight:600;text-decoration:none;\">Sign up</a>";
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
  const btn      = document.getElementById('auth-submit-btn');

  document.getElementById('auth-error').style.display = 'none';
  if (!email || !password) { _showAuthError('Please enter your email and password.'); return; }

  btn.textContent = 'Signing in…';
  btn.disabled = true;

  try {
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
  } catch (err) {
    _showAuthError(err.message || 'Something went wrong. Please try again.');
  } finally {
    btn.textContent = 'Log in';
    btn.disabled = false;
  }
}

function openAuthForRole(role) {
  // Already logged in as that role → go straight to profile
  if (currentCyclesUserData && currentCyclesUserType === role) {
    openProfileScreen();
    return;
  }
  // Not logged in or different role → open modal with role pre-selected
  // For new users, the modal "Sign up" link routes to the correct signup screen
  _authRole = role;
  _syncAuthModal();
  // Pre-select the right chip
  document.querySelectorAll('.auth-role-chip').forEach(function(c) {
    c.classList.toggle('active', c.dataset.val === role);
  });
  document.getElementById('auth-modal').classList.add('open');
  setTimeout(function() { document.getElementById('auth-email').focus(); }, 80);
}

function _showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

async function cyclesSignOut() {
  if (db) await db.auth.signOut();
  _clearCyclesUser();
  showScreen('landing');
}

// ─── Student signup ───────────────────────────────────
function _isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function _showSignupError(id, msg) {
  var el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function _hideSignupError(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

async function studentSignupSubmit() {
  var firstEl = document.getElementById('ss-firstname');
  var lastEl  = document.getElementById('ss-lastname');
  var emailEl = document.getElementById('ss-email');
  var pwEl    = document.getElementById('ss-password');
  var pw2El   = document.getElementById('ss-password2');

  _hideSignupError('ss-error-1');
  var first = firstEl.value.trim(), last = lastEl.value.trim();
  var email = emailEl.value.trim();
  var pw = pwEl.value, pw2 = pw2El.value;

  var ok = true;
  if (!first) { _showFieldError(firstEl, 'Please enter your first name.'); ok = false; } else _clearFieldError(firstEl);
  if (!last)  { _showFieldError(lastEl,  'Please enter your last name.');  ok = false; } else _clearFieldError(lastEl);
  if (!email) { _showFieldError(emailEl, 'Please enter your email address.'); ok = false; }
  else if (!_isValidEmail(email)) { _showFieldError(emailEl, 'Please enter a valid email address.'); ok = false; }
  else _clearFieldError(emailEl);
  if (pw.length < 8) { _showFieldError(pwEl, 'Password must be at least 8 characters.'); ok = false; } else _clearFieldError(pwEl);
  if (pw !== pw2) { _showFieldError(pw2El, 'Passwords do not match.'); ok = false; } else _clearFieldError(pw2El);
  if (!ok) { _scrollToFirstError(document.getElementById('screen-signup-student')); return; }

  var btn = document.getElementById('ss-submit-btn');
  btn.textContent = 'Creating account…'; btn.disabled = true;

  try {
    var a = await db.auth.signUp({ email: email, password: pw });
    if (a.error) throw a.error;
    if (!a.data.user) throw new Error('Signup succeeded but no user returned — check Supabase email confirmation settings.');

    if (!a.data.session) {
      // Email confirmation required
      sessionStorage.setItem('cycles_pending_type', 'student');
      sessionStorage.setItem('cycles_pending_name', first + ' ' + last);
      sessionStorage.setItem('cycles_pending_email', email);
      document.getElementById('verify-email-address').textContent = email;
      btn.textContent = 'Create account →'; btn.disabled = false;
      showScreen('verify-email');
      return;
    }

    // Email confirmation off — create row immediately
    var name = first + ' ' + last;
    var colors = ['#e8622a','#1565c0','#2e7d52','#6a1b9a','#c0392b','#4a148c','#0f1f3d'];
    var color  = colors[Math.floor(Math.random() * colors.length)];
    var row = {
      id: a.data.user.id, name: name, color: color, initial: first[0].toUpperCase(),
      pref_roles: [], skills_technical: [], skills_professional: [],
      skills_languages: [], education: [], experience: [], organisations: [],
      is_active: true, is_admin: false
    };
    var ins = await db.from('students').insert([row]);
    if (ins.error) throw ins.error;
    _setCyclesUser(name, row, 'student');
    showToast('Welcome to Rookies Cycles, ' + first + '!');
    openProfileScreen();
  } catch(err) {
    var msg = err.message || 'Something went wrong. Please try again.';
    if (msg.toLowerCase().includes('should contain at least one character of each')) {
      msg = 'Password must include at least one uppercase letter, one lowercase letter, and one number.';
    }
    _showSignupError('ss-error-1', msg);
    btn.textContent = 'Create account →'; btn.disabled = false;
  }
}

async function resendVerificationEmail() {
  var email = sessionStorage.getItem('cycles_pending_email');
  if (!email) { showToast('No pending verification found.', 'error'); return; }
  var res = await db.auth.resend({ type: 'signup', email: email });
  if (res.error) showToast('Could not resend: ' + res.error.message, 'error');
  else showToast('Verification email resent — check your inbox.');
}

// ─── Company signup ───────────────────────────────────
async function companySignupSubmit() {
  var companyEl = document.getElementById('cs-company');
  var emailEl   = document.getElementById('cs-email');
  var pwEl      = document.getElementById('cs-password');
  var pw2El     = document.getElementById('cs-password2');

  _hideSignupError('cs-error-1');
  var company = companyEl.value.trim(), email = emailEl.value.trim();
  var pw = pwEl.value, pw2 = pw2El.value;

  var ok = true;
  if (!company) { _showFieldError(companyEl, 'Please enter your company name.'); ok = false; } else _clearFieldError(companyEl);
  if (!email)   { _showFieldError(emailEl, 'Please enter your work email.'); ok = false; }
  else if (!_isValidEmail(email)) { _showFieldError(emailEl, 'Please enter a valid email address.'); ok = false; }
  else _clearFieldError(emailEl);
  if (pw.length < 8) { _showFieldError(pwEl, 'Password must be at least 8 characters.'); ok = false; } else _clearFieldError(pwEl);
  if (pw !== pw2) { _showFieldError(pw2El, 'Passwords do not match.'); ok = false; } else _clearFieldError(pw2El);
  if (!ok) { _scrollToFirstError(document.getElementById('screen-signup-company')); return; }

  var btn = document.getElementById('cs-submit-btn');
  btn.textContent = 'Creating account…'; btn.disabled = true;

  try {
    var a = await db.auth.signUp({ email: email, password: pw });
    if (a.error) throw a.error;
    if (!a.data.user) throw new Error('Signup succeeded but no user returned — check Supabase email confirmation settings.');

    var empData = { id: a.data.user.id, email: email, company_name: company, status: 'approved' };
    var ins = await db.from('employers').insert([empData]);
    if (ins.error) throw ins.error;
    _setCyclesUser(company, empData, 'company');
    showToast('Welcome to Rookies Cycles, ' + company + '!');
    openProfileScreen();
  } catch(err) {
    var msg = err.message || 'Something went wrong. Please try again.';
    if (msg.toLowerCase().includes('should contain at least one character of each')) {
      msg = 'Password must include at least one uppercase letter, one lowercase letter, and one number.';
    }
    _showSignupError('cs-error-1', msg);
    btn.textContent = 'Create account →'; btn.disabled = false;
  }
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
    if (name === 'status' && typeof checkCycleGate === 'function') checkCycleGate();
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
// Placeholder target: 7 days from page load so the hero badge always
// shows ~T-7 days/HH/MM/SS. Replace with the real launch date when set.
const CYCLE_CLEAR = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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

// (Hero scroll fade removed — the T-10 widget stays visible.)

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
