// ═══════════════════════════════════════════
// DATA — mock TiU-relevant content
// ═══════════════════════════════════════════

const STUDENTS = [
  { id:'lena',   name:'Lena Visser',     degree:'BSc Communication & Multimedia Design', uni:'Fontys', level:'Bachelor', loc:'Tilburg', color:'#c0392b', initial:'L',
    skills:['Figma','Adobe XD','HTML/CSS','Canva','Google Analytics','Excel'], languages:['Dutch (Native)','English (C1)','German (A2)'],
    sectors:'Marketing, Technology', prefLoc:'Tilburg, Eindhoven, Hybrid', prefType:'Internship (stage)' },
  { id:'bram',   name:'Bram van Rooij',  degree:'HBO-ICT Software Engineering', uni:'Avans', level:'Bachelor', loc:'Breda', color:'#4a148c', initial:'B',
    skills:['Java','Python','JavaScript','SQL','Docker','Git','REST APIs'], languages:['Dutch (Native)','English (B2)'],
    sectors:'Technology, Data & Analytics', prefLoc:'Breda, Tilburg, Eindhoven, Hybrid', prefType:'Internship (stage)' },
  { id:'daan',   name:'Daan Smeets',     degree:'MSc Econometrics & Mathematical Economics', uni:'TiU', level:'Master', loc:'Tilburg', color:'#1565c0', initial:'D',
    skills:['Python','R','MATLAB','SQL','LaTeX','Stata','Git'], languages:['Dutch (Native)','English (C2)','French (B1)'],
    sectors:'Finance & Banking, Data & Analytics, Consulting', prefLoc:'Tilburg, Amsterdam, Rotterdam', prefType:'Internship (stage)' },
  { id:'anouk',  name:'Anouk Jansen',    degree:'BSc Marketing', uni:'TiU', level:'Bachelor', loc:'Tilburg', color:'#e8622a', initial:'A',
    skills:['Excel','Google Analytics','Canva','HubSpot','Meta Ads Manager'], languages:['Dutch (Native)','English (C1)','Spanish (B1)'],
    sectors:'Marketing, Data & Analytics', prefLoc:'Tilburg, Eindhoven, Hybrid', prefType:'Internship (stage)' },
  { id:'sven',   name:'Sven Bakker',     degree:'MSc Computer Science', uni:'TU/e', level:'Master', loc:'Eindhoven', color:'#1565c0', initial:'S',
    skills:['Python','TypeScript','AWS','Git','JavaScript','Docker','Kubernetes'], languages:['Dutch (Native)','English (C1)'],
    sectors:'Technology, Data & Analytics', prefLoc:'Eindhoven, Amsterdam, Hybrid', prefType:'Graduate role' },
  { id:'iris',   name:'Iris Smit',       degree:'Pre-master Data Science', uni:'TiU', level:'Pre-master', loc:'Tilburg', color:'#2e7d52', initial:'I',
    skills:['Python','SQL','R','Power BI','Excel','Tableau'], languages:['Dutch (Native)','English (C1)'],
    sectors:'Data & Analytics, Technology, Consulting', prefLoc:'Tilburg, Amsterdam, Eindhoven, Hybrid', prefType:'Internship (stage)' },
  { id:'nour',   name:'Nour El-Amin',    degree:'BSc HRM & Organisation Studies', uni:'TiU', level:'Bachelor', loc:'Tilburg', color:'#2e7d52', initial:'N',
    skills:['Excel','SPSS','Workday (basic)','MS Office'], languages:['Arabic (Native)','Dutch (B2)','English (C1)','French (B1)'],
    sectors:'HR & People, Consulting', prefLoc:'Tilburg, Den Bosch, Hybrid', prefType:'Internship (stage)' },
  { id:'pieter', name:'Pieter de Wit',   degree:'BSc Finance', uni:'TiU', level:'Bachelor', loc:'Tilburg', color:'#1a3260', initial:'P',
    skills:['Excel','SAP basics','Power BI','Bloomberg','Financial modelling'], languages:['Dutch (Native)','English (B2)'],
    sectors:'Finance & Banking, Accounting & Audit, Consulting', prefLoc:'Tilburg, Den Bosch, Eindhoven', prefType:'Internship (stage)' },
];

