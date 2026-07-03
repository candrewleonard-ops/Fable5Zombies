import { WEAPONS, GRADES, weaponDef, makeWeaponItem, makeMaterial } from './items.js';
import { audio } from './audio.js';

// Village economy: the investment Market (Real Estate / Oil & Gas / Stocks),
// the gun store (buy anything, sell for 80%), the Gun Combiner, and the Town
// Hall quest system. All panels are DOM overlays built here.

function panel(id, title) {
  const el = document.createElement('div');
  el.id = id;
  el.className = 'bigPanel';
  el.style.display = 'none';
  el.innerHTML = `<div class="bp-head"><h2>${title}</h2><span class="bp-close">✕</span></div><div class="bp-body"></div>
    <div class="bp-hint">ESC to leave</div>`;
  document.body.appendChild(el);
  return el;
}

const fmt = (n) => Math.round(n).toLocaleString('en-US');

// ---------------- MARKET ----------------

export class Market {
  constructor(tvCanvas, tvTex) {
    this.tvCanvas = tvCanvas;
    this.tvTex = tvTex;
    this.funds = {
      re:     { name: 'Real Estate', price: 1000, shares: 0, hist: [1000], payout: '5% cashflow on invested points per round · value +1%/round' },
      oil:    { name: 'Oil & Gas', price: 1000, shares: 0, hist: [1000], payout: '3% return on invested points per minute · value +1%/round' },
      stocks: { name: 'Stocks', price: 1000, shares: 0, hist: [1000], payout: '+1%…+15% per round (≈5% average, compounding). Sell to realize.' },
    };
    this.oilTimer = 60;
    this.getPoints = () => 0;
    this.spend = () => false;
    this.addPoints = () => {};
    this.toast = () => {};
    this.el = panel('bankPanel', '🏦 PRIVATE FUND PLACEMENT');
    this.el.querySelector('.bp-close').addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fund]');
      if (!b) return;
      const { fund, act, n } = b.dataset;
      if (act === 'buy') this.buy(fund, Number(n));
      else this.sell(fund, Number(n));
    });
    this.drawTV(0);
  }

  buy(key, n) {
    const f = this.funds[key];
    const cost = Math.ceil(f.price * n);
    if (!this.spend(cost)) { audio.deny(); return; }
    f.shares += n;
    audio.buy();
    this.render();
  }

  sell(key, n) {
    const f = this.funds[key];
    const amount = Math.min(n, f.shares);
    if (amount <= 0) { audio.deny(); return; }
    f.shares -= amount;
    this.addPoints(Math.floor(f.price * amount));
    audio.buy();
    this.render();
  }

  onRound(round) {
    const { re, oil, stocks } = this.funds;
    re.price *= 1.01;
    oil.price *= 1.01;
    const g = 0.01 + 0.14 * Math.pow(Math.random(), 2.4); // 1–15%, mean ≈ 5%
    stocks.price *= (1 + g);
    for (const f of Object.values(this.funds)) {
      f.hist.push(f.price);
      if (f.hist.length > 46) f.hist.shift();
    }
    // Real Estate cashflow: 5% of invested per round
    if (re.shares > 0) {
      const pay = Math.round(re.shares * re.price * 0.05);
      this.addPoints(pay);
      this.toast(`🏘 Real Estate cashflow +${fmt(pay)}`);
    }
    this.drawTV(round);
    if (this.isOpen) this.render();
  }

  update(dt) {
    this.oilTimer -= dt;
    if (this.oilTimer <= 0) {
      this.oilTimer = 60;
      const oil = this.funds.oil;
      if (oil.shares > 0) {
        const pay = Math.round(oil.shares * oil.price * 0.03);
        this.addPoints(pay);
        this.toast(`🛢 Oil & Gas dividend +${fmt(pay)}`);
      }
    }
  }

  get isOpen() { return this.el.style.display !== 'none'; }
  open() { this.render(); this.el.style.display = 'block'; }
  close() { this.el.style.display = 'none'; if (this.onClose) this.onClose(); }

  render() {
    const body = this.el.querySelector('.bp-body');
    const rows = Object.entries(this.funds).map(([key, f]) => {
      const delta = f.hist.length > 1 ? (f.price / f.hist[f.hist.length - 2] - 1) * 100 : 0;
      return `
      <div class="fund">
        <div class="fund-top">
          <b>${f.name}</b>
          <span class="fund-price">${fmt(f.price)} <em class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}%</em></span>
        </div>
        <div class="fund-desc">${f.payout}</div>
        <div class="fund-own">Owned: <b>${f.shares}</b> shares · Value <b>${fmt(f.shares * f.price)}</b></div>
        <div class="fund-btns">
          <button data-fund="${key}" data-act="buy" data-n="1">Buy 1</button>
          <button data-fund="${key}" data-act="buy" data-n="10">Buy 10</button>
          <button data-fund="${key}" data-act="sell" data-n="1">Sell 1</button>
          <button data-fund="${key}" data-act="sell" data-n="10">Sell 10</button>
        </div>
      </div>`;
    }).join('');
    body.innerHTML = `<div class="bp-points">Points: <b>${fmt(this.getPoints())}</b></div>${rows}`;
  }

  drawTV(round) {
    const g = this.tvCanvas.getContext('2d');
    const W = this.tvCanvas.width, H = this.tvCanvas.height;
    g.fillStyle = '#06090f'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#0e1622'; g.fillRect(0, 0, W, 64);
    g.fillStyle = '#d8c88a'; g.font = 'bold 38px Arial'; g.textAlign = 'left';
    g.fillText('WESTBROOK MARKETS', 24, 44);
    g.fillStyle = '#8aa0c0'; g.font = '26px Arial'; g.textAlign = 'right';
    g.fillText(`ROUND ${round}`, W - 24, 44);
    const keys = ['re', 'oil', 'stocks'];
    keys.forEach((key, i) => {
      const f = this.funds[key];
      const y0 = 80 + i * 142;
      const delta = f.hist.length > 1 ? (f.price / f.hist[f.hist.length - 2] - 1) * 100 : 0;
      const up = delta >= 0;
      g.fillStyle = '#101826'; g.fillRect(16, y0, W - 32, 128);
      g.fillStyle = '#e8e0cc'; g.font = 'bold 30px Arial'; g.textAlign = 'left';
      g.fillText(f.name.toUpperCase(), 34, y0 + 42);
      g.fillStyle = up ? '#54d86a' : '#e05a4a'; g.font = 'bold 34px Arial';
      g.fillText(`${fmt(f.price)}`, 34, y0 + 88);
      g.font = 'bold 24px Arial';
      g.fillText(`${up ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}%`, 200, y0 + 88);
      // sparkline
      const hist = f.hist;
      const min = Math.min(...hist), max = Math.max(...hist);
      g.strokeStyle = up ? '#54d86a' : '#e05a4a';
      g.lineWidth = 4;
      g.beginPath();
      hist.forEach((v, k) => {
        const px = 380 + (k / Math.max(1, hist.length - 1)) * (W - 430);
        const py = y0 + 108 - ((v - min) / Math.max(1, max - min)) * 88;
        k === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
      });
      g.stroke();
    });
    this.tvTex.needsUpdate = true;
  }
}

