/* ============================================================
   MEMORY VAULT — Home Page Script
   Handles: cosmic background, cursor, vault CRUD, modals,
   portal transition, floating quotes, ambient music
   ============================================================ */

// ---------- STORAGE HELPERS ----------
const STORE_KEY = 'memory_vaults_v1';
const loadVaults = () => JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
const saveVaults = (v) => localStorage.setItem(STORE_KEY, JSON.stringify(v));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ---------- PASSWORD HASHING (PBKDF2 via Web Crypto) ----------
const PBKDF2_ITERS = 150000;
const toHex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
async function derivePwdHash(password, saltBytes, iters = PBKDF2_ITERS) {
  const enc = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: iters, hash: 'SHA-256' },
    key, 256
  );
  return toHex(bits);
}
async function hashNewPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePwdHash(password, salt);
  return { salt: toHex(salt), hash, iters: PBKDF2_ITERS };
}
async function verifyPassword(password, vault) {
  // Legacy plaintext fallback: silently upgrade to hashed form on successful match
  if (vault.password && !vault.pwd) {
    if (password !== vault.password) return false;
    const upgraded = await hashNewPassword(password);
    updateVaultById(vault.id, (v) => { delete v.password; v.pwd = upgraded; return v; });
    return true;
  }
  if (!vault.pwd) return false;
  const salt = fromHex(vault.pwd.salt);
  const hash = await derivePwdHash(password, salt, vault.pwd.iters || PBKDF2_ITERS);
  // constant-time-ish compare
  if (hash.length !== vault.pwd.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ vault.pwd.hash.charCodeAt(i);
  return diff === 0;
}
function updateVaultById(id, updater) {
  const vaults = loadVaults();
  const i = vaults.findIndex(v => v.id === id);
  if (i < 0) return;
  vaults[i] = updater(vaults[i]);
  saveVaults(vaults);
}
function markUnlocked(id) {
  try { sessionStorage.setItem('mv_unlocked_' + id, String(Date.now())); } catch {}
}

// ---------- COSMIC BACKGROUND ----------
function initStars() {
  const c = document.getElementById('stars');
  const ctx = c.getContext('2d');
  let stars = [];
  const resize = () => {
    c.width = innerWidth; c.height = innerHeight;
    stars = Array.from({ length: 180 }, () => ({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      r: Math.random() * 1.4 + 0.2,
      a: Math.random(),
      s: Math.random() * 0.02 + 0.005,
    }));
  };
  resize(); addEventListener('resize', resize);
  (function loop() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of stars) {
      s.a += s.s; if (s.a > 1 || s.a < 0) s.s *= -1;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${s.a * 0.9})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(loop);
  })();
}

function initDust() {
  const c = document.getElementById('dust');
  const ctx = c.getContext('2d');
  let parts = [];
  const resize = () => {
    c.width = innerWidth; c.height = innerHeight;
    parts = Array.from({ length: 60 }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 0.5,
    }));
  };
  resize(); addEventListener('resize', resize);
  (function loop() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > c.width) p.vx *= -1;
      if (p.y < 0 || p.y > c.height) p.vy *= -1;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
      g.addColorStop(0, 'rgba(179,136,255,0.5)');
      g.addColorStop(1, 'rgba(179,136,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(loop);
  })();
}

function initShootingStars() {
  const c = document.getElementById('shooting');
  const ctx = c.getContext('2d');
  const resize = () => { c.width = innerWidth; c.height = innerHeight; };
  resize(); addEventListener('resize', resize);
  const shots = [];
  const spawn = () => {
    shots.push({
      x: Math.random() * c.width, y: -20,
      vx: 6 + Math.random() * 6, vy: 6 + Math.random() * 6,
      life: 1,
    });
    setTimeout(spawn, 2200 + Math.random() * 3500);
  };
  spawn();
  (function loop() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.x += s.vx; s.y += s.vy; s.life -= 0.012;
      const tailX = s.x - s.vx * 12, tailY = s.y - s.vy * 12;
      const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
      grad.addColorStop(0, 'rgba(179,136,255,0)');
      grad.addColorStop(1, `rgba(255,255,255,${s.life})`);
      ctx.strokeStyle = grad; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(s.x, s.y); ctx.stroke();
      if (s.life <= 0 || s.y > c.height) shots.splice(i, 1);
    }
    requestAnimationFrame(loop);
  })();
}

