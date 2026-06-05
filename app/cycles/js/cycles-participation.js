// ─── STATUS SCREEN GATE ──────────────────────────────────────────────────────
// Called every time screen-status becomes active (from showScreen in cycles.js).
async function checkCycleGate() {
  var gate    = document.getElementById('cycle-gate');
  var content = document.getElementById('cycle-status-content');
  if (!gate || !content) return;

  // Not logged in → ensure preview is showing, real content hidden
  if (!currentCyclesUserData) {
    content.innerHTML = '';
    content.style.display = 'none';
    var preview = document.getElementById('cycle-status-preview');
    if (preview) preview.style.display = '';
    _showGate('Log in to see inside.',
      'Create an account or log in, then join Cycle 01 to unlock the live status page.',
      'Log in →', function() { openAuthModal('login'); });
    return;
  }

  // Logged in — check if they're a participant in any active cycle
  try {
    var { data: cycle } = await db
      .from('cycles')
      .select('*')
      .not('status', 'eq', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cycle) {
      gate.classList.add('hidden');
      return;
    }

    // Always keep _activeCycle in sync so _loadCycleStats() has the id
    _activeCycle = cycle;

    var { data: part } = await db
      .from('cycle_participants')
      .select('id')
      .eq('cycle_id', cycle.id)
      .eq('user_id', currentCyclesUserData.id)
      .maybeSingle();

    if (part) {
      // Participant — swap preview for real content and unlock
      _injectStatusContent();
      gate.classList.add('hidden');
    } else {
      // Not a participant — wipe real content, keep blurred preview, show gate
      content.innerHTML = '';
      content.style.display = 'none';
      var preview = document.getElementById('cycle-status-preview');
      if (preview) preview.style.display = '';
      _showGate('Join to see inside.',
        'Register for Cycle 01 to see who\'s in the pool, which sectors are represented, and how the cycle is shaping up.',
        'Join Cycle 01 →', _gateJoin);
    }
  } catch(e) {
    content.innerHTML = '';
    content.style.display = 'none';
  }
}

function _showGate(title, sub, btnLabel, btnFn) {
  var gate    = document.getElementById('cycle-gate');
  var content = document.getElementById('cycle-status-content');
  document.getElementById('cycle-gate-title').textContent = title;
  document.getElementById('cycle-gate-sub').textContent   = sub;
  var btn = document.getElementById('cycle-gate-btn');
  btn.textContent = btnLabel;
  btn.disabled    = false;
  btn.onclick     = btnFn;
  document.getElementById('cycle-gate-message').textContent = '';
  gate.classList.remove('hidden');
}

async function _gateJoin() {
  var btn = document.getElementById('cycle-gate-btn');
  var msg = document.getElementById('cycle-gate-message');
  if (btn) { btn.textContent = 'Joining…'; btn.disabled = true; }

  try {
    var { data: cycle } = await db
      .from('cycles')
      .select('id')
      .not('status', 'eq', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cycle) throw new Error('No active cycle found.');

    var role = currentCyclesUserType || 'student';
    var { error } = await db.from('cycle_participants').insert([{
      cycle_id: cycle.id,
      user_id:  currentCyclesUserData.id,
      role:     role
    }]);
    if (error && !error.message.includes('duplicate') && !error.message.includes('unique')) throw error;

    // Inject content then unlock
    _injectStatusContent();
    var gate = document.getElementById('cycle-gate');
    gate.classList.add('hidden');

    // Update participation state so the profile card also reflects it
    if (role === 'student') _studentIsParticipant = true;
    else                    _companyIsParticipant = true;

    showToast('You\'re in! Welcome to the cycle pool.');
    // Update landing page stats and remove blur immediately
    if (typeof _checkLandingGate === 'function') _checkLandingGate();
  } catch(e) {
    if (msg) msg.textContent = 'Could not join: ' + (e.message || 'Please try again.');
    if (btn) { btn.textContent = 'Join Cycle 01 →'; btn.disabled = false; }
  }
}

// Called from cycles.js showScreen() when navigating to status
function cycleGateAction() {
  if (!currentCyclesUserData) { openAuthModal('login'); return; }
  _gateJoin();
}

