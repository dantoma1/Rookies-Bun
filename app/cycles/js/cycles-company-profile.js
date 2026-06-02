// ─── COMPANY PROFILE FOR CYCLES ─────────────────────────────────────────────
// `currentCompany` is synced from `currentCyclesUserData` by `openProfileScreen()`
// in cycles.js. `db` is the Supabase client from cycles.js (shared global scope).
// `esc`, `showToast`, `_showFieldError`, `_clearFieldError`, `_scrollToFirstError`,
// `_setupRequiredBadgeWatchers`, `openChangePasswordModal` come from cycles-profile.js.
var currentCompany = null;

// ─── LOAD (READ VIEW) ───────────────────────────────────────────────────────
function loadCompanyProfile() {
  if (!currentCompany) return;
  var c = currentCompany;

  // Header
  var name = c.company_name || 'Company';
  var avatarEl = document.getElementById('co-profile-avatar');
  if (avatarEl) {
    if (c.avatar_url) {
      avatarEl.style.backgroundImage = 'url(' + c.avatar_url + ')';
      avatarEl.style.backgroundSize  = 'cover';
      avatarEl.textContent = '';
    } else {
      avatarEl.textContent = name.charAt(0).toUpperCase();
      avatarEl.style.backgroundImage = '';
      if (c.color) avatarEl.style.background = c.color;
    }
  }
  var nameEl = document.getElementById('co-profile-name');
  if (nameEl) nameEl.textContent = name;
  var sectorEl = document.getElementById('co-profile-sector');
  if (sectorEl) sectorEl.textContent = c.sector || '';
  var badge = document.getElementById('co-profile-status-badge');
  if (badge) {
    var isActive = c.status === 'active' || c.status === 'approved';
    badge.textContent = isActive ? '✓ Active' : '⏳ Pending approval';
    badge.className = 'profile-badge ' + (isActive ? 'available' : 'university');
  }

  // Read rows
  _coSet('co-read-name',    c.company_name);
  _coSet('co-read-contact', c.contact_name);
  _coSet('co-read-email',   c.email);

  var websiteEl = document.getElementById('co-read-website');
  if (websiteEl) {
    if (c.website) {
      websiteEl.innerHTML = '<a href="' + esc(c.website) + '" target="_blank" rel="noopener" style="color:var(--navy);">' + esc(c.website) + '</a>';
    } else {
      websiteEl.textContent = '—';
    }
  }

  _coSet('co-read-size',        c.size);
  _coSet('co-read-sector',      c.sector);
  _coSet('co-read-description', c.description || 'No description yet — click Edit to add one.');
}

function _coSet(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val || '—';
}

// ─── TOGGLE / CANCEL EDIT ───────────────────────────────────────────────────
function toggleCompanyEdit() {
  var r = document.getElementById('co-read-view');
  var e = document.getElementById('co-edit-view');
  var b = document.getElementById('co-edit-btn');
  if (!r || !e || !b) return;

  if (e.style.display !== 'none') { cancelCompanyEdit(); return; }

  var c = currentCompany || {};

  // Populate fields
  document.getElementById('co-edit-name').value    = c.company_name || '';
  document.getElementById('co-edit-website').value = c.website || '';
  document.getElementById('co-edit-description').value = c.description || '';

  var nameParts = (c.contact_name || '').split(' ');
  document.getElementById('co-edit-firstname').value = nameParts[0] || '';
  document.getElementById('co-edit-lastname').value  = nameParts.slice(1).join(' ') || '';

  db.auth.getUser().then(function(res) {
    var email = res.data && res.data.user ? res.data.user.email : '';
    document.getElementById('co-edit-email').value = email || c.email || '';
  }).catch(function(){});

  // Size chips (single-select)
  document.querySelectorAll('#co-size-chips .pref-chip').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.val === c.size);
  });

  // Sector chips — handle custom sector
  var knownSectors = Array.from(document.querySelectorAll('#co-sector-chips .pref-chip')).map(function(b) { return b.dataset.val; });
  var isCustom = c.sector && !knownSectors.includes(c.sector);
  document.querySelectorAll('#co-sector-chips .pref-chip').forEach(function(btn) {
    btn.classList.toggle('active', isCustom ? btn.dataset.val === 'Other' : btn.dataset.val === c.sector);
  });
  var otherWrap  = document.getElementById('co-sector-other-wrap');
  var otherInput = document.getElementById('co-sector-other');
  if (otherWrap)  otherWrap.style.display  = isCustom ? 'block' : 'none';
  if (otherInput) otherInput.value = isCustom ? c.sector : '';

  // Sector chips — attach "Other" toggle
  document.getElementById('co-sector-chips').onclick = function(ev) {
    var btn = ev.target.closest('.pref-chip');
    if (!btn) return;
    var isOther = btn.dataset.val === 'Other';
    if (otherWrap) otherWrap.style.display = isOther ? 'block' : 'none';
    if (!isOther && otherInput) otherInput.value = '';
  };

  // Description char counter
  var descEl  = document.getElementById('co-edit-description');
  var counter = document.getElementById('co-description-counter');
  if (descEl && counter) {
    var updateCounter = function() {
      var len = descEl.value.length;
      counter.textContent = len + ' / 2000';
      counter.style.color = len >= 1800 ? '#dc2626' : 'var(--gray)';
    };
    updateCounter();
    descEl.oninput = updateCounter;
  }

  document.getElementById('co-edit-error').style.display = 'none';
  r.style.display  = 'none';
  e.style.display  = 'block';
  b.textContent    = 'Cancel';

  _setupRequiredBadgeWatchers(e);
}