// ---------------- GUN STORE ----------------

export class GunStore {
  constructor() {
    this.getPoints = () => 0;
    this.spend = () => false;
    this.addPoints = () => {};
    this.giveWeapon = () => false;
    this.getHeld = () => null;
    this.removeHeld = () => {};
    this.toast = () => {};
    this.el = panel('storePanel', "🔫 IRONSIDE'S GUN STORE");
    this.el.querySelector('.bp-close').addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => {
      const buy = e.target.closest('[data-buykey]');
      if (buy) { this._buy(buy.dataset.buykey); return; }
      if (e.target.closest('#sellHeldBtn')) this._sellHeld();
    });
  }

  _buy(key) {
    const def = WEAPONS[key];
    if (!this.spend(def.price)) { audio.deny(); return; }
    if (!this.giveWeapon(makeWeaponItem(key))) {
      this.addPoints(def.price);
      this.toast('Inventory full');
      audio.deny();
      return;
    }
    audio.buy();
    this.render();
  }

  sellValue(item) {
    if (!item) return 0;
    const def = WEAPONS[item.weaponKey];
    let v = def.price * 0.8;
    if (item.pap) v *= 1.6;
    if (item.nuclear) v *= 1.2;
    return Math.round(v);
  }

  _sellHeld() {
    const item = this.getHeld();
    if (!item || item.kind !== 'weapon') { audio.deny(); return; }
    const v = this.sellValue(item);
    this.removeHeld();
    this.addPoints(v);
    this.toast(`Sold for ${fmt(v)} points`);
    audio.buy();
    this.render();
  }

  get isOpen() { return this.el.style.display !== 'none'; }
  open() { this.render(); this.el.style.display = 'block'; }
  close() { this.el.style.display = 'none'; if (this.onClose) this.onClose(); }

  render() {
    const held = this.getHeld();
    const rows = Object.entries(WEAPONS)
      .filter(([k, d]) => k !== 'mauser')
      .sort((a, b) => a[1].price - b[1].price)
      .map(([key, d]) => {
        const grade = GRADES[d.grade];
        return `<div class="storeRow">
          <span class="sr-name" style="color:${grade.css}">${d.name}</span>
          <span class="sr-stats">${Math.round(d.dmg)} dmg · ${d.mag} mag</span>
          <span class="sr-price">${fmt(d.price)}</span>
          <button data-buykey="${key}">Buy</button>
        </div>`;
      }).join('');
    const body = this.el.querySelector('.bp-body');
    body.innerHTML =
      `<div class="bp-points">Points: <b>${fmt(this.getPoints())}</b></div>` +
      `<div class="storeSell">${held && held.kind === 'weapon'
        ? `Holding: <b>${weaponDef(held).name}</b> <button id="sellHeldBtn">Sell for ${fmt(this.sellValue(held))} (80%)</button>`
        : 'Hold a weapon to sell it (80% of value).'}</div>` +
      `<div class="storeList">${rows}</div>`;
  }
}