function _injectStatusContent() {
  var el = document.getElementById('cycle-status-content');
  if (!el) return;
  // Hide blurred preview, show real content
  var preview = document.getElementById('cycle-status-preview');
  if (preview) preview.style.display = 'none';
  el.style.display = '';
  if (el.children.length > 0) return; // already injected
  var c = _activeCycle || {};
  var statusPhases = ['scheduled','open','locked','clearing','revealed','closed'];
  var currentPhaseIdx = statusPhases.indexOf(c.status || 'scheduled');
  var phaseLabel = { scheduled:'Scheduled', open:'Open', locked:'Pool locked',
                     clearing:'Clearing', revealed:'Revealed', closed:'Closed' };
  var phaseNames = ['Scheduled','Registration','Lock','Clearing','Reveal','Closed'];

  function trackCell(i) {
    var cls = i < currentPhaseIdx ? 'done' : i === currentPhaseIdx ? 'live' : '';
    return '<div class="cycle-track-cell' + (cls ? ' ' + cls : '') + '"></div>';
  }
  function trackLabel(i) {
    var cls = i < currentPhaseIdx ? 'done' : i === currentPhaseIdx ? 'live' : '';
    return '<div class="cycle-track-label' + (cls ? ' ' + cls : '') + '">' + phaseNames[i] + '</div>';
  }

  var revealStr = c.reveal_at ? 'Reveal ' + _fmtCycleDate(c.reveal_at) : '';

  el.innerHTML = [
    '<div class="section-eyebrow">' + esc(c.name || 'Cycle 01') + '</div>',
    '<h1 class="subscreen-title" id="cycle-screen-title">' + esc(c.name || 'Cycle 01') + '</h1>',
    '<p class="subscreen-sub">Live pool data for this cycle — registration counters, top sectors, top universities, and how the pool is shaping up.</p>',
    '<div class="cycle-timeline">',
      '<div class="cycle-timeline-header">',
        '<div><div class="cycle-timeline-title" id="cycle-phase-label">Phase ' + (currentPhaseIdx + 1) + ' of 6 · ' + (phaseLabel[c.status] || 'Scheduled') + '</div></div>',
        '<div class="cycle-timeline-meta">' + revealStr + (revealStr ? ' · ' : '') + '<strong style="color:var(--orange);" id="status-countdown">—</strong></div>',
      '</div>',
      '<div class="cycle-track" id="cycle-track-cells">',
        trackCell(0), trackCell(1), trackCell(2), trackCell(3), trackCell(4), trackCell(5),
      '</div>',
      '<div class="cycle-track-labels">',
        trackLabel(0), trackLabel(1), trackLabel(2), trackLabel(3), trackLabel(4), trackLabel(5),
      '</div>',
    '</div>',
    '<div class="stats-bar" style="margin-top:24px;border-radius:18px;border:1px solid var(--border);">',
      '<div class="stats-bar-inner">',
        '<div class="stat-item"><div class="stat-num orange" id="cstat-students">0</div><div class="stat-label">Students in pool</div></div>',
        '<div class="stat-item"><div class="stat-num" id="cstat-employers">0</div><div class="stat-label">Employers in pool</div></div>',
        '<div class="stat-item"><div class="stat-num" id="cstat-roles">0</div><div class="stat-label">Roles entered</div></div>',
        '<div class="stat-item"><div class="stat-num" id="cstat-matches">0</div><div class="stat-label">Projected matches</div></div>',
        '<div class="stat-item"><div class="stat-num orange" id="cstat-sectors">0</div><div class="stat-label">Sectors represented</div></div>',
      '</div>',
    '</div>',
    '<div style="margin-top:32px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">',
      '<div class="mechanism-card" style="background:white;border:1px solid var(--border);">',
        '<div class="layer-tag" style="color:var(--orange);">Sector signal</div>',
        '<h4 style="color:var(--navy);font-family:\'Syne\',sans-serif;font-size:17px;margin-bottom:18px;">Top sectors this cycle</h4>',
        '<div id="cycle-sectors-list" style="display:flex;flex-direction:column;gap:10px;font-size:14px;color:var(--gray);">Loading…</div>',
      '</div>',
      '<div class="mechanism-card" style="background:white;border:1px solid var(--border);">',
        '<div class="layer-tag" style="color:var(--orange);">University signal</div>',
        '<h4 style="color:var(--navy);font-family:\'Syne\',sans-serif;font-size:17px;margin-bottom:18px;">Top institutions</h4>',
        '<div id="cycle-unis-list" style="display:flex;flex-direction:column;gap:10px;font-size:14px;color:var(--gray);">Loading…</div>',
      '</div>',
      '<div class="mechanism-card" style="background:white;border:1px solid var(--border);">',
        '<div class="layer-tag" style="color:var(--orange);">Cycle pulse</div>',
        '<h4 style="color:var(--navy);font-family:\'Syne\',sans-serif;font-size:17px;margin-bottom:18px;">How this cycle is going</h4>',
        '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:14px;">',
          '<div id="cycle-health-grade" style="font-family:\'Syne\',sans-serif;font-size:48px;font-weight:700;color:var(--gray);line-height:1;">—</div>',
          '<div style="font-size:13px;color:var(--text-light);">cycle health</div>',
        '</div>',
        '<p id="cycle-health-text" style="font-size:14px;color:var(--text-light);line-height:1.6;">Calculating…</p>',
      '</div>',
    '</div>',
    '<div style="margin-top:40px;text-align:center;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">',
      '<button class="btn btn-outline-navy" onclick="showScreen(\'landing\')">← Back to landing</button>',
    '</div>'
  ].join('');

  if (typeof updateCountdown === 'function') updateCountdown();
  _loadCycleStats();
}

