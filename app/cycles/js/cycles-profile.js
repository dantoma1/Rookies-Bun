// ─── STUDENT PROFILE FOR CYCLES ───────────────────────────────────────────
// Adapts the full Rookies student profile (from app/js/rookies.js) for the
// Cycles standalone page. `currentStudent` is synced from `currentCyclesUserData`
// by `openProfileScreen()` in cycles.js — do NOT re-declare it there.
// `db` is the Supabase client declared as `let db` in cycles.js (shared global scope).
var currentStudent = null;

// ─── XSS ESCAPE ───
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─── TOAST ───
function showToast(message, type) {
  var ex = document.getElementById('rookie-toast'); if (ex) ex.remove();
  var t = document.createElement('div'); t.id = 'rookie-toast';
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:'+(type==='error'?'#c0392b':'#2e7d52')+';color:white;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.2);font-family:"DM Sans",sans-serif;';
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(function(){ if (t.parentNode) t.remove(); }, 3500);
}

// ─── CONFIRM MODAL ───
function showConfirmModal(title, subtitle, body, actionLabel, actionStyle, onConfirm) {
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-subtitle').textContent = subtitle;
  document.getElementById('confirm-modal-body').innerHTML = body || '';
  var btn = document.getElementById('confirm-modal-action-btn');
  btn.textContent = actionLabel;
  var styleClass = (actionStyle === 'primary') ? 'btn-primary'
                 : (actionStyle === 'danger')  ? 'btn-danger'
                 : (actionStyle && actionStyle.indexOf('btn-') === 0) ? actionStyle
                 : 'btn-primary';
  btn.className = 'btn ' + styleClass;
  btn.onclick = function() { var fn = onConfirm; closeConfirmModal(); if (fn) fn(); };
  document.getElementById('confirm-modal').classList.add('open');
}
function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.remove('open');
}