const JOBS = [
  { id:'mkt-analyst', title:'Junior Marketing Analyst',           company:'Interpolis (Tilburg)',     type:'Internship (stage)', sector:'Marketing',          location:'Tilburg',  duration:'3-6 months',  level:'Bachelor', majors:'Marketing, Business Administration, Communication',
    techWanted:['Excel','Google Analytics'], langWanted:['Dutch','English'], profWanted:['Communication','Analytical thinking'] },
  { id:'sw-eng',     title:'Software Engineer — Graduate Track', company:'Smartwares (Eindhoven)',   type:'Graduate role',     sector:'Technology',         location:'Eindhoven',duration:'12+ months',  level:'Master',   majors:'Computer Science, Software Engineering, Information Systems',
    techWanted:['Python','TypeScript','AWS','Git'], langWanted:['English'], profWanted:['Problem solving','Agile mindset'] },
  { id:'data-int',   title:'Data & Reporting Analyst Intern',     company:'Jumbo (Amsterdam)',         type:'Internship (stage)', sector:'Data & Analytics',  location:'Amsterdam',duration:'6-12 months', level:'Pre-master', majors:'Data Science, Business Analytics, Econometrics, Information Systems',
    techWanted:['SQL','Python','Power BI'], langWanted:['Dutch','English'], profWanted:['Analytical thinking','Problem solving'] },
  { id:'strategy',   title:'Strategy & Consulting Associate',     company:'BDO Netherlands (Amsterdam)', type:'Graduate role',  sector:'Consulting',         location:'Amsterdam',duration:'12+ months',  level:'Master',   majors:'Economics, Business Administration, Econometrics, Finance',
    techWanted:['Excel','PowerPoint','Financial modelling'], langWanted:['English','Dutch'], profWanted:['Structured thinking','Stakeholder management','Presentation skills'] },
  { id:'fin-ops',    title:'Finance & Operations Intern',         company:'CZ (Tilburg)',              type:'Internship (stage)', sector:'Finance & Banking', location:'Tilburg',  duration:'3-6 months',  level:'Bachelor', majors:'Finance, Accounting, Economics',
    techWanted:['Excel','SAP basics'], langWanted:['Dutch'], profWanted:['Attention to detail','Time management'] },
  { id:'hr-recruit', title:'HR Support & Recruitment Intern',     company:'BDO Netherlands (Den Bosch)', type:'Working student', sector:'HR & People',       location:'Den Bosch',duration:'Flexible',    level:'Bachelor', majors:'Human Resource Management, Psychology, Business Administration',
    techWanted:['Microsoft Office'], langWanted:['Dutch','English'], profWanted:['Communication','Organisational skills'] },
  { id:'sustain',    title:'Sustainability Consultant Intern',    company:'Gemeente Tilburg (Rotterdam)', type:'Internship (stage)', sector:'Sustainability',  location:'Rotterdam',duration:'3-6 months',  level:'Pre-master', majors:'International Business, Economics, Political Science',
    techWanted:['Excel','PowerPoint'], langWanted:['English','Dutch'], profWanted:['Research','Report writing'] },
];

// ═══════════════════════════════════════════
// MATCH ANALYZER — reuses the same formula
// ═══════════════════════════════════════════

function clean(s) { return String(s||'').replace(/\([^)]*\)/g,'').toLowerCase().trim(); }
function coverage(have, want) {
  if (!want || !want.length) return null;
  const h = have.map(clean);
  let hit = 0;
  want.forEach(w => {
    const wc = clean(w);
    if (h.includes(wc) || h.some(x => x && (x.indexOf(wc) !== -1 || wc.indexOf(x) !== -1))) hit++;
  });
  return Math.min(1, hit / want.length);
}