// ---------------- GUN COMBINER ----------------

export class Combiner {
  constructor() {
    this.slots = 2;          // upgrades: 10k → 3, then 3 diamonds + 20k → 4
    this.inserted = [];
    this.getPoints = () => 0;
    this.spend = () => false;
    this.getHeld = () => null;
    this.removeHeld = () => {};
    this.giveWeapon = () => false;
    this.countDiamonds = () => 0;
    this.consumeDiamonds = () => {};
    this.toast = () => {};
    this.el = panel('combinerPanel', '⚗ GUN COMBINER');
    this.el.querySelector('.bp-close').addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => {
      if (e.target.closest('#cbInsert')) this._insert();
      else if (e.target.closest('#cbCombine')) this._combine();
      else if (e.target.closest('#cbUp3')) this._upgrade3();
      else if (e.target.closest('#cbUp4')) this._upgrade4();
      else if (e.target.closest('[data-eject]')) this._eject(Number(e.target.closest('[data-eject]').dataset.eject));
    });
  }

  _insert() {
    const held = this.getHeld();
    if (!held || held.kind !== 'weapon') { this.toast('Hold a weapon to insert it'); audio.deny(); return; }
    if (this.inserted.length >= this.slots) { this.toast('All sockets full'); audio.deny(); return; }
    this.removeHeld();
    this.inserted.push(held);
    audio.craftTick();
    this.render();
  }

  _eject(i) {
    const item = this.inserted[i];
    if (!item) return;
    if (!this.giveWeapon(item)) { this.toast('Inventory full'); return; }
    this.inserted.splice(i, 1);
    this.render();
  }

  _upgrade3() {
    if (this.slots >= 3) return;
    if (!this.spend(10000)) { audio.deny(); return; }
    this.slots = 3;
    audio.perkJingle();
    this.render();
  }

  _upgrade4() {
    if (this.slots >= 4 || this.slots < 3) return;
    if (this.countDiamonds() < 3) { this.toast('Needs 3 diamonds'); audio.deny(); return; }
    if (!this.spend(20000)) { audio.deny(); return; }
    this.consumeDiamonds(3);
    this.slots = 4;
    audio.perkJingle();
    this.render();
  }

  _combine() {
    if (this.inserted.length < 2) { this.toast('Insert at least 2 guns'); audio.deny(); return; }
    const items = this.inserted;
    const defs = items.map((i) => weaponDef(i));
    const n = items.length;
    const base = items[0];
    const gradeOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const bestGrade = gradeOrder[Math.min(4, Math.max(...items.map((i) => gradeOrder.indexOf(i.grade || 'common'))) + 1)];
    const custom = {
      name: 'Fusion ' + items.map((i) => WEAPONS[i.weaponKey].name.split(' ')[0]).join('·'),
      dmg: Math.max(...defs.map((d) => d.dmg)) * (1 + 0.3 * (n - 1)),
      mag: Math.max(...defs.map((d) => d.mag)),
      reserve: Math.max(...defs.map((d) => d.reserve)),
      rpm: Math.max(...defs.map((d) => d.rpm)),
      reload: Math.min(...defs.map((d) => d.reload)),
      auto: defs.some((d) => d.auto),
      fusedNames: defs.map((d) => d.name).join(' + '),
      desc2: `${n}-gun fusion: +${Math.round(30 * (n - 1))}% damage, best mag, best rate of fire.`,
    };
    const result = {
      ...base,
      pap: items.some((i) => i.pap),
      nuclear: items.some((i) => i.nuclear),
      custom,
      name: custom.name,
      grade: bestGrade,
      mag: custom.mag,
      reserve: custom.reserve,
    };
    this.inserted = [];
    if (!this.giveWeapon(result)) this.inserted = items; // shouldn't happen: we just freed slots
    else {
      audio.papDone?.() ?? audio.perkJingle();
      this.toast(`${custom.name} forged`);
    }
    this.render();
  }

  get isOpen() { return this.el.style.display !== 'none'; }
  open() { this.render(); this.el.style.display = 'block'; }
  close() { this.el.style.display = 'none'; if (this.onClose) this.onClose(); }

  render() {
    const body = this.el.querySelector('.bp-body');
    const sockets = [];
    for (let i = 0; i < this.slots; i++) {
      const it = this.inserted[i];
      sockets.push(`<div class="cbSocket">${it
        ? `<span style="color:${GRADES[it.grade || 'common'].css}">${weaponDef(it).name}</span> <button data-eject="${i}">Eject</button>`
        : '<em>empty socket</em>'}</div>`);
    }
    body.innerHTML =
      `<div class="bp-points">Points: <b>${fmt(this.getPoints())}</b></div>` +
      `<div class="cbSockets">${sockets.join('')}</div>` +
      `<div class="cbBtns">
         <button id="cbInsert">Insert held weapon</button>
         <button id="cbCombine" ${this.inserted.length >= 2 ? '' : 'disabled'}>⚡ COMBINE (${this.inserted.length})</button>
       </div>` +
      `<div class="cbUps">
         ${this.slots < 3 ? '<button id="cbUp3">Unlock 3rd socket — 10,000 pts</button>' : '3rd socket ✓'}
         ${this.slots === 3 ? '<button id="cbUp4">Unlock 4th socket — 3 💎 + 20,000 pts</button>' : this.slots >= 4 ? ' · 4th socket ✓' : ''}
       </div>` +
      `<div class="fund-desc">Fusing keeps the first gun's soul: its firing mode, its skin — but steals the best stats of every donor and stacks +30% damage per extra gun.</div>`;
  }
}

