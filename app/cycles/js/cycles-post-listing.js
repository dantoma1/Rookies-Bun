// ─── POST LISTING (Cycles) ────────────────────────────────────────────────────
// Full port of the Rookies post-listing modal, adapted for the Cycles context.
// Uses: db (cycles.js), currentCompany (cycles-company-profile.js),
//       _companyJobs, _companyEnteredRoles, _activeCycle (cycles-participation.js),
//       showToast (cycles-profile.js)

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchCyclesListingTab(tab) {
  ['basics','details','prefs','messages'].forEach(function(t) {
    var btn   = document.getElementById('cpost-tab-' + t);
    var panel = document.getElementById('cpost-panel-' + t);
    if (btn)   btn.classList.toggle('active', t === tab);
    if (panel) panel.style.display = (t === tab) ? 'block' : 'none';
  });
}

// ─── Open / close ─────────────────────────────────────────────────────────────
function openCyclesPostModal() {
  // Reset form
  document.getElementById('cycles-post-listing-form').style.display = 'flex';
  document.getElementById('cycles-post-listing-success').style.display = 'none';
  switchCyclesListingTab('basics');

  // Clear all text inputs
  ['cpost-title','cpost-ats','cpost-division','cpost-description','cpost-role-group',
   'cpost-pay','cpost-qualifications','cpost-gpa-min','cpost-hiring-team',
   'cpost-skill-tech-input','cpost-skill-prof-input','cpost-skill-lang-input',
   'cpost-majors-other','cpost-field-other','cpost-location-other',
   'cpost-msg-invite','cpost-msg-accepted','cpost-msg-shortlisted','cpost-msg-rejected'
  ].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });

  // Clear tag containers
  ['cpost-skill-tech-tags','cpost-skill-prof-tags','cpost-skill-lang-tags',
   'cpost-field-custom-tags','cpost-location-custom-tags','cpost-majors-custom-tags'
  ].forEach(function(id) { var el = document.getElementById(id); if (el) el.innerHTML = ''; });

  // Reset chip groups — all off, then set defaults
  ['cpost-app-method','cpost-type-chips','cpost-emp-type','cpost-field-chips',
   'cpost-duration-chips','cpost-location-chips','cpost-work-auth',
   'cpost-school-year','cpost-majors','cpost-dutch-only'
  ].forEach(function(id) {
    var g = document.getElementById(id);
    if (g) g.querySelectorAll('.pref-chip').forEach(function(c) { c.classList.remove('active'); });
  });
  var defaults = {
    'cpost-app-method':   'Apply on platform',
    'cpost-type-chips':   'Internship (stage)',
    'cpost-emp-type':     'Full-time',
    'cpost-dutch-only':   'No'
  };
  Object.keys(defaults).forEach(function(id) {
    var g = document.getElementById(id);
    if (!g) return;
    var c = g.querySelector('[data-val="' + defaults[id] + '"]');
    if (c) c.classList.add('active');
  });

  // Hide conditional wraps
  ['cpost-ats-wrap','cpost-hours-wrap','cpost-field-other-wrap',
   'cpost-location-other-wrap','cpost-majors-other-wrap'
  ].forEach(function(id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; });

  // Reset checkbox
  var cv = document.getElementById('cpost-require-cv'); if (cv) cv.checked = false;

  // Description counter
  var descEl = document.getElementById('cpost-description');
  var counter = document.getElementById('cpost-desc-counter');
  if (descEl && counter) {
    counter.textContent = '0 / 2000';
    descEl.oninput = function() { counter.textContent = descEl.value.length + ' / 2000'; };
  }

  // ATS / hours toggles
  var amGroup = document.getElementById('cpost-app-method');
  if (amGroup) amGroup.addEventListener('click', function(e) {
    var btn = e.target.closest('.pref-chip'); if (!btn) return;
    amGroup.querySelectorAll('.pref-chip').forEach(function(c) { c.classList.remove('active'); });
    btn.classList.add('active');
    var atsWrap = document.getElementById('cpost-ats-wrap');
    if (atsWrap) atsWrap.style.display = btn.dataset.val === 'External (ATS URL)' ? 'block' : 'none';
  });
  var etGroup = document.getElementById('cpost-emp-type');
  if (etGroup) etGroup.addEventListener('click', function(e) {
    var btn = e.target.closest('.pref-chip'); if (!btn) return;
    etGroup.querySelectorAll('.pref-chip').forEach(function(c) { c.classList.remove('active'); });
    btn.classList.add('active');
    var hw = document.getElementById('cpost-hours-wrap');
    if (hw) hw.style.display = btn.dataset.val === 'Part-time' ? 'block' : 'none';
  });
  var fGroup = document.getElementById('cpost-field-chips');
  if (fGroup) fGroup.addEventListener('click', function(e) {
    var btn = e.target.closest('.pref-chip'); if (!btn) return;
    var fw = document.getElementById('cpost-field-other-wrap');
    if (fw) fw.style.display = btn.dataset.val === 'Other' ? 'block' : 'none';
  });
  var locGroup = document.getElementById('cpost-location-chips');
  if (locGroup) locGroup.addEventListener('click', function(e) {
    var btn = e.target.closest('.pref-chip'); if (!btn) return;
    var lw = document.getElementById('cpost-location-other-wrap');
    if (lw) lw.style.display = btn.dataset.val === 'Other' ? 'block' : 'none';
  });
  var mGroup = document.getElementById('cpost-majors');
  if (mGroup) mGroup.addEventListener('click', function(e) {
    var btn = e.target.closest('.pref-chip'); if (!btn) return;
    var mw = document.getElementById('cpost-majors-other-wrap');
    if (mw) mw.style.display = btn.dataset.val === 'Other' ? 'block' : 'none';
  });

  document.getElementById('cycles-post-listing-modal').classList.add('open');
}