// ---------- CURSOR ----------
function initCursor() {
  if (matchMedia('(max-width: 720px)').matches) return;
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  let mx = 0, my = 0, rx = 0, ry = 0;
  addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    if (Math.random() > 0.7) spark(mx, my);
  });
  (function loop() {
    rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  })();
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('button, a, .vault-card, .file-drop, input, textarea, select')) {
      ring.style.width = '60px'; ring.style.height = '60px';
      ring.style.borderColor = 'rgba(179,136,255,0.9)';
    } else {
      ring.style.width = '38px'; ring.style.height = '38px';
      ring.style.borderColor = 'rgba(179,136,255,0.5)';
    }
  });
}
function spark(x, y) {
  const s = document.createElement('div');
  s.className = 'spark';
  s.style.left = x + 'px'; s.style.top = y + 'px';
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 800);
}

// ---------- TYPEWRITER ----------
function initTypewriter() {
  const el = document.querySelector('.hero-sub');
  const lines = [
    'A cinematic archive of the moments you live for.',
    'Lock your memories in stars. Unlock them in light.',
    'Every vault hides a story waiting to be remembered.',
  ];
  let li = 0, ci = 0, deleting = false;
  function tick() {
    const line = lines[li];
    if (!deleting) {
      el.innerHTML = line.slice(0, ++ci) + '<span class="cursor-blink">&nbsp;</span>';
      if (ci === line.length) { deleting = true; return setTimeout(tick, 2400); }
    } else {
      el.innerHTML = line.slice(0, --ci) + '<span class="cursor-blink">&nbsp;</span>';
      if (ci === 0) { deleting = false; li = (li + 1) % lines.length; }
    }
    setTimeout(tick, deleting ? 30 : 55);
  }
  tick();
}

// ---------- FLOATING QUOTES ----------
const QUOTES = [
  'Some memories never fade ✨',
  'Lost moments live forever 🌌',
  'Every vault hides a story 🔐',
  'The stars remember what we forget 🌠',
  'Quiet light. Loud feelings. 💫',
];
function spawnQuote() {
  const q = document.createElement('div');
  q.className = 'floating-quote';
  q.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  q.style.left = (10 + Math.random() * 80) + 'vw';
  q.style.top = (60 + Math.random() * 30) + 'vh';
  document.body.appendChild(q);
  setTimeout(() => q.remove(), 18000);
}