async function _loadCycleStats() {
  if (!db || !_activeCycle) return;

  try {
    var { data, error } = await db.rpc('get_cycle_stats', { p_cycle_id: _activeCycle.id });
    if (error) throw error;

    var stats     = data || {};
    var students  = stats.students  || 0;
    var companies = stats.companies || 0;
    var roleCount = stats.roles     || 0;
    var sectors   = stats.sectors   || 0;
    var projected = students > 0 && roleCount > 0 ? students * 5 : 0;

    animateCounter('cstat-students',  students,  1000);
    animateCounter('cstat-employers', companies, 900);
    animateCounter('cstat-roles',     roleCount, 800);
    animateCounter('cstat-sectors',   sectors,   700);
    animateCounter('cstat-matches',   projected, 1100);

    // Sector list
    var sectorsListEl = document.getElementById('cycle-sectors-list');
    if (sectorsListEl) {
      var topSectors = stats.top_sectors || [];
      if (!topSectors.length) {
        sectorsListEl.innerHTML = '<span style="color:var(--gray);font-size:13px;">No roles entered yet.</span>';
      } else {
        sectorsListEl.innerHTML = topSectors.map(function(s) {
          var pct = roleCount > 0 ? Math.round((s.count / roleCount) * 100) : 0;
          return '<div style="display:flex;justify-content:space-between;font-size:15px;">'
            + '<span>' + esc(s.name) + '</span>'
            + '<strong style="color:var(--navy);">' + pct + '%</strong></div>';
        }).join('');
      }
    }

    // University list
    var unisListEl = document.getElementById('cycle-unis-list');
    if (unisListEl) {
      var topUnis = stats.top_universities || [];
      if (!topUnis.length) {
        unisListEl.innerHTML = '<span style="color:var(--gray);font-size:13px;">No students joined yet.</span>';
      } else {
        unisListEl.innerHTML = topUnis.map(function(u) {
          return '<div style="display:flex;justify-content:space-between;font-size:15px;">'
            + '<span>' + esc(u.name) + '</span>'
            + '<strong style="color:var(--navy);">' + u.count + '</strong></div>';
        }).join('');
      }
    }

    // Cycle health grade
    var gradeEl = document.getElementById('cycle-health-grade');
    var textEl  = document.getElementById('cycle-health-text');
    if (gradeEl && textEl) {
      var grade, color, text;
      if (students === 0 && companies === 0) {
        grade = '—'; color = 'var(--gray)'; text = 'No participants yet. Join to get the cycle going.';
      } else if (students === 0) {
        grade = 'D'; color = '#dc2626'; text = 'No students in the pool yet — spread the word.';
      } else if (companies === 0 || roleCount === 0) {
        grade = 'D'; color = '#dc2626'; text = 'No company roles entered yet — invite employers to join.';
      } else {
        var ratio = students / roleCount;
        if (ratio >= 3)        { grade = 'A'; color = 'var(--success)'; text = 'Strong student-to-role ratio. A healthy, competitive pool.'; }
        else if (ratio >= 1.5) { grade = 'B'; color = '#2e7d52';       text = 'Good balance between students and roles. Looking solid.'; }
        else if (ratio >= 0.8) { grade = 'C'; color = '#b45309';       text = 'Roles slightly outnumber students — more students would improve matching.'; }
        else                   { grade = 'D'; color = '#dc2626';        text = 'Too few students for the roles posted. Need more participants.'; }
      }
      gradeEl.textContent = grade; gradeEl.style.color = color;
      textEl.textContent  = text;
    }

  } catch(e) {
    console.warn('_loadCycleStats error:', e.message);
  }
}

