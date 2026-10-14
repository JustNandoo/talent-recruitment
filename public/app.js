import { builderMarkup, mountBuilder, unmountBuilder, builderHasUnsaved } from './exam-builder.js';
import { customDetailView } from './custom-exam-ui.js';
import { stimulusView, indoDetailView } from './indo-artha-ui.js';
const $ = selector => document.querySelector(selector);
const app = $('#app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  chart: '<path d="M3 3v18h18M8 16v-5m5 5V7m5 9v-8"/>',
  book: '<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1zm0 0v15"/>',
  plus: '<path d="M12 5v14m-7-7h14"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back: '<path d="m12 5-7 7 7 7m-7-7h14"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  logout: '<path d="M9 4H4v16h5m5-15 7 7-7 7m-5-7h12"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  link: '<path d="m10 13 4-4m-6 5-2 2a4 4 0 0 0 6 6l3-3m-6-9 3-3a4 4 0 0 1 6 6l-2 2"/>',
  alert: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v4m0 3v1"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  file: '<path d="M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8m-8 4h8"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>',
};
const icon = (name, className = '') => `<svg class="icon ${className}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`;
const organizerName = 'HRD Division PT Serviam Group Shipyard';
const brand = `<span class="brand-logo"><img src="/serviam-logo.svg" alt="Logo PT Serviam Group Shipyard" width="512" height="512" /></span><span class="brand-copy"><strong>HRD Division</strong><span>PT Serviam Group Shipyard</span></span>`;
const state = { view: 'dashboard', user: null, meta: null, exams: [], filter: 'all', search: '', detail: null, detailTab: 'analysis', exam: null, currentQuestion: 0, saveState: 'saved', saving: false, transitioning: false };
let pendingAnswers = {};
let savePromise = null;
let autosaveTimeout;
let toastTimeout;
let pollTimer;
let tickTimer;
let clockOffset = 0;
let modalResolver;

async function api(path, method = 'GET', body) {
  let response;
  try {
    response = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-Talenta-Request': '1' }, signal: AbortSignal.timeout(12000), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  } catch {
    throw new Error('Server tidak merespons. Pastikan npm start tetap berjalan dan buka alamat web yang tercetak di terminal.');
  }
  if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('Alamat ini bukan server aplikasi ujian HRD. Gunakan alamat web yang tercetak setelah menjalankan npm start.');
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || 'Permintaan gagal.'); error.status = response.status; throw error; }
  return data;
}
function toast(message, error = false) {
  clearTimeout(toastTimeout);
  const target = $('#toast');
  target.innerHTML = `${icon(error ? 'alert' : 'checkCircle')}<span>${esc(message)}</span>`;
  target.className = `visible ${error ? 'error' : ''}`;
  toastTimeout = setTimeout(() => { target.className = ''; }, 4500);
}
const date = value => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(new Date(value)) : '—';
const dateTime = value => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value)) + ' WIB' : '—';
const initials = name => name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
const roleName = role => state.meta?.exams?.flatMap(e=>e.roles).find(r => r.id === role)?.name || state.meta?.roles.find(r => r.id === role)?.name || role;
const statusLabel = { pending: 'Menunggu', active: 'Sedang ujian', completed: 'Selesai', expired: 'Kedaluwarsa' };
const decisionLabel = { belum_diputuskan: 'Belum diputuskan', lanjut: 'Lanjut proses', ditahan: 'Ditahan / klarifikasi', tidak_lanjut: 'Tidak lanjut' };
function badge(label, tone = 'gray') { return `<span class="badge ${tone}"><span class="badge-dot"></span>${esc(label)}</span>`; }
function examBadge(exam) { return badge(statusLabel[exam.status], { pending: 'gray', active: 'blue', completed: 'green', expired: 'amber' }[exam.status]); }

function navigate(path) { history.pushState({}, '', path); route(); }
function setView(view) {
  state.view = view; state.detail = null;
  history.pushState({}, '', '/penguji');
  renderAdmin();
  window.scrollTo(0,0);
}
async function loadAdmin() {
  state.user = (await api('/api/admin/me')).user;
  if (state.user.role !== 'superadmin' && ['users','system'].includes(state.view)) state.view = 'dashboard';
  if (state.user.mustChangePassword) return;
  const [meta, exams] = await Promise.all([api('/api/admin/meta'), api('/api/admin/exams')]);
  state.meta = meta; state.exams = exams.exams;
}
async function refreshAdmin() {
  const data = await api('/api/admin/exams'); state.exams = data.exams;
  if (state.view !== 'exam-builder' && !state.detail && !$('#modal-root dialog') && !$('#search:focus')) renderAdmin();
}

function renderLogin(configured = true) {
  clearInterval(pollTimer); clearInterval(tickTimer);
  app.innerHTML = `<div class="auth-layout"><aside class="auth-story"><a class="brand" href="/">${brand}</a><div class="auth-story-content"><span class="eyebrow light">REKRUTMEN YANG LEBIH TERARAH</span><h1>Tim hebat dimulai<br>dari potensi<br>yang tepat<span>.</span></h1><p>Satu tempat untuk menguji kemampuan, memahami cara kerja, dan mengambil keputusan dengan lebih percaya diri.</p><div class="auth-orbit" aria-hidden="true"><div class="orbit-ring ring-1"></div><div class="orbit-ring ring-2"></div><div class="orbit-ring ring-3"></div><div class="orbit-core">${icon('users')}</div><span class="orbit-tag tag-1">${icon('checkCircle')} Kemampuan terukur</span><span class="orbit-tag tag-2">${icon('shield')} Satu kesempatan</span></div></div><div class="auth-footer">Asesmen rekrutmen · ${organizerName}</div></aside><main class="auth-form-side"><div class="auth-mobile-brand brand">${brand}</div><div class="auth-box"><span class="eyebrow">RUANG PENGUJI</span><h2>${configured ? 'Selamat datang kembali' : 'Siapkan ruang rekrutmen'}</h2><p class="muted">${configured ? 'Masuk untuk mengelola peserta dan meninjau hasil asesmen.' : 'Buat akun penguji pertama untuk mulai mengundang peserta.'}</p><form id="${configured ? 'login-form' : 'setup-form'}" class="stack-form">${!configured ? '<label>Nama penguji<input name="name" autocomplete="name" required minlength="2" maxlength="80" placeholder="Nama lengkap Anda" /></label>' : ''}<label>Email penguji<input type="email" name="email" autocomplete="username" required placeholder="nama@perusahaan.com" /></label><label>Kata sandi<input type="password" name="password" autocomplete="${configured ? 'current-password' : 'new-password'}" required minlength="${configured ? 1 : 12}" maxlength="128" placeholder="${configured ? 'Masukkan kata sandi' : 'Minimal 12 karakter'}" /></label>${!configured ? '<label>Kode penyiapan<input name="setupCode" autocomplete="off" required placeholder="Kode dari server aplikasi" /><small>Kode tersimpan di <code>.data/bootstrap-token</code>. Alternatif: jalankan <code>npm run admin:setup</code> dari terminal.</small></label>' : ''}<p class="form-error" id="auth-error" role="alert"></p><button class="button primary full" type="submit">${configured ? 'Masuk ke dashboard' : 'Buat akun penguji'} ${icon('arrow')}</button></form><div class="auth-notice">${icon('lock')}<span>Akses hanya untuk penguji yang berwenang.<br>Peserta masuk melalui tautan undangan pribadi.</span></div></div><div class="auth-footnote">${organizerName}</div></main></div>`;
}