function cancelCompanyEdit() {
  document.getElementById('co-read-view').style.display = '';
  document.getElementById('co-edit-view').style.display = 'none';
  document.getElementById('co-edit-btn').textContent    = 'Edit';
}

// ─── SAVE ────────────────────────────────────────────────────────────────────
async function saveCompanyProfile() {
  var nameEl     = document.getElementById('co-edit-name');
  var websiteEl  = document.getElementById('co-edit-website');
  var descEl     = document.getElementById('co-edit-description');
  var sizeChips  = document.getElementById('co-size-chips');
  var sectorChips = document.getElementById('co-sector-chips');

  var companyName = nameEl.value.trim();
  var website     = websiteEl.value.trim();
  var desc        = descEl.value.trim();
  var first       = document.getElementById('co-edit-firstname').value.trim();
  var last        = document.getElementById('co-edit-lastname').value.trim();
  var size        = (sizeChips.querySelector('.pref-chip.active') || {}).dataset.val || null;
  var sector      = (sectorChips.querySelector('.pref-chip.active') || {}).dataset.val || null;
  if (sector === 'Other') {
    sector = (document.getElementById('co-sector-other') || {}).value.trim() || null;
  }

  var ok = true;
  if (!companyName) { _showFieldError(nameEl, 'Company name is required.');        ok = false; } else _clearFieldError(nameEl);
  if (!website)     { _showFieldError(websiteEl, 'Website is required.');           ok = false; } else _clearFieldError(websiteEl);
  if (!size)        { _showFieldError(sizeChips, 'Please select a company size.');  ok = false; } else _clearFieldError(sizeChips);
  if (!sector)      { _showFieldError(sectorChips, 'Please select a sector.');      ok = false; } else _clearFieldError(sectorChips);
  if (!desc)        { _showFieldError(descEl, 'Please add a company description.'); ok = false; } else _clearFieldError(descEl);
  if (!ok) { _scrollToFirstError(document.getElementById('co-edit-view')); return; }

  document.getElementById('co-edit-error').style.display = 'none';

  var updates = {
    company_name: companyName,
    contact_name: (first + ' ' + last).trim() || null,
    website:      website,
    description:  desc,
    size:         size,
    sector:       sector
  };

  try {
    var res = await db.from('employers').update(updates).eq('id', currentCompany.id);
    if (res.error) throw res.error;
    Object.assign(currentCompany, updates);

    // Sync cycles nav
    var navName = document.getElementById('nav-user-name');
    if (navName) navName.textContent = companyName;
    var navAv = document.getElementById('nav-avatar');
    if (navAv) navAv.textContent = companyName.charAt(0).toUpperCase();

    loadCompanyProfile();
    cancelCompanyEdit();

    var b = document.getElementById('co-edit-btn');
    b.innerHTML = 'Edit <span class="edu-saved-toast">&#10003; Saved</span>';
    setTimeout(function() { b.textContent = 'Edit'; }, 2500);
  } catch (err) {
    var errEl = document.getElementById('co-edit-error');
    errEl.textContent = err.message || 'Failed to save. Please try again.';
    errEl.style.display = 'block';
  }
}