// ─── CYCLE PARTICIPATION ─────────────────────────────────────────────────────
// Handles join / withdraw / role-selection for both student and company profiles.
// Relies on: db (cycles.js), currentStudent (cycles-profile.js),
//            currentCompany (cycles-company-profile.js), showToast, esc.

var _activeCycle          = null;
var _studentIsParticipant = false;
var _companyIsParticipant = false;
var _companyEnteredRoles  = new Set();
var _companyJobs          = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function _fmtCycleDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function _cycleStatusLabel(status) {
  return { scheduled:'Scheduled', open:'Open — join now', locked:'Pool locked',
           clearing:'Clearing', revealed:'Matches revealed', closed:'Closed' }[status] || status;
}

function _cycleStatusColor(status) {
  if (status === 'open')                      return '#2e7d52';
  if (status === 'revealed')                  return 'var(--orange)';
  if (status === 'scheduled')                 return '#1565c0';
  if (status === 'locked' || status === 'clearing') return '#b45309';
  return '#888';
}

function _cycleCanJoin(status) {
  return status === 'scheduled' || status === 'open';
}

// ─── STUDENT PROFILE COMPLETENESS CHECK ──────────────────────────────────────
function _getMissingStudentFields(s) {
  if (!s) return ['Profile not loaded'];
  var totalSkills = ((s.skills_technical||[]).length + (s.skills_professional||[]).length + (s.skills_languages||[]).length);
  var missing = [];
  if (!s.name)          missing.push('Name');
  if (!s.current_status) missing.push('Current status (Bachelor / Master / Graduate)');
  if (!s.field_of_study) missing.push('Field of study');
  if (!s.work_auth)      missing.push('Work authorisation');
  if (!s.pref_type)      missing.push('What you\'re looking for (internship / job / graduate)');
  if (!s.pref_locations) missing.push('Preferred location');
  if (!s.pref_sectors)   missing.push('Preferred sectors');
  if (!s.education || !s.education.length) missing.push('At least 1 education entry');
  if (totalSkills < 3)   missing.push('At least 3 skills (have ' + totalSkills + ')');
  return missing;
}

function _isStudentComplete(s) {
  return _getMissingStudentFields(s).length === 0;
}

// ─── STUDENT ─────────────────────────────────────────────────────────────────
async function loadStudentCycleSection() {
  var section = document.getElementById('student-cycle-section');
  if (!section || !currentStudent) return;

  try {
    var { data: cycle, error } = await db
      .from('cycles')
      .select('*')
      .not('status', 'eq', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !cycle) { section.style.display = 'none'; return; }
    _activeCycle = cycle;

    var { data: part } = await db
      .from('cycle_participants')
      .select('id')
      .eq('cycle_id', cycle.id)
      .eq('user_id', currentStudent.id)
      .maybeSingle();

    _studentIsParticipant = !!part;
    section.style.display = '';
    _renderStudentCycleCard();
  } catch(e) {
    section.style.display = 'none';
  }
}