function computeMatch(student, job) {
  let earned = 0, possible = 0;
  const cats = [];

  // 1. Job type
  const sTypes = String(student.prefType||'').split(',').map(s=>s.trim());
  if (job.type) {
    possible += 3; const ok = sTypes.includes(job.type);
    earned += ok ? 3 : 0;
    cats.push({ name:'Job type', score: ok?100:0, weight:3, detail: ok ? `Both prefer ${job.type}.` : `Student prefers ${sTypes.join(', ')}; job is ${job.type}.` });
  }
  // 2. Location
  const sLocs = String(student.prefLoc||'').split(',').map(s=>s.trim());
  const jLocs = String(job.location||'').split(',').map(s=>s.trim());
  if (jLocs.length) {
    possible += 2; const ok = sLocs.includes('Open to anywhere') || sLocs.some(l => jLocs.includes(l));
    earned += ok ? 2 : 0;
    cats.push({ name:'Location', score: ok?100:0, weight:2, detail: ok ? `${job.location} is in their preference list.` : `Student wants ${sLocs.slice(0,3).join(', ')}; job is in ${job.location}.` });
  }
  // 3. Sector
  const sSec = String(student.sectors||'').split(',').map(s=>s.trim());
  const jSec = String(job.sector||'').split(',').map(s=>s.trim()).filter(Boolean);
  if (jSec.length) {
    possible += 2; const ok = sSec.some(s => jSec.includes(s));
    earned += ok ? 2 : 0;
    cats.push({ name:'Sector', score: ok?100:0, weight:2, detail: ok ? `${job.sector} aligns with their interests.` : `Student is into ${sSec.join(', ')}; this role is in ${job.sector}.` });
  }
  // 4. School year
  if (job.level) {
    possible += 2; const ok = student.level === job.level;
    earned += ok ? 2 : 0;
    cats.push({ name:'School year', score: ok?100:0, weight:2, detail: ok ? `${student.level} matches the role's target.` : `Student is ${student.level}; role targets ${job.level}.` });
  }
  // 5. Duration  (light heuristic — exact match or 'Flexible')
  if (job.duration) {
    possible += 1; const ok = job.duration === 'Flexible' || job.duration.includes('months') || job.duration.includes('+');
    earned += ok ? 1 : 0;
    cats.push({ name:'Duration', score: ok?100:50, weight:1, detail: `Job is ${job.duration}.` });
  }
  // 6. Field of study (rough heuristic from degree)
  if (job.majors) {
    possible += 1;
    const deg = student.degree.toLowerCase();
    const ok = job.majors.toLowerCase().split(',').some(m => deg.includes(m.trim().toLowerCase()) || m.trim().toLowerCase().split(' ').some(w => w.length>3 && deg.includes(w)));
    earned += ok ? 1 : 0;
    cats.push({ name:'Field of study', score: ok?100:0, weight:1, detail: ok ? `${student.degree} fits the role's accepted majors.` : `Role asks for ${job.majors.split(',').slice(0,2).join(', ')}…; student is in ${student.degree}.` });
  }
  // 7. Technical
  const cTech = coverage(student.skills, job.techWanted);
  if (cTech !== null) {
    possible += 4; earned += cTech*4;
    const have = student.skills.filter(s => job.techWanted.some(w => clean(s).includes(clean(w)) || clean(w).includes(clean(s))));
    const missing = job.techWanted.filter(w => !student.skills.some(s => clean(s).includes(clean(w)) || clean(w).includes(clean(s))));
    cats.push({ name:'Technical skills', score: Math.round(cTech*100), weight:4,
      detail: missing.length ? `Has ${have.join(', ')||'none of the wanted skills'}. Missing: ${missing.join(', ')}.` : `Has all wanted skills: ${have.join(', ')}.`,
      have, missing
    });
  }
  // 8. Languages
  const cLang = coverage(student.languages, job.langWanted);
  if (cLang !== null) {
    possible += 2; earned += cLang*2;
    const missing = job.langWanted.filter(w => !student.languages.some(s => clean(s).includes(clean(w))));
    cats.push({ name:'Languages', score: Math.round(cLang*100), weight:2,
      detail: missing.length ? `Wanted: ${job.langWanted.join(', ')}. Missing: ${missing.join(', ')}.` : `Covers all wanted languages.`,
      missing
    });
  }
  // 9. Professional skills
  const cProf = coverage(student.skills.concat([]), job.profWanted);
  if (cProf !== null) {
    possible += 1; earned += cProf*1;
    cats.push({ name:'Professional skills', score: Math.round(cProf*100), weight:1,
      detail: cProf<0.5 ? `Wanted: ${job.profWanted.join(', ')}. Worth probing in conversation whether these come through in their experience.` : `Likely covered through experience and coursework.`
    });
  }
  // 10. Role interest
  possible += 2;
  const titleWords = job.title.toLowerCase().split(/[^a-z]+/).filter(w => w.length>3);
  const sectorMatch = sSec.some(s => jSec.includes(s));
  const roleScore = sectorMatch ? 100 : 50;
  earned += roleScore/100*2;
  cats.push({ name:'Role interest', score: roleScore, weight:2,
    detail: sectorMatch ? `Their stated sector interests align with ${job.title}.` : `Adjacent fit — sector is in their broader interest set.`
  });

  const pct = possible>0 ? Math.round(earned/possible*100) : 0;
  return { pct, earned, possible, cats };
}