// ---------- VAULT CARDS ----------
function renderVaults() {
  const grid = document.getElementById('vaultsGrid');
  const vaults = loadVaults();
  if (!vaults.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>Your cosmos is empty</h3>
        <p>Create your first vault to begin archiving memories among the stars.</p>
      </div>`;
    return;
  }
  grid.innerHTML = vaults.map((v, i) => `
    <article class="vault-card" data-id="${v.id}" style="animation-delay:${i * 80}ms; transform: translateY(30px);">
      <div class="vault-cover" style="background-image:url('${v.cover || ''}')"></div>
      <div class="vault-glow"></div>
      <button class="vault-delete" data-delete="${v.id}" title="Delete vault">✕</button>
      <div class="vault-body">
        <div class="vault-meta">${(v.memories || []).length} memories</div>
        <h3 class="vault-title">${escapeHtml(v.title)}</h3>
        <button class="vault-unlock" data-unlock="${v.id}">Unlock →</button>
      </div>
    </article>
  `).join('');
  bindVaultTilt();
}

function bindVaultTilt() {
  document.querySelectorAll('.vault-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(1000px) rotateY(${px * 10}deg) rotateX(${-py * 10}deg) translateY(-6px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateY(0) rotateX(0)';
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ---------- MODALS ----------
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ---------- COVER UPLOAD ----------
function bindFileDrop(dropId, inputId, onLoad) {
  const drop = document.getElementById(dropId);
  const input = document.getElementById(inputId);
  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const f = input.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      drop.classList.add('has-file');
      drop.innerHTML = `<img src="${reader.result}" alt="cover preview" /><p style="margin-top:10px">Tap to change</p>`;
      onLoad(reader.result);
    };
    reader.readAsDataURL(f);
  });
}

// ---------- CREATE VAULT ----------
let pendingCover = '';
function setupCreate() {
  bindFileDrop('coverDrop', 'coverInput', (data) => { pendingCover = data; });
  document.getElementById('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('vaultTitle').value.trim();
    const pwd = document.getElementById('vaultPwd').value;
    if (!title || !pwd) return;
    const pwdRecord = await hashNewPassword(pwd);
    const vaults = loadVaults();
    const id = uid();
    vaults.unshift({ id, title, pwd: pwdRecord, cover: pendingCover, memories: [], createdAt: Date.now() });
    saveVaults(vaults);
    markUnlocked(id);
    pendingCover = '';
    e.target.reset();
    document.getElementById('coverDrop').classList.remove('has-file');
    document.getElementById('coverDrop').innerHTML = '<p>Click to upload a vault cover</p><p style="font-size:0.78rem;opacity:0.6;margin-top:6px">PNG · JPG · WEBP</p>';
    closeModal('createModal');
    renderVaults();
    toast('Vault created ✨');
  });
}

// ---------- UNLOCK ----------
let unlockId = null;
function setupUnlock() {
  document.getElementById('unlockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = document.getElementById('unlockPwd').value;
    const vault = loadVaults().find(v => v.id === unlockId);
    if (!vault) return;
    const ok = await verifyPassword(pwd, vault);
    if (!ok) {
      toast('Wrong password ✗');
      return;
    }
    closeModal('unlockModal');
    document.getElementById('unlockPwd').value = '';
    markUnlocked(vault.id);
    runPortal(() => { location.href = `/vault.html?id=${vault.id}`; });
  });
}

function runPortal(done) {
  const p = document.getElementById('portal');
  p.classList.add('open');
  setTimeout(done, 1800);
}

// ---------- TOAST ----------
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ---------- MUSIC ----------
function setupMusic() {
  const btn = document.getElementById('musicBtn');
  const audio = document.getElementById('ambient');
  audio.volume = 0.35;
  // attempt autoplay
  const tryPlay = () => audio.play().then(() => btn.classList.add('playing')).catch(() => {});
  tryPlay();
  document.addEventListener('click', tryPlay, { once: true });
  btn.addEventListener('click', () => {
    if (audio.paused) { audio.play(); btn.classList.add('playing'); btn.textContent = '♪'; }
    else { audio.pause(); btn.classList.remove('playing'); btn.textContent = '♫'; }
  });
}

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', () => {
  initStars(); initDust(); initShootingStars(); initCursor();
  initTypewriter(); setupCreate(); setupUnlock(); setupMusic();
  renderVaults();
  setInterval(spawnQuote, 7000);
  setTimeout(spawnQuote, 2000);

  document.getElementById('newVaultBtn').addEventListener('click', () => openModal('createModal'));
  document.getElementById('heroCreate').addEventListener('click', () => openModal('createModal'));
  document.getElementById('heroScroll').addEventListener('click', () => {
    document.getElementById('vaultsSection').scrollIntoView({ behavior: 'smooth' });
  });
  document.querySelectorAll('[data-close]').forEach(b => {
    b.addEventListener('click', () => closeModal(b.dataset.close));
  });
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', (e) => { if (e.target === bd) bd.classList.remove('open'); });
  });

  document.getElementById('vaultsGrid').addEventListener('click', (e) => {
    const unlock = e.target.closest('[data-unlock]');
    const del = e.target.closest('[data-delete]');
    if (unlock) {
      unlockId = unlock.dataset.unlock;
      openModal('unlockModal');
    }
    if (del) {
      if (!confirm('Delete this vault and all its memories?')) return;
      saveVaults(loadVaults().filter(v => v.id !== del.dataset.delete));
      renderVaults(); toast('Vault dissolved into the void');
    }
  });
});