function closeCyclesPostModal() {
  document.getElementById('cycles-post-listing-modal').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', function() {
  var modal = document.getElementById('cycles-post-listing-modal');
  if (modal) modal.addEventListener('click', function(e) { if (e.target === this) closeCyclesPostModal(); });
});

// ─── Skill helpers ────────────────────────────────────────────────────────────
var _cyclesSkillSuggestions = {
  technical:    ['Excel','Python','R','SQL','Java','JavaScript','MATLAB','Tableau','Power BI','Bloomberg','Financial Modelling','Data Analysis','Machine Learning','Statistics','Econometrics','AutoCAD','Figma','Google Analytics'],
  professional: ['Project Management','Agile / Scrum','Leadership','Communication','Marketing','SEO','Content Writing','Social Media','Research','Problem Solving','Negotiation','HubSpot','CRM'],
  languages:    ['Dutch','English','German','French','Spanish','Italian','Mandarin','Arabic','Portuguese','Russian','Japanese']
};
var _cyclesSkillCatMap = { technical: 'tech', professional: 'prof', languages: 'lang' };

function filterCyclesJobSkills(cat, val) {
  var short = _cyclesSkillCatMap[cat];
  var box = document.getElementById('cpost-skill-' + short + '-suggestions');
  if (!box) return;
  if (!val) { box.style.display = 'none'; return; }
  var tagsEl = document.getElementById('cpost-skill-' + short + '-tags');
  var existing = tagsEl ? Array.from(tagsEl.querySelectorAll('.role-tag')).map(function(t) { return t.textContent.replace('\xd7','').trim().toLowerCase(); }) : [];
  var matches = (_cyclesSkillSuggestions[cat] || []).filter(function(s) { return s.toLowerCase().includes(val.toLowerCase()) && !existing.includes(s.toLowerCase()); }).slice(0, 6);
  if (!matches.length) { box.style.display = 'none'; return; }
  box.innerHTML = matches.map(function(m) { return '<div class="skill-suggestion-item" onclick="selectCyclesSkillSuggestion(\'' + cat + '\',\'' + m.replace(/'/g,"\\'") + '\')">' + m + '</div>'; }).join('');
  box.style.display = 'block';
}

function selectCyclesSkillSuggestion(cat, name) {
  var short = _cyclesSkillCatMap[cat];
  var input = document.getElementById('cpost-skill-' + short + '-input');
  if (input) input.value = name;
  var box = document.getElementById('cpost-skill-' + short + '-suggestions');
  if (box) box.style.display = 'none';
  addCyclesJobSkill(cat);
}

function addCyclesJobSkill(cat) {
  var short = _cyclesSkillCatMap[cat];
  var input = document.getElementById('cpost-skill-' + short + '-input');
  var name = input ? input.value.trim() : ''; if (!name) return;
  var tagsEl = document.getElementById('cpost-skill-' + short + '-tags'); if (!tagsEl) return;
  var existing = Array.from(tagsEl.querySelectorAll('.role-tag')).map(function(t) { return t.textContent.replace('\xd7','').trim().toLowerCase(); });
  if (existing.includes(name.toLowerCase())) { if (input) input.value = ''; return; }
  var tag = document.createElement('span'); tag.className = 'role-tag';
  tag.innerHTML = esc(name) + ' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button>';
  tagsEl.appendChild(tag); if (input) input.value = '';
  var box = document.getElementById('cpost-skill-' + short + '-suggestions'); if (box) box.style.display = 'none';
}

function _getCyclesJobSkills() {
  var result = {};
  ['technical','professional','languages'].forEach(function(cat) {
    var short = _cyclesSkillCatMap[cat];
    var tagsEl = document.getElementById('cpost-skill-' + short + '-tags');
    result[cat] = tagsEl ? Array.from(tagsEl.querySelectorAll('.role-tag')).map(function(t) { return t.textContent.replace('\xd7','').trim(); }).filter(Boolean) : [];
  });
  return result;
}

// ─── Location / field / majors helpers ───────────────────────────────────────
function addCyclesCustomJobLocation() {
  var input = document.getElementById('cpost-location-other');
  var name = input.value.trim(); if (!name) return;
  var container = document.getElementById('cpost-location-custom-tags');
  var existing = Array.from(container.querySelectorAll('.role-tag')).map(function(t) { return t.textContent.replace('\xd7','').trim().toLowerCase(); });
  if (existing.includes(name.toLowerCase())) { input.value = ''; return; }
  var tag = document.createElement('span'); tag.className = 'role-tag';
  tag.innerHTML = esc(name) + ' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button>';
  container.appendChild(tag); input.value = '';
}

function addCyclesCustomField() {
  var input = document.getElementById('cpost-field-other');
  var name = input.value.trim(); if (!name) return;
  var container = document.getElementById('cpost-field-custom-tags');
  var existing = Array.from(container.querySelectorAll('.role-tag')).map(function(t) { return t.textContent.replace('\xd7','').trim().toLowerCase(); });
  if (existing.includes(name.toLowerCase())) { input.value = ''; return; }
  var tag = document.createElement('span'); tag.className = 'role-tag';
  tag.innerHTML = esc(name) + ' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button>';
  container.appendChild(tag); input.value = '';
}

function addCyclesCustomMajor() {
  var input = document.getElementById('cpost-majors-other');
  var name = input.value.trim(); if (!name) return;
  var container = document.getElementById('cpost-majors-custom-tags');
  var existing = Array.from(container.querySelectorAll('.role-tag')).map(function(t) { return t.textContent.replace('\xd7','').trim().toLowerCase(); });
  if (existing.includes(name.toLowerCase())) { input.value = ''; return; }
  var tag = document.createElement('span'); tag.className = 'role-tag';
  tag.innerHTML = esc(name) + ' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button>';
  container.appendChild(tag); input.value = '';
}

function _getCyclesFieldValue() {
  var known = Array.from(document.querySelectorAll('#cpost-field-chips .pref-chip.active')).map(function(c) { return c.dataset.val; }).filter(function(v) { return v !== 'Other'; });
  var custom = Array.from(document.querySelectorAll('#cpost-field-custom-tags .role-tag')).map(function(t) { return t.textContent.replace('\xd7','').trim(); }).filter(Boolean);
  return known.concat(custom).join(', ');
}

function _getCyclesJobLocation() {
  var standard = Array.from(document.querySelectorAll('#cpost-location-chips .pref-chip.active')).map(function(c) { return c.dataset.val; }).filter(function(v) { return v !== 'Other'; });
  var custom = Array.from(document.querySelectorAll('#cpost-location-custom-tags .role-tag')).map(function(t) { return t.textContent.replace('\xd7','').trim(); }).filter(Boolean);
  return standard.concat(custom).join(', ');
}

function _getCyclesMajorsValue() {
  var standard = Array.from(document.querySelectorAll('#cpost-majors .pref-chip.active')).map(function(c) { return c.dataset.val; }).filter(function(v) { return v !== 'Other'; });
  var custom = Array.from(document.querySelectorAll('#cpost-majors-custom-tags .role-tag')).map(function(t) { return t.textContent.replace('\xd7','').trim(); }).filter(Boolean);
  return standard.concat(custom).join(', ');
}

function _getChip(id) { var el = document.querySelector('#' + id + ' .pref-chip.active'); return el ? el.dataset.val : ''; }
function _getChips(id) { return Array.from(document.querySelectorAll('#' + id + ' .pref-chip.active')).map(function(e) { return e.dataset.val; }).join(', '); }
function _getVal(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

// ─── Submit ───────────────────────────────────────────────────────────────────
async function submitCyclesListing() {
  if (!db || !currentCompany) return;

  var title = _getVal('cpost-title');
  if (!title) {
    var titleEl = document.getElementById('cpost-title');
    if (titleEl) { titleEl.focus(); titleEl.style.borderColor = 'var(--orange)'; }
    showToast('Please enter a job title.', 'error');
    return;
  }

  var publishBtn = document.querySelector('#cpost-panel-prefs .btn-primary, #cpost-panel-messages .btn-primary');
  if (publishBtn) { publishBtn.textContent = 'Publishing…'; publishBtn.disabled = true; }

  var job = {
    title:            title,
    app_method:       _getChip('cpost-app-method'),
    job_type:         _getChip('cpost-type-chips'),
    employment_type:  _getChip('cpost-emp-type'),
    hours_per_week:   _getVal('cpost-hours-per-week') || null,
    field:            _getCyclesFieldValue(),
    duration:         _getChip('cpost-duration-chips'),
    location:         _getCyclesJobLocation() || 'Netherlands',
    work_auth:        _getChips('cpost-work-auth'),
    start_month:      _getVal('cpost-start-month'),
    start_year:       _getVal('cpost-start-year'),
    deadline_month:   _getVal('cpost-deadline-month'),
    deadline_year:    _getVal('cpost-deadline-year'),
    ats_url:          _getVal('cpost-ats'),
    division:         _getVal('cpost-division'),
    description:      _getVal('cpost-description'),
    role_group:       _getVal('cpost-role-group'),
    num_hires:        parseInt(_getVal('cpost-num-hires')) || 1,
    pay:              _getVal('cpost-pay'),
    required_docs:    document.getElementById('cpost-require-cv').checked ? 'CV / Resume' : '',
    qualifications:   _getVal('cpost-qualifications'),
    grad_from:        _getVal('cpost-grad-from'),
    grad_to:          _getVal('cpost-grad-to'),
    school_year:      _getChips('cpost-school-year'),
    majors:           _getCyclesMajorsValue(),
    gpa_min:          _getVal('cpost-gpa-min'),
    dutch_only:       _getChip('cpost-dutch-only') === 'Yes',
    hiring_team:      _getVal('cpost-hiring-team'),
    msg_invite:       _getVal('cpost-msg-invite') || null,
    msg_accepted:     _getVal('cpost-msg-accepted') || null,
    msg_shortlisted:  _getVal('cpost-msg-shortlisted') || null,
    msg_rejected:     _getVal('cpost-msg-rejected') || null,
    searched_skills:  _getCyclesJobSkills(),
    messaging:        'Enabled',
    is_active:        true,
    employer_id:      currentCompany.id,
    company_name:     currentCompany.company_name
  };

  try {
    var res = await db.from('jobs').insert([job]).select();
    if (res.error) throw res.error;

    var savedJob = res.data && res.data[0];

    // Add to in-memory jobs list so it appears in the cycle role checklist immediately
    if (savedJob && typeof _companyJobs !== 'undefined') {
      _companyJobs.unshift({
        id:              savedJob.id,
        title:           savedJob.title,
        job_type:        savedJob.job_type,
        employment_type: savedJob.employment_type,
        location:        savedJob.location
      });
    }

    // Show success screen
    document.getElementById('cycles-post-listing-form').style.display = 'none';
    document.getElementById('cycles-post-listing-success').style.display = 'flex';
    showToast('Listing published to Rookies!');

    // Refresh jobs list in cycle section
    if (typeof _renderCompanyCycleCard === 'function') _renderCompanyCycleCard();

  } catch(err) {
    showToast('Could not save listing: ' + (err.message || 'Please try again.'), 'error');
    if (publishBtn) { publishBtn.textContent = 'Publish listing →'; publishBtn.disabled = false; }
  }
}