// Coaching prompts: triggered for cats where score < 70
function buildCoachingPrompts(student, job, result) {
  const prompts = [];
  result.cats.forEach(c => {
    if (c.score >= 70) return;
    if (c.name === 'Technical skills' && c.missing && c.missing.length) {
      prompts.push({
        cat: 'TECHNICAL',
        text: `<strong>${student.name}</strong> is missing ${c.missing.length === 1 ? c.missing[0] : c.missing.slice(0,2).join(' and ')} for ${job.title}. Worth exploring whether they're already learning ${c.missing[0]} or open to a short course before applying — even a Coursera or Datacamp certificate is often enough at this level.`
      });
    } else if (c.name === 'Languages' && c.missing && c.missing.length) {
      prompts.push({
        cat: 'LANGUAGE',
        text: `Job lists <strong>${c.missing.join(' and ')}</strong> as expected. ${student.name} doesn't list it on their profile — confirm whether they speak it informally or whether this is a real blocker.`
      });
    } else if (c.name === 'Location') {
      prompts.push({
        cat: 'LOCATION',
        text: `${student.name}'s preferred locations don't include <strong>${job.location}</strong>. Ask whether the location is a hard constraint or whether they'd consider a daily commute or hybrid arrangement.`
      });
    } else if (c.name === 'School year') {
      prompts.push({
        cat: 'TIMING',
        text: `Role targets <strong>${job.level}</strong>; ${student.name} is ${student.level}. ${student.level === 'Bachelor' && job.level === 'Master' ? 'Probably too early — consider revisiting in their final year.' : 'Worth exploring whether they qualify on equivalent experience or whether to defer this conversation.'}`
      });
    } else if (c.name === 'Job type') {
      prompts.push({
        cat: 'TYPE',
        text: `Their stated preference is <strong>${student.prefType}</strong>; this role is <strong>${job.type}</strong>. Ask whether their preference is firm or whether they'd consider this format if the role itself excites them.`
      });
    } else if (c.name === 'Sector') {
      prompts.push({
        cat: 'SECTOR',
        text: `${student.name}'s stated sectors don't include <strong>${job.sector}</strong>. Probe whether this role is actually adjacent to what they want, or whether they'd be applying out of opportunism.`
      });
    } else if (c.name === 'Professional skills') {
      prompts.push({
        cat: 'PROFESSIONAL',
        text: `Posting lists professional skills like <em>${job.profWanted.slice(0,2).join(', ')}</em>. These are rarely on a CV directly — coach ${student.name.split(' ')[0]} on which experiences (group projects, leadership roles, internships) demonstrate them.`
      });
    } else if (c.name === 'Field of study') {
      prompts.push({
        cat: 'BACKGROUND',
        text: `Their degree (${student.degree}) isn't an obvious match to the role's accepted majors (${job.majors.split(',').slice(0,2).join(', ')}…). Worth framing how their background still translates — coursework, projects, electives.`
      });
    } else if (c.name === 'Role interest') {
      prompts.push({
        cat: 'INTEREST',
        text: `Sector overlap is partial. Worth asking: is ${job.title} a role they actually want, or are they spreading nets too wide?`
      });
    }
  });

  // If no weak categories, give a positive coaching note
  if (prompts.length === 0) {
    prompts.push({
      cat: 'STRONG FIT',
      text: `Across all 10 dimensions, ${student.name} is at or above 70%. The conversation should focus on <strong>narrative</strong> — how they tell the story in their cover letter and interview, not on filling gaps. Consider mock-interview prep.`
    });
  }
  return prompts;
}