// ---------------- QUESTS ----------------

const QUEST_TEMPLATES = [
  (round) => ({ type: 'kills', need: 12 + round * 4, have: 0, desc: (q) => `Slay ${q.need} zombies (${q.have}/${q.need})`, reward: { points: (12 + round * 4) * 45, diamonds: round >= 8 ? 1 : 0 } }),
  () => ({ type: 'boards', need: 6, have: 0, desc: (q) => `Repair ${q.need} barricade boards (${q.have}/${q.need})`, reward: { points: 900 } }),
  () => ({ type: 'collect', mat: 'steel', need: 5, desc: (q) => `Deliver ${q.need} steel from the mines`, reward: { points: 1600, diamonds: 1 } }),
  () => ({ type: 'collect', mat: 'beef', need: 3, desc: (q) => `Deliver ${q.need} raw beef (the Reeve is hungry)`, reward: { points: 1000, mats: ['coal', 3] } }),
  (round) => ({ type: 'round', need: round + 2, desc: (q) => `Survive to round ${q.need}`, reward: { points: 1400, diamonds: 1 } }),
  () => ({ type: 'collect', mat: 'granite', need: 4, desc: (q) => `Deliver ${q.need} granite blocks`, reward: { points: 1300 } }),
];

export const MILESTONES = {
  firstBoss:  { desc: 'First Abomination slain', diamonds: 2 },
  bloodMoon:  { desc: 'Survived a Blood Moon', diamonds: 1 },
  round15:    { desc: 'Reached round 15', diamonds: 2 },
  spider:     { desc: 'The Specimen destroyed', diamonds: 3 },
};