// ─── CHANGE PASSWORD ───
function openChangePasswordModal() {
  showConfirmModal(
    'Change your password', '',
    '<input id="settings-new-pw" class="form-input" type="password" placeholder="New password" style="width:100%;font-size:14px;margin-bottom:8px;" maxlength="128">'
      + '<input id="settings-new-pw2" class="form-input" type="password" placeholder="Confirm new password" style="width:100%;font-size:14px;margin-bottom:12px;" maxlength="128">'
      + '<div style="font-size:12px;color:var(--gray);line-height:1.6;padding:8px 10px;background:#f7f4ef;border-radius:6px;margin-bottom:8px;">'
      +   '<strong style="color:var(--text);display:block;margin-bottom:2px;">Password requirements</strong>'
      +   '<span id="pw-req-length" style="display:block;">&#9679; At least 8 characters</span>'
      +   '<span id="pw-req-lower"  style="display:block;">&#9679; At least one lowercase letter (a–z)</span>'
      +   '<span id="pw-req-upper"  style="display:block;">&#9679; At least one uppercase letter (A–Z)</span>'
      +   '<span id="pw-req-number" style="display:block;">&#9679; At least one number (0–9)</span>'
      + '</div>'
      + '<div id="pw-inline-error" style="display:none;color:#c0392b;font-size:13px;padding:6px 10px;background:#fdf0ee;border-radius:6px;"></div>',
    'Update password', 'primary', null
  );
  var pwInput = document.getElementById('settings-new-pw');
  if (pwInput) pwInput.addEventListener('input', function() {
    var v = this.value;
    var ok = 'display:block;color:#2e7d52;font-weight:600;';
    var no = 'display:block;';
    document.getElementById('pw-req-length').style.cssText = v.length >= 8   ? ok : no;
    document.getElementById('pw-req-lower') .style.cssText = /[a-z]/.test(v) ? ok : no;
    document.getElementById('pw-req-upper') .style.cssText = /[A-Z]/.test(v) ? ok : no;
    document.getElementById('pw-req-number').style.cssText = /[0-9]/.test(v) ? ok : no;
  });
  document.getElementById('confirm-modal-action-btn').onclick = async function() {
    var pw1 = (document.getElementById('settings-new-pw') || {}).value || '';
    var pw2 = (document.getElementById('settings-new-pw2') || {}).value || '';
    var errEl = document.getElementById('pw-inline-error');
    var errors = [];
    if (pw1.length < 8)     errors.push('Password must be at least 8 characters.');
    if (!/[a-z]/.test(pw1)) errors.push('Add at least one lowercase letter (a–z).');
    if (!/[A-Z]/.test(pw1)) errors.push('Add at least one uppercase letter (A–Z).');
    if (!/[0-9]/.test(pw1)) errors.push('Add at least one number (0–9).');
    if (pw1 !== pw2)        errors.push('Passwords do not match.');
    if (errors.length) { errEl.innerHTML = errors.join('<br>'); errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';
    var res = await db.auth.updateUser({ password: pw1 });
    if (res.error) { errEl.textContent = 'Could not update: ' + res.error.message; errEl.style.display = 'block'; }
    else { closeConfirmModal(); showToast('Password updated'); }
  };
}

// ─── CHAR COUNTERS ───
function attachCounterToTextarea(ta, max) {
  var counter = document.createElement('small');
  counter.style.cssText = 'float:right;font-size:11px;color:var(--gray);margin-top:3px;display:block;';
  counter.textContent = (ta.value ? ta.value.length : 0) + ' / ' + max;
  ta.parentNode.insertBefore(counter, ta.nextSibling);
  ta.addEventListener('input', function() {
    var len = ta.value.length;
    counter.textContent = len + ' / ' + max;
    counter.style.color = len >= max * 0.9 ? '#dc2626' : 'var(--gray)';
  });
}
function refreshCharCounters() {
  var bioEl = document.getElementById('edit-basic-bio');
  var bioCounter = document.getElementById('edit-basic-bio-counter');
  if (bioEl && bioCounter) {
    var len = bioEl.value.length;
    bioCounter.textContent = len + ' / 280';
    bioCounter.style.color = len >= 252 ? '#dc2626' : 'var(--gray)';
  }
}

// ─── FIELD ERRORS ───
function _showFieldError(el, msg) {
  var parent = el.parentNode;
  var err = parent.querySelector(':scope > .field-error');
  if (!err) { err = document.createElement('div'); err.className = 'field-error'; parent.appendChild(err); }
  err.textContent = msg; err.classList.add('visible'); el.classList.add('error');
}
function _clearFieldError(el) {
  var parent = el.parentNode;
  var err = parent.querySelector(':scope > .field-error');
  if (err) err.classList.remove('visible');
  el.classList.remove('error');
}
function _scrollToFirstError(container) {
  var first = (container || document).querySelector('.field-error.visible');
  if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ─── HELPERS ───
function _setSelect(sel, val) { if (!sel || val === undefined) return; for (var i=0;i<sel.options.length;i++) { if (sel.options[i].value===val||sel.options[i].text===val) { sel.selectedIndex=i; return; } } }
function _setInput(el, val) { if (el) el.value = val || ''; }

// ─── BULLET DESCRIPTION HELPERS ───
function _addDescBulletRow(listEl, value) {
  var row = document.createElement('div');
  row.className = 'desc-bullet-row';
  row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;';
  var inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'form-input desc-bullet-input';
  inp.placeholder = 'Add a point...'; inp.maxLength = 200; inp.style.flex = '1';
  if (value) inp.value = value;
  var rem = document.createElement('button');
  rem.type = 'button'; rem.className = 'remove-edu-btn'; rem.textContent = '✕';
  rem.style.cssText = 'padding:4px 10px;flex-shrink:0;';
  rem.onclick = function() { if (listEl.querySelectorAll('.desc-bullet-row').length > 1) row.remove(); };
  row.appendChild(inp); row.appendChild(rem); listEl.appendChild(row);
}
function _addDescBulletToEntry(btn) {
  var list = btn.closest('.desc-bullets-wrap').querySelector('.desc-bullets-list');
  if (list.querySelectorAll('.desc-bullet-row').length >= 8) { showToast('Maximum 8 points per entry', 'error'); return; }
  _addDescBulletRow(list, '');
}
function _getDescBullets(entryEl) {
  var bullets = [];
  entryEl.querySelectorAll('.desc-bullet-input').forEach(function(inp) { var v = inp.value.trim(); if (v) bullets.push(v); });
  return bullets;
}
function _populateDescBullets(entryEl, desc) {
  var list = entryEl.querySelector('.desc-bullets-list'); if (!list) return;
  list.innerHTML = '';
  var bullets = Array.isArray(desc) ? desc.filter(Boolean) : (desc && desc.trim ? desc.trim() ? [desc.trim()] : [] : []);
  if (!bullets.length) { _addDescBulletRow(list, ''); return; }
  bullets.forEach(function(b) { _addDescBulletRow(list, b); });
}
function _renderDescBullets(desc) {
  var bullets;
  if (Array.isArray(desc)) { bullets = desc.filter(function(b){ return b && b.trim(); }); }
  else if (desc && desc.trim) { bullets = desc.trim() ? [desc.trim()] : []; }
  else { return ''; }
  if (!bullets.length) return '';
  return '<ul style="margin:5px 0 0 16px;padding:0;font-size:13px;line-height:1.7;">' + bullets.map(function(b){ return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';
}

// ─── UPLOAD AVATAR ───
async function uploadAvatar(input) {
  var file = input.files[0];
  if (!file || !currentStudent) return;
  if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB', 'error'); return; }
  var allowedTypes = ['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
  if (!allowedTypes.includes(file.type)) { showToast('Please use JPG, PNG or WebP format', 'error'); return; }
  showToast('Uploading photo…');
  var ext = file.name.split('.').pop();
  var path = currentStudent.id + '/avatar.' + ext;
  var uploadRes = await db.storage.from('avatars').upload(path, file, { upsert: true });
  if (uploadRes.error) { showToast('Upload failed: ' + uploadRes.error.message, 'error'); return; }
  var urlRes = db.storage.from('avatars').getPublicUrl(path);
  var url = urlRes.data.publicUrl;
  await db.from('students').update({ avatar_url: url }).eq('id', currentStudent.id);
  currentStudent.avatar_url = url;
  var av = document.getElementById('profile-avatar');
  if (av) { av.innerHTML = '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'; av.style.background = 'transparent'; }
  var navAv = document.getElementById('nav-avatar');
  if (navAv) navAv.style.backgroundImage = 'url(' + esc(url) + ')';
  showToast('Photo updated ✓');
  input.value = '';
}

// ─── UPLOAD CV ───
async function uploadCV(input) {
  var file = input.files[0];
  if (!file || !currentStudent) return;
  if (file.size > 10 * 1024 * 1024) { showToast('CV must be under 10MB', 'error'); return; }
  if (file.type !== 'application/pdf') { showToast('Please upload a PDF file', 'error'); return; }
  var statusEl = document.getElementById('cv-upload-status');
  var box = document.getElementById('cv-upload-box');
  if (statusEl) { statusEl.style.display = 'block'; statusEl.style.color = 'var(--gray)'; statusEl.textContent = 'Uploading…'; }
  var path = currentStudent.id + '/cv.pdf';
  var uploadRes = await db.storage.from('cvs').upload(path, file, { upsert: true, contentType: 'application/pdf' });
  if (uploadRes.error) { showToast('Upload failed: ' + uploadRes.error.message, 'error'); if (statusEl) statusEl.textContent = 'Upload failed.'; return; }
  var urlRes = db.storage.from('cvs').getPublicUrl(path);
  var url = urlRes.data.publicUrl;
  await db.from('students').update({ cv_url: url }).eq('id', currentStudent.id);
  currentStudent.cv_url = url;
  if (box) box.innerHTML = '<span style="font-size:20px;">📄</span><div style="font-size:13px;color:var(--navy);font-weight:600;">' + esc(file.name) + '<br><span style="font-size:11px;color:var(--gray);font-weight:400;">Uploaded successfully</span></div>';
  if (statusEl) statusEl.style.display = 'none';
  var cvReadEl = document.getElementById('cv-read-link');
  if (cvReadEl) cvReadEl.innerHTML = '<a href="' + esc(url) + '" target="_blank" style="color:var(--navy);text-decoration:underline;">View CV →</a>';
  showToast('CV uploaded ✓');
  input.value = '';
}

// ─── LOAD STUDENT PROFILE ───
async function loadStudentProfile() {
  var layout = document.getElementById('real-profile-layout');
  if (!currentStudent) { if (layout) layout.style.display = 'none'; return; }
  if (layout) layout.style.display = '';

  var s = currentStudent;

  var nl2br = function(str) {
    if (!str) return '—';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  };
  var setText = function(id, val) { var el = document.getElementById(id); if (el) el.innerHTML = nl2br(val); };

  // Header
  var av = document.getElementById('profile-avatar');
  if (av) {
    if (s.avatar_url) {
      av.innerHTML = '<img src="' + esc(s.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
      av.style.background = 'transparent';
    } else {
      av.textContent = s.initial || (s.name ? s.name.charAt(0).toUpperCase() : '?');
      av.style.background = s.color || 'var(--navy)';
    }
  }
  setText('profile-header-name', s.name);
  var subParts = [s.university, s.degree, s.avail ? 'Available ' + s.avail : null].filter(Boolean);
  setText('profile-header-sub', subParts.join(' · '));
  setText('profile-header-uni', s.university || '');

  // Basic info read view
  setText('profile-name', s.name);
  db.auth.getSession().then(function(sessRes) {
    var em = sessRes.data && sessRes.data.session ? sessRes.data.session.user.email : '—';
    var emailEl = document.getElementById('profile-email');
    if (emailEl) emailEl.innerHTML = nl2br(em || '—');
  }).catch(function(){});
  setText('profile-work-auth', s.work_auth || '—');
  setText('profile-location', s.location || '—');
  setText('profile-field-of-study', s.field_of_study || '—');
  var csDisplay = [s.current_status, s.current_status_year].filter(Boolean).join(' — ');
  setText('profile-current-status', csDisplay || '—');
  setText('profile-status', s.seeking_status || '—');

  var bioEl = document.getElementById('profile-bio');
  if (bioEl) bioEl.innerHTML = nl2br(s.bio);

  var linkedinEl = document.getElementById('profile-linkedin');
  if (linkedinEl) linkedinEl.textContent = s.linkedin || '—';

  var _nl2br = function(str) { return str ? str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>') : ''; };

  // ── Structured entries ──
  function renderEduEntries(entries) {
    if (!entries || !entries.length) return '<p style="font-size:13px;color:var(--gray);">None listed yet.</p>';
    return entries.map(function(e) {
      var endText = e.stillStudying ? 'Present' : ((e.endMonth||'')+(e.endYear?' '+e.endYear:'')).trim();
      return '<div class="edu-entry-display">'
        +'<div class="edu-entry-header"><strong>'+(e.field||e.uni||'Education')+'</strong>'
        +'<span class="edu-period">'+(e.startMonth+' '+e.startYear).trim()+(endText?' — '+endText:'')+'</span></div>'
        +'<div class="edu-entry-sub">'+(e.uni||'')+(e.level?' · '+e.level:'')+(e.gpa?' · GPA '+e.gpa:'')+'</div>'
        +(e.desc&&(Array.isArray(e.desc)?e.desc.length:e.desc)?'<div class="edu-entry-desc">'+_renderDescBullets(e.desc)+'</div>':'')+'</div>';
    }).join('');
  }
  function renderExpEntries(entries) {
    if (!entries || !entries.length) return '<p style="font-size:13px;color:var(--gray);">None listed yet.</p>';
    return entries.map(function(e) {
      var period=(e.startMonth+' '+e.startYear).trim()+(e.stillWorking?' — Present':((e.endMonth||e.endYear)?' — '+(e.endMonth+' '+e.endYear).trim():''));
      return '<div class="edu-entry-display">'
        +'<div class="edu-entry-header"><strong>'+(e.role||'Role')+'</strong><span class="edu-period">'+period+'</span></div>'
        +'<div class="edu-entry-sub">'+(e.company||'')+(e.location?' · '+e.location:'')+'</div>'
        +(e.desc&&(Array.isArray(e.desc)?e.desc.length:e.desc)?'<div class="edu-entry-desc">'+_renderDescBullets(e.desc)+'</div>':'')+'</div>';
    }).join('');
  }
  function renderOrgsEntries(entries) {
    if (!entries || !entries.length) return '<p style="font-size:13px;color:var(--gray);">None listed yet.</p>';
    return entries.map(function(e) {
      var period=(e.startMonth+' '+e.startYear).trim()+(e.stillMember?' — Present':((e.endMonth||e.endYear)?' — '+(e.endMonth+' '+e.endYear).trim():''));
      return '<div class="edu-entry-display">'
        +'<div class="edu-entry-header"><strong>'+(e.role||'Member')+'</strong><span class="edu-period">'+period+'</span></div>'
        +'<div class="edu-entry-sub">'+(e.org||'')+'</div>'
        +(e.desc&&(Array.isArray(e.desc)?e.desc.length:e.desc)?'<div class="edu-entry-desc">'+_renderDescBullets(e.desc)+'</div>':'')+'</div>';
    }).join('');
  }

  var eduEntries = s.education && s.education.length ? s.education : [];
  currentStudent._eduEntries = eduEntries;
  var eduEl = document.getElementById('profile-edu-entries');
  if (eduEl) eduEl.innerHTML = renderEduEntries(eduEntries);

  var expEntries = s.experience && s.experience.length ? s.experience : [];
  currentStudent._expEntries = expEntries;
  var expEl = document.getElementById('profile-exp-entries');
  if (expEl) expEl.innerHTML = renderExpEntries(expEntries);

  var orgsEntries = s.organisations && s.organisations.length ? s.organisations : [];
  currentStudent._orgsEntries = orgsEntries;
  var orgsReadEl = document.getElementById('orgs-read-view');
  if (orgsReadEl) orgsReadEl.innerHTML = renderOrgsEntries(orgsEntries);

  // Skills
  function _normalizeSkills(arr) {
    return (arr || []).map(function(item) {
      if (typeof item === 'string') {
        try { var p = JSON.parse(item); if (p && typeof p === 'object' && p.name) return p; } catch(e) {}
        return {name: item, source: '', proof: ''};
      }
      return item;
    });
  }
  skillsDB.technical    = _normalizeSkills(s.skills_technical);
  skillsDB.professional = _normalizeSkills(s.skills_professional);
  skillsDB.languages    = _normalizeSkills(s.skills_languages);
  try { if (typeof renderReadView === 'function') renderReadView(); } catch(e) {}

  var _normArr = function(val) { if (!val) return []; if (Array.isArray(val)) return val; try { return JSON.parse(val); } catch(ex) { return []; } };
  var coursesEl = document.getElementById('read-courses');
  if (coursesEl) {
    var cs = _normArr(s.skills_courses);
    coursesEl.innerHTML = cs.length ? cs.map(function(c){return '<div class="skill-item-read"><span class="skill-tag">'+esc(c.name||'')+'</span>'+(c.code?'<span class="skill-source">'+esc(c.code)+'</span>':'')+'</div>';}).join('') : '<span style="font-size:13px;color:var(--gray);">None added yet.</span>';
  }
  var projectsEl = document.getElementById('read-projects');
  if (projectsEl) {
    var ps = _normArr(s.skills_projects);
    projectsEl.innerHTML = ps.length ? ps.map(function(p){return '<div class="edu-entry-display" style="margin-bottom:8px;"><strong>'+esc(p.name||'')+'</strong>'+(p.desc?'<div style="font-size:12px;color:var(--text-light);margin-top:2px;">'+esc(p.desc)+'</div>':'')+'</div>';}).join('') : '<span style="font-size:13px;color:var(--gray);">None added yet.</span>';
  }

  // Preferences read
  var _norm = function(val) {
    if (!val) return '';
    if (Array.isArray(val)) return val.join(', ');
    var sv = String(val).trim();
    if (sv.charAt(0) === '{' && sv.charAt(sv.length-1) === '}') {
      sv = sv.slice(1,-1);
      var parts = sv.match(/("([^"]*)")|([^,]+)/g);
      return parts ? parts.map(function(m){ return m.replace(/^"|"$/g,'').trim(); }).filter(Boolean).join(', ') : '';
    }
    return sv;
  };
  currentStudent._prefs = {
    type:         _norm(s.pref_type),
    empType:      _norm(s.pref_emp_type),
    hoursPerWeek: s.hours_per_week || '',
    duration:     _norm(s.pref_duration),
    sectors:   _norm(s.pref_sectors),
    locations: _norm(s.pref_locations),
    month:     s.avail_month    || '',
    year:      s.avail_year     || '',
    roles:     s.role_interests || [],
    dutchOnly: !!s.pref_dutch_only
  };
  var _normPref = function(val) {
    if (!val) return '—';
    if (Array.isArray(val)) return val.join(', ') || '—';
    var sv = String(val).trim();
    if (sv.charAt(0) === '{' && sv.charAt(sv.length-1) === '}') {
      sv = sv.slice(1,-1);
      var parts = sv.match(/("([^"]*)")|([^,]+)/g);
      if (!parts) return '—';
      return parts.map(function(m){ return m.replace(/^"|"$/g,'').trim(); }).filter(Boolean).join(', ') || '—';
    }
    return sv || '—';
  };
  var setRead = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = _normPref(val); };
  setRead('pref-read-type',     s.pref_type);
  setRead('pref-read-emp-type', s.pref_emp_type);
  setRead('pref-read-start',    [(s.avail_month||''),(s.avail_year||'')].filter(Boolean).join(' ') || '—');
  setRead('pref-read-duration', s.pref_duration);
  setRead('pref-read-sectors',  s.pref_sectors);
  setRead('pref-read-location', s.pref_locations);
  var rolesReadEl = document.getElementById('pref-read-roles');
  if (rolesReadEl) rolesReadEl.textContent = (s.role_interests||[]).join(', ') || '—';
  var dutchReadEl = document.getElementById('pref-read-dutch-only');
  if (dutchReadEl) dutchReadEl.textContent = s.pref_dutch_only ? 'Yes' : 'No';

  // Documents read
  var visEl = document.getElementById('profile-visibility-status');
  if (visEl) {
    var _vis = s.visibility;
    if (_vis === 'Community' || _vis === 'Employers only') _vis = 'Public';
    visEl.textContent = _vis === 'Public' ? 'Public — visible to companies'
                      : _vis === 'Private' ? 'Private — only you can see'
                      : 'Not set';
  }
  var cvStatus = document.getElementById('profile-cv-status');
  var cvLink = document.getElementById('cv-read-link');
  if (s.cv_url) {
    if (cvStatus) cvStatus.textContent = '';
    if (cvLink) cvLink.innerHTML = '<a href="' + esc(s.cv_url) + '" target="_blank" style="color:var(--navy);font-weight:600;text-decoration:underline;">View CV →</a>';
  } else {
    if (cvStatus) cvStatus.textContent = 'Not uploaded';
    if (cvLink) cvLink.innerHTML = '';
  }
  var cvBox = document.getElementById('cv-upload-box');
  if (cvBox && s.cv_url) {
    cvBox.innerHTML = '<span style="font-size:20px;">📄</span><div style="font-size:13px;color:var(--navy);font-weight:600;">CV uploaded<br><span style="font-size:11px;color:var(--gray);font-weight:400;">Click to replace</span></div>';
  }

  // Completeness
  function _setProg(pctId, fillId, pct) {
    var color = pct >= 80 ? 'var(--success)' : pct >= 40 ? 'var(--orange)' : '#e74c3c';
    var pctEl = document.getElementById(pctId); if (pctEl) pctEl.textContent = pct + '%';
    var fillEl = document.getElementById(fillId); if (fillEl) { fillEl.style.width = pct + '%'; fillEl.style.background = color; }
  }
  var basicFields = [s.name, s.current_status, s.field_of_study, s.work_auth];
  var basicScore = Math.round((basicFields.filter(Boolean).length / basicFields.length) * 100);
  var eduScore = (s.education && s.education.length) ? 100 : 0;
  var totalSkills = (s.skills_technical||[]).length + (s.skills_professional||[]).length + (s.skills_languages||[]).length;
  var skillsScore = Math.min(Math.round((totalSkills / 3) * 100), 100);
  var prefsFields = [s.pref_type, s.pref_locations, s.pref_sectors];
  var prefsScore = Math.round((prefsFields.filter(Boolean).length / prefsFields.length) * 100);
  var expScore = (s.experience && s.experience.length) ? 100 : 0;
  var overallScore = Math.round((basicScore * 0.25) + (eduScore * 0.25) + (skillsScore * 0.25) + (prefsScore * 0.25));
  _setProg('prog-overall-pct', 'prog-overall-fill', overallScore);
  _setProg('prog-basic-pct',   'prog-basic-fill',   basicScore);
  _setProg('prog-edu-pct',     'prog-edu-fill',     eduScore);
  _setProg('prog-skills-pct',  'prog-skills-fill',  skillsScore);
  _setProg('prog-prefs-pct',   'prog-prefs-fill',   prefsScore);
  _setProg('prog-exp-pct',     'prog-exp-fill',     expScore);
  var _eduBadge = document.getElementById('edu-req-badge');
  if (_eduBadge) _eduBadge.style.display = eduScore === 100 ? 'none' : '';
  var _skillsBadge = document.getElementById('skills-req-badge');
  if (_skillsBadge) _skillsBadge.style.display = skillsScore === 100 ? 'none' : '';
  var tipEl = document.getElementById('prog-tip');
  if (tipEl) {
    if (overallScore === 100)    tipEl.textContent = 'Profile complete! Set visibility to Public in Documents to appear in company searches.';
    else if (eduScore === 0)     tipEl.textContent = 'Add at least one education entry to complete your profile.';
    else if (basicScore < 100)   tipEl.textContent = 'Fill in required basic info: name, current status, field of study, work authorisation.';
    else if (prefsScore < 100)   tipEl.textContent = 'Complete your preferences — what you’re looking for, sectors, and preferred location.';
    else if (skillsScore < 100)  tipEl.textContent = 'Add at least 3 skills to complete your profile.';
    else if (expScore === 0)     tipEl.textContent = 'Add past experience to boost your match rate with companies.';
    else                          tipEl.textContent = 'Great profile! Keep it up to date.';
  }
}

// ─── EDUCATION EDIT ───
var eduEntryCount = 1;

function toggleEducationEdit() {
  var r=document.getElementById('edu-read-view'),e=document.getElementById('edu-edit-view'),b=document.getElementById('edu-edit-btn');
  if(e.style.display!=='none'){cancelEducationEdit();return;}
  r.style.display='none';e.style.display='block';b.textContent='Cancel';
  var saved = currentStudent && currentStudent._eduEntries;
  if (saved && saved.length) {
    var c = document.getElementById('edu-entries-container');
    var first = c.querySelector('.edu-entry-form');
    if (first) _populateEduEntry(first, saved[0], 0);
    var existing = c.querySelectorAll('.edu-entry-form').length;
    for (var i = existing; i < saved.length; i++) { addEduEntry(); }
    var all = c.querySelectorAll('.edu-entry-form');
    for (var j = 1; j < saved.length; j++) { _populateEduEntry(all[j], saved[j], j); }
  } else {
    var cb=document.getElementById('still-studying-0'); if(cb) toggleEndDate(cb,'edu-end-group-0');
  }
  document.querySelectorAll('#edu-entries-container .desc-bullets-list').forEach(function(list) {
    if (!list.querySelector('.desc-bullet-row')) _addDescBulletRow(list, '');
  });
}
function _populateEduEntry(el, d, idx) {
  _setSelect(el.querySelector('.edu-university'), d.uni);
  _setSelect(el.querySelector('.edu-degree-level'), d.level);
  var programInput = el.querySelector('.edu-program-name');
  if (programInput) programInput.value = d.field || '';
  var chipsEl = el.querySelector('.edu-field-chips');
  var otherWrap = el.querySelector('.edu-field-other-wrap');
  var otherInput = el.querySelector('.edu-field-other');
  if (chipsEl) {
    var fos = d.fieldOfStudy || '';
    var knownVals = Array.from(chipsEl.querySelectorAll('.pref-chip')).map(function(c){ return c.dataset.val; });
    var isOther = fos && !knownVals.includes(fos);
    chipsEl.querySelectorAll('.pref-chip').forEach(function(c){ c.classList.toggle('active', isOther ? c.dataset.val==='Other' : c.dataset.val===fos); });
    if (otherWrap) otherWrap.style.display = isOther ? 'block' : 'none';
    if (otherInput) otherInput.value = isOther ? fos : '';
    chipsEl.onclick = function(e) {
      var btn = e.target.closest('.pref-chip'); if (!btn) return;
      chipsEl.querySelectorAll('.pref-chip').forEach(function(c){ c.classList.remove('active'); });
      btn.classList.add('active');
      if (otherWrap) otherWrap.style.display = btn.dataset.val==='Other' ? 'block' : 'none';
      if (otherInput && btn.dataset.val!=='Other') otherInput.value = '';
    };
  }
  var minorInput = el.querySelector('.edu-minor');
  var minorChipsEl = el.querySelector('.edu-minor-chips');
  var minorOtherWrap = el.querySelector('.edu-minor-other-wrap');
  if (minorChipsEl) {
    var mn = d.minor || '';
    var knownMinors = Array.from(minorChipsEl.querySelectorAll('.pref-chip')).map(function(c){ return c.dataset.val; });
    var isMinorOther = mn && !knownMinors.includes(mn);
    minorChipsEl.querySelectorAll('.pref-chip').forEach(function(c){ c.classList.toggle('active', isMinorOther ? c.dataset.val==='Other' : c.dataset.val===mn); });
    if (minorOtherWrap) minorOtherWrap.style.display = isMinorOther ? 'block' : 'none';
    if (minorInput) minorInput.value = isMinorOther ? mn : '';
    minorChipsEl.onclick = function(e) {
      var btn = e.target.closest('.pref-chip'); if (!btn) return;
      minorChipsEl.querySelectorAll('.pref-chip').forEach(function(c){ c.classList.remove('active'); });
      btn.classList.add('active');
      if (minorOtherWrap) minorOtherWrap.style.display = btn.dataset.val==='Other' ? 'block' : 'none';
      if (minorInput && btn.dataset.val!=='Other') minorInput.value = '';
    };
  } else if (minorInput) {
    minorInput.value = d.minor || '';
  }
  var selects = el.querySelectorAll('select:not(.edu-university):not(.edu-degree-level)');
  _setSelect(selects[0], d.startMonth); _setSelect(selects[1], d.startYear);
  _setSelect(selects[2], d.endMonth);   _setSelect(selects[3], d.endYear);
  _setSelect(selects[4], d.gradMonth);  _setSelect(selects[5], d.gradYear);
  var gpaInput = el.querySelector('.edu-gpa');
  if (gpaInput) gpaInput.value = d.gpa || '';
  var cb = el.querySelector('input[type="checkbox"]');
  if (cb) { cb.checked = !!d.stillStudying; toggleEndDate(cb, 'edu-end-group-'+idx); }
  _populateDescBullets(el, d.desc);
}
function toggleEndDate(checkbox, groupId) {
  var group = document.getElementById(groupId); if (!group) return;
  group.style.opacity = checkbox.checked ? '0.4' : '1';
  group.style.pointerEvents = checkbox.checked ? 'none' : 'auto';
  var entry = checkbox.closest('.edu-entry-form');
  if (entry) {
    var idx = entry.dataset.index || '0';
    var gradGroup = document.getElementById('edu-grad-group-' + idx);
    if (gradGroup) gradGroup.style.display = checkbox.checked ? 'block' : 'none';
  }
}
function _renumberEduEntries() {
  document.querySelectorAll('#edu-entries-container .edu-entry-label').forEach(function(lbl, i) { lbl.textContent = 'Entry ' + (i + 1); });
}
function addEduEntry() {
  var container=document.getElementById('edu-entries-container');var idx=eduEntryCount++;
  var labelNum=container.querySelectorAll('.edu-entry-form').length+1;
  var endGroupId='edu-end-group-'+idx;var stillStudyingId='still-studying-'+idx;
  var months='Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');var years=['2019','2020','2021','2022','2023','2024','2025','2026','2027'];
  var mo=months.map(function(m){return '<option>'+m+'</option>';}).join('');
  var yr=years.map(function(y){return '<option>'+y+'</option>';}).join('');
  var fieldChips=['Business Administration','Economics','Econometrics','Finance','Accounting','Marketing','Human Resource Management','International Business','Business Analytics','Data Science','Computer Science','Software Engineering','Artificial Intelligence','Information Systems','Law','Psychology','Communication','Sociology','Political Science','Engineering','Other'];
  var chipsHtml=fieldChips.map(function(f){return '<button class="pref-chip" data-val="'+f+'">'+f+'</button>';}).join('');
  var minorChips=['None','Finance','Economics','Data Science','Marketing','Law','Psychology','Philosophy','Communication','Entrepreneurship','Human Resource Studies','Sustainability','International Business','Computer Science','Other'];
  var minorChipsHtml=minorChips.map(function(f){return '<button class="pref-chip" data-val="'+f+'">'+f+'</button>';}).join('');
  var html='<div class="edu-entry-form" data-index="'+idx+'">'
    +'<div class="edu-entry-form-header"><span class="edu-entry-label">Entry '+labelNum+'</span><button class="remove-edu-btn" onclick="removeEduEntry(this)">✕ Remove</button></div>'
    +'<div class="edu-form-grid">'
    +'<div class="form-group"><label class="form-label">Institution </label><select class="form-input edu-university"><option value="">Select university...</option><option>Tilburg University</option><option>University of Amsterdam (UvA)</option><option>Erasmus University Rotterdam</option><option>Utrecht University</option><option>Leiden University</option><option>Other</option></select></div>'
    +'<div class="form-group"><label class="form-label">Degree level</label><select class="form-input edu-degree-level"><option value="">Select level...</option><option>Bachelor\'s degree (BSc / BA)</option><option>Pre-master</option><option>Master\'s degree (MSc / MA)</option><option>MBA</option><option>PhD / Doctorate</option><option>Exchange programme</option><option>Other</option></select></div>'
    +'<div class="form-group"><label class="form-label">Name of program </label><input class="form-input edu-program-name" type="text" placeholder="e.g. Business Analytics..." maxlength="150"></div>'
    +'<div class="form-group" style="grid-column:1/-1;"><label class="form-label">Field of study </label><div class="pref-chips edu-field-chips" style="margin-top:6px;flex-wrap:wrap;">'+chipsHtml+'</div><div class="edu-field-other-wrap" style="display:none;margin-top:8px;"><input class="form-input edu-field-other" type="text" placeholder="Please specify…" maxlength="100"></div></div>'
    +'<div class="form-group" style="grid-column:1/-1;"><label class="form-label">Minor </label><div class="pref-chips edu-minor-chips" style="margin-top:6px;flex-wrap:wrap;">'+minorChipsHtml+'</div><div class="edu-minor-other-wrap" style="display:none;margin-top:8px;"><input class="form-input edu-minor" type="text" placeholder="Please specify…" maxlength="100"></div></div>'
    +'<div class="form-group"><label class="form-label">Start date</label><div style="display:flex;gap:8px;"><select class="form-input" style="flex:1;"><option value="">Month</option>'+mo+'</select><select class="form-input" style="flex:1;"><option value="">Year</option>'+yr+'</select></div></div>'
    +'<div class="form-group" id="'+endGroupId+'"><label class="form-label">End date</label><div style="display:flex;gap:8px;"><select class="form-input" style="flex:1;"><option value="">Month</option>'+mo+'</select><select class="form-input" style="flex:1;"><option value="">Year</option>'+yr+'</select></div></div>'
    +'<div class="form-group" style="grid-column:1/-1;"><label class="edu-checkbox-label"><input type="checkbox" id="'+stillStudyingId+'" onchange="toggleEndDate(this,\''+endGroupId+'\')"><span>I am currently enrolled</span></label></div>'
    +'<div class="form-group"><label class="form-label">GPA <span class="field-badge private">Private</span></label><input class="form-input edu-gpa" type="text" placeholder="e.g. 7.8 / 10" maxlength="20"></div>'
    +'<div class="form-group" id="edu-grad-group-'+idx+'" style="display:none;"><label class="form-label">Graduation date</label><div style="display:flex;gap:8px;"><select class="form-input" style="flex:1;"><option value="">Month</option>'+mo+'</select><select class="form-input" style="flex:1;"><option value="">Year</option>'+yr+'</select></div></div>'
    +'<div class="form-group" style="grid-column:1/-1;"><label class="form-label">Description </label><div class="desc-bullets-wrap"><div class="desc-bullets-list"></div><button type="button" style="margin-top:4px;font-size:12px;color:var(--navy);background:none;border:none;cursor:pointer;padding:2px 0;font-weight:600;" onclick="_addDescBulletToEntry(this)">+ Add point</button></div></div>'
    +'</div></div>';
  var w=document.createElement('div'); w.innerHTML=html;
  var entry=w.firstChild;
  var chipsEl=entry.querySelector('.edu-field-chips');
  var otherWrap=entry.querySelector('.edu-field-other-wrap');
  chipsEl.addEventListener('click',function(e){
    var btn=e.target.closest('.pref-chip');if(!btn)return;
    chipsEl.querySelectorAll('.pref-chip').forEach(function(c){c.classList.remove('active');});
    btn.classList.add('active');
    otherWrap.style.display=btn.dataset.val==='Other'?'block':'none';
    if(btn.dataset.val!=='Other')entry.querySelector('.edu-field-other').value='';
  });
  var minorChipsEl=entry.querySelector('.edu-minor-chips');
  var minorOtherWrap=entry.querySelector('.edu-minor-other-wrap');
  minorChipsEl.addEventListener('click',function(e){
    var btn=e.target.closest('.pref-chip');if(!btn)return;
    minorChipsEl.querySelectorAll('.pref-chip').forEach(function(c){c.classList.remove('active');});
    btn.classList.add('active');
    minorOtherWrap.style.display=btn.dataset.val==='Other'?'block':'none';
    if(btn.dataset.val!=='Other')entry.querySelector('.edu-minor').value='';
  });
  var eduBulletList=entry.querySelector('.desc-bullets-list');
  if (eduBulletList) _addDescBulletRow(eduBulletList,'');
  container.appendChild(entry);
}
function removeEduEntry(btn){var e=btn.closest('.edu-entry-form');if(e){e.remove();_renumberEduEntries();}}
async function saveEducation() {
  var editView=document.getElementById('edu-edit-view'),readView=document.getElementById('edu-read-view'),btn=document.getElementById('edu-edit-btn');
  var entries=document.querySelectorAll('#edu-entries-container .edu-entry-form');
  var hasValidEdu=Array.from(entries).some(function(entry){
    var uniEl=entry.querySelector('.edu-university');var fieldEl=entry.querySelector('.edu-program-name');
    return (uniEl&&uniEl.value.trim())||(fieldEl&&fieldEl.value.trim());
  });
  if (!hasValidEdu){showToast('Please add at least one education entry (required).','error');return;}
  var structured=[];var html='';
  entries.forEach(function(entry){
    var uni=entry.querySelector('.edu-university')?entry.querySelector('.edu-university').value:'';
    var level=entry.querySelector('.edu-degree-level')?entry.querySelector('.edu-degree-level').value:'';
    var field=entry.querySelector('.edu-program-name')?entry.querySelector('.edu-program-name').value.trim():'';
    var fosChip=entry.querySelector('.edu-field-chips .pref-chip.active');
    var fosVal=fosChip?fosChip.dataset.val:'';
    if(fosVal==='Other'){var fosOther=entry.querySelector('.edu-field-other');fosVal=fosOther?fosOther.value.trim():'';}
    var minor='';var minorChip=entry.querySelector('.edu-minor-chips .pref-chip.active');
    if(minorChip){var mv=minorChip.dataset.val;minor=mv==='Other'?(entry.querySelector('.edu-minor')?entry.querySelector('.edu-minor').value.trim():''):mv;}
    var gpa=entry.querySelector('.edu-gpa')?entry.querySelector('.edu-gpa').value.trim():'';
    var allSelects=entry.querySelectorAll('select:not(.edu-university):not(.edu-degree-level)');
    var startMonth=allSelects[0]?allSelects[0].value:'';var startYear=allSelects[1]?allSelects[1].value:'';
    var endMonth=allSelects[2]?allSelects[2].value:'';var endYear=allSelects[3]?allSelects[3].value:'';
    var gradMonth=allSelects[4]?allSelects[4].value:'';var gradYear=allSelects[5]?allSelects[5].value:'';
    var cb=entry.querySelector('input[type="checkbox"]');var stillStudying=cb?cb.checked:false;
    var desc=_getDescBullets(entry);
    if(!uni&&!field)return;
    var endText=stillStudying?'Present':((endMonth||'')+(endYear?' '+endYear:''));
    structured.push({uni:uni,level:level,field:field,fieldOfStudy:fosVal,minor:minor,gpa:gpa,startMonth:startMonth,startYear:startYear,endMonth:endMonth,endYear:endYear,gradMonth:gradMonth,gradYear:gradYear,stillStudying:stillStudying,desc:desc});
    html+='<div class="edu-entry-display"><div class="edu-entry-header"><strong>'+(field||uni)+'</strong><span class="edu-period">'+(startMonth+' '+startYear).trim()+' — '+endText+'</span></div><div class="edu-entry-sub">'+uni+(level?' · '+level:'')+(fosVal?' · '+fosVal:'')+(gpa?' · GPA '+gpa:'')+'</div>'+(desc&&desc.length?'<div class="edu-entry-desc">'+_renderDescBullets(desc)+'</div>':'')+'</div>';
  });
  if(currentStudent) currentStudent._eduEntries=structured;
  try {
    var first=structured[0]||{};
    var flatDegree=[first.level,first.field].filter(Boolean).join(' ')||null;
    var res=await db.from('students').update({education:structured,degree:flatDegree,university:first.uni||null,level:first.level||null,gpa:first.gpa||null}).eq('id',currentStudent.id);
    if(res.error)throw res.error;
    if(currentStudent){currentStudent.education=structured;currentStudent.degree=flatDegree;currentStudent.university=first.uni||null;currentStudent.level=first.level||null;currentStudent.gpa=first.gpa||null;}
  } catch(err){showToast('Failed to save education: '+err.message,'error');}
  readView.innerHTML=html||'<p style="font-size:13px;color:var(--gray);">No education added.</p>';
  readView.style.display='block';editView.style.display='none';
  btn.innerHTML='Edit <span class="edu-saved-toast">&#10003; Saved</span>';setTimeout(function(){btn.textContent='Edit';},2500);
  var _eb=document.getElementById('edu-req-badge');if(_eb)_eb.style.display=structured.length>=1?'none':'';
  loadStudentProfile();
}
function cancelEducationEdit(){document.getElementById('edu-edit-view').style.display='none';document.getElementById('edu-read-view').style.display='block';document.getElementById('edu-edit-btn').textContent='Edit';}

// ─── EXPERIENCE EDIT ───
var expEntryCount = 1;
function toggleExperienceEdit(){
  var r=document.getElementById('exp-read-view'),e=document.getElementById('exp-edit-view'),b=document.getElementById('exp-edit-btn');
  if(e.style.display!=='none'){cancelExperienceEdit();return;}
  r.style.display='none';e.style.display='block';b.textContent='Cancel';
  var saved=currentStudent&&currentStudent._expEntries;
  if(saved&&saved.length){
    var c=document.getElementById('exp-entries-container');
    var first=c.querySelector('.edu-entry-form');
    if(first)_populateExpEntry(first,saved[0]);
    var existing=c.querySelectorAll('.edu-entry-form').length;
    for(var i=existing;i<saved.length;i++)addExpEntry();
    var all=c.querySelectorAll('.edu-entry-form');
    for(var j=1;j<saved.length;j++)_populateExpEntry(all[j],saved[j]);
  }
  document.querySelectorAll('#exp-entries-container .desc-bullets-list').forEach(function(list){
    if(!list.querySelector('.desc-bullet-row'))_addDescBulletRow(list,'');
  });
}
function _populateExpEntry(el,d){
  var roleInput=el.querySelector('.exp-role');if(roleInput)roleInput.value=d.role||'';
  var companyInput=el.querySelector('.exp-company');if(companyInput)companyInput.value=d.company||'';
  var locationInput=el.querySelector('.exp-location');if(locationInput)locationInput.value=d.location||'';
  var chipsEl=el.querySelector('.exp-field-chips');var otherWrap=el.querySelector('.exp-field-other-wrap');var otherInput=el.querySelector('.exp-field-other');
  if(chipsEl){
    var fow=d.fieldOfWork||'';var knownVals=Array.from(chipsEl.querySelectorAll('.pref-chip')).map(function(c){return c.dataset.val;});
    var isOther=fow&&!knownVals.includes(fow);
    chipsEl.querySelectorAll('.pref-chip').forEach(function(c){c.classList.toggle('active',isOther?c.dataset.val==='Other':c.dataset.val===fow);});
    if(otherWrap)otherWrap.style.display=isOther?'block':'none';
    if(otherInput)otherInput.value=isOther?fow:'';
    chipsEl.onclick=function(e){var btn=e.target.closest('.pref-chip');if(!btn)return;chipsEl.querySelectorAll('.pref-chip').forEach(function(c){c.classList.remove('active');});btn.classList.add('active');if(otherWrap)otherWrap.style.display=btn.dataset.val==='Other'?'block':'none';if(otherInput&&btn.dataset.val!=='Other')otherInput.value='';};
  }
  var sels=el.querySelectorAll('select');
  _setSelect(sels[0],d.startMonth);_setSelect(sels[1],d.startYear);
  _setSelect(sels[2],d.endMonth);_setSelect(sels[3],d.endYear);
  var cb=el.querySelector('input[type="checkbox"]');if(cb){cb.checked=!!d.stillWorking;}
  _populateDescBullets(el,d.desc);
}
function addExpEntry(){
  var c=document.getElementById('exp-entries-container');var idx=expEntryCount++;var endGroupId='exp-end-group-'+idx;var stillId='still-working-'+idx;
  var months='Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');var years=['2019','2020','2021','2022','2023','2024','2025','2026'];
  var mo=months.map(function(m){return '<option>'+m+'</option>';}).join('');var yr=years.map(function(y){return '<option>'+y+'</option>';}).join('');
  var expFields=['Finance & Banking','Consulting','Marketing','Data & Analytics','Technology','HR & People','Law & Legal','Accounting & Audit','Operations','Research','Sustainability','Education','Healthcare','Non-profit','Other'];
  var expFieldChipsHtml=expFields.map(function(f){return '<button class="pref-chip" data-val="'+f+'">'+f+'</button>';}).join('');
  var d2=document.createElement('div');d2.className='edu-entry-form';d2.dataset.index=idx;
  d2.innerHTML='<div class="edu-entry-form-header"><span class="edu-entry-label">Entry '+(idx+1)+'</span><button class="remove-edu-btn" onclick="removeExpEntry(this)">✕ Remove</button></div>'
    +'<div class="edu-form-grid">'
    +'<div class="form-group"><label class="form-label">Job title / Role </label><input class="form-input exp-role" type="text" placeholder="e.g. Marketing Intern..." maxlength="150"></div>'
    +'<div class="form-group"><label class="form-label">Company / Organisation </label><input class="form-input exp-company" type="text" placeholder="e.g. KPMG, Startup XYZ..." maxlength="150"></div>'
    +'<div class="form-group" style="grid-column:1/-1;"><label class="form-label">Field of work </label><div class="pref-chips exp-field-chips" style="margin-top:6px;flex-wrap:wrap;">'+expFieldChipsHtml+'</div><div class="exp-field-other-wrap" style="display:none;margin-top:8px;"><input class="form-input exp-field-other" type="text" placeholder="Please specify…" maxlength="100"></div></div>'
    +'<div class="form-group" style="grid-column:1/-1;"><label class="form-label">Location</label><input class="form-input exp-location" type="text" placeholder="City, Country" maxlength="100"></div>'
    +'<div class="form-group"><label class="form-label">Start date</label><div style="display:flex;gap:8px;"><select class="form-input" style="flex:1;"><option value="">Month</option>'+mo+'</select><select class="form-input" style="flex:1;"><option value="">Year</option>'+yr+'</select></div></div>'
    +'<div class="form-group" id="'+endGroupId+'"><label class="form-label">End date</label><div style="display:flex;gap:8px;"><select class="form-input" style="flex:1;"><option value="">Month</option>'+mo+'</select><select class="form-input" style="flex:1;"><option value="">Year</option>'+yr+'</select></div></div>'
    +'<div class="form-group" style="grid-column:1/-1;"><label class="edu-checkbox-label"><input type="checkbox" id="'+stillId+'" onchange="toggleEndDate(this,\''+endGroupId+'\')"><span>I currently work here</span></label></div>'
    +'<div class="form-group" style="grid-column:1/-1;"><label class="form-label">Description</label><div class="desc-bullets-wrap"><div class="desc-bullets-list"></div><button type="button" style="margin-top:4px;font-size:12px;color:var(--navy);background:none;border:none;cursor:pointer;padding:2px 0;font-weight:600;" onclick="_addDescBulletToEntry(this)">+ Add point</button></div></div>'
    +'</div>';
  var chipsEl=d2.querySelector('.exp-field-chips');var otherWrap=d2.querySelector('.exp-field-other-wrap');
  chipsEl.addEventListener('click',function(e){var btn=e.target.closest('.pref-chip');if(!btn)return;chipsEl.querySelectorAll('.pref-chip').forEach(function(c){c.classList.remove('active');});btn.classList.add('active');otherWrap.style.display=btn.dataset.val==='Other'?'block':'none';if(btn.dataset.val!=='Other')d2.querySelector('.exp-field-other').value='';});
  var expBulletList=d2.querySelector('.desc-bullets-list');if(expBulletList)_addDescBulletRow(expBulletList,'');
  c.appendChild(d2);
}
function removeExpEntry(btn){var e=btn.closest('.edu-entry-form');if(e)e.remove();}
async function saveExperience(){
  var r=document.getElementById('exp-read-view'),e=document.getElementById('exp-edit-view'),b=document.getElementById('exp-edit-btn');
  var entries=document.querySelectorAll('#exp-entries-container .edu-entry-form');var html='';var structured=[];
  entries.forEach(function(entry){
    var role=entry.querySelector('.exp-role')?entry.querySelector('.exp-role').value.trim():'';
    var company=entry.querySelector('.exp-company')?entry.querySelector('.exp-company').value.trim():'';
    var location=entry.querySelector('.exp-location')?entry.querySelector('.exp-location').value.trim():'';
    var fowChip=entry.querySelector('.exp-field-chips .pref-chip.active');
    var fieldOfWork=fowChip?fowChip.dataset.val:'';
    if(fieldOfWork==='Other'){var fowOther=entry.querySelector('.exp-field-other');fieldOfWork=fowOther?fowOther.value.trim():'';}
    if(!role&&!company)return;
    var sels=entry.querySelectorAll('select');
    var startMonth=sels[0]?sels[0].value:'';var startYear=sels[1]?sels[1].value:'';
    var endMonth=sels[2]?sels[2].value:'';var endYear=sels[3]?sels[3].value:'';
    var cb=entry.querySelector('input[type="checkbox"]');var stillWorking=cb?cb.checked:false;
    var desc=_getDescBullets(entry);
    var period=(startMonth+' '+startYear).trim()+(stillWorking?' — Present':((endMonth||endYear)?' — '+(endMonth+' '+endYear).trim():''));
    structured.push({role:role,company:company,location:location,fieldOfWork:fieldOfWork,startMonth:startMonth,startYear:startYear,endMonth:endMonth,endYear:endYear,stillWorking:stillWorking,desc:desc});
    html+='<div class="edu-entry-display"><div class="edu-entry-header"><strong>'+(role||'Untitled')+'</strong><span class="edu-period">'+period+'</span></div><div class="edu-entry-sub">'+(company||'')+(fieldOfWork?' · '+fieldOfWork:'')+(location?' · '+location:'')+'</div>'+(desc&&desc.length?'<div class="edu-entry-desc">'+_renderDescBullets(desc)+'</div>':'')+'</div>';
  });
  if(currentStudent) currentStudent._expEntries=structured;
  try {
    var res=await db.from('students').update({experience:structured}).eq('id',currentStudent.id);
    if(res.error)throw res.error;
    if(currentStudent)currentStudent.experience=structured;
  } catch(err){showToast('Failed to save experience: '+err.message,'error');}
  r.innerHTML=html||'<p style="font-size:13px;color:var(--gray);">No experience added yet.</p>';
  r.style.display='block';e.style.display='none';
  b.innerHTML='Edit <span class="edu-saved-toast">&#10003; Saved</span>';setTimeout(function(){b.textContent='Edit';},2500);
  loadStudentProfile();
}
function cancelExperienceEdit(){document.getElementById('exp-edit-view').style.display='none';document.getElementById('exp-read-view').style.display='block';document.getElementById('exp-edit-btn').textContent='Edit';}

// ─── ORGANISATIONS ───
var orgsEntryCount = 1;
function toggleOrgsEdit(){
  var r=document.getElementById('orgs-read-view'),e=document.getElementById('orgs-edit-view'),b=document.getElementById('orgs-edit-btn');
  if(e.style.display!=='none'){cancelOrgsEdit();return;}
  r.style.display='none';e.style.display='block';b.textContent='Cancel';
  var saved=currentStudent&&currentStudent._orgsEntries;
  if(saved&&saved.length){
    var c=document.getElementById('orgs-entries-container');
    var first=c.querySelector('.edu-entry-form');
    if(first)_populateOrgsEntry(first,saved[0]);
    var existing=c.querySelectorAll('.edu-entry-form').length;
    for(var i=existing;i<saved.length;i++)addOrgsEntry();
    var all=c.querySelectorAll('.edu-entry-form');
    for(var j=1;j<saved.length;j++)_populateOrgsEntry(all[j],saved[j]);
  }
  document.querySelectorAll('#orgs-entries-container .desc-bullets-list').forEach(function(list){
    if(!list.querySelector('.desc-bullet-row'))_addDescBulletRow(list,'');
  });
}
function _populateOrgsEntry(el,d){
  var inputs=el.querySelectorAll('input[type="text"]');
  _setInput(inputs[0],d.org);_setInput(inputs[1],d.role);
  var sels=el.querySelectorAll('select');
  _setSelect(sels[0],d.startMonth);_setSelect(sels[1],d.startYear);
  _setSelect(sels[2],d.endMonth);_setSelect(sels[3],d.endYear);
  var cb=el.querySelector('input[type="checkbox"]');if(cb)cb.checked=!!d.stillMember;
  _populateDescBullets(el,d.desc);
}
function addOrgsEntry(){
  var c=document.getElementById('orgs-entries-container');var idx=orgsEntryCount++;var endGroupId='orgs-end-group-'+idx;
  var months='Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');var years=['2018','2019','2020','2021','2022','2023','2024','2025'];
  var mo=months.map(function(m){return '<option>'+m+'</option>';}).join('');var yr=years.map(function(y){return '<option>'+y+'</option>';}).join('');
  var d2=document.createElement('div');d2.className='edu-entry-form';
  var header=document.createElement('div');header.className='edu-entry-form-header';
  var lbl=document.createElement('span');lbl.className='edu-entry-label';lbl.textContent='Entry '+(idx+1);
  var rb=document.createElement('button');rb.className='remove-edu-btn';rb.textContent='✕ Remove';rb.onclick=function(){d2.remove();};
  header.appendChild(lbl);header.appendChild(rb);d2.appendChild(header);
  var grid=document.createElement('div');grid.className='edu-form-grid';
  var f1=document.createElement('div');f1.className='form-group';f1.innerHTML='<label class="form-label">Organisation name </label><input class="form-input" type="text" placeholder="Full organisation name" maxlength="150">';
  var f2=document.createElement('div');f2.className='form-group';f2.innerHTML='<label class="form-label">Position / Role title </label><input class="form-input" type="text" placeholder="e.g. President, Member" maxlength="100">';
  var f3=document.createElement('div');f3.className='form-group';f3.innerHTML='<label class="form-label">Start date</label><div style="display:flex;gap:8px;"><select class="form-input" style="flex:1;">'+mo+'</select><select class="form-input" style="flex:1;">'+yr+'</select></div>';
  var f4=document.createElement('div');f4.className='form-group';f4.id=endGroupId;f4.innerHTML='<label class="form-label">End date</label><div style="display:flex;gap:8px;"><select class="form-input" style="flex:1;">'+mo+'</select><select class="form-input" style="flex:1;">'+yr+'</select></div>';
  var f5=document.createElement('div');f5.className='form-group';f5.style.gridColumn='1/-1';
  var cbLabel=document.createElement('label');cbLabel.className='edu-checkbox-label';
  var cb=document.createElement('input');cb.type='checkbox';cb.addEventListener('change',function(){toggleEndDate(cb,endGroupId);});
  var cbSpan=document.createElement('span');cbSpan.textContent='I am currently a member';cbLabel.appendChild(cb);cbLabel.appendChild(cbSpan);f5.appendChild(cbLabel);
  var f6=document.createElement('div');f6.className='form-group';f6.style.gridColumn='1/-1';f6.innerHTML='<label class="form-label">Description </label><div class="desc-bullets-wrap"><div class="desc-bullets-list"></div><button type="button" style="margin-top:4px;font-size:12px;color:var(--navy);background:none;border:none;cursor:pointer;padding:2px 0;font-weight:600;" onclick="_addDescBulletToEntry(this)">+ Add point</button></div>';
  grid.appendChild(f1);grid.appendChild(f2);grid.appendChild(f3);grid.appendChild(f4);grid.appendChild(f5);grid.appendChild(f6);d2.appendChild(grid);
  var orgsBulletList=f6.querySelector('.desc-bullets-list');if(orgsBulletList)_addDescBulletRow(orgsBulletList,'');
  c.appendChild(d2);
}
function removeOrgsEntry(btn){var e=btn.closest('.edu-entry-form');if(e)e.remove();}
async function saveOrgs(){
  var r=document.getElementById('orgs-read-view'),e=document.getElementById('orgs-edit-view'),b=document.getElementById('orgs-edit-btn');
  var entries=document.querySelectorAll('#orgs-entries-container .edu-entry-form');var html='';var structured=[];
  entries.forEach(function(entry){
    var inputs=entry.querySelectorAll('input[type="text"]');var org=inputs[0]?inputs[0].value:'';var role=inputs[1]?inputs[1].value:'';
    if(!org)return;
    var sels=entry.querySelectorAll('select');
    var startMonth=sels[0]?sels[0].value:'';var startYear=sels[1]?sels[1].value:'';
    var endMonth=sels[2]?sels[2].value:'';var endYear=sels[3]?sels[3].value:'';
    var cb=entry.querySelector('input[type="checkbox"]');var stillMember=cb?cb.checked:false;
    var desc=_getDescBullets(entry);
    structured.push({org:org,role:role,startMonth:startMonth,startYear:startYear,endMonth:endMonth,endYear:endYear,stillMember:stillMember,desc:desc});
    var period=(startMonth+' '+startYear).trim()+(stillMember?' — Present':((endMonth||endYear)?' — '+(endMonth+' '+endYear).trim():''));
    html+='<div class="edu-entry-display"><div class="edu-entry-header"><strong>'+(role||'Member')+'</strong><span class="edu-period">'+period+'</span></div><div class="edu-entry-sub">'+org+'</div>'+(desc&&desc.length?'<div class="edu-entry-desc">'+_renderDescBullets(desc)+'</div>':'')+'</div>';
  });
  if(currentStudent)currentStudent._orgsEntries=structured;
  try {
    var res=await db.from('students').update({organisations:structured}).eq('id',currentStudent.id);
    if(res.error)throw res.error;
    if(currentStudent)currentStudent.organisations=structured;
  } catch(err){showToast('Failed to save organisations: '+err.message,'error');}
  r.innerHTML=html||'<p style="font-size:13px;color:var(--gray);">No organisations added.</p>';r.style.display='block';e.style.display='none';
  b.innerHTML='Edit <span class="edu-saved-toast">&#10003; Saved</span>';setTimeout(function(){b.textContent='Edit';},2500);
  loadStudentProfile();
}
function cancelOrgsEdit(){document.getElementById('orgs-edit-view').style.display='none';document.getElementById('orgs-read-view').style.display='block';document.getElementById('orgs-edit-btn').textContent='Edit';}

// ─── SKILLS ───
var skillsDB={technical:[],professional:[],languages:[]};
var currentSkillCat='technical';
var suggestionsByCat={technical:['Excel','Python','R','SQL','Java','JavaScript','MATLAB','Tableau','Power BI','Bloomberg','Financial Modelling','Data Analysis','Machine Learning','Statistics','Econometrics','AutoCAD','Figma','Google Analytics'],professional:['Project Management','Agile / Scrum','Leadership','Communication','Marketing','SEO','Content Writing','Social Media','Research','Problem Solving','Negotiation','HubSpot','CRM'],languages:['Dutch','English','German','French','Spanish','Italian','Mandarin','Arabic','Portuguese','Russian','Japanese']};
var acquisitionOptions=['University course','Online certificate','Self-taught','Work experience','Professional certification','Bootcamp / Training','Exchange programme','Language certificate','Other'];

function renderReadView(){
  ['technical','professional','languages'].forEach(function(cat){
    var el=document.getElementById('read-'+cat);if(!el)return;
    el.innerHTML=skillsDB[cat].map(function(s){return '<div class="skill-item-read"><span class="skill-tag">'+esc(s.name)+'</span><span class="skill-source">'+esc(s.source||'')+'</span>'+(s.proof?'<span class="skill-proof-label">&#128196; '+esc(s.proof)+'</span>':'')+'</div>';}).join('')||'<span style="font-size:13px;color:var(--gray);">None added yet.</span>';
  });
}
try { renderReadView(); } catch(e) {}

function switchSkillCat(cat){
  currentSkillCat=cat;
  ['technical','professional','languages','courses','projects'].forEach(function(c){
    var btn=document.getElementById('stab-'+c);var panel=document.getElementById('skills-edit-'+c);
    if(btn)btn.classList.toggle('active',c===cat);if(panel)panel.style.display=c===cat?'block':'none';
  });
  document.getElementById('skill-search-input').value='';document.getElementById('skill-suggestions').style.display='none';
  var sw=document.querySelector('.skills-search-wrap');if(sw)sw.style.display=(cat==='courses'||cat==='projects')?'none':'flex';
}
function toggleSkillsEdit(){
  var r=document.getElementById('skills-read-view'),e=document.getElementById('skills-edit-view'),b=document.getElementById('skills-edit-btn');
  if(e.style.display!=='none'){cancelSkillsEdit();return;}
  r.style.display='none';e.style.display='block';b.textContent='Cancel';
  renderAllEditLists();switchSkillCat('technical');
}
function renderAllEditLists(){['technical','professional','languages'].forEach(function(cat){renderEditList(cat);});}
function renderEditList(cat){
  var c=document.getElementById('skills-edit-'+cat);if(!c)return;
  c.innerHTML='';skillsDB[cat].forEach(function(skill,i){c.appendChild(createSkillRow(cat,skill.name,skill.source,skill.proof||'',i));});
}
function createSkillRow(cat,name,source,proof,idx){
  var row=document.createElement('div');row.className='skill-edit-row';
  var optHtml=acquisitionOptions.map(function(o){return '<option'+(o===source?' selected':'')+'>'+o+'</option>';}).join('');
  row.innerHTML='<div class="skill-row-top"><div class="skill-name-badge">&#127919; '+esc(name)+'</div><select class="skill-source-select" data-cat="'+cat+'" data-idx="'+idx+'" onchange="updateSkillCatSource(this)">'+optHtml+'</select><button class="skill-remove-btn" data-cat="'+cat+'" data-idx="'+idx+'" onclick="removeSkillBtn(this)" title="Remove">&#x2715;</button></div><input class="form-input skill-proof-input" type="text" data-cat="'+cat+'" data-idx="'+idx+'" placeholder="Certificate, course code, or proof (optional)..." value="'+esc(proof)+'" oninput="updateSkillCatProof(this)">';
  return row;
}
function updateSkillCatSource(sel){var cat=sel.dataset.cat;var idx=parseInt(sel.dataset.idx);if(skillsDB[cat]&&skillsDB[cat][idx])skillsDB[cat][idx].source=sel.value;}
function updateSkillCatProof(input){var cat=input.dataset.cat;var idx=parseInt(input.dataset.idx);if(skillsDB[cat]&&skillsDB[cat][idx])skillsDB[cat][idx].proof=input.value;}
function removeSkillBtn(btn){var cat=btn.dataset.cat;var idx=parseInt(btn.dataset.idx);if(skillsDB[cat]){skillsDB[cat].splice(idx,1);renderEditList(cat);}}
function filterSkillSuggestions(val){
  var box=document.getElementById('skill-suggestions');
  if(!val||val.length<1){box.style.display='none';return;}
  var pool=suggestionsByCat[currentSkillCat]||[];
  var existing=skillsDB[currentSkillCat].map(function(d){return d.name.toLowerCase();});
  var matches=pool.filter(function(s){return s.toLowerCase().includes(val.toLowerCase())&&!existing.includes(s.toLowerCase());}).slice(0,8);
  if(!matches.length){box.style.display='none';return;}
  box.innerHTML=matches.map(function(m){return '<div class="skill-suggestion-item" data-skill="'+esc(m)+'" onclick="selectSkillSuggestion(this.dataset.skill)">'+esc(m)+'</div>';}).join('');
  box.style.display='block';
}
function selectSkillSuggestion(name){document.getElementById('skill-search-input').value=name;document.getElementById('skill-suggestions').style.display='none';addSkillFromSearch();}
function addSkillFromSearch(){
  var input=document.getElementById('skill-search-input');var name=input.value.trim();if(!name)return;
  var existing=skillsDB[currentSkillCat].map(function(d){return d.name.toLowerCase();});
  if(existing.includes(name.toLowerCase())){input.value='';return;}
  var ds=currentSkillCat==='languages'?'Language certificate':'Self-taught';
  skillsDB[currentSkillCat].push({name:name,source:ds,proof:''});
  input.value='';document.getElementById('skill-suggestions').style.display='none';renderEditList(currentSkillCat);
}
async function saveSkills(){
  var r=document.getElementById('skills-read-view'),e=document.getElementById('skills-edit-view'),b=document.getElementById('skills-edit-btn');
  var totalSkillCount=skillsDB.technical.length+skillsDB.professional.length+skillsDB.languages.length;
  if(totalSkillCount<3){showToast('Please add at least 3 skills to complete your profile (required).','error');return;}
  var courses=[];
  document.querySelectorAll('#courses-list .edu-entry-form').forEach(function(entry){
    var inputs=entry.querySelectorAll('input[type="text"]');var name=inputs[0]?inputs[0].value.trim():'';var code=inputs[1]?inputs[1].value.trim():'';
    if(name)courses.push({name:name,code:code});
  });
  var projects=[];
  document.querySelectorAll('#projects-list .edu-entry-form').forEach(function(entry){
    var ni=entry.querySelector('input[type="text"]');var name=ni?ni.value.trim():'';
    var ta=entry.querySelector('textarea');var desc=ta?ta.value.trim():'';
    if(name)projects.push({name:name,desc:desc});
  });
  renderReadView();
  try {
    var res=await db.from('students').update({skills_technical:skillsDB.technical,skills_professional:skillsDB.professional,skills_languages:skillsDB.languages,skills_courses:courses,skills_projects:projects}).eq('id',currentStudent.id);
    if(res.error)throw res.error;
    if(currentStudent){currentStudent.skills_technical=skillsDB.technical;currentStudent.skills_professional=skillsDB.professional;currentStudent.skills_languages=skillsDB.languages;currentStudent.skills_courses=courses;currentStudent.skills_projects=projects;}
  } catch(err){showToast('Failed to save skills: '+err.message,'error');}
  r.style.display='block';e.style.display='none';
  b.innerHTML='Edit <span class="edu-saved-toast">&#10003; Saved</span>';setTimeout(function(){b.textContent='Edit';},2500);
  var _sb=document.getElementById('skills-req-badge');if(_sb)_sb.style.display=totalSkillCount>=3?'none':'';
  loadStudentProfile();
}
function cancelSkillsEdit(){document.getElementById('skills-edit-view').style.display='none';document.getElementById('skills-read-view').style.display='block';document.getElementById('skills-edit-btn').textContent='Edit';document.getElementById('skill-suggestions').style.display='none';}
function addCourseEntry(){
  var list=document.getElementById('courses-list');var d=document.createElement('div');d.className='edu-entry-form';d.style.marginTop='10px';
  var grid=document.createElement('div');grid.className='edu-form-grid';
  var f1=document.createElement('div');f1.className='form-group';f1.innerHTML='<label class="form-label">Course name </label><input class="form-input" type="text" placeholder="e.g. Corporate Finance" maxlength="150">';
  var f2=document.createElement('div');f2.className='form-group';f2.innerHTML='<label class="form-label">Course code </label><input class="form-input" type="text" placeholder="e.g. FIN402" maxlength="50">';
  grid.appendChild(f1);grid.appendChild(f2);d.appendChild(grid);
  var rb=document.createElement('button');rb.className='remove-edu-btn';rb.style.marginTop='8px';rb.textContent='Remove';rb.onclick=function(){d.remove();};d.appendChild(rb);
  list.appendChild(d);
}
function addProjectEntry(){
  var list=document.getElementById('projects-list');var d=document.createElement('div');d.className='edu-entry-form';d.style.marginTop='10px';
  var grid=document.createElement('div');grid.className='edu-form-grid';
  var f1=document.createElement('div');f1.className='form-group';f1.style.gridColumn='1/-1';f1.innerHTML='<label class="form-label">Project name </label><input class="form-input" type="text" placeholder="Project name" maxlength="150">';
  var f2=document.createElement('div');f2.className='form-group';f2.style.gridColumn='1/-1';
  var l2=document.createElement('label');l2.className='form-label';l2.textContent='Description ';
  var t2=document.createElement('textarea');t2.className='form-textarea';t2.style.minHeight='60px';t2.placeholder='Describe the project...';t2.maxLength=500;
  f2.appendChild(l2);f2.appendChild(t2);
  var f3=document.createElement('div');f3.className='form-group';f3.style.gridColumn='1/-1';f3.innerHTML='<label class="form-label">Link </label><input class="form-input" type="text" placeholder="github.com/... or portfolio URL" maxlength="300">';
  grid.appendChild(f1);grid.appendChild(f2);grid.appendChild(f3);d.appendChild(grid);
  var rb=document.createElement('button');rb.className='remove-edu-btn';rb.style.marginTop='8px';rb.textContent='Remove';rb.onclick=function(){d.remove();};d.appendChild(rb);
  attachCounterToTextarea(t2,500);list.appendChild(d);
}
document.addEventListener('click',function(e){
  var box=document.getElementById('skill-suggestions');var input=document.getElementById('skill-search-input');
  if(box&&input&&!box.contains(e.target)&&e.target!==input)box.style.display='none';
});

// ─── PREFERENCES ───
function togglePreferencesEdit(){
  var r=document.getElementById('pref-read-view'),e=document.getElementById('pref-edit-view'),b=document.getElementById('pref-edit-btn');
  if(e.style.display!=='none'){cancelPreferencesEdit();return;}
  r.style.display='none';e.style.display='block';b.textContent='Cancel';
  var p=currentStudent&&currentStudent._prefs;if(!p)return;
  function toArr(val){
    if(!val)return[];
    if(Array.isArray(val))return val.map(function(s){return String(s).trim();}).filter(Boolean);
    var s=String(val).trim();
    if(s.charAt(0)==='{'){s=s.slice(1,-1);return s.match(/("([^"]*)")|([^,]+)/g).map(function(m){return m.replace(/^"|"$/g,'').trim();}).filter(Boolean);}
    return s.split(',').map(function(x){return x.trim();}).filter(Boolean);
  }
  function restoreChips(id,vals){var arr=toArr(vals);document.querySelectorAll('#'+id+' .pref-chip').forEach(function(c){c.classList.toggle('active',arr.indexOf(c.dataset.val)!==-1);});}
  restoreChips('pref-type',p.type);restoreChips('pref-emp-type',p.empType);restoreChips('pref-dutch-only',p.dutchOnly?['Yes']:['No']);
  var hoursWrap=document.getElementById('pref-hours-wrap');var hoursInput=document.getElementById('pref-hours-per-week');
  var isPartTime=(p.empType||'').includes('Part-time');
  if(hoursWrap)hoursWrap.style.display=isPartTime?'block':'none';if(hoursInput)hoursInput.value=p.hoursPerWeek||'';
  restoreChips('pref-duration',p.duration);
  var knownSectors=Array.from(document.querySelectorAll('#pref-sectors .pref-chip')).map(function(c){return c.dataset.val;});
  var sectorArr=toArr(p.sectors);var customSectors=sectorArr.filter(function(s){return !knownSectors.includes(s);});var standardSectors=sectorArr.filter(function(s){return knownSectors.includes(s);});
  document.querySelectorAll('#pref-sectors .pref-chip').forEach(function(c){c.classList.toggle('active',standardSectors.indexOf(c.dataset.val)!==-1||(customSectors.length>0&&c.dataset.val==='Other'));});
  var otherWrap=document.getElementById('pref-sectors-other-wrap');var customTagsEl=document.getElementById('pref-sectors-custom-tags');
  if(customSectors.length>0){if(otherWrap)otherWrap.style.display='block';if(customTagsEl)customTagsEl.innerHTML=customSectors.map(function(s){return '<span class="role-tag">'+esc(s)+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button></span>';}).join('');}
  else{if(otherWrap)otherWrap.style.display='none';if(customTagsEl)customTagsEl.innerHTML='';}
  var knownLocations=Array.from(document.querySelectorAll('#pref-location .pref-chip')).map(function(c){return c.dataset.val;});
  var locationArr=toArr(p.locations);var customLocations=locationArr.filter(function(s){return !knownLocations.includes(s);});var standardLocations=locationArr.filter(function(s){return knownLocations.includes(s);});
  document.querySelectorAll('#pref-location .pref-chip').forEach(function(c){c.classList.toggle('active',standardLocations.indexOf(c.dataset.val)!==-1||(customLocations.length>0&&c.dataset.val==='Other'));});
  var locWrap=document.getElementById('pref-location-other-wrap');var locTagsEl=document.getElementById('pref-location-custom-tags');
  if(customLocations.length>0){if(locWrap)locWrap.style.display='block';if(locTagsEl)locTagsEl.innerHTML=customLocations.map(function(s){return '<span class="role-tag">'+esc(s)+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button></span>';}).join('');}
  else{if(locWrap)locWrap.style.display='none';if(locTagsEl)locTagsEl.innerHTML='';}
  _setSelect(document.getElementById('pref-start-month'),p.month);
  _setSelect(document.getElementById('pref-start-year'),String(p.year||''));
  var tagsEl=document.getElementById('pref-roles-tags');
  if(tagsEl&&p.roles&&p.roles.length){tagsEl.innerHTML=p.roles.map(function(r){return '<span class="role-tag">'+esc(r)+' <button class="role-remove-btn" onclick="removeRoleTag(this)">&#xd7;</button></span>';}).join('');}
  _setupRequiredBadgeWatchers(e);
}

// Global pref-chip click handler (profile-relevant groups only)
document.addEventListener('click',function(e){
  var chip=e.target.closest('.pref-chip');if(!chip)return;
  var group=chip.closest('.pref-chips');if(!group)return;
  if(group.classList.contains('multi')){chip.classList.toggle('active');}
  else{group.querySelectorAll('.pref-chip').forEach(function(c){c.classList.remove('active');});chip.classList.add('active');}
  if(group.classList.contains('error')&&group.querySelector('.pref-chip.active'))_clearFieldError(group);
  if(group.id==='pref-emp-type'){var hw=document.getElementById('pref-hours-wrap');if(hw)hw.style.display=chip.dataset.val==='Part-time'?'block':'none';if(chip.dataset.val!=='Part-time'){var hi=document.getElementById('pref-hours-per-week');if(hi)hi.value='';}}
  if(group.id==='pref-sectors'){var otherW=document.getElementById('pref-sectors-other-wrap');if(otherW){var oa=!!group.querySelector('.pref-chip[data-val="Other"].active');otherW.style.display=oa?'block':'none';if(!oa){var oi=document.getElementById('pref-sectors-other');if(oi)oi.value='';var ct=document.getElementById('pref-sectors-custom-tags');if(ct)ct.innerHTML='';}}}
  if(group.id==='pref-location'){var otherA2=!!group.querySelector('.pref-chip[data-val="Other"].active');var wrap2=document.getElementById('pref-location-other-wrap');if(wrap2)wrap2.style.display=otherA2?'block':'none';if(!otherA2){var oi2=document.getElementById('pref-location-other');if(oi2)oi2.value='';var ct2=document.getElementById('pref-location-custom-tags');if(ct2)ct2.innerHTML='';}}
  if(group.id==='visibility-chips'){group.querySelectorAll('.pref-chip').forEach(function(c){c.classList.remove('active');});chip.classList.add('active');}
});

async function savePreferences(){
  var r=document.getElementById('pref-read-view'),e=document.getElementById('pref-edit-view'),b=document.getElementById('pref-edit-btn');
  var getActive=function(id){return Array.from(document.querySelectorAll('#'+id+' .pref-chip.active')).map(function(c){return c.dataset.val;});};
  var prefTypeChips=document.getElementById('pref-type');var prefSectorsChips=document.getElementById('pref-sectors');var prefLocChips=document.getElementById('pref-location');
  var ok=true;
  if(!getActive('pref-type').length){_showFieldError(prefTypeChips,'Please select what you are looking for.');ok=false;}else _clearFieldError(prefTypeChips);
  if(!getActive('pref-sectors').length){_showFieldError(prefSectorsChips,'Please select at least one sector.');ok=false;}else _clearFieldError(prefSectorsChips);
  if(!getActive('pref-location').length){_showFieldError(prefLocChips,'Please select at least one preferred location.');ok=false;}else _clearFieldError(prefLocChips);
  if(!ok){_scrollToFirstError(document.getElementById('pref-edit-view'));return;}
  var month=document.getElementById('pref-start-month').value;var year=document.getElementById('pref-start-year').value;
  var roles=Array.from(document.querySelectorAll('#pref-roles-tags .role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim();});
  var prefs={
    type:getActive('pref-type').join(', '),empType:getActive('pref-emp-type').join(', '),
    hoursPerWeek:(document.getElementById('pref-hours-per-week')||{}).value||'',
    duration:getActive('pref-duration').join(', '),
    sectors:(function(){var vals=getActive('pref-sectors').filter(function(v){return v!=='Other';});var ct=Array.from(document.querySelectorAll('#pref-sectors-custom-tags .role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim();}).filter(Boolean);return vals.concat(ct).join(', ');}()),
    locations:(function(){var vals=getActive('pref-location').filter(function(v){return v!=='Other';});var ct=Array.from(document.querySelectorAll('#pref-location-custom-tags .role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim();}).filter(Boolean);return vals.concat(ct).join(', ');}()),
    month:month,year:year,roles:roles,dutchOnly:getActive('pref-dutch-only').indexOf('Yes')!==-1
  };
  if(currentStudent){
    currentStudent._prefs=prefs;currentStudent.pref_type=prefs.type;currentStudent.pref_emp_type=prefs.empType;currentStudent.hours_per_week=prefs.hoursPerWeek;currentStudent.pref_duration=prefs.duration;currentStudent.pref_sectors=prefs.sectors;currentStudent.pref_locations=prefs.locations;currentStudent.avail_month=prefs.month;currentStudent.avail_year=prefs.year?parseInt(prefs.year):null;currentStudent.role_interests=prefs.roles;currentStudent.pref_dutch_only=prefs.dutchOnly;
  }
  try {
    var res=await db.from('students').update({pref_type:prefs.type,pref_emp_type:prefs.empType,hours_per_week:prefs.hoursPerWeek||null,pref_duration:prefs.duration,pref_sectors:prefs.sectors,pref_locations:prefs.locations,avail_month:prefs.month||null,avail_year:prefs.year?parseInt(prefs.year):null,role_interests:prefs.roles,pref_dutch_only:prefs.dutchOnly}).eq('id',currentStudent.id);
    if(res.error)throw res.error;
  } catch(err){showToast('Failed to save preferences: '+err.message,'error');}
  var setRead=function(id,val){var el=document.getElementById(id);if(el)el.textContent=val||'Not set';};
  setRead('pref-read-type',prefs.type);setRead('pref-read-emp-type',prefs.empType);
  document.getElementById('pref-read-start').textContent=(month+' '+year).trim()||'Not set';
  setRead('pref-read-duration',prefs.duration);setRead('pref-read-sectors',prefs.sectors);setRead('pref-read-location',prefs.locations);
  var rolesEl=document.getElementById('pref-read-roles');if(rolesEl)rolesEl.textContent=roles.join(', ')||'Not set';
  var dutchEl=document.getElementById('pref-read-dutch-only');if(dutchEl)dutchEl.textContent=prefs.dutchOnly?'Yes':'No';
  r.style.display='block';e.style.display='none';
  b.innerHTML='Edit <span class="edu-saved-toast">&#10003; Saved</span>';setTimeout(function(){b.textContent='Edit';},2500);
  loadStudentProfile();
}
function cancelPreferencesEdit(){document.getElementById('pref-edit-view').style.display='none';document.getElementById('pref-read-view').style.display='block';document.getElementById('pref-edit-btn').textContent='Edit';}

// ─── ROLE INTERESTS ───
var allRoleSuggestions=['Financial Analyst','Data Analyst','Business Analyst','Strategy Consultant','Marketing Analyst','HR Business Partner','Account Manager','Project Manager','Software Engineer','Data Scientist','Product Manager','UX Designer','Risk Analyst','Audit Associate','Tax Consultant','Operations Manager','Investment Analyst','Portfolio Manager','Compliance Officer','Research Analyst'];
function filterRoleSuggestions(val){
  var box=document.getElementById('role-suggestions');if(!val||val.length<1){box.style.display='none';return;}
  var existing=Array.from(document.querySelectorAll('#pref-roles-tags .role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim().toLowerCase();});
  var matches=allRoleSuggestions.filter(function(r){return r.toLowerCase().includes(val.toLowerCase())&&!existing.includes(r.toLowerCase());}).slice(0,8);
  if(!matches.length){box.style.display='none';return;}
  box.innerHTML=matches.map(function(m){return '<div class="skill-suggestion-item" data-role="'+esc(m)+'" onclick="selectRoleSuggestion(this.dataset.role)">'+esc(m)+'</div>';}).join('');
  box.style.display='block';
}
function selectRoleSuggestion(name){document.getElementById('role-search-input').value=name;document.getElementById('role-suggestions').style.display='none';addRoleTag();}
function addRoleTag(){
  var input=document.getElementById('role-search-input');var name=input.value.trim();if(!name)return;
  var container=document.getElementById('pref-roles-tags');
  var existing=Array.from(container.querySelectorAll('.role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim().toLowerCase();});
  if(existing.includes(name.toLowerCase())){input.value='';return;}if(existing.length>=5)return;
  var tag=document.createElement('span');tag.className='role-tag';tag.innerHTML=esc(name)+' <button class="role-remove-btn" onclick="removeRoleTag(this)">&#xd7;</button>';
  container.appendChild(tag);input.value='';document.getElementById('role-suggestions').style.display='none';
}
function removeRoleTag(btn){btn.closest('.role-tag').remove();}
function addCustomSector(){
  var input=document.getElementById('pref-sectors-other');var name=input.value.trim();if(!name)return;
  var container=document.getElementById('pref-sectors-custom-tags');
  var existing=Array.from(container.querySelectorAll('.role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim().toLowerCase();});
  if(existing.includes(name.toLowerCase())){input.value='';return;}
  var tag=document.createElement('span');tag.className='role-tag';tag.innerHTML=esc(name)+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button>';
  container.appendChild(tag);input.value='';
}
function addCustomLocation(){
  var input=document.getElementById('pref-location-other');var name=input.value.trim();if(!name)return;
  var container=document.getElementById('pref-location-custom-tags');
  var existing=Array.from(container.querySelectorAll('.role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim().toLowerCase();});
  if(existing.includes(name.toLowerCase())){input.value='';return;}
  var tag=document.createElement('span');tag.className='role-tag';tag.innerHTML=esc(name)+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button>';
  container.appendChild(tag);input.value='';
}
document.addEventListener('click',function(e){
  var box=document.getElementById('role-suggestions');var input=document.getElementById('role-search-input');
  if(box&&input&&!box.contains(e.target)&&e.target!==input)box.style.display='none';
});

// ─── REQUIRED BADGE WATCHERS ───
function _setupRequiredBadgeWatchers(container) {
  container.querySelectorAll('.field-badge.required').forEach(function(badge) {
    var group=badge.closest('.form-group')||badge.closest('.pref-group')||(badge.closest('label')&&badge.closest('label').parentElement);
    if(!group)return;
    var chips=group.querySelector('.pref-chips');
    var input=!chips&&group.querySelector('input[type="text"],input[type="email"],textarea');
    function check(){var filled=chips?!!chips.querySelector('.pref-chip.active'):(input?input.value.trim().length>0:false);badge.style.display=filled?'none':'';}
    if(input)input.addEventListener('input',check);
    if(chips)chips.addEventListener('click',function(){setTimeout(check,0);});
    check();
  });
}

// ─── STATUS YEAR CHIPS ───
function _renderStatusYearChips(status, activeYear) {
  var wrap=document.getElementById('current-status-year-wrap');var container=document.getElementById('current-status-year-chips');if(!wrap||!container)return;
  var years=[];if(status==='Bachelor')years=['Year 1','Year 2','Year 3','Year 4','Year 5','Graduate'];else if(status==='Master')years=['Year 1','Year 2','Year 3','Graduate'];
  if(!years.length){wrap.style.display='none';container.innerHTML='';return;}
  wrap.style.display='block';
  container.innerHTML=years.map(function(y){return '<button class="pref-chip'+(y===activeYear?' active':'')+'" data-val="'+y+'">'+y+'</button>';}).join('');
  container.addEventListener('click',function(e){var btn=e.target.closest('.pref-chip');if(!btn)return;container.querySelectorAll('.pref-chip').forEach(function(c){c.classList.remove('active');});btn.classList.add('active');});
}
function _restoreCurrentStatus(cs, csYear) {
  document.querySelectorAll('#current-status-chips .pref-chip').forEach(function(c){c.classList.toggle('active',c.dataset.val===cs);});
  _renderStatusYearChips(cs,csYear);
}

// ─── BASIC INFO ───
async function toggleBasicEdit() {
  var r=document.getElementById('basic-read-view'),e=document.getElementById('basic-edit-view'),b=document.getElementById('basic-edit-btn');
  if(e.style.display!=='none'){cancelBasicEdit();return;}
  var s=currentStudent||{};
  document.getElementById('edit-basic-name').value=s.name||'';
  document.getElementById('edit-basic-bio').value=s.bio||'';
  document.getElementById('edit-basic-linkedin').value=s.linkedin||'';
  document.getElementById('edit-basic-portfolio').value=s.portfolio||'';
  document.getElementById('edit-basic-location').value=s.location||'';
  document.getElementById('edit-basic-alt-email').value=s.alt_email||'';
  var workAuthVals=(s.work_auth||'').split(',').map(function(v){return v.trim();});
  document.querySelectorAll('#edit-basic-work-auth .pref-chip').forEach(function(btn){btn.classList.toggle('active',workAuthVals.indexOf(btn.dataset.val)!==-1);});
  var seekingStatus=s.seeking_status||'';
  document.querySelectorAll('#seeking-chips .pref-chip').forEach(function(btn){btn.classList.toggle('active',btn.dataset.val===seekingStatus);});
  var cs=s.current_status||'';var csYear=s.current_status_year||'';
  _restoreCurrentStatus(cs,csYear);
  document.getElementById('current-status-chips').onclick=function(e){
    var btn=e.target.closest('.pref-chip');if(!btn)return;
    document.querySelectorAll('#current-status-chips .pref-chip').forEach(function(c){c.classList.remove('active');});btn.classList.add('active');_renderStatusYearChips(btn.dataset.val,'');
  };
  var fos=s.field_of_study||'';var knownFields=Array.from(document.querySelectorAll('#field-of-study-chips .pref-chip')).map(function(c){return c.dataset.val;});
  var isOther=fos&&!knownFields.includes(fos);
  document.querySelectorAll('#field-of-study-chips .pref-chip').forEach(function(btn){btn.classList.toggle('active',isOther?btn.dataset.val==='Other':btn.dataset.val===fos);});
  document.getElementById('field-of-study-other-wrap').style.display=isOther?'block':'none';
  document.getElementById('field-of-study-other').value=isOther?fos:'';
  document.getElementById('field-of-study-chips').onclick=function(e){
    var btn=e.target.closest('.pref-chip');if(!btn)return;
    var isOtherBtn=btn.dataset.val==='Other';
    document.getElementById('field-of-study-other-wrap').style.display=isOtherBtn?'block':'none';
    if(!isOtherBtn)document.getElementById('field-of-study-other').value='';
  };
  try { var authRes=await db.auth.getUser();document.getElementById('edit-basic-email').value=authRes.data?.user?.email||''; } catch(err){}
  r.style.display='none';e.style.display='block';b.textContent='Cancel';
  refreshCharCounters();_setupRequiredBadgeWatchers(e);
}
async function saveBasicInfo() {
  var nameEl=document.getElementById('edit-basic-name');var name=nameEl.value.trim();
  var fosChips=document.getElementById('field-of-study-chips');var fosChip=fosChips.querySelector('.pref-chip.active');
  var fosVal=fosChip?fosChip.dataset.val:'';if(fosVal==='Other')fosVal=document.getElementById('field-of-study-other').value.trim();
  var csChips=document.getElementById('current-status-chips');var workAuthChips=document.getElementById('edit-basic-work-auth');
  var ok=true;
  if(!name){_showFieldError(nameEl,'Name is required.');ok=false;}else _clearFieldError(nameEl);
  if(!fosVal){_showFieldError(fosChips,'Please select your field of study.');ok=false;}else _clearFieldError(fosChips);
  if(!csChips.querySelector('.pref-chip.active')){_showFieldError(csChips,'Please select your current status.');ok=false;}else _clearFieldError(csChips);
  if(!workAuthChips.querySelectorAll('.pref-chip.active').length){_showFieldError(workAuthChips,'Please select your work authorisation.');ok=false;}else _clearFieldError(workAuthChips);
  if(!ok){_scrollToFirstError(document.getElementById('basic-edit-view'));return;}
  var csChip=csChips.querySelector('.pref-chip.active');var csVal=csChip?csChip.dataset.val:'';
  var csYearChip=document.querySelector('#current-status-year-chips .pref-chip.active');var csYearVal=csYearChip?csYearChip.dataset.val:'';
  var updates={
    name:name,bio:document.getElementById('edit-basic-bio').value.trim(),
    work_auth:Array.from(document.querySelectorAll('#edit-basic-work-auth .pref-chip.active')).map(function(c){return c.dataset.val;}).join(', '),
    linkedin:document.getElementById('edit-basic-linkedin').value.trim(),
    portfolio:document.getElementById('edit-basic-portfolio').value.trim(),
    location:document.getElementById('edit-basic-location').value.trim(),
    alt_email:document.getElementById('edit-basic-alt-email').value.trim(),
    seeking_status:(document.querySelector('#seeking-chips .pref-chip.active')||{}).dataset?.val||'',
    field_of_study:fosVal,current_status:csVal,current_status_year:csYearVal
  };
  try {
    var res=await db.from('students').update(updates).eq('id',currentStudent.id);
    if(res.error)throw res.error;
    Object.assign(currentStudent,updates);
    // Sync cycles nav
    var navName=document.getElementById('nav-user-name');if(navName)navName.textContent=name;
    var navAv=document.getElementById('nav-avatar');if(navAv&&!currentStudent.avatar_url)navAv.textContent=name.charAt(0).toUpperCase();
    loadStudentProfile();cancelBasicEdit();
    var b=document.getElementById('basic-edit-btn');
    b.innerHTML='Edit <span class="edu-saved-toast">&#10003; Saved</span>';setTimeout(function(){b.textContent='Edit';},2500);
  } catch(err){showToast('Failed to save: '+err.message,'error');}
}
function cancelBasicEdit(){document.getElementById('basic-edit-view').style.display='none';document.getElementById('basic-read-view').style.display='block';document.getElementById('basic-edit-btn').textContent='Edit';}

// ─── DOCUMENTS ───
function toggleDocsEdit(){
  var r=document.getElementById('docs-read-view'),e=document.getElementById('docs-edit-view'),b=document.getElementById('docs-edit-btn');
  if(e.style.display!=='none'){cancelDocsEdit();return;}
  r.style.display='none';e.style.display='block';b.textContent='Cancel';
  var savedVis=currentStudent&&currentStudent.visibility;
  if(savedVis==='Community'||savedVis==='Employers only')savedVis='Public';
  document.querySelectorAll('#visibility-chips .pref-chip').forEach(function(c){c.classList.toggle('active',c.dataset.val===savedVis);});
}
async function saveDocs(){
  var r=document.getElementById('docs-read-view'),e=document.getElementById('docs-edit-view'),b=document.getElementById('docs-edit-btn');
  var visChip=document.querySelector('#visibility-chips .pref-chip.active');var visibility=visChip?visChip.dataset.val:'';
  try {
    var res=await db.from('students').update({visibility:visibility}).eq('id',currentStudent.id);
    if(res.error)throw res.error;
    if(currentStudent)currentStudent.visibility=visibility;
  } catch(err){showToast('Failed to save: '+err.message,'error');}
  r.style.display='block';e.style.display='none';
  b.innerHTML='Edit <span class="edu-saved-toast">&#10003; Saved</span>';setTimeout(function(){b.textContent='Edit';},2500);
  loadStudentProfile();
}
function cancelDocsEdit(){document.getElementById('docs-edit-view').style.display='none';document.getElementById('docs-read-view').style.display='block';document.getElementById('docs-edit-btn').textContent='Edit';}

// ─── DOM READY: confirm modal backdrop + bio counter ───
document.addEventListener('DOMContentLoaded', function() {
  var cm = document.getElementById('confirm-modal');
  if (cm) cm.addEventListener('click', function(e){ if (e.target===this) closeConfirmModal(); });
  var bioEl = document.getElementById('edit-basic-bio');
  var bioCounter = document.getElementById('edit-basic-bio-counter');
  if (bioEl && bioCounter) {
    bioEl.addEventListener('input', function() {
      var len = bioEl.value.length;
      bioCounter.textContent = len + ' / 280';
      bioCounter.style.color = len >= 252 ? '#dc2626' : 'var(--gray)';
    });
  }
  document.querySelectorAll('.edu-entry-form textarea').forEach(function(ta){ attachCounterToTextarea(ta, 500); });
});