function colorForPct(pct) {
  if (pct >= 70) return 'var(--success)';
  if (pct >= 40) return 'var(--warning)';
  return 'var(--danger)';
}
function classForPct(pct) {
  if (pct >= 70) return 'strong';
  if (pct >= 40) return 'mid';
  return 'weak';
}

function runMatch() {
  const sId = document.getElementById('ma-student').value;
  const jId = document.getElementById('ma-job').value;
  const s = STUDENTS.find(x => x.id === sId);
  const j = JOBS.find(x => x.id === jId);
  if (!s || !j) return;

  const result = computeMatch(s, j);

  // Score
  document.getElementById('ma-target').textContent = `${s.name}  →  ${j.title}`;
  document.getElementById('ma-score').innerHTML = result.pct + '<span class="pct">%</span>';
  const strongCount = result.cats.filter(c => c.score >= 70).length;
  document.getElementById('ma-verdict-label').textContent = `${strongCount} of ${result.cats.length} categories above 70%`;

  let verdict = '';
  if (result.pct >= 80) verdict = `Very strong fit. Encourage ${s.name.split(' ')[0]} to apply with confidence — focus the session on application narrative.`;
  else if (result.pct >= 60) verdict = `Solid match with specific gaps. The session should address the items in the coaching prompts below.`;
  else if (result.pct >= 40) verdict = `Mid-level fit. Worth a candid conversation about whether this is the right role or whether stretch goals make sense.`;
  else verdict = `Weak alignment. Likely not the right role today — discuss whether to reposition or what would need to change to make it viable.`;
  document.getElementById('ma-verdict').textContent = verdict;

  // Breakdown
  const bd = document.getElementById('ma-breakdown');
  bd.innerHTML = result.cats.map(c => {
    const color = colorForPct(c.score);
    const cls = classForPct(c.score);
    return `
      <div class="breakdown-row">
        <div class="breakdown-cat">${c.name}<div style="font-size:11px;color:var(--gray);font-weight:400;margin-top:2px;">weight ${c.weight}</div></div>
        <div class="breakdown-bar"><div class="breakdown-bar-fill" style="width:${c.score}%; background:${color};"></div></div>
        <div class="breakdown-pct ${cls}">${c.score}%</div>
      </div>`;
  }).join('');

  // Coaching prompts
  const prompts = buildCoachingPrompts(s, j, result);
  document.getElementById('ma-prompts').innerHTML = prompts.map(p => `
    <div class="coaching-prompt">
      <div class="coaching-cat">${p.cat}</div>
      <div class="coaching-text">${p.text}</div>
    </div>`).join('');
}

