/* MEMORY VAULT — Per-vault memory page */

const STORE_KEY = 'memory_vaults_v1';
const loadVaults = () => JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
const saveVaults = (v) => localStorage.setItem(STORE_KEY, JSON.stringify(v));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const params = new URLSearchParams(location.search);
const vaultId = params.get('id');

// ---------- ACCESS GATE ----------
// Require that the user successfully unlocked this vault in the current
// browser session before exposing any memories. Without this check, anyone
// who knows or guesses a vault id could load /vault.html?id=... directly.
if (!vaultId || sessionStorage.getItem('mv_unlocked_' + vaultId) === null) {
  location.replace('/app.html');
  throw new Error('Vault not unlocked in this session');
}

function getVault() { return loadVaults().find(v => v.id === vaultId); }
function updateVault(updater) {
  const vaults = loadVaults();
  const i = vaults.findIndex(v => v.id === vaultId);
  if (i < 0) return;
  vaults[i] = updater(vaults[i]);
  saveVaults(vaults);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

const MOODS = [
  { id: 'happy', label: '😄 Happy' },
  { id: 'emotional', label: '🌧️ Emotional' },
  { id: 'fun', label: '🎮 Fun' },
  { id: 'sad', label: '💔 Sad' },
  { id: 'nostalgic', label: '✨ Nostalgic' },
];

// ---------- BACKGROUND (reuse compact versions) ----------
function initStars() {
  const c = document.getElementById('stars'); const ctx = c.getContext('2d');
  let s = [];
  const r = () => {
    c.width = innerWidth; c.height = innerHeight;
    s = Array.from({ length: 160 }, () => ({ x: Math.random()*c.width, y: Math.random()*c.height, r: Math.random()*1.4+0.2, a: Math.random(), s: Math.random()*0.02+0.005 }));
  }; r(); addEventListener('resize', r);
  (function loop(){ ctx.clearRect(0,0,c.width,c.height); for (const p of s){ p.a+=p.s; if(p.a>1||p.a<0) p.s*=-1; ctx.beginPath(); ctx.fillStyle=`rgba(255,255,255,${p.a*0.9})`; ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); } requestAnimationFrame(loop); })();
}
function initDust() {
  const c = document.getElementById('dust'); const ctx = c.getContext('2d'); let p=[];
  const r = () => { c.width=innerWidth; c.height=innerHeight; p = Array.from({length:50}, () => ({ x: Math.random()*c.width, y: Math.random()*c.height, vx:(Math.random()-0.5)*0.3, vy:(Math.random()-0.5)*0.3, r: Math.random()*2+0.5 })); }; r(); addEventListener('resize', r);
  (function loop(){ ctx.clearRect(0,0,c.width,c.height); for(const x of p){ x.x+=x.vx; x.y+=x.vy; if(x.x<0||x.x>c.width) x.vx*=-1; if(x.y<0||x.y>c.height) x.vy*=-1; const g=ctx.createRadialGradient(x.x,x.y,0,x.x,x.y,x.r*6); g.addColorStop(0,'rgba(179,136,255,0.5)'); g.addColorStop(1,'rgba(179,136,255,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x.x,x.y,x.r*6,0,Math.PI*2); ctx.fill(); } requestAnimationFrame(loop); })();
}
function initCursor() {
  if (matchMedia('(max-width: 720px)').matches) return;
  const d = document.querySelector('.cursor-dot'), r = document.querySelector('.cursor-ring');
  let mx=0,my=0,rx=0,ry=0;
  addEventListener('mousemove', e => { mx=e.clientX; my=e.clientY; d.style.transform=`translate(${mx}px,${my}px) translate(-50%,-50%)`; if (Math.random()>0.75) { const s=document.createElement('div'); s.className='spark'; s.style.left=mx+'px'; s.style.top=my+'px'; document.body.appendChild(s); setTimeout(()=>s.remove(),800); } });
  (function l(){ rx+=(mx-rx)*0.18; ry+=(my-ry)*0.18; r.style.transform=`translate(${rx}px,${ry}px) translate(-50%,-50%)`; requestAnimationFrame(l); })();
}

// ---------- TOAST ----------
function toast(msg) { const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),3000); }

// ---------- RENDER VAULT HEADER ----------
function renderHeader(vault) {
  document.getElementById('vaultName').textContent = vault.title;
  document.getElementById('vaultCount').textContent = `${(vault.memories || []).length} memories archived`;
  if (vault.cover) document.getElementById('vaultCoverImg').src = vault.cover;
  document.title = `${vault.title} — Memory Vault`;
}

// ---------- RENDER TIMELINE ----------
function renderTimeline() {
  const vault = getVault();
  if (!vault) {
    document.querySelector('.timeline').innerHTML = '<p style="text-align:center;color:var(--muted)">Vault not found.</p>';
    return;
  }
  renderHeader(vault);

  const q = (document.getElementById('searchInput').value || '').toLowerCase();
  const moodFilter = document.getElementById('moodFilter').value;

  let mems = vault.memories || [];
  if (q) mems = mems.filter(m => (m.caption || '').toLowerCase().includes(q));
  if (moodFilter) mems = mems.filter(m => m.mood === moodFilter);

  // group by year (desc)
  const byYear = {};
  mems.forEach(m => {
    const y = (m.date || '').slice(0, 4) || 'Undated';
    (byYear[y] = byYear[y] || []).push(m);
  });
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));

  const root = document.getElementById('timeline');
  if (!years.length) {
    root.innerHTML = `<div class="empty-state"><h3>No memories yet</h3><p>Tap the glowing + button to add your first memory.</p></div>`;
    return;
  }
  root.innerHTML = years.map((y, yi) => `
    <section class="year-block" style="animation-delay:${yi*100}ms">
      <div class="year-head">
        <h2>${escapeHtml(y)}</h2>
        <div class="year-line"></div>
      </div>
      <div class="masonry">
        ${byYear[y].map((m, mi) => `
          <article class="memory-card" data-id="${m.id}" style="animation-delay:${mi*60}ms">
            ${m.image ? `<img src="${m.image}" alt="memory"/>` : ''}
            <button class="memory-delete" data-del="${m.id}" title="Delete memory">✕</button>
            <div class="memory-body">
              ${m.mood ? `<div class="memory-mood">${escapeHtml(MOODS.find(x=>x.id===m.mood)?.label || m.mood)}</div>` : ''}
              <p class="memory-caption">${escapeHtml(m.caption || '')}</p>
              <p class="memory-date">${escapeHtml(m.date || '')}</p>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `).join('');
}

// ---------- ADD MEMORY ----------
let pendingImage = '';
function setupAddMemory() {
  // populate mood selects
  const optsHtml = MOODS.map(m => `<option value="${m.id}">${m.label}</option>`).join('');
  document.getElementById('moodSelect').innerHTML = `<option value="">Choose a mood</option>${optsHtml}`;
  document.getElementById('moodFilter').innerHTML = `<option value="">All moods</option>${optsHtml}`;

  const drop = document.getElementById('memDrop');
  const input = document.getElementById('memImage');
  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const f = input.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { pendingImage = r.result; drop.classList.add('has-file'); drop.innerHTML = `<img src="${r.result}"/><p style="margin-top:10px">Tap to change</p>`; };
    r.readAsDataURL(f);
  });

  document.getElementById('addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const caption = document.getElementById('memCaption').value.trim();
    const date = document.getElementById('memDate').value;
    const mood = document.getElementById('moodSelect').value;
    if (!caption && !pendingImage) return;
    updateVault(v => {
      v.memories = v.memories || [];
      v.memories.push({ id: uid(), caption, date, mood, image: pendingImage, createdAt: Date.now() });
      return v;
    });
    pendingImage = '';
    e.target.reset();
    drop.classList.remove('has-file');
    drop.innerHTML = '<p>Click to upload an image</p>';
    document.getElementById('addModal').classList.remove('open');
    renderTimeline();
    toast('Memory archived ✨');
  });
}

// ---------- MUSIC ----------
function setupMusic() {
  const btn = document.getElementById('musicBtn');
  const audio = document.getElementById('ambient');
  audio.volume = 0.3;
  const tryPlay = () => audio.play().then(()=>btn.classList.add('playing')).catch(()=>{});
  tryPlay();
  document.addEventListener('click', tryPlay, { once: true });
  btn.addEventListener('click', () => {
    if (audio.paused) { audio.play(); btn.classList.add('playing'); }
    else { audio.pause(); btn.classList.remove('playing'); }
  });
}

// ---------- FLOATING QUOTES ----------
const QUOTES = ['Some memories never fade ✨','Lost moments live forever 🌌','You were here. The stars remember. 🌠'];
function spawnQuote() {
  const q = document.createElement('div'); q.className = 'floating-quote';
  q.textContent = QUOTES[Math.floor(Math.random()*QUOTES.length)];
  q.style.left = (10+Math.random()*80)+'vw'; q.style.top = (60+Math.random()*30)+'vh';
  document.body.appendChild(q); setTimeout(()=>q.remove(), 18000);
}

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', () => {
  initStars(); initDust(); initCursor(); setupMusic(); setupAddMemory();
  renderTimeline();
  setInterval(spawnQuote, 9000);

  document.getElementById('searchInput').addEventListener('input', renderTimeline);
  document.getElementById('moodFilter').addEventListener('change', renderTimeline);

  document.getElementById('addBtn').addEventListener('click', () => document.getElementById('addModal').classList.add('open'));
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => document.getElementById(b.dataset.close).classList.remove('open')));
  document.querySelectorAll('.modal-backdrop').forEach(bd => bd.addEventListener('click', e => { if (e.target===bd) bd.classList.remove('open'); }));

  document.getElementById('timeline').addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      if (!confirm('Delete this memory forever?')) return;
      updateVault(v => { v.memories = (v.memories||[]).filter(m => m.id !== del.dataset.del); return v; });
      renderTimeline(); toast('Memory released to the stars');
    }
  });
});
