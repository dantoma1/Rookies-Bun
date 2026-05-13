  // ─── XSS ESCAPE HELPER ───
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── SUPABASE INIT ───
  var SUPABASE_URL = 'https://ymkysqejyfsgyoauhjvp.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlta3lzcWVqeWZzZ3lvYXVoanZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjMyMjksImV4cCI6MjA4OTU5OTIyOX0.dAYXobPTOv3YW_PqxSF654In29qwdkfyVwNo2opW7so';
  var db = null;
  var currentEmployer = null;
  var currentStudent = null;   // set on student / admin login
  var currentLoginRole = null; // 'student' | 'company' | 'admin'

  // ─── NAV STATE ───
  function updateNav() {
    var navGuest   = document.getElementById('nav-guest');
    var navStudent = document.getElementById('nav-student');
    var navCompany = document.getElementById('nav-company');
    if (currentStudent) {
      navGuest.style.display   = 'none';
      navStudent.style.display = 'flex';
      navCompany.style.display = 'none';
    } else if (currentEmployer) {
      navGuest.style.display   = 'none';
      navStudent.style.display = 'none';
      // Only show full company nav if approved
      if (currentEmployer.status === 'approved' || !currentEmployer.status) {
        navCompany.style.display = 'flex';
      } else {
        // Pending/rejected — show only sign out
        navCompany.style.display = 'none';
        navGuest.style.display = 'flex';
        // Replace guest buttons with just a sign out
        var guestBtns = navGuest.querySelector('.nav-links') || navGuest;

      }
    } else {
      navGuest.style.display   = 'flex';
      navStudent.style.display = 'none';
      navCompany.style.display = 'none';
      // Remove pending signout if present
      var ps = document.getElementById('nav-pending-signout');
      if (ps) ps.remove();
    }
  }

  // ─── PROFILE OR GUEST PROMPT ───
  function goToProfileOrPrompt() {
    showScreen('student-profile');
    loadStudentProfile();
  }

  // ─── LOGIN SCREEN LOGIC ───
  function selectLoginRole(role) {
    currentLoginRole = role;
    var icons  = { student: '🎓', company: '🏢', admin: '⚡' };
    var titles = { student: 'Student sign in', company: 'Company sign in', admin: 'Admin sign in' };
    var subs   = { student: 'Access your profile and applications', company: 'Manage your listings and applicants', admin: 'Full platform access' };
    document.getElementById('login-role-icon').textContent  = icons[role];
    document.getElementById('login-form-title').textContent = titles[role];
    document.getElementById('login-form-sub').textContent   = subs[role];
    document.getElementById('login-role-select').style.display  = 'none';
    document.getElementById('login-form-panel').style.display   = 'block';
    document.getElementById('login-email').value    = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').style.display = 'none';
  }

  function backToRoleSelect() {
    document.getElementById('login-role-select').style.display = 'block';
    document.getElementById('login-form-panel').style.display  = 'none';
    currentLoginRole = null;
  }

  async function submitLogin() {
    var email = document.getElementById('login-email').value.trim();
    var pw    = document.getElementById('login-password').value;
    var errEl = document.getElementById('login-error');
    var btn   = document.getElementById('login-submit-btn');
    errEl.style.display = 'none';
    if (!email || !pw) { showLoginError('Please enter your email and password.'); return; }
    btn.textContent = 'Signing in…'; btn.disabled = true;

    try {
      if (currentLoginRole === 'admin') {
        // Admin: authenticate via Supabase, then verify is_admin flag in students table
        var a = await db.auth.signInWithPassword({ email: email, password: pw });
        if (a.error) throw a.error;
        var sRes = await db.from('students').select('*').eq('is_admin', true).limit(1);
        if (sRes.error || !sRes.data || !sRes.data.length) throw new Error('No admin profile found.');
        currentStudent = sRes.data[0];
        updateNav();
        showScreen('student-profile');
        loadAdminProfile();
        showToast('Welcome back, ' + currentStudent.name + '! 👋');

      } else if (currentLoginRole === 'student') {
        var a = await db.auth.signInWithPassword({ email: email, password: pw });
        if (a.error) throw a.error;
        // Look up the student row that matches this auth user's ID
        var sRes = await db.from('students').select('*').eq('id', a.data.user.id).single();
        if (sRes.error || !sRes.data) {
          // No student row found — sign out and reject. This may be a company account.
          await db.auth.signOut();
          throw new Error('No student account found for this email. If you have a company account, please use the Company login instead.');
        }
        currentStudent = sRes.data;
        updateNav();
        showScreen('student-browse');
        loadJobsFromDB();
        loadStudentProfile();
        showToast('Welcome back, ' + (currentStudent.name || email) + '!');

      } else if (currentLoginRole === 'company') {
        var result = await rookieLogin(email, pw);
        if (!result.success) throw new Error(result.message || 'Login failed.');
        updateNav();
        showScreen('company-dash');
        loadCompanyDashboard();
      }
    } catch(err) {
      showLoginError(err.message || 'Incorrect email or password.');
    } finally {
      btn.textContent = 'Sign in'; btn.disabled = false;
    }
  }

  function showLoginError(msg) {
    var el = document.getElementById('login-error');
    el.textContent = msg; el.style.display = 'block';
  }

  // ─── SIGNUP HELPERS ───
  function getActiveChip(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return '';
    var active = el.querySelector('.pref-chip.active');
    return active ? active.dataset.val : '';
  }
  function getActiveChips(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return [];
    return Array.from(el.querySelectorAll('.pref-chip.active')).map(function(c){ return c.dataset.val; });
  }
  function showSignupError(id, msg) {
    var el = document.getElementById(id);
    el.textContent = msg; el.style.display = 'block';
  }
  function hideSignupError(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  // ─── MODAL BODY-SCROLL LOCK ───
  // Watches every .modal-overlay; toggles body.modal-open when any are open.
  // Combined with overscroll-behavior:contain in CSS, this prevents the page
  // underneath from scrolling when the user wheels inside a modal.
  document.addEventListener('DOMContentLoaded', function() {
    const sync = () => {
      const open = document.querySelector('.modal-overlay.open');
      document.body.classList.toggle('modal-open', !!open);
    };
    const obs = new MutationObserver(sync);
    document.querySelectorAll('.modal-overlay').forEach(m => {
      obs.observe(m, { attributes: true, attributeFilter: ['class'] });
    });
    sync(); // initial state
  });

  // ─── SIGNUP BLUR VALIDATION ───
  document.addEventListener('DOMContentLoaded', function() {
    function _onBlurCheck(id, checkFn) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('blur', checkFn);
      el.addEventListener('input', function() { if (el.classList.contains('error')) checkFn(); });
    }
    _onBlurCheck('ss-firstname', function() {
      var el = document.getElementById('ss-firstname');
      if (!el.value.trim()) _showFieldError(el, 'Please enter your first name.');
      else _clearFieldError(el);
    });
    _onBlurCheck('ss-lastname', function() {
      var el = document.getElementById('ss-lastname');
      if (!el.value.trim()) _showFieldError(el, 'Please enter your last name.');
      else _clearFieldError(el);
    });
    _onBlurCheck('ss-email', function() {
      var el = document.getElementById('ss-email');
      if (!el.value.trim()) _showFieldError(el, 'Please enter your email address.');
      else if (!_isValidEmail(el.value.trim())) _showFieldError(el, 'Please enter a valid email address.');
      else _clearFieldError(el);
    });
    _onBlurCheck('ss-password', function() {
      var el = document.getElementById('ss-password');
      if (el.value.length > 0 && el.value.length < 8) _showFieldError(el, 'Password must be at least 8 characters.');
      else _clearFieldError(el);
    });
    _onBlurCheck('ss-password2', function() {
      var el = document.getElementById('ss-password2');
      var pw = document.getElementById('ss-password');
      if (el.value && pw && el.value !== pw.value) _showFieldError(el, 'Passwords do not match.');
      else _clearFieldError(el);
    });
    _onBlurCheck('cs-company', function() {
      var el = document.getElementById('cs-company');
      if (!el.value.trim()) _showFieldError(el, 'Please enter your company name.');
      else _clearFieldError(el);
    });
    _onBlurCheck('cs-email', function() {
      var el = document.getElementById('cs-email');
      if (!el.value.trim()) _showFieldError(el, 'Please enter your work email.');
      else if (!_isValidEmail(el.value.trim())) _showFieldError(el, 'Please enter a valid email address.');
      else _clearFieldError(el);
    });
    _onBlurCheck('cs-password', function() {
      var el = document.getElementById('cs-password');
      if (el.value.length > 0 && el.value.length < 8) _showFieldError(el, 'Password must be at least 8 characters.');
      else _clearFieldError(el);
    });
    _onBlurCheck('cs-password2', function() {
      var el = document.getElementById('cs-password2');
      var pw = document.getElementById('cs-password');
      if (el.value && pw && el.value !== pw.value) _showFieldError(el, 'Passwords do not match.');
      else _clearFieldError(el);
    });
  });

  // ─── STUDENT SIGNUP ───
  async function studentSignupSubmit() {
    hideSignupError('ss-error-1');
    var firstEl = document.getElementById('ss-firstname');
    var lastEl  = document.getElementById('ss-lastname');
    var emailEl = document.getElementById('ss-email');
    var pwEl    = document.getElementById('ss-password');
    var pw2El   = document.getElementById('ss-password2');
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
        // Email confirmation required — store pending data and show verify screen
        localStorage.setItem('rookies_pending_type', 'student');
        localStorage.setItem('rookies_pending_name', first + ' ' + last);
        localStorage.setItem('rookies_pending_email', email);
        document.getElementById('verify-email-address').textContent = email;
        btn.textContent = 'Create account →'; btn.disabled = false;
        showScreen('verify-email');
        return;
      }
      // Email confirmation disabled (dev/testing) — create row immediately
      var name   = first + ' ' + last;
      var colors = ['#e8622a','#1565c0','#2e7d52','#6a1b9a','#c0392b','#4a148c','#0f1f3d'];
      var color  = colors[Math.floor(Math.random() * colors.length)];
      var row = {
        id: a.data.user.id,
        name: name, color: color, initial: first[0].toUpperCase(),
        pref_roles: [], skills_technical: [], skills_professional: [],
        skills_languages: [], education: [], experience: [], orgs: [], docs: [],
        is_active: true, is_admin: false
      };
      var ins = await db.from('students').insert([row]);
      if (ins.error) throw ins.error;
      currentStudent = row;
      updateNav();
      showToast('Welcome to Rookies, ' + first + '!');
      showScreen('student-profile');
      loadStudentProfile();
      loadStudentsFromDB();
    } catch(err) {
      var msg = err.message || 'Something went wrong. Please try again.';
      if (msg.toLowerCase().includes('should contain at least one character of each')) msg = 'Password must include at least one uppercase letter, one lowercase letter, and one number.';
      showSignupError('ss-error-1', msg);
      btn.textContent = 'Create account →'; btn.disabled = false;
    }
  }

  // ─── COMPANY SIGNUP ───
  var csData = {};

  async function companySignupSubmit() {
    hideSignupError('cs-error-1');
    var companyEl = document.getElementById('cs-company');
    var emailEl   = document.getElementById('cs-email');
    var pwEl      = document.getElementById('cs-password');
    var pw2El     = document.getElementById('cs-password2');
    var company = companyEl.value.trim(), email = emailEl.value.trim();
    var pw = pwEl.value, pw2 = pw2El.value;
    var ok = true;
    if (!company) { _showFieldError(companyEl, 'Please enter your company name.'); ok = false; } else _clearFieldError(companyEl);
    if (!email) { _showFieldError(emailEl, 'Please enter your work email.'); ok = false; }
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
      if (!a.data.session) {
        // Email confirmation required — store pending data and show verify screen
        localStorage.setItem('rookies_pending_type', 'company');
        localStorage.setItem('rookies_pending_company', company);
        localStorage.setItem('rookies_pending_email', email);
        document.getElementById('verify-email-address').textContent = email;
        btn.textContent = 'Create account →'; btn.disabled = false;
        showScreen('verify-email');
        return;
      }
      // Email confirmation disabled (dev/testing) — create row immediately
      var ins = await db.from('employers').insert([{
        id: a.data.user.id,
        email: email,
        company_name: company,
        status: 'pending'
      }]);
      if (ins.error) throw ins.error;
      currentEmployer = { id: a.data.user.id, email: email, company_name: company, status: 'pending' };
      updateNav();
      showScreen('company-pending');
    } catch(err) {
      var msg = err.message || 'Something went wrong. Please try again.';
      if (msg.toLowerCase().includes('should contain at least one character of each')) msg = 'Password must include at least one uppercase letter, one lowercase letter, and one number.';
      showSignupError('cs-error-1', msg);
      btn.textContent = 'Create account →'; btn.disabled = false;
    }
  }
  try {
    var _sb = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
    if (_sb) { db = _sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); }
    else { console.warn('Supabase CDN not loaded yet — db will init on DOMContentLoaded'); }
  } catch(e) { console.warn('Supabase init error:', e.message); }

  function showToast(message, type) {
    var ex=document.getElementById('rookie-toast'); if(ex) ex.remove();
    var t=document.createElement('div'); t.id='rookie-toast';
    t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:'+(type==='error'?'#c0392b':'#2e7d52')+';color:white;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.2);font-family:"DM Sans",sans-serif;';
    t.textContent=message; document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); },3500);
  }

  async function checkSession() {
    try {
      var s = await db.auth.getSession();
      if (s.data && s.data.session) {
        const userId = s.data.session.user.id;
        var emp = await db.from('employers').select('*').eq('id', userId).single();
        if (emp.data) {
          currentEmployer = emp.data;
          currentStudent = null;
          console.log('Logged in as Employer:', currentEmployer.company_name, '| status:', currentEmployer.status);
          if (currentEmployer.status === 'pending') {
            showScreen('company-pending');
            updateNav();
            return;
          }
          if (currentEmployer.status === 'rejected') {
            showScreen('company-rejected');
            updateNav();
            return;
          }
          if (typeof loadCompanyDashboard === 'function') loadCompanyDashboard();
          updateNav();
          return;
        }
        var stu = await db.from('students').select('*').eq('id', userId).single();
        if (stu.data) {
          currentStudent = stu.data;
          currentEmployer = null;
          console.log('Logged in as Student:', currentStudent.name);
          loadStudentProfile();
          loadJobsFromDB();
          updateNav();
          return;
        }

        // No DB row found — user may have just verified their email
        var pendingType = localStorage.getItem('rookies_pending_type');
        if (pendingType === 'student') {
          var pendingName  = localStorage.getItem('rookies_pending_name') || s.data.session.user.email;
          var pendingFirst = pendingName.split(' ')[0];
          var colors = ['#e8622a','#1565c0','#2e7d52','#6a1b9a','#c0392b','#4a148c','#0f1f3d'];
          var color  = colors[Math.floor(Math.random() * colors.length)];
          var row = {
            id: userId,
            name: pendingName, color: color, initial: pendingFirst[0].toUpperCase(),
            pref_roles: [], skills_technical: [], skills_professional: [],
            skills_languages: [], education: [], experience: [], orgs: [], docs: [],
            is_active: true, is_admin: false
          };
          var ins = await db.from('students').insert([row]);
          if (!ins.error) {
            localStorage.removeItem('rookies_pending_type');
            localStorage.removeItem('rookies_pending_name');
            localStorage.removeItem('rookies_pending_email');
            currentStudent = row;
            updateNav();
            showToast('Email verified! Welcome to Rookies, ' + pendingFirst + '!');
            showScreen('student-profile');
            loadStudentProfile();
            loadStudentsFromDB();
          }
          return;
        }
        if (pendingType === 'company') {
          var pendingCompany = localStorage.getItem('rookies_pending_company') || '';
          var pendingEmail   = s.data.session.user.email;
          var ins2 = await db.from('employers').insert([{
            id: userId, email: pendingEmail, company_name: pendingCompany, status: 'pending'
          }]);
          if (!ins2.error) {
            localStorage.removeItem('rookies_pending_type');
            localStorage.removeItem('rookies_pending_company');
            localStorage.removeItem('rookies_pending_email');
            currentEmployer = { id: userId, email: pendingEmail, company_name: pendingCompany, status: 'pending' };
            updateNav();
            showScreen('company-pending');
          }
          return;
        }
      }
    } catch(e) {
      console.log('No active session found.');
    }
    updateNav();
  }

  async function resendVerificationEmail() {
    var email = localStorage.getItem('rookies_pending_email');
    if (!email) { showToast('No pending verification found.', 'error'); return; }
    var res = await db.auth.resend({ type: 'signup', email: email });
    if (res.error) showToast('Could not resend: ' + res.error.message, 'error');
    else showToast('Verification email resent — check your inbox.');
  }

  async function rookieStudentSignup(email, password, name) {
    try {
      const { data, error } = await db.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('Check your Supabase Email Auth settings.');
      const { error: dbError } = await db.from('students').insert([{
        id: data.user.id,
        name: name,
        university: 'Tilburg University',
        is_active: true,
        is_admin: false,
        color: '#0f1f3d',
        initial: name.charAt(0).toUpperCase()
      }]);
      if (dbError) throw dbError;
      currentStudent = { id: data.user.id, name: name };
      currentEmployer = null;
      console.log('Student account created:', name);
      return { success: true };
    } catch (err) {
      console.error('Signup Error:', err.message);
      return { success: false, message: err.message };
    }
  }

  async function rookieCompanySignup(email, password, companyName) {
    try {
      var a=await db.auth.signUp({email:email,password:password});
      if (a.error) throw a.error;
      await db.from('employers').insert([{id:a.data.user.id,email:email,company_name:companyName}]);
      currentEmployer={id:a.data.user.id,email:email,company_name:companyName};
      showToast('Welcome to Rookies, '+companyName+'!');
      return {success:true};
    } catch(err) { showToast('Signup failed: '+err.message,'error'); return {success:false}; }
  }

  // Keep old name as alias for any legacy calls
  var rookieSignup = rookieCompanySignup;

  async function rookieLogin(email, password) {
    try {
      var a=await db.auth.signInWithPassword({email:email,password:password});
      if (a.error) throw a.error;
      var r=await db.from('employers').select('*').eq('id',a.data.user.id).single();
      if (r.error || !r.data) {
        await db.auth.signOut();
        throw new Error('No company account found for this email. If you have a student account, please use the Student login instead.');
      }
      currentEmployer=r.data;
      showToast('Welcome back, '+currentEmployer.company_name+'!');
      return {success:true};
    } catch(err) { return {success:false, message: err.message}; }
  }

  async function uploadCV(input) {
    var file = input.files[0];
    if (!file || !currentStudent) return;
    if (file.size > 10 * 1024 * 1024) { showToast('CV must be under 10MB', 'error'); return; }
    if (file.type !== 'application/pdf') { showToast('Please upload a PDF file', 'error'); return; }

    var statusEl = document.getElementById('cv-upload-status');
    var box = document.getElementById('cv-upload-box');
    if (statusEl) { statusEl.style.display = 'block'; statusEl.style.color = 'var(--gray)'; statusEl.textContent = 'Uploading…'; }

    var path = currentStudent.id + '.pdf';
    var uploadRes = await db.storage.from('cvs').upload(path, file, { upsert: true, contentType: 'application/pdf' });
    if (uploadRes.error) { showToast('Upload failed: ' + uploadRes.error.message, 'error'); if (statusEl) statusEl.textContent = 'Upload failed.'; return; }

    var urlRes = db.storage.from('cvs').getPublicUrl(path);
    var url = urlRes.data.publicUrl;

    await db.from('students').update({ cv_url: url }).eq('id', currentStudent.id);
    currentStudent.cv_url = url;

    if (box) box.innerHTML = '<span style="font-size:20px;">📄</span><div style="font-size:13px;color:var(--navy);font-weight:600;">' + esc(file.name) + '<br><span style="font-size:11px;color:var(--gray);font-weight:400;">Uploaded successfully</span></div>';
    if (statusEl) statusEl.style.display = 'none';

    // Update read view
    var cvReadEl = document.getElementById('cv-read-link');
    if (cvReadEl) { cvReadEl.innerHTML = '<a href="' + url + '" target="_blank" style="color:var(--navy);text-decoration:underline;">View CV →</a>'; }

    showToast('CV uploaded ✓');
    input.value = '';
  }

  async function uploadAvatar(input) {
    var file = input.files[0];
    if (!file || !currentStudent) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB', 'error'); return; }
    var allowedTypes = ['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
    if (!allowedTypes.includes(file.type)) { showToast('Please use JPG, PNG or WebP format', 'error'); return; }

    showToast('Uploading photo…');
    var ext = file.name.split('.').pop();
    var path = currentStudent.id + '.' + ext;

    var uploadRes = await db.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadRes.error) { showToast('Upload failed: ' + uploadRes.error.message, 'error'); return; }

    var urlRes = db.storage.from('avatars').getPublicUrl(path);
    var url = urlRes.data.publicUrl;

    await db.from('students').update({ avatar_url: url }).eq('id', currentStudent.id);
    currentStudent.avatar_url = url;

    // Update avatar in hero
    var av = document.getElementById('profile-avatar');
    if (av) {
      av.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;">';
      av.style.background = 'transparent';
    }
    showToast('Photo updated ✓');
    input.value = '';
  }

  async function rookieLogout() {
    await db.auth.signOut();
    currentEmployer = null;
    currentStudent = null;
    updateNav();
    showScreen('landing');
    showToast('Signed out successfully.');
  }

  // ─── MATCH SCORE 2.0 ────────────────────────────────────────────────────
  // 20-point formula across four buckets, normalised to 0–100%.
  //   Logistics gates:  job type (3), location (2), sector (2), school year (2), duration (1)
  //   Background:       field of study (1)
  //   Capability:       technical skills (4), languages (2), professional skills (1)
  //   Motivation:       role interest vs job title (2)
  // Categories the job didn't populate are EXCLUDED from the denominator —
  // a sparsely filled posting doesn't artificially deflate scores, and a
  // richly filled one rewards depth of fit.
  function matchScore(student, job) {
    if (!student || !job) return 0;

    // Normalise a skill list (strings, JSON-strings, {name}) → lowercase,
    // strip parenthetical detail like "Python (NumPy, pandas)" → "python".
    function normSkillList(arr) {
      if (!arr) return [];
      if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch(e) { return []; } }
      if (!Array.isArray(arr)) return [];
      return arr.map(function(sk){
        if (!sk) return '';
        var name = '';
        if (typeof sk === 'object') name = sk.name || '';
        else if (typeof sk === 'string') {
          try { var p = JSON.parse(sk); name = p.name || sk; } catch(e) { name = sk; }
        }
        return name.replace(/\([^)]*\)/g, '').toLowerCase().trim();
      }).filter(Boolean);
    }

    // Normalise role_interests (JSON array of strings or {name}).
    function normRoles(val) {
      if (!val) return [];
      if (typeof val === 'string') { try { val = JSON.parse(val); } catch(e) { return []; } }
      if (!Array.isArray(val)) return [];
      return val.map(function(r){
        if (!r) return '';
        if (typeof r === 'object') return (r.name || '').toLowerCase().trim();
        return String(r).toLowerCase().trim();
      }).filter(Boolean);
    }

    // Coverage = overlap / wanted, capped at 1.0. Returns null when the
    // job didn't list any wanted skills in this subcategory.
    function coverage(studentArr, wantedArr) {
      if (!wantedArr || wantedArr.length === 0) return null;
      var sset = studentArr.slice();
      var hit = 0;
      wantedArr.forEach(function(w){
        if (!w) return;
        if (sset.indexOf(w) !== -1) { hit++; return; }
        // Lenient match: parenthetical-stripped substring either way
        for (var i = 0; i < sset.length; i++) {
          var s = sset[i];
          if (s && (s === w || s.indexOf(w) !== -1 || w.indexOf(s) !== -1)) { hit++; return; }
        }
      });
      return Math.min(1, hit / wantedArr.length);
    }

    // Role interest vs job title: 2 (strong substring), 1 (loose word), 0.
    // Returns null when the job has no title at all.
    function roleInterestPoints(roles, title) {
      if (!title) return null;
      if (!roles.length) return 0;
      var t = title.toLowerCase();
      for (var i = 0; i < roles.length; i++) {
        var r = roles[i];
        if (!r) continue;
        if (t.indexOf(r) !== -1 || r.indexOf(t) !== -1) return 2;
      }
      var stop = {'intern':1,'junior':1,'senior':1,'assistant':1,'trainee':1,'graduate':1,'student':1,'role':1,'position':1};
      var titleWords = t.split(/[^a-z0-9]+/).filter(function(w){ return w.length >= 4 && !stop[w]; });
      var titleSet = {};
      titleWords.forEach(function(w){ titleSet[w] = 1; });
      for (var j = 0; j < roles.length; j++) {
        var rw = roles[j].split(/[^a-z0-9]+/);
        for (var k = 0; k < rw.length; k++) {
          if (rw[k].length >= 4 && !stop[rw[k]] && titleSet[rw[k]]) return 1;
        }
      }
      return 0;
    }

    var earned = 0, possible = 0;

    // 1. Job type (3)
    if (job.job_type) {
      possible += 3;
      var sPrefTypes = (student.pref_type||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
      if (sPrefTypes.indexOf(job.job_type) !== -1) earned += 3;
    }

    // 2. Location (2)
    var jLocs = (job.location||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
    if (jLocs.length) {
      possible += 2;
      var sLocs = (student.pref_locations||'').split(',').map(function(s){return s.trim();});
      if (sLocs.indexOf('Open to anywhere') !== -1 || sLocs.some(function(l){ return jLocs.indexOf(l) !== -1; })) earned += 2;
    }

    // 3. Sector (2)
    var jSectors = (job.field||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
    if (jSectors.length) {
      possible += 2;
      var sSectors = (student.pref_sectors||'').split(',').map(function(s){return s.trim();});
      if (sSectors.some(function(s){ return jSectors.indexOf(s) !== -1; })) earned += 2;
    }

    // 4. School year / target candidate (2)
    var jTargets = (job.school_year||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
    if (jTargets.length) {
      possible += 2;
      var sStatus = (student.current_status||'').trim();
      if (sStatus && jTargets.indexOf(sStatus) !== -1) earned += 2;
    }

    // 5. Duration (1)
    if (job.duration) {
      possible += 1;
      var sDurs = (student.pref_duration||'').split(',').map(function(s){return s.trim();});
      if (sDurs.indexOf('Flexible') !== -1 || job.duration === 'Flexible' || sDurs.indexOf(job.duration) !== -1) earned += 1;
    }

    // 6. Field of study (1) — reduced from 2; skills now carry related signal directly
    var jMajors = (job.majors||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
    if (jMajors.length) {
      possible += 1;
      var sField = (student.field_of_study||'').trim();
      if (jMajors.indexOf('Any') !== -1 || (sField && jMajors.indexOf(sField) !== -1)) earned += 1;
    }

    // 7-9. Skills coverage — technical (4), languages (2), professional (1)
    var ss = job.searched_skills;
    if (typeof ss === 'string') { try { ss = JSON.parse(ss); } catch(e) { ss = null; } }
    ss = ss || {};
    var sTech = normSkillList(student.skills_technical);
    var sLang = normSkillList(student.skills_languages);
    var sProf = normSkillList(student.skills_professional);
    var jTech = normSkillList(ss.technical);
    var jLang = normSkillList(ss.languages);
    var jProf = normSkillList(ss.professional);
    var cTech = coverage(sTech, jTech);
    var cLang = coverage(sLang, jLang);
    var cProf = coverage(sProf, jProf);
    if (cTech !== null) { possible += 4; earned += cTech * 4; }
    if (cLang !== null) { possible += 2; earned += cLang * 2; }
    if (cProf !== null) { possible += 1; earned += cProf * 1; }

    // 10. Role interest (2)
    var rp = roleInterestPoints(normRoles(student.role_interests), job.title);
    if (rp !== null) { possible += 2; earned += rp; }

    if (possible <= 0) return 0;
    return Math.round((earned / possible) * 100);
  }

  // Renders the standard match-score pill (▲ NN%) with the project's three colour thresholds.
  // Used on student-side job cards and company-side applicant rows / student cards.
  function matchBadgeHTML(pct) {
    if (pct === null || pct === undefined) return '';
    var color = pct >= 70 ? '#2e7d32' : pct >= 40 ? 'var(--orange)' : 'var(--gray)';
    return '<span style="font-size:12px;font-weight:700;color:'+color+';white-space:nowrap;">&#9650; '+pct+'%</span>';
  }

  // Given a student and an array of jobs (typically a company's active jobs),
  // return { pct, job } for the best-fitting job. Used in the company Students browse.
  function bestMatchAcrossJobs(student, jobs) {
    if (!student || !jobs || !jobs.length) return { pct: null, job: null };
    var best = { pct: -1, job: null };
    jobs.forEach(function(j) {
      var p = matchScore(student, j);
      if (p > best.pct) { best.pct = p; best.job = j; }
    });
    return { pct: best.pct < 0 ? null : best.pct, job: best.job };
  }

  // ─── LLM MATCH SCORING (score-match Edge Function) ───
  // Session-scoped in-memory cache. The DB also caches with a 14-day TTL;
  // this just avoids re-invoking the function when reopening the same job
  // within a tab session.
  window._llmScoreCache = window._llmScoreCache || {};

  // Tracks which job the AI insights panel is currently rendering. If the user
  // opens a different job while a fetch is in flight, the stale response is dropped.
  var _activeAiJobId = null;

  async function fetchLLMScore(student, job) {
    if (!student || !student.id || !job || !job.id) return null;
    var key = student.id + '_' + job.id;
    if (window._llmScoreCache[key]) return window._llmScoreCache[key];
    try {
      var res = await db.functions.invoke('score-match', {
        body: { student_id: student.id, job_id: job.id }
      });
      if (res.error || !res.data) return null;
      window._llmScoreCache[key] = res.data;
      return res.data;
    } catch (e) {
      console.error('fetchLLMScore error:', e);
      return null;
    }
  }

  function aiDimRowHTML(label, score, rationale) {
    var color = score >= 70 ? '#2e7d32' : score >= 40 ? 'var(--orange)' : 'var(--gray)';
    return '<div class="ai-dim-row">'
      +   '<div class="ai-dim-label">' + esc(label) + '</div>'
      +   '<div class="ai-dim-score" style="color:' + color + ';">' + score + '</div>'
      +   '<div class="ai-dim-rationale">' + esc(rationale) + '</div>'
      + '</div>';
  }

  function renderAiInsights(container, data) {
    container.innerHTML =
        aiDimRowHTML('Education',  data.education_fit,     data.education_rationale)
      + aiDimRowHTML('Experience', data.experience_fit,    data.experience_rationale)
      + aiDimRowHTML('Projects',   data.project_relevance, data.project_rationale)
      + aiDimRowHTML('Trajectory', data.trajectory_fit,    data.trajectory_rationale);
  }

  function filterJobCards(query) {
    var q = (query || '').toLowerCase().trim();
    var cards = document.querySelectorAll('#screen-student-browse .job-card');
    var visible = 0;
    cards.forEach(function(card) {
      var match = !q || (card.dataset.search && card.dataset.search.includes(q));
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    var countEl = document.querySelector('.results-count strong');
    if (countEl) countEl.textContent = visible + ' of ' + _allJobs.length;
  }

  var _allJobs = [];

  function _deadlineToDate(job) {
    var months = {January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12};
    if (!job.deadline_month || !job.deadline_year) return new Date(9999, 0);
    return new Date(parseInt(job.deadline_year), (months[job.deadline_month] || 1) - 1);
  }

  function renderJobList(jobs) {
    var sortEl = document.getElementById('job-sort-select');
    var sortVal = sortEl ? sortEl.value : 'match';
    var sorted = jobs.slice();

    if (sortVal === 'match' && currentStudent) {
      sorted.sort(function(a, b) { return matchScore(currentStudent, b) - matchScore(currentStudent, a); });
    } else if (sortVal === 'recent') {
      sorted.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    } else if (sortVal === 'deadline') {
      sorted.sort(function(a, b) { return _deadlineToDate(a) - _deadlineToDate(b); });
    }

    var jobList = document.getElementById('job-list');
    if (!jobList) return;
    jobList.innerHTML = '';

    sorted.forEach(function(job) {
      var pct = currentStudent ? matchScore(currentStudent, job) : null;
      var matchColor = pct >= 70 ? '#2e7d32' : pct >= 40 ? 'var(--orange)' : 'var(--gray)';
      var matchBadge = pct !== null
        ? '<span style="font-size:12px;font-weight:700;color:'+matchColor+';">▲ '+pct+'%</span>'
        : '';
      var card = document.createElement('div');
      card.className = 'job-card';
      card.dataset.search = ((job.title||'') + ' ' + (job.company_name||'') + ' ' + (job.field||'') + ' ' + (job.location||'') + ' ' + (job.job_type||'')).toLowerCase();
      var compWords = (job.company_name || 'Co').split(' ');
      var compLabel = compWords.length === 1
        ? compWords[0].substring(0, 4).toUpperCase()
        : compWords.slice(0, 2).map(function(w){ return w.substring(0, 3); }).join('\n').toUpperCase();
      var deadline = job.deadline_month ? 'Closes ' + job.deadline_month + ' ' + job.deadline_year : 'Open';
      card.innerHTML = '<div class="company-logo">' + esc(compLabel) + '</div>'
        + '<div class="job-info"><h4>' + esc(job.title) + '</h4>'
        + '<div class="company-name">' + esc(job.company_name||'Company') + ' · ' + esc(job.location||'Netherlands') + '</div>'
        + '<div class="job-tags"><span class="tag tag-type">' + esc(job.job_type||'Internship') + '</span>'
        + '<span class="tag tag-location">' + esc(job.location||'NL') + '</span>'
        + (job.field ? '<span class="tag tag-sector">' + esc(job.field) + '</span>' : '')
        + '</div></div>'
        + '<div class="job-meta">' + matchBadge + '<div class="deadline">' + esc(deadline) + '</div></div>';
      card.onclick = function() { openJobDetailFromDB(job); };
      jobList.appendChild(card);
    });

    var countEl = document.querySelector('.results-count strong');
    if (countEl) countEl.textContent = sorted.length + ' of ' + _allJobs.length;
  }

  function applyJobSort() {
    renderJobList(_allJobs);
  }

  async function loadJobsFromDB() {
    try {
      var res = await db.from('jobs').select('*').eq('is_active', true).order('created_at', {ascending: false});
      if (res.error || !res.data || res.data.length === 0) return;
      _allJobs = res.data;
      renderJobList(_allJobs);
    } catch(err) { console.error('loadJobsFromDB:', err.message); }
  }

  function openJobDetailFromDB(job, hideApply) {
    var modal=document.getElementById('job-detail-modal'); if (!modal) return;
    function set(id,val){var el=document.getElementById(id);if(el)el.textContent=val||'—';}
    var jdMT = document.getElementById('jd-modal-title'); if(jdMT) jdMT.textContent=job.title;
    set('jd-title',job.title); set('jd-company',job.company_name);
    set('jd-location',job.location); set('jd-duration',job.duration);
    set('jd-start',(job.start_month&&job.start_year)?job.start_month+' '+job.start_year:'');
    set('jd-auth',job.work_auth); set('jd-sector',job.field);
    set('jd-deadline',job.deadline_month?job.deadline_month+' '+job.deadline_year:'Open');
    set('jd-description',job.description); set('jd-qualifications',job.qualifications);
    set('jd-grad',(job.grad_from&&job.grad_to)?job.grad_from+' – '+job.grad_to:'');
    set('jd-school-year',job.school_year); set('jd-majors',job.majors); set('jd-gpa',job.gpa_min);
    set('jd-division', job.division || '—');
    // Searched skills
    var skillsBlock = document.getElementById('jd-searched-skills-block');
    var ss = job.searched_skills || {};
    var hasSkills = (ss.technical&&ss.technical.length)||(ss.professional&&ss.professional.length)||(ss.languages&&ss.languages.length);
    if (skillsBlock) skillsBlock.style.display = hasSkills ? 'block' : 'none';
    ['technical','professional','languages'].forEach(function(cat) {
      var wrap = document.getElementById('jd-skills-'+cat+'-wrap');
      var el = document.getElementById('jd-skills-'+cat);
      var arr = ss[cat] || [];
      if (wrap) wrap.style.display = arr.length ? 'block' : 'none';
      if (el) el.innerHTML = arr.map(function(s){ return '<span class="skill-tag">'+esc(s)+'</span>'; }).join('');
    });
    var logo=document.getElementById('jd-logo');
    if(logo){logo.textContent=job.company_name?job.company_name[0].toUpperCase():'R';logo.style.background='#e8622a';}
    var tb=document.getElementById('jd-type-badge'); if(tb) tb.textContent=job.job_type||'Internship';
    var eb=document.getElementById('jd-emp-badge'); if(eb) eb.textContent=job.employment_type||'Full-time';
    var pb=document.getElementById('jd-pay-badge'); if(pb) pb.textContent=job.pay||'See listing';
    var empDetail = document.getElementById('jd-emp-type-detail');
    if (empDetail) {
      var empText = job.employment_type || '—';
      if (job.hours_per_week) empText += ' · ' + job.hours_per_week + ' hrs/week';
      empDetail.textContent = empText;
    }
    var payDetail = document.getElementById('jd-pay-detail');
    if (payDetail) payDetail.textContent = job.pay || '—';
    var docsEl=document.getElementById('jd-docs');
    if(docsEl&&job.required_docs) docsEl.innerHTML=job.required_docs.split(', ').map(function(d){return '<span class="cv-doc-chip">&#128196; '+d+'</span>';}).join('');
    var rgEl=document.getElementById('jd-role-group');
    if(rgEl&&job.role_group) rgEl.innerHTML=job.role_group.split(',').map(function(r){return '<span class="skill-tag">'+r.trim()+'</span>';}).join('');
    var ab=document.getElementById('jd-apply-btn');
    if(ab) {
      if (hideApply || (currentEmployer && !currentStudent)) {
        ab.style.display = 'none';
      } else {
        ab.style.display = '';
        ab.onclick=function(){closeJobDetail();openApplyModal(job.title,job.company_name,job);};
      }
    }
    // Fetch and show company description
    var descBlock = document.getElementById('jd-company-desc-block');
    var descEl    = document.getElementById('jd-company-desc');
    if (descBlock && descEl && job.employer_id) {
      descBlock.style.display = 'none';
      db.from('employers').select('description').eq('id', job.employer_id).single().then(function(res) {
        if (res.data && res.data.description) {
          descEl.textContent = res.data.description;
          descBlock.style.display = 'block';
        }
      });
    }
    // AI match insights — lazy-loaded, student-only.
    var aiBlock = document.getElementById('jd-ai-insights-block');
    var aiBody  = document.getElementById('jd-ai-insights');
    if (aiBlock && aiBody) {
      if (currentStudent && job && job.id) {
        aiBlock.style.display = '';
        aiBody.innerHTML = '<p style="color:var(--text-light);font-size:14px;padding:8px 0;margin:0;">Generating AI insights…</p>';
        _activeAiJobId = job.id;
        var thisJobId = job.id;
        fetchLLMScore(currentStudent, job).then(function(data) {
          if (_activeAiJobId !== thisJobId) return;
          if (data) renderAiInsights(aiBody, data);
          else aiBody.innerHTML = '<p style="color:var(--text-light);font-size:14px;padding:8px 0;margin:0;">AI insights unavailable right now.</p>';
        });
      } else {
        aiBlock.style.display = 'none';
      }
    }
    modal.classList.add('open');
  }

  function closeJobDetail(){var m=document.getElementById('job-detail-modal');if(m)m.classList.remove('open');}

  async function loadCompanyDashboard() {
    var guestPrompt   = document.getElementById('guest-company-prompt');
    var realDash      = document.getElementById('real-company-dash');
    var studentsPanel = document.getElementById('company-panel-students');
    var listingsPanel = document.getElementById('company-panel-listings');
    var appsPanel     = document.getElementById('company-panel-applicants');
    var tabNav        = document.querySelector('#screen-company-dash .tab-nav');
    if (!currentEmployer) {
      if (guestPrompt)   guestPrompt.style.display   = 'block';
      if (realDash)      realDash.style.display       = 'none';
      if (studentsPanel) studentsPanel.style.display  = 'none';
      if (listingsPanel) listingsPanel.style.display  = 'none';
      if (appsPanel)     appsPanel.style.display      = 'none';
      if (tabNav)        tabNav.style.display          = 'none';
      return;
    }
    if (guestPrompt)   guestPrompt.style.display   = 'none';
    if (realDash)      realDash.style.display       = 'block';
    if (tabNav)        tabNav.style.display          = '';
    // Hide the guest banner in case user previously visited as guest
    var guestBanner = document.getElementById('guest-students-banner');
    if (guestBanner) guestBanner.style.display = 'none';

    // Welcome header + description
    var header = document.getElementById('dash-welcome-header');
    if (header) header.textContent = 'Welcome back, ' + currentEmployer.company_name;
    var descEl = document.getElementById('dash-company-desc');
    if (descEl) descEl.textContent = currentEmployer.description || 'No description yet — click Edit profile to add one.';

    // Fetch jobs and applications in parallel
    var [jobsRes, appsRes] = await Promise.all([
      db.from('jobs').select('*').eq('employer_id', currentEmployer.id).order('created_at', { ascending: false }),
      db.from('applications').select('*').eq('employer_id', currentEmployer.id).order('created_at', { ascending: false })
    ]);
    var myJobs = (jobsRes.data || []).filter(function(j){ return j.is_active; });
    var myPastJobs = (jobsRes.data || []).filter(function(j){ return !j.is_active; });
    var myApplicants = appsRes.data || [];

    // Auto-archive: if the employer opted in, deactivate listings whose
    // deadline passed >14 days ago. Runs once per dashboard load.
    if (currentEmployer.auto_archive) {
      var stale = autoArchiveStaleJobs(myJobs);
      if (stale.length) {
        var staleIds = stale.map(function(j){ return j.id; });
        await db.from('jobs').update({ is_active: false }).in('id', staleIds);
        // Move them out of myJobs and into myPastJobs locally so the UI matches
        myJobs = myJobs.filter(function(j){ return staleIds.indexOf(j.id) === -1; });
        myPastJobs = myPastJobs.concat(stale.map(function(j){ j.is_active = false; return j; }));
        showToast('Auto-archived ' + stale.length + ' listing' + (stale.length !== 1 ? 's' : ''));
      }
    }

    // Render the hiring-team strip (uses myJobs to compute per-recruiter listing counts)
    loadRecruitersDashboard(myJobs);

    // Metrics
    var shortlisted = myApplicants.filter(function(a){ return a.status === 'Shortlisted'; }).length;
    var oneWeekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();
    var newThisWeek = myApplicants.filter(function(a){ return a.created_at && a.created_at > oneWeekAgo; }).length;
    var _m = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    _m('metric-listings',   myJobs.length);
    _m('metric-applicants', myApplicants.length);
    _m('metric-shortlisted', shortlisted);
    _m('metric-new-week',   newThisWeek);
    _m('metric-listings-sub',    myJobs.length === 0 ? 'No active listings yet' : myJobs.length === 1 ? '1 active listing' : '');
    _m('metric-applicants-sub',  myApplicants.length === 0 ? 'No applications yet' : '');
    _m('metric-shortlisted-sub', shortlisted === 0 ? '' : shortlisted + ' candidate' + (shortlisted !== 1 ? 's' : '') + ' shortlisted');
    _m('metric-new-week-sub',    newThisWeek === 0 ? 'No new applications this week' : 'in the last 7 days');

    // Overview: recent applicants
    var appList = document.getElementById('dash-applicant-list');
    if (appList) {
      if (myApplicants.length === 0) {
        appList.innerHTML = '<p style="font-size:13px;color:var(--gray);padding:12px 0;">No applications yet.</p>';
      } else {
        var colors = ['#e8622a','#2e7d52','#1a3260','#6a1b9a','#5d4037','#c0392b','#0288d1'];
        appList.innerHTML = myApplicants.slice(0, 5).map(function(app, i) {
          var statusClass = app.status === 'Shortlisted' ? 'status-shortlist' : app.status === 'In review' ? 'status-review' : 'status-new';
          var initial = (app.student_name || 'A').charAt(0).toUpperCase();
          return '<div class="applicant-row">'
            + '<div class="applicant-avatar" style="background:' + colors[i % colors.length] + ';">' + esc(initial) + '</div>'
            + '<div class="applicant-info"><h4>' + esc(app.student_name || 'Applicant') + '</h4>'
            + '<p>Applied for ' + esc(app.job_title || 'a role') + '</p></div>'
            + '<span class="status-badge ' + esc(statusClass) + '">' + esc(app.status || 'New') + '</span></div>';
        }).join('');
      }
    }

    // Overview: listings panel
    var listingsPanel = document.getElementById('dash-listings-panel');
    if (listingsPanel) {
      if (myJobs.length === 0) {
        listingsPanel.innerHTML = '<div class="listing-item" style="cursor:pointer;background:var(--cream);" onclick="openPostModal()">'
          + '<div class="listing-info" style="color:var(--orange);"><h4 style="color:var(--orange);">+ Post your first listing</h4>'
          + '<p>We\'ll help you set it up</p></div></div>';
      } else {
        listingsPanel.innerHTML = myJobs.slice(0, 4).map(function(job) {
          var appCount = myApplicants.filter(function(a){ return a.job_id === job.id; }).length;
          return '<div class="listing-item">'
            + '<div class="listing-info"><h4>' + esc(job.title || 'Untitled') + '</h4>'
            + '<p>' + esc(job.location || 'NL') + (job.deadline_month ? ' · Closes ' + esc(job.deadline_month) : '') + '</p></div>'
            + '<div class="listing-count">' + appCount + '</div></div>';
        }).join('')
        + '<div class="listing-item" style="cursor:pointer;background:var(--cream);" onclick="openPostModal()">'
        + '<div class="listing-info" style="color:var(--orange);"><h4 style="color:var(--orange);">+ Post a new listing</h4>'
        + '<p>We\'ll help you set it up</p></div></div>';
      }
    }

    // Full listings tab
    var listContainer = document.getElementById('listings-full-list');
    var countEl = document.getElementById('listings-count');
    if (countEl) countEl.textContent = myJobs.length + ' listing' + (myJobs.length !== 1 ? 's' : '');
    if (listContainer) {
      if (myJobs.length === 0) {
        listContainer.innerHTML = '<p style="font-size:13px;color:var(--gray);padding:12px 0;">No listings yet. <button onclick="openPostModal()" style="background:none;border:none;color:var(--orange);font-weight:600;cursor:pointer;font-family:\'DM Sans\',sans-serif;font-size:13px;">Post your first listing →</button></p>';
      } else {
        listContainer.innerHTML = '';
        myJobs.forEach(function(job) {
          var appCount = myApplicants.filter(function(a){ return a.job_id === job.id; }).length;
          var row = document.createElement('div');
          row.className = 'listing-full-row';
          row.style.cursor = 'pointer';
          row.dataset.jobId = job.id; row.dataset.title = job.title;
          row.dataset.type = job.job_type; row.dataset.field = job.field;
          row.dataset.location = job.location; row.dataset.description = job.description;
          var ownerBadge = recruiterBadgeFor(job.recruiter_id);
          row.innerHTML = '<div class="listing-full-left">'
            + '<div class="listing-full-title">' + esc(job.title||'Untitled')
              + (ownerBadge ? ' ' + ownerBadge : '')
              + '</div>'
            + '<div class="listing-full-meta">' + esc(job.job_type||'Internship') + ' · ' + esc(job.field||'') + ' · ' + esc(job.location||'NL') + '</div></div>'
            + '<div class="listing-full-right">'
            + '<span class="tag tag-new" style="padding:4px 10px;font-size:11px;">Active</span>'
            + '<span class="listing-deadline">' + (job.deadline_month ? 'Closes ' + esc(job.deadline_month) + ' ' + esc(job.deadline_year||'') : 'Open') + '</span>'
            + '<span class="listing-applicants-badge">' + appCount + ' applicant' + (appCount !== 1 ? 's' : '') + '</span>'
            + '<button class="listing-edit-btn" style="background:#22c55e;color:white;border-color:#22c55e;" onclick="event.stopPropagation();openFilledModal(this)" data-job-id="' + esc(job.id) + '" data-job-title="' + esc(job.title||'') + '">Filled ✓</button>'
            + '<button class="listing-edit-btn" onclick="event.stopPropagation();openEditListing(this)">Edit</button></div>';
          row.onclick = (function(j){ return function(e) {
            if (e.target.closest('.listing-edit-btn')) return;
            openJobDetailFromDB(j);
          }; })(job);
          listContainer.appendChild(row);
        });
      }
    }

    // Past listings
    var pastPanel = document.getElementById('past-listings-panel');
    var pastList = document.getElementById('past-listings-list');
    var pastCount = document.getElementById('past-listings-count');
    if (pastPanel && pastList) {
      if (myPastJobs.length === 0) {
        pastPanel.style.display = 'none';
      } else {
        pastPanel.style.display = 'block';
        if (pastCount) pastCount.textContent = myPastJobs.length + ' listing' + (myPastJobs.length !== 1 ? 's' : '');
        pastList.innerHTML = '';
        myPastJobs.forEach(function(job) {
          var appCount = myApplicants.filter(function(a){ return a.job_id === job.id; }).length;
          var filledLabel = job.filled_status === 'rookie' ? '🎓 Filled via Rookies' : job.filled_status === 'outside' ? '🌐 Filled outside' : 'Inactive';
          var row = document.createElement('div');
          row.className = 'listing-full-row';
          row.style.cursor = 'pointer';
          row.style.opacity = '0.65';
          row.dataset.jobId = job.id;
          row.innerHTML = '<div class="listing-full-left">'
            + '<div class="listing-full-title">' + esc(job.title||'Untitled') + '</div>'
            + '<div class="listing-full-meta">' + esc(job.job_type||'Internship') + ' · ' + esc(job.field||'') + ' · ' + esc(job.location||'NL') + '</div></div>'
            + '<div class="listing-full-right">'
            + '<span style="padding:4px 10px;font-size:11px;background:var(--cream-dark);color:var(--gray);border-radius:100px;font-weight:500;">' + filledLabel + '</span>'
            + '<span class="listing-applicants-badge">' + appCount + ' applicant' + (appCount !== 1 ? 's' : '') + '</span>'
            + '</div>';
          row.onclick = (function(j){ return function(){ openJobDetailFromDB(j); }; })(job);
          pastList.appendChild(row);
        });
      }
    }

    // Browse Students role cards — render employer's own jobs as role cards
    var browseGrid = document.getElementById('browse-role-cards');
    if (browseGrid) {
      // Keep the spontaneous card, prepend job cards before it
      var spontCard = browseGrid.querySelector('.browse-spontaneous');
      var icons = ['&#128200;','&#128203;','&#128196;','&#127891;','&#128218;'];
      var iconBgs = [
        {bg:'#e8f4f8',color:'#1a3260'},{bg:'#f0f4e8',color:'#2e5e1e'},
        {bg:'#f4f0e8',color:'#5e3e1e'},{bg:'#e8f0ff',color:'#1a3260'},
        {bg:'#fff4e8',color:'#7a3e00'}
      ];
      // Remove old job cards (keep spontaneous)
      Array.from(browseGrid.querySelectorAll('.browse-role-card:not(.browse-spontaneous)')).forEach(function(c){ c.remove(); });
      myJobs.filter(function(j){ return j.is_active; }).forEach(function(job, idx) {
        var ic = iconBgs[idx % iconBgs.length];
        var skills = (job.role_group || job.field || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean).slice(0,4);
        var card = document.createElement('div');
        card.className = 'browse-role-card';
        card.innerHTML = '<div class="browse-role-icon" style="background:'+ic.bg+';color:'+ic.color+';">'+(icons[idx % icons.length])+'</div>'
          + '<div class="browse-role-title">'+(job.title||'Untitled')+'</div>'
          + '<div class="browse-role-meta">'+(job.job_type||'Role')+' &middot; '+(job.field||'')+(job.location?' &middot; '+job.location:'')+'</div>'
          + '<div class="browse-role-count">View matching students</div>';
        card.onclick = (function(j, sk){ return function(){ openBrowseRole(j.title, j.field, j.location, j.job_type, sk, j); }; })(job, skills);
        browseGrid.insertBefore(card, spontCard);
      });
    }

  } // end loadCompanyDashboard

  // ─── HIRING TEAM / RECRUITERS ──────────────────────────────────────────
  // Cached recruiter list for the active employer; reused by the
  // post/edit-listing dropdown without an extra round trip.
  window._companyRecruiters = [];

  // Color palette — same family used for student avatars / applicant rows
  var _RECRUITER_COLORS = ['#1a3260','#e8622a','#2e7d52','#6a1b9a','#5d4037','#c0392b','#0288d1','#1565c0','#7a3e00','#4a148c'];

  // Map of recruiter_id → count of active jobs assigned. Built per dashboard load.
  function _buildRecruiterListingCounts(jobs) {
    var counts = {};
    (jobs || []).forEach(function(j) {
      if (j.recruiter_id) counts[j.recruiter_id] = (counts[j.recruiter_id] || 0) + 1;
    });
    return counts;
  }

  // Returns the subset of jobs whose deadline passed more than 14 days ago.
  // Deadlines are stored as separate month + year fields ("Jun" / 2025), so
  // we parse them back to a Date and compare to today minus 14 days.
  var _MONTH_TO_NUM = {
    'Jan':0,'Feb':1,'Mar':2,'Apr':3,'May':4,'Jun':5,'Jul':6,'Aug':7,'Sep':8,'Oct':9,'Nov':10,'Dec':11,
    'January':0,'February':1,'March':2,'April':3,'June':5,'July':6,'August':7,'September':8,'October':9,'November':10,'December':11
  };
  function autoArchiveStaleJobs(jobs) {
    var cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return (jobs || []).filter(function(j) {
      if (!j.deadline_month || !j.deadline_year) return false;
      var m = _MONTH_TO_NUM[String(j.deadline_month).trim()];
      if (m === undefined) return false;
      var y = parseInt(j.deadline_year, 10);
      if (!y) return false;
      // Use end of the deadline month so jobs aren't archived mid-month
      var d = new Date(y, m + 1, 0).getTime();
      return d < cutoff;
    });
  }

  // Look up a cached recruiter by id and return a small "Owned by …" pill,
  // or empty string if no assignment / no recruiter found.
  function recruiterBadgeFor(recruiterId) {
    if (!recruiterId) return '';
    var r = (window._companyRecruiters || []).find(function(x){ return x.id === recruiterId; });
    if (!r) return '';
    var initial = (r.name||'?').charAt(0).toUpperCase();
    var idx = (window._companyRecruiters || []).indexOf(r);
    var color = _RECRUITER_COLORS[idx % _RECRUITER_COLORS.length] || 'var(--navy)';
    return '<span class="owner-pill" title="Owned by ' + esc(r.name||'') + (r.email ? ' · '+esc(r.email):'') + '">'
      + '<span class="owner-dot" style="background:'+color+';">' + esc(initial) + '</span>'
      + '<span>' + esc(r.name||'') + '</span>'
      + '</span>';
  }

  async function loadRecruitersDashboard(myJobs) {
    var strip = document.getElementById('recruiters-strip');
    var countLabel = document.getElementById('recruiters-count');
    if (!strip || !currentEmployer) return;

    var res = await db
      .from('company_recruiters')
      .select('*')
      .eq('employer_id', currentEmployer.id)
      .order('created_at', { ascending: true });

    if (res.error) {
      strip.innerHTML = '<p style="font-size:13px;color:#dc2626;padding:16px 24px;margin:0;">Could not load recruiters: ' + esc(res.error.message) + '</p>';
      return;
    }

    var recruiters = res.data || [];
    window._companyRecruiters = recruiters;
    if (countLabel) countLabel.textContent = recruiters.length === 0
      ? ''
      : recruiters.length + ' member' + (recruiters.length !== 1 ? 's' : '');

    if (recruiters.length === 0) {
      strip.innerHTML =
        '<div class="recruiter-empty">'
        + '<div class="recruiter-empty-icon">👥</div>'
        + '<div style="font-weight:600;color:var(--navy);margin-bottom:4px;">No recruiters yet</div>'
        + '<div style="font-size:12px;">Add hiring-team members so you can assign each listing to its owner.</div>'
        + '</div>';
      return;
    }

    var counts = _buildRecruiterListingCounts(myJobs);
    strip.innerHTML = recruiters.map(function(r, i) {
      var color = _RECRUITER_COLORS[i % _RECRUITER_COLORS.length];
      var initial = (r.name || '?').charAt(0).toUpperCase();
      var listingCount = counts[r.id] || 0;
      var listingLabel = listingCount === 0 ? 'No listings'
                       : listingCount === 1 ? '1 listing'
                       : listingCount + ' listings';
      return '<div class="recruiter-card" data-id="' + esc(r.id) + '">'
        + '<div class="recruiter-actions">'
        +   '<button title="Edit" onclick="openRecruiterModal(\'' + esc(r.id) + '\')">✎</button>'
        +   '<button class="danger" title="Remove" onclick="deleteRecruiter(\'' + esc(r.id) + '\',\'' + esc(r.name).replace(/\\/g,'').replace(/'/g, "\\'") + '\')">🗑</button>'
        + '</div>'
        + '<div class="recruiter-card-top">'
        +   '<div class="recruiter-avatar" style="background:' + color + ';">' + esc(initial) + '</div>'
        +   '<div style="min-width:0;flex:1;">'
        +     '<h4>' + esc(r.name || '—') + '</h4>'
        +     (r.role ? '<div class="recruiter-role">' + esc(r.role) + '</div>' : '')
        +   '</div>'
        + '</div>'
        + '<div class="recruiter-email" title="' + esc(r.email || '') + '">' + esc(r.email || '') + '</div>'
        + '<div class="recruiter-listings">' + listingLabel + '</div>'
        + '</div>';
    }).join('');
  }

  function openRecruiterModal(recruiterId) {
    var modal = document.getElementById('recruiter-modal');
    if (!modal) return;
    var titleEl = document.getElementById('recruiter-modal-title');
    var idInput = document.getElementById('rec-id');
    var nameInput = document.getElementById('rec-name');
    var emailInput = document.getElementById('rec-email');
    var roleOtherInput = document.getElementById('rec-role-other');
    var roleOtherWrap = document.getElementById('rec-role-other-wrap');
    var errEl = document.getElementById('rec-error');

    // Reset
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    nameInput.value = '';
    emailInput.value = '';
    roleOtherInput.value = '';
    roleOtherWrap.style.display = 'none';
    document.querySelectorAll('#rec-role-chips .pref-chip').forEach(function(c){ c.classList.remove('active'); });
    idInput.value = '';

    if (recruiterId) {
      // Edit mode — prefill from cached recruiter list
      var r = (window._companyRecruiters || []).find(function(x){ return x.id === recruiterId; });
      if (r) {
        idInput.value = r.id;
        nameInput.value = r.name || '';
        emailInput.value = r.email || '';
        var canon = ['Recruiter','Hiring Manager','HR Lead','Team Lead'];
        if (r.role && canon.indexOf(r.role) !== -1) {
          var chip = document.querySelector('#rec-role-chips .pref-chip[data-val="' + r.role + '"]');
          if (chip) chip.classList.add('active');
        } else if (r.role) {
          var otherChip = document.querySelector('#rec-role-chips .pref-chip[data-val="Other"]');
          if (otherChip) otherChip.classList.add('active');
          roleOtherWrap.style.display = 'block';
          roleOtherInput.value = r.role;
        }
        if (titleEl) titleEl.textContent = 'Edit recruiter';
      }
    } else {
      if (titleEl) titleEl.textContent = 'Add recruiter';
    }

    modal.style.display = 'flex';
  }

  function closeRecruiterModal() {
    var modal = document.getElementById('recruiter-modal');
    if (modal) modal.style.display = 'none';
  }

  // Wire role chip clicks (toggle Other input visibility)
  document.addEventListener('DOMContentLoaded', function() {
    var chips = document.getElementById('rec-role-chips');
    if (!chips) return;
    chips.addEventListener('click', function(e) {
      var btn = e.target.closest('.pref-chip'); if (!btn) return;
      chips.querySelectorAll('.pref-chip').forEach(function(c){ c.classList.remove('active'); });
      btn.classList.add('active');
      var wrap = document.getElementById('rec-role-other-wrap');
      var input = document.getElementById('rec-role-other');
      var isOther = btn.dataset.val === 'Other';
      if (wrap) wrap.style.display = isOther ? 'block' : 'none';
      if (!isOther && input) input.value = '';
    });
  });

  async function saveRecruiter() {
    var idInput = document.getElementById('rec-id');
    var nameInput = document.getElementById('rec-name');
    var emailInput = document.getElementById('rec-email');
    var roleOtherInput = document.getElementById('rec-role-other');
    var errEl = document.getElementById('rec-error');
    var btn = document.getElementById('rec-save-btn');

    function fail(msg) {
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
    }

    var name = (nameInput.value || '').trim();
    var email = (emailInput.value || '').trim();
    var roleChip = document.querySelector('#rec-role-chips .pref-chip.active');
    var roleVal = roleChip ? roleChip.dataset.val : '';
    if (roleVal === 'Other') roleVal = (roleOtherInput.value || '').trim();

    if (!name) return fail('Name is required.');
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('A valid email is required.');

    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    var existingId = idInput.value;
    var payload = { name: name, email: email, role: roleVal || null };
    var res;
    if (existingId) {
      res = await db.from('company_recruiters').update(payload).eq('id', existingId);
    } else {
      payload.employer_id = currentEmployer.id;
      res = await db.from('company_recruiters').insert([payload]);
    }
    if (res.error) return fail(res.error.message);

    closeRecruiterModal();
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
    // Refresh dashboard so the strip and the per-recruiter counts update
    if (typeof loadCompanyDashboard === 'function') loadCompanyDashboard();
  }

  function deleteRecruiter(id, name) {
    if (!id) return;
    showConfirmModal(
      'Remove ' + (name || 'this recruiter') + '?',
      'Listings currently assigned to them will become unassigned. You can re-assign anytime.',
      '',
      'Remove',
      'danger',
      async function() {
        var res = await db.from('company_recruiters').delete().eq('id', id);
        if (res.error) { showToast('Could not remove: ' + res.error.message); return; }
        showToast('Recruiter removed');
        if (typeof loadCompanyDashboard === 'function') loadCompanyDashboard();
      }
    );
  }

  async function loadApplicantsPanel() {
    var body = document.getElementById('applicants-panel-body');
    if (!body || !currentEmployer) return;
    body.innerHTML = '<p style="color:var(--text-light);padding:24px 0;">Loading applicants…</p>';

    // Ensure recruiter cache is populated so the "Owned by" badges render here
    // even when this tab is opened directly (without dashboard having loaded first).
    if (!window._companyRecruiters || !window._companyRecruiters.length) {
      try {
        var rr = await db.from('company_recruiters').select('*').eq('employer_id', currentEmployer.id);
        window._companyRecruiters = rr.data || [];
      } catch(e) { window._companyRecruiters = window._companyRecruiters || []; }
    }

    var { data: apps, error } = await db
      .from('applications')
      .select('*')
      .eq('employer_id', currentEmployer.id)
      .order('created_at', { ascending: false });

    if (error) { body.innerHTML = '<p style="color:#dc2626;padding:24px 0;">Error loading applicants: ' + error.message + '</p>'; return; }
    if (!apps || apps.length === 0) { body.innerHTML = '<p style="color:var(--text-light);padding:24px 0;">No applications yet.</p>'; return; }

    // Fetch the jobs and students referenced by these applications so we can compute match scores
    var jobIds = Array.from(new Set(apps.map(function(a){return a.job_id;}).filter(Boolean)));
    var studentIds = Array.from(new Set(apps.map(function(a){return a.student_id;}).filter(Boolean)));
    var jobsById = {}, studentsById = {};
    try {
      if (jobIds.length) {
        var jr = await db.from('jobs').select('*').in('id', jobIds);
        (jr.data || []).forEach(function(j){ jobsById[j.id] = j; });
      }
      if (studentIds.length) {
        var sr = await db.from('students').select('*').in('id', studentIds);
        (sr.data || []).forEach(function(s){ studentsById[s.id] = s; });
      }
    } catch(e) { console.warn('applicants match-score fetch:', e.message); }

    // Attach a match-score percentage per application (null if we can't compute it)
    apps.forEach(function(app) {
      var s = studentsById[app.student_id];
      var j = jobsById[app.job_id];
      app._matchPct = (s && j) ? matchScore(s, j) : null;
    });

    // Group by job_id / job_title
    var groups = {};
    apps.forEach(function(app) {
      var key = app.job_id || app.job_title || 'Unknown role';
      if (!groups[key]) {
        var j = jobsById[app.job_id];
        groups[key] = {
          title: app.job_title || 'Unknown role',
          type: app.job_type || '',
          recruiter_id: j ? j.recruiter_id : null,
          apps: []
        };
      }
      groups[key].apps.push(app);
    });

    // Within each group, sort by match score desc (nulls last), then by recency
    Object.values(groups).forEach(function(group) {
      group.apps.sort(function(a, b) {
        var ap = (a._matchPct === null || a._matchPct === undefined) ? -1 : a._matchPct;
        var bp = (b._matchPct === null || b._matchPct === undefined) ? -1 : b._matchPct;
        if (bp !== ap) return bp - ap;
        return new Date(b.created_at||0) - new Date(a.created_at||0);
      });
    });

    var colors = ['#e8622a','#2e7d52','#1a3260','#6a1b9a','#5d4037','#c0392b','#0288d1'];
    body.innerHTML = Object.values(groups).map(function(group) {
      var rows = group.apps.map(function(app, i) {
        var statusColors = {'New':'background:#f0f4ff;color:#1a3260;','Accepted':'background:#e8f5e9;color:#2e7d32;','Shortlisted':'background:#fff8e1;color:#e65100;','Rejected':'background:#ffeaea;color:#c62828;'};
        var status = app.status || 'New';
        var statusStyle = statusColors[status] || statusColors['New'];
        var date = app.created_at ? new Date(app.created_at).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}) : '';
        var initial = (app.student_name || 'A').charAt(0).toUpperCase();
        var color = colors[i % colors.length];
        var motivSnippet = app.motivation ? esc(app.motivation.substring(0,80)) + (app.motivation.length>80?'…':'') : 'No motivation note';
        var badge = matchBadgeHTML(app._matchPct);
        return '<div class="applicant-full-row" data-status="' + esc(status) + '" data-id="' + esc(app.id) + '">'
          + '<div class="applicant-avatar" style="background:' + color + ';">' + esc(initial) + '</div>'
          + '<div class="applicant-info"><h4>' + esc(app.student_name || 'Applicant') + '</h4>'
          + '<p>' + motivSnippet + '</p></div>'
          + '<div class="applicant-meta">' + badge + '<span class="applied-date">' + esc(date) + '</span></div>'
          + '<div class="applicant-row-actions" onclick="event.stopPropagation()" style="display:flex;align-items:center;gap:10px;">'
          + '<span style="' + statusStyle + 'padding:4px 12px;border-radius:100px;font-size:12px;font-weight:600;">' + esc(status) + '</span>'
          + '<button class="btn btn-outline-navy" style="font-size:13px;padding:8px 18px;white-space:nowrap;" onclick="openApplicantCVFromDB(this.closest(\'.applicant-full-row\'))">Review →</button>'
          + '</div></div>';
      }).join('');

      var ownerBadge = recruiterBadgeFor(group.recruiter_id);
      return '<div class="applicant-job-group">'
        + '<div class="applicant-job-header" onclick="toggleJobGroup(this)" style="cursor:pointer;">'
        + '<div class="applicant-job-title-wrap"><span class="collapse-arrow">&#9660;</span>'
        + '<span class="applicant-job-name">' + esc(group.title) + '</span>'
        + '<span class="tag tag-type" style="font-size:11px;padding:3px 10px;">' + esc(group.type||'Role') + '</span>'
        + (ownerBadge ? ownerBadge : '')
        + '</div><span class="applicant-job-count">' + group.apps.length + ' applicant' + (group.apps.length!==1?'s':'') + '</span></div>'
        + '<div class="applicant-job-list">' + rows + '</div></div>';
    }).join('');
  }

  async function updateApplicantStatusDB(select) {
    var appId = select.dataset.appId;
    var newStatus = select.value.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '').trim();
    if (!appId) return;
    var row = select.closest('.applicant-full-row');
    if (row) row.dataset.status = newStatus;
    await db.from('applications').update({ status: newStatus }).eq('id', appId);
  }

  // ─── STUDENTS DB ───

  var SEED_STUDENTS = [
    {
      name: 'Lena Visser',
      degree: 'BSc Communication & Multimedia Design',
      university: 'Fontys University of Applied Sciences',
      level: 'HBO',
      gpa: '7.8',
      avail: 'Jun 2026',
      avail_month: 'June', avail_year: 2026,
      color: '#c0392b',
      initial: 'L',
      location: 'Tilburg',
      work_auth: 'EU citizen',
      pref_type: 'Internship (stage)',
      pref_sectors: 'Marketing, Technology',
      pref_location: 'Tilburg, Eindhoven, Hybrid',
      pref_duration: '5–6 months',
      pref_roles: ['UX Designer', 'Content Strategist', 'Digital Marketing Specialist'],
      skills_technical: ['Figma', 'Adobe XD', 'HTML/CSS (basic)', 'Canva', 'Google Analytics'],
      skills_professional: ['UX Research', 'Prototyping', 'Copywriting', 'Social Media', 'Project Management'],
      skills_languages: ['Dutch (Native)', 'English (C1)', 'German (A2)'],
      education: [
        { title: 'BSc Communication & Multimedia Design', sub: 'Fontys University of Applied Sciences · Sep 2022 — Present', desc: 'Specialisation in UX Design. Minor in Digital Marketing. Graduation project: redesigning the onboarding flow for a Dutch fintech startup.' }
      ],
      experience: [
        { title: 'UX Design Intern', sub: 'Conclusion Digital · Jun 2024 — Dec 2024 · Eindhoven', desc: 'Led user research and redesigned two core flows for a client SaaS product. Usability score improved from 62 to 78 (SUS scale) post-launch.' },
        { title: 'Social Media & Content Assistant', sub: 'Freelance · Jan 2023 — Present', desc: 'Manages social and content for 3 local SMEs. Grew combined following from 800 to 4,200 in 14 months.' }
      ],
      orgs: [
        { title: 'Design Lead', sub: 'Fontys Creative Student Association · 2023 — Present', desc: 'Runs monthly design critique sessions and coordinates annual student showcase.' }
      ],
      docs: ['CV / Resume', 'Portfolio']
    },
    {
      name: 'Daan Smeets',
      degree: 'MSc Econometrics & Mathematical Economics',
      university: 'Tilburg University',
      level: 'WO',
      gpa: '8.4',
      avail: 'Sep 2026',
      avail_month: 'September', avail_year: 2026,
      color: '#1565c0',
      initial: 'D',
      location: 'Tilburg',
      work_auth: 'EU citizen',
      pref_type: 'Internship (stage)',
      pref_sectors: 'Finance & Banking, Data & Analytics, Consulting',
      pref_location: 'Tilburg, Amsterdam, Rotterdam',
      pref_duration: '5–6 months',
      pref_roles: ['Quantitative Analyst', 'Risk Analyst', 'Data Scientist'],
      skills_technical: ['Python (NumPy, pandas, scikit-learn)', 'R', 'MATLAB', 'SQL', 'LaTeX', 'Git'],
      skills_professional: ['Mathematical Modelling', 'Statistical Inference', 'Research', 'Problem Solving', 'Attention to Detail'],
      skills_languages: ['Dutch (Native)', 'English (C2)', 'French (B1)'],
      education: [
        { title: 'MSc Econometrics & Mathematical Economics', sub: 'Tilburg University · Sep 2025 — Present', desc: 'Track: Financial Econometrics. Thesis (in progress): jump-diffusion models for Dutch mortgage prepayment risk.' },
        { title: 'BSc Econometrics & Operations Research', sub: 'Tilburg University · Sep 2021 — Jul 2025', desc: 'Graduated cum laude. GPA 8.6. Thesis: causal inference in Dutch housing market using IV regression.' }
      ],
      experience: [
        { title: 'Quantitative Research Intern', sub: 'APG Asset Management · Jun 2025 — Aug 2025 · Amsterdam', desc: 'Built factor exposure decomposition tool for the fixed income portfolio. Results adopted in monthly risk report.' },
        { title: 'Teaching Assistant — Probability & Statistics', sub: 'Tilburg University · Feb 2024 — Jul 2025', desc: 'Ran weekly tutorials for 25 second-year students. Rated 4.7/5 in end-of-course evaluations.' }
      ],
      orgs: [
        { title: 'Vice President', sub: 'TiU Econometrics Study Association (EBT) · 2023 — 2025', desc: 'Organised annual econometrics case competition with 80+ participants from 6 Dutch universities.' }
      ],
      docs: ['CV / Resume', 'Transcript']
    },
    {
      name: 'Nour El-Amin',
      degree: 'BSc HRM & Organisation Studies',
      university: 'Tilburg University',
      level: 'WO',
      gpa: '7.3',
      avail: 'Feb 2026',
      avail_month: 'February', avail_year: 2026,
      color: '#2e7d52',
      initial: 'N',
      location: 'Tilburg',
      work_auth: 'Non-EU (work permit)',
      pref_type: 'Internship (stage)',
      pref_sectors: 'HR & People, Consulting',
      pref_location: 'Tilburg, Den Bosch, Hybrid',
      pref_duration: '5–6 months',
      pref_roles: ['HR Business Partner', 'Talent Acquisition Specialist', 'People & Culture Intern'],
      skills_technical: ['Excel', 'SPSS', 'Workday (basic)', 'MS Office'],
      skills_professional: ['Recruitment', 'Interviewing', 'Communication', 'Research', 'Intercultural Competence'],
      skills_languages: ['Arabic (Native)', 'Dutch (B2)', 'English (C1)', 'French (B1)'],
      education: [
        { title: 'BSc HRM & Organisation Studies', sub: 'Tilburg University · Sep 2022 — Present', desc: 'Minor in Intercultural Communication. Final-year thesis on DEI practices in Dutch corporates: gap between policy and lived experience.' }
      ],
      experience: [
        { title: 'HR Intern', sub: 'CZ Zorgverzekeringen · Sep 2024 — Feb 2025 · Tilburg', desc: 'Supported HR Business Partner team with onboarding redesign for 120-person division. Led interview scheduling for 3 open positions, reduced time-to-offer by 8 days.' },
        { title: 'Volunteer Coordinator', sub: 'VluchtelingenWerk Nederland · Jun 2023 — Sep 2024 · Tilburg', desc: 'Coordinated 40+ volunteers for integration support programmes. Ran weekly check-ins and performance tracking.' }
      ],
      orgs: [
        { title: 'Board Member — Diversity & Inclusion', sub: 'TiU Student Council · 2023 — 2024', desc: 'Launched anonymous reporting system adopted university-wide.' }
      ],
      docs: ['CV / Resume', 'Cover letter']
    },
    {
      name: 'Bram van Rooij',
      degree: 'HBO-ICT Software Engineering',
      university: 'Avans University of Applied Sciences',
      level: 'HBO',
      gpa: '7.6',
      avail: 'Apr 2026',
      avail_month: 'April', avail_year: 2026,
      color: '#4a148c',
      initial: 'B',
      location: 'Breda',
      work_auth: 'EU citizen',
      pref_type: 'Internship (stage)',
      pref_sectors: 'Technology, Data & Analytics',
      pref_location: 'Breda, Tilburg, Eindhoven, Hybrid',
      pref_duration: '5–6 months',
      pref_roles: ['Software Engineer', 'Backend Developer', 'Data Engineer'],
      skills_technical: ['Java (Spring Boot)', 'Python', 'JavaScript (React)', 'SQL', 'Docker', 'Git', 'REST APIs'],
      skills_professional: ['Agile / Scrum', 'Code Review', 'System Design', 'Problem Solving', 'Documentation'],
      skills_languages: ['Dutch (Native)', 'English (B2)'],
      education: [
        { title: 'HBO-ICT Software Engineering', sub: 'Avans University of Applied Sciences · Sep 2022 — Present', desc: 'Specialisation in backend systems. Final project: microservices migration for a regional logistics company, cutting API response time by 40%.' }
      ],
      experience: [
        { title: 'Backend Developer Intern', sub: 'Centric · Sep 2024 — Feb 2025 · Gouda', desc: 'Developed two REST endpoints for a government client portal used by 50k+ citizens. Wrote unit tests with 92% coverage.' },
        { title: 'Freelance Web Developer', sub: 'Self-employed · Jan 2023 — Present', desc: 'Built and maintained websites for 6 local clients. Stack: React frontend, Node.js backend, PostgreSQL.' }
      ],
      orgs: [],
      docs: ['CV / Resume', 'Portfolio']
    },
    {
      name: 'Ines Rodrigues',
      degree: 'MSc Marketing Management',
      university: 'Tilburg University',
      level: 'WO — Recent graduate',
      gpa: '7.9',
      avail: 'Immediately',
      avail_month: 'April', avail_year: 2026,
      color: '#e8622a',
      initial: 'I',
      location: 'Tilburg',
      work_auth: 'EU citizen',
      pref_type: 'Graduate role',
      pref_sectors: 'Marketing, Consulting, Technology',
      pref_location: 'Tilburg, Amsterdam, Hybrid',
      pref_duration: 'Ongoing',
      pref_roles: ['Brand Manager', 'Marketing Analyst', 'Growth Marketer', 'Account Manager'],
      skills_technical: ['Google Analytics 4', 'HubSpot', 'Salesforce (basic)', 'Excel', 'Tableau', 'Canva', 'Meta Ads Manager'],
      skills_professional: ['Brand Strategy', 'Consumer Research', 'Campaign Management', 'Data Analysis', 'Stakeholder Presentation'],
      skills_languages: ['Portuguese (Native)', 'Dutch (B2)', 'English (C2)', 'Spanish (C1)'],
      education: [
        { title: 'MSc Marketing Management', sub: 'Tilburg University · Sep 2023 — Mar 2026', desc: 'Thesis: "The effect of sustainability claims on purchase intent in Gen Z Dutch consumers" — graded 8.5. Study track: Digital & Data-Driven Marketing.' },
        { title: 'BSc International Business', sub: 'Universidade Nova de Lisboa · Sep 2019 — Jul 2023', desc: 'Exchange semester at Maastricht University (Spring 2022). Graduated with distinction.' }
      ],
      experience: [
        { title: 'Marketing Intern', sub: 'Philips · Jun 2025 — Dec 2025 · Amsterdam', desc: 'Owned email marketing for the Personal Health division (DACH + Benelux). A/B tested 12 campaigns. CTR improved 22% over 6 months.' },
        { title: 'Marketing Coordinator (part-time)', sub: 'TiU Career Services · Sep 2024 — Jun 2025', desc: 'Ran student-facing communications for career events. Grew LinkedIn page from 3.1k to 4.4k followers.' }
      ],
      orgs: [
        { title: 'President', sub: 'TiU Marketing Association · 2024 — 2025', desc: 'Led 8-person board. Secured 4 new corporate partners. Organised annual marketing case competition (160 participants).' }
      ],
      docs: ['CV / Resume', 'Cover letter']
    }
  ];

  var ADMIN_STUDENT = {
    name: 'Dan Poenaru',
    degree: 'MSc Business Analytics & Operations Research',
    university: 'Tilburg University',
    level: 'WO — Recent graduate',
    gpa: '9.0',
    avail: 'Immediately',
    avail_month: 'April', avail_year: 2026,
    color: '#0f1f3d',
    initial: 'D',
    location: 'Tilburg',
    work_auth: 'EU citizen',
    pref_type: 'Graduate role',
    pref_sectors: 'Finance & Banking, Data & Analytics, Consulting',
    pref_location: 'Tilburg, Amsterdam, Hybrid',
    pref_duration: 'Ongoing',
    pref_roles: ['Strategy Analyst', 'Business Analyst', 'Data Scientist', 'Quantitative Analyst', 'Operations Analyst'],
    skills_technical: ['Python (Advanced)', 'Advanced Excel (Solver, scenario analysis)', 'Tableau', 'SQL', 'MATLAB', 'AIMMS', 'SPSS', 'Machine Learning'],
    skills_professional: ['Quantitative Modelling', 'Optimisation', 'Forecasting', 'ESG & Sustainability Analysis', 'Strategic Decision-Making', 'Stakeholder Management', 'Team Leadership'],
    skills_languages: ['Romanian (Native)', 'English (Fluent)', 'German (Intermediate)'],
    education: [
      { title: 'MSc Business Analytics & Operations Research', sub: 'Tilburg University · Sep 2024 — Dec 2025', desc: 'Thesis (9/10): "The Green Moneyball" — integrated econometrics, machine learning, and optimisation to assess the financial impact of ESG performance and identify value-creating thresholds.' },
      { title: 'Pre-Master\'s in Business Analytics & Operations Research', sub: 'Tilburg University · Aug 2023 — Jul 2024', desc: 'Foundation in optimisation, programming, and analytical methods for operational and financial decisions.' },
      { title: 'BSc International Business Administration', sub: 'Tilburg University · Aug 2020 — Jul 2023', desc: 'Specialisation in Finance, Statistics, Mathematics, and International Strategy. Minor in Finance. Thesis: Factors Influencing Investors\' Trust in AI in Financial Forecasting. UNICEF DataViz Challenge 2021 — Tableau.' }
    ],
    experience: [
      { title: 'Lead Research Author', sub: 'Tilburg University · Jan 2026 — Present · Tilburg', desc: 'Lead author of an academic article with Associate Professor Cristian Dobre. Applying advanced quantitative methods to assess the financial impact of environmental performance on firm-level turnover.' },
      { title: 'Faculty Content Manager', sub: 'AthenaSummary · Aug 2022 — Jul 2023 · Tilburg', desc: 'Led a team of 10+ members, improving operational processes and performance tracking. Generated ~€30,000 in revenue. Designed incentive structures that increased revenues by ~10%. Primary stakeholder interface.' },
      { title: 'International Tutor', sub: 'AthenaStudies · Mar 2022 — Jul 2023 · Tilburg', desc: 'Delivered courses in Economics, Linear Optimisation, Calculus, and Statistics for TiU and partner universities including Warwick. Trained 100+ students; 95% pass rate, 8.8/10 average feedback.' }
    ],
    orgs: [
      { title: 'ASML High-NA EUV Expansion Case', sub: 'Tilburg University · Feb 2025 — Jun 2025', desc: 'Supervised by Prof. Kuno Huisman (Head of Strategic Capacity Preparation, ASML). Built a decision-support model for a new assembly facility. Reduced transport costs ~20% and CO2 emissions ~170 tons/unit; projected 10% IRR.' },
      { title: 'Erasmus+ Training — "I Feel I Defend 2.0"', sub: 'Ceuta, Spain · Oct 2023 — Nov 2023', desc: 'Collaborated with peers from 9 countries in a human rights and leadership programme.' }
    ],
    docs: ['CV / Resume', 'Transcript'],
    is_admin: true
  };

  async function loadStudentProfile() {
    var prompt = document.getElementById('guest-profile-prompt');
    var layout = document.getElementById('real-profile-layout');
    if (!currentStudent) {
      if (prompt) prompt.style.display = 'block';
      if (layout) layout.style.display = 'none';
      return;
    }
    if (prompt) prompt.style.display = 'none';
    if (layout) layout.style.display = '';
    if (currentStudent.is_admin) { loadAdminProfile(); return; }

    // Hide admin tab for non-admin students
    var adminTab = document.getElementById('admin-tab-btn');
    if (adminTab) adminTab.style.display = 'none';

    var s = currentStudent;

    // Get email from Supabase Auth
    var email = '—';
    try {
      var authRes = await db.auth.getUser();
      if (authRes.data?.user?.email) email = authRes.data.user.email;
    } catch(e) {}

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

    // Convert newlines to <br> for display — preserves multiline input
    var nl2br = function(str) {
      if (!str) return '—';
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    };
    var setText = function(id, val) { var el = document.getElementById(id); if (el) el.innerHTML = nl2br(val); };

    setText('profile-header-name', s.name);
    var subParts = [s.university, s.degree, s.avail ? 'Available ' + s.avail : null].filter(Boolean);
    setText('profile-header-sub', subParts.join(' · '));
    setText('profile-header-uni', s.university || '');

    // Basic info read view
    setText('profile-name', s.name);
    setText('profile-email', email);
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

    // Convert newlines to <br> for multiline desc fields
    var _nl2br = function(str) { return str ? str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>') : ''; };

    // ── Restore structured edit data from DB ──
    function renderEduEntries(entries) {
      if (!entries || !entries.length) return '<p style="font-size:13px;color:var(--gray);">None listed yet.</p>';
      return entries.map(function(e) {
        var endText = e.stillStudying ? 'Present' : ((e.endMonth||'')+(e.endYear?' '+e.endYear:'')).trim();
        return '<div class="edu-entry-display">'
          +'<div class="edu-entry-header"><strong>'+(e.field||e.uni||'Education')+'</strong>'
          +'<span class="edu-period">'+(e.startMonth+' '+e.startYear).trim()+(endText?' — '+endText:'')+'</span></div>'
          +'<div class="edu-entry-sub">'+(e.uni||'')+(e.level?' · '+e.level:'')+(e.gpa?' · GPA '+e.gpa:'')+'</div>'
          +(e.desc?'<div class="edu-entry-desc">'+_nl2br(e.desc)+'</div>':'')+'</div>';
      }).join('');
    }
    function renderExpEntries(entries) {
      if (!entries || !entries.length) return '<p style="font-size:13px;color:var(--gray);">None listed yet.</p>';
      return entries.map(function(e) {
        var period=(e.startMonth+' '+e.startYear).trim()+(e.stillWorking?' — Present':((e.endMonth||e.endYear)?' — '+(e.endMonth+' '+e.endYear).trim():''));
        return '<div class="edu-entry-display">'
          +'<div class="edu-entry-header"><strong>'+(e.role||'Role')+'</strong><span class="edu-period">'+period+'</span></div>'
          +'<div class="edu-entry-sub">'+(e.company||'')+(e.location?' · '+e.location:'')+'</div>'
          +(e.desc?'<div class="edu-entry-desc">'+_nl2br(e.desc)+'</div>':'')+'</div>';
      }).join('');
    }
    function renderOrgsEntries(entries) {
      if (!entries || !entries.length) return '<p style="font-size:13px;color:var(--gray);">None listed yet.</p>';
      return entries.map(function(e) {
        var period=(e.startMonth+' '+e.startYear).trim()+(e.stillMember?' — Present':((e.endMonth||e.endYear)?' — '+(e.endMonth+' '+e.endYear).trim():''));
        return '<div class="edu-entry-display">'
          +'<div class="edu-entry-header"><strong>'+(e.role||'Member')+'</strong><span class="edu-period">'+period+'</span></div>'
          +'<div class="edu-entry-sub">'+(e.org||'')+'</div>'
          +(e.desc?'<div class="edu-entry-desc">'+_nl2br(e.desc)+'</div>':'')+'</div>';
      }).join('');
    }

    // Education
    var eduEntries = s.education && s.education.length ? s.education : [];
    currentStudent._eduEntries = eduEntries;
    var eduEl = document.getElementById('profile-edu-entries');
    if (eduEl) eduEl.innerHTML = renderEduEntries(eduEntries);

    // Experience
    var expEntries = s.experience && s.experience.length ? s.experience : [];
    currentStudent._expEntries = expEntries;
    var expEl = document.getElementById('profile-exp-entries');
    if (expEl) expEl.innerHTML = renderExpEntries(expEntries);

    // Organisations
    var orgsEntries = s.organisations && s.organisations.length ? s.organisations : [];
    currentStudent._orgsEntries = orgsEntries;
    var orgsReadEl = document.getElementById('orgs-read-view');
    if (orgsReadEl) orgsReadEl.innerHTML = renderOrgsEntries(orgsEntries);

    // Skills — always reset skillsDB from DB (prevents bleed from previous session)
    // Normalize: DB may store plain strings OR {name,source,proof} objects
    function _normalizeSkills(arr) {
      return (arr || []).map(function(item) {
        if (typeof item === 'string') {
          // Some DB entries may be JSON-stringified objects — try to parse them
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

    // Preferences read view — normalize DB values (may be Postgres array literals)
    var _norm = function(val) {
      if (!val) return '';
      if (Array.isArray(val)) return val.join(', ');
      var s = String(val).trim();
      if (s.charAt(0) === '{' && s.charAt(s.length-1) === '}') {
        s = s.slice(1,-1);
        var parts = s.match(/("([^"]*)")|([^,]+)/g);
        return parts ? parts.map(function(m){ return m.replace(/^"|"$/g,'').trim(); }).filter(Boolean).join(', ') : '';
      }
      return s;
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
    // Normalize Postgres array literals or plain strings to display text
    var _normPref = function(val) {
      if (!val) return '—';
      if (Array.isArray(val)) return val.join(', ') || '—';
      var s = String(val).trim();
      if (s.charAt(0) === '{' && s.charAt(s.length-1) === '}') {
        s = s.slice(1,-1);
        var parts = s.match(/("([^"]*)")|([^,]+)/g);
        if (!parts) return '—';
        return parts.map(function(m){ return m.replace(/^"|"$/g,'').trim(); }).filter(Boolean).join(', ') || '—';
      }
      return s || '—';
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

    // ── Documents read view ──
    var visEl = document.getElementById('profile-visibility-status');
    if (visEl) visEl.textContent = s.visibility || 'Not set';

    var cvStatus = document.getElementById('profile-cv-status');
    var cvLink = document.getElementById('cv-read-link');
    if (s.cv_url) {
      if (cvStatus) { cvStatus.textContent = ''; }
      if (cvLink) cvLink.innerHTML = '<a href="' + esc(s.cv_url) + '" target="_blank" style="color:var(--navy);font-weight:600;text-decoration:underline;">View CV →</a>';
    } else {
      if (cvStatus) cvStatus.textContent = 'Not uploaded';
      if (cvLink) cvLink.innerHTML = '';
    }

    // Also update the upload box in edit view if CV exists
    var cvBox = document.getElementById('cv-upload-box');
    if (cvBox && s.cv_url) {
      cvBox.innerHTML = '<span style="font-size:20px;">📄</span><div style="font-size:13px;color:var(--navy);font-weight:600;">CV uploaded<br><span style="font-size:11px;color:var(--gray);font-weight:400;">Click to replace</span></div>';
    }

    // ── Profile completeness ──
    function _setProg(pctId, fillId, pct) {
      var color = pct >= 80 ? 'var(--success)' : pct >= 40 ? 'var(--orange)' : '#e74c3c';
      var pctEl = document.getElementById(pctId); if (pctEl) pctEl.textContent = pct + '%';
      var fillEl = document.getElementById(fillId); if (fillEl) { fillEl.style.width = pct + '%'; fillEl.style.background = color; }
    }
    // Basic info required: name, current_status, field_of_study, work_auth
    var basicFields = [s.name, s.current_status, s.field_of_study, s.work_auth];
    var basicScore = Math.round((basicFields.filter(Boolean).length / basicFields.length) * 100);
    // Education: has at least 1 entry
    var eduScore = (s.education && s.education.length) ? 100 : 0;
    // Skills: total skills, 3 = 100%
    var totalSkills = (s.skills_technical||[]).length + (s.skills_professional||[]).length + (s.skills_languages||[]).length;
    var skillsScore = Math.min(Math.round((totalSkills / 3) * 100), 100);
    // Preferences required: pref_type, pref_locations, pref_sectors
    var prefsFields = [s.pref_type, s.pref_locations, s.pref_sectors];
    var prefsScore = Math.round((prefsFields.filter(Boolean).length / prefsFields.length) * 100);
    // Experience: informational, not part of required overall score
    var expScore = (s.experience && s.experience.length) ? 100 : 0;
    // Overall: 4 required sections only (experience is a bonus, not required)
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
    // Tip
    var tipEl = document.getElementById('prog-tip');
    if (tipEl) {
      if (overallScore === 100) tipEl.textContent = 'Profile complete! Your profile is visible to companies.';
      else if (eduScore === 0) tipEl.textContent = 'Add at least one education entry to complete your profile.';
      else if (basicScore < 100) tipEl.textContent = 'Fill in required basic info: name, current status, field of study, work authorisation.';
      else if (prefsScore < 100) tipEl.textContent = 'Complete your preferences — what you\'re looking for, sectors, and preferred location.';
      else if (skillsScore < 100) tipEl.textContent = 'Add at least 3 skills to complete your profile.';
      else if (expScore === 0) tipEl.textContent = 'Add past experience to boost your match rate with companies.';
      else tipEl.textContent = 'Great profile! Keep it up to date.';
    }

    console.log('Student profile loaded:', s.name);
  }

  async function loadAdminProfile() {
    try {
      if (!currentStudent || !currentStudent.is_admin) {
        var res = await db.from('students').select('*').eq('is_admin', true).limit(1);
        if (res.error || !res.data || !res.data.length) { console.warn('loadAdminProfile: no admin student found in DB.'); return; }
        currentStudent = res.data[0];
      }
      await loadStudentProfile();
      // Show admin tab
      var adminTab = document.getElementById('admin-tab-btn');
      if (adminTab) adminTab.style.display = '';
    } catch(err) { console.error('loadAdminProfile:', err.message); }
  }

  function showAdminPanel() {
    if (!currentStudent || !currentStudent.is_admin) return;
    document.getElementById('real-profile-layout').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    loadAdminCompanies();
  }

  function hideAdminPanel() {
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('real-profile-layout').style.display = '';
  }

  async function loadAdminCompanies() {
    var pendingEl  = document.getElementById('admin-pending-list');
    var approvedEl = document.getElementById('admin-approved-list');
    var pendingCt  = document.getElementById('admin-pending-count');
    var approvedCt = document.getElementById('admin-approved-count');

    var res = await db.from('employers').select('*').order('created_at', {ascending:false});
    if (res.error || !res.data) { pendingEl.innerHTML = '<p style="color:#c0392b;font-size:13px;">Error loading companies.</p>'; return; }

    var pending  = res.data.filter(function(e){ return e.status === 'pending' || !e.status; });
    var approved = res.data.filter(function(e){ return e.status === 'approved'; });
    var rejected = res.data.filter(function(e){ return e.status === 'rejected'; });

    if (pendingCt)  pendingCt.textContent  = pending.length  + ' pending';
    if (approvedCt) approvedCt.textContent = approved.length + ' approved';

    function companyRow(emp, type) {
      var domain = emp.email ? emp.email.split('@')[1] : '';
      var isFreeEmail = ['gmail.com','hotmail.com','outlook.com','yahoo.com','icloud.com'].includes(domain);
      var domainBadge = isFreeEmail
        ? '<span style="background:#fef2f2;color:#dc2626;border-radius:100px;padding:2px 8px;font-size:11px;font-weight:600;">⚠ ' + esc(domain) + '</span>'
        : '<span style="background:#f0fdf4;color:#16a34a;border-radius:100px;padding:2px 8px;font-size:11px;font-weight:600;">✓ ' + esc(domain) + '</span>';
      var actions = type === 'pending'
        ? '<button onclick="approveCompany(\'' + emp.id + '\')" class="btn btn-primary" style="padding:6px 14px;font-size:12px;">Approve</button>'
          + '<button onclick="rejectCompany(\'' + emp.id + '\')" class="btn" style="padding:6px 14px;font-size:12px;background:#fef2f2;color:#dc2626;border-color:#fecaca;margin-left:6px;">Reject</button>'
        : type === 'approved'
          ? '<button onclick="rejectCompany(\'' + emp.id + '\')" class="btn" style="padding:6px 14px;font-size:12px;background:#fef2f2;color:#dc2626;border-color:#fecaca;">Revoke</button>'
          : '<button onclick="approveCompany(\'' + emp.id + '\')" class="btn btn-primary" style="padding:6px 14px;font-size:12px;">Re-approve</button>';
      var date = emp.created_at ? new Date(emp.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '';
      return '<div id="company-row-'+emp.id+'" style="display:flex;align-items:center;gap:16px;padding:16px 24px;border-bottom:1px solid var(--border);">'
        + '<div style="flex:1;">'
        + '<div style="font-size:15px;font-weight:600;color:var(--navy);">' + esc(emp.company_name||'—') + '</div>'
        + '<div style="font-size:13px;color:var(--text-light);margin-top:2px;display:flex;align-items:center;gap:8px;">' + esc(emp.email||'') + ' ' + domainBadge + '</div>'
        + (date ? '<div style="font-size:12px;color:var(--gray);margin-top:2px;">Signed up ' + date + '</div>' : '')
        + '</div>'
        + '<div>' + actions + '</div>'
        + '</div>';
    }

    pendingEl.innerHTML = pending.length
      ? pending.map(function(e){ return companyRow(e, 'pending'); }).join('')
      : '<p style="font-size:13px;color:var(--gray);padding:12px 0;">No pending accounts 🎉</p>';

    approvedEl.innerHTML = approved.length
      ? approved.map(function(e){ return companyRowApproved(e); }).join('')
        + (rejected.length ? '<div style="margin-top:16px;padding:0 24px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--gray);">Rejected</div>'
          + rejected.map(function(e){ return companyRowApproved(e); }).join('') : '')
      : '<p style="font-size:13px;color:var(--gray);padding:12px 24px;">No approved companies yet.</p>';

    // Load students panel
    loadAdminStudents();
  }

  var _adminStudentsAll = [];

  async function loadAdminStudents() {
    var listEl = document.getElementById('admin-students-list');
    var countEl = document.getElementById('admin-students-count');
    if (!listEl) return;
    var res = await db.from('students').select('id, name, degree, university, gpa, avail_month, avail_year, is_admin, created_at').order('created_at', {ascending:false});
    if (res.error || !res.data) { listEl.innerHTML = '<p style="color:#c0392b;font-size:13px;padding:16px 24px;">Error loading students.</p>'; return; }
    _adminStudentsAll = res.data.filter(function(s){ return !s.is_admin; });
    if (countEl) countEl.textContent = _adminStudentsAll.length + ' students';
    renderAdminStudents(_adminStudentsAll);
  }

  function renderAdminStudents(students) {
    var listEl = document.getElementById('admin-students-list');
    if (!listEl) return;
    if (!students.length) { listEl.innerHTML = '<p style="font-size:13px;color:var(--gray);padding:16px 24px;">No students found.</p>'; return; }
    listEl.innerHTML = students.map(function(s) {
      var date = s.created_at ? new Date(s.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '';
      var avail = [s.avail_month, s.avail_year].filter(Boolean).join(' ') || '—';
      var initial = (s.name||'?')[0].toUpperCase();
      return '<div data-student-id="' + esc(s.id) + '" onclick="adminOpenStudent(this)" style="display:flex;align-items:center;gap:16px;padding:14px 24px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'var(--cream)\'" onmouseout="this.style.background=\'\'">'
        + '<div style="width:40px;height:40px;min-width:40px;border-radius:50%;background:var(--navy);display:flex;align-items:center;justify-content:center;color:white;font-size:15px;font-weight:700;">' + esc(initial) + '</div>'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:15px;font-weight:600;color:var(--navy);">' + esc(s.name||'—') + '</div>'
        + '<div style="font-size:13px;color:var(--text-light);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(s.degree||'—') + (s.university ? ' · ' + esc(s.university) : '') + '</div>'
        + '<div style="font-size:12px;color:var(--gray);margin-top:2px;">Available ' + esc(avail) + (s.gpa ? ' · GPA ' + s.gpa : '') + (date ? ' · Joined ' + date : '') + '</div>'
        + '</div>'
        + '<span style="color:var(--gray);font-size:18px;">→</span>'
        + '</div>';
    }).join('');
  }

  function filterAdminStudents(query) {
    var q = query.toLowerCase().trim();
    if (!q) { renderAdminStudents(_adminStudentsAll); return; }
    var filtered = _adminStudentsAll.filter(function(s) {
      return (s.name||'').toLowerCase().includes(q)
        || (s.university||'').toLowerCase().includes(q)
        || (s.degree||'').toLowerCase().includes(q);
    });
    renderAdminStudents(filtered);
  }

  async function adminOpenStudent(el) {
    var id = el.dataset.studentId;
    if (!id) return;
    var res = await db.from('students').select('*').eq('id', id).single();
    if (res.error || !res.data) { showToast('Could not load student', 'error'); return; }
    openStudentFromDB(res.data, true); // hideInvite = true in admin context
  }

  function toggleAdminStudents() {
    var body = document.getElementById('admin-students-body');
    var chevron = document.getElementById('admin-students-chevron');
    if (!body) return;
    var collapsed = body.style.display === 'none';
    body.style.display = collapsed ? 'block' : 'none';
    if (chevron) chevron.style.transform = collapsed ? '' : 'rotate(180deg)';
  }

  function showConfirmModal(title, subtitle, body, actionLabel, actionStyle, onConfirm) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-subtitle').textContent = subtitle;
    // body accepts HTML so we can embed inputs (change-email, change-password, etc.)
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

  document.addEventListener('DOMContentLoaded', function() {
    var cm = document.getElementById('confirm-modal');
    if (cm) cm.addEventListener('click', function(e){ if(e.target===this) closeConfirmModal(); });
  });

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

  var _charCounterFields = [
    ['contact-message', 2000],
    ['edit-basic-bio', 280],
    ['post-description', 2000],
    ['post-qualifications', 2000],
    ['post-msg-invite', 2000],
    ['post-msg-accepted', 2000],
    ['post-msg-shortlisted', 2000],
    ['post-msg-rejected', 2000],
    ['edit-description', 2000],
    ['edit-qualifications', 2000],
    ['edit-msg-invite', 2000],
    ['edit-msg-accepted', 2000],
    ['edit-msg-shortlisted', 2000],
    ['edit-msg-rejected', 2000],
    ['cp-description', 2000],
    ['apply-motivation', 600]
  ];
  function _updateCounter(el, counter, max) {
    var len = el.value.length;
    counter.textContent = len + ' / ' + max;
    counter.style.color = len >= max * 0.9 ? '#dc2626' : 'var(--gray)';
  }
  function attachCharCounter(fieldId, max) {
    var el = document.getElementById(fieldId);
    var counter = document.getElementById(fieldId + '-counter');
    if (!el || !counter) return;
    el.addEventListener('input', function() { _updateCounter(el, counter, max); });
    _updateCounter(el, counter, max);
  }
  function refreshCharCounters() {
    _charCounterFields.forEach(function(pair) {
      var el = document.getElementById(pair[0]);
      var counter = document.getElementById(pair[0] + '-counter');
      if (el && counter) _updateCounter(el, counter, pair[1]);
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    _charCounterFields.forEach(function(pair) { attachCharCounter(pair[0], pair[1]); });
    document.querySelectorAll('.edu-entry-form textarea').forEach(function(ta) {
      attachCounterToTextarea(ta, 500);
    });
  });

  async function approveCompany(id) {
    showConfirmModal(
      'Approve company',
      'This will grant full platform access',
      'Are you sure you want to approve this company? They will be able to post listings and browse students immediately.',
      'Approve',
      'btn-primary',
      function() { doApproveCompany(id); }
    );
  }

  async function doApproveCompany(id) {
    var row = document.getElementById('company-row-' + id);
    if (row) row.style.opacity = '0.4';
    var res = await db.from('employers').update({ status: 'approved' }).eq('id', id);
    if (res.error) { showToast('Error: ' + res.error.message, 'error'); if (row) row.style.opacity = '1'; return; }
    showToast('✅ Company approved');
    if (row) row.remove();
    var pendingEl = document.getElementById('admin-pending-list');
    var pendingCt = document.getElementById('admin-pending-count');
    var remaining = pendingEl ? pendingEl.querySelectorAll('[id^="company-row-"]').length : 0;
    if (pendingCt) pendingCt.textContent = remaining + ' pending';
    if (remaining === 0 && pendingEl) pendingEl.innerHTML = '<p style="font-size:13px;color:var(--gray);padding:12px 24px;">No pending accounts 🎉</p>';
    var approvedEl = document.getElementById('admin-approved-list');
    var approvedRes = await db.from('employers').select('*').neq('status','pending').order('created_at',{ascending:false});
    if (!approvedRes.error && approvedRes.data && approvedEl) {
      var approvedData = approvedRes.data.filter(function(e){ return e.status === 'approved'; });
      var rejectedData = approvedRes.data.filter(function(e){ return e.status === 'rejected'; });
      var approvedCt = document.getElementById('admin-approved-count');
      if (approvedCt) approvedCt.textContent = approvedData.length + ' approved';
      approvedEl.innerHTML = approvedData.length
        ? approvedData.map(function(e){ return companyRowApproved(e); }).join('')
          + (rejectedData.length ? '<div style="margin-top:16px;padding:0 24px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--gray);">Rejected</div>'
            + rejectedData.map(function(e){ return companyRowApproved(e); }).join('') : '')
        : '<p style="font-size:13px;color:var(--gray);padding:12px 24px;">No approved companies yet.</p>';
    }
  }

  async function rejectCompany(id) {
    showConfirmModal(
      'Revoke access',
      'This will block platform access',
      'Are you sure you want to revoke access for this company? They will no longer be able to log in or use the platform.',
      'Revoke',
      'btn-danger',
      function() { doRejectCompany(id); }
    );
  }

  async function doRejectCompany(id) {
    var row = document.getElementById('company-row-' + id);
    if (row) row.style.opacity = '0.4';
    var res = await db.from('employers').update({ status: 'rejected' }).eq('id', id);
    if (res.error) { showToast('Error: ' + res.error.message, 'error'); if (row) row.style.opacity = '1'; return; }
    showToast('Company rejected');
    if (row) row.remove();
    var pendingEl = document.getElementById('admin-pending-list');
    var pendingCt = document.getElementById('admin-pending-count');
    var remaining = pendingEl ? pendingEl.querySelectorAll('[id^="company-row-"]').length : 0;
    if (pendingCt) pendingCt.textContent = remaining + ' pending';
    if (remaining === 0 && pendingEl) pendingEl.innerHTML = '<p style="font-size:13px;color:var(--gray);padding:12px 24px;">No pending accounts 🎉</p>';
  }

  function companyRowApproved(emp) {
    var domain = emp.email ? emp.email.split('@')[1] : '';
    var isFreeEmail = ['gmail.com','hotmail.com','outlook.com','yahoo.com','icloud.com'].includes(domain);
    var domainBadge = isFreeEmail
      ? '<span style="background:#fef2f2;color:#dc2626;border-radius:100px;padding:2px 8px;font-size:11px;font-weight:600;">⚠ ' + esc(domain) + '</span>'
      : '<span style="background:#f0fdf4;color:#16a34a;border-radius:100px;padding:2px 8px;font-size:11px;font-weight:600;">✓ ' + esc(domain) + '</span>';
    var date = emp.created_at ? new Date(emp.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '';
    return '<div data-employer-id="' + esc(emp.id) + '" data-company-name="' + esc(emp.company_name||'') + '" onclick="adminOpenCompany(this)" style="display:flex;align-items:center;gap:16px;padding:16px 24px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'var(--cream)\'" onmouseout="this.style.background=\'\'">'
      + '<div style="flex:1;">'
      + '<div style="font-size:15px;font-weight:600;color:var(--navy);">' + esc(emp.company_name||'—') + '</div>'
      + '<div style="font-size:13px;color:var(--text-light);margin-top:2px;display:flex;align-items:center;gap:8px;">' + esc(emp.email||'') + ' ' + domainBadge + '</div>'
      + (date ? '<div style="font-size:12px;color:var(--gray);margin-top:2px;">Signed up ' + date + '</div>' : '')
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:10px;">'
      + '<button onclick="event.stopPropagation();rejectCompany(\'' + emp.id + '\')" class="btn" style="padding:6px 14px;font-size:12px;background:#fef2f2;color:#dc2626;border-color:#fecaca;">Revoke</button>'
      + '<span style="color:var(--gray);font-size:18px;">→</span>'
      + '</div>'
      + '</div>';
  }

  function adminOpenJob(el) {
    var jobId = el.dataset.jobId;
    var job = window._adminJobMap && window._adminJobMap[jobId];
    if (job) openJobDetailFromDB(job, true);
  }

  async function adminOpenCompany(el) {
    var row = el.closest('[data-employer-id]');
    if (!row) return;
    var employerId = row.dataset.employerId;
    var companyName = row.dataset.companyName;
    if (!employerId) return;
    var res = await db.from('jobs').select('*').eq('employer_id', employerId).order('created_at', {ascending:false});
    var jobs = res.data || [];
    var modal = document.getElementById('admin-company-modal');
    document.getElementById('admin-company-modal-title').textContent = companyName;
    document.getElementById('admin-company-modal-subtitle').textContent = jobs.length + ' listing' + (jobs.length !== 1 ? 's' : '');
    var listEl = document.getElementById('admin-company-modal-list');
    if (!jobs.length) {
      listEl.innerHTML = '<p style="font-size:14px;color:var(--text-light);padding:20px 0;">No listings posted yet.</p>';
    } else {
      // Store jobs in a temp map for click access
      window._adminJobMap = window._adminJobMap || {};
      jobs.forEach(function(j){ window._adminJobMap[j.id] = j; });
      listEl.innerHTML = jobs.map(function(j) {
        var active = j.is_active ? '<span style="background:#f0fdf4;color:#16a34a;border-radius:100px;padding:2px 8px;font-size:11px;font-weight:600;">Active</span>' : '<span style="background:var(--cream-dark);color:var(--gray);border-radius:100px;padding:2px 8px;font-size:11px;font-weight:600;">Inactive</span>';
        var date = j.created_at ? new Date(j.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '';
        return '<div data-job-id="' + esc(j.id) + '" onclick="adminOpenJob(this)" style="display:flex;align-items:center;gap:16px;padding:14px 0;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'var(--cream)\'" onmouseout="this.style.background=\'\'">'
          + '<div style="flex:1;">'
          + '<div style="font-size:15px;font-weight:600;color:var(--navy);">' + esc(j.title||'Untitled') + '</div>'
          + '<div style="font-size:13px;color:var(--text-light);margin-top:2px;">' + esc(j.job_type||'') + (j.field ? ' · ' + esc(j.field) : '') + (j.location ? ' · ' + esc(j.location) : '') + '</div>'
          + (date ? '<div style="font-size:12px;color:var(--gray);margin-top:2px;">Posted ' + date + '</div>' : '')
          + '</div>'
          + active
          + '</div>';
      }).join('');
    }
    modal.classList.add('open');
  }

  async function seedAdminStudent() {
    try {
      var check = await db.from('students').select('id').eq('name', 'Dan Poenaru').limit(1);
      if (check.error) { console.warn('seedAdminStudent check error:', check.error.message); return; }
      if (check.data && check.data.length > 0) { console.log('Admin student already exists — skipping.'); return; }
      var row = {
        name: ADMIN_STUDENT.name,
        degree: ADMIN_STUDENT.degree,
        university: ADMIN_STUDENT.university,
        level: ADMIN_STUDENT.level,
        gpa: ADMIN_STUDENT.gpa,
        avail: ADMIN_STUDENT.avail,
        avail_month: ADMIN_STUDENT.avail_month,
        avail_year: ADMIN_STUDENT.avail_year,
        color: ADMIN_STUDENT.color,
        initial: ADMIN_STUDENT.initial,
        location: ADMIN_STUDENT.location,
        work_auth: ADMIN_STUDENT.work_auth,
        pref_type: ADMIN_STUDENT.pref_type,
        pref_sectors: ADMIN_STUDENT.pref_sectors,
        pref_location: ADMIN_STUDENT.pref_location,
        pref_duration: ADMIN_STUDENT.pref_duration,
        pref_roles: ADMIN_STUDENT.pref_roles,
        skills_technical: ADMIN_STUDENT.skills_technical,
        skills_professional: ADMIN_STUDENT.skills_professional,
        skills_languages: ADMIN_STUDENT.skills_languages,
        education: ADMIN_STUDENT.education,
        experience: ADMIN_STUDENT.experience,
        orgs: ADMIN_STUDENT.orgs,
        docs: ADMIN_STUDENT.docs,
        is_active: true,
        is_admin: true
      };
      var ins = await db.from('students').insert([row]);
      if (ins.error) { console.error('Admin seed error:', ins.error.message); }
      else { console.log('Admin student (Dan Poenaru) seeded.'); }
    } catch(err) { console.error('seedAdminStudent:', err.message); }
  }

  async function seedStudentsIfEmpty() {
    try {
      var check = await db.from('students').select('id').limit(1);
      if (check.error) {
        // Table may not exist yet — log clearly and bail
        console.warn('students table not found or not accessible. Create it in Supabase first. Error:', check.error.message);
        return;
      }
      if (check.data && check.data.length > 0) {
        console.log('Students already seeded — skipping.');
        return;
      }
      var rows = SEED_STUDENTS.map(function(s) {
        return {
          name: s.name,
          degree: s.degree,
          university: s.university,
          level: s.level,
          gpa: s.gpa,
          avail: s.avail,
          avail_month: s.avail_month,
          avail_year: s.avail_year,
          color: s.color,
          initial: s.initial,
          location: s.location,
          work_auth: s.work_auth,
          pref_type: s.pref_type,
          pref_sectors: s.pref_sectors,
          pref_location: s.pref_location,
          pref_duration: s.pref_duration,
          pref_roles: s.pref_roles,
          skills_technical: s.skills_technical,
          skills_professional: s.skills_professional,
          skills_languages: s.skills_languages,
          education: s.education,
          experience: s.experience,
          orgs: s.orgs,
          docs: s.docs,
          is_active: true,
          is_admin: false
        };
      });
      var ins = await db.from('students').insert(rows);
      if (ins.error) { console.error('Seed error:', ins.error.message); }
      else { console.log('Seeded', rows.length, 'students.'); }
    } catch(err) {
      console.error('seedStudentsIfEmpty:', err.message);
    }
  }

  function renderStudentCards(students, gridId) {
    var grid = document.getElementById(gridId);
    if (!grid) return;
    if (!students || students.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray);font-size:13px;">No students found.</div>';
      return;
    }
    grid.innerHTML = '';
    students.forEach(function(s) {
      var topSkills = (s.skills_technical || []).slice(0, 3).map(function(sk) {
        if (!sk) return '';
        if (typeof sk === 'object') return sk.name || '';
        try { var p = JSON.parse(sk); return p.name || sk; } catch(e) { return sk; }
      }).filter(Boolean);
      var card = document.createElement('div');
      card.className = 'student-card';
      var uniShort = (s.university||'').includes('Tilburg') ? 'TiU' : (s.university||'University').split(' ')[0];
      var matchBadge = matchBadgeHTML(s._matchPct);
      var bestFitLine = s._matchJobTitle
        ? '<div style="font-size:11px;color:var(--text-light);margin-top:4px;">Best fit: <span style="color:var(--navy);font-weight:600;">' + esc(s._matchJobTitle) + '</span></div>'
        : '';
      var rightTop = matchBadge
        ? '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">' + matchBadge + '<span class="avail-badge">' + esc(s.avail||'Available') + '</span></div>'
        : '<span class="avail-badge">' + esc(s.avail||'Available') + '</span>';
      card.innerHTML =
        '<div class="student-card-top">'
        + '<div class="student-card-avatar" style="background:' + esc(s.color) + ';">' + esc(s.initial) + '</div>'
        + '<div><h4>' + esc(s.name||'') + '</h4><p>' + esc(s.degree||'Student') + ' &middot; ' + esc(uniShort) + '</p>' + bestFitLine + '</div>'
        + rightTop
        + '</div>'
        + '<div class="student-card-tags">'
        + '<span class="tag tag-type">' + esc(s.pref_type || 'Internship') + '</span>'
        + topSkills.map(function(sk) { return '<span class="skill-tag" style="font-size:11px;padding:3px 10px;">' + esc(sk) + '</span>'; }).join('')
        + '</div>'
        + '<div class="student-card-footer">'
        + '<span>' + esc(s.location) + ((s.pref_locations || s.pref_location || '').toLowerCase().includes('hybrid') ? ' / Hybrid' : '') + '</span>'
        + '<button class="shortlist-btn" onclick="event.stopPropagation();shortlistStudent(this)">&#9734; Save</button>'
        + '</div>';
      card.onclick = (function(student) {
        return function() { openStudentFromDB(student); };
      })(s);
      grid.appendChild(card);
    });
  }

  function openStudentFromDB(s, hideInvite) {
    // Normalize an entry to {title, sub, desc} regardless of which shape it was saved in
    function normalizeEdu(e) {
      if (!e) return e;
      if (e.title) return e; // already in modal format
      var title = [e.field, e.level].filter(Boolean).join(' — ') || e.uni || 'Education';
      var parts = [e.uni, e.level, e.gpa ? 'GPA ' + e.gpa : ''].filter(Boolean);
      var period = [(e.startMonth||'') + ' ' + (e.startYear||''), e.stillStudying ? 'Present' : (e.endMonth||'') + ' ' + (e.endYear||'')].filter(function(s){ return s.trim(); }).join(' — ');
      return { title: title, sub: parts.join(' · ') + (period ? ' · ' + period : ''), desc: e.desc || '' };
    }
    function normalizeExp(e) {
      if (!e) return e;
      if (e.title) return e;
      var period = [(e.startMonth||'') + ' ' + (e.startYear||''), e.stillWorking ? 'Present' : (e.endMonth||'') + ' ' + (e.endYear||'')].filter(function(s){ return s.trim(); }).join(' — ');
      return { title: e.role || 'Role', sub: [e.company, e.location, period].filter(Boolean).join(' · '), desc: e.desc || '' };
    }
    function normalizeOrg(e) {
      if (!e) return e;
      if (e.title) return e;
      var period = [(e.startMonth||'') + ' ' + (e.startYear||''), e.stillMember ? 'Present' : (e.endMonth||'') + ' ' + (e.endYear||'')].filter(function(s){ return s.trim(); }).join(' — ');
      return { title: e.role || 'Member', sub: [e.org, period].filter(Boolean).join(' · '), desc: e.desc || '' };
    }
    // Normalize skill arrays — may be strings or {name,source,proof} objects
    function normSkills(arr) {
      return (arr || []).map(function(sk) {
        if (!sk) return '';
        if (typeof sk === 'object') return sk.name || '';
        if (typeof sk === 'string') {
          // Try to parse JSON string e.g. '{"name":"Python","source":"..."}'
          try {
            var parsed = JSON.parse(sk);
            return parsed.name || sk;
          } catch(e) { return sk; }
        }
        return '';
      }).filter(Boolean);
    }
    function parseArr(val) {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return []; } }
      return [];
    }
    var p = {
      id: s.id,
      degree: s.degree || s.level || '—',
      university: s.university || '—',
      gpa: s.gpa ? s.gpa + ' / 10' : '—',
      avail: [(s.avail_month||''), (s.avail_year||'')].filter(Boolean).join(' ') || s.avail || '—',
      color: s.color || 'var(--navy)',
      initial: s.initial || (s.name||'A')[0].toUpperCase(),
      workAuth: s.work_auth || '—',
      bio: s.bio || '',
      education:  parseArr(s.education).map(normalizeEdu),
      experience: parseArr(s.experience).map(normalizeExp),
      orgs:       parseArr(s.organisations).map(normalizeOrg),
      skills: {
        technical:    parseArr(s.skills_technical),
        professional: parseArr(s.skills_professional),
        languages:    parseArr(s.skills_languages)
      },
      prefs: {
        type:     s.pref_type     || '—',
        start:    [(s.avail_month||''), (s.avail_year||'')].filter(Boolean).join(' ') || '—',
        duration: s.pref_duration || '—',
        location: s.pref_locations || s.pref_location || '—',
        sectors:  s.pref_sectors  || '—',
        roles:    parseArr(s.role_interests).map(function(r){ return {name:r}; })
      },
      docs: parseArr(s.docs)
    };
    if (typeof applicantProfiles !== 'undefined') { applicantProfiles[s.name] = p; }
    openStudentModalWithProfile(s.name, p, hideInvite);
  }

  // ─── BROWSE STUDENTS — SPONTANEOUS VIEW FILTERS ─────────────────────────
  // Reads the sidebar filters, narrows the cached student list, re-renders
  // the spontaneous grid. Filter values mirror the student-profile chip
  // values (pref_type, current_status, field_of_study, pref_sectors,
  // pref_locations, work_auth) so the two stay in sync.
  function getCheckedFilterValues(groupId) {
    var grp = document.getElementById(groupId);
    if (!grp) return [];
    return Array.from(grp.querySelectorAll('input[type="checkbox"]:checked'))
      .map(function(c){ return c.dataset.val; });
  }

  // Sort a student list in-place by one of three keys used in the Browse views:
  //   'match'     — highest _matchPct first (default for both grids)
  //   'available' — smallest avail_year + month first (soonest available)
  //   'recent'    — most recent created_at first (recently joined)
  // Returns the same array for chaining.
  var _MONTH_NUM = {
    'January':1,'February':2,'March':3,'April':4,'May':5,'June':6,
    'July':7,'August':8,'September':9,'October':10,'November':11,'December':12,
    'Jan':1,'Feb':2,'Mar':3,'Apr':4,'Jun':6,'Jul':7,'Aug':8,'Sep':9,'Oct':10,'Nov':11,'Dec':12
  };
  function sortStudentsBy(arr, sortKey) {
    if (!Array.isArray(arr)) return arr;
    if (sortKey === 'available') {
      arr.sort(function(a, b) {
        var ay = parseInt(a.avail_year, 10); if (isNaN(ay)) ay = 9999;
        var by = parseInt(b.avail_year, 10); if (isNaN(by)) by = 9999;
        if (ay !== by) return ay - by;
        var am = _MONTH_NUM[(a.avail_month || '').trim()] || 13;
        var bm = _MONTH_NUM[(b.avail_month || '').trim()] || 13;
        return am - bm;
      });
    } else if (sortKey === 'recent') {
      arr.sort(function(a, b) {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });
    } else {
      // 'match' (default)
      arr.sort(function(a, b) {
        var ap = (a._matchPct === null || a._matchPct === undefined) ? -1 : a._matchPct;
        var bp = (b._matchPct === null || b._matchPct === undefined) ? -1 : b._matchPct;
        return bp - ap;
      });
    }
    return arr;
  }

  // Re-sort + re-render the role-view grid when the dropdown changes.
  function applyRoleSort() {
    var students = window._roleStudentsAll || [];
    if (!students.length) return;
    var sortKey = (document.getElementById('sort-role') || {}).value || 'match';
    sortStudentsBy(students, sortKey);
    renderStudentCards(students, 'browse-role-grid');
  }

  // ─── SETTINGS PAGES (student + company) ────────────────────────────────
  // Notification keys used by both roles' checkboxes
  var _STU_NOTIF_KEYS = ['invite','status','message','digest'];
  var _CO_NOTIF_KEYS  = ['application','message','digest','deadline'];

  function _formatLastSignIn(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      return d.toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch(e) { return '—'; }
  }

  async function loadStudentSettings() {
    if (!currentStudent) return;
    var session = await db.auth.getSession();
    var user = session && session.data && session.data.session ? session.data.session.user : null;
    var setText = function(id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; };
    setText('settings-stu-email', user ? user.email : (currentStudent.email || '—'));
    setText('settings-stu-uid', currentStudent.id || '—');
    setText('settings-stu-lastlogin', user ? _formatLastSignIn(user.last_sign_in_at) : '—');

    // Hydrate notification toggles from notification_prefs jsonb
    var prefs = currentStudent.notification_prefs || {};
    _STU_NOTIF_KEYS.forEach(function(k) {
      var el = document.getElementById('notif-stu-' + k);
      if (el) el.checked = (prefs[k] !== false); // default ON
    });
  }

  async function loadCompanySettings() {
    if (!currentEmployer) return;
    var session = await db.auth.getSession();
    var user = session && session.data && session.data.session ? session.data.session.user : null;
    var setText = function(id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; };
    setText('settings-co-email', user ? user.email : (currentEmployer.email || '—'));
    setText('settings-co-uid', currentEmployer.id || '—');
    setText('settings-co-lastlogin', user ? _formatLastSignIn(user.last_sign_in_at) : '—');

    // Refresh employer record so notification_prefs and auto_archive are current
    var er = await db.from('employers').select('notification_prefs, auto_archive').eq('id', currentEmployer.id).single();
    if (er.data) {
      currentEmployer.notification_prefs = er.data.notification_prefs || {};
      currentEmployer.auto_archive = !!er.data.auto_archive;
    }
    var prefs = currentEmployer.notification_prefs || {};
    _CO_NOTIF_KEYS.forEach(function(k) {
      var el = document.getElementById('notif-co-' + k);
      if (el) el.checked = (prefs[k] !== false);
    });
    var aa = document.getElementById('settings-co-auto-archive');
    if (aa) aa.checked = !!currentEmployer.auto_archive;
  }

  function _flashSaved(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(function(){ el.style.display = 'none'; }, 1600);
  }

  async function saveStudentNotifPrefs() {
    if (!currentStudent) return;
    var prefs = {};
    _STU_NOTIF_KEYS.forEach(function(k) {
      var el = document.getElementById('notif-stu-' + k);
      prefs[k] = !!(el && el.checked);
    });
    var res = await db.from('students').update({ notification_prefs: prefs }).eq('id', currentStudent.id);
    if (!res.error) {
      currentStudent.notification_prefs = prefs;
      _flashSaved('notif-stu-saved');
    }
  }

  async function saveCompanyNotifPrefs() {
    if (!currentEmployer) return;
    var prefs = {};
    _CO_NOTIF_KEYS.forEach(function(k) {
      var el = document.getElementById('notif-co-' + k);
      prefs[k] = !!(el && el.checked);
    });
    var res = await db.from('employers').update({ notification_prefs: prefs }).eq('id', currentEmployer.id);
    if (!res.error) {
      currentEmployer.notification_prefs = prefs;
      _flashSaved('notif-co-saved');
    }
  }

  async function saveCompanyAutoArchive() {
    if (!currentEmployer) return;
    var el = document.getElementById('settings-co-auto-archive');
    var val = !!(el && el.checked);
    var res = await db.from('employers').update({ auto_archive: val }).eq('id', currentEmployer.id);
    if (!res.error) {
      currentEmployer.auto_archive = val;
      showToast(val ? 'Auto-archive turned on' : 'Auto-archive turned off');
    }
  }

  // ─ Change-email modal ──────────────────────────────────────────────────
  function openChangeEmailModal() {
    showConfirmModal(
      'Change your account email',
      'We\'ll send a confirmation link to the new email. The change takes effect once you click it.',
      '<input id="settings-new-email" class="form-input" type="email" placeholder="new.email@example.com" style="width:100%;font-size:14px;" maxlength="150">',
      'Send confirmation',
      'primary',
      async function() {
        var input = document.getElementById('settings-new-email');
        var newEmail = input ? input.value.trim() : '';
        if (!newEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
          showToast('Please enter a valid email');
          return;
        }
        var res = await db.auth.updateUser({ email: newEmail });
        if (res.error) showToast('Could not update: ' + res.error.message);
        else showToast('Confirmation email sent to ' + newEmail);
      }
    );
  }

  // ─ Change-password modal ──────────────────────────────────────────────
  function openChangePasswordModal() {
    showConfirmModal(
      'Change your password',
      'Enter a new password (minimum 8 characters).',
      '<input id="settings-new-pw" class="form-input" type="password" placeholder="New password" style="width:100%;font-size:14px;margin-bottom:8px;" maxlength="128">'
        + '<input id="settings-new-pw2" class="form-input" type="password" placeholder="Confirm new password" style="width:100%;font-size:14px;" maxlength="128">',
      'Update password',
      'primary',
      async function() {
        var pw1 = (document.getElementById('settings-new-pw') || {}).value || '';
        var pw2 = (document.getElementById('settings-new-pw2') || {}).value || '';
        if (pw1.length < 8) { showToast('Password must be at least 8 characters', 'error'); closeConfirmModal(); openChangePasswordModal(); return; }
        if (pw1 !== pw2)    { showToast('Passwords do not match', 'error'); closeConfirmModal(); openChangePasswordModal(); return; }
        var res = await db.auth.updateUser({ password: pw1 });
        if (res.error) showToast('Could not update: ' + res.error.message, 'error');
        else { closeConfirmModal(); showToast('Password updated'); }
      }
    );
  }

  // ─ Download my data ────────────────────────────────────────────────────
  // Pulls the user's records from every table that references them and
  // saves a JSON blob the user can keep. GDPR data-portability move.
  async function downloadMyData(role) {
    try {
      var bundle = { exported_at: new Date().toISOString(), role: role };
      if (role === 'student') {
        var sid = currentStudent && currentStudent.id;
        if (!sid) return;
        var [s, apps, msgs] = await Promise.all([
          db.from('students').select('*').eq('id', sid).single(),
          db.from('applications').select('*').eq('student_id', sid),
          db.from('messages').select('*').eq('student_id', sid)
        ]);
        bundle.profile = s.data || null;
        bundle.applications = apps.data || [];
        bundle.messages = msgs.data || [];
      } else {
        var eid = currentEmployer && currentEmployer.id;
        if (!eid) return;
        var [e, jobs, apps2, msgs2, recs] = await Promise.all([
          db.from('employers').select('*').eq('id', eid).single(),
          db.from('jobs').select('*').eq('employer_id', eid),
          db.from('applications').select('*').eq('employer_id', eid),
          db.from('messages').select('*').eq('employer_id', eid),
          db.from('company_recruiters').select('*').eq('employer_id', eid)
        ]);
        bundle.profile = e.data || null;
        bundle.jobs = jobs.data || [];
        bundle.applications = apps2.data || [];
        bundle.messages = msgs2.data || [];
        bundle.recruiters = recs.data || [];
      }
      var blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'rookies-data-' + (role || 'export') + '-' + Date.now() + '.json';
      document.body.appendChild(a); a.click();
      setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 100);
      showToast('Your data has been downloaded');
    } catch (err) {
      showToast('Export failed: ' + (err.message || 'unknown error'));
    }
  }

  // ─ Delete account ─────────────────────────────────────────────────────
  function confirmDeleteAccount(role) {
    showConfirmModal(
      'Delete your account?',
      'This permanently removes your profile and everything tied to it. There is no undo.',
      '<p style="font-size:13px;color:var(--text-light);margin:0;">'
        + (role === 'student' ? 'Your applications and messages will be deleted along with your profile.' : 'Your listings, applicants and messages will be deleted along with your account.')
        + '</p>',
      'Delete permanently',
      'danger',
      async function() {
        try {
          if (role === 'student' && currentStudent) {
            await db.from('applications').delete().eq('student_id', currentStudent.id);
            await db.from('messages').delete().eq('student_id', currentStudent.id);
            await db.from('students').delete().eq('id', currentStudent.id);
          } else if (role === 'company' && currentEmployer) {
            await db.from('messages').delete().eq('employer_id', currentEmployer.id);
            await db.from('applications').delete().eq('employer_id', currentEmployer.id);
            await db.from('jobs').delete().eq('employer_id', currentEmployer.id);
            await db.from('company_recruiters').delete().eq('employer_id', currentEmployer.id);
            await db.from('employers').delete().eq('id', currentEmployer.id);
          }
        } catch(e) { /* ignore — even partial cleanup is better than nothing */ }
        await db.auth.signOut();
        currentStudent = null; currentEmployer = null;
        showToast('Account deleted');
        showScreen('landing');
      }
    );
  }

  // Loose match for work_auth: the seed data uses old values
  // ("EU citizen", "Non-EU (work permit)") while the new signup form writes
  // canonical values ("EU / EEA / Swiss / Non-EU orientation year",
  // "Non-EU — student visa"). Treat them as equivalent in the filter so old
  // accounts still surface correctly.
  function workAuthMatches(filterVal, studentVal) {
    if (!studentVal) return false;
    if (studentVal === filterVal) return true;
    var fEU = filterVal.indexOf('EU /') === 0;
    var fNonEU = filterVal.indexOf('Non-EU') === 0;
    var sEU  = /^EU citizen$/i.test(studentVal) || studentVal.indexOf('EU /') === 0;
    var sNon = /^Non-EU/i.test(studentVal);
    return (fEU && sEU) || (fNonEU && sNon);
  }

  function applySpontFilters() {
    var all = window._spontStudentsAll || [];

    var fType    = getCheckedFilterValues('filter-pref-type');
    var fStatus  = getCheckedFilterValues('filter-current-status');
    var fFos     = getCheckedFilterValues('filter-field-of-study');
    var fSectors = getCheckedFilterValues('filter-sectors');
    var fLocs    = getCheckedFilterValues('filter-locations');
    var fYears   = getCheckedFilterValues('filter-avail-year');
    var fAuth    = getCheckedFilterValues('filter-work-auth');
    var gpaEl    = document.getElementById('filter-gpa-min');
    var fGpaMin  = gpaEl ? parseFloat(gpaEl.value || '0') : 0;

    function splitList(v) {
      return (v || '').split(',').map(function(t){ return t.trim(); }).filter(Boolean);
    }

    var filtered = all.filter(function(s) {
      // pref_type — student may list multiple, ANY match keeps them
      if (fType.length) {
        var st = splitList(s.pref_type);
        if (!fType.some(function(t){ return st.indexOf(t) !== -1; })) return false;
      }
      // current_status — single value
      if (fStatus.length) {
        if (fStatus.indexOf((s.current_status || '').trim()) === -1) return false;
      }
      // field_of_study — single value
      if (fFos.length) {
        if (fFos.indexOf((s.field_of_study || '').trim()) === -1) return false;
      }
      // pref_sectors — student may list multiple
      if (fSectors.length) {
        var ss = splitList(s.pref_sectors);
        if (!fSectors.some(function(x){ return ss.indexOf(x) !== -1; })) return false;
      }
      // pref_locations — falls back to legacy pref_location for old rows
      if (fLocs.length) {
        var sl = splitList(s.pref_locations || s.pref_location);
        var openAnywhere = sl.indexOf('Open to anywhere') !== -1;
        if (!openAnywhere && !fLocs.some(function(x){ return sl.indexOf(x) !== -1; })) return false;
      }
      // avail_year — checkboxes are strings; coerce
      if (fYears.length) {
        var ay = String(s.avail_year || '').trim();
        if (fYears.indexOf(ay) === -1) return false;
      }
      // work_auth — loose match for old/new value drift
      if (fAuth.length) {
        if (!fAuth.some(function(a){ return workAuthMatches(a, s.work_auth || ''); })) return false;
      }
      // GPA minimum — student gpa is a string like "7.8"
      if (fGpaMin > 0) {
        var gpa = parseFloat(s.gpa);
        if (isNaN(gpa) || gpa < fGpaMin) return false;
      }
      return true;
    });

    // Apply the active sort key from the spontaneous-view dropdown
    var sortKey = (document.getElementById('sort-spontaneous') || {}).value || 'match';
    sortStudentsBy(filtered, sortKey);

    // Update the count label
    var countEl = document.querySelector('#browse-spontaneous-view .results-count strong');
    if (countEl) countEl.textContent = filtered.length + ' students';

    // Render grid (or empty state)
    var grid = document.getElementById('browse-spontaneous-grid');
    if (!grid) return;
    if (!filtered.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:var(--gray);font-size:13px;">'
        + '<div style="font-size:28px;margin-bottom:10px;">🔍</div>'
        + '<div style="font-weight:600;color:var(--navy);margin-bottom:4px;">No students match these filters</div>'
        + '<div>Try unchecking a few options or hit Reset.</div></div>';
    } else {
      renderStudentCards(filtered, 'browse-spontaneous-grid');
    }
  }

  function resetSpontFilters() {
    document.querySelectorAll('#browse-spontaneous-view .filter-scroll input[type="checkbox"]').forEach(function(c){ c.checked = false; });
    var gpaEl = document.getElementById('filter-gpa-min');
    if (gpaEl) gpaEl.value = '';
    applySpontFilters();
  }

  function _showFieldError(el, msg) {
    var parent = el.parentNode;
    var err = parent.querySelector(':scope > .field-error');
    if (!err) {
      err = document.createElement('div');
      err.className = 'field-error';
      parent.appendChild(err);
    }
    err.textContent = msg;
    err.classList.add('visible');
    el.classList.add('error');
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
  function _isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  function isStudentComplete(s) {
    var totalSkills = ((s.skills_technical||[]).length + (s.skills_professional||[]).length + (s.skills_languages||[]).length);
    return !!(
      s.name && s.current_status && s.field_of_study && s.work_auth &&
      s.pref_type && s.pref_locations && s.pref_sectors &&
      s.education && s.education.length >= 1 &&
      totalSkills >= 3
    );
  }

  async function loadStudentsFromDB() {
    try {
      var res = await db.from('students').select('*').eq('is_active', true).order('avail_year').order('name');
      if (res.error) {
        console.warn('loadStudentsFromDB error:', res.error.message);
        return;
      }
      var students = (res.data || []).filter(isStudentComplete);

      // Update count label in spontaneous browse
      var countEl = document.querySelector('#browse-spontaneous-view .results-count strong');
      if (countEl) countEl.textContent = students.length + ' students';

      // For company-side, fetch active jobs once. Used by both grids:
      //   - Spontaneous grid → best-fit across all the company's jobs (ONE number per student)
      //   - Role grid       → score against the specific listing the company clicked into
      var companyJobs = [];
      if (currentEmployer) {
        try {
          var jr = await db.from('jobs')
            .select('*')
            .eq('employer_id', currentEmployer.id)
            .eq('is_active', true);
          companyJobs = jr.data || [];
        } catch(e) { console.warn('company jobs fetch:', e.message); }
      }

      function withScore(s, pct, jobTitle) {
        var clone = Object.assign({}, s);
        clone._matchPct = pct;
        clone._matchJobTitle = jobTitle || null;
        return clone;
      }
      function sortByPct(arr) {
        arr.sort(function(a, b) {
          var ap = (a._matchPct === null || a._matchPct === undefined) ? -1 : a._matchPct;
          var bp = (b._matchPct === null || b._matchPct === undefined) ? -1 : b._matchPct;
          return bp - ap;
        });
      }

      // Spontaneous grid: best-fit across all the company's active jobs
      var spontStudents = students;
      if (companyJobs.length) {
        spontStudents = students.map(function(s) {
          var bm = bestMatchAcrossJobs(s, companyJobs);
          return withScore(s, bm.pct, bm.job ? bm.job.title : null);
        });
        sortByPct(spontStudents);
      }
      // Cache for the spontaneous-view filter sidebar
      window._spontStudentsAll = spontStudents;
      // Re-apply any active filters; falls back to rendering all when none are set
      if (typeof applySpontFilters === 'function') applySpontFilters();
      else renderStudentCards(spontStudents, 'browse-spontaneous-grid');

      // Role grid: score each student against the listing the company clicked.
      // Falls back to best-fit if no role-job is active yet (defensive).
      var roleJob = window._currentRoleJob || null;
      var roleStudents = students;
      if (roleJob) {
        roleStudents = students.map(function(s) {
          // No 'best fit:' subtitle in role-specific view — the whole view is that role
          return withScore(s, matchScore(s, roleJob), null);
        });
        sortByPct(roleStudents);
      } else if (companyJobs.length) {
        roleStudents = spontStudents.slice(); // own copy so role-view sort doesn't reorder spontaneous
      }
      // Cache for the role-view sort dropdown
      window._roleStudentsAll = roleStudents;
      // Apply current dropdown choice (defaults to 'match')
      var roleSortKey = (document.getElementById('sort-role') || {}).value || 'match';
      sortStudentsBy(roleStudents, roleSortKey);
      renderStudentCards(roleStudents, 'browse-role-grid');

      // Role-view count label
      var roleCount = document.getElementById('browse-role-count');
      if (roleCount) {
        roleCount.innerHTML = roleJob
          ? '<strong>' + students.length + ' students</strong> ranked against this role'
          : '<strong>' + students.length + ' students</strong> in the platform';
      }
    } catch(err) {
      console.error('loadStudentsFromDB:', err.message);
    }
  }

  document.addEventListener('DOMContentLoaded',function(){
    if (!db) {
      try {
        var _sb = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
        if (_sb) { db = _sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); console.log('Supabase db initialized on DOMContentLoaded'); }
        else { console.error('Supabase CDN failed to load'); }
      } catch(e) { console.error('Supabase DOMContentLoaded init error:', e.message); }
    }
    // Fix: ensure job-detail-modal is a direct child of body so it's never
    // hidden inside a screen that's toggled off (e.g. screen-company-dash)
    var jdModal = document.getElementById('job-detail-modal');
    if (jdModal) { document.body.appendChild(jdModal); }
    var applyModal = document.getElementById('apply-modal');
    if (applyModal) { document.body.appendChild(applyModal); }
    var studentModal = document.getElementById('student-modal');
    if (studentModal) { document.body.appendChild(studentModal); }
    // Same for post / edit listing modals — keeps their flex height calc
    // independent of the company-dash tab panel display:none toggles.
    var postModal = document.getElementById('post-listing-modal');
    if (postModal) { document.body.appendChild(postModal); }
    var editListingModal = document.getElementById('edit-listing-modal');
    if (editListingModal) { document.body.appendChild(editListingModal); }
    var appsScreen = document.getElementById('screen-student-applications');
    if (appsScreen) { document.body.appendChild(appsScreen); }
    checkSession();
    loadJobsFromDB();
    seedStudentsIfEmpty().then(function() { loadStudentsFromDB(); });
    seedAdminStudent();
    // Enter key on login password field
    var pwField = document.getElementById('login-password');
    if (pwField) pwField.addEventListener('keydown', function(e){ if(e.key==='Enter') submitLogin(); });
    var emailField = document.getElementById('login-email');
    if (emailField) emailField.addEventListener('keydown', function(e){ if(e.key==='Enter') submitLogin(); });
  });

  // ─── CORE NAVIGATION ───
  var _studentScreens = ['student-browse', 'student-dash', 'student-profile'];
  var _employerScreens = ['company-dash', 'company-pending', 'company-rejected'];
  function showScreen(name) {
    // Require authentication for protected screens
    if (_studentScreens.indexOf(name) !== -1 && !currentStudent) {
      name = 'student-login';
    }
    if (_employerScreens.indexOf(name) !== -1 && !currentEmployer) {
      name = 'student-login';
    }
    // Block company dashboard access for non-approved employers
    if (name === 'company-dash' && currentEmployer && currentEmployer.status && currentEmployer.status !== 'approved') {
      name = currentEmployer.status === 'rejected' ? 'company-rejected' : 'company-pending';
    }
    document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
    document.getElementById('screen-' + name).classList.add('active');
    window.scrollTo(0, 0);
  }

  // ─── CAREER OFFICER CONSOLE LAUNCH ───
  // Opens the standalone Career Officer Console HTML (same folder) in a new tab.
  function openCareerConsole() {
    window.open('career-console.html', '_blank');
  }


  // ─── COMPANY TABS ───
  function showCompanyTab(tab) {
    var tabs = ['dashboard','students','listings','applicants','messages','settings'];
    tabs.forEach(function(t) {
      var btn = document.getElementById('ctab-' + t);
      if (btn) btn.classList.toggle('active', t === tab);
    });
    var dash = document.getElementById('real-company-dash');
    var studentsPanel = document.getElementById('company-panel-students');
    var listingsPanel = document.getElementById('company-panel-listings');
    var applicantsPanel = document.getElementById('company-panel-applicants');
    var messagesPanel = document.getElementById('company-panel-messages');
    var settingsPanel = document.getElementById('company-panel-settings');
    [dash, studentsPanel, listingsPanel, applicantsPanel, messagesPanel, settingsPanel].forEach(function(el){ if (el) el.style.display = 'none'; });
    if (tab === 'students' && studentsPanel) studentsPanel.style.display = 'block';
    else if (tab === 'listings' && listingsPanel) listingsPanel.style.display = 'block';
    else if (tab === 'applicants' && applicantsPanel) { applicantsPanel.style.display = 'block'; loadApplicantsPanel(); }
    else if (tab === 'messages' && messagesPanel) { messagesPanel.style.display = 'block'; loadCompanyMessages(); }
    else if (tab === 'settings' && settingsPanel) { settingsPanel.style.display = 'block'; loadCompanySettings(); }
    else if (dash) dash.style.display = 'block';
  }

  // ─── MESSAGING ───
  var currentCompanyThread = null;
  var currentStudentThread = null;

  // ── CSS for message bubbles (injected once) ──
  (function(){
    var s = document.createElement('style');
    s.textContent = [
      '.msg-bubble{max-width:75%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5;}',
      '.msg-bubble.from-employer{background:var(--navy);color:white;border-bottom-right-radius:3px;align-self:flex-end;}',
      '.msg-bubble.from-student{background:white;color:var(--text);border:1px solid var(--border);border-bottom-left-radius:3px;align-self:flex-start;}',
      '.msg-meta{font-size:11px;color:var(--gray);margin-top:3px;}',
      '.msg-meta.right{text-align:right;}',
      '.msg-wrap{display:flex;flex-direction:column;}',
      '.msg-wrap.right{align-items:flex-end;}',
      '.msg-thread-item{padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.15s;}',
      '.msg-thread-item:hover,.msg-thread-item.active{background:var(--cream);}',
      '.msg-thread-item h4{font-size:14px;font-weight:600;color:var(--navy);margin-bottom:2px;}',
      '.msg-thread-item p{font-size:12px;color:var(--gray);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.msg-unread-dot{width:8px;height:8px;background:#f43f5e;border-radius:50%;flex-shrink:0;}'
    ].join('');
    document.head.appendChild(s);
  }());

  // ── Company: load all threads ──
  async function loadCompanyMessages() {
    var listEl = document.getElementById('company-msg-thread-list');
    if (!listEl || !currentEmployer) return;
    listEl.innerHTML = '<div style="padding:16px;font-size:13px;color:var(--gray);">Loading...</div>';
    var res = await db.from('messages')
      .select('*, jobs(title, company_name), students(name)')
      .eq('employer_id', currentEmployer.id)
      .order('created_at', {ascending:false});
    if (res.error || !res.data || !res.data.length) {
      listEl.innerHTML = '<div style="padding:16px;font-size:13px;color:var(--gray);">No messages yet.</div>';
      return;
    }

    // Pre-fetch all employer jobs to resolve null job_id threads
    var jobsRes = await db.from('jobs').select('id, title').eq('employer_id', currentEmployer.id).order('created_at', {ascending:false});
    var employerJobs = jobsRes.data || [];

    // Group by job_id + student_id — one thread per student per job
    var threads = {};
    res.data.forEach(function(m) {
      var key = (m.job_id || 'nojob') + '_' + (m.student_id || 'nostudent');
      if (!threads[key]) threads[key] = { msgs: [], jobTitle: m.jobs ? m.jobs.title : null, studentName: m.students ? m.students.name : '—', studentId: m.student_id, jobId: m.job_id };
      threads[key].msgs.push(m);
    });

    // For threads with no job_id, auto-link to most recent employer job and patch DB
    var nullThreads = Object.values(threads).filter(function(t){ return !t.jobId && employerJobs.length; });
    if (nullThreads.length && employerJobs.length) {
      var fallbackJob = employerJobs[0]; // most recent
      nullThreads.forEach(function(t) {
        t.jobId = fallbackJob.id;
        t.jobTitle = fallbackJob.title;
      });
      // Patch DB silently — update messages with null job_id for this employer
      db.from('messages').update({ job_id: fallbackJob.id })
        .eq('employer_id', currentEmployer.id)
        .is('job_id', null)
        .then(function(){});
    }

    // Count unread
    var unread = res.data.filter(function(m){ return !m.read && m.sender === 'student'; }).length;
    var badge = document.getElementById('company-msg-badge');
    if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'inline' : 'none'; }

    listEl.innerHTML = '';
    Object.values(threads).forEach(function(thread) {
      var last = thread.msgs[0];
      var hasUnread = thread.msgs.some(function(m){ return !m.read && m.sender === 'student'; });
      var item = document.createElement('div');
      var isActive = currentCompanyThread && currentCompanyThread.jobId === thread.jobId && currentCompanyThread.studentId === thread.studentId;
      item.className = 'msg-thread-item' + (isActive ? ' active' : '');
      item.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">'
        + '<h4>' + esc(thread.studentName) + '</h4>'
        + (hasUnread ? '<span class="msg-unread-dot"></span>' : '')
        + '</div>'
        + '<p>' + esc(thread.jobTitle) + '</p>'
        + '<p style="margin-top:2px;">' + esc((last.body||'').substring(0,60)) + (last.body && last.body.length>60?'…':'') + '</p>';
      item.onclick = function() { openCompanyThread(thread); };
      listEl.appendChild(item);
    });
  }

  async function openCompanyThread(thread) {
    currentCompanyThread = thread;
    var bodyEl = document.getElementById('company-msg-body');
    var emptyEl = document.getElementById('company-msg-empty');
    var headerEl = document.getElementById('company-msg-header');
    var msgsEl = document.getElementById('company-msg-messages');
    if (!bodyEl) return;
    emptyEl.style.display = 'none';
    bodyEl.style.display = 'flex';

    // If jobId exists but title missing, fetch it
    var jobTitle = thread.jobTitle;
    if (thread.jobId && (!jobTitle || jobTitle === '—')) {
      var jr = await db.from('jobs').select('title').eq('id', thread.jobId).single();
      if (!jr.error && jr.data) { jobTitle = jr.data.title; thread.jobTitle = jobTitle; }
    }

    var jobTitleHtml = thread.jobId && jobTitle && jobTitle !== '—'
      ? ' <span style="color:var(--gray);font-weight:400;">—</span> <span data-job-id="'+thread.jobId+'" class="msg-header-link" style="cursor:pointer;text-decoration:underline;text-decoration-color:var(--border);text-underline-offset:3px;color:var(--navy);">'+esc(jobTitle)+'</span>'
      : '';
    headerEl.innerHTML = '<span data-student-id="'+thread.studentId+'" class="msg-header-link" style="cursor:pointer;text-decoration:underline;text-decoration-color:var(--border);text-underline-offset:3px;color:var(--navy);">'+esc(thread.studentName)+'</span>'
      + jobTitleHtml;

    // Fetch ALL messages for this student+job pair
    var res;
    if (thread.jobId) {
      res = await db.from('messages').select('*')
        .eq('job_id', thread.jobId)
        .eq('student_id', thread.studentId)
        .order('created_at', {ascending:true});
      await db.from('messages').update({read:true})
        .eq('job_id', thread.jobId)
        .eq('student_id', thread.studentId)
        .eq('sender','student');
    } else {
      // No job_id (fallback invite) — fetch by employer+student
      res = await db.from('messages').select('*')
        .eq('employer_id', currentEmployer.id)
        .eq('student_id', thread.studentId)
        .is('job_id', null)
        .order('created_at', {ascending:true});
      await db.from('messages').update({read:true})
        .eq('employer_id', currentEmployer.id)
        .eq('student_id', thread.studentId)
        .eq('sender','student');
    }
    if (res.error) return;

    msgsEl.innerHTML = '';
    (res.data||[]).forEach(function(m) {
      var isEmployer = m.sender === 'employer';
      var wrap = document.createElement('div');
      wrap.className = 'msg-wrap' + (isEmployer ? ' right' : '');
      var typeLabel = m.type && m.type !== 'message' ? ('<span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:block;color:'+(m.type==='accepted'?'#22c55e':m.type==='shortlisted'?'#f59e0b':m.type==='invite'?'var(--navy)':'#f43f5e')+'">'+(m.type==='accepted'?'✅ Accepted':m.type==='shortlisted'?'⭐ Shortlisted':m.type==='invite'?'✉ Invite to apply':'❌ Rejected')+'</span>') : '';
      var time = new Date(m.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      wrap.innerHTML = typeLabel + '<div class="msg-bubble ' + (isEmployer?'from-employer':'from-student') + '">' + esc(m.body) + '</div>'
        + '<div class="msg-meta' + (isEmployer?' right':'') + '">' + time + '</div>';
      msgsEl.appendChild(wrap);
    });
    msgsEl.scrollTop = msgsEl.scrollHeight;
    loadCompanyMessages();
  }

  async function sendCompanyMessage() {
    if (!currentCompanyThread || !currentEmployer) return;
    var input = document.getElementById('company-msg-input');
    var body = (input.value || '').trim();
    if (!body) return;
    input.value = '';
    await db.from('messages').insert({
      job_id: currentCompanyThread.jobId,
      application_id: null,
      student_id: currentCompanyThread.studentId,
      employer_id: currentEmployer.id,
      sender: 'employer',
      body: body,
      type: 'message'
    });
    openCompanyThread(currentCompanyThread);
  }

  // ── Student: load all threads ──
  async function loadStudentMessages() {
    var listEl = document.getElementById('student-msg-thread-list');
    if (!listEl || !currentStudent) return;
    listEl.innerHTML = '<div style="padding:16px;font-size:13px;color:var(--gray);">Loading...</div>';
    var res = await db.from('messages')
      .select('*, jobs(title, company_name), employers(company_name)')
      .eq('student_id', currentStudent.id)
      .order('created_at', {ascending:false});
    if (res.error || !res.data || !res.data.length) {
      listEl.innerHTML = '<div style="padding:16px;font-size:13px;color:var(--gray);">No messages yet. Apply to jobs to start a conversation.</div>';
      return;
    }

    // Group by job_id + employer_id — one thread per job per company
    var threads = {};
    res.data.forEach(function(m) {
      var key = (m.job_id || 'nojob') + '_' + (m.employer_id || 'noemployer');
      var companyName = (m.jobs && m.jobs.company_name) || (m.employers && m.employers.company_name) || '—';
      var jobTitle = (m.jobs && m.jobs.title) || null;
      if (!threads[key]) threads[key] = { msgs:[], jobTitle: jobTitle, companyName: companyName, jobId: m.job_id, employerId: m.employer_id };
      threads[key].msgs.push(m);
    });

    // For threads with no job_id, fetch the employer's most recent job and patch DB
    var nullThreadKeys = Object.keys(threads).filter(function(k){ return !threads[k].jobId && threads[k].employerId; });
    for (var i = 0; i < nullThreadKeys.length; i++) {
      var t = threads[nullThreadKeys[i]];
      var jr = await db.from('jobs').select('id, title').eq('employer_id', t.employerId).order('created_at', {ascending:false}).limit(1).single();
      if (!jr.error && jr.data) {
        t.jobId = jr.data.id;
        t.jobTitle = jr.data.title;
        db.from('messages').update({ job_id: jr.data.id })
          .eq('employer_id', t.employerId)
          .eq('student_id', currentStudent.id)
          .is('job_id', null)
          .then(function(){});
      }
    }
    // Count unread
    var unread = res.data.filter(function(m){ return !m.read && m.sender === 'employer'; }).length;
    ['student-msg-badge','student-msg-badge-2','student-msg-badge-3'].forEach(function(id){
      var b = document.getElementById(id);
      if (b) { b.textContent = unread; b.style.display = unread > 0 ? 'inline' : 'none'; }
    });

    listEl.innerHTML = '';
    Object.values(threads).forEach(function(thread) {
      var last = thread.msgs[0];
      var hasUnread = thread.msgs.some(function(m){ return !m.read && m.sender === 'employer'; });
      var item = document.createElement('div');
      var isActive = currentStudentThread && currentStudentThread.jobId === thread.jobId && currentStudentThread.employerId === thread.employerId;
      item.className = 'msg-thread-item' + (isActive ? ' active' : '');
      item.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">'
        + '<h4>' + esc(thread.companyName) + '</h4>'
        + (hasUnread ? '<span class="msg-unread-dot"></span>' : '')
        + '</div>'
        + (thread.jobTitle && thread.jobTitle !== '—' ? '<p>' + esc(thread.jobTitle) + '</p>' : '')
        + '<p style="margin-top:2px;">' + esc((last.body||'').substring(0,60)) + (last.body && last.body.length>60?'…':'') + '</p>';
      item.onclick = function() { openStudentThread(thread); };
      listEl.appendChild(item);
    });
  }

  async function openStudentThread(thread) {
    currentStudentThread = thread;
    var bodyEl = document.getElementById('student-msg-body');
    var emptyEl = document.getElementById('student-msg-empty');
    var headerEl = document.getElementById('student-msg-header');
    var msgsEl = document.getElementById('student-msg-messages');
    if (!bodyEl) return;
    emptyEl.style.display = 'none';
    bodyEl.style.display = 'flex';

    // If we have a jobId but no title yet, fetch it
    var jobTitle = thread.jobTitle;
    if (thread.jobId && (!jobTitle || jobTitle === '—')) {
      var jr = await db.from('jobs').select('title').eq('id', thread.jobId).single();
      if (!jr.error && jr.data) { jobTitle = jr.data.title; thread.jobTitle = jobTitle; }
    }

    var jobTitleHtml = thread.jobId && jobTitle && jobTitle !== '—'
      ? ' <span style="color:var(--gray);font-weight:400;">—</span> <span data-job-id="'+thread.jobId+'" class="msg-header-link" style="cursor:pointer;text-decoration:underline;text-decoration-color:var(--border);text-underline-offset:3px;color:var(--navy);">'+esc(jobTitle)+'</span>'
      : '';
    headerEl.innerHTML = esc(thread.companyName) + jobTitleHtml;

    // Fetch ALL messages for this student+job pair
    var res;
    if (thread.jobId) {
      res = await db.from('messages').select('*')
        .eq('job_id', thread.jobId)
        .eq('student_id', currentStudent.id)
        .order('created_at', {ascending:true});
      await db.from('messages').update({read:true})
        .eq('job_id', thread.jobId)
        .eq('student_id', currentStudent.id)
        .eq('sender','employer');
    } else {
      res = await db.from('messages').select('*')
        .eq('employer_id', thread.employerId)
        .eq('student_id', currentStudent.id)
        .is('job_id', null)
        .order('created_at', {ascending:true});
      await db.from('messages').update({read:true})
        .eq('employer_id', thread.employerId)
        .eq('student_id', currentStudent.id)
        .eq('sender','employer');
    }
    if (res.error) return;

    // Show Apply button only if thread has an invite AND student hasn't applied yet
    var hasInvite = (res.data||[]).some(function(m){ return m.type === 'invite'; });
    var applyWrap = document.getElementById('student-msg-apply-wrap');
    if (applyWrap) {
      if (hasInvite && thread.jobId) {
        var appCheck = await db.from('applications').select('id').eq('student_id', currentStudent.id).eq('job_id', thread.jobId).limit(1);
        var alreadyApplied = appCheck.data && appCheck.data.length > 0;
        applyWrap.style.display = alreadyApplied ? 'none' : 'block';
      } else {
        applyWrap.style.display = 'none';
      }
    }

    msgsEl.innerHTML = '';
    (res.data||[]).forEach(function(m) {
      var isEmployer = m.sender === 'employer';
      var wrap = document.createElement('div');
      wrap.className = 'msg-wrap' + (!isEmployer ? ' right' : '');
      var typeLabel = m.type && m.type !== 'message' ? ('<span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:block;color:'+(m.type==='accepted'?'#22c55e':m.type==='shortlisted'?'#f59e0b':m.type==='invite'?'var(--navy)':'#f43f5e')+'">'+(m.type==='accepted'?'✅ Accepted':m.type==='shortlisted'?'⭐ Shortlisted':m.type==='invite'?'✉ Invite to apply':'❌ Rejected')+'</span>') : '';
      var time = new Date(m.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      wrap.innerHTML = typeLabel + '<div class="msg-bubble ' + (!isEmployer?'from-employer':'from-student') + '">' + esc(m.body) + '</div>'
        + '<div class="msg-meta' + (!isEmployer?' right':'') + '">' + time + '</div>';
      msgsEl.appendChild(wrap);
    });
    msgsEl.scrollTop = msgsEl.scrollHeight;
    loadStudentMessages();
  }

  function applyFromInvite() {
    if (!currentStudentThread || !currentStudentThread.jobId) return;
    var thread = currentStudentThread;
    // Fetch full job then open apply modal — hide apply button when done
    db.from('jobs').select('*').eq('id', thread.jobId).single().then(function(res) {
      if (res.error || !res.data) { showToast('Could not load job', 'error'); return; }
      var job = res.data;
      // Override closeModal to also hide the apply button after submitting
      var _origClose = window._postApplyCallback;
      window._postApplyCallback = function() {
        var wrap = document.getElementById('student-msg-apply-wrap');
        if (wrap) wrap.style.display = 'none';
        window._postApplyCallback = _origClose;
      };
      openApplyModal(job.title, job.company_name, job);
    });
  }

  async function sendStudentMessage() {
    if (!currentStudentThread || !currentStudent) return;
    var input = document.getElementById('student-msg-input');
    var body = (input.value || '').trim();
    if (!body) return;
    input.value = '';
    await db.from('messages').insert({
      job_id: currentStudentThread.jobId,
      application_id: null,
      student_id: currentStudent.id,
      employer_id: currentStudentThread.employerId || null,
      sender: 'student',
      body: body,
      type: 'message'
    });
    openStudentThread(currentStudentThread);
  }

  // Click job title in student message header → open job detail modal
  async function openJobFromMessageThread(jobId) {
    if (!jobId) return;
    var res = await db.from('jobs').select('*').eq('id', jobId).single();
    if (res.error || !res.data) { showToast('Could not load listing', 'error'); return; }
    openJobDetailFromDB(res.data, true); // true = hide apply button
  }

  // Click student name in company message header → open student profile modal
  async function openStudentFromMessageThread(studentId) {
    if (!studentId) return;
    var res = await db.from('students').select('*').eq('id', studentId).single();
    if (res.error || !res.data) { showToast('Could not load student profile', 'error'); return; }
    openStudentFromDB(res.data, true); // true = hide invite button
  }

  // Click handlers for message header links
  document.addEventListener('click', function(e) {
    var link = e.target.closest('.msg-header-link');
    if (!link) return;
    var studentId = link.dataset.studentId;
    var jobId = link.dataset.jobId;
    if (studentId) openStudentFromMessageThread(studentId);
    if (jobId) openJobFromMessageThread(jobId);
  });

  // ─── LISTING FILLED MODAL ───
  var _filledJobId = null;
  var _filledJobTitle = null;

  function openFilledModal(btn) {
    _filledJobId = btn.dataset.jobId;
    _filledJobTitle = btn.dataset.jobTitle;
    var sub = document.getElementById('filled-modal-subtitle');
    if (sub) sub.textContent = _filledJobTitle;
    document.getElementById('filled-student-picker').style.display = 'none';
    document.getElementById('listing-filled-modal').classList.add('open');
  }
  function closeFilledModal() {
    document.getElementById('listing-filled-modal').classList.remove('open');
    _filledJobId = null; _filledJobTitle = null;
  }
  document.addEventListener('DOMContentLoaded', function() {
    var filledModal = document.getElementById('listing-filled-modal');
    if (filledModal) filledModal.addEventListener('click', function(e){ if(e.target===this) closeFilledModal(); });
  });

  async function selectFilledType(type) {
    if (type !== 'rookie') return;
    // Load accepted students for this job
    var res = await db.from('applications').select('*, students(id, name, color, initial, degree, university)')
      .eq('job_id', _filledJobId).eq('status', 'Accepted');
    var picker = document.getElementById('filled-student-picker');
    var listEl = document.getElementById('filled-student-list');
    picker.style.display = 'block';
    if (res.error || !res.data || !res.data.length) {
      listEl.innerHTML = '<p style="font-size:13px;color:var(--gray);">No accepted candidates for this listing yet.</p>';
      return;
    }
    listEl.innerHTML = res.data.map(function(app) {
      var s = app.students || {};
      var name = s.name || app.student_name || 'Student';
      var deg = s.degree || '';
      var color = s.color || 'var(--navy)';
      var initial = s.initial || name[0].toUpperCase();
      return '<div onclick="confirmFilledRookie(\'' + esc(app.student_id) + '\',\'' + esc(name) + '\')" style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:white;border:1.5px solid var(--border);border-radius:10px;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.borderColor=\'var(--navy)\'" onmouseout="this.style.borderColor=\'var(--border)\'">'
        + '<div style="width:40px;height:40px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;color:white;font-size:16px;font-weight:700;flex-shrink:0;">' + esc(initial) + '</div>'
        + '<div><div style="font-size:15px;font-weight:600;color:var(--navy);">' + esc(name) + '</div><div style="font-size:13px;color:var(--text-light);">' + esc(deg) + '</div></div>'
        + '<span style="margin-left:auto;color:var(--gray);">Select →</span>'
        + '</div>';
    }).join('');
  }

  async function confirmFilledRookie(studentId, studentName) {
    if (!_filledJobId) return;
    await db.from('jobs').update({ is_active: false, filled_status: 'rookie', filled_student_id: studentId }).eq('id', _filledJobId);
    closeFilledModal();
    showToast('🎓 Listing filled with ' + studentName + '!');
    loadCompanyDashboard();
  }

  async function markFilledOutside() {
    if (!_filledJobId) return;
    await db.from('jobs').update({ is_active: false, filled_status: 'outside' }).eq('id', _filledJobId);
    closeFilledModal();
    showToast('✓ Listing marked as filled');
    loadCompanyDashboard();
  }

  // ─── APPLY MODAL ───
  var currentApplyJob = null;
  function openApplyModal(jobTitle, companyName, jobObj) {
    document.getElementById('modal-job-title').textContent = jobTitle;
    document.getElementById('modal-company-name').textContent = companyName;
    document.getElementById('success-company').textContent = companyName;
    document.getElementById('modal-apply-form').style.display = 'block';
    document.getElementById('modal-success').style.display = 'none';
    currentApplyJob = jobObj || { title: jobTitle, company_name: companyName };
    document.getElementById('apply-modal').classList.add('open');
    var motivEl = document.getElementById('apply-motivation');
    if (motivEl) motivEl.value = '';
    refreshCharCounters();
  }
  function closeModal() { document.getElementById('apply-modal').classList.remove('open'); }
  async function submitApplication() {
    if (!currentStudent) { showToast('Please log in to apply.', 'error'); return; }
    var motivation = document.getElementById('apply-motivation') || document.querySelector('#modal-apply-form textarea');
    var startDate  = document.querySelector('#modal-apply-form input[type="text"]');
    var job = currentApplyJob || {};

    var application = {
      job_id:          job.id || null,
      job_title:       job.title || document.getElementById('modal-job-title').textContent,
      company_name:    job.company_name || document.getElementById('modal-company-name').textContent,
      job_type:        job.job_type || '',
      field:           job.field || '',
      duration:        job.duration || '',
      employment_type: job.employment_type || '',
      location:        job.location || '',
      pay:             job.pay || '',
      work_auth:       job.work_auth || '',
      deadline_month:  job.deadline_month || '',
      deadline_year:   job.deadline_year || '',
      motivation:      motivation ? motivation.value.trim() : '',
      earliest_start:  startDate  ? startDate.value.trim()  : '',
      status:          'New',
      student_id:      currentStudent.id,
      student_name:    currentStudent.name,
      employer_id:     job.employer_id || null,
    };

    try {
      console.log('Inserting application:', application);
      var res = await db.from('applications').insert([application]);
      console.log('Insert response:', res);
      if (res.error) throw res.error;
      console.log('Application saved:', application.job_title);
      document.getElementById('modal-apply-form').style.display = 'none';
      document.getElementById('modal-success').style.display = 'block';
      loadApplicationsFromDB();
      if (typeof window._postApplyCallback === 'function') { window._postApplyCallback(); }
    } catch(err) {
      console.error('Application save error — full object:', JSON.stringify(err));
      var msg = err.message || err.details || err.hint || JSON.stringify(err);
      showToast('Failed: ' + msg, 'error');
    }
  }
  document.getElementById('apply-modal').addEventListener('click', function(e){ if(e.target===this) closeModal(); });

  // ─── STUDENT MODAL ───
  function openStudentModalWithProfile(name, p, hideInvite) {
    _directProfile = p; // store for openStudentModal to pick up
    openStudentModal(name, p ? p.degree : '', p ? p.avail : '', p ? p.skills.technical : [], p ? p.prefs.sectors : '', p ? p.gpa : '', p ? p.color : '', p ? p.initial : name[0], hideInvite);
  }

  var _directProfile = null; // temporary holder for direct profile bypass

  function openStudentModal(name, degree, avail, skills, sectors, gpa, color, initial, hideInvite) {
    // Use directly passed profile if available, otherwise fall back to applicantProfiles lookup
    var p = _directProfile || ((typeof applicantProfiles !== 'undefined') ? applicantProfiles[name] : null);
    _directProfile = null; // clear after use

    function set(id, val) { var el=document.getElementById(id); if(el) el.innerHTML=val||''; }
    function setText(id, val) { var el=document.getElementById(id); if(el) el.textContent=val||''; }
    function tags(arr) {
      return (arr||[]).map(function(s){
        if(!s) return '';
        var name = typeof s==='object' ? s.name||'' : typeof s==='string' ? (function(){ try { var p=JSON.parse(s); return p.name||s; } catch(e){ return s; } }()) : String(s);
        var proof = typeof s==='object' ? s.proof||'' : '';
        var isUrl = proof && (proof.startsWith('http://')||proof.startsWith('https://'));
        var proofHtml = proof ? (isUrl ? '<a href="'+proof+'" target="_blank" style="font-size:11px;color:var(--orange);text-decoration:none;margin-left:6px;font-weight:700;">↗ proof</a>' : '<span style="font-size:11px;color:var(--orange);margin-left:6px;font-weight:600;">· '+proof+'</span>') : '';
        return name ? '<span class="skill-tag" style="display:inline-flex;align-items:center;">'+name+proofHtml+'</span>' : '';
      }).join('');
    }
    function entries(arr) {
      if (!arr||!arr.length) return '<p style="font-size:13px;color:var(--gray);">None listed.</p>';
      return arr.map(function(e){
        var raw = e.desc || '';
        var desc = raw.replace(/\r\n|\r|\n/g,'<br>');
        return '<div class="cv-entry"><div class="cv-entry-title">'+e.title+'</div><div class="cv-entry-sub">'+e.sub+'</div>'+(desc?'<div class="cv-entry-desc">'+desc+'</div>':'')+'</div>';
      }).join('');
    }

    var nameHero = document.getElementById('smodal-name-hero');
    if (nameHero) nameHero.textContent = name;

    var av = document.getElementById('smodal-avatar');
    av.style.background = p ? p.color : color;
    av.textContent = p ? p.initial : (initial || name[0]);

    // Bio
    var bioBlock = document.getElementById('smodal-bio-block');
    var bioEl = document.getElementById('smodal-bio');
    if (bioBlock && bioEl) {
      if (p && p.bio) { bioBlock.style.display='block'; bioEl.textContent=p.bio; }
      else { bioBlock.style.display='none'; }
    }

    if (p) {
      set('smodal-degree', p.degree + ' &middot; ' + p.university);
      set('smodal-avail', '&#10003; Available ' + p.avail);
      set('smodal-gpa', 'GPA ' + p.gpa);
      set('smodal-auth', '&#127758; ' + p.workAuth);
      set('smodal-education', entries(p.education));
      set('smodal-experience', entries(p.experience));
      var orgsBlock = document.getElementById('smodal-orgs-block');
      if (p.orgs && p.orgs.length) { orgsBlock.style.display='block'; set('smodal-orgs', entries(p.orgs)); }
      else { orgsBlock.style.display='none'; }
      set('smodal-skills-technical', tags(p.skills.technical));
      set('smodal-skills-professional', tags(p.skills.professional));
      set('smodal-skills-languages', tags(p.skills.languages));
      setText('smodal-pref-type', p.prefs.type);
      setText('smodal-pref-start', p.prefs.start);
      setText('smodal-pref-duration', p.prefs.duration);
      setText('smodal-pref-location', p.prefs.location);
      setText('smodal-pref-sectors', p.prefs.sectors);
      set('smodal-pref-roles', tags(p.prefs.roles));
    } else {
      set('smodal-degree', degree + ' &middot; Tilburg University');
      set('smodal-avail', '&#10003; Available ' + avail);
      set('smodal-gpa', 'GPA ' + gpa);
      set('smodal-auth', '');
      set('smodal-education', '<p style="font-size:13px;color:var(--gray);">Not available.</p>');
      set('smodal-experience', '<p style="font-size:13px;color:var(--gray);">Not available.</p>');
      document.getElementById('smodal-orgs-block').style.display = 'none';
      set('smodal-skills-technical', tags(skills));
      set('smodal-skills-professional', '');
      set('smodal-skills-languages', '');
      setText('smodal-pref-sectors', sectors);
      set('smodal-pref-roles', '');
      setText('smodal-pref-type', ''); setText('smodal-pref-start', avail);
      setText('smodal-pref-duration', ''); setText('smodal-pref-location', '');
    }

    document.getElementById('smodal-invited').style.display = 'none';
    var inviteBtn = document.getElementById('smodal-invite-btn');
    if (inviteBtn) inviteBtn.style.display = hideInvite ? 'none' : '';
    var saveBtn = document.getElementById('smodal-save-btn');
    if (saveBtn) { saveBtn.textContent = '✴ Save'; saveBtn.style.borderColor = ''; saveBtn.style.color = ''; }
    // Store student name for inviteStudent to use
    _inviteTargetName = name;
    _inviteTargetProfile = p;
    document.getElementById('student-modal').classList.add('open');
  }
  function closeStudentModal() { document.getElementById('student-modal').classList.remove('open'); }
  var _inviteTargetName = null;
  var _inviteTargetProfile = null;

  async function inviteStudent() {
    if (!currentEmployer || !_inviteTargetProfile) return;
    var studentId = _inviteTargetProfile.id;
    var studentName = _inviteTargetName || 'there';

    // First try to find job with invite template, then fall back to any active job
    var jobRes = await db.from('jobs').select('id, title, msg_invite')
      .eq('employer_id', currentEmployer.id)
      .eq('is_active', true)
      .not('msg_invite', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (jobRes.error || !jobRes.data) {
      // No template — fall back to most recent active job
      jobRes = await db.from('jobs').select('id, title, msg_invite')
        .eq('employer_id', currentEmployer.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    }

    var jobId = null, jobTitle = '—', body = null;
    if (!jobRes.error && jobRes.data) {
      jobId = jobRes.data.id;
      jobTitle = jobRes.data.title;
      body = (jobRes.data.msg_invite || '')
        .replace(/\[name\]/gi, studentName)
        .replace(/\[role\]/gi, jobTitle);
    }

    if (!body) {
      body = 'Hi ' + studentName + ', we came across your profile and think you\'d be a great fit for a role at ' + currentEmployer.company_name + '. We\'d love for you to apply!';
    }

    await db.from('messages').insert({
      job_id: jobId,
      application_id: null,
      student_id: studentId,
      employer_id: currentEmployer.id,
      sender: 'employer',
      body: body,
      type: 'invite',
      read: false
    });

    document.getElementById('smodal-invited').style.display = 'block';
    document.getElementById('smodal-invited').textContent = '✓ Invitation sent to ' + studentName + '!';
    showToast('✉ Invitation sent to ' + studentName);
  }
  function saveStudentFromModal() {
    var btn = document.getElementById('smodal-save-btn');
    btn.textContent = '\u2605 Saved'; btn.style.borderColor = 'var(--orange)'; btn.style.color = 'var(--orange)';
  }
  function shortlistStudent(btn) {
    btn.classList.toggle('saved');
    btn.textContent = btn.classList.contains('saved') ? '\u2605 Saved' : '\u2734 Save';
  }
  document.getElementById('student-modal').addEventListener('click', function(e){ if(e.target===this) closeStudentModal(); });

  // ─── APPLICANT CV MODAL ───
  // Populated at runtime by openApplicantCVFromDB() and openStudentFromDB()
  var applicantProfiles = {};
  function openApplicantCV(row) {
    var name = row.querySelector('h4').textContent;
    var appliedDate = row.querySelector('.applied-date') ? row.querySelector('.applied-date').textContent : '';
    var profile = applicantProfiles[name]; if (!profile) return;

    // Helper
    function set(id, val) { var el=document.getElementById(id); if(el) el.innerHTML = val||''; }
    function setText(id, val) { var el=document.getElementById(id); if(el) el.textContent = val||''; }
    function tags(arr) { return (arr||[]).map(function(s){ if(!s)return''; var name=typeof s==='object'?s.name||'':typeof s==='string'?(function(){try{var p=JSON.parse(s);return p.name||s;}catch(e){return s;}}()):String(s); var proof=typeof s==='object'?s.proof||'':''; var isUrl=proof&&(proof.startsWith('http://')||proof.startsWith('https://')); var proofHtml=proof?(isUrl?'<a href="'+proof+'" target="_blank" style="font-size:11px;color:var(--orange);text-decoration:none;margin-left:6px;font-weight:700;" title="View proof">↗ proof</a>':'<span style="font-size:11px;color:var(--orange);margin-left:6px;font-weight:600;">· '+proof+'</span>'):''; return name?'<span class="skill-tag" style="display:inline-flex;align-items:center;">'+name+proofHtml+'</span>':''; }).join(''); }
    function entries(arr) {
      if (!arr || !arr.length) return '<p style="font-size:13px;color:var(--gray);">None listed.</p>';
      return arr.map(function(e){
        var raw = e.desc || '';
        var desc = raw.replace(/\r\n|\r|\n/g,'<br>');
        return '<div class="cv-entry"><div class="cv-entry-title">'+e.title+'</div><div class="cv-entry-sub">'+e.sub+'</div>'+(desc?'<div class="cv-entry-desc">'+desc+'</div>':'')+'</div>';
      }).join('');
    }

    // Header
    setText('cv-modal-name', name);
    setText('cv-name', name);
    set('cv-degree', profile.degree + ' &middot; ' + profile.university);
    var av = document.getElementById('cv-avatar'); av.style.background = profile.color; av.textContent = profile.initial;
    set('cv-avail-badge', '&#10003; Available ' + profile.avail);
    set('cv-gpa-badge', 'GPA ' + profile.gpa);
    set('cv-auth-badge', '&#127758; ' + profile.workAuth);
    set('cv-applied-badge', appliedDate);

    // Status
    var statusRow = row.querySelector('.applicant-status-select');
    var cvStatus = document.getElementById('cv-status-select');
    if (statusRow && cvStatus) { cvStatus.value = statusRow.value || 'New'; }

    // Motivation
    var motBlock = document.getElementById('cv-motivation-block');
    var motText = document.getElementById('cv-motivation');
    if (profile.motivation) { motBlock.style.display = 'block'; motText.textContent = '“' + profile.motivation + '”'; }
    else { motBlock.style.display = 'none'; }

    // Bio
    var bioBlock = document.getElementById('cv-bio-block');
    var bioText = document.getElementById('cv-bio');
    if (bioBlock && bioText) {
      if (profile.bio) { bioBlock.style.display = 'block'; bioText.textContent = profile.bio; }
      else { bioBlock.style.display = 'none'; }
    }

    // Education & Experience
    set('cv-education', entries(profile.education));
    set('cv-experience', entries(profile.experience));

    // Organisations
    var orgsBlock = document.getElementById('cv-orgs-block');
    if (profile.orgs && profile.orgs.length) {
      orgsBlock.style.display = 'block';
      set('cv-orgs', entries(profile.orgs));
    } else { orgsBlock.style.display = 'none'; }

    // Skills
    set('cv-skills-technical', tags(profile.skills.technical));
    set('cv-skills-professional', tags(profile.skills.professional));
    set('cv-skills-languages', tags(profile.skills.languages));

    // Preferences
    setText('cv-pref-type', profile.prefs.type);
    setText('cv-pref-start', profile.prefs.start);
    setText('cv-pref-duration', profile.prefs.duration);
    setText('cv-pref-sectors', profile.prefs.sectors);
    setText('cv-pref-location', profile.prefs.location);
    set('cv-pref-roles', tags(profile.prefs.roles));

    // Documents
    set('cv-docs', profile.docs.map(function(d){
      return '<span class="cv-doc-chip">&#128196; ' + d + '</span>';
    }).join(''));

    // Store ref for status sync
    document.getElementById('applicant-cv-modal').dataset.rowRef = name;
    currentCVRow = row;

    // Reset shortlist btn
    var slBtn = document.getElementById('cv-shortlist-btn');
    if (slBtn) { slBtn.textContent = '⭐ Shortlist'; }
    // Reset pending + buttons to clean outline state
    _pendingStatus = null;
    _resetSendBtn();

    document.getElementById('applicant-cv-modal').classList.add('open');
  }

  var currentCVRow = null;

  function updateCVStatus(sel) {
    // Sync back to the applicant row
    if (currentCVRow) {
      var rowSel = currentCVRow.querySelector('.applicant-status-select');
      if (rowSel) { rowSel.value = sel.value; updateApplicantStatus(rowSel); }
    }
  }

  function shortlistFromCV(btn) {
    btn.textContent = '★ Shortlisted';
    btn.style.borderColor = 'var(--orange)';
    btn.style.color = 'var(--orange)';
    if (currentCVRow) {
      var rowSel = currentCVRow.querySelector('.applicant-status-select');
      if (rowSel) { rowSel.value = 'Shortlisted'; updateApplicantStatus(rowSel); }
    }
    var cvSel = document.getElementById('cv-status-select');
    if (cvSel) cvSel.value = 'Shortlisted';
  }

  function inviteApplicantInterview() {
    var n = document.getElementById('cv-name');
    var name = n ? n.textContent : 'this applicant';
    alert('Interview invitation sent to ' + name + '!');
  }
  async function setApplicantStatus(status) {
    if (!currentCVRow) return;
    var appId = currentCVRow.dataset.id;
    if (!appId) return;
    await db.from('applications').update({ status: status }).eq('id', appId);
    currentCVRow.dataset.status = status;
    // Update badge on applicant row
    var statusColors = {'New':'background:#f0f4ff;color:#1a3260;','Accepted':'background:#e8f5e9;color:#2e7d32;','Shortlisted':'background:#fff8e1;color:#e65100;','Rejected':'background:#ffeaea;color:#c62828;'};
    var badge = currentCVRow.querySelector('.applicant-row-actions span');
    if (badge) { badge.textContent = status; badge.style.cssText = (statusColors[status]||statusColors['New']) + 'padding:4px 12px;border-radius:100px;font-size:12px;font-weight:600;'; }
    _highlightStatusBtns(status);

    // Auto-send message template if one exists for this job
    try {
      var appRes = await db.from('applications').select('student_id, job_id, student_name').eq('id', appId).single();
      if (appRes.data) {
        var jobRes = await db.from('jobs').select('msg_accepted, msg_shortlisted, msg_rejected, title').eq('id', appRes.data.job_id).single();
        if (jobRes.data) {
          var msgKey = status === 'Accepted' ? 'msg_accepted' : status === 'Shortlisted' ? 'msg_shortlisted' : 'msg_rejected';
          var template = jobRes.data[msgKey];
          if (template) {
            var body = template
              .replace(/\[name\]/gi, appRes.data.student_name || 'there')
              .replace(/\[role\]/gi, jobRes.data.title || 'the role');
            await db.from('messages').insert({
              job_id: appRes.data.job_id,
              application_id: appId,
              student_id: appRes.data.student_id,
              employer_id: currentEmployer ? currentEmployer.id : null,
              sender: 'employer',
              body: body,
              type: status.toLowerCase()
            });
          }
        }
      }
    } catch(e) { console.error('Message send error:', e.message); }

    // Sync myApplicants in memory + update dashboard
    if (typeof myApplicants !== 'undefined') {
      var app = myApplicants.find(function(a){ return a.id === appId; });
      if (app) {
        app.status = status;
        var appList = document.getElementById('dash-applicant-list');
        if (appList) {
          var colors = ['#e8622a','#2e7d52','#1a3260','#6a1b9a','#5d4037','#c0392b','#0288d1'];
          appList.innerHTML = myApplicants.slice(0, 5).map(function(a, i) {
            var sc = {'New':'background:#f0f4ff;color:#1a3260;','Accepted':'background:#e8f5e9;color:#2e7d32;','Shortlisted':'background:#fff8e1;color:#e65100;','Rejected':'background:#ffeaea;color:#c62828;'};
            var st = a.status || 'New';
            var initial = (a.student_name || 'A').charAt(0).toUpperCase();
            return '<div class="applicant-row">'
              + '<div class="applicant-avatar" style="background:' + colors[i % colors.length] + ';">' + esc(initial) + '</div>'
              + '<div class="applicant-info"><h4>' + esc(a.student_name || 'Applicant') + '</h4>'
              + '<p>Applied for ' + esc(a.job_title || 'a role') + '</p></div>'
              + '<span style="' + (sc[st]||sc['New']) + 'padding:3px 10px;border-radius:100px;font-size:12px;font-weight:600;">' + esc(st) + '</span></div>';
          }).join('');
        }
      }
    }
    showToast(status === 'Accepted' ? '✅ Accepted — message sent' : status === 'Shortlisted' ? '⭐ Shortlisted — message sent' : '❌ Rejected — message sent');
  }

  var _pendingStatus = null;

  function selectApplicantStatus(status) {
    _pendingStatus = status;
    // Style: selected = solid fill, others = outline
    var cfg = {
      'Accepted':  { id:'cv-accept-btn',    bg:'#22c55e', border:'#22c55e' },
      'Shortlisted':{ id:'cv-shortlist-btn', bg:'#f59e0b', border:'#f59e0b' },
      'Rejected':  { id:'cv-reject-btn',    bg:'#f43f5e', border:'#f43f5e' }
    };
    Object.entries(cfg).forEach(function(entry) {
      var s = entry[0]; var c = entry[1];
      var btn = document.getElementById(c.id);
      if (!btn) return;
      if (s === status) {
        btn.style.background = c.bg;
        btn.style.color = 'white';
        btn.style.border = '2px solid ' + c.border;
        btn.style.opacity = '1';
      } else {
        btn.style.background = 'rgba(0,0,0,0.05)';
        btn.style.color = 'var(--gray)';
        btn.style.border = '2px solid var(--border)';
        btn.style.opacity = '0.5';
      }
    });
    // Enable Send button
    var sendBtn = document.getElementById('cv-send-btn');
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.style.opacity = '1';
      sendBtn.style.cursor = 'pointer';
      sendBtn.style.background = 'white';
      sendBtn.style.color = 'var(--navy)';
      sendBtn.style.border = '2px solid var(--navy)';
    }
  }

  async function confirmApplicantStatus() {
    if (!_pendingStatus) return;
    var sendBtn = document.getElementById('cv-send-btn');
    if (sendBtn) { sendBtn.textContent = 'Sending...'; sendBtn.disabled = true; }
    await setApplicantStatus(_pendingStatus);
    _pendingStatus = null;
    closeApplicantCV();
  }

  function _resetSendBtn() {
    var sendBtn = document.getElementById('cv-send-btn');
    if (sendBtn) {
      sendBtn.disabled = true; sendBtn.style.opacity = '0.5';
      sendBtn.style.cursor = 'not-allowed'; sendBtn.style.background = 'white';
      sendBtn.style.color = 'var(--gray)'; sendBtn.style.border = '2px solid var(--border)';
      sendBtn.textContent = 'Send →';
    }
    // Reset all status buttons to outline
    var cfg = {
      'Accepted':  { id:'cv-accept-btn',    color:'#22c55e' },
      'Shortlisted':{ id:'cv-shortlist-btn', color:'#f59e0b' },
      'Rejected':  { id:'cv-reject-btn',    color:'#f43f5e' }
    };
    Object.values(cfg).forEach(function(c) {
      var btn = document.getElementById(c.id);
      if (!btn) return;
      btn.style.background = 'rgba(0,0,0,0.0)'; btn.style.color = c.color;
      btn.style.border = '2px solid ' + c.color; btn.style.opacity = '1';
    });
  }

  function _highlightStatusBtns(status) {
    var cfg = {
      'Accepted':   { id:'cv-accept-btn',    bg:'#22c55e', border:'#22c55e' },
      'Shortlisted':{ id:'cv-shortlist-btn', bg:'#f59e0b', border:'#f59e0b' },
      'Rejected':   { id:'cv-reject-btn',    bg:'#f43f5e', border:'#f43f5e' }
    };
    Object.entries(cfg).forEach(function(entry) {
      var s = entry[0]; var c = entry[1];
      var btn = document.getElementById(c.id);
      if (!btn) return;
      if (s === status) {
        btn.style.background = c.bg; btn.style.color = 'white';
        btn.style.border = '2px solid ' + c.border; btn.style.opacity = '1';
      } else {
        btn.style.background = 'rgba(0,0,0,0.05)'; btn.style.color = 'var(--gray)';
        btn.style.border = '2px solid var(--border)'; btn.style.opacity = '0.5';
      }
    });
  }

  function closeApplicantCV() { document.getElementById('applicant-cv-modal').classList.remove('open'); }
  function toggleJobGroup(header) {
    var list = header.nextElementSibling;
    var isCollapsed = header.classList.toggle('collapsed');
    list.style.display = isCollapsed ? 'none' : 'block';
  }
  document.getElementById('applicant-cv-modal').addEventListener('click', function(e){ if(e.target===this) closeApplicantCV(); });

  // Delegated click on applicant rows — open CV modal
  document.addEventListener('click', function(e) {
    var row = e.target.closest('.applicant-full-row');
    if (!row) return;
    if (e.target.closest('.applicant-row-actions')) return;
    openApplicantCVFromDB(row);
  });

  async function openApplicantCVFromDB(row) {
    var appId = row.dataset.id;
    if (!appId) return;
    try {
      // Fetch application first
      var appRes = await db.from('applications').select('*').eq('id', appId).single();
      if (appRes.error || !appRes.data) { showToast('Could not load application', 'error'); return; }
      var app = appRes.data;

      // Fetch student separately using student_id
      if (!app.student_id) { showToast('No student linked to this application', 'error'); return; }
      var stuRes = await db.from('students').select('*').eq('id', app.student_id).single();
      if (stuRes.error || !stuRes.data) { showToast('Could not load student profile', 'error'); return; }
      var s = stuRes.data;

      // Build profile object compatible with openApplicantCV
      var normSkills = function(arr) {
        return (arr||[]).map(function(sk){
          if (typeof sk === 'string') { try { return JSON.parse(sk); } catch(e) { return {name:sk}; } }
          return sk;
        });
      };
      var edu = (typeof s.education === 'string') ? JSON.parse(s.education||'[]') : (s.education||[]);
      var exp = (typeof s.experience === 'string') ? JSON.parse(s.experience||'[]') : (s.experience||[]);
      var orgs = (typeof s.organisations === 'string') ? JSON.parse(s.organisations||'[]') : (s.organisations||[]);

      var profile = {
        degree: s.degree || s.level || '—',
        university: s.university || '—',
        gpa: s.gpa ? s.gpa + ' / 10' : '—',
        workAuth: s.work_auth || '—',
        avail: [(s.avail_month||''),(s.avail_year||'')].filter(Boolean).join(' ') || '—',
        color: s.color || '#0b1829',
        initial: s.initial || (s.name||'A')[0].toUpperCase(),
        motivation: app.motivation || '',
        bio: s.bio || '',
        education: (edu||[]).map(function(e){ return { title: e.field||e.uni||'Education', sub: [(e.uni||''),(e.level||''),(e.startMonth||'')+' '+(e.startYear||'')+(e.stillStudying?' — Present':e.endMonth?' — '+e.endMonth+' '+(e.endYear||''):'')].filter(Boolean).join(' · '), desc: e.desc||'' }; }),
        experience: (exp||[]).map(function(e){ return { title: e.role||'Role', sub: [(e.company||''),(e.location||''),(e.startMonth||'')+' '+(e.startYear||'')+(e.stillWorking?' — Present':e.endMonth?' — '+e.endMonth+' '+(e.endYear||''):'')].filter(Boolean).join(' · '), desc: e.desc||'' }; }),
        orgs: (orgs||[]).map(function(e){ return { title: e.role||e.name||'Organisation', sub: e.name||'', desc: e.desc||'' }; }),
        skills: {
          technical: normSkills(s.skills_technical),
          professional: normSkills(s.skills_professional),
          languages: normSkills(s.skills_languages)
        },
        prefs: {
          type: s.pref_type||'—',
          start: [(s.avail_month||''),(s.avail_year||'')].filter(Boolean).join(' ')||'—',
          duration: s.pref_duration||'—',
          sectors: s.pref_sectors||'—',
          location: s.pref_locations||'—',
          roles: (s.role_interests||[]).map(function(r){ return {name:r}; })
        },
        docs: []
      };

      // Temporarily inject into applicantProfiles so openApplicantCV works
      applicantProfiles[s.name] = profile;

      // Inject name into row h4 if needed
      var h4 = row.querySelector('h4');
      if (h4) h4.textContent = s.name || app.student_name || 'Applicant';

      openApplicantCV(row);
    } catch(err) {
      showToast('Error loading profile: ' + err.message, 'error');
    }
  }

  // ─── APPLICANT STATUS ───
  function applyStatusColors() {
    document.querySelectorAll('.applicant-status-select').forEach(function(sel){
      if (sel.id === 'cv-status-select') return;
      updateApplicantStatus(sel);
    });
  }
  function updateApplicantStatus(sel) {
    sel.className = 'applicant-status-select';
    var val = sel.value;
    var row = sel.closest('.applicant-full-row');
    if (!row) return;
    row.dataset.status = val;
    if (val==='New') sel.classList.add('status-new');
    else if (val==='In review') sel.classList.add('status-review');
    else if (val==='Shortlisted') sel.classList.add('status-shortlisted');
    else if (val==='Rejected') sel.classList.add('status-rejected');
    filterApplicants();
  }
  function filterApplicants() {
    var filter = document.getElementById('applicants-filter-status');
    if (!filter) return;
    var val = filter.value;
    document.querySelectorAll('.applicant-full-row').forEach(function(row){
      row.classList.toggle('hidden', !(!val || row.dataset.status === val));
    });
    document.querySelectorAll('.applicant-job-group').forEach(function(group){
      var visible = group.querySelectorAll('.applicant-full-row:not(.hidden)').length;
      group.style.display = visible === 0 ? 'none' : 'block';
    });
  }

  // ─── LISTING TAB NAV ───
  function switchListingTab(prefix, tab) {
    ['basics','details','prefs','messages'].forEach(function(t) {
      var btn = document.getElementById(prefix+'-tab-'+t);
      var panel = document.getElementById(prefix+'-panel-'+t);
      if (btn) btn.classList.toggle('active', t===tab);
      if (panel) panel.style.display = t===tab ? 'block' : 'none';
    });
  }

  // ─── POST NEW LISTING ───
  // Populate a "Recruiter in charge" <select> with the company's recruiters.
  // selectedId is optional — used when editing an existing listing.
  async function fillRecruiterSelect(selectId, selectedId) {
    var el = document.getElementById(selectId);
    if (!el || !currentEmployer) return;
    var recruiters = window._companyRecruiters;
    if (!recruiters || !recruiters.length) {
      // Fetch on demand if dashboard hasn't been loaded yet
      var res = await db.from('company_recruiters').select('*').eq('employer_id', currentEmployer.id);
      recruiters = res.data || [];
      window._companyRecruiters = recruiters;
    }
    if (!recruiters.length) {
      el.innerHTML = '<option value="">— None (no recruiters added yet) —</option>';
      return;
    }
    el.innerHTML = '<option value="">— None —</option>'
      + recruiters.map(function(r){
          var label = (r.role ? '['+r.role+'] ' : '') + (r.name||'') + (r.email ? ' · '+r.email : '');
          return '<option value="'+esc(r.id)+'"'+(selectedId===r.id?' selected':'')+'>'+esc(label)+'</option>';
        }).join('');
  }

  function openPostModal() {
    document.getElementById('post-listing-form').style.display = 'flex';
    document.getElementById('post-listing-success').style.display = 'none';
    var postAtsWrap = document.getElementById('post-ats-wrap');
    if (postAtsWrap) postAtsWrap.style.display = 'none';
    fillRecruiterSelect('post-recruiter', null);
    setJobSkills('post', {});
    var mWrap = document.getElementById('post-majors-other-wrap');
    if (mWrap) mWrap.style.display = 'none';
    var mTags = document.getElementById('post-majors-custom-tags');
    if (mTags) mTags.innerHTML = '';
    document.querySelectorAll('#post-location-chips .pref-chip').forEach(function(c){ c.classList.remove('active'); });
    var plWrap = document.getElementById('post-location-other-wrap');
    if (plWrap) plWrap.style.display = 'none';
    var plTags = document.getElementById('post-location-custom-tags');
    if (plTags) plTags.innerHTML = '';
    switchListingTab('post', 'basics');
    ['post-type-chips','post-field-chips','post-duration-chips','post-app-method','post-emp-type','post-work-auth','post-docs','post-messaging','post-dutch-only','post-interview','post-school-year','post-majors'].forEach(function(id){
      var g = document.getElementById(id); if (g) g.querySelectorAll('.pref-chip').forEach(function(c){ c.classList.remove('active'); });
    });
    var defMap = {'post-type-chips':'Internship (stage)','post-app-method':'Apply on platform','post-emp-type':'Full-time','post-work-auth':'EU citizens only','post-messaging':'Enabled','post-dutch-only':'No','post-interview':'No','post-docs':'CV / Resume'};
    Object.keys(defMap).forEach(function(id){ var g=document.getElementById(id); if(g){var c=g.querySelector('[data-val="'+defMap[id]+'"]');if(c)c.classList.add('active');}});
    ['post-title','post-location','post-ats','post-division','post-description','post-role-group','post-pay','post-qualifications','post-gpa-min','post-hiring-team'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
    var n=document.getElementById('post-num-hires'); if(n) n.value='';
    document.getElementById('post-listing-modal').classList.add('open');
  }
  function closePostModal() { document.getElementById('post-listing-modal').classList.remove('open'); }
  async function submitListing() {
    var title = document.getElementById('post-title').value.trim();
    if (!title) { document.getElementById('post-title').focus(); document.getElementById('post-title').style.borderColor='var(--orange)'; return; }
    function getChip(id) { var el=document.querySelector('#'+id+' .pref-chip.active'); return el?el.dataset.val:''; }
    function getChips(id) { var els=document.querySelectorAll('#'+id+' .pref-chip.active'); return Array.from(els).map(function(e){return e.dataset.val;}).join(', '); }
    function getVal(id) { var el=document.getElementById(id); return el?el.value.trim():''; }
    var job = {
      title:title, app_method:getChip('post-app-method'), job_type:getChip('post-type-chips'),
      employment_type:getChip('post-emp-type'), hours_per_week:getVal('post-hours-per-week')||null, field:getFieldValue('post'),
      duration:getChip('post-duration-chips'), location:getJobLocation('post')||'Netherlands',
      work_auth:getChips('post-work-auth'), start_month:getVal('post-start-month'),
      start_year:getVal('post-start-year'), deadline_month:getVal('post-deadline-month'),
      deadline_year:getVal('post-deadline-year'), ats_url:getVal('post-ats'),
      division:getVal('post-division'), description:getVal('post-description'),
      role_group:getVal('post-role-group'), num_hires:parseInt(getVal('post-num-hires'))||1,
      pay:getVal('post-pay'), required_docs:getChips('post-docs'),
      qualifications:getVal('post-qualifications'), grad_from:getVal('post-grad-from'),
      grad_to:getVal('post-grad-to'), school_year:getChips('post-school-year'),
      majors:getMajorsValue('post'), gpa_min:getVal('post-gpa-min'),
      messaging:getChip('post-messaging'),
      dutch_only: getChip('post-dutch-only') === 'Yes',
      hiring_team:getVal('post-hiring-team'),
      recruiter_id: (function(){ var el=document.getElementById('post-recruiter'); return (el && el.value) ? el.value : null; })(),
      is_active:true,
      searched_skills: getJobSkills('post'),
      msg_accepted: getVal('post-msg-accepted') || null,
      msg_shortlisted: getVal('post-msg-shortlisted') || null,
      msg_rejected: getVal('post-msg-rejected') || null,
      msg_invite: getVal('post-msg-invite') || null,
      employer_id:currentEmployer?currentEmployer.id:null,
      company_name:currentEmployer?currentEmployer.company_name:'Demo Company'
    };
    var publishBtn = document.querySelector('#post-panel-prefs .btn-primary');
    if (publishBtn) { publishBtn.textContent='Publishing...'; publishBtn.disabled=true; }
    try {
      var res = await db.from('jobs').insert([job]).select();
      if (res.error) throw res.error;
      var type=job.job_type; var field=job.field; var duration=job.duration; var location=job.location;
      var dMonth=job.deadline_month; var dYear=job.deadline_year;
      var deadline=(dMonth&&dMonth!=='Month')?'Closes '+dMonth+' '+dYear:'No deadline';
      var list=document.getElementById('listings-full-list');
      if (list) {
        var row=document.createElement('div'); row.className='listing-full-row';
        if(res.data&&res.data[0]) row.dataset.jobId=res.data[0].id;
        row.dataset.title=title;
        row.dataset.type=job.job_type||'';row.dataset.appMethod=job.app_method||'';
        row.dataset.empType=job.employment_type||'';row.dataset.field=job.field||'';
        row.dataset.duration=job.duration||'';row.dataset.location=job.location||'';
        row.dataset.workAuth=job.work_auth||'';row.dataset.startMonth=job.start_month||'';
        row.dataset.startYear=job.start_year||'';row.dataset.deadlineMonth=job.deadline_month||'';
        row.dataset.deadlineYear=job.deadline_year||'';row.dataset.ats=job.ats_url||'';
        row.dataset.division=job.division||'';row.dataset.description=job.description||'';
        row.dataset.roleGroup=job.role_group||'';row.dataset.numHires=job.num_hires||'';
        row.dataset.pay=job.pay||'';row.dataset.docs=job.required_docs||'';
        row.dataset.qualifications=job.qualifications||'';row.dataset.gradFrom=job.grad_from||'';
        row.dataset.gradTo=job.grad_to||'';row.dataset.schoolYear=job.school_year||'';
        row.dataset.majors=job.majors||'';row.dataset.gpaMin=job.gpa_min||'';
        row.dataset.messaging=job.messaging||'';row.dataset.interview=job.interview||'';
        row.dataset.hiringTeam=job.hiring_team||'';
        row.innerHTML='<div class="listing-full-left"><div class="listing-full-title">'+title+'</div><div class="listing-full-meta">'+type+(field?' · '+field:'')+(location?' · '+location:'')+(duration?' · '+duration:'')+'</div></div><div class="listing-full-right"><span class="tag tag-new" style="padding:4px 10px;font-size:11px;">Active</span><span class="listing-deadline">'+deadline+'</span><span class="listing-applicants-badge">0 applicants</span><button class="listing-edit-btn" onclick="openEditListing(this)">Edit</button></div>';
        list.appendChild(row);
      }
      var countEl=document.getElementById('listings-count');
      if (countEl) { var count=document.querySelectorAll('#listings-full-list .listing-full-row').length; countEl.textContent=count+' listing'+(count!==1?'s':''); }
      document.getElementById('post-listing-form').style.display='none';
      document.getElementById('post-listing-success').style.display='block';
      showToast('Listing saved to Rookies!');
    } catch(err) {
      console.error('Save error:', err.message);
      showToast('Could not save: '+err.message, 'error');
      if (publishBtn) { publishBtn.textContent='Publish listing →'; publishBtn.disabled=false; }
    }
  }
  document.getElementById('post-listing-modal').addEventListener('click', function(e){ if(e.target===this) closePostModal(); });

  // ─── EDIT LISTING ───
  var editTargetRow = null;
  function openEditListing(btn) {
    editTargetRow = btn.closest('.listing-full-row');
    if (!editTargetRow) { alert('Error: cannot find listing row'); return; }
    var jobId = editTargetRow.dataset.jobId;
    if (!jobId) { alert('Error: no job ID on row'); return; }
    // Fetch full job from DB to ensure all fields are populated
    db.from('jobs').select('*').eq('id', jobId).single().then(function(res) {
      if (res.error || !res.data) { alert('Could not load job: ' + (res.error && res.error.message)); return; }
      _populateEditModal(res.data);
    });
  }

  function _populateEditModal(job) {
    function setChip(groupId, val) {
      var g = document.getElementById(groupId); if (!g) return;
      g.querySelectorAll('.pref-chip').forEach(function(c){ c.classList.remove('active'); });
      if (!val) return;
      val.split(',').forEach(function(v){ var chip = g.querySelector('[data-val="'+v.trim()+'"]'); if (chip) chip.classList.add('active'); });
    }
    function setSelect(id, val) {
      var el = document.getElementById(id); if (!el || !val) return;
      for (var i = 0; i < el.options.length; i++) if (el.options[i].text === val || el.options[i].value === val) { el.selectedIndex = i; break; }
    }
    function setInput(id, val) { var el = document.getElementById(id); if (el) el.value = val || ''; }
    function setTA(id, val)    { var el = document.getElementById(id); if (el) el.value = val || ''; }

    setInput('edit-title',       job.title);
    setChip('edit-app-method',   job.app_method);
    var editAtsWrap = document.getElementById('edit-ats-wrap');
    if (editAtsWrap) editAtsWrap.style.display = job.app_method === 'External (ATS URL)' ? 'block' : 'none';
    setChip('edit-type-chips',   job.job_type);
    setChip('edit-emp-type',     job.employment_type);
    var editHoursWrap = document.getElementById('edit-hours-wrap');
    var editHoursInput = document.getElementById('edit-hours-per-week');
    if (editHoursWrap) editHoursWrap.style.display = job.employment_type === 'Part-time' ? 'block' : 'none';
    if (editHoursInput) editHoursInput.value = job.hours_per_week || '';
    setChip('edit-field-chips',  job.field);
    var knownFieldVals = Array.from(document.querySelectorAll('#edit-field-chips .pref-chip')).map(function(c){ return c.dataset.val; });
    var fieldArr = (job.field || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    var customFields = fieldArr.filter(function(f){ return !knownFieldVals.includes(f); });
    var standardFields = fieldArr.filter(function(f){ return knownFieldVals.includes(f); });
    document.querySelectorAll('#edit-field-chips .pref-chip').forEach(function(c){
      c.classList.toggle('active', standardFields.includes(c.dataset.val) || (customFields.length > 0 && c.dataset.val === 'Other'));
    });
    var editFieldWrap = document.getElementById('edit-field-other-wrap');
    var editFieldTags = document.getElementById('edit-field-custom-tags');
    if (customFields.length > 0) {
      if (editFieldWrap) editFieldWrap.style.display = 'block';
      if (editFieldTags) editFieldTags.innerHTML = customFields.map(function(f){
        return '<span class="role-tag">'+f+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button></span>';
      }).join('');
    } else {
      if (editFieldWrap) editFieldWrap.style.display = 'none';
      if (editFieldTags) editFieldTags.innerHTML = '';
    }
    setChip('edit-duration-chips', job.duration);
    // Restore location chips
    var knownLocs = Array.from(document.querySelectorAll('#edit-location-chips .pref-chip')).map(function(c){ return c.dataset.val; });
    var locArr = (job.location||'').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    var customLocs = locArr.filter(function(l){ return !knownLocs.includes(l); });
    var standardLocs = locArr.filter(function(l){ return knownLocs.includes(l); });
    document.querySelectorAll('#edit-location-chips .pref-chip').forEach(function(c){
      c.classList.toggle('active', standardLocs.includes(c.dataset.val) || (customLocs.length > 0 && c.dataset.val === 'Other'));
    });
    var locWrap = document.getElementById('edit-location-other-wrap');
    var locTags = document.getElementById('edit-location-custom-tags');
    if (customLocs.length > 0) {
      if (locWrap) locWrap.style.display = 'block';
      if (locTags) locTags.innerHTML = customLocs.map(function(l){
        return '<span class="role-tag">'+l+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button></span>';
      }).join('');
    } else {
      if (locWrap) locWrap.style.display = 'none';
      if (locTags) locTags.innerHTML = '';
    }
    setChip('edit-work-auth',    job.work_auth);
    setSelect('edit-start-month',    job.start_month);
    setSelect('edit-start-year',     String(job.start_year || ''));
    setSelect('edit-deadline-month', job.deadline_month);
    setSelect('edit-deadline-year',  String(job.deadline_year || ''));
    setInput('edit-ats',         job.ats_url);
    setInput('edit-division',    job.division);
    setTA('edit-description',    job.description);
    setInput('edit-role-group',  job.role_group);
    setInput('edit-num-hires',   job.num_hires);
    setInput('edit-pay',         job.pay);
    setChip('edit-docs',         job.required_docs);
    setTA('edit-qualifications', job.qualifications);
    var parsedSkills = job.searched_skills || {};
    if (typeof parsedSkills === 'string') { try { parsedSkills = JSON.parse(parsedSkills); } catch(e) { parsedSkills = {}; } }
    setJobSkills('edit', parsedSkills);
    setSelect('edit-grad-from',  String(job.grad_from || ''));
    setSelect('edit-grad-to',    String(job.grad_to   || ''));
    setChip('edit-school-year',  job.school_year);
    setChip('edit-majors',       job.majors);
    // Restore custom majors
    var knownMajorVals = Array.from(document.querySelectorAll('#edit-majors .pref-chip')).map(function(c){ return c.dataset.val; });
    var majorsArr = (job.majors||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
    var customMajors = majorsArr.filter(function(m){ return !knownMajorVals.includes(m); });
    if (customMajors.length > 0) {
      var mWrap = document.getElementById('edit-majors-other-wrap');
      var mTags = document.getElementById('edit-majors-custom-tags');
      if (mWrap) mWrap.style.display = 'block';
      // Activate Other chip
      document.querySelectorAll('#edit-majors .pref-chip').forEach(function(c){ if(c.dataset.val==='Other') c.classList.add('active'); });
      if (mTags) mTags.innerHTML = customMajors.map(function(m){
        return '<span class="role-tag">'+m+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button></span>';
      }).join('');
    }
    setInput('edit-gpa-min',     job.gpa_min);
    setChip('edit-messaging',    job.messaging);
    setChip('edit-dutch-only',   job.dutch_only ? 'Yes' : 'No');
    setChip('edit-interview',    job.interview);
    setInput('edit-hiring-team', job.hiring_team);
    fillRecruiterSelect('edit-recruiter', job.recruiter_id || null);
    setTA('edit-msg-accepted',   job.msg_accepted);
    setTA('edit-msg-shortlisted',job.msg_shortlisted);
    setTA('edit-msg-rejected',   job.msg_rejected);
    setTA('edit-msg-invite',     job.msg_invite);

    // Store job id on the row for saveEditListing
    if (editTargetRow) editTargetRow.dataset.jobId = job.id;

    switchListingTab('edit', 'basics');
    document.getElementById('edit-listing-modal').classList.add('open');
    refreshCharCounters();
  }
  function closeEditModal() { document.getElementById('edit-listing-modal').classList.remove('open'); editTargetRow=null; }

  // ─── COMPANY PROFILE MODAL ───
  function openCompanyProfileModal() {
    if (!currentEmployer) { showToast('Not logged in as a company.', 'error'); return; }
    var e = currentEmployer;
    document.getElementById('cp-company-name').value = e.company_name || '';
    var nameParts = (e.contact_name || '').split(' ');
    document.getElementById('cp-firstname').value = nameParts[0] || '';
    document.getElementById('cp-lastname').value  = nameParts.slice(1).join(' ') || '';
    document.getElementById('cp-email').value      = e.email || '';
    document.getElementById('cp-website').value    = e.website || '';
    document.getElementById('cp-description').value = e.description || '';
    // chips
    document.querySelectorAll('#cp-size-chips .pref-chip').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.val === e.size);
    });
    var knownSectors = Array.from(document.querySelectorAll('#cp-sector-chips .pref-chip')).map(function(b){ return b.dataset.val; });
    var isCustomSector = e.sector && !knownSectors.includes(e.sector);
    document.querySelectorAll('#cp-sector-chips .pref-chip').forEach(function(btn) {
      btn.classList.toggle('active', isCustomSector ? btn.dataset.val === 'Other' : btn.dataset.val === e.sector);
    });
    var cpSectorWrap = document.getElementById('cp-sector-other-wrap');
    var cpSectorOther = document.getElementById('cp-sector-other');
    if (isCustomSector) {
      if (cpSectorWrap) cpSectorWrap.style.display = 'block';
      if (cpSectorOther) cpSectorOther.value = e.sector;
    } else {
      if (cpSectorWrap) cpSectorWrap.style.display = 'none';
      if (cpSectorOther) cpSectorOther.value = '';
    }
    document.getElementById('cp-error').style.display = 'none';
    document.getElementById('company-profile-modal').classList.add('open');
    refreshCharCounters();
    _setupRequiredBadgeWatchers(document.getElementById('company-profile-modal'));
  }
  function closeCompanyProfileModal() {
    document.getElementById('company-profile-modal').classList.remove('open');
  }
  async function saveCompanyProfile() {
    var cpNameEl = document.getElementById('cp-company-name');
    var companyName = cpNameEl.value.trim();
    var first   = document.getElementById('cp-firstname').value.trim();
    var last    = document.getElementById('cp-lastname').value.trim();
    var websiteEl = document.getElementById('cp-website');
    var website = websiteEl.value.trim();
    var descEl = document.getElementById('cp-description');
    var desc = descEl.value.trim();
    var sizeChips = document.getElementById('cp-size-chips');
    var size = (sizeChips.querySelector('.pref-chip.active') || {}).dataset?.val || null;
    var sectorChips = document.getElementById('cp-sector-chips');
    var sector = (sectorChips.querySelector('.pref-chip.active') || {}).dataset?.val || null;
    if (sector === 'Other') { sector = (document.getElementById('cp-sector-other') || {}).value?.trim() || null; }
    var ok = true;
    if (!companyName) { _showFieldError(cpNameEl, 'Company name is required.'); ok = false; } else _clearFieldError(cpNameEl);
    if (!website) { _showFieldError(websiteEl, 'Website is required.'); ok = false; } else _clearFieldError(websiteEl);
    if (!size) { _showFieldError(sizeChips, 'Please select a company size.'); ok = false; } else _clearFieldError(sizeChips);
    if (!sector) { _showFieldError(sectorChips, 'Please select a sector.'); ok = false; } else _clearFieldError(sectorChips);
    if (!desc) { _showFieldError(descEl, 'Please add a company description.'); ok = false; } else _clearFieldError(descEl);
    if (!ok) { _scrollToFirstError(document.getElementById('company-profile-modal')); return; }
    document.getElementById('cp-error').style.display = 'none';
    var btn = document.getElementById('cp-save-btn');
    btn.textContent = 'Saving…'; btn.disabled = true;
    try {
      var updates = {
        company_name:  companyName,
        contact_name:  (first + ' ' + last).trim(),
        website:       website,
        description:   desc,
        size:          size,
        sector:        sector
      };
      var { error } = await db.from('employers').update(updates).eq('id', currentEmployer.id);
      if (error) throw error;
      Object.assign(currentEmployer, updates);
      // Update welcome header and description card
      var h = document.querySelector('.dash-header h2');
      if (h) h.textContent = 'Welcome back, ' + companyName;
      var descCard = document.getElementById('dash-company-desc');
      if (descCard) descCard.textContent = desc || 'No description yet — click Edit profile to add one.';
      closeCompanyProfileModal();
      showToast('Profile updated successfully.');
    } catch(err) {
      var errEl = document.getElementById('cp-error');
      errEl.textContent = err.message || 'Failed to save. Please try again.';
      errEl.style.display = 'block';
    } finally {
      btn.textContent = 'Save changes'; btn.disabled = false;
    }
  }
  document.addEventListener('DOMContentLoaded', function() {
    // Scroll reveal for hero lines
    // Sticky scroll-driven hero animation
    var line2 = document.getElementById('hero-line-2');
    var line2b = document.getElementById('hero-line-2b');
    var line3 = document.getElementById('hero-line-3');
    var line4 = document.getElementById('hero-line-4');
    var line5 = document.getElementById('hero-line-5');
    var scrollHint = document.querySelector('.hero-scroll-hint');
    var heroContainer = document.getElementById('hero-scroll-container');
    var progressFill = document.getElementById('hero-progress-fill');
    var progressBar = document.getElementById('hero-progress-bar');
    var heroAnimationDone = false;
    var dots = [
      document.getElementById('dot-1'),
      document.getElementById('dot-2'),
      document.getElementById('dot-3'),
      document.getElementById('dot-4'),
      document.getElementById('dot-5')
    ];
    function revealLine(el) { if(!el) return; el.style.opacity='1'; el.style.filter='blur(0)'; el.style.transform='translateY(0)'; }
    function hideLine(el)   { if(!el) return; el.style.opacity='0'; el.style.filter='blur(10px)'; el.style.transform='translateY(20px)'; }
    function hideHint() { if(scrollHint) scrollHint.style.opacity='0'; }
    function showHint() { if(scrollHint) scrollHint.style.opacity='1'; }
    function activateDot(index) {
      dots.forEach(function(d, i) {
        if (!d) return;
        d.style.background = i <= index ? 'var(--orange)' : 'rgba(255,255,255,0.2)';
        d.style.transform = i === index ? 'translateX(-50%) scale(1.4)' : 'translateX(-50%) scale(1)';
      });
    }
    window.addEventListener('scroll', function() {
      if (!heroContainer) return;
      var containerHeight = heroContainer.offsetHeight;
      var viewH = window.innerHeight;
      var scrolled = window.scrollY || window.pageYOffset;
      var maxScroll = containerHeight - viewH;
      var progress = Math.min(scrolled / maxScroll, 1);

      // Update progress fill
      if (progressFill) progressFill.style.height = (progress * 100) + '%';
      if (progressBar) progressBar.style.opacity = progress >= 1 ? '0' : '1';

      // Reveal/hide each line based on whether its threshold is currently passed.
      // This makes the animation bidirectional — scrolling back up un-reveals lines.
      if (progress > 0.05) { revealLine(line2);  revealLine(line2b); hideHint(); }
      else                 { hideLine(line2);    hideLine(line2b);   showHint(); }
      if (progress > 0.2)  revealLine(line3); else hideLine(line3);
      if (progress > 0.45) revealLine(line4); else hideLine(line4);
      if (progress > 0.7)  revealLine(line5); else hideLine(line5);

      // Active dot follows the highest-passed threshold
      var dotIdx = progress > 0.7 ? 4
                : progress > 0.45 ? 3
                : progress > 0.2  ? 2
                : progress > 0.05 ? 1
                : 0;
      activateDot(dotIdx);
    }, { passive: true });
    // wire up chip toggles inside the modal
    ['cp-size-chips','cp-sector-chips'].forEach(function(id) {
      var container = document.getElementById(id);
      if (!container) return;
      container.addEventListener('click', function(e) {
        var btn = e.target.closest('.pref-chip'); if (!btn) return;
        container.querySelectorAll('.pref-chip').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        // Show/hide Other input for sector
        if (id === 'cp-sector-chips') {
          var wrap = document.getElementById('cp-sector-other-wrap');
          if (wrap) wrap.style.display = btn.dataset.val === 'Other' ? 'block' : 'none';
          if (btn.dataset.val !== 'Other') { var oi = document.getElementById('cp-sector-other'); if (oi) oi.value = ''; }
        }
      });
    });
    // Wire Other toggle for the static first education entry
    var firstEntry = document.querySelector('#edu-entries-container .edu-entry-form');
    if (firstEntry) {
      var chipsEl = firstEntry.querySelector('.edu-field-chips');
      var otherWrap = firstEntry.querySelector('.edu-field-other-wrap');
      var otherInput = firstEntry.querySelector('.edu-field-other');
      if (chipsEl) {
        chipsEl.addEventListener('click', function(e) {
          var btn = e.target.closest('.pref-chip'); if (!btn) return;
          chipsEl.querySelectorAll('.pref-chip').forEach(function(c){ c.classList.remove('active'); });
          btn.classList.add('active');
          if (otherWrap) otherWrap.style.display = btn.dataset.val === 'Other' ? 'block' : 'none';
          if (otherInput && btn.dataset.val !== 'Other') otherInput.value = '';
        });
      }
      var minorChipsEl = firstEntry.querySelector('.edu-minor-chips');
      var minorOtherWrap = firstEntry.querySelector('.edu-minor-other-wrap');
      var minorInput = firstEntry.querySelector('.edu-minor');
      if (minorChipsEl) {
        minorChipsEl.addEventListener('click', function(e) {
          var btn = e.target.closest('.pref-chip'); if (!btn) return;
          minorChipsEl.querySelectorAll('.pref-chip').forEach(function(c){ c.classList.remove('active'); });
          btn.classList.add('active');
          if (minorOtherWrap) minorOtherWrap.style.display = btn.dataset.val === 'Other' ? 'block' : 'none';
          if (minorInput && btn.dataset.val !== 'Other') minorInput.value = '';
        });
      }
    }
    // Wire Other toggle for the static first experience entry
    var firstExpEntry = document.querySelector('#exp-entries-container .edu-entry-form');
    if (firstExpEntry) {
      var expChipsEl = firstExpEntry.querySelector('.exp-field-chips');
      var expOtherWrap = firstExpEntry.querySelector('.exp-field-other-wrap');
      var expOtherInput = firstExpEntry.querySelector('.exp-field-other');
      if (expChipsEl) {
        expChipsEl.addEventListener('click', function(e) {
          var btn = e.target.closest('.pref-chip'); if (!btn) return;
          expChipsEl.querySelectorAll('.pref-chip').forEach(function(c){ c.classList.remove('active'); });
          btn.classList.add('active');
          if (expOtherWrap) expOtherWrap.style.display = btn.dataset.val === 'Other' ? 'block' : 'none';
          if (expOtherInput && btn.dataset.val !== 'Other') expOtherInput.value = '';
        });
      }
    }
  });
  async function saveEditListing() {
    var title = document.getElementById('edit-title').value.trim();
    if (!title) { document.getElementById('edit-title').focus(); document.getElementById('edit-title').style.borderColor='var(--orange)'; return; }

    function getChip(id){var el=document.querySelector('#'+id+' .pref-chip.active');return el?el.dataset.val:'';}
    function getChips(id){var els=document.querySelectorAll('#'+id+' .pref-chip.active');return Array.from(els).map(function(e){return e.dataset.val;}).join(', ');}
    function getVal(id){var el=document.getElementById(id);return el?el.value.trim():'';}

    var type=getChip('edit-type-chips');
    var field=getFieldValue('edit');
    var dur=getChip('edit-duration-chips');
    var location=getJobLocation('edit');
    var dMonth=getVal('edit-deadline-month');
    var dYear=getVal('edit-deadline-year');
    var deadline=(dMonth&&dMonth!=='Month')?'Closes '+dMonth+' '+dYear:'No deadline';

    var updates = {
      title: title,
      app_method: getChip('edit-app-method'),
      job_type: type,
      employment_type: getChip('edit-emp-type'),
      hours_per_week: getVal('edit-hours-per-week') || null,
      field: field,
      duration: dur,
      location: location,
      work_auth: getChips('edit-work-auth'),
      start_month: getVal('edit-start-month'),
      start_year: getVal('edit-start-year'),
      deadline_month: dMonth,
      deadline_year: dYear,
      ats_url: getVal('edit-ats'),
      division: getVal('edit-division'),
      description: getVal('edit-description'),
      role_group: getVal('edit-role-group'),
      num_hires: parseInt(getVal('edit-num-hires'))||1,
      pay: getVal('edit-pay'),
      required_docs: getChips('edit-docs'),
      qualifications: getVal('edit-qualifications'),
      grad_from: getVal('edit-grad-from'),
      grad_to: getVal('edit-grad-to'),
      school_year: getChips('edit-school-year'),
      majors: getMajorsValue('edit'),
      gpa_min: getVal('edit-gpa-min'),
      messaging: getChip('edit-messaging'),
      dutch_only: getChip('edit-dutch-only') === 'Yes',
      hiring_team: getVal('edit-hiring-team'),
      recruiter_id: (function(){ var el=document.getElementById('edit-recruiter'); return (el && el.value) ? el.value : null; })(),
      searched_skills: getJobSkills('edit'),
      msg_accepted: getVal('edit-msg-accepted') || null,
      msg_shortlisted: getVal('edit-msg-shortlisted') || null,
      msg_rejected: getVal('edit-msg-rejected') || null,
      msg_invite: getVal('edit-msg-invite') || null
    };

    var jobId = editTargetRow ? editTargetRow.dataset.jobId : null;

    if (jobId) {
      try {
        var res = await db.from('jobs').update(updates).eq('id', jobId);
        if (res.error) throw res.error;
        showToast('Listing updated!');
      } catch(err) {
        console.error('Update error:', err.message);
        showToast('Could not update: ' + err.message, 'error');
      }
    } else {
      showToast('Saved locally (no DB id found)', 'error');
    }

    if (editTargetRow) {
      editTargetRow.dataset.title=title;
      editTargetRow.dataset.type=type;
      editTargetRow.dataset.appMethod=getChip('edit-app-method');
      editTargetRow.dataset.empType=getChip('edit-emp-type');
      editTargetRow.dataset.field=field;
      editTargetRow.dataset.duration=dur;
      editTargetRow.dataset.location=location;
      editTargetRow.dataset.workAuth=getChip('edit-work-auth');
      editTargetRow.dataset.startMonth=getVal('edit-start-month');
      editTargetRow.dataset.startYear=getVal('edit-start-year');
      editTargetRow.dataset.deadlineMonth=dMonth;
      editTargetRow.dataset.deadlineYear=dYear;
      editTargetRow.dataset.ats=getVal('edit-ats');
      editTargetRow.dataset.division=getVal('edit-division');
      editTargetRow.dataset.description=getVal('edit-description');
      editTargetRow.dataset.roleGroup=getVal('edit-role-group');
      editTargetRow.dataset.numHires=getVal('edit-num-hires');
      editTargetRow.dataset.pay=getVal('edit-pay');
      editTargetRow.dataset.docs=getChips('edit-docs');
      editTargetRow.dataset.qualifications=getVal('edit-qualifications');
      editTargetRow.dataset.gradFrom=getVal('edit-grad-from');
      editTargetRow.dataset.gradTo=getVal('edit-grad-to');
      editTargetRow.dataset.schoolYear=getChips('edit-school-year');
      editTargetRow.dataset.majors=getChips('edit-majors');
      editTargetRow.dataset.gpaMin=getVal('edit-gpa-min');
      editTargetRow.dataset.messaging=getChip('edit-messaging');
      editTargetRow.dataset.interview=getChip('edit-interview');
      editTargetRow.dataset.hiringTeam=getVal('edit-hiring-team');
      editTargetRow.querySelector('.listing-full-title').textContent=title;
      var metaParts=[type,field,location,dur].filter(Boolean);
      editTargetRow.querySelector('.listing-full-meta').innerHTML=metaParts.join(' \u00b7 ');
      var dl=editTargetRow.querySelector('.listing-deadline'); if(dl) dl.textContent=deadline;
    }
    closeEditModal();
  }
  document.getElementById('edit-listing-modal').addEventListener('click', function(e){ if(e.target===this) closeEditModal(); });

  // ─── EDUCATION EDIT ───
  var eduEntryCount = 1;
  // ── helpers ──
  function _setSelect(sel, val) { if (!sel || val === undefined) return; for (var i=0;i<sel.options.length;i++) { if (sel.options[i].value===val||sel.options[i].text===val) { sel.selectedIndex=i; return; } } }
  function _setInput(el, val) { if (el) el.value = val || ''; }

  function toggleEducationEdit() {
    var r=document.getElementById('edu-read-view'),e=document.getElementById('edu-edit-view'),b=document.getElementById('edu-edit-btn');
    if(e.style.display!=='none'){cancelEducationEdit();return;}
    r.style.display='none';e.style.display='block';b.textContent='Cancel';
    var saved = currentStudent && currentStudent._eduEntries;
    if (saved && saved.length) {
      // Rebuild container from saved entries
      var c = document.getElementById('edu-entries-container');
      // Populate first entry (already in DOM)
      var first = c.querySelector('.edu-entry-form');
      if (first) _populateEduEntry(first, saved[0], 0);
      // Add extra entries
      var existing = c.querySelectorAll('.edu-entry-form').length;
      for (var i = existing; i < saved.length; i++) { addEduEntry(); }
      var all = c.querySelectorAll('.edu-entry-form');
      for (var j = 1; j < saved.length; j++) { _populateEduEntry(all[j], saved[j], j); }
    } else {
      var cb=document.getElementById('still-studying-0');if(cb)toggleEndDate(cb,'edu-end-group-0');
    }
  }
  function _populateEduEntry(el, d, idx) {
    _setSelect(el.querySelector('.edu-university'), d.uni);
    _setSelect(el.querySelector('.edu-degree-level'), d.level);
    var programInput = el.querySelector('.edu-program-name');
    if (programInput) programInput.value = d.field || '';
    // Restore field of study chips
    var chipsEl = el.querySelector('.edu-field-chips');
    var otherWrap = el.querySelector('.edu-field-other-wrap');
    var otherInput = el.querySelector('.edu-field-other');
    if (chipsEl) {
      var fos = d.fieldOfStudy || '';
      var knownVals = Array.from(chipsEl.querySelectorAll('.pref-chip')).map(function(c){ return c.dataset.val; });
      var isOther = fos && !knownVals.includes(fos);
      chipsEl.querySelectorAll('.pref-chip').forEach(function(c){
        c.classList.toggle('active', isOther ? c.dataset.val === 'Other' : c.dataset.val === fos);
      });
      if (otherWrap) otherWrap.style.display = isOther ? 'block' : 'none';
      if (otherInput) otherInput.value = isOther ? fos : '';
      // Wire Other toggle
      chipsEl.addEventListener('click', function(e) {
        var btn = e.target.closest('.pref-chip'); if (!btn) return;
        chipsEl.querySelectorAll('.pref-chip').forEach(function(c){ c.classList.remove('active'); });
        btn.classList.add('active');
        if (otherWrap) otherWrap.style.display = btn.dataset.val === 'Other' ? 'block' : 'none';
        if (otherInput && btn.dataset.val !== 'Other') otherInput.value = '';
      });
    }
    var minorInput = el.querySelector('.edu-minor');
    var minorChipsEl = el.querySelector('.edu-minor-chips');
    var minorOtherWrap = el.querySelector('.edu-minor-other-wrap');
    if (minorChipsEl) {
      var mn = d.minor || '';
      var knownMinors = Array.from(minorChipsEl.querySelectorAll('.pref-chip')).map(function(c){ return c.dataset.val; });
      var isMinorOther = mn && !knownMinors.includes(mn);
      minorChipsEl.querySelectorAll('.pref-chip').forEach(function(c){
        c.classList.toggle('active', isMinorOther ? c.dataset.val === 'Other' : c.dataset.val === mn);
      });
      if (minorOtherWrap) minorOtherWrap.style.display = isMinorOther ? 'block' : 'none';
      if (minorInput) minorInput.value = isMinorOther ? mn : '';
      minorChipsEl.addEventListener('click', function(e) {
        var btn = e.target.closest('.pref-chip'); if (!btn) return;
        minorChipsEl.querySelectorAll('.pref-chip').forEach(function(c){ c.classList.remove('active'); });
        btn.classList.add('active');
        if (minorOtherWrap) minorOtherWrap.style.display = btn.dataset.val === 'Other' ? 'block' : 'none';
        if (minorInput && btn.dataset.val !== 'Other') minorInput.value = '';
      });
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
    var ta = el.querySelector('textarea'); if (ta) ta.value = d.desc || '';
  }
  function toggleEndDate(checkbox, groupId) {
    var group = document.getElementById(groupId); if (!group) return;
    group.style.opacity = checkbox.checked ? '0.4' : '1';
    group.style.pointerEvents = checkbox.checked ? 'none' : 'auto';
    // If this is an education entry, also show/hide the graduation date field
    var entry = checkbox.closest('.edu-entry-form');
    if (entry) {
      var idx = entry.dataset.index || '0';
      var gradGroup = document.getElementById('edu-grad-group-' + idx);
      if (gradGroup) {
        gradGroup.style.display = checkbox.checked ? 'block' : 'none';
      }
    }
  }
  function _renumberEduEntries() {
    document.querySelectorAll('#edu-entries-container .edu-entry-label').forEach(function(lbl, i) {
      lbl.textContent = 'Entry ' + (i + 1);
    });
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
      +'<div class="edu-entry-form-header"><span class="edu-entry-label">Entry '+labelNum+'</span><button class="remove-edu-btn" onclick="removeEduEntry(this)">\u2715 Remove</button></div>'
      +'<div class="edu-form-grid">'
      +'<div class="form-group"><label class="form-label">Institution </label><select class="form-input edu-university"><option value="">Select university...</option><option>Tilburg University</option><option>University of Amsterdam (UvA)</option><option>Erasmus University Rotterdam</option><option>Utrecht University</option><option>Leiden University</option><option>Other</option></select></div>'
      +'<div class="form-group"><label class="form-label">Degree level</label><select class="form-input edu-degree-level"><option value="">Select level...</option><option>Bachelor\'s degree (BSc / BA)</option><option>Pre-master</option><option>Master\'s degree (MSc / MA)</option><option>MBA</option><option>PhD / Doctorate</option><option>Exchange programme</option><option>Other</option></select></div>'
      +'<div class="form-group"><label class="form-label">Name of program </label><input class="form-input edu-program-name" type="text" placeholder="e.g. Business Analytics, Computer Science..." maxlength="150"></div>'
      +'<div class="form-group" style="grid-column:1/-1;"><label class="form-label">Field of study </label><div class="pref-chips edu-field-chips" style="margin-top:6px;flex-wrap:wrap;">'+chipsHtml+'</div><div class="edu-field-other-wrap" style="display:none;margin-top:8px;"><input class="form-input edu-field-other" type="text" placeholder="Please specify your field of study\u2026" maxlength="100"></div></div>'
      +'<div class="form-group" style="grid-column:1/-1;"><label class="form-label">Minor </label><div class="pref-chips edu-minor-chips" style="margin-top:6px;flex-wrap:wrap;">'+minorChipsHtml+'</div><div class="edu-minor-other-wrap" style="display:none;margin-top:8px;"><input class="form-input edu-minor" type="text" placeholder="Please specify your minor\u2026" maxlength="100"></div><div class="form-hint">Additional academic discipline.</div></div>'
      +'<div class="form-group"><label class="form-label">Start date</label><div style="display:flex;gap:8px;"><select class="form-input" style="flex:1;"><option value="">Month</option>'+mo+'</select><select class="form-input" style="flex:1;"><option value="">Year</option>'+yr+'</select></div></div>'
      +'<div class="form-group" id="'+endGroupId+'"><label class="form-label">End date</label><div style="display:flex;gap:8px;"><select class="form-input" style="flex:1;"><option value="">Month</option>'+mo+'</select><select class="form-input" style="flex:1;"><option value="">Year</option>'+yr+'</select></div></div>'
      +'<div class="form-group" style="grid-column:1/-1;"><label class="edu-checkbox-label"><input type="checkbox" id="'+stillStudyingId+'" onchange="toggleEndDate(this,\''+endGroupId+'\')"><span>I am currently enrolled</span></label></div>'
      +'<div class="form-group"><label class="form-label">GPA <span class="field-badge private">Private</span></label><input class="form-input edu-gpa" type="text" placeholder="e.g. 7.8 / 10" maxlength="20"></div>'
      +'<div class="form-group" id="edu-grad-group-'+idx+'" style="display:none;"><label class="form-label">Graduation date</label><div style="display:flex;gap:8px;"><select class="form-input" style="flex:1;"><option value="">Month</option>'+mo+'</select><select class="form-input" style="flex:1;"><option value="">Year</option>'+yr+'</select></div></div>'
      +'<div class="form-group" style="grid-column:1/-1;"><label class="form-label">Description </label><textarea class="form-textarea" style="min-height:70px;" placeholder="Specialisation, thesis topic, relevant coursework..." maxlength="500"></textarea></div>'
      +'</div></div>';
    var w=document.createElement('div');w.innerHTML=html;
    var entry=w.firstChild;
    // Wire Other chip toggle for field of study
    var chipsEl=entry.querySelector('.edu-field-chips');
    var otherWrap=entry.querySelector('.edu-field-other-wrap');
    chipsEl.addEventListener('click',function(e){
      var btn=e.target.closest('.pref-chip');if(!btn)return;
      chipsEl.querySelectorAll('.pref-chip').forEach(function(c){c.classList.remove('active');});
      btn.classList.add('active');
      otherWrap.style.display=btn.dataset.val==='Other'?'block':'none';
      if(btn.dataset.val!=='Other')entry.querySelector('.edu-field-other').value='';
    });
    // Wire Other chip toggle for minor
    var minorChipsEl=entry.querySelector('.edu-minor-chips');
    var minorOtherWrap=entry.querySelector('.edu-minor-other-wrap');
    minorChipsEl.addEventListener('click',function(e){
      var btn=e.target.closest('.pref-chip');if(!btn)return;
      minorChipsEl.querySelectorAll('.pref-chip').forEach(function(c){c.classList.remove('active');});
      btn.classList.add('active');
      minorOtherWrap.style.display=btn.dataset.val==='Other'?'block':'none';
      if(btn.dataset.val!=='Other')entry.querySelector('.edu-minor').value='';
    });
    var eduTA = entry.querySelector('textarea');
    if (eduTA) attachCounterToTextarea(eduTA, 500);
    container.appendChild(entry);
  }
  function removeEduEntry(btn){var e=btn.closest('.edu-entry-form');if(e){e.remove();_renumberEduEntries();}}
  async function saveEducation() {
    var editView=document.getElementById('edu-edit-view'),readView=document.getElementById('edu-read-view'),btn=document.getElementById('edu-edit-btn');
    var entries=document.querySelectorAll('#edu-entries-container .edu-entry-form');var html='';
    var hasValidEdu = Array.from(entries).some(function(entry){
      var uniEl = entry.querySelector('.edu-university'); var fieldEl = entry.querySelector('.edu-program-name');
      return (uniEl && uniEl.value.trim()) || (fieldEl && fieldEl.value.trim());
    });
    if (!hasValidEdu) { showToast('Please add at least one education entry (required).', 'error'); return; }
    var structured = [];
    entries.forEach(function(entry){
      var uni=entry.querySelector('.edu-university')?entry.querySelector('.edu-university').value:'';
      var level=entry.querySelector('.edu-degree-level')?entry.querySelector('.edu-degree-level').value:'';
      var field=entry.querySelector('.edu-program-name')?entry.querySelector('.edu-program-name').value.trim():'';
      var fosChip=entry.querySelector('.edu-field-chips .pref-chip.active');
      var fosVal=fosChip?fosChip.dataset.val:'';
      if(fosVal==='Other'){var fosOther=entry.querySelector('.edu-field-other');fosVal=fosOther?fosOther.value.trim():'';}
      var minor=entry.querySelector('.edu-minor')?entry.querySelector('.edu-minor').value.trim():'';
      var minorChip=entry.querySelector('.edu-minor-chips .pref-chip.active');
      if(minorChip){var mv=minorChip.dataset.val;minor=mv==='Other'?(entry.querySelector('.edu-minor')?entry.querySelector('.edu-minor').value.trim():''):mv;}
      var gpa=entry.querySelector('.edu-gpa')?entry.querySelector('.edu-gpa').value.trim():'';
      var allSelects=entry.querySelectorAll('select:not(.edu-university):not(.edu-degree-level)');
      var startMonth=allSelects[0]?allSelects[0].value:''; var startYear=allSelects[1]?allSelects[1].value:'';
      var endMonth=allSelects[2]?allSelects[2].value:'';   var endYear=allSelects[3]?allSelects[3].value:'';
      var gradMonth=allSelects[4]?allSelects[4].value:'';  var gradYear=allSelects[5]?allSelects[5].value:'';
      var cb=entry.querySelector('input[type="checkbox"]'); var stillStudying=cb?cb.checked:false;
      var desc=entry.querySelector('textarea')?entry.querySelector('textarea').value:'';
      if (!uni && !field) return;
      var endText=stillStudying?'Present':((endMonth||'')+(endYear?' '+endYear:''));
      structured.push({uni,level,field,fieldOfStudy:fosVal,minor,gpa,startMonth,startYear,endMonth,endYear,gradMonth,gradYear,stillStudying,desc});
      html+='<div class="edu-entry-display"><div class="edu-entry-header"><strong>'+(field||uni)+'</strong><span class="edu-period">'+(startMonth+' '+startYear).trim()+' — '+endText+'</span></div><div class="edu-entry-sub">'+uni+(level?' · '+level:'')+(fosVal?' · '+fosVal:'')+(gpa?' · GPA '+gpa:'')+'</div>'+(desc?'<div class="edu-entry-desc">'+desc.replace(/\n/g,'<br>')+'</div>':'')+'</div>';
    });
    if (currentStudent) currentStudent._eduEntries = structured;
    console.log('saveEducation — student id:', currentStudent && currentStudent.id, '| entries:', structured.length);
    try {
      // Derive flat columns from the most recent (first) education entry
      var first = structured[0] || {};
      var flatDegree = [first.level, first.field].filter(Boolean).join(' ') || null;
      var {error} = await db.from('students').update({
        education: structured,
        degree:     flatDegree,
        university: first.uni || null,
        level:      first.level || null,
        gpa:        first.gpa || null
      }).eq('id', currentStudent.id);
      if (error) throw error;
      // Keep currentStudent in sync
      if (currentStudent) {
        currentStudent.education  = structured;
        currentStudent.degree     = flatDegree;
        currentStudent.university = first.uni || null;
        currentStudent.level      = first.level || null;
        currentStudent.gpa        = first.gpa || null;
      }
      console.log('saveEducation — success');
    } catch(err) { console.error('saveEducation error:', err); showToast('Failed to save education: ' + err.message, 'error'); }
    readView.innerHTML=html||'<p style="font-size:13px;color:var(--gray);">No education added.</p>';
    readView.style.display='block';editView.style.display='none';
    btn.innerHTML='Edit <span class="edu-saved-toast">&#10003; Saved</span>';
    setTimeout(function(){btn.textContent='Edit';},2500);
    var _eb = document.getElementById('edu-req-badge'); if (_eb) _eb.style.display = structured.length >= 1 ? 'none' : '';
    loadStudentProfile();
  }
  function cancelEducationEdit(){document.getElementById('edu-edit-view').style.display='none';document.getElementById('edu-read-view').style.display='block';document.getElementById('edu-edit-btn').textContent='Edit';}

  // ─── EXPERIENCE EDIT ───
  var expEntryCount=1;
  function toggleExperienceEdit(){
    var r=document.getElementById('exp-read-view'),e=document.getElementById('exp-edit-view'),b=document.getElementById('exp-edit-btn');
    if(e.style.display!=='none'){cancelExperienceEdit();return;}
    r.style.display='none';e.style.display='block';b.textContent='Cancel';
    var saved = currentStudent && currentStudent._expEntries;
    if (saved && saved.length) {
      var c = document.getElementById('exp-entries-container');
      var first = c.querySelector('.edu-entry-form');
      if (first) _populateExpEntry(first, saved[0]);
      var existing = c.querySelectorAll('.edu-entry-form').length;
      for (var i = existing; i < saved.length; i++) addExpEntry();
      var all = c.querySelectorAll('.edu-entry-form');
      for (var j = 1; j < saved.length; j++) _populateExpEntry(all[j], saved[j]);
    }
  }
  function _populateExpEntry(el, d) {
    var roleInput = el.querySelector('.exp-role'); if (roleInput) roleInput.value = d.role || '';
    var companyInput = el.querySelector('.exp-company'); if (companyInput) companyInput.value = d.company || '';
    var locationInput = el.querySelector('.exp-location'); if (locationInput) locationInput.value = d.location || '';
    // Restore field of work chips
    var chipsEl = el.querySelector('.exp-field-chips');
    var otherWrap = el.querySelector('.exp-field-other-wrap');
    var otherInput = el.querySelector('.exp-field-other');
    if (chipsEl) {
      var fow = d.fieldOfWork || '';
      var knownVals = Array.from(chipsEl.querySelectorAll('.pref-chip')).map(function(c){ return c.dataset.val; });
      var isOther = fow && !knownVals.includes(fow);
      chipsEl.querySelectorAll('.pref-chip').forEach(function(c){
        c.classList.toggle('active', isOther ? c.dataset.val === 'Other' : c.dataset.val === fow);
      });
      if (otherWrap) otherWrap.style.display = isOther ? 'block' : 'none';
      if (otherInput) otherInput.value = isOther ? fow : '';
      chipsEl.addEventListener('click', function(e) {
        var btn = e.target.closest('.pref-chip'); if (!btn) return;
        chipsEl.querySelectorAll('.pref-chip').forEach(function(c){ c.classList.remove('active'); });
        btn.classList.add('active');
        if (otherWrap) otherWrap.style.display = btn.dataset.val === 'Other' ? 'block' : 'none';
        if (otherInput && btn.dataset.val !== 'Other') otherInput.value = '';
      });
    }
    var sels = el.querySelectorAll('select');
    _setSelect(sels[0], d.startMonth); _setSelect(sels[1], d.startYear);
    _setSelect(sels[2], d.endMonth);   _setSelect(sels[3], d.endYear);
    var cb = el.querySelector('input[type="checkbox"]'); if (cb) { cb.checked = !!d.stillWorking; }
    var ta = el.querySelector('textarea'); if (ta) ta.value = d.desc || '';
  }
  function addExpEntry(){
    var c=document.getElementById('exp-entries-container');var idx=expEntryCount++;var endGroupId='exp-end-group-'+idx;var stillId='still-working-'+idx;
    var months='Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');var years=['2019','2020','2021','2022','2023','2024','2025','2026'];
    var mo=months.map(function(m){return '<option>'+m+'</option>';}).join('');var yr=years.map(function(y){return '<option>'+y+'</option>';}).join('');
    var expFields=['Finance & Banking','Consulting','Marketing','Data & Analytics','Technology','HR & People','Law & Legal','Accounting & Audit','Operations','Research','Sustainability','Education','Healthcare','Non-profit','Other'];
    var expFieldChipsHtml=expFields.map(function(f){return '<button class="pref-chip" data-val="'+f+'">'+f+'</button>';}).join('');
    var d=document.createElement('div');d.className='edu-entry-form';d.dataset.index=idx;
    d.innerHTML='<div class="edu-entry-form-header"><span class="edu-entry-label">Entry '+(idx+1)+'</span><button class="remove-edu-btn" onclick="removeExpEntry(this)">\u2715 Remove</button></div>'
      +'<div class="edu-form-grid">'
      +'<div class="form-group"><label class="form-label">Job title / Role </label><input class="form-input exp-role" type="text" placeholder="e.g. Marketing Intern..." maxlength="150"></div>'
      +'<div class="form-group"><label class="form-label">Company / Organisation </label><input class="form-input exp-company" type="text" placeholder="e.g. KPMG, Startup XYZ..." maxlength="150"></div>'
      +'<div class="form-group" style="grid-column:1/-1;"><label class="form-label">Field of work </label><div class="pref-chips exp-field-chips" style="margin-top:6px;flex-wrap:wrap;">'+expFieldChipsHtml+'</div><div class="exp-field-other-wrap" style="display:none;margin-top:8px;"><input class="form-input exp-field-other" type="text" placeholder="Please specify your field of work\u2026" maxlength="100"></div></div>'
      +'<div class="form-group" style="grid-column:1/-1;"><label class="form-label">Location</label><input class="form-input exp-location" type="text" placeholder="City, Country" maxlength="100"></div>'
      +'<div class="form-group"><label class="form-label">Start date</label><div style="display:flex;gap:8px;"><select class="form-input" style="flex:1;"><option value="">Month</option>'+mo+'</select><select class="form-input" style="flex:1;"><option value="">Year</option>'+yr+'</select></div></div>'
      +'<div class="form-group" id="'+endGroupId+'"><label class="form-label">End date</label><div style="display:flex;gap:8px;"><select class="form-input" style="flex:1;"><option value="">Month</option>'+mo+'</select><select class="form-input" style="flex:1;"><option value="">Year</option>'+yr+'</select></div></div>'
      +'<div class="form-group" style="grid-column:1/-1;"><label class="edu-checkbox-label"><input type="checkbox" id="'+stillId+'" onchange="toggleEndDate(this,\''+endGroupId+'\')"><span>I currently work here</span></label></div>'
      +'<div class="form-group" style="grid-column:1/-1;"><label class="form-label">Description</label><textarea class="form-textarea" style="min-height:70px;" placeholder="Responsibilities, achievements..." maxlength="500"></textarea></div>'
      +'</div>';
    // Wire Other toggle for field of work
    var chipsEl=d.querySelector('.exp-field-chips');
    var otherWrap=d.querySelector('.exp-field-other-wrap');
    chipsEl.addEventListener('click',function(e){
      var btn=e.target.closest('.pref-chip');if(!btn)return;
      chipsEl.querySelectorAll('.pref-chip').forEach(function(c){c.classList.remove('active');});
      btn.classList.add('active');
      otherWrap.style.display=btn.dataset.val==='Other'?'block':'none';
      if(btn.dataset.val!=='Other')d.querySelector('.exp-field-other').value='';
    });
    var expTA = d.querySelector('textarea'); if (expTA) attachCounterToTextarea(expTA, 500);
    c.appendChild(d);
  }
  function removeExpEntry(btn){var e=btn.closest('.edu-entry-form');if(e)e.remove();}
  async function saveExperience(){
    var r=document.getElementById('exp-read-view'),e=document.getElementById('exp-edit-view'),b=document.getElementById('exp-edit-btn');
    var entries=document.querySelectorAll('#exp-entries-container .edu-entry-form');var html=''; var structured=[];
    entries.forEach(function(entry){
      var role=entry.querySelector('.exp-role')?entry.querySelector('.exp-role').value.trim():'';
      var company=entry.querySelector('.exp-company')?entry.querySelector('.exp-company').value.trim():'';
      var location=entry.querySelector('.exp-location')?entry.querySelector('.exp-location').value.trim():'';
      var fowChip=entry.querySelector('.exp-field-chips .pref-chip.active');
      var fieldOfWork=fowChip?fowChip.dataset.val:'';
      if(fieldOfWork==='Other'){var fowOther=entry.querySelector('.exp-field-other');fieldOfWork=fowOther?fowOther.value.trim():'';}
      if(!role&&!company)return;
      var sels=entry.querySelectorAll('select');
      var startMonth=sels[0]?sels[0].value:''; var startYear=sels[1]?sels[1].value:'';
      var endMonth=sels[2]?sels[2].value:'';   var endYear=sels[3]?sels[3].value:'';
      var cb=entry.querySelector('input[type="checkbox"]'); var stillWorking=cb?cb.checked:false;
      var desc=entry.querySelector('textarea')?entry.querySelector('textarea').value:'';
      var period=(startMonth+' '+startYear).trim()+(stillWorking?' — Present':((endMonth||endYear)?' — '+(endMonth+' '+endYear).trim():''));
      structured.push({role,company,location,fieldOfWork,startMonth,startYear,endMonth,endYear,stillWorking,desc});
      html+='<div class="edu-entry-display"><div class="edu-entry-header"><strong>'+(role||'Untitled')+'</strong><span class="edu-period">'+period+'</span></div><div class="edu-entry-sub">'+(company||'')+(fieldOfWork?' · '+fieldOfWork:'')+(location?' · '+location:'')+'</div>'+(desc?'<div class="edu-entry-desc">'+desc.replace(/\n/g,'<br>')+'</div>':'')+'</div>';
    });
    if (currentStudent) currentStudent._expEntries = structured;
    try {
      var {error} = await db.from('students').update({experience: structured}).eq('id', currentStudent.id);
      if (error) throw error;
      if (currentStudent) currentStudent.experience = structured;
    } catch(err) { showToast('Failed to save experience: ' + err.message, 'error'); }
    r.innerHTML=html||'<p style="font-size:13px;color:var(--gray);">No experience added yet.</p>';
    r.style.display='block';e.style.display='none';
    b.innerHTML='Edit <span class="edu-saved-toast">&#10003; Saved</span>';setTimeout(function(){b.textContent='Edit';},2500);
    loadStudentProfile();
  }
  function cancelExperienceEdit(){document.getElementById('exp-edit-view').style.display='none';document.getElementById('exp-read-view').style.display='block';document.getElementById('exp-edit-btn').textContent='Edit';}

  // ─── ORGANISATIONS ───
  var orgsEntryCount=1;
  function toggleOrgsEdit(){
    var r=document.getElementById('orgs-read-view'),e=document.getElementById('orgs-edit-view'),b=document.getElementById('orgs-edit-btn');
    if(e.style.display!=='none'){cancelOrgsEdit();return;}
    r.style.display='none';e.style.display='block';b.textContent='Cancel';
    var saved = currentStudent && currentStudent._orgsEntries;
    if (saved && saved.length) {
      var c = document.getElementById('orgs-entries-container');
      var first = c.querySelector('.edu-entry-form');
      if (first) _populateOrgsEntry(first, saved[0]);
      var existing = c.querySelectorAll('.edu-entry-form').length;
      for (var i = existing; i < saved.length; i++) addOrgsEntry();
      var all = c.querySelectorAll('.edu-entry-form');
      for (var j = 1; j < saved.length; j++) _populateOrgsEntry(all[j], saved[j]);
    }
  }
  function _populateOrgsEntry(el, d) {
    var inputs = el.querySelectorAll('input[type="text"]');
    _setInput(inputs[0], d.org); _setInput(inputs[1], d.role);
    var sels = el.querySelectorAll('select');
    _setSelect(sels[0], d.startMonth); _setSelect(sels[1], d.startYear);
    _setSelect(sels[2], d.endMonth);   _setSelect(sels[3], d.endYear);
    var cb = el.querySelector('input[type="checkbox"]'); if (cb) cb.checked = !!d.stillMember;
    var ta = el.querySelector('textarea'); if (ta) ta.value = d.desc || '';
  }
  function addOrgsEntry(){
    var c=document.getElementById('orgs-entries-container');var idx=orgsEntryCount++;var endGroupId='orgs-end-group-'+idx;
    var months='Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');var years=['2018','2019','2020','2021','2022','2023','2024','2025'];
    var mo=months.map(function(m){return '<option>'+m+'</option>';}).join('');var yr=years.map(function(y){return '<option>'+y+'</option>';}).join('');
    var d=document.createElement('div');d.className='edu-entry-form';
    var header=document.createElement('div');header.className='edu-entry-form-header';var lbl=document.createElement('span');lbl.className='edu-entry-label';lbl.textContent='Entry '+(idx+1);var rb=document.createElement('button');rb.className='remove-edu-btn';rb.textContent='\u2715 Remove';rb.onclick=function(){d.remove();};header.appendChild(lbl);header.appendChild(rb);d.appendChild(header);
    var grid=document.createElement('div');grid.className='edu-form-grid';
    var f1=document.createElement('div');f1.className='form-group';f1.innerHTML='<label class="form-label">Organisation name </label><input class="form-input" type="text" placeholder="Full organisation name" maxlength="150">';
    var f2=document.createElement('div');f2.className='form-group';f2.innerHTML='<label class="form-label">Position / Role title </label><input class="form-input" type="text" placeholder="e.g. President, Member" maxlength="100">';
    var f3=document.createElement('div');f3.className='form-group';f3.innerHTML='<label class="form-label">Start date</label><div style="display:flex;gap:8px;"><select class="form-input" style="flex:1;">'+mo+'</select><select class="form-input" style="flex:1;">'+yr+'</select></div>';
    var f4=document.createElement('div');f4.className='form-group';f4.id=endGroupId;f4.innerHTML='<label class="form-label">End date</label><div style="display:flex;gap:8px;"><select class="form-input" style="flex:1;">'+mo+'</select><select class="form-input" style="flex:1;">'+yr+'</select></div>';
    var f5=document.createElement('div');f5.className='form-group';f5.style.gridColumn='1/-1';var cbLabel=document.createElement('label');cbLabel.className='edu-checkbox-label';var cb=document.createElement('input');cb.type='checkbox';cb.addEventListener('change',function(){toggleEndDate(cb,endGroupId);});var cbSpan=document.createElement('span');cbSpan.textContent='I am currently a member';cbLabel.appendChild(cb);cbLabel.appendChild(cbSpan);f5.appendChild(cbLabel);
    var f6=document.createElement('div');f6.className='form-group';f6.style.gridColumn='1/-1';f6.innerHTML='<label class="form-label">Description </label><textarea class="form-textarea" style="min-height:60px;" placeholder="Responsibilities and transferable skills." maxlength="500"></textarea>';
    grid.appendChild(f1);grid.appendChild(f2);grid.appendChild(f3);grid.appendChild(f4);grid.appendChild(f5);grid.appendChild(f6);d.appendChild(grid);
    var orgsTA = f6.querySelector('textarea'); if (orgsTA) attachCounterToTextarea(orgsTA, 500);
    c.appendChild(d);
  }
  function removeOrgsEntry(btn){var e=btn.closest('.edu-entry-form');if(e)e.remove();}
  async function saveOrgs(){
    var r=document.getElementById('orgs-read-view'),e=document.getElementById('orgs-edit-view'),b=document.getElementById('orgs-edit-btn');
    var entries=document.querySelectorAll('#orgs-entries-container .edu-entry-form');var html=''; var structured=[];
    entries.forEach(function(entry){
      var inputs=entry.querySelectorAll('input[type="text"]'); var org=inputs[0]?inputs[0].value:''; var role=inputs[1]?inputs[1].value:'';
      if(!org)return;
      var sels=entry.querySelectorAll('select');
      var startMonth=sels[0]?sels[0].value:''; var startYear=sels[1]?sels[1].value:'';
      var endMonth=sels[2]?sels[2].value:'';   var endYear=sels[3]?sels[3].value:'';
      var cb=entry.querySelector('input[type="checkbox"]'); var stillMember=cb?cb.checked:false;
      var desc=entry.querySelector('textarea')?entry.querySelector('textarea').value:'';
      structured.push({org,role,startMonth,startYear,endMonth,endYear,stillMember,desc});
      var period=(startMonth+' '+startYear).trim()+(stillMember?' — Present':((endMonth||endYear)?' — '+(endMonth+' '+endYear).trim():''));
      html+='<div class="edu-entry-display"><div class="edu-entry-header"><strong>'+(role||'Member')+'</strong><span class="edu-period">'+period+'</span></div><div class="edu-entry-sub">'+org+'</div>'+(desc?'<div class="edu-entry-desc">'+desc.replace(/\n/g,'<br>')+'</div>':'')+'</div>';
    });
    if (currentStudent) currentStudent._orgsEntries = structured;
    try {
      var {error} = await db.from('students').update({organisations: structured}).eq('id', currentStudent.id);
      if (error) throw error;
    } catch(err) { showToast('Failed to save organisations: ' + err.message, 'error'); }
    r.innerHTML=html||'<p style="font-size:13px;color:var(--gray);">No organisations added.</p>';r.style.display='block';e.style.display='none';
    b.innerHTML='Edit <span class="edu-saved-toast">&#10003; Saved</span>';setTimeout(function(){b.textContent='Edit';},2500);
  }
  function cancelOrgsEdit(){document.getElementById('orgs-edit-view').style.display='none';document.getElementById('orgs-read-view').style.display='block';document.getElementById('orgs-edit-btn').textContent='Edit';}

  // ─── SKILLS ───
  var skillsDB={technical:[],professional:[],languages:[]};
  var currentSkillCat='technical';
  var suggestionsByCat={technical:['Excel','Python','R','SQL','Java','JavaScript','MATLAB','Tableau','Power BI','Bloomberg','Financial Modelling','Data Analysis','Machine Learning','Statistics','Econometrics','AutoCAD','Figma','Google Analytics'],professional:['Project Management','Agile / Scrum','Leadership','Communication','Marketing','SEO','Content Writing','Social Media','Research','Problem Solving','Negotiation','HubSpot','CRM'],languages:['Dutch','English','German','French','Spanish','Italian','Mandarin','Arabic','Portuguese','Russian','Japanese']};
  var acquisitionOptions=['University course','Online certificate','Self-taught','Work experience','Professional certification','Bootcamp / Training','Exchange programme','Language certificate','Other'];
  function renderReadView(){
    ['technical','professional','languages'].forEach(function(cat){var el=document.getElementById('read-'+cat);if(!el)return;el.innerHTML=skillsDB[cat].map(function(s){return '<div class="skill-item-read"><span class="skill-tag">'+s.name+'</span><span class="skill-source">'+s.source+'</span>'+(s.proof?'<span class="skill-proof-label">&#128196; '+s.proof+'</span>':'')+'</div>';}).join('')||'<span style="font-size:13px;color:var(--gray);">None added yet.</span>';});
    var coursesList=document.getElementById('courses-list');if(coursesList){var courseEntries=coursesList.querySelectorAll('.edu-entry-form');var ch='';courseEntries.forEach(function(entry){var inputs=entry.querySelectorAll('input[type="text"]');var name=inputs[0]?inputs[0].value.trim():'';var code=inputs[1]?inputs[1].value.trim():'';if(!name)return;ch+='<div class="skill-item-read"><span class="skill-tag">'+name+'</span>'+(code?'<span class="skill-source">'+code+'</span>':'')+'</div>';});var blocks=document.querySelectorAll('#skills-read-view .skills-category-block');blocks.forEach(function(block){if(block.querySelector('.skills-cat-label')&&block.querySelector('.skills-cat-label').textContent.includes('Courses')){var g=block.querySelector('div:not(.skills-cat-label)');if(g)g.innerHTML=ch||'<span style="font-size:13px;color:var(--gray);">None added.</span>';}});}
    var projectsList=document.getElementById('projects-list');if(projectsList){var projectEntries=projectsList.querySelectorAll('.edu-entry-form');var ph='';projectEntries.forEach(function(entry){var ni=entry.querySelector('input[type="text"]');var name=ni?ni.value.trim():'';var desc=entry.querySelector('textarea')?entry.querySelector('textarea').value.trim():'';if(!name)return;ph+='<div class="skill-item-read" style="margin-bottom:8px;"><span class="skill-tag">'+name+'</span>'+(desc?'<span class="skill-source">'+desc+'</span>':'')+'</div>';});var blocks2=document.querySelectorAll('#skills-read-view .skills-category-block');blocks2.forEach(function(block){if(block.querySelector('.skills-cat-label')&&block.querySelector('.skills-cat-label').textContent.includes('Projects')){var g=block.querySelector('div:not(.skills-cat-label)');if(g)g.innerHTML=ph||'<span style="font-size:13px;color:var(--gray);">None added.</span>';}});}
  }
  try { renderReadView(); } catch(e) { console.warn("renderReadView:", e); }
  function switchSkillCat(cat){currentSkillCat=cat;['technical','professional','languages','courses','projects'].forEach(function(c){var btn=document.getElementById('stab-'+c);var panel=document.getElementById('skills-edit-'+c);if(btn)btn.classList.toggle('active',c===cat);if(panel)panel.style.display=c===cat?'block':'none';});document.getElementById('skill-search-input').value='';document.getElementById('skill-suggestions').style.display='none';var sw=document.querySelector('.skills-search-wrap');if(sw)sw.style.display=(cat==='courses'||cat==='projects')?'none':'flex';}
  function toggleSkillsEdit(){var r=document.getElementById('skills-read-view'),e=document.getElementById('skills-edit-view'),b=document.getElementById('skills-edit-btn');if(e.style.display!=='none'){cancelSkillsEdit();return;}r.style.display='none';e.style.display='block';b.textContent='Cancel';renderAllEditLists();switchSkillCat('technical');}
  function renderAllEditLists(){['technical','professional','languages'].forEach(function(cat){renderEditList(cat);});}
  function renderEditList(cat){var c=document.getElementById('skills-edit-'+cat);if(!c)return;c.innerHTML='';skillsDB[cat].forEach(function(skill,i){c.appendChild(createSkillRow(cat,skill.name,skill.source,skill.proof||'',i));});}
  function createSkillRow(cat,name,source,proof,idx){var row=document.createElement('div');row.className='skill-edit-row';var optHtml=acquisitionOptions.map(function(o){return '<option'+(o===source?' selected':'')+'>'+o+'</option>';}).join('');row.innerHTML='<div class="skill-row-top"><div class="skill-name-badge">&#127919; '+name+'</div><select class="skill-source-select" data-cat="'+cat+'" data-idx="'+idx+'" onchange="updateSkillCatSource(this)">'+optHtml+'</select><button class="skill-remove-btn" data-cat="'+cat+'" data-idx="'+idx+'" onclick="removeSkillBtn(this)" title="Remove">&#x2715;</button></div><input class="form-input skill-proof-input" type="text" data-cat="'+cat+'" data-idx="'+idx+'" placeholder="Certificate, course code, or proof (optional)..." value="'+proof.replace(/"/g,'&quot;')+'" oninput="updateSkillCatProof(this)">';return row;}
  function updateSkillCatSource(sel){var cat=sel.dataset.cat;var idx=parseInt(sel.dataset.idx);if(skillsDB[cat]&&skillsDB[cat][idx])skillsDB[cat][idx].source=sel.value;}
  function updateSkillCatProof(input){var cat=input.dataset.cat;var idx=parseInt(input.dataset.idx);if(skillsDB[cat]&&skillsDB[cat][idx])skillsDB[cat][idx].proof=input.value;}
  function removeSkillBtn(btn){var cat=btn.dataset.cat;var idx=parseInt(btn.dataset.idx);if(skillsDB[cat]){skillsDB[cat].splice(idx,1);renderEditList(cat);}}
  function filterSkillSuggestions(val){var box=document.getElementById('skill-suggestions');if(!val||val.length<1){box.style.display='none';return;}var pool=suggestionsByCat[currentSkillCat]||[];var existing=skillsDB[currentSkillCat].map(function(d){return d.name.toLowerCase();});var matches=pool.filter(function(s){return s.toLowerCase().includes(val.toLowerCase())&&!existing.includes(s.toLowerCase());}).slice(0,8);if(!matches.length){box.style.display='none';return;}box.innerHTML=matches.map(function(m){return '<div class="skill-suggestion-item" data-skill="'+m.replace(/"/g,'&quot;')+'" onclick="selectSkillSuggestion(this.dataset.skill)">'+m+'</div>';}).join('');box.style.display='block';}
  function selectSkillSuggestion(name){document.getElementById('skill-search-input').value=name;document.getElementById('skill-suggestions').style.display='none';addSkillFromSearch();}
  function addSkillFromSearch(){var input=document.getElementById('skill-search-input');var name=input.value.trim();if(!name)return;var existing=skillsDB[currentSkillCat].map(function(d){return d.name.toLowerCase();});if(existing.includes(name.toLowerCase())){input.value='';return;}var ds=currentSkillCat==='languages'?'Language certificate':'Self-taught';skillsDB[currentSkillCat].push({name:name,source:ds,proof:''});input.value='';document.getElementById('skill-suggestions').style.display='none';renderEditList(currentSkillCat);}
  async function saveSkills(){
    var r=document.getElementById('skills-read-view'),e=document.getElementById('skills-edit-view'),b=document.getElementById('skills-edit-btn');
    var totalSkillCount = skillsDB.technical.length + skillsDB.professional.length + skillsDB.languages.length;
    if (totalSkillCount < 3) { showToast('Please add at least 3 skills to complete your profile (required).', 'error'); return; }
    // Collect courses
    var courses=[];
    document.querySelectorAll('#courses-list .edu-entry-form').forEach(function(entry){
      var inputs=entry.querySelectorAll('input[type="text"]');
      var name=inputs[0]?inputs[0].value.trim():''; var code=inputs[1]?inputs[1].value.trim():'';
      if(name) courses.push({name,code});
    });
    // Collect projects
    var projects=[];
    document.querySelectorAll('#projects-list .edu-entry-form').forEach(function(entry){
      var ni=entry.querySelector('input[type="text"]'); var name=ni?ni.value.trim():'';
      var ta=entry.querySelector('textarea'); var desc=ta?ta.value.trim():'';
      if(name) projects.push({name,desc});
    });
    renderReadView();
    try {
      var {error} = await db.from('students').update({
        skills_technical: skillsDB.technical,
        skills_professional: skillsDB.professional,
        skills_languages: skillsDB.languages,
        skills_courses: courses,
        skills_projects: projects
      }).eq('id', currentStudent.id);
      if (error) throw error;
    } catch(err) { showToast('Failed to save skills: ' + err.message, 'error'); }
    r.style.display='block';e.style.display='none';
    b.innerHTML='Edit <span class="edu-saved-toast">&#10003; Saved</span>';setTimeout(function(){b.textContent='Edit';},2500);
    var _sb = document.getElementById('skills-req-badge'); if (_sb) _sb.style.display = totalSkillCount >= 3 ? 'none' : '';
    loadStudentProfile();
  }
  function cancelSkillsEdit(){document.getElementById('skills-edit-view').style.display='none';document.getElementById('skills-read-view').style.display='block';document.getElementById('skills-edit-btn').textContent='Edit';document.getElementById('skill-suggestions').style.display='none';}
  function addCourseEntry(){var list=document.getElementById('courses-list');var d=document.createElement('div');d.className='edu-entry-form';d.style.marginTop='10px';var grid=document.createElement('div');grid.className='edu-form-grid';var f1=document.createElement('div');f1.className='form-group';var l1=document.createElement('label');l1.className='form-label';l1.textContent='Course name ';var b1=document.createElement('span');b1.className='field-badge required';b1.textContent='Required';l1.appendChild(b1);var i1=document.createElement('input');i1.className='form-input';i1.type='text';i1.placeholder='e.g. Corporate Finance';i1.maxLength=150;f1.appendChild(l1);f1.appendChild(i1);var f2=document.createElement('div');f2.className='form-group';var l2=document.createElement('label');l2.className='form-label';l2.textContent='Course code ';var b2=document.createElement('span');b2.className='field-badge optional';b2.textContent='Optional';l2.appendChild(b2);var i2=document.createElement('input');i2.className='form-input';i2.type='text';i2.placeholder='e.g. FIN402';i2.maxLength=50;f2.appendChild(l2);f2.appendChild(i2);grid.appendChild(f1);grid.appendChild(f2);d.appendChild(grid);var rb=document.createElement('button');rb.className='remove-edu-btn';rb.style.marginTop='8px';rb.textContent='Remove';rb.onclick=function(){d.remove();};d.appendChild(rb);list.appendChild(d);}
  function addProjectEntry(){var list=document.getElementById('projects-list');var d=document.createElement('div');d.className='edu-entry-form';d.style.marginTop='10px';var grid=document.createElement('div');grid.className='edu-form-grid';var f1=document.createElement('div');f1.className='form-group';f1.style.gridColumn='1/-1';var l1=document.createElement('label');l1.className='form-label';l1.textContent='Project name ';var b1=document.createElement('span');b1.className='field-badge required';b1.textContent='Required';l1.appendChild(b1);var i1=document.createElement('input');i1.className='form-input';i1.type='text';i1.placeholder='Project name';i1.maxLength=150;f1.appendChild(l1);f1.appendChild(i1);var f2=document.createElement('div');f2.className='form-group';f2.style.gridColumn='1/-1';var l2=document.createElement('label');l2.className='form-label';l2.textContent='Description ';var b2=document.createElement('span');b2.className='field-badge optional';b2.textContent='Optional';l2.appendChild(b2);var t2=document.createElement('textarea');t2.className='form-textarea';t2.style.minHeight='60px';t2.placeholder='Describe the project...';t2.maxLength=500;f2.appendChild(l2);f2.appendChild(t2);var f3=document.createElement('div');f3.className='form-group';f3.style.gridColumn='1/-1';var l3=document.createElement('label');l3.className='form-label';l3.textContent='Link ';var b3=document.createElement('span');b3.className='field-badge optional';b3.textContent='Optional';l3.appendChild(b3);var i3=document.createElement('input');i3.className='form-input';i3.type='text';i3.placeholder='github.com/... or portfolio URL';i3.maxLength=300;f3.appendChild(l3);f3.appendChild(i3);grid.appendChild(f1);grid.appendChild(f2);grid.appendChild(f3);d.appendChild(grid);var rb=document.createElement('button');rb.className='remove-edu-btn';rb.style.marginTop='8px';rb.textContent='Remove';rb.onclick=function(){d.remove();};d.appendChild(rb);attachCounterToTextarea(t2, 500);list.appendChild(d);}
  document.addEventListener('click',function(e){var box=document.getElementById('skill-suggestions');var input=document.getElementById('skill-search-input');if(box&&input&&!box.contains(e.target)&&e.target!==input)box.style.display='none';});

  // ─── PREFERENCES ───
  function togglePreferencesEdit(){
    var r=document.getElementById('pref-read-view'),e=document.getElementById('pref-edit-view'),b=document.getElementById('pref-edit-btn');
    if(e.style.display!=='none'){cancelPreferencesEdit();return;}
    r.style.display='none';e.style.display='block';b.textContent='Cancel';
    var p = currentStudent && currentStudent._prefs;
    if (!p) return;
    // Normalize: DB returns strings, in-memory may be arrays — always work with arrays
    function toArr(val) {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(function(s){ return String(s).trim(); }).filter(Boolean);
      var s = String(val).trim();
      // Handle Postgres array literal: {"val1","val2"} or {val1,val2}
      if (s.charAt(0) === '{' && s.charAt(s.length-1) === '}') {
        s = s.slice(1, -1);
        return s.match(/("([^"]*)")|([^,]+)/g)
          .map(function(m){ return m.replace(/^"|"$/g,'').trim(); })
          .filter(Boolean);
      }
      // Plain comma-separated string
      return s.split(',').map(function(x){ return x.trim(); }).filter(Boolean);
    }
    function restoreChips(id, vals) {
      var arr = toArr(vals);
      document.querySelectorAll('#'+id+' .pref-chip').forEach(function(c){ c.classList.toggle('active', arr.indexOf(c.dataset.val) !== -1); });
    }
    restoreChips('pref-type', p.type);
    restoreChips('pref-emp-type', p.empType);
    restoreChips('pref-dutch-only', p.dutchOnly ? ['Yes'] : ['No']);
    // Restore hours per week
    var hoursWrap = document.getElementById('pref-hours-wrap');
    var hoursInput = document.getElementById('pref-hours-per-week');
    var isPartTime = (p.empType || '').includes('Part-time');
    if (hoursWrap) hoursWrap.style.display = isPartTime ? 'block' : 'none';
    if (hoursInput) hoursInput.value = p.hoursPerWeek || '';
    restoreChips('pref-duration', p.duration);
    // Restore sectors — handle custom values as tags
    var knownSectors = Array.from(document.querySelectorAll('#pref-sectors .pref-chip')).map(function(c){ return c.dataset.val; });
    var sectorArr = toArr(p.sectors);
    var customSectors = sectorArr.filter(function(s){ return !knownSectors.includes(s); });
    var standardSectors = sectorArr.filter(function(s){ return knownSectors.includes(s); });
    document.querySelectorAll('#pref-sectors .pref-chip').forEach(function(c){
      c.classList.toggle('active', standardSectors.indexOf(c.dataset.val) !== -1);
      if (c.dataset.val === 'Other') c.classList.toggle('active', customSectors.length > 0);
    });
    var otherWrap = document.getElementById('pref-sectors-other-wrap');
    var customTagsEl = document.getElementById('pref-sectors-custom-tags');
    if (customSectors.length > 0) {
      if (otherWrap) otherWrap.style.display = 'block';
      if (customTagsEl) {
        customTagsEl.innerHTML = customSectors.map(function(s){
          return '<span class="role-tag">'+s+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button></span>';
        }).join('');
      }
    } else {
      if (otherWrap) otherWrap.style.display = 'none';
      if (customTagsEl) customTagsEl.innerHTML = '';
    }
    // Restore locations — handle custom values as tags
    var knownLocations = Array.from(document.querySelectorAll('#pref-location .pref-chip')).map(function(c){ return c.dataset.val; });
    var locationArr = toArr(p.locations);
    var customLocations = locationArr.filter(function(s){ return !knownLocations.includes(s); });
    var standardLocations = locationArr.filter(function(s){ return knownLocations.includes(s); });
    document.querySelectorAll('#pref-location .pref-chip').forEach(function(c){
      c.classList.toggle('active', standardLocations.indexOf(c.dataset.val) !== -1 || (customLocations.length > 0 && c.dataset.val === 'Other'));
    });
    var locWrap = document.getElementById('pref-location-other-wrap');
    var locTagsEl = document.getElementById('pref-location-custom-tags');
    if (customLocations.length > 0) {
      if (locWrap) locWrap.style.display = 'block';
      if (locTagsEl) locTagsEl.innerHTML = customLocations.map(function(s){
        return '<span class="role-tag">'+s+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button></span>';
      }).join('');
    } else {
      if (locWrap) locWrap.style.display = 'none';
      if (locTagsEl) locTagsEl.innerHTML = '';
    }
    _setSelect(document.getElementById('pref-start-month'), p.month);
    _setSelect(document.getElementById('pref-start-year'), String(p.year || ''));
    // Restore role tags
    var tagsEl = document.getElementById('pref-roles-tags');
    if (tagsEl && p.roles && p.roles.length) {
      tagsEl.innerHTML = p.roles.map(function(r){ return '<span class="role-tag">'+r+' <button class="role-remove-btn" onclick="removeRoleTag(this)">&#xd7;</button></span>'; }).join('');
    }
    _setupRequiredBadgeWatchers(e);
  }
  document.addEventListener('click',function(e){var chip=e.target.closest('.pref-chip');if(!chip)return;var group=chip.closest('.pref-chips');if(!group)return;if(group.classList.contains('multi')){chip.classList.toggle('active');}else{group.querySelectorAll('.pref-chip').forEach(function(c){c.classList.remove('active');});chip.classList.add('active');}
    // Clear inline error on chip group once a selection exists
    if(group.classList.contains('error')&&group.querySelector('.pref-chip.active'))_clearFieldError(group);
    // Show/hide hours per week for part-time
    if(group.id==='pref-emp-type'||group.id==='post-emp-type'||group.id==='edit-emp-type'){
      var prefix=group.id==='pref-emp-type'?'pref':group.id==='post-emp-type'?'post':'edit';
      var hw=document.getElementById(prefix+'-hours-wrap');
      if(hw)hw.style.display=chip.dataset.val==='Part-time'?'block':'none';
      if(chip.dataset.val!=='Part-time'){var hi=document.getElementById(prefix+'-hours-per-week');if(hi)hi.value='';}
    }
    if(group.id==='pref-sectors'){var otherWrap=document.getElementById('pref-sectors-other-wrap');if(otherWrap){var otherActive=!!group.querySelector('.pref-chip[data-val="Other"].active');otherWrap.style.display=otherActive?'block':'none';if(!otherActive){var oi=document.getElementById('pref-sectors-other');if(oi)oi.value='';var ct=document.getElementById('pref-sectors-custom-tags');if(ct)ct.innerHTML='';}}}
    // Show/hide location Other input
    if(group.id==='pref-location'){var otherActive=!!group.querySelector('.pref-chip[data-val="Other"].active');var wrap=document.getElementById('pref-location-other-wrap');if(wrap)wrap.style.display=otherActive?'block':'none';if(!otherActive){var oi=document.getElementById('pref-location-other');if(oi)oi.value='';var ct=document.getElementById('pref-location-custom-tags');if(ct)ct.innerHTML='';}}
    if(group.id==='post-location-chips'){var otherActive=!!group.querySelector('.pref-chip[data-val="Other"].active');var wrap=document.getElementById('post-location-other-wrap');if(wrap)wrap.style.display=otherActive?'block':'none';if(!otherActive){var oi=document.getElementById('post-location-other');if(oi)oi.value='';var ct=document.getElementById('post-location-custom-tags');if(ct)ct.innerHTML='';}}
    if(group.id==='edit-location-chips'){var otherActive=!!group.querySelector('.pref-chip[data-val="Other"].active');var wrap=document.getElementById('edit-location-other-wrap');if(wrap)wrap.style.display=otherActive?'block':'none';if(!otherActive){var oi=document.getElementById('edit-location-other');if(oi)oi.value='';var ct=document.getElementById('edit-location-custom-tags');if(ct)ct.innerHTML='';}}

    // Show/hide ATS URL field based on app method
    if(group.id==='post-app-method'){var w=document.getElementById('post-ats-wrap');if(w)w.style.display=chip.dataset.val==='External (ATS URL)'?'block':'none';}
    if(group.id==='edit-app-method'){var w=document.getElementById('edit-ats-wrap');if(w)w.style.display=chip.dataset.val==='External (ATS URL)'?'block':'none';}
    // Show/hide field Other input
    if(group.id==='post-field-chips'){var w=document.getElementById('post-field-other-wrap');if(w){w.style.display=chip.dataset.val==='Other'?'block':'none';if(chip.dataset.val!=='Other'){var i=document.getElementById('post-field-other');if(i)i.value='';var ct=document.getElementById('post-field-custom-tags');if(ct)ct.innerHTML='';}}}
    if(group.id==='edit-field-chips'){var w=document.getElementById('edit-field-other-wrap');if(w){w.style.display=chip.dataset.val==='Other'?'block':'none';if(chip.dataset.val!=='Other'){var i=document.getElementById('edit-field-other');if(i)i.value='';var ct=document.getElementById('edit-field-custom-tags');if(ct)ct.innerHTML='';}}};
    // Show/hide majors Other input
    if(group.id==='post-majors'){var chip2=group.querySelector('.pref-chip[data-val="Other"]');var w=document.getElementById('post-majors-other-wrap');if(w&&chip2)w.style.display=chip2.classList.contains('active')?'block':'none';if(chip2&&!chip2.classList.contains('active')){var ct=document.getElementById('post-majors-custom-tags');if(ct)ct.innerHTML='';}}
    if(group.id==='edit-majors'){var chip2=group.querySelector('.pref-chip[data-val="Other"]');var w=document.getElementById('edit-majors-other-wrap');if(w&&chip2)w.style.display=chip2.classList.contains('active')?'block':'none';if(chip2&&!chip2.classList.contains('active')){var ct=document.getElementById('edit-majors-custom-tags');if(ct)ct.innerHTML='';}}
  });
  async function savePreferences(){
    var r=document.getElementById('pref-read-view'),e=document.getElementById('pref-edit-view'),b=document.getElementById('pref-edit-btn');
    var getActive=function(id){return Array.from(document.querySelectorAll('#'+id+' .pref-chip.active')).map(function(c){return c.dataset.val;});};
    var prefTypeChips = document.getElementById('pref-type');
    var prefSectorsChips = document.getElementById('pref-sectors');
    var prefLocChips = document.getElementById('pref-location');
    var ok = true;
    if (!getActive('pref-type').length) { _showFieldError(prefTypeChips, 'Please select what you are looking for.'); ok = false; } else _clearFieldError(prefTypeChips);
    if (!getActive('pref-sectors').length) { _showFieldError(prefSectorsChips, 'Please select at least one sector.'); ok = false; } else _clearFieldError(prefSectorsChips);
    if (!getActive('pref-location').length) { _showFieldError(prefLocChips, 'Please select at least one preferred location.'); ok = false; } else _clearFieldError(prefLocChips);
    if (!ok) { _scrollToFirstError(document.getElementById('pref-edit-view')); return; }
    var month=document.getElementById('pref-start-month').value;
    var year=document.getElementById('pref-start-year').value;
    var roles=Array.from(document.querySelectorAll('#pref-roles-tags .role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim();});
    var prefs = {
      type:      getActive('pref-type').join(', '),
      empType:   getActive('pref-emp-type').join(', '),
      hoursPerWeek: (document.getElementById('pref-hours-per-week')||{}).value||'',
      duration:  getActive('pref-duration').join(', '),
      sectors:   (function(){
        var vals = getActive('pref-sectors').filter(function(v){ return v !== 'Other'; });
        var customTags = Array.from(document.querySelectorAll('#pref-sectors-custom-tags .role-tag'))
          .map(function(t){ return t.textContent.replace('\xd7','').trim(); }).filter(Boolean);
        return vals.concat(customTags).join(', ');
      })(),
      locations: (function(){
        var vals = getActive('pref-location').filter(function(v){ return v !== 'Other'; });
        var customTags = Array.from(document.querySelectorAll('#pref-location-custom-tags .role-tag'))
          .map(function(t){ return t.textContent.replace('\xd7','').trim(); }).filter(Boolean);
        return vals.concat(customTags).join(', ');
      })(),
      month: month, year: year, roles: roles,
      dutchOnly: getActive('pref-dutch-only').indexOf('Yes') !== -1
    };
    // Store structured data for re-editing — always as strings
    if (currentStudent) {
      currentStudent._prefs = prefs;
      currentStudent.pref_type      = prefs.type;
      currentStudent.pref_emp_type  = prefs.empType;
      currentStudent.hours_per_week = prefs.hoursPerWeek;
      currentStudent.pref_duration  = prefs.duration;
      currentStudent.pref_sectors   = prefs.sectors;
      currentStudent.pref_locations = prefs.locations;
      currentStudent.avail_month    = prefs.month;
      currentStudent.avail_year     = prefs.year ? parseInt(prefs.year) : null;
      currentStudent.role_interests = prefs.roles;
      currentStudent.pref_dutch_only = prefs.dutchOnly;
    }
    try {
      var {error} = await db.from('students').update({
        pref_type:      prefs.type,
        pref_emp_type:  prefs.empType,
        hours_per_week: prefs.hoursPerWeek || null,
        pref_duration:  prefs.duration,
        pref_sectors:   prefs.sectors,
        pref_locations: prefs.locations,
        avail_month: prefs.month || null,
        avail_year: prefs.year ? parseInt(prefs.year) : null,
        role_interests: prefs.roles,
        pref_dutch_only: prefs.dutchOnly
      }).eq('id', currentStudent.id);
      if (error) throw error;
    } catch(err) { showToast('Failed to save preferences: ' + err.message, 'error'); }
    // Update read view — all values are now plain strings
    var setRead = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val || 'Not set'; };
    setRead('pref-read-type',     prefs.type);
    setRead('pref-read-emp-type', prefs.empType);
    document.getElementById('pref-read-start').textContent = (month + ' ' + year).trim() || 'Not set';
    setRead('pref-read-duration', prefs.duration);
    setRead('pref-read-sectors',  prefs.sectors);
    setRead('pref-read-location', prefs.locations);
    var rolesEl = document.getElementById('pref-read-roles'); if (rolesEl) rolesEl.textContent = roles.join(', ') || 'Not set';
    var dutchEl = document.getElementById('pref-read-dutch-only'); if (dutchEl) dutchEl.textContent = prefs.dutchOnly ? 'Yes' : 'No';
    r.style.display='block'; e.style.display='none';
    b.innerHTML='Edit <span class="edu-saved-toast">&#10003; Saved</span>'; setTimeout(function(){b.textContent='Edit';},2500);
    loadStudentProfile();
  }
  function cancelPreferencesEdit(){document.getElementById('pref-edit-view').style.display='none';document.getElementById('pref-read-view').style.display='block';document.getElementById('pref-edit-btn').textContent='Edit';}

  // ─── ROLE INTERESTS ───
  var allRoleSuggestions=['Financial Analyst','Data Analyst','Business Analyst','Strategy Consultant','Marketing Analyst','HR Business Partner','Account Manager','Project Manager','Software Engineer','Data Scientist','Product Manager','UX Designer','Risk Analyst','Audit Associate','Tax Consultant','Operations Manager','Investment Analyst','Portfolio Manager','Compliance Officer','Research Analyst','Communications Specialist','Sales Development Representative','Financial Controller','Econometrician','Policy Analyst'];
  function filterRoleSuggestions(val){var box=document.getElementById('role-suggestions');if(!val||val.length<1){box.style.display='none';return;}var existing=Array.from(document.querySelectorAll('#pref-roles-tags .role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim().toLowerCase();});var matches=allRoleSuggestions.filter(function(r){return r.toLowerCase().includes(val.toLowerCase())&&!existing.includes(r.toLowerCase());}).slice(0,8);if(!matches.length){box.style.display='none';return;}box.innerHTML=matches.map(function(m){return '<div class="skill-suggestion-item" data-role="'+m.replace(/"/g,'&quot;')+'" onclick="selectRoleSuggestion(this.dataset.role)">'+m+'</div>';}).join('');box.style.display='block';}
  function selectRoleSuggestion(name){document.getElementById('role-search-input').value=name;document.getElementById('role-suggestions').style.display='none';addRoleTag();}
  function addRoleTag(){var input=document.getElementById('role-search-input');var name=input.value.trim();if(!name)return;var container=document.getElementById('pref-roles-tags');var existing=Array.from(container.querySelectorAll('.role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim().toLowerCase();});if(existing.includes(name.toLowerCase())){input.value='';return;}if(existing.length>=5)return;var tag=document.createElement('span');tag.className='role-tag';tag.innerHTML=name+' <button class="role-remove-btn" onclick="removeRoleTag(this)">&#xd7;</button>';container.appendChild(tag);input.value='';document.getElementById('role-suggestions').style.display='none';}
  function removeRoleTag(btn){btn.closest('.role-tag').remove();}
  // ─── JOB SEARCHED SKILLS ───
  var jobSkillSuggestions={technical:['Excel','Python','R','SQL','Java','JavaScript','MATLAB','Tableau','Power BI','Bloomberg','Financial Modelling','Data Analysis','Machine Learning','Statistics','Econometrics','AutoCAD','Figma','Google Analytics','SAP','Salesforce'],professional:['Project Management','Agile / Scrum','Leadership','Communication','Marketing','SEO','Content Writing','Social Media','Research','Problem Solving','Negotiation','HubSpot','CRM','Presentation','Stakeholder Management'],languages:['Dutch','English','German','French','Spanish','Italian','Mandarin','Arabic','Portuguese','Russian','Japanese']};
  var catInputMap={technical:'tech',professional:'prof',languages:'lang'};
  function filterJobSkillSuggestions(prefix,cat,val){
    var shortCat=catInputMap[cat];
    var box=document.getElementById(prefix+'-skill-'+shortCat+'-suggestions'); if(!box)return;
    if(!val||val.length<1){box.style.display='none';return;}
    var pool=jobSkillSuggestions[cat]||[];
    var tagsEl=document.getElementById(prefix+'-skill-'+shortCat+'-tags');
    var existing=tagsEl?Array.from(tagsEl.querySelectorAll('.role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim().toLowerCase();}):[]; 
    var matches=pool.filter(function(s){return s.toLowerCase().includes(val.toLowerCase())&&!existing.includes(s.toLowerCase());}).slice(0,6);
    if(!matches.length){box.style.display='none';return;}
    box.innerHTML=matches.map(function(m){return '<div class="skill-suggestion-item" onclick="selectJobSkillSuggestion(\''+prefix+'\',\''+cat+'\',\''+m.replace(/'/g,"\\'")+'\')" style="cursor:pointer;padding:8px 12px;font-size:13px;">'+m+'</div>';}).join('');
    box.style.display='block';
  }
  function selectJobSkillSuggestion(prefix,cat,name){
    var shortCat=catInputMap[cat];
    var input=document.getElementById(prefix+'-skill-'+shortCat+'-input');
    if(input)input.value=name;
    var box=document.getElementById(prefix+'-skill-'+shortCat+'-suggestions');
    if(box)box.style.display='none';
    addJobSkill(prefix,cat);
  }
  function addJobSkill(prefix,cat){
    var shortCat=catInputMap[cat];
    var input=document.getElementById(prefix+'-skill-'+shortCat+'-input');
    var name=input?input.value.trim():''; if(!name)return;
    var tagsEl=document.getElementById(prefix+'-skill-'+shortCat+'-tags'); if(!tagsEl)return;
    var existing=Array.from(tagsEl.querySelectorAll('.role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim().toLowerCase();});
    if(existing.includes(name.toLowerCase())){if(input)input.value='';return;}
    var tag=document.createElement('span');tag.className='role-tag';
    tag.innerHTML=name+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button>';
    tagsEl.appendChild(tag);if(input)input.value='';
    var box=document.getElementById(prefix+'-skill-'+shortCat+'-suggestions');if(box)box.style.display='none';
  }
  function getJobSkills(prefix){
    var result={};
    ['technical','professional','languages'].forEach(function(cat){
      var shortCat=catInputMap[cat];
      var tagsEl=document.getElementById(prefix+'-skill-'+shortCat+'-tags');
      result[cat]=tagsEl?Array.from(tagsEl.querySelectorAll('.role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim();}).filter(Boolean):[];
    });
    return result;
  }
  function setJobSkills(prefix,skills){
    var catInputMap={technical:'tech',professional:'prof',languages:'lang'};
    ['technical','professional','languages'].forEach(function(cat){
      var shortCat=catInputMap[cat];
      var tagsEl=document.getElementById(prefix+'-skill-'+shortCat+'-tags'); if(!tagsEl)return;
      var arr=(skills&&skills[cat])||[];
      tagsEl.innerHTML=arr.map(function(s){return '<span class="role-tag">'+s+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button></span>';}).join('');
    });
  }
  function setRoleToggle(role) {
    var pill = document.getElementById('toggle-pill');
    var btnStudent = document.getElementById('toggle-student');
    var btnCompany = document.getElementById('toggle-company');
    var contentStudent = document.getElementById('toggle-content-student');
    var contentCompany = document.getElementById('toggle-content-company');
    if (role === 'student') {
      pill.style.transform = 'translateX(0)';
      btnStudent.style.color = 'white';
      btnCompany.style.color = 'var(--text-light)';
      contentStudent.style.display = 'block';
      contentCompany.style.display = 'none';
    } else {
      pill.style.transform = 'translateX(100%)';
      btnStudent.style.color = 'var(--text-light)';
      btnCompany.style.color = 'white';
      contentStudent.style.display = 'none';
      contentCompany.style.display = 'block';
    }
  }
  async function submitContactForm() {
    var name    = (document.getElementById('contact-name').value || '').trim();
    var email   = (document.getElementById('contact-email').value || '').trim();
    var message = (document.getElementById('contact-message').value || '').trim();
    var errEl   = document.getElementById('contact-error');
    var sucEl   = document.getElementById('contact-success');
    var btn     = document.getElementById('contact-submit-btn');
    errEl.style.display = 'none'; sucEl.style.display = 'none';
    if (!name)    { errEl.textContent = 'Please enter your name.'; errEl.style.display = 'block'; return; }
    if (!email)   { errEl.textContent = 'Please enter your email.'; errEl.style.display = 'block'; return; }
    if (!message) { errEl.textContent = 'Please enter a message.'; errEl.style.display = 'block'; return; }
    btn.textContent = 'Sending…'; btn.disabled = true;
    try {
      // Ensure db is initialized
      if (!db && window.supabase) db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      if (!db) throw new Error('Connection not ready');
      var res = await db.from('contact_messages').insert({ name: name, email: email, message: message });
      if (res.error) throw res.error;
      sucEl.style.display = 'block';
      document.getElementById('contact-name').value = '';
      document.getElementById('contact-email').value = '';
      document.getElementById('contact-message').value = '';
      btn.textContent = 'Sent ✓';
      btn.disabled = false;
    } catch(err) {
      errEl.textContent = 'Something went wrong: ' + (err.message || 'please try again.');
      errEl.style.display = 'block';
      btn.textContent = 'Send message →'; btn.disabled = false;
    }
  }
  function addCustomMajor(prefix){
    var input=document.getElementById(prefix+'-majors-other');
    var name=input.value.trim();if(!name)return;
    var container=document.getElementById(prefix+'-majors-custom-tags');
    var existing=Array.from(container.querySelectorAll('.role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim().toLowerCase();});
    if(existing.includes(name.toLowerCase())){input.value='';return;}
    var tag=document.createElement('span');tag.className='role-tag';
    tag.innerHTML=name+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button>';
    container.appendChild(tag);input.value='';
  }
  function getMajorsValue(prefix){
    var standard=Array.from(document.querySelectorAll('#'+prefix+'-majors .pref-chip.active')).map(function(c){return c.dataset.val;}).filter(function(v){return v!=='Other';});
    var custom=Array.from(document.querySelectorAll('#'+prefix+'-majors-custom-tags .role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim();}).filter(Boolean);
    return standard.concat(custom).join(', ');
  }
  function addCustomField(prefix){
    var input=document.getElementById(prefix+'-field-other');
    var name=input.value.trim();if(!name)return;
    var container=document.getElementById(prefix+'-field-custom-tags');
    var existing=Array.from(container.querySelectorAll('.role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim().toLowerCase();});
    if(existing.includes(name.toLowerCase())){input.value='';return;}
    var tag=document.createElement('span');tag.className='role-tag';
    tag.innerHTML=name+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button>';
    container.appendChild(tag);input.value='';
  }
  function getFieldValue(prefix){
    var knownChips=Array.from(document.querySelectorAll('#'+prefix+'-field-chips .pref-chip.active')).map(function(c){return c.dataset.val;}).filter(function(v){return v!=='Other';});
    var customTags=Array.from(document.querySelectorAll('#'+prefix+'-field-custom-tags .role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim();}).filter(Boolean);
    return knownChips.concat(customTags).join(', ');
  }
  function _renderStatusYearChips(status, activeYear) {
    var wrap = document.getElementById('current-status-year-wrap');
    var container = document.getElementById('current-status-year-chips');
    if (!wrap || !container) return;
    var years = [];
    if (status === 'Bachelor') years = ['Year 1','Year 2','Year 3','Year 4','Year 5','Graduate'];
    else if (status === 'Master') years = ['Year 1','Year 2','Year 3','Graduate'];
    if (years.length === 0) { wrap.style.display = 'none'; container.innerHTML = ''; return; }
    wrap.style.display = 'block';
    container.innerHTML = years.map(function(y){
      return '<button class="pref-chip'+(y===activeYear?' active':'')+'" data-val="'+y+'">'+y+'</button>';
    }).join('');
    container.addEventListener('click', function(e){
      var btn = e.target.closest('.pref-chip'); if (!btn) return;
      container.querySelectorAll('.pref-chip').forEach(function(c){ c.classList.remove('active'); });
      btn.classList.add('active');
    });
  }
  function _restoreCurrentStatus(cs, csYear) {
    document.querySelectorAll('#current-status-chips .pref-chip').forEach(function(c){
      c.classList.toggle('active', c.dataset.val === cs);
    });
    _renderStatusYearChips(cs, csYear);
  }
  function addCustomJobLocation(prefix){
    var input=document.getElementById(prefix+'-location-other');
    var name=input.value.trim();if(!name)return;
    var container=document.getElementById(prefix+'-location-custom-tags');
    var existing=Array.from(container.querySelectorAll('.role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim().toLowerCase();});
    if(existing.includes(name.toLowerCase())){input.value='';return;}
    var tag=document.createElement('span');tag.className='role-tag';
    tag.innerHTML=name+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button>';
    container.appendChild(tag);input.value='';
  }
  function getJobLocation(prefix){
    var standard=Array.from(document.querySelectorAll('#'+prefix+'-location-chips .pref-chip.active')).map(function(c){return c.dataset.val;}).filter(function(v){return v!=='Other';});
    var custom=Array.from(document.querySelectorAll('#'+prefix+'-location-custom-tags .role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim();}).filter(Boolean);
    return standard.concat(custom).join(', ');
  }
  function addCustomLocation(){
    var input=document.getElementById('pref-location-other');
    var name=input.value.trim();if(!name)return;
    var container=document.getElementById('pref-location-custom-tags');
    var existing=Array.from(container.querySelectorAll('.role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim().toLowerCase();});
    if(existing.includes(name.toLowerCase())){input.value='';return;}
    var tag=document.createElement('span');tag.className='role-tag';
    tag.innerHTML=name+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button>';
    container.appendChild(tag);input.value='';
  }
  function addCustomSector(){
    var input=document.getElementById('pref-sectors-other');
    var name=input.value.trim();if(!name)return;
    var container=document.getElementById('pref-sectors-custom-tags');
    var existing=Array.from(container.querySelectorAll('.role-tag')).map(function(t){return t.textContent.replace('\xd7','').trim().toLowerCase();});
    if(existing.includes(name.toLowerCase())){input.value='';return;}
    var tag=document.createElement('span');tag.className='role-tag';
    tag.innerHTML=name+' <button class="role-remove-btn" onclick="this.closest(\'.role-tag\').remove()">&#xd7;</button>';
    container.appendChild(tag);input.value='';
  }
  document.addEventListener('click',function(e){var box=document.getElementById('role-suggestions');var input=document.getElementById('role-search-input');if(box&&input&&!box.contains(e.target)&&e.target!==input)box.style.display='none';});

  // Hides a Required badge when its field is filled; shows it again when emptied.
  function _setupRequiredBadgeWatchers(container) {
    container.querySelectorAll('.field-badge.required').forEach(function(badge) {
      var group = badge.closest('.form-group') || badge.closest('.pref-group') || (badge.closest('label') && badge.closest('label').parentElement);
      if (!group) return;
      var input = group.querySelector('input[type="text"], input[type="email"], textarea');
      var chips = group.querySelector('.pref-chips');
      function check() {
        var filled = input ? input.value.trim().length > 0 : (chips ? !!chips.querySelector('.pref-chip.active') : false);
        badge.style.display = filled ? 'none' : '';
      }
      if (input) input.addEventListener('input', check);
      if (chips) chips.addEventListener('click', function() { setTimeout(check, 0); });
      check();
    });
  }

  // ─── BASIC INFO ───
  async function toggleBasicEdit() {
    var r = document.getElementById('basic-read-view');
    var e = document.getElementById('basic-edit-view');
    var b = document.getElementById('basic-edit-btn');
    if (e.style.display !== 'none') { cancelBasicEdit(); return; }
    // Populate from currentStudent
    var s = currentStudent || {};
    document.getElementById('edit-basic-name').value      = s.name        || '';
    document.getElementById('edit-basic-bio').value       = s.bio         || '';
    document.getElementById('edit-basic-linkedin').value  = s.linkedin    || '';
    document.getElementById('edit-basic-portfolio').value = s.portfolio   || '';
    document.getElementById('edit-basic-location').value  = s.location    || '';
    document.getElementById('edit-basic-alt-email').value = s.alt_email   || '';
    var workAuthVals = (s.work_auth || '').split(',').map(function(v){ return v.trim(); });
    document.querySelectorAll('#edit-basic-work-auth .pref-chip').forEach(function(btn){
      btn.classList.toggle('active', workAuthVals.indexOf(btn.dataset.val) !== -1);
    });
    var seekingStatus = s.seeking_status || '';
    document.querySelectorAll('#seeking-chips .pref-chip').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.val === seekingStatus);
    });
    // Current status
    var cs = s.current_status || '';
    var csYear = s.current_status_year || '';
    _restoreCurrentStatus(cs, csYear);
    // Wire current status chip clicks
    document.getElementById('current-status-chips').addEventListener('click', function(e){
      var btn = e.target.closest('.pref-chip'); if (!btn) return;
      document.querySelectorAll('#current-status-chips .pref-chip').forEach(function(c){ c.classList.remove('active'); });
      btn.classList.add('active');
      _renderStatusYearChips(btn.dataset.val, '');
    });
    // Field of study
    var fos = s.field_of_study || '';
    var knownFields = Array.from(document.querySelectorAll('#field-of-study-chips .pref-chip')).map(function(c){ return c.dataset.val; });
    var isOther = fos && !knownFields.includes(fos);
    document.querySelectorAll('#field-of-study-chips .pref-chip').forEach(function(btn) {
      btn.classList.toggle('active', isOther ? btn.dataset.val === 'Other' : btn.dataset.val === fos);
    });
    document.getElementById('field-of-study-other-wrap').style.display = isOther ? 'block' : 'none';
    document.getElementById('field-of-study-other').value = isOther ? fos : '';
    // Wire Other chip toggle — show/hide the custom text input
    document.getElementById('field-of-study-chips').addEventListener('click', function(e) {
      var btn = e.target.closest('.pref-chip'); if (!btn) return;
      var isOtherBtn = btn.dataset.val === 'Other';
      document.getElementById('field-of-study-other-wrap').style.display = isOtherBtn ? 'block' : 'none';
      if (!isOtherBtn) document.getElementById('field-of-study-other').value = '';
    });
    // Email from auth (read-only)
    try {
      var authRes = await db.auth.getUser();
      document.getElementById('edit-basic-email').value = authRes.data?.user?.email || '';
    } catch(err) {}
    r.style.display = 'none';
    e.style.display = 'block';
    b.textContent = 'Cancel';
    refreshCharCounters();
    _setupRequiredBadgeWatchers(e);
  }

  async function saveBasicInfo() {
    var nameEl = document.getElementById('edit-basic-name');
    var name = nameEl.value.trim();
    var fosChips = document.getElementById('field-of-study-chips');
    var fosChip = fosChips.querySelector('.pref-chip.active');
    var fosVal = fosChip ? fosChip.dataset.val : '';
    if (fosVal === 'Other') fosVal = document.getElementById('field-of-study-other').value.trim();
    var csChips = document.getElementById('current-status-chips');
    var workAuthChips = document.getElementById('edit-basic-work-auth');
    var ok = true;
    if (!name) { _showFieldError(nameEl, 'Name is required.'); ok = false; } else _clearFieldError(nameEl);
    if (!fosVal) { _showFieldError(fosChips, 'Please select your field of study.'); ok = false; } else _clearFieldError(fosChips);
    if (!csChips.querySelector('.pref-chip.active')) { _showFieldError(csChips, 'Please select your current status.'); ok = false; } else _clearFieldError(csChips);
    if (!workAuthChips.querySelectorAll('.pref-chip.active').length) { _showFieldError(workAuthChips, 'Please select your work authorisation.'); ok = false; } else _clearFieldError(workAuthChips);
    if (!ok) { _scrollToFirstError(document.getElementById('basic-edit-view')); return; }
    var csChip = csChips.querySelector('.pref-chip.active');
    var csVal = csChip ? csChip.dataset.val : '';
    var csYearChip = document.querySelector('#current-status-year-chips .pref-chip.active');
    var csYearVal = csYearChip ? csYearChip.dataset.val : '';
    var updates = {
      name:             name,
      bio:              document.getElementById('edit-basic-bio').value.trim(),
      work_auth:        Array.from(document.querySelectorAll('#edit-basic-work-auth .pref-chip.active')).map(function(c){return c.dataset.val;}).join(', '),
      linkedin:         document.getElementById('edit-basic-linkedin').value.trim(),
      portfolio:        document.getElementById('edit-basic-portfolio').value.trim(),
      location:         document.getElementById('edit-basic-location').value.trim(),
      alt_email:        document.getElementById('edit-basic-alt-email').value.trim(),
      seeking_status:   (document.querySelector('#seeking-chips .pref-chip.active') || {}).dataset?.val || '',
      field_of_study:   fosVal,
      current_status:   csVal,
      current_status_year: csYearVal,
    };
    try {
      var { error } = await db.from('students').update(updates).eq('id', currentStudent.id);
      if (error) throw error;
      Object.assign(currentStudent, updates);
      loadStudentProfile();
      cancelBasicEdit();
      var b = document.getElementById('basic-edit-btn');
      b.innerHTML = 'Edit <span class="edu-saved-toast">&#10003; Saved</span>';
      setTimeout(function() { b.textContent = 'Edit'; }, 2500);
    } catch(err) {
      showToast('Failed to save: ' + err.message, 'error');
    }
  }

  function cancelBasicEdit(){document.getElementById('basic-edit-view').style.display='none';document.getElementById('basic-read-view').style.display='block';document.getElementById('basic-edit-btn').textContent='Edit';}

  // ─── DOCUMENTS ───
  function toggleDocsEdit(){
    var r=document.getElementById('docs-read-view'),e=document.getElementById('docs-edit-view'),b=document.getElementById('docs-edit-btn');
    if(e.style.display!=='none'){cancelDocsEdit();return;}
    r.style.display='none';e.style.display='block';b.textContent='Cancel';
    // Pre-populate visibility chip from saved data
    var savedVis = currentStudent && currentStudent.visibility;
    document.querySelectorAll('#visibility-chips .pref-chip').forEach(function(c){
      c.classList.toggle('active', c.dataset.val === savedVis);
    });
    // Make visibility chips single-select
    document.querySelectorAll('#visibility-chips .pref-chip').forEach(function(c){
      c.onclick = function(){
        document.querySelectorAll('#visibility-chips .pref-chip').forEach(function(x){x.classList.remove('active');});
        c.classList.add('active');
      };
    });
  }
  async function saveDocs(){
    var r=document.getElementById('docs-read-view'),e=document.getElementById('docs-edit-view'),b=document.getElementById('docs-edit-btn');
    var visChip=document.querySelector('#visibility-chips .pref-chip.active');
    var visibility=visChip?visChip.dataset.val:'';
    try {
      var {error} = await db.from('students').update({visibility: visibility}).eq('id', currentStudent.id);
      if (error) throw error;
      if (currentStudent) currentStudent.visibility = visibility;
      // Update read view text
      var visReadEl = document.querySelector('#docs-read-view .info-row:last-child .info-value');
      if (visReadEl && visibility) visReadEl.textContent = visibility + (visibility==='Community'?' (visible to peers + employers)':visibility==='Employers only'?' (hidden from other students)':' (only you can see)');
    } catch(err) { showToast('Failed to save: ' + err.message, 'error'); }
    r.style.display='block';e.style.display='none';
    b.innerHTML='Edit <span class="edu-saved-toast">&#10003; Saved</span>';setTimeout(function(){b.textContent='Edit';},2500);
  }
  function cancelDocsEdit(){document.getElementById('docs-edit-view').style.display='none';document.getElementById('docs-read-view').style.display='block';document.getElementById('docs-edit-btn').textContent='Edit';}


  // ─── BROWSE STUDENTS ───

  function openBrowseRole(title, field, location, type, skills, job) {
    // Stash the active role-job so the role grid can score every student against it
    window._currentRoleJob = job || null;
    document.getElementById('browse-students-landing').style.display = 'none';
    document.getElementById('browse-role-view').style.display = 'block';
    document.getElementById('browse-spontaneous-view').style.display = 'none';
    document.getElementById('browse-role-title-text').textContent = title;
    document.getElementById('browse-role-meta-text').textContent = type + ' · ' + field + ' · ' + location;
    // Render skill chips
    var chipsEl = document.getElementById('browse-role-skill-chips');
    if (chipsEl) {
      chipsEl.innerHTML = skills.length ? '<span style="font-size:12px;color:var(--gray);align-self:center;">Matching on:</span> ' +
        skills.map(function(s) {
          return '<span style="padding:4px 10px;background:var(--cream-dark);border-radius:100px;font-size:12px;color:var(--navy);font-weight:500;">' + s + '</span>';
        }).join('') : '';
    }
    // Load all students from DB into the grid (will score against _currentRoleJob)
    loadStudentsFromDB();
  }

  function closeBrowseRole() {
    window._currentRoleJob = null;
    document.getElementById('browse-role-view').style.display = 'none';
    document.getElementById('browse-students-landing').style.display = 'block';
  }

  function openBrowseSpontaneous() {
    document.getElementById('browse-students-landing').style.display = 'none';
    document.getElementById('browse-role-view').style.display = 'none';
    document.getElementById('browse-spontaneous-view').style.display = 'block';
  }

  function closeBrowseSpontaneous() {
    document.getElementById('browse-spontaneous-view').style.display = 'none';
    document.getElementById('browse-students-landing').style.display = 'block';
  }


  // ─── JOB DETAIL MODAL ───


 // ─── LOAD STUDENT APPLICATIONS FROM DB ───
  // Cache of full job records keyed by job_id, for opening the detail modal on click.
  window.__myAppJobs = window.__myAppJobs || {};
  window.viewApplicationListing = function(jobId) {
    var j = window.__myAppJobs[jobId];
    if (j) openJobDetailFromDB(j, true); // hideApply=true (already applied)
  };
  async function loadApplicationsFromDB() {
    var list = document.getElementById('applications-list');
    if (!list) { console.error('applications-list not found'); return; }
    if (!currentStudent) { console.warn('loadApplicationsFromDB: no currentStudent'); return; }

    list.innerHTML = '<p style="font-size:14px;color:var(--text-light);padding:24px 0;">Loading...</p>';

    try {
      var res = await db.from('applications')
        .select('*')
        .eq('student_id', currentStudent.id)
        .order('created_at', { ascending: false });

      if (res.error) throw res.error;
      var apps = res.data || [];

      // Fetch matching jobs
      var jobIds = apps.map(a => a.job_id).filter(Boolean);
      var jobMap = {};
      if (jobIds.length) {
        var jobRes = await db.from('jobs').select('*').in('id', jobIds);
        if (!jobRes.error && jobRes.data) {
          jobRes.data.forEach(j => { jobMap[j.id] = j; });
        }
      }
      // Expose the map for click-to-open from card onclick.
      window.__myAppJobs = jobMap;

      var activeApps = apps.filter(function(a){ return a.status !== 'Rejected'; });
      var pastApps   = apps.filter(function(a){ return a.status === 'Rejected'; });

      document.querySelectorAll('.tab-btn').forEach(function(btn) {
        if (btn.textContent.trim().startsWith('My applications')) {
          btn.textContent = 'My applications (' + apps.length + ')';
        }
      });

      if (!apps.length) {
        list.innerHTML = '<p style="font-size:14px;color:var(--text-light);padding:24px 0;">No applications yet. Browse listings and hit Apply!</p>';
        return;
      }

      function renderAppCard(app, isPast) {
        var j = (app.job_id && jobMap[app.job_id]) || {};
        var title    = app.job_title       || j.title        || '';
        var company  = app.company_name    || j.company_name  || '';
        var jobType  = app.job_type        || j.job_type      || '';
        var field    = app.field           || j.field         || '';
        var duration = app.duration        || j.duration      || '';
        var empType  = app.employment_type || j.employment_type || '';
        var location = app.location        || j.location      || '';
        var pay      = app.pay             || j.pay           || '';
        var workAuth = app.work_auth       || j.work_auth     || '';
        var dlMonth  = app.deadline_month  || j.deadline_month || '';
        var dlYear   = app.deadline_year   || j.deadline_year  || '';
        var description = j.description || '';
        var quals    = j.qualifications || '';
        var startMonth = app.start_month || j.start_month || '';
        var startYear  = app.start_year  || j.start_year  || '';
        var division   = j.division || '';
        var roleGroup  = j.role_group || '';
        var numHires   = j.num_hires || '';
        var docs       = j.required_docs || '';
        var schoolYr   = j.school_year || '';
        var majors     = j.majors || '';
        var gradFrom   = j.grad_from || '';
        var gradTo     = j.grad_to || '';
        var gpaMin     = j.gpa_min || '';
        var dutchOnly  = j.dutch_only ? 'Yes' : '';
        // Searched skills — stored as jsonb {technical:[],professional:[],languages:[]}
        var skillsObj  = j.searched_skills || {};
        function skillList(arr){ return Array.isArray(arr) ? arr.filter(Boolean).join(', ') : ''; }
        var skillsTech = skillList(skillsObj.technical);
        var skillsProf = skillList(skillsObj.professional);
        var skillsLang = skillList(skillsObj.languages);

        var statusClass = app.status === 'Shortlisted' ? 'status-shortlist'
                        : app.status === 'Accepted'    ? 'status-shortlist'
                        : app.status === 'Rejected'    ? 'status-rejected'
                        : 'status-new';

        var initial = (company || '?').charAt(0).toUpperCase();
        var applied = app.created_at ? new Date(app.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '';
        var tagItems = [jobType, field, duration, empType].filter(Boolean);
        var tagsHTML = tagItems.map(t => '<span style="padding:3px 10px;background:var(--cream-dark);border-radius:100px;font-size:11px;color:var(--text-light);">' + esc(t) + '</span>').join('');

        var detailsHTML = '';
        function addDetail(label, val) {
          if (!val) return;
          detailsHTML += '<div class="application-detail-item"><span class="application-detail-label">' + esc(label) + '</span><span class="application-detail-value">' + esc(val) + '</span></div>';
        }
        addDetail('Applied',       applied);
        addDetail('Start date',    app.earliest_start || ((startMonth || startYear) ? [startMonth, startYear].filter(Boolean).join(' ') : ''));
        addDetail('Deadline',      [dlMonth, dlYear].filter(Boolean).join(' '));
        addDetail('Location',      location);
        addDetail('Job type',      jobType);
        addDetail('Employment',    empType);
        addDetail('Sector',        field);
        addDetail('Duration',      duration);
        addDetail('Pay',           pay);
        addDetail('Work authorisation', workAuth);
        addDetail('Role group',    roleGroup);
        addDetail('Division',      division);
        addDetail('Hires planned', numHires ? String(numHires) : '');
        addDetail('Required docs', docs);
        addDetail('GPA minimum',   gpaMin);
        addDetail('Dutch only',    dutchOnly);

        var bodyExtra = '';
        function addBlock(title, body, italic) {
          if (!body) return;
          bodyExtra += '<div style="border-top:1px solid var(--border);margin-top:16px;padding-top:16px;">'
            + '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--gray);margin-bottom:8px;">' + esc(title) + '</div>'
            + '<p style="font-size:13px;color:var(--text);line-height:1.6;margin:0;' + (italic ? 'font-style:italic;' : '') + '">'
            + (italic ? '&ldquo;' : '') + esc(body) + (italic ? '&rdquo;' : '') + '</p></div>';
        }
        addBlock('Role description', description);
        addBlock('Qualifications',   quals);

        // Searched skills block
        var skillsHTML = '';
        function skillRow(label, list) {
          if (!list) return '';
          return '<div style="margin-bottom:8px;"><span style="font-size:11px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:0.6px;">' + esc(label) + ':</span> <span style="font-size:13px;color:var(--text);">' + esc(list) + '</span></div>';
        }
        skillsHTML += skillRow('Technical', skillsTech);
        skillsHTML += skillRow('Professional', skillsProf);
        skillsHTML += skillRow('Languages', skillsLang);
        if (skillsHTML) {
          bodyExtra += '<div style="border-top:1px solid var(--border);margin-top:16px;padding-top:16px;">'
            + '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--gray);margin-bottom:10px;">Skills they searched for</div>'
            + skillsHTML + '</div>';
        }

        // Target-candidate block (school year, majors, grad year range)
        var targetBits = [];
        if (schoolYr) targetBits.push('<div style="margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:0.6px;">Level:</span> <span style="font-size:13px;color:var(--text);">' + esc(schoolYr) + '</span></div>');
        if (majors)   targetBits.push('<div style="margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:0.6px;">Field of study:</span> <span style="font-size:13px;color:var(--text);">' + esc(majors) + '</span></div>');
        if (gradFrom || gradTo) targetBits.push('<div style="margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:0.6px;">Graduation year:</span> <span style="font-size:13px;color:var(--text);">' + esc([gradFrom, gradTo].filter(Boolean).join(' – ')) + '</span></div>');
        if (targetBits.length) {
          bodyExtra += '<div style="border-top:1px solid var(--border);margin-top:16px;padding-top:16px;">'
            + '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--gray);margin-bottom:10px;">Who they\'re looking for</div>'
            + targetBits.join('') + '</div>';
        }

        addBlock('My motivation note', app.motivation, true);

        var cardStyle = isPast ? 'opacity:0.6;' : '';
        return '<div class="application-card application-card-collapsed" style="' + cardStyle + '" onclick="this.classList.toggle(\'application-card-collapsed\')">'
          + '<div class="application-card-header">'
          + '<div style="display:flex;gap:16px;align-items:flex-start;">'
          + '<div style="width:48px;height:48px;border-radius:12px;background:' + (isPast ? 'var(--gray)' : 'var(--navy)') + ';display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:700;flex-shrink:0;">' + esc(initial) + '</div>'
          + '<div style="flex:1;min-width:0;">'
          + '<div style="font-size:16px;font-weight:600;color:var(--navy);margin-bottom:2px;">' + esc(title) + '</div>'
          + '<div style="font-size:13px;color:var(--text-light);">' + esc(company) + (location ? ' &middot; ' + esc(location) : '') + (applied ? ' &middot; Applied ' + esc(applied) : '') + '</div>'
          + (tagsHTML ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">' + tagsHTML + '</div>' : '')
          + '</div></div>'
          + '<span class="status-badge ' + esc(statusClass) + '" style="align-self:flex-start;white-space:nowrap;">' + esc(app.status || 'New') + '</span>'
          + '</div>'
          + '<div class="application-card-body"><div class="application-detail-grid">' + detailsHTML + '</div>' + bodyExtra + '</div>'
          + '</div>';
      }

      var html = '';

      if (activeApps.length) {
        html += activeApps.map(function(app){ return renderAppCard(app, false); }).join('');
      }

      if (pastApps.length) {
        html += '<div style="margin-top:32px;margin-bottom:16px;display:flex;align-items:center;gap:12px;">'
          + '<div style="flex:1;height:1px;background:var(--border);"></div>'
          + '<span style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--gray);">Not selected (' + pastApps.length + ')</span>'
          + '<div style="flex:1;height:1px;background:var(--border);"></div>'
          + '</div>';
        html += pastApps.map(function(app){ return renderAppCard(app, true); }).join('');
      }

      list.innerHTML = html;

    } catch(err) {
      console.error('loadApplicationsFromDB error:', err);
      list.innerHTML = '<p style="font-size:14px;color:#c0392b;padding:24px 0;">Error loading applications: ' + err.message + '</p>';
    }
  }