export class Quests {
  constructor() {
    this.current = null;
    this.granted = new Set();    // milestones already earned (claimable)
    this.claimed = new Set();
    this.getRound = () => 1;
    this.getPoints = () => 0;
    this.addPoints = () => {};
    this.giveItem = () => false;
    this.countOf = () => 0;
    this.consume = () => {};
    this.toast = () => {};
    this.el = panel('questPanel', '📜 TOWN HALL — CONTRACTS');
    this.el.querySelector('.bp-close').addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => {
      if (e.target.closest('#qNew')) this._newQuest();
      else if (e.target.closest('#qClaim')) this._claim();
      else if (e.target.closest('[data-mile]')) this._claimMile(e.target.closest('[data-mile]').dataset.mile);
    });
  }

  _newQuest() {
    if (this.current) return;
    const t = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)];
    this.current = t(this.getRound());
    audio.craftTick();
    this.render();
  }

  isDone() {
    const q = this.current;
    if (!q) return false;
    if (q.type === 'kills' || q.type === 'boards') return q.have >= q.need;
    if (q.type === 'collect') return this.countOf(q.mat) >= q.need;
    if (q.type === 'round') return this.getRound() >= q.need;
    return false;
  }

  _claim() {
    const q = this.current;
    if (!q || !this.isDone()) { audio.deny(); return; }
    if (q.type === 'collect') this.consume(q.mat, q.need);
    this._payReward(q.reward);
    this.current = null;
    audio.perkJingle();
    this.render();
  }

  _payReward(r) {
    if (r.points) { this.addPoints(r.points); this.toast(`Contract paid: +${fmt(r.points)} pts`); }
    if (r.diamonds) { this.giveItem(makeMaterial('diamond', r.diamonds)); this.toast(`+${r.diamonds} 💎`); }
    if (r.mats) this.giveItem(makeMaterial(r.mats[0], r.mats[1]));
  }

  milestone(key) {
    if (this.granted.has(key) || this.claimed.has(key)) return;
    this.granted.add(key);
    this.toast(`🏅 ${MILESTONES[key].desc} — reward waiting at Town Hall`);
  }

  _claimMile(key) {
    if (!this.granted.has(key) || this.claimed.has(key)) return;
    this.claimed.add(key);
    this.granted.delete(key);
    this.giveItem(makeMaterial('diamond', MILESTONES[key].diamonds));
    this.toast(`+${MILESTONES[key].diamonds} 💎 — ${MILESTONES[key].desc}`);
    audio.perkJingle();
    this.render();
  }

  // hooks from main
  addKill() { if (this.current?.type === 'kills') { this.current.have++; } }
  addBoard() { if (this.current?.type === 'boards') { this.current.have++; } }

  get isOpen() { return this.el.style.display !== 'none'; }
  open() { this.render(); this.el.style.display = 'block'; }
  close() { this.el.style.display = 'none'; if (this.onClose) this.onClose(); }

  render() {
    const body = this.el.querySelector('.bp-body');
    const q = this.current;
    const questHtml = q
      ? `<div class="questBox">
           <div class="q-desc">${q.desc(q)}</div>
           <div class="q-reward">Reward: ${q.reward.points ? fmt(q.reward.points) + ' pts' : ''}${q.reward.diamonds ? ` + ${q.reward.diamonds} 💎` : ''}${q.reward.mats ? ` + ${q.reward.mats[1]} ${q.reward.mats[0]}` : ''}</div>
           <button id="qClaim" ${this.isDone() ? '' : 'disabled'}>${this.isDone() ? 'CLAIM REWARD' : 'In progress…'}</button>
         </div>`
      : `<div class="questBox"><em>"Work for coin, stranger?"</em><br><button id="qNew">Take a contract</button></div>`;
    const miles = Object.entries(MILESTONES).map(([key, m]) => {
      const state = this.claimed.has(key) ? '✓ claimed' : this.granted.has(key)
        ? `<button data-mile="${key}">Claim ${m.diamonds} 💎</button>` : '<em>locked</em>';
      return `<div class="mileRow"><span>${m.desc}</span><span>${state}</span></div>`;
    }).join('');
    body.innerHTML = questHtml + `<h3 class="mileHead">MILESTONES</h3>` + miles;
  }
}