function _renderStudentCycleCard() {
  var el = document.getElementById('student-cycle-content');
  if (!el || !_activeCycle) return;
  var c   = _activeCycle;
  var can = _cycleCanJoin(c.status);

  el.innerHTML =
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;">'
    + '<div>'
    +   '<div style="font-size:19px;font-weight:700;color:var(--navy);font-family:\'Playfair Display\',serif;margin-bottom:6px;">' + esc(c.name) + '</div>'
    +   '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--text-light);">'
    +     (c.opens_at  ? '<span>📅 Opens '  + _fmtCycleDate(c.opens_at)  + '</span>' : '')
    +     (c.locks_at  ? '<span>🔒 Locks '  + _fmtCycleDate(c.locks_at)  + '</span>' : '')
    +     (c.reveal_at ? '<span>🎉 Reveal ' + _fmtCycleDate(c.reveal_at) + '</span>' : '')
    +   '</div>'
    + '</div>'
    + '<span style="display:inline-block;padding:4px 14px;border-radius:100px;font-size:12px;font-weight:700;color:white;background:' + _cycleStatusColor(c.status) + ';">'
    +   _cycleStatusLabel(c.status)
    + '</span>'
    + '</div>'
    + '<div>'
    + (_studentIsParticipant
        ? '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">'
          + '<span style="display:inline-flex;align-items:center;gap:6px;font-size:15px;font-weight:700;color:#2e7d52;">✓ You\'re in the pool</span>'
          + (can
              ? '<button onclick="_withdrawFromCycle(\'student\')" style="background:none;border:none;font-size:13px;color:var(--gray);cursor:pointer;text-decoration:underline;font-family:\'DM Sans\',sans-serif;padding:0;">Withdraw</button>'
              : '')
          + '</div>'
        : (can
            ? (_isStudentComplete(currentStudent)
                ? '<button id="student-join-btn" class="btn btn-primary" style="padding:10px 28px;font-size:14px;" onclick="_joinCycle(\'student\')">Join ' + esc(c.name) + ' →</button>'
                  + '<p style="font-size:12px;color:var(--gray);margin:8px 0 0;">Your profile is your application — no CV needed, just join the pool.</p>'
                : '<div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:10px;padding:14px 16px;">'
                  + '<div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:8px;">Complete your profile to join</div>'
                  + '<ul style="margin:0;padding-left:18px;font-size:13px;color:var(--text);line-height:1.8;">'
                  + _getMissingStudentFields(currentStudent).map(function(f){ return '<li>' + esc(f) + '</li>'; }).join('')
                  + '</ul>'
                  + '<p style="font-size:12px;color:var(--gray);margin:10px 0 0;">Fill in the sections above, then come back to join.</p>'
                  + '</div>'
              )
            : '<p style="font-size:14px;color:var(--text-light);margin:0;">'
              + (c.status === 'locked' || c.status === 'clearing'
                  ? 'The pool is locked — registration is closed for this cycle.'
                  : 'Matches have been revealed. Check back when the next cycle opens.')
              + '</p>'
          )
      )
    + '</div>';
}