// Initialize Match Analyzer
function initMatchAnalyzer() {
  const ssel = document.getElementById('ma-student');
  STUDENTS.forEach(s => {
    const o = document.createElement('option');
    o.value = s.id; o.textContent = `${s.name} — ${s.degree.length>40 ? s.degree.substring(0,40)+'…' : s.degree}`;
    ssel.appendChild(o);
  });
  const jsel = document.getElementById('ma-job');
  JOBS.forEach(j => {
    const o = document.createElement('option');
    o.value = j.id; o.textContent = `${j.title} — ${j.company}`;
    jsel.appendChild(o);
  });
  // Default to a high-match pair (Anouk → Marketing Analyst)
  ssel.value = 'anouk';
  jsel.value = 'mkt-analyst';
  runMatch();
}

// ═══════════════════════════════════════════
// MARKET PULSE
// ═══════════════════════════════════════════

const TRENDING_SKILLS = [
  { name:'Python',              count:47, delta:12 },
  { name:'SQL',                 count:41, delta:8 },
  { name:'Excel',               count:38, delta:3 },
  { name:'Power BI',            count:32, delta:15 },
  { name:'Financial modelling', count:28, delta:5 },
  { name:'Dutch (B2+)',         count:26, delta:-2 },
  { name:'R',                   count:24, delta:9 },
  { name:'Tableau',             count:22, delta:4 },
  { name:'Stata',               count:19, delta:1 },
  { name:'PowerPoint',          count:18, delta:-3 },
];

const HOT_ROLES = [
  { name:'Junior Data Analyst',          meta:'12 new postings · ↑ 38% WoW',  tag:'EMERGING', tagClass:'' },
  { name:'Marketing Intern',             meta:'8 new · ↑ 14% WoW',            tag:'STEADY',  tagClass:'steady' },
  { name:'Software Engineer (graduate)', meta:'7 new · ↑ 22% WoW',            tag:'TRENDING', tagClass:'' },
  { name:'Sustainability Consultant',    meta:'5 new · ↑ 67% WoW',            tag:'EMERGING', tagClass:'' },
  { name:'Strategy & Consulting',        meta:'4 new · steady',               tag:'STEADY',   tagClass:'steady' },
  { name:'Compliance / Legal Intern',    meta:'3 new · new entrant',          tag:'WARMING',  tagClass:'warm' },
];