function sidebar() {
  const nav = [['dashboard', 'grid', 'Ringkasan'], ['exams','file','Ujian'], ['participants', 'users', 'Peserta ujian'], ['analytics', 'chart', 'Analisis hasil'], ['guide', 'book', 'Bank & panduan']];
  if (state.user.role === 'superadmin') nav.push(['users', 'users', 'Akun penguji'], ['system', 'shield', 'Sistem & aktivitas']);
  return `<aside class="sidebar"><a class="brand" href="/penguji">${brand}</a><div class="workspace-label">RUANG KERJA</div><div class="workspace-selector"><span class="workspace-avatar">HRD</span><div><strong>Serviam Group Shipyard</strong><span>Asesmen karyawan baru</span></div></div><div class="nav-label">MENU UTAMA</div><nav>${nav.map(([view, symbol, label]) => `<button data-action="view" data-view="${view}" class="nav-item ${state.view === view && !state.detail ? 'active' : ''}">${icon(symbol)}<span>${label}</span>${view === 'participants' && state.exams.length ? `<span class="nav-count">${state.exams.length}</span>` : ''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-tip">${icon('shield')}<strong>Satu peserta, satu kesempatan.</strong><p>Tautan pribadi menjaga setiap proses asesmen tetap terarah.</p></div><div class="sidebar-user"><span class="avatar">${esc(initials(state.user.name))}</span><div><strong>${esc(state.user.name)}</strong><span>${state.user.role === 'superadmin' ? 'Superadmin' : 'Admin penguji'}</span></div><button class="icon-button" data-action="logout" aria-label="Keluar" title="Keluar">${icon('logout')}</button></div></div></aside>`;
}
function renderAdmin() {
  unmountBuilder();
  if (state.user.mustChangePassword) { renderPasswordChange(); return; }
  const titles = { dashboard: 'Ringkasan', exams:'Ujian', 'exam-builder':'Buat ujian sendiri', participants: 'Peserta ujian', analytics: 'Analisis hasil', guide: 'Bank & panduan', users: 'Akun penguji', system: 'Sistem & aktivitas' };
  app.innerHTML = `<div class="admin-layout">${sidebar()}<div class="admin-main"><header class="topbar"><button class="icon-button mobile-menu" data-action="menu" aria-label="Buka menu">${icon('menu')}</button><div class="breadcrumb">Ruang penguji ${icon('chevron')} <strong>${state.detail ? 'Hasil peserta' : titles[state.view]}</strong></div><div class="topbar-right"><button class="icon-button" data-action="password" aria-label="Ganti kata sandi" title="Ganti kata sandi">${icon('lock')}</button><span class="today">${date(Date.now())}</span><span class="topbar-divider"></span><span class="avatar small">${esc(initials(state.user.name))}</span></div></header><main class="content">${state.detail ? detailView() : state.view === 'exam-builder' ? builderMarkup() : state.view === 'exams' ? examsView() : state.view === 'participants' ? participantsView() : state.view === 'analytics' ? analyticsView() : state.view === 'guide' ? guideView() : state.view === 'users' ? usersView() : state.view === 'system' ? systemView() : dashboardView()}</main><footer class="main-footer"><span>© ${new Date().getFullYear()} ${organizerName}</span><span>${icon('shield')} Hasil hanya untuk tim rekrutmen</span></footer></div></div>`;
  if(state.view==='exam-builder')mountBuilder($('.content'),{cancel:()=>setView('exams'),importDocuments:sources=>api('/api/admin/import-documents','POST',{sources}),save:async input=>{
    await api('/api/admin/templates','POST',input);
    state.meta=await api('/api/admin/meta');
    setView('exams');toast('Ujian buatan sendiri tersimpan dan dapat digunakan untuk undangan.');
  }});
}
function renderPasswordChange() {
  clearInterval(pollTimer); clearInterval(tickTimer);
  app.innerHTML = `<main class="password-page"><a class="brand dark" href="/">${brand}</a><span class="eyebrow">KEAMANAN AKUN</span><h1>${state.user.mustChangePassword ? 'Ganti kata sandi awal' : 'Ganti kata sandi Anda'}</h1><p class="muted">${esc(state.user.email)} · ${state.user.role === 'superadmin' ? 'Superadmin' : 'Admin penguji'}</p><p class="password-info">${state.user.mustChangePassword ? 'Masukkan kata sandi awal yang ditetapkan saat penyiapan atau diberikan superadmin. Tentukan kata sandi pribadi untuk membuka dashboard.' : 'Perubahan ini mengakhiri sesi lain yang masih aktif.'}</p><form id="password-form" class="stack-form"><label>Kata sandi saat ini<input type="password" name="currentPassword" autocomplete="current-password" required maxlength="128" /></label><label>Kata sandi baru<input type="password" name="password" autocomplete="new-password" required minlength="12" maxlength="128" /></label><label>Ulangi kata sandi baru<input type="password" name="confirmPassword" autocomplete="new-password" required minlength="12" maxlength="128" /></label><p class="form-error" role="alert"></p><button class="button primary" type="submit">Simpan kata sandi ${icon('check')}</button></form><button class="text-button" data-action="logout">Keluar dari akun</button></main>`;
}
function usersView() {
  return `${pageHead('SUPERADMIN', 'Akun penguji', 'Atur akses admin dan superadmin. Akun baru wajib mengganti kata sandi awal.', '<button class="button primary" data-action="user-add">' + icon('plus') + ' Tambah akun</button>')}<section class="panel"><div class="table-scroll"><table class="participant-table"><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Status</th><th>Akses awal</th><th>Aksi</th></tr></thead><tbody>${(state.users || []).map(user => `<tr><td>${esc(user.name)}</td><td>${esc(user.email)}</td><td>${user.role === 'superadmin' ? 'Superadmin' : 'Admin penguji'}</td><td>${badge(user.active ? 'Aktif' : 'Nonaktif', user.active ? 'green' : 'gray')}</td><td>${user.mustChangePassword ? 'Wajib ganti sandi' : 'Siap'}</td><td><button class="button secondary" data-action="user-edit" data-id="${user.id}">Kelola</button></td></tr>`).join('')}</tbody></table></div></section>`;
}
function systemView() {
  const info = state.system || {};
  return `${pageHead('SUPERADMIN', 'Sistem & aktivitas', 'Status konfigurasi dan 200 aktivitas terbaru. Undangan dibagikan melalui tautan.')}<section class="panel system-info"><dl><div><dt>Mode aplikasi</dt><dd>${esc(info.mode)}</dd></div><div><dt>Alamat publik</dt><dd>${esc(info.publicOrigin || 'Belum ditetapkan; mode lokal')}</dd></div><div><dt>Cookie Secure</dt><dd>${info.secureCookies ? 'Aktif' : 'Lokal HTTP'}</dd></div><div><dt>Database</dt><dd>${info.databaseEngine === 'postgres' ? 'PostgreSQL (Supabase)' : 'SQLite lokal'} · ${info.database ? 'Terhubung' : 'Perlu diperiksa'}</dd></div><div><dt>Undangan</dt><dd>Link · salin dan bagikan manual</dd></div><div><dt>Node.js</dt><dd>${esc(info.nodeVersion)}</dd></div></dl></section><section class="panel"><div class="panel-heading"><h2>Log aktivitas</h2></div><div class="table-scroll"><table class="participant-table"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aktivitas</th></tr></thead><tbody>${(state.audit || []).map(entry => `<tr><td>${dateTime(entry.at)}</td><td>${esc(entry.actor_name || (entry.actor.startsWith('peserta:') ? 'Peserta ujian' : 'Operator'))}</td><td>${esc(entry.action)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function userModal(user = null) {
  const editing = Boolean(user);
  showModal(editing ? 'Kelola akun penguji' : 'Tambah akun penguji', `<form id="${editing ? 'user-edit-form' : 'user-form'}" ${editing ? `data-id="${user.id}"` : ''} class="stack-form">${editing ? `<p class="modal-description">${esc(user.name)} · ${esc(user.email)}</p>` : '<label>Nama<input name="name" required minlength="2" maxlength="80" /></label><label>Email akun<input type="email" name="email" required /></label>'}<label>Peran<select name="role"><option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Admin penguji</option><option value="superadmin" ${user?.role === 'superadmin' ? 'selected' : ''}>Superadmin</option></select></label>${editing ? `<label>Status<select name="active"><option value="true" ${user.active ? 'selected' : ''}>Aktif</option><option value="false" ${!user.active ? 'selected' : ''}>Nonaktif</option></select></label>` : ''}<label>${editing ? 'Kata sandi awal baru (opsional)' : 'Kata sandi awal'}<input type="password" name="password" autocomplete="new-password" ${editing ? '' : 'required'} minlength="12" maxlength="128" /><small>${editing ? 'Isi untuk mereset kata sandi dan mengakhiri sesi akun ini.' : 'Berikan kata sandi ini secara pribadi kepada pemilik akun.'} Kata sandi awal wajib diganti saat masuk.</small></label><p class="form-error" role="alert"></p><button class="button primary" type="submit">Simpan akun</button></form>`);
}
function pageHead(eyebrow, title, description, buttons = '') { return `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p class="muted">${description}</p></div><div class="heading-actions">${buttons}</div></div>`; }
const inviteButton = `<button class="button primary" data-action="invite">${icon('plus')} Add invitation</button>`;
const exportButton = `<a class="button secondary" href="/api/admin/export" download>${icon('download')} Ekspor CSV</a>`;
function dashboardView() {
  const completed = state.exams.filter(e => e.status === 'completed');
  const active = state.exams.filter(e => e.status === 'active');
  const pending = state.exams.filter(e => e.status === 'pending');
  const serviamResults = completed.filter(e => !e.examType || e.examType === 'serviam');
  const average = serviamResults.length ? Math.round(serviamResults.reduce((sum,e)=>sum+e.percent,0)/serviamResults.length) : null;
  const stats = [
    ['users', 'Total peserta', state.exams.length, 'Peserta yang telah diundang', 'mint'],
    ['checkCircle', 'Ujian selesai', completed.length, `${active.length} peserta sedang mengerjakan`, 'blue'],
    ['chart', 'Rata-rata Serviam A–D', average === null ? '—' : `${average}<small>%</small>`, 'Skor kemampuan & situasional', 'violet'],
    ['clock', 'Menunggu ujian', pending.length, 'Undangan aktif, belum digunakan', 'peach'],
  ];
  return `${pageHead('DASHBOARD', 'Gambaran rekrutmen Anda', 'Pantau proses asesmen dan temukan potensi di setiap peserta.', inviteButton)}<section class="hero"><div class="hero-content"><span class="hero-kicker"><span></span> ASESMEN KARYAWAN BARU</span><h2>Kenali potensi.<br>Bangun tim terbaik.</h2><p>Dari kemampuan dasar hingga cara menghadapi situasi kerja.<br>Keputusan yang lebih terarah dimulai dari pemahaman.</p><div class="hero-facts"><span>${icon('file')} Serviam & Indo Artha</span><i></i><span>${icon('clock')} ${state.meta.exams.length} pilihan ujian</span><i></i><span>${icon('shield')} Sekali pakai</span></div></div><div class="hero-art" aria-hidden="true"><svg viewBox="0 0 300 225"><defs><linearGradient id="artfade" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e2f5b8"/><stop offset="1" stop-color="#89c4a2"/></linearGradient></defs><circle cx="163" cy="112" r="101" fill="none" stroke="#ffffff" stroke-opacity=".08"/><circle cx="163" cy="112" r="77" fill="none" stroke="#ffffff" stroke-opacity=".13"/><circle cx="163" cy="112" r="50" fill="none" stroke="#ffffff" stroke-opacity=".17"/><path d="M163 11v202M62 112h202M90 41l144 143M90 184 234 41" stroke="#ffffff" stroke-opacity=".06"/><path d="m163 28 69 48-18 81-87 30-49-74Z" fill="url(#artfade)" fill-opacity=".14" stroke="#c8e8ad" stroke-width="2"/><path d="m163 63 45 22-11 52-44 14-39-35Z" fill="#c4edb3" fill-opacity=".22" stroke="#d2edbc" stroke-width="1.5"/>${[[163,28],[232,76],[214,157],[127,187],[78,113]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#d9efbd"/>`).join('')}<g transform="translate(22,28)"><rect width="89" height="34" rx="9" fill="#fff"/><circle cx="17" cy="17" r="7" fill="#e8f2df"/><path d="m14 17 2 2 4-4" fill="none" stroke="#47653d" stroke-width="1.5"/><text x="30" y="21" fill="#38533d" font-size="10" font-family="sans-serif">Potensi terukur</text></g><g transform="translate(174,173)"><rect width="110" height="36" rx="9" fill="#f0f6e9"/><text x="13" y="23" fill="#38533d" font-size="11" font-family="sans-serif">Kenali cara kerjanya</text></g></svg></div></section><section class="stats-grid">${stats.map(([symbol,label,value,caption,tone]) => `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${tone}">${icon(symbol)}</span></div><strong class="stat-number">${value}</strong><p>${caption}</p></article>`).join('')}</section><section class="panel participants-panel"><div class="panel-heading"><div><h2>Peserta terbaru</h2><p>Ikuti perjalanan asesmen, mulai dari undangan hingga hasil.</p></div><button class="text-button" data-action="view" data-view="participants">Lihat semua ${icon('arrow')}</button></div>${participantTable(state.exams.slice(0, 5))}</section><div class="below-grid"><article class="info-card"><span class="info-icon">${icon('book')}</span><div><h3>Asesmen dengan panduan yang jelas</h3><p>Pilih paket Serviam, Indo Artha Group, atau buat ujian sendiri pada menu Ujian.</p><button class="text-button" data-action="view" data-view="guide">Pelajari panduan ${icon('arrow')}</button></div></article><article class="info-card"><span class="info-icon">${icon('users')}</span><div><h3>Hasil untuk membantu keputusan</h3><p>Tinjau skor dan klarifikasi melalui wawancara. Keputusan akhir ada pada tim penguji.</p><button class="text-button" data-action="view" data-view="analytics">Buka analisis hasil ${icon('arrow')}</button></div></article></div>`;
}
function participantTable(exams) {
  return `<div class="table-scroll"><table class="participant-table"><thead><tr><th>Peserta</th><th>Posisi</th><th>Status ujian</th><th>Nilai tes</th><th>Tinjauan</th><th><span class="sr-only">Aksi</span></th></tr></thead><tbody>${exams.length ? exams.map((e,i) => `<tr><td><div class="person"><span class="avatar color-${i % 4}">${esc(initials(e.name))}</span><div><strong>${esc(e.name)}</strong><span>${esc(e.examLabel || 'Serviam')} · ${esc(e.email || `Diundang ${date(e.createdAt)}`)}</span></div></div></td><td>${esc((e.roleName || roleName(e.role)))}</td><td>${examBadge(e)}</td><td>${e.total !== null ? `<span class="table-score">${e.max===0?'Kuesioner':e.total}<small>${e.max===0?'':' / '+(e.max??46)}</small></span>` : e.status === 'active' ? `<span class="muted">${e.answered}/${e.questionCount || 48} terjawab</span>` : '<span class="muted">—</span>'}</td><td>${e.review ? badge(e.review.label, e.review.tone) : '<span class="muted">Belum tersedia</span>'}</td><td><button class="row-action" data-action="detail" data-id="${e.id}" aria-label="Lihat ${esc(e.name)}" title="Lihat peserta">${icon('chevron')}</button></td></tr>`).join('') : `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">${icon(state.search ? 'search' : 'users')}</span><h3>${state.search || state.filter !== 'all' ? 'Belum ada peserta yang sesuai' : 'Mulai dengan peserta pertama'}</h3><p>${state.search || state.filter !== 'all' ? 'Coba kata kunci atau filter status lainnya.' : 'Buat undangan pribadi. Setelah peserta selesai, nilai dan analisisnya akan tampil di sini.'}</p>${state.search || state.filter !== 'all' ? '' : '<button class="button secondary" data-action="invite">' + icon('plus') + ' Add invitation</button>'}</div></td></tr>`}</tbody></table></div>`;
}
function participantsView() {
  const filters = [['all','Semua peserta'], ['pending','Menunggu'], ['active','Sedang ujian'], ['completed','Selesai'], ['expired','Kedaluwarsa']];
  const exams = state.exams.filter(e => (state.filter === 'all' || e.status === state.filter) && `${e.name} ${e.email} ${(e.roleName || roleName(e.role))} ${e.examLabel || ''}`.toLocaleLowerCase('id-ID').includes(state.search.toLocaleLowerCase('id-ID')));
  return `${pageHead('PESERTA UJIAN', 'Setiap potensi, satu kesempatan', 'Kelola undangan dan pantau status ujian peserta Anda.', exportButton + inviteButton)}<section class="panel"><div class="list-controls"><div class="tabs">${filters.map(([id,label]) => `<button class="tab ${state.filter === id ? 'active' : ''}" data-action="filter" data-filter="${id}">${label}<span>${id === 'all' ? state.exams.length : state.exams.filter(e=>e.status===id).length}</span></button>`).join('')}</div><div class="search-field">${icon('search')}<input id="search" type="search" placeholder="Cari nama atau posisi…" value="${esc(state.search)}" aria-label="Cari peserta" /></div></div><div id="participant-results">${participantTable(exams)}</div><div class="table-footer">${exams.length} peserta ditampilkan <span>Undangan tidak dikirim otomatis; bagikan tautan secara pribadi.</span></div></section>`;
}
function analyticsView() {
  const completed = state.exams.filter(e => e.status === 'completed');
  const reviewed = completed.filter(e => e.interviewSummary.complete);
  return `${pageHead('ANALISIS HASIL', 'Lihat hasil dengan konteks', 'Tinjau kemampuan, kebutuhan klarifikasi, dan bukti perilaku bersama.', exportButton)}<div class="analytics-summary"><div class="panel analytics-card"><span class="stat-icon mint">${icon('checkCircle')}</span><strong>${completed.length}</strong><span>Tes tertulis selesai</span></div><div class="panel analytics-card"><span class="stat-icon blue">${icon('users')}</span><strong>${reviewed.length}</strong><span>Wawancara lengkap</span></div><div class="panel analytics-card"><span class="stat-icon peach">${icon('alert')}</span><strong>${completed.filter(e => e.review?.tone === 'amber').length}</strong><span>Memerlukan peninjauan</span></div></div><section class="panel"><div class="panel-heading"><div><h2>Hasil asesmen peserta</h2><p>Nilai mengikuti paket setiap peserta: Serviam A–D atau Indo Artha M1 + M3. Profil gaya kerja dan wawancara dibaca terpisah.</p></div></div>${participantTable(completed)}</section><div class="notice">${icon('book')}<p>Bagian E adalah kuesioner yang belum divalidasi secara statistik. Gunakan untuk diskusi wawancara, bukan diagnosis psikologis atau dasar tunggal menolak kandidat.</p></div>`;
}
function guideView() {
  return `${pageHead('BANK & PANDUAN', 'Satu standar untuk setiap peserta', 'Soal dan analisis mengacu pada dokumen yang Anda lampirkan.', '<a class="button secondary" href="/api/admin/source" download>' + icon('download') + ' Dokumen sumber</a>')}<section class="panel indo-panel-content"><h2>Indo Artha Group Psikotes</h2><p>Paket lengkap: 82 butir, 90 menit termasuk jeda. Paket ringkas operator: 57 butir, 40 menit. Soal, kunci, dan panduan khusus tersedia di menu Ujian.</p><button class="button secondary" data-action="view" data-view="exams">Buka ujian Indo Artha</button></section><div class="guide-source panel"><span class="source-icon">${icon('book')}</span><div><span class="eyebrow">DOKUMEN SUMBER · 9 HALAMAN</span><h2>Bank Soal Psikotes Karyawan Baru</h2><p>Fajar · 8 Oktober 2026 · 48 soal tertulis + 6 pertanyaan wawancara</p></div>${badge('Sumber asesmen', 'green')}</div><section class="panel"><div class="panel-heading"><div><h2>Struktur & batas minimum</h2><p>Batas waktu sama untuk semua peserta dan dikendalikan server.</p></div></div><div class="table-scroll"><table class="guide-table"><thead><tr><th>Bagian</th><th>Jumlah</th><th>Waktu</th><th>Skor maksimum</th><th>Batas minimum</th></tr></thead><tbody>${state.meta.sections.map(s => `<tr><td><span class="section-letter">${s.id}</span><strong>${s.name}</strong></td><td>${s.count} ${s.id === 'E' ? 'pernyataan' : 'soal'}</td><td>${s.minutes} menit</td><td>${s.max || '15 per dimensi'}</td><td>${s.minimum || '9 per dimensi'}</td></tr>`).join('')}<tr><td><span class="section-letter">F</span><strong>Wawancara perilaku (STAR)</strong></td><td>6 pertanyaan</td><td>30 menit</td><td>5 per pertanyaan</td><td>Rata-rata 3</td></tr></tbody></table></div></section><div class="guide-grid"><article class="panel guide-card"><h3>${icon('chart')} Penilaian sesuai posisi</h3><p>Keuangan dan pengadaan: minimum B = 6.<br>Business development dan penyusun dokumen: minimum C = 8.</p><p>Skor A–D maksimum 46. Tidak ada bobot persentase tambahan karena dokumen tidak menetapkannya.</p></article><article class="panel guide-card"><h3>${icon('shield')} Integritas & validitas</h3><p>D3 pilihan A/D atau E4/E6 bernilai 4–5 memerlukan klarifikasi. Jika E13 dan E14 sama-sama bernilai 4–5, interpretasi E diabaikan.</p><p>Butir terbalik: E2, E4, E6, E8, E11. Skor = 6 − jawaban.</p></article><article class="panel guide-card"><h3>${icon('link')} Akses sekali pakai</h3><p>Tautan dikonsumsi saat mulai. Sesi hanya dapat dilanjutkan dari browser yang sama, dalam waktu ujian. Bagian yang sudah ditutup tidak dapat diubah.</p><p>Setelah selesai, tautan dan sesi tidak memberi kesempatan mengerjakan ulang.</p></article><article class="panel guide-card"><h3>${icon('users')} Keputusan tetap pada penguji</h3><p>Silang-cek hasil tes dengan contoh Situasi, Tugas, Aksi, dan Hasil saat wawancara. Catat alasan keputusan secara manual.</p><p>Batasi akses data pribadi pada tim rekrutmen dan hapus data ketika tidak lagi diperlukan.</p></article></div><div class="notice">${icon('alert')}<p>Ini alat saring internal, bukan tes psikologi baku. Kuesioner E belum divalidasi secara statistik. Gunakan hasil untuk membantu diskusi dan penilaian manusia.</p></div>`;
}

async function openDetail(id) {
  const { exam } = await api(`/api/admin/exams/${id}`);
  state.detail = exam; state.detailTab = 'analysis';
  history.pushState({}, '', `/penguji/hasil/${id}`); renderAdmin();
}
function detailView() {
  const e = state.detail;
  const result = e.result;
  const buttons = `${e.status === 'pending' || e.status === 'expired' ? '<button class="button secondary" data-action="rotate">' + icon('link') + ' Buat ulang tautan</button>' : ''}${e.status !== 'active' ? '<button class="icon-button bordered danger" data-action="delete" aria-label="Hapus data peserta" title="Hapus data peserta">' + icon('trash') + '</button>' : ''}`;
  if(e.custom) return customDetailView(e,{buttons,decisionLabel,dateTime,examBadge,tab:state.detailTab});
  if(e.examType && e.examType !== 'serviam') return indoDetailView(e,{buttons,decisionLabel,dateTime,badge,examBadge,tab:state.detailTab});
  return `<button class="text-button back-button" data-action="view" data-view="participants">${icon('back')} Semua peserta</button>${pageHead('HASIL ASESMEN', esc(e.name), `${esc((e.roleName || roleName(e.role)))} <span class="dot-separator">·</span> ${esc(e.email || 'Email tidak dicantumkan')}`, buttons)}<div class="detail-meta">${examBadge(e)}<span>${icon('clock')} ${e.finishedAt ? 'Selesai ' + dateTime(e.finishedAt) : 'Diundang ' + dateTime(e.createdAt)}</span><span>${icon('shield')} Satu kesempatan</span></div>${!result ? `<section class="panel"><div class="empty-state"><span class="empty-icon">${icon(e.status === 'active' ? 'clock' : 'mail')}</span><h3>${e.status === 'active' ? 'Peserta sedang mengerjakan ujian' : e.status === 'expired' ? 'Undangan sudah kedaluwarsa' : 'Menunggu peserta memulai'}</h3><p>${e.status === 'active' ? `Bagian ${state.meta.sections[e.sectionIndex].name} · ${e.answered}/48 jawaban tersimpan. Hasil tersedia saat ujian selesai.` : e.status === 'expired' ? 'Buat ulang tautan untuk memperpanjang undangan yang belum digunakan.' : 'Bagikan tautan pribadi ke peserta. Nilai dihitung ketika peserta selesai atau waktu ujian habis.'}</p>${e.status === 'active' ? '<button class="button secondary" data-action="refresh-detail">Perbarui status</button>' : ''}</div></section>` : `<section class="result-overview panel"><div class="result-score" style="--progress:${result.percent}%"><div><strong>${result.total}<small>/46</small></strong><span>Skor A–D</span></div></div><div class="result-summary"><span class="eyebrow">TINJAUAN TES TERTULIS</span><h2>${esc(e.review.label)}</h2><p>${result.minimumsMet ? 'Semua batas minimum A–D terpenuhi.' : 'Ada bagian A–D yang belum memenuhi batas minimum.'} ${e.interviewSummary.complete ? 'Wawancara telah dinilai.' : 'Lengkapi wawancara sebelum mengambil keputusan akhir.'}</p><div class="result-summary-tags">${badge(`${result.answered}/48 terjawab`, 'gray')}${badge(e.finishReason === 'timeout' ? 'Waktu ujian habis' : 'Dikirim peserta', e.finishReason === 'timeout' ? 'amber' : 'green')}</div></div><div class="decision-box"><span>Keputusan penguji</span><strong>${esc(decisionLabel[e.decision])}</strong><small>Ditentukan secara manual</small></div></section><div class="detail-tabs tabs"><button data-action="detail-tab" data-tab="analysis" class="tab ${state.detailTab === 'analysis' ? 'active' : ''}">Analisis & skor</button><button data-action="detail-tab" data-tab="answers" class="tab ${state.detailTab === 'answers' ? 'active' : ''}">Rincian jawaban</button><button data-action="detail-tab" data-tab="interview" class="tab ${state.detailTab === 'interview' ? 'active' : ''}">Wawancara & keputusan <span>${e.interviewSummary.count}/6</span></button></div>${state.detailTab === 'answers' ? answersView(result, e.questionOrder) : state.detailTab === 'interview' ? interviewView(e) : analysisView(result)}`}`;
}
function analysisView(result) {
  return `<div class="analysis-grid"><section class="panel"><div class="panel-heading"><div><h2>Kemampuan & situasional</h2><p>Skor A–D dan batas minimum untuk ${esc(roleName(state.detail.role))}.</p></div></div><div class="score-bars">${result.sections.map(s => `<div class="score-bar-row"><div class="score-bar-label"><span><span class="section-letter">${s.id}</span>${s.short}</span><strong>${s.score}<small>/${s.max}</small></strong></div><div class="bar-track"><div class="bar-fill ${s.meetsMinimum ? '' : 'amber'}" style="width:${s.score / s.max * 100}%"></div><span class="bar-marker" style="left:${s.minimum / s.max * 100}%" title="Batas minimum ${s.minimum}"></span></div><div class="bar-caption"><span>Minimum ${s.minimum}</span><span class="${s.meetsMinimum ? 'text-green' : 'text-amber'}">${s.meetsMinimum ? 'Memenuhi' : 'Perlu ditinjau'}</span></div></div>`).join('')}</div></section><section class="panel"><div class="panel-heading"><div><h2>Kepribadian kerja</h2><p>Skor per dimensi · bagian E</p></div>${badge(result.personality.valid ? 'Dapat didiskusikan' : 'Tidak ditafsirkan', result.personality.valid ? 'green' : 'amber')}</div><div class="dimension-list">${result.personality.dimensions.map(d => `<div class="dimension-row"><div><strong>${d.name}</strong><span>${esc(d.label)}</span></div><strong>${d.score ?? '—'}<small>/15</small></strong></div>`).join('')}</div><p class="panel-note">12–15 kuat · 9–11 cukup · ≤8 perlu digali.<br>${result.personality.valid ? 'Gunakan sebagai bahan diskusi wawancara.' : 'Abaikan interpretasi E jika validitas bermasalah atau jawaban belum lengkap.'}</p></section></div><section class="panel"><div class="panel-heading"><div><h2>Hal yang perlu didiskusikan</h2><p>Gunakan temuan berikut untuk klarifikasi, bukan untuk menyimpulkan sifat seseorang.</p></div></div><div class="findings">${result.flags.length ? result.flags.map(f => `<div class="finding">${icon('alert')}<div><strong>${esc(f.question)} · ${f.type === 'integritas' ? 'Klarifikasi integritas' : f.type === 'validitas' ? 'Validitas jawaban' : 'Bahan diskusi'}</strong><p>${esc(f.text)}</p></div></div>`).join('') : `<div class="finding positive">${icon('checkCircle')}<div><strong>Tidak ada indikator klarifikasi integritas yang terpicu</strong><p>Tetap silang-cek dengan bukti perilaku saat wawancara.</p></div></div>`}<div class="finding neutral">${icon('users')}<div><strong>Fokus sesuai posisi</strong><p>${esc(result.roleFocus)}</p></div></div></div></section><div class="notice">${icon('book')}<p>Hasil ini adalah bahan penilaian internal. Kuesioner kepribadian belum divalidasi secara statistik dan tidak menghasilkan diagnosis psikologis.</p></div>`;
}
function answerText(detail, response) {
  if (response === null || response === undefined || response === '') return 'Tidak dijawab';
  return detail.options ? `${response}. ${detail.options[['A','B','C','D','E'].indexOf(response)] || ''}` : String(response);
}
function answersView(result, questionOrder) {
  const position = (section, id, fallback) => questionOrder?.[section]?.indexOf(id) + 1 || fallback;
  return `${result.sections.map(s => `<section class="panel answer-section"><div class="panel-heading"><div><h2>${s.id}. ${s.name}</h2><p>${s.answered}/${s.count} soal dijawab · Nomor mengikuti urutan peserta.</p></div><strong>${s.score} / ${s.max}</strong></div><div class="answer-list">${[...s.details].sort((a,b) => position(s.id,a.id,a.number) - position(s.id,b.id,b.number)).map(d => `<details class="answer-detail"><summary><span class="answer-number">${position(s.id,d.id,d.number)}</span><span>${esc(d.prompt)}</span><span class="answer-points ${d.points === d.max ? 'text-green' : 'text-amber'}">${d.points}/${d.max}</span>${icon('down')}</summary><div class="answer-body"><p class="source-question">Kode soal sumber: <strong>${esc(d.id)}</strong></p><div class="answer-comparison"><div><small>Jawaban peserta</small><strong>${esc(answerText(d,d.response))}</strong></div><div><small>${s.id === 'D' ? 'Pilihan terbaik' : 'Kunci jawaban'}</small><strong>${esc(answerText(d,d.key))}</strong></div></div><p>${esc(d.analysis)}</p></div></details>`).join('')}</div></section>`).join('')}<section class="panel"><div class="panel-heading"><div><h2>E. Integritas & kepribadian kerja</h2><p>Respons skala 1–5; butir R menggunakan skor 6 − jawaban.</p></div></div><div class="personality-answers">${result.personality.dimensions.map(d => `<div><strong>${d.name}</strong><p>${d.details.map(item => `${item.id}${item.reversed ? ' (R)' : ''}: ${item.response ?? '—'}${item.reversed && item.response ? ` → ${6 - item.response}` : ''}`).join(' · ')}</p></div>`).join('')}<div><strong>Validitas jawaban</strong><p>E13: ${result.personality.validityAnswers[0] ?? '—'} · E14: ${result.personality.validityAnswers[1] ?? '—'}</p></div></div></section>`;
}
function interviewView(e) {
  return `<form id="interview-form"><section class="panel"><div class="panel-heading"><div><h2>Wawancara perilaku · STAR</h2><p>30 menit · cari contoh Situasi, Tugas, Aksi pribadi, dan Hasil yang konkret.</p></div>${badge(e.interviewSummary.complete ? `Rata-rata ${e.interviewSummary.average}/5` : 'Belum lengkap', e.interviewSummary.meetsMinimum ? 'green' : 'gray')}</div><div class="interview-list">${state.meta.interviews.map((q,i) => `<article class="interview-item"><span class="section-letter">${i+1}</span><div class="interview-body"><span class="eyebrow">${q.competency}</span><h3>${q.prompt}</h3><div class="interview-guidance"><p><strong>Bukti yang dicari</strong>${esc(q.strong)}</p><p><strong>Perlu diklarifikasi</strong>${esc(q.concern)}</p></div><div class="interview-fields"><label>Nilai (1–5)<select name="${q.id}-score"><option value="">Belum dinilai</option>${[1,2,3,4,5].map(n => `<option value="${n}" ${e.interview[q.id]?.score===n ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label>Catatan bukti perilaku<textarea name="${q.id}-note" rows="2" maxlength="4000" placeholder="Catat situasi, aksi pribadi, dan hasil…">${esc(e.interview[q.id]?.note || '')}</textarea></label></div></div></article>`).join('')}</div></section><section class="panel decision-panel"><div class="panel-heading"><div><h2>Catatan & keputusan penguji</h2><p>Rata-rata wawancara minimum 3 menurut panduan. Keputusan akhir tetap manual.</p></div></div><div class="decision-fields"><label>Keputusan<select name="decision">${Object.entries(decisionLabel).map(([id,label]) => `<option value="${id}" ${e.decision===id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Alasan dan tindak lanjut<textarea name="note" rows="4" maxlength="6000" placeholder="Catat pertimbangan dan tindak lanjut yang diperlukan…">${esc(e.note)}</textarea></label></div><div class="form-actions"><span class="muted">${e.reviewedAt ? 'Terakhir disimpan ' + dateTime(e.reviewedAt) : 'Catatan hanya dapat dilihat penguji.'}</span><button class="button primary" type="submit">${icon('check')} Simpan penilaian</button></div></section></form>`;
}

function showModal(title, body, footer = '') {
  const target = $('#modal-root');
  target.innerHTML = `<dialog class="modal"><div class="modal-heading"><h2>${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Tutup">${icon('close')}</button></div>${body}${footer ? `<div class="modal-footer">${footer}</div>` : ''}</dialog>`;
  const dialog = target.querySelector('dialog');
  dialog.addEventListener('cancel', () => { if (modalResolver) { modalResolver(false); modalResolver = null; } });
  dialog.showModal();
  // Read-only links remain selected only on explicit copy; focus the first editable field.
  dialog.querySelector('input:not([readonly]),button')?.focus();
}
function closeModal(answer = false) {
  $('#modal-root dialog')?.close(); $('#modal-root').innerHTML = '';
  if (modalResolver) { modalResolver(answer); modalResolver = null; }
}
function confirmAction(title, message, label = 'Lanjutkan', danger = false) {
  return new Promise(resolve => {
    modalResolver = resolve;
    showModal(title, `<p class="modal-description">${esc(message)}</p>`, `<button class="button secondary" data-action="close-modal">Batal</button><button class="button ${danger ? 'danger-solid' : 'primary'}" data-action="confirm-modal">${esc(label)}</button>`);
  });
}
function inviteModal(type = 'serviam') {
  const definition=state.meta.exams.find(e=>e.id===type) || state.meta.exams[0];
  showModal('Ujian baru · Buat undangan', `<p class="modal-description">Pilih ujian, isi peserta, lalu bagikan tautan pribadi. Satu undangan memakai satu bank soal dan aturan penilaian.</p><form id="invite-form" class="stack-form"><label>Jenis ujian<select name="examType" id="invite-exam-type">${state.meta.exams.map(e=>`<option value="${e.id}" ${e.id===definition.id?'selected':''}>${esc(e.label)}</option>`).join('')}</select></label><p id="invite-exam-summary" class="muted">${definition.count} butir · ${definition.minutes} menit · ${esc(definition.company)}</p><label>Nama peserta<input name="name" placeholder="Nama lengkap peserta" minlength="2" maxlength="80" required /></label><label>Email peserta <span class="optional">opsional</span><input name="email" type="email" placeholder="peserta@email.com" /></label><div class="form-two-col"><label>Posisi<select name="role" id="invite-role">${definition.roles.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></label><label>Masa berlaku<select name="expiryDays"><option value="7">7 hari</option><option value="1">1 hari</option><option value="14">14 hari</option><option value="30">30 hari</option></select></label></div><p class="form-error" id="invite-error" role="alert"></p><div class="modal-footer"><button class="button secondary" type="button" data-action="close-modal">Batal</button><button class="button primary" type="submit">Buat undangan ${icon('arrow')}</button></div></form>`);
}
function examsView() {
  return `${pageHead('UJIAN','Pilih ujian rekrutmen','Setiap paket mempunyai soal, waktu, posisi, dan analisis tersendiri.','<button class="button secondary" data-action="invite">Undang peserta</button><button class="button primary" data-action="exam-create">'+icon('plus')+' Tambah ujian</button>')}<div class="exam-catalog">${state.meta.exams.map(e=>`<section class="panel exam-catalog-card"><span class="eyebrow">${esc(e.company)}</span><h2>${esc(e.label)}</h2><p>${e.count} soal dan pernyataan · ${e.minutes} menit</p><div class="catalog-sections">${e.sections.map(s=>`<div><strong>${esc(s.short)}</strong><span>${s.minutes} menit${s.break?'':` · ${s.count} butir`}</span></div>`).join('')}</div><p>${state.exams.filter(x=>x.examType===e.id).length} undangan dibuat</p><button class="button primary" data-action="invite" data-exam-type="${e.id}">Buat undangan ${icon('plus')}</button>${e.custom?customSourceLinks(e):e.documents.length?`<details class="catalog-documents"><summary>Dokumen & panduan penguji</summary>${e.documents.map(d=>`<a href="/api/admin/source?examType=${encodeURIComponent(e.id)}&document=${encodeURIComponent(d)}" download>${esc(d)}</a>`).join('')}</details>`:'<p><a href="/api/admin/source" download>Dokumen sumber Serviam</a></p>'}</section>`).join('')}</div>`;
}

function invitationModal(path, name, publicOrigin) {
  const url = new URL(path, publicOrigin || location.origin).href;
  showModal('Undangan siap dibagikan', `<div class="invitation-success">${icon('checkCircle')}<h3>${esc(name)}</h3><p>Tautan hanya dapat dipakai untuk satu kesempatan ujian. Urutan soal diacak khusus untuk tautan ini.</p></div><label class="link-label">Tautan pribadi peserta<div class="copy-field"><input id="invitation-link" type="text" readonly value="${esc(url)}" /><button class="button secondary" data-action="copy-link" aria-label="Salin tautan">${icon('copy')} Copy link</button></div></label><div class="notice compact">${icon('shield')}<p>Simpan atau salin tautan sekarang. Aplikasi tidak menyimpan tautan asli. Membuat ulang tautan akan membatalkan tautan sebelumnya.</p></div>`, '<button class="button primary" data-action="close-modal">Selesai</button>');
}

function participantCompany() { return state.exam?.exam.company || state.invitation?.company || organizerName; }
function participantBrand() { const exam=state.exam?.exam || state.invitation; if(exam?.custom)return `<span class="workspace-avatar">${esc(exam.company.slice(0,2).toUpperCase())}</span><span class="brand-copy"><strong>Ujian rekrutmen</strong><span>${esc(exam.company)}</span></span>`; return (state.exam?.exam.examType || state.invitation?.examType || 'serviam')==='serviam' ? brand : '<img class="indo-logo" src="/indo-artha-logo.png" alt="Indo Artha Group"/><span class="brand-copy"><strong>DIVISI HR</strong><span>Indo Artha Group</span></span>'; }
function examHeader(name = '') { return `<header class="exam-topbar"><a class="brand dark" href="/">${participantBrand()}</a><span class="exam-secure">${icon('shield')} Asesmen pribadi</span>${name ? `<div class="exam-person"><span class="avatar small">${esc(initials(name))}</span><span>${esc(name)}</span></div>` : ''}</header>`; }
async function loadInvitation(rawToken) {
  const data = await api(`/api/invitations/${encodeURIComponent(rawToken)}`);
  if (data.resume) { setExam(data); return; }
  state.invitationToken = rawToken; state.invitation = data.invitation;
  updateParticipantIdentity(data.invitation);
  renderIntro(data);
}
function renderIntro(data) {
  app.innerHTML = `<div class="exam-layout">${examHeader(data.invitation.name)}<main class="intro-content"><span class="intro-badge">${icon('shield')} UNDANGAN UJIAN PRIBADI</span><h1>Halo, ${esc(data.invitation.name.split(' ')[0])}.<br>Mari kenali potensi Anda<span>.</span></h1><p class="intro-subtitle">Asesmen untuk posisi <strong>${esc(data.invitation.role)}</strong>.<br>Luangkan waktu di tempat yang tenang sebelum memulai.</p><div class="intro-facts"><div>${icon('file')}<strong>${data.invitation.questionCount || 48}</strong><span>soal & pernyataan</span></div><div>${icon('clock')}<strong>${data.invitation.minutes || 65} menit</strong><span>maksimal tes tertulis</span></div><div>${icon('shield')}<strong>1 kesempatan</strong><span>tidak dapat diulang</span></div></div><section class="panel intro-sections"><div class="panel-heading"><h2>Bagian asesmen Anda</h2></div>${data.sections.map((s,i) => `<div class="intro-section-row"><span class="section-letter">${s.id}</span><div><strong>${s.name}</strong><span>${s.break ? 'Istirahat sebelum Gaya Kerja' : s.count + (s.id==='E'||s.id==='M2' ? ' pernyataan' : ' soal')}</span></div><span>${s.minutes} menit</span></div>`).join('')}</section><section class="intro-instructions"><h3>Sebelum mulai</h3><ul><li>Tautan hanya dapat digunakan satu kali. Waktu berjalan sejak Anda menekan tombol mulai.</li><li>Jawaban disimpan otomatis. Jika koneksi terputus, lanjutkan dari browser yang sama selama waktu masih tersedia.</li><li>Urutan soal disusun khusus untuk tautan Anda dan tetap sama saat Anda melanjutkan ujian.</li><li>Setiap bagian memiliki batas waktu. Anda tidak bisa kembali ke bagian yang sudah selesai.</li><li>${data.invitation.custom?'Kerjakan mandiri dan ikuti instruksi setiap bagian.':'Kerjakan sendiri, tanpa kalkulator untuk bagian numerik. Jawablah pernyataan kepribadian dengan jujur.'}</li><li>Jawaban dan hasil hanya digunakan tim rekrutmen untuk penilaian internal. Ini bukan tes psikologi baku.</li></ul></section><form id="start-form"><label class="consent-label"><input type="checkbox" name="consent" required /><span>Saya telah membaca instruksi dan menyetujui pengolahan jawaban serta hasil asesmen oleh ${esc(participantCompany())} untuk proses seleksi.</span></label><button class="button primary start-button" type="submit">Mulai asesmen ${icon('arrow')}</button><small class="intro-expiry">Undangan berlaku sampai ${dateTime(data.invitation.expiresAt)}</small></form></main><footer class="exam-footer">${esc(participantCompany())} · Asesmen rekrutmen</footer></div>`;
}
function setExam(data) {
  const previousIndex = state.exam?.exam.sectionIndex;
  state.exam = data;
  updateParticipantIdentity(data.exam);
  clockOffset = data.exam.serverTime - Date.now();
  if (previousIndex !== data.exam.sectionIndex) { state.currentQuestion = 0; pendingAnswers = {}; }
  if (data.exam.status === 'completed') { clearInterval(pollTimer); clearInterval(tickTimer); renderComplete(data.exam); return; }
  renderExam();
  clearInterval(pollTimer); clearInterval(tickTimer);
  tickTimer = setInterval(updateTimer, 1000);
  pollTimer = setInterval(syncExam, 10_000);
  updateTimer();
}
async function syncExam(force = false) {
  if (state.syncing || state.transitioning || (!force && (savePromise || Object.keys(pendingAnswers).length))) return;
  state.syncing = true;
  try {
    const data = await api('/api/exam');
    clockOffset = data.exam.serverTime - Date.now();
    if (data.exam.status !== state.exam.exam.status || data.exam.sectionIndex !== state.exam.exam.sectionIndex) setExam(data);
    else updateTimer();
    const connection = $('#connection-status');
    if (connection) { connection.classList.remove('offline'); connection.innerHTML = icon('shield') + ' Sesi pribadi aktif'; }
  } catch (error) {
    const status = $('#connection-status');
    if (status) { status.classList.add('offline'); status.innerHTML = icon('alert') + ' Koneksi terputus · mencoba kembali'; }
    if (error.status === 401) renderExamError(error.message);
  } finally { state.syncing = false; }
}
function updateTimer() {
  if (!state.exam || state.exam.exam.status !== 'active') return;
  const seconds = Math.max(0, Math.ceil((state.exam.exam.deadline - (Date.now() + clockOffset)) / 1000));
  const timer = $('#timer');
  if (timer) { timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`; timer.parentElement.classList.toggle('urgent', seconds < 120); }
  if (seconds === 0 && !state.transitioning) {
    if (Object.keys(pendingAnswers).length) flushAnswers().catch(() => {});
    syncExam(true);
  }
}
function renderExam() {
  const { exam, questions, sections } = state.exam;
  const section = sections[exam.sectionIndex];
  if(section.break) { renderBreak(exam,section); return; }
  const q = questions[state.currentQuestion];
  const answer = pendingAnswers[q.id] ?? exam.answers[q.id];
  const answeredCount = questions.filter(q => (pendingAnswers[q.id] ?? exam.answers[q.id]) !== undefined && (pendingAnswers[q.id] ?? exam.answers[q.id]) !== '').length;
  app.innerHTML = `<div class="exam-layout">${examHeader(exam.name)}<div class="exam-workspace"><aside class="exam-sidebar"><span class="eyebrow">PERJALANAN ASESMEN</span><div class="exam-steps">${sections.map((s,i) => `<div class="exam-step ${i===exam.sectionIndex ? 'active' : i<exam.sectionIndex ? 'done' : ''}"><span class="step-letter">${i<exam.sectionIndex ? icon('check') : s.id}</span><div><strong>${s.short}</strong><span>${i<exam.sectionIndex ? 'Bagian selesai' : s.minutes + ' menit · ' + s.count + ' butir'}</span></div>${i===exam.sectionIndex ? '<span class="step-dot"></span>' : ''}</div>`).join('')}</div><div class="exam-side-note">${icon('lock')}<p>Bagian yang sudah selesai tidak dapat dibuka kembali.</p></div></aside><main class="exam-body"><div class="exam-section-heading"><div><span class="eyebrow">BAGIAN ${exam.sectionIndex+1} DARI ${sections.length}</span><h1>${section.name}</h1><p class="muted">${section.instruction}</p></div><div class="timer-box">${icon('clock')}<div><span>Sisa waktu bagian</span><strong id="timer">—:—</strong></div></div></div><div class="exam-progress-row"><span>Soal ${state.currentQuestion+1} dari ${questions.length}</span><span>${answeredCount}/${questions.length} terjawab</span></div><div class="exam-progress-track"><div style="width:${answeredCount/questions.length*100}%"></div></div><section class="panel question-card"><div class="question-eyebrow"><span class="question-number">${String(state.currentQuestion+1).padStart(2,'0')}</span><span>${section.id==='E' ? 'PERNYATAAN' : 'PERTANYAAN'}</span></div>${stimulusView(q)}<h2>${esc(q.prompt)}</h2>${q.kind==='choice' ? `<div class="answer-options">${q.options.map((option,i) => { const letter='ABCDE'[i]; return `<label class="answer-option ${answer===letter ? 'selected' : ''}"><input type="radio" name="answer" value="${letter}" data-question="${q.id}" ${answer===letter?'checked':''}/><span class="option-letter">${letter}</span><span>${esc(option)}</span><span class="option-check">${answer===letter ? icon('checkCircle') : ''}</span></label>`; }).join('')}</div>` : q.kind==='likert' ? `<div class="likert-options">${[1,2,3,4,5].map((n,i) => `<label class="likert-option ${answer===n?'selected':''}"><input type="radio" name="answer" data-question="${q.id}" value="${n}" ${answer===n?'checked':''}/><strong>${n}</strong><span>${esc(q.scale?.[i]?.label || ['Sangat tidak setuju','Tidak setuju','Netral','Setuju','Sangat setuju'][i])}</span></label>`).join('')}</div>` : `<label class="text-answer-label">Jawaban Anda<input id="text-answer" data-question="${q.id}" type="text" autocomplete="off" spellcheck="false" maxlength="120" placeholder="${q.kind==='numeric' ? 'Tuliskan angka atau jawaban akhir…' : 'Tuliskan jawaban Anda…'}" value="${esc(answer || '')}" /></label><p class="answer-hint">${q.kind==='numeric' ? 'Gunakan format angka yang biasa Anda pakai, misalnya 2.400.000 atau 58,5 juta.' : 'Isi jawaban singkat sesuai pertanyaan.'}</p>`}<div class="question-nav"><button class="button secondary" data-action="question-prev" ${state.currentQuestion===0?'disabled':''}>${icon('back')} Sebelumnya</button>${state.currentQuestion<questions.length-1 ? '<button class="button primary" data-action="question-next">Soal berikutnya ' + icon('arrow') + '</button>' : `<button class="button primary" data-action="section-next">${exam.sectionIndex===sections.length-1?'Kirim & akhiri ujian':'Selesaikan bagian '+section.id} ${icon('check')}</button>`}</div></section><div class="exam-save-row"><span id="connection-status">${icon('shield')} Sesi pribadi aktif</span><span id="save-status">${saveStatusText()}</span></div><div class="question-navigation"><span>Navigasi soal</span><div>${questions.map((question,i) => `<button class="question-chip ${i===state.currentQuestion?'current':''} ${(pendingAnswers[question.id]??exam.answers[question.id])!==undefined && (pendingAnswers[question.id]??exam.answers[question.id])!==''?'answered':''}" data-action="question-jump" data-index="${i}" aria-label="Soal ${i+1}" ${i===state.currentQuestion?'aria-current="step"':''}>${i+1}</button>`).join('')}</div></div></main></div></div>`;
  updateTimer();
}
function saveStatusText() { return state.saveState==='saving' ? icon('clock')+' Menyimpan jawaban…' : state.saveState==='error' ? icon('alert')+' Belum tersimpan · <button class="text-button" data-action="retry-save">Coba lagi</button>' : icon('checkCircle')+' Jawaban tersimpan otomatis'; }
function updateSaveStatus(status) { state.saveState=status; if ($('#save-status')) { $('#save-status').innerHTML=saveStatusText(); $('#save-status').className=status==='error'?'text-amber':''; } }
function queueAnswer(id, value) {
  pendingAnswers[id] = value;
  state.exam.exam.answers[id] = value;
  updateSaveStatus('saving');
  updateResponseUI();
  clearTimeout(autosaveTimeout);
  autosaveTimeout=setTimeout(() => { flushAnswers().catch(()=>{}); }, 350);
}
function updateResponseUI() {
  const { questions, exam } = state.exam;
  const answered = questions.filter(q => exam.answers[q.id] !== undefined && exam.answers[q.id] !== '').length;
  const progress = $('.exam-progress-row span:last-child');
  if (progress) progress.textContent = `${answered}/${questions.length} terjawab`;
  const track = $('.exam-progress-track > div');
  if (track) track.style.width = `${answered/questions.length*100}%`;
  document.querySelectorAll('.answer-option, .likert-option').forEach(label => {
    const checked = label.querySelector('input').checked;
    label.classList.toggle('selected', checked);
    const mark = label.querySelector('.option-check');
    if (mark) mark.innerHTML = checked ? icon('checkCircle') : '';
  });
  document.querySelectorAll('.question-chip').forEach((chip, i) => {
    const response = exam.answers[questions[i].id];
    chip.classList.toggle('answered', response !== undefined && response !== '');
  });
}
async function flushAnswers() {
  clearTimeout(autosaveTimeout);
  if (savePromise) await savePromise;
  if (!Object.keys(pendingAnswers).length) return;
  const answers = { ...pendingAnswers };
  pendingAnswers={};
  const section = state.exam.sections[state.exam.exam.sectionIndex].id;
  updateSaveStatus('saving');
  savePromise = (async () => {
    try { await api('/api/exam/answers','PATCH',{ section, answers }); updateSaveStatus('saved'); }
    catch(error) {
      if (error.status===409 || error.status===410) {
        const data=await api('/api/exam'); pendingAnswers={}; setExam(data); toast('Waktu bagian selesai. Jawaban terakhir yang tersimpan digunakan.',true);
      } else { pendingAnswers={ ...answers, ...pendingAnswers }; updateSaveStatus('error'); throw error; }
    } finally { savePromise=null; }
  })();
  await savePromise;
  if (Object.keys(pendingAnswers).length) await flushAnswers();
}
async function nextSection() {
  const sectionIndex = state.exam.exam.sectionIndex;
  const section = state.exam.sections[sectionIndex];
  const unanswered=state.exam.questions.filter(q => state.exam.exam.answers[q.id]===undefined || state.exam.exam.answers[q.id]==='').length;
  const message = `${unanswered ? `${unanswered} soal belum dijawab. ` : ''}${sectionIndex===state.exam.sections.length-1 ? 'Jawaban akan dikirim dan ujian tidak dapat diulang.' : 'Setelah melanjutkan, jawaban pada bagian ini tidak dapat diubah.'}`;
  if (!await confirmAction(sectionIndex===state.exam.sections.length-1?'Kirim hasil ujian?':`Selesaikan bagian ${section.id}?`, message, sectionIndex===state.exam.sections.length-1?'Kirim & akhiri':'Lanjut ke bagian berikutnya')) return;
  state.transitioning=true;
  try {
    await flushAnswers();
    if (state.exam.exam.status!=='active' || state.exam.exam.sectionIndex!==sectionIndex) return;
    setExam(await api('/api/exam/next','POST',{section:section.id}));
  } finally { state.transitioning=false; }
}
function renderComplete(exam) {
  app.innerHTML=`<div class="exam-layout">${examHeader(exam.name)}<main class="completion-content"><div class="completion-icon">${icon('check')}</div><span class="eyebrow">ASESMEN SELESAI</span><h1>Terima kasih,<br>${esc(exam.name.split(' ')[0])}<span>.</span></h1><p>Jawaban Anda sudah tersimpan dan diteruskan kepada penguji.<br>Tim rekrutmen akan meninjau hasil dan menghubungi Anda untuk proses berikutnya.</p><div class="completion-receipt"><span>${icon('checkCircle')} Ujian berhasil diselesaikan</span><strong>${dateTime(exam.finishedAt)}</strong><small>Setiap peserta hanya memiliki satu kesempatan ujian.</small></div><p class="muted">Anda dapat menutup halaman ini.</p><div class="brand dark completion-brand">${participantBrand()}</div></main></div>`;
}
function renderExamError(message) {
  clearInterval(pollTimer); clearInterval(tickTimer);
  app.innerHTML=`<div class="exam-layout">${examHeader()}<main class="completion-content"><div class="completion-icon warning">${icon('lock')}</div><span class="eyebrow">AKSES UJIAN</span><h1>Akses tidak tersedia<span>.</span></h1><p>${esc(message)}</p><div class="notice">${icon('mail')}<p>Hubungi penguji jika Anda memerlukan bantuan. Tautan yang sudah digunakan tidak memberikan kesempatan ujian baru.</p></div></main></div>`;
}

app.addEventListener('input', event => {
  const field=event.target;
  if (field.id==='search') {
    state.search=field.value;
    const exams=state.exams.filter(e => (state.filter==='all'||e.status===state.filter)&&`${e.name} ${e.email} ${(e.roleName || roleName(e.role))} ${e.examLabel || ''}`.toLocaleLowerCase('id-ID').includes(state.search.toLocaleLowerCase('id-ID')));
    $('#participant-results').innerHTML=participantTable(exams);
    $('.table-footer').innerHTML=`${exams.length} peserta ditampilkan <span>Undangan tidak dikirim otomatis; bagikan tautan secara pribadi.</span>`;
  }
  if (field.id==='text-answer') queueAnswer(field.dataset.question,field.value);
});
app.addEventListener('change', event => {
  const field=event.target;
  if(field.id==='invite-exam-type') {
    const d=state.meta.exams.find(e=>e.id===field.value);
    $('#invite-role').innerHTML=d.roles.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('');
    $('#invite-exam-summary').textContent=`${d.count} butir · ${d.minutes} menit · ${d.company}`;
  }
  if (field.matches('input[type="radio"][data-question]')) {
    const q=state.exam.questions.find(q=>q.id===field.dataset.question);
    queueAnswer(q.id,q.kind==='likert'?Number(field.value):field.value);
  }
});
document.addEventListener('click', async event => {
  const target=event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action=target.dataset.action;
  try {
    if (action==='view') {
      if (target.dataset.view === 'users') state.users = (await api('/api/admin/users')).users;
      if (target.dataset.view === 'system') { const [system, audit] = await Promise.all([api('/api/admin/system'), api('/api/admin/audit')]); state.system = system; state.audit = audit.audit; }
      setView(target.dataset.view);
    }
    if (action === 'password') renderPasswordChange();
    if (action === 'user-add') userModal();
    if (action === 'user-edit') userModal(state.users.find(user => user.id === target.dataset.id));
    if (action==='menu') $('.sidebar').classList.toggle('mobile-open');
    if(action==='exam-create')setView('exam-builder');
    if (action==='invite') inviteModal(target.dataset.examType || 'serviam');
    if (action==='filter') { state.filter=target.dataset.filter; renderAdmin(); }
    if (action==='detail') await openDetail(target.dataset.id);
    if (action==='refresh-detail') { state.detail=(await api(`/api/admin/exams/${state.detail.id}`)).exam; renderAdmin(); }
    if (action==='detail-tab') {
      if (state.detailTab==='interview' && $('#interview-form')?.dataset.dirty==='true' && !await confirmAction('Catatan belum disimpan', 'Catatan wawancara Anda belum disimpan. Tetap berpindah tab?', 'Tinggalkan tab')) return;
      state.detailTab=target.dataset.tab; renderAdmin();
    }
    if (action==='logout') { await api('/api/logout','POST',{}); state.user=null; state.view='dashboard'; state.users=[]; state.audit=[]; state.system=null; state.exams=[]; state.detail=null; navigate('/'); }
    if (action==='close-modal') closeModal(false);
    if (action==='confirm-modal') closeModal(true);
    if (action==='copy-link') {
      const input=$('#invitation-link');
      try { await navigator.clipboard.writeText(input.value); toast('Tautan disalin. Bagikan secara pribadi kepada peserta.'); }
      catch { input.focus(); input.select(); toast('Tautan dipilih. Gunakan salin pada perangkat Anda.'); }
    }
    if (action==='rotate') {
      if (!await confirmAction('Buat ulang tautan?', 'Tautan sebelumnya tidak akan berlaku. Tautan baru berlaku selama 7 hari.', 'Buat tautan baru')) return;
      const data=await api(`/api/admin/exams/${state.detail.id}/rotate`,'POST',{});
      invitationModal(data.invitationPath,state.detail.name,data.publicOrigin);
    }
    if (action==='delete') {
      if (!await confirmAction('Hapus data peserta?', 'Undangan, jawaban, nilai, dan catatan wawancara peserta ini akan dihapus secara permanen.', 'Hapus data',true)) return;
      await api(`/api/admin/exams/${state.detail.id}`,'DELETE');
      state.exams=(await api('/api/admin/exams')).exams; setView('participants'); toast('Data peserta dihapus.');
    }
    if (['question-prev','question-next','question-jump'].includes(action)) {
      if (state.navigating) return;
      state.navigating = true;
      const sectionIndex=state.exam.exam.sectionIndex;
      const next=action==='question-jump'?Number(target.dataset.index):state.currentQuestion+(action==='question-prev'?-1:1);
      // Navigation within a section remains possible during a connection failure; retry before closing it.
      try {
        try { await flushAnswers(); } catch { toast('Jawaban belum tersimpan. Akan dicoba lagi; jangan tutup browser.',true); }
        if (state.exam.exam.sectionIndex===sectionIndex && state.exam.exam.status==='active') { state.currentQuestion=next; renderExam(); }
      } finally { state.navigating = false; }
    }
    if (action==='section-next') await nextSection();
    if (action==='retry-save') await flushAnswers();
  } catch(error) { toast(error.message,true); }
});
document.addEventListener('input', event => { if (event.target.closest('#interview-form')) $('#interview-form').dataset.dirty='true'; });
document.addEventListener('change', event => { if (event.target.closest('#interview-form')) $('#interview-form').dataset.dirty='true'; });
document.addEventListener('submit', async event => {
  const form=event.target;
  if (!['login-form','setup-form','invite-form','start-form','interview-form','password-form','user-form','user-edit-form'].includes(form.id)) return;
  event.preventDefault();
  const button=form.querySelector('button[type="submit"]');
  button.disabled=true;
  const data=Object.fromEntries(new FormData(form));
  try {
    if (form.id==='login-form' || form.id==='setup-form') {
      $('#auth-error').textContent='';
      await api(form.id==='login-form'?'/api/login':'/api/setup','POST',data);
      navigate('/penguji');
    }
    if (form.id === 'password-form') {
      if (data.password !== data.confirmPassword) throw new Error('Kata sandi baru tidak sama.');
      await api('/api/admin/password','POST',{currentPassword:data.currentPassword,password:data.password});
      navigate('/penguji');
    }
    if (form.id === 'user-form' || form.id === 'user-edit-form') {
      const editing = form.id === 'user-edit-form';
      await api(editing ? '/api/admin/users/' + form.dataset.id : '/api/admin/users', editing ? 'PATCH' : 'POST', editing ? {role:data.role,active:data.active === 'true',...(data.password ? {password:data.password} : {})} : data);
      closeModal();
      if (editing && form.dataset.id === state.user.id) { navigate('/'); return; }
      state.users = (await api('/api/admin/users')).users;
      setView('users'); toast('Akun berhasil disimpan.');
    }
    if (form.id==='invite-form') {
      const result=await api('/api/admin/exams','POST',{...data,expiryDays:Number(data.expiryDays)});
      state.exams=(await api('/api/admin/exams')).exams; renderAdmin(); invitationModal(result.invitationPath,result.exam.name,result.publicOrigin);
    }
    if (form.id==='start-form') {
      const result=await api('/api/exam/start','POST',{token:state.invitationToken,consent:data.consent==='on'});
      history.replaceState({},'',`/ujian/${state.invitationToken}`); setExam(result);
    }
    if (form.id==='interview-form') {
      const interview={};
      (state.detail.examType==='serviam' || !state.detail.examType ? state.meta.interviews : []).forEach(q => { interview[q.id]={score:data[`${q.id}-score`]?Number(data[`${q.id}-score`]):null,note:data[`${q.id}-note`]}; });
      state.detail=(await api(`/api/admin/exams/${state.detail.id}`,'PATCH',{interview,note:data.note,decision:data.decision})).exam;
      state.exams=(await api('/api/admin/exams')).exams; renderAdmin(); toast('Penilaian dan keputusan penguji tersimpan.');
    }
  } catch(error) {
    const errorBox=form.querySelector('.form-error');
    if(errorBox) errorBox.textContent=error.message; else toast(error.message,true);
  } finally { button.disabled=false; }
});

async function route() {
  clearInterval(pollTimer); clearInterval(tickTimer);
  closeModal();
  const path=location.pathname;
  if (state.saveState==='saving' || Object.keys(pendingAnswers).length) { try { await flushAnswers(); } catch {} }
  if (path.startsWith('/ujian')) {
    try {
      const rawToken=path.split('/')[2];
      if(rawToken) await loadInvitation(rawToken); else setExam(await api('/api/exam'));
    } catch(error) { renderExamError(error.message); }
    return;
  }
  try {
    const status=await api('/api/status');
    if (!status.configured) { renderLogin(false); return; }
    try { await loadAdmin(); }
    catch(error) { if (error.status===401) { renderLogin(); return; } throw error; }
    if (state.user.mustChangePassword) { renderPasswordChange(); return; }
    if(path.includes('/hasil/')) state.detail=(await api(`/api/admin/exams/${path.split('/').at(-1)}`)).exam;
    else state.detail=null;
    if(path==='/') history.replaceState({},'', '/penguji');
    renderAdmin();
    pollTimer=setInterval(()=>refreshAdmin().catch(()=>{}),15_000);
  } catch(error) {
    app.innerHTML=`<main class="completion-content"><h1>Aplikasi belum dapat dimuat.</h1><p>${esc(error.message)}</p><a class="button primary" href="/">Muat ulang</a></main>`;
  }
}
window.addEventListener('popstate',route);
window.addEventListener('online',()=>{ if(state.exam?.exam.status==='active') flushAnswers().then(syncExam).catch(()=>{}); });
window.addEventListener('beforeunload',event=>{
  if(builderHasUnsaved() || Object.keys(pendingAnswers).length || savePromise || $('#interview-form')?.dataset.dirty==='true') { event.preventDefault(); event.returnValue=''; }
});
route();

function renderBreak(exam,section) {
  app.innerHTML=`<div class="exam-layout">${examHeader(exam.name)}<main class="completion-content"><span class="eyebrow">INDO ARTHA GROUP · JEDA ISTIRAHAT</span><h1>Waktunya istirahat</h1><p>${esc(section.instruction)}</p><div class="timer-box"><span>Sisa waktu jeda</span><strong id="timer">—:—</strong></div><p>Jawaban sebelumnya sudah tersimpan. Gaya Kerja akan terbuka otomatis setelah jeda.</p><span id="connection-status">Sesi pribadi aktif</span></main></div>`;
}

function updateParticipantIdentity(exam) {
  document.title = `${exam.company} · Ujian Rekrutmen`;
  document.querySelector('link[rel="icon"]').href = exam.custom ? '/favicon.svg' : exam.examType === 'serviam' ? '/serviam-logo.svg' : '/indo-artha-logo.png';
}

function customSourceLinks(exam) {
  return exam.sources?.length ? `<details class="catalog-documents"><summary>Dokumen sumber penguji (${exam.sources.length})</summary>${exam.sources.map(s=>`<a href="/api/admin/templates/${encodeURIComponent(exam.id)}/sources/${encodeURIComponent(s.id)}" download>${esc(s.name)}</a>`).join('')}</details>` : '<p class="muted">Ujian buatan penguji</p>';
}