// ─── COMPANY ─────────────────────────────────────────────────────────────────
async function loadCompanyCycleSection() {
  var section = document.getElementById('company-cycle-section');
  if (!section || !currentCompany) return;

  try {
    var { data: cycle, error } = await db
      .from('cycles')
      .select('*')
      .not('status', 'eq', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !cycle) { section.style.display = 'none'; return; }
    _activeCycle = cycle;

    var { data: part } = await db
      .from('cycle_participants')
      .select('id')
      .eq('cycle_id', cycle.id)
      .eq('user_id', currentCompany.id)
      .maybeSingle();

    _companyIsParticipant = !!part;

    // Load company's active jobs
    var { data: jobs } = await db
      .from('jobs')
      .select('id, title, job_type, employment_type, location')
      .eq('employer_id', currentCompany.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    _companyJobs = jobs || [];

    // Load already-entered roles if participating
    _companyEnteredRoles.clear();
    if (_companyIsParticipant) {
      var { data: roles } = await db
        .from('cycle_roles')
        .select('job_id')
        .eq('cycle_id', cycle.id)
        .eq('employer_id', currentCompany.id);
      (roles || []).forEach(function(r) { _companyEnteredRoles.add(r.job_id); });
    }

    section.style.display = '';
    _renderCompanyCycleCard();
  } catch(e) {
    section.style.display = 'none';
  }
}

function _renderCompanyCycleCard() {
  var el = document.getElementById('company-cycle-content');
  if (!el || !_activeCycle) return;
  var c   = _activeCycle;
  var can = _cycleCanJoin(c.status);

  var header =
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;">'
    + '<div>'
    +   '<div style="font-size:19px;font-weight:700;color:var(--navy);font-family:\'Playfair Display\',serif;margin-bottom:6px;">' + esc(c.name) + '</div>'
    +   '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--text-light);">'
    +     (c.opens_at  ? '<span>📅 Opens '  + _fmtCycleDate(c.opens_at)  + '</span>' : '')
    +     (c.locks_at  ? '<span>🔒 Locks '  + _fmtCycleDate(c.locks_at)  + '</span>' : '')
    +     (c.reveal_at ? '<span>🎉 Reveal ' + _fmtCycleDate(c.reveal_at) + '</span>' : '')
    +   '</div>'
    + '</div>'
    + '<span style="display:inline-block;padding:4px 14px;border-radius:100px;font-size:12px;font-weight:700;color:white;background:' + _cycleStatusColor(c.status) + ';">'
    +   _cycleStatusLabel(c.status)
    + '</span>'
    + '</div>';

  var body = '';
  if (_companyIsParticipant) {
    body +=
      '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px;">'
      + '<span style="display:inline-flex;align-items:center;gap:6px;font-size:15px;font-weight:700;color:#2e7d52;">✓ Your company is in the pool</span>'
      + (can
          ? '<button onclick="_withdrawFromCycle(\'company\')" style="background:none;border:none;font-size:13px;color:var(--gray);cursor:pointer;text-decoration:underline;font-family:\'DM Sans\',sans-serif;padding:0;">Withdraw</button>'
          : '')
      + '</div>';

    if (can) {
      var count = _companyEnteredRoles.size;
      body +=
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap;">'
        + '<div style="font-size:14px;font-weight:600;color:var(--navy);">'
        + 'Select which roles to enter into this cycle '
        + '<span style="font-weight:400;color:var(--gray);font-size:13px;">(' + count + ' of ' + _companyJobs.length + ' entered)</span>'
        + '</div>'
        + '<button onclick="openCyclesPostModal()" class="btn btn-primary" style="padding:8px 18px;font-size:13px;white-space:nowrap;">+ Post new listing</button>'
        + '</div>'
        + '<div id="company-jobs-list">' + _buildJobsList() + '</div>';
    }
  } else if (can) {
    if (_companyJobs.length === 0) {
      body +=
        '<div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:10px;padding:14px 16px;">'
        + '<div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:6px;">You need at least one active listing to join</div>'
        + '<p style="font-size:13px;color:var(--text);margin:0 0 12px;line-height:1.6;">Companies must have at least one active job posted before entering the cycle — your listing is what students get matched to.</p>'
        + '<button onclick="openCyclesPostModal()" class="btn btn-primary" style="padding:9px 20px;font-size:13px;">+ Post your first listing</button>'
        + '</div>';
    } else {
      body +=
        '<button id="company-join-btn" class="btn btn-primary" style="padding:10px 28px;font-size:14px;" onclick="_joinCycle(\'company\')">Join ' + esc(c.name) + ' →</button>'
        + '<p style="font-size:12px;color:var(--gray);margin:8px 0 0;">Join the pool, then select which of your active roles to enter into the cycle.</p>';
    }
  } else {
    body +=
      '<p style="font-size:14px;color:var(--text-light);margin:0;">'
      + (c.status === 'locked' || c.status === 'clearing'
          ? 'The pool is locked — registration is closed for this cycle.'
          : 'Matches have been revealed. Check back when the next cycle opens.')
      + '</p>';
  }

  el.innerHTML = header + '<div>' + body + '</div>';
}

function _buildJobsList() {
  if (_companyJobs.length === 0) {
    return '<p style="font-size:13px;color:var(--gray);margin:0;">No active job listings. '
      + '<a href="../rookies.html" style="color:var(--orange);font-weight:600;">Add a role in Rookies →</a></p>';
  }
  return _companyJobs.map(function(job) {
    var entered = _companyEnteredRoles.has(job.id);
    var safeId  = 'rtoggle-' + job.id.replace(/-/g, '');
    var meta    = [job.job_type, job.employment_type, job.location].filter(Boolean).join(' · ');
    return '<label style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:8px;'
      + 'border:1.5px solid ' + (entered ? 'var(--orange)' : 'var(--border)') + ';'
      + 'margin-bottom:8px;cursor:pointer;'
      + 'background:' + (entered ? '#fff8f5' : 'white') + ';transition:border-color 0.15s,background 0.15s;">'
      + '<input type="checkbox" id="' + safeId + '" ' + (entered ? 'checked' : '') + ' '
      +   'onchange="toggleCycleRole(\'' + job.id + '\',\'' + esc(job.title).replace(/'/g, "\\'") + '\')" '
      +   'style="width:16px;height:16px;accent-color:var(--orange);cursor:pointer;flex-shrink:0;">'
      + '<div style="flex:1;min-width:0;">'
      +   '<div style="font-size:14px;font-weight:600;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(job.title) + '</div>'
      +   (meta ? '<div style="font-size:12px;color:var(--gray);margin-top:2px;">' + esc(meta) + '</div>' : '')
      + '</div>'
      + (entered ? '<span style="font-size:11px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:0.5px;flex-shrink:0;">In cycle</span>' : '')
      + '</label>';
  }).join('');
}

// ─── JOIN / WITHDRAW ──────────────────────────────────────────────────────────
async function _joinCycle(role) {
  if (!db || !_activeCycle) return;
  var userId = role === 'student' ? (currentStudent && currentStudent.id) : (currentCompany && currentCompany.id);
  if (!userId) return;

  // Completeness gate for students
  if (role === 'student' && !_isStudentComplete(currentStudent)) {
    _renderStudentCycleCard();
    return;
  }

  // Job listing gate for companies
  if (role === 'company' && _companyJobs.length === 0) {
    _renderCompanyCycleCard();
    return;
  }

  var btn = document.getElementById(role === 'student' ? 'student-join-btn' : 'company-join-btn');
  if (btn) { btn.textContent = 'Joining…'; btn.disabled = true; }

  try {
    var { error } = await db.from('cycle_participants').insert([{
      cycle_id: _activeCycle.id,
      user_id:  userId,
      role:     role
    }]);
    if (error) throw error;

    if (role === 'student') {
      _studentIsParticipant = true;
      _renderStudentCycleCard();
    } else {
      _companyIsParticipant = true;
      _renderCompanyCycleCard();
    }
    showToast('You\'re in the pool for ' + _activeCycle.name + '!');
    // Update landing page stats and remove blur immediately
    if (typeof _checkLandingGate === 'function') _checkLandingGate();
  } catch(e) {
    var msg = e.message || 'Please try again.';
    if (msg.includes('duplicate') || msg.includes('unique')) msg = 'You\'re already in this cycle.';
    showToast('Could not join: ' + msg, 'error');
    if (btn) { btn.textContent = 'Join ' + esc(_activeCycle.name) + ' →'; btn.disabled = false; }
  }
}

async function _withdrawFromCycle(role) {
  if (!db || !_activeCycle) return;
  var userId = role === 'student' ? (currentStudent && currentStudent.id) : (currentCompany && currentCompany.id);
  if (!userId) return;

  try {
    var { error } = await db.from('cycle_participants')
      .delete()
      .eq('cycle_id', _activeCycle.id)
      .eq('user_id', userId);
    if (error) throw error;

    if (role === 'student') {
      _studentIsParticipant = false;
      _renderStudentCycleCard();
    } else {
      _companyIsParticipant = false;
      _companyEnteredRoles.clear();
      _renderCompanyCycleCard();
    }
    showToast('Withdrawn from ' + _activeCycle.name + '.');
  } catch(e) {
    showToast('Could not withdraw: ' + (e.message || 'Please try again.'), 'error');
  }
}

// ─── TOGGLE ROLE INTO CYCLE ───────────────────────────────────────────────────
async function toggleCycleRole(jobId, jobTitle) {
  if (!db || !_activeCycle || !currentCompany) return;
  var entering = !_companyEnteredRoles.has(jobId);

  try {
    if (entering) {
      var { error } = await db.from('cycle_roles').insert([{
        cycle_id:    _activeCycle.id,
        job_id:      jobId,
        employer_id: currentCompany.id
      }]);
      if (error) throw error;
      _companyEnteredRoles.add(jobId);
      showToast('"' + jobTitle + '" entered into the cycle.');
    } else {
      var { error } = await db.from('cycle_roles')
        .delete()
        .eq('cycle_id', _activeCycle.id)
        .eq('job_id', jobId)
        .eq('employer_id', currentCompany.id);
      if (error) throw error;
      _companyEnteredRoles.delete(jobId);
      showToast('"' + jobTitle + '" removed from the cycle.');
    }
    // Re-render just the jobs list (keeps scroll position)
    var listEl = document.getElementById('company-jobs-list');
    if (listEl) listEl.innerHTML = _buildJobsList();
    // Update the count label
    var countEl = document.querySelector('#company-cycle-content .count-label');
    if (countEl) countEl.textContent = '(' + _companyEnteredRoles.size + ' of ' + _companyJobs.length + ' entered)';
  } catch(e) {
    showToast('Could not update: ' + (e.message || 'Please try again.'), 'error');
    // Revert checkbox
    var safeId = 'rtoggle-' + jobId.replace(/-/g, '');
    var cb = document.getElementById(safeId);
    if (cb) cb.checked = !entering;
  }
}