function initMarketPulse() {
  // Trending skills board
  const max = TRENDING_SKILLS[0].count;
  const html = TRENDING_SKILLS.map((s, i) => {
    const pct = (s.count / max) * 100;
    const hot = s.delta >= 8 ? 'hot' : '';
    const deltaClass = s.delta > 0 ? 'delta-up' : s.delta < 0 ? 'delta-down' : 'delta-neutral';
    const deltaStr = s.delta > 0 ? `↑ ${s.delta}` : s.delta < 0 ? `↓ ${Math.abs(s.delta)}` : '—';
    return `
      <div class="skill-row">
        <div class="skill-rank">${String(i+1).padStart(2,'0')}</div>
        <div class="skill-name">${s.name}</div>
        <div class="skill-bar"><div class="skill-bar-fill ${hot}" style="width:${pct}%"></div></div>
        <div class="skill-count">${s.count}</div>
        <div class="skill-delta ${deltaClass}">${deltaStr}</div>
      </div>`;
  }).join('');
  document.getElementById('skills-leaderboard').innerHTML = html;

  // Hot roles
  document.getElementById('hot-roles').innerHTML = HOT_ROLES.map(r => `
    <div class="hot-role">
      <div class="hot-role-tag ${r.tagClass}">${r.tag}</div>
      <div class="hot-role-name">${r.name}</div>
      <div class="hot-role-meta">${r.meta}</div>
    </div>`).join('');

  // Sector donut
  const ctx = document.getElementById('sector-donut').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Technology','Finance & Banking','Data & Analytics','Marketing','Consulting','Sustainability','HR & People','Other'],
      datasets: [{
        data: [28, 18, 14, 11, 10, 7, 6, 6],
        backgroundColor: ['#0f1f3d','#1a3260','#e8622a','#f0875a','#2e7d52','#d97706','#6a1b9a','#8a8f9e'],
        borderColor: '#fff',
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: { font: { family:"'DM Sans',sans-serif", size:11 }, color:'#555b6e', boxWidth:10, padding:8 }
        },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}%` } }
      }
    }
  });
}

// ═══════════════════════════════════════════
// ENGAGEMENT — At-risk + funnel
// ═══════════════════════════════════════════

const AT_RISK = [
  { name:'Maaike de Boer',  initial:'M', color:'#c0392b', issue:'Final-year MSc · No applications · Last login 35 days ago',                action:'Send 1-on-1 invite' },
  { name:'Jasper de Vries', initial:'J', color:'#1565c0', issue:'Final-year BSc · Profile only 30% complete · No CV uploaded',              action:'Profile completion prompt' },
  { name:'Nadia van Beek',  initial:'N', color:'#2e7d52', issue:'MSc · 6 months to grad · No employer messages received',                   action:'Visibility / discoverability check' },
  { name:'Lukas Maas',      initial:'L', color:'#6a1b9a', issue:'Pre-master · No skills listed on profile',                                 action:'Skills inventory session' },
  { name:'Sara Dekker',     initial:'S', color:'#e8622a', issue:'Final-year · 2 applications submitted · 0 responses',                     action:'CV review + tailoring session' },
  { name:'Tom Bakker',      initial:'T', color:'#5d4037', issue:'MSc · Logged in once in past 60 days',                                     action:'Re-engagement email' },
  { name:'Eva Visser',      initial:'E', color:'#0288d1', issue:'Final-year BSc · No location preferences set · Likely missing matches',   action:'Career-direction session' },
  { name:'Daan Hendriks',   initial:'D', color:'#7a3e00', issue:'MSc · Profile complete but no applications in 4 weeks',                   action:'Application coaching' },
];

function initEngagement() {
  // At-risk table
  document.getElementById('at-risk-tbody').innerHTML = AT_RISK.map(s => `
    <tr>
      <td>
        <div class="at-risk-name">
          <div class="at-risk-avatar" style="background:${s.color}">${s.initial}</div>
          <span>${s.name}</span>
        </div>
      </td>
      <td><div class="at-risk-issue">${s.issue}</div></td>
      <td><div class="at-risk-action">${s.action}</div></td>
      <td><button class="at-risk-btn">Open →</button></td>
    </tr>`).join('');

  // Funnel
  const stages = [
    { label:'Active profiles',  count:287, pct:100, color:'#0f1f3d' },
    { label:'Submitted ≥1 app', count:127, pct:44,  color:'#1a3260' },
    { label:'Shortlisted',      count: 68, pct:24,  color:'#e8622a' },
    { label:'Offers received',  count: 51, pct:18,  color:'#f0875a' },
    { label:'Offers accepted',  count: 43, pct:15,  color:'#2e7d52' },
  ];
  const html = stages.map((st, i) => {
    const conv = i > 0 ? Math.round(st.count / stages[i-1].count * 100) : 100;
    const arrow = i > 0 ? `<div class="funnel-arrow">${conv}%</div>` : '<div class="funnel-arrow">—</div>';
    return `
      <div class="funnel-stage">
        <div class="funnel-label">${st.label}</div>
        <div class="funnel-bar" style="width:${st.pct}%; background:${st.color};">${st.count}</div>
        <div class="funnel-pct">${st.pct}% of cohort</div>
        ${arrow}
      </div>`;
  }).join('');
  document.getElementById('funnel-stages').innerHTML = html;
}

// ═══════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════
document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn'); if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panel-' + btn.dataset.panel).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initMatchAnalyzer();
  initMarketPulse();
  initEngagement();
});
