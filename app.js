const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

// ─── 페이지 전환 ───
let currentPage = 'shorts';
let pageLoaded = { shorts: false, coin: false, stock: false, community: false };

function switchPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');
  btn.classList.add('active');
  currentPage = name;
  if (!pageLoaded[name]) {
    pageLoaded[name] = true;
    if (name === 'shorts') initShorts();
    else if (name === 'coin') initCoin();
    else if (name === 'stock') initStock();
    else if (name === 'community') loadComm('dcinside', document.querySelector('.comm-tab'));
  }
}

// ─── 숫자 포맷 ───
function fmt(n) {
  if (!n) return '-';
  if (n >= 1e12) return `$${(n/1e12).toFixed(1)}T`;
  if (n >= 1e9)  return `$${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3)  return `${(n/1e3).toFixed(0)}K`;
  return String(n);
}
function sign(v) { return v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2); }
function cls(v) { return v >= 0 ? 'up' : 'dn'; }

// ════════════════════════════════════════
// 숏츠
// ════════════════════════════════════════
let shortsData = [];
let shortsPage = '';

async function initShorts() {
  const wrap = document.getElementById('shorts-wrap');
  wrap.innerHTML = `<div class="shorts-loader"><div class="spin"></div><div class="shorts-loader-txt">핫한 숏츠 불러오는 중...</div></div>`;
  try {
    // 유튜브 숏츠 = duration 60초 이하 + 조회수 높은 것
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&chart=mostPopular&regionCode=KR&videoCategoryId=0&maxResults=20&key=${YT_API_KEY}`
    );
    const data = await res.json();

    // 60초(PT1M) 이하만 필터 - 숏츠
    shortsData = (data.items || []).filter(item => {
      const dur = item.contentDetails?.duration || '';
      return /^PT(\d+S|[0-5]?\dS|[0-5]?\d)$/.test(dur) || dur.includes('M') === false;
    });

    if (shortsData.length === 0) shortsData = data.items || [];
    renderShorts(shortsData);
  } catch (e) {
    wrap.innerHTML = `<div class="shorts-loader"><div style="color:rgba(255,255,255,.4);font-size:12px">로딩 실패 😅<br>잠시 후 다시 시도해주세요</div></div>`;
  }
}

function renderShorts(items) {
  const wrap = document.getElementById('shorts-wrap');
  wrap.innerHTML = items.map((item, i) => {
    const vid = item.id;
    const title = item.snippet?.title || '';
    const channel = item.snippet?.channelTitle || '';
    const views = parseInt(item.statistics?.viewCount || 0);
    const likes = parseInt(item.statistics?.likeCount || 0);
    return `
      <div class="short-item" id="short-${i}">
        <iframe class="short-iframe"
          src="https://www.youtube.com/embed/${vid}?autoplay=${i===0?1:0}&mute=${i===0?0:1}&loop=1&playlist=${vid}&controls=1&rel=0&modestbranding=1"
          allow="autoplay; encrypted-media; fullscreen"
          allowfullscreen></iframe>
        <div class="short-info">
          <div class="short-title">${title}</div>
          <div class="short-channel">📺 ${channel}</div>
          <div class="short-views">👁 ${fmt(views)} · 👍 ${fmt(likes)}</div>
        </div>
        <div class="short-actions">
          <div class="short-act">
            <div class="short-act-btn">❤️</div>
            <div class="short-act-txt">${fmt(likes)}</div>
          </div>
          <div class="short-act">
            <div class="short-act-btn">💬</div>
            <div class="short-act-txt">${fmt(parseInt(item.statistics?.commentCount||0))}</div>
          </div>
          <div class="short-act" onclick="shareShort('${vid}')">
            <div class="short-act-btn">🔗</div>
            <div class="short-act-txt">공유</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 스크롤 시 자동 재생
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const iframe = entry.target.querySelector('iframe');
      if (!iframe) return;
      const src = iframe.src;
      if (entry.isIntersecting) {
        iframe.src = src.replace('autoplay=0', 'autoplay=1').replace('mute=1', 'mute=0');
      } else {
        iframe.src = src.replace('autoplay=1', 'autoplay=0');
      }
    });
  }, { threshold: 0.7 });

  document.querySelectorAll('.short-item').forEach(el => observer.observe(el));
}

function shareShort(videoId) {
  const url = `https://youtu.be/${videoId}`;
  if (tg) tg.openLink(url);
  else window.open(url, '_blank');
}

// ════════════════════════════════════════
// 코인
// ════════════════════════════════════════
// ─── 실시간 시계 ───
function startClock() {
  function tick() {
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
    const h = String(kst.getUTCHours()).padStart(2,'0');
    const m = String(kst.getUTCMinutes()).padStart(2,'0');
    const s = String(kst.getUTCSeconds()).padStart(2,'0');
    const el = document.getElementById('live-time');
    if (el) el.textContent = `${h}:${m}:${s}`;
  }
  tick();
  setInterval(tick, 1000);
}

// ─── USDT 실시간 차트 ───
let usdtChart = null;
const usdtHistory = [];
const maxPoints = 30;

function initUsdtChart() {
  const canvas = document.getElementById('usdt-chart');
  if (!canvas) return;
  usdtChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: Array(maxPoints).fill(''),
      datasets: [{
        data: Array(maxPoints).fill(null),
        borderColor: '#26a17b',
        backgroundColor: 'rgba(38,161,123,.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
        spanGaps: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: {
          display: true,
          position: 'right',
          ticks: {
            color: 'rgba(255,255,255,.25)',
            font: { size: 8 },
            maxTicksLimit: 3,
            callback: v => `₩${v.toFixed(1)}`
          },
          grid: { color: 'rgba(255,255,255,.04)' }
        }
      }
    }
  });
}

function updateUsdtChart(price) {
  if (!usdtChart || !price) return;
  usdtHistory.push(price);
  if (usdtHistory.length > maxPoints) usdtHistory.shift();

  const padded = Array(maxPoints).fill(null);
  usdtHistory.forEach((v, i) => { padded[maxPoints - usdtHistory.length + i] = v; });

  // 차트 색상: 첫값 대비 현재값
  const first = usdtHistory[0];
  const last = usdtHistory[usdtHistory.length - 1];
  const isUp = last >= first;
  const color = isUp ? '#22c55e' : '#ef4444';
  usdtChart.data.datasets[0].data = padded;
  usdtChart.data.datasets[0].borderColor = color;
  usdtChart.data.datasets[0].backgroundColor = isUp ? 'rgba(34,197,94,.07)' : 'rgba(239,68,68,.07)';
  usdtChart.update('active');
}

async function initCoin() {
  startClock();
  initUsdtChart();
  await Promise.all([loadCoinPrices(), loadKimp(), loadFearGreed()]);
  convertCoin();
  convertTrx();
  setInterval(loadCoinPrices, 10000);
  setInterval(loadKimp, 30000);
}

async function loadCoinPrices() {
  try {
    // CoinGecko + 업비트 + 빗썸 + 바이낸스 동시 호출
    const [cgRes, upbitRes, bithumbRes, binanceRes] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,dogecoin,tether&vs_currencies=usd,krw&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true'),
      fetch('https://api.upbit.com/v1/ticker?markets=KRW-USDT'),
      fetch('https://api.bithumb.com/public/ticker/USDT_KRW'),
      fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=USDTKRW').catch(() => null)
    ]);

    const cg = await cgRes.json();
    const upbit = await upbitRes.json();
    const bithumb = await bithumbRes.json();

    const btc = cg.bitcoin || {};
    const usdt = cg.tether || {};

    // 히어로 - USDT 기준
    const usdtKrw = usdt.krw || 0;
    const usdtChg = usdt.krw_24h_change || 0;
    document.getElementById('hero-price').textContent = `₩${usdtKrw.toLocaleString(undefined,{minimumFractionDigits:1,maximumFractionDigits:1})}`;
    const heroChg = document.getElementById('hero-chg');
    heroChg.textContent = `${sign(usdtChg)}% (24h)`;
    heroChg.className = `coin-hero-chg ${cls(usdtChg)}`;
    document.getElementById('hero-mcap').textContent = fmt(btc.usd_market_cap);
    document.getElementById('hero-vol').textContent = fmt(btc.usd_24h_vol);
    document.getElementById('hero-dom').textContent = '58.3%';

    // 업데이트 시간
    const now = new Date();
    const kst = new Date(now.getTime() + (9*3600000) - (now.getTimezoneOffset()*60000));
    const timeStr = `${String(kst.getUTCHours()).padStart(2,'0')}:${String(kst.getUTCMinutes()).padStart(2,'0')}:${String(kst.getUTCSeconds()).padStart(2,'0')}`;
    const upEl = document.getElementById('hero-update');
    if (upEl) upEl.textContent = `최근 업데이트 ${timeStr} KST`;

    // 차트 업데이트
    updateUsdtChart(usdtKrw);

    // USDT 3거래소
    const upbitUsdt = upbit[0]?.trade_price || 0;
    const upbitChg = upbit[0]?.signed_change_rate * 100 || 0;

    let bithumbUsdt = 0, bithumbChg = 0;
    try {
      const bd = bithumb.data;
      bithumbUsdt = parseFloat(bd?.closing_price || 0);
      bithumbChg = parseFloat(bd?.fluctate_rate_24H || 0);
    } catch(e) {}

    // 바이낸스 USDT/KRW (없으면 환율로 계산)
    const rate = upbitUsdt || usdtKrw;
    document.getElementById('hero-rate').textContent = `₩${Math.round(rate).toLocaleString()}`;

    const setExchange = (id, chgId, price, chg) => {
      const el = document.getElementById(id);
      const chgEl = document.getElementById(chgId);
      if (el) el.textContent = price > 0 ? `₩${price.toLocaleString(undefined,{minimumFractionDigits:1,maximumFractionDigits:1})}` : '-';
      if (chgEl) {
        chgEl.textContent = price > 0 ? `${sign(chg)}%` : '-';
        chgEl.className = cls(chg);
      }
    };

    setExchange('usdt-upbit', 'usdt-upbit-chg', upbitUsdt, upbitChg);
    setExchange('usdt-bithumb', 'usdt-bithumb-chg', bithumbUsdt, bithumbChg);
    setExchange('usdt-binance', 'usdt-binance-chg', usdtKrw, usdtChg);

    // 스프레드 계산
    const prices = [upbitUsdt, bithumbUsdt, usdtKrw].filter(p => p > 0);
    if (prices.length >= 2) {
      const spread = Math.max(...prices) - Math.min(...prices);
      const spreadEl = document.getElementById('usdt-spread');
      if (spreadEl) {
        spreadEl.textContent = `₩${spread.toFixed(1)}`;
        spreadEl.className = spread > 5 ? 'neu' : 'up';
      }
    }

    // 코인 목록
    const coins = [
      { key: 'bitcoin',  icon: '₿', bg: '#f7931a22', name: 'Bitcoin',  tk: 'BTC' },
      { key: 'ethereum', icon: 'Ξ', bg: '#627eea22', name: 'Ethereum', tk: 'ETH' },
      { key: 'solana',   icon: '◎', bg: '#9945ff22', name: 'Solana',   tk: 'SOL' },
      { key: 'ripple',   icon: '✕', bg: '#00aae422', name: 'XRP',      tk: 'XRP' },
      { key: 'dogecoin', icon: 'Ð', bg: '#c2a63322', name: 'Dogecoin', tk: 'DOGE' },
    ];

    document.getElementById('coin-list').innerHTML = coins.map(c => {
      const coin = cg[c.key] || {};
      const p = coin.usd || 0;
      const ch = coin.usd_24h_change || 0;
      return `
        <div class="coin-row">
          <div class="coin-left">
            <div class="coin-ic" style="background:${c.bg}">${c.icon}</div>
            <div><div class="coin-nm">${c.name}</div><div class="coin-tk">${c.tk}</div></div>
          </div>
          <div class="coin-right">
            <div class="coin-pr">$${p >= 1 ? p.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : p.toFixed(4)}</div>
            <div class="coin-ch ${cls(ch)}">${sign(ch)}%</div>
          </div>
        </div>
      `;
    }).join('');
  } catch(e) {
    console.error('코인 로딩 실패', e);
    document.getElementById('coin-list').innerHTML = `<div style="font-size:12px;color:rgba(255,255,255,.3);padding:10px">데이터 로딩 실패</div>`;
  }
}

async function loadKimp() {
  try {
    const [upbitRes, binanceRes, cgRes] = await Promise.all([
      fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC'),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=krw,usd')
    ]);
    const upbit = await upbitRes.json();
    const binance = await binanceRes.json();
    const cg = await cgRes.json();

    const upbitKrw = upbit[0].trade_price;
    const binanceUsd = parseFloat(binance.price);
    const rate = cg.bitcoin.krw / cg.bitcoin.usd;
    const binanceKrw = binanceUsd * rate;
    const kimp = ((upbitKrw - binanceKrw) / binanceKrw) * 100;
    const kp = kimp.toFixed(2);
    const w = Math.min(Math.max(((kimp + 5) / 10) * 100, 0), 100);
    const barColor = kimp > 3 ? '#ef4444' : kimp > 1 ? '#eab308' : kimp >= 0 ? '#22c55e' : '#60a5fa';
    const statusTxt = kimp > 3 ? '🔴 과열' : kimp > 1 ? '🟡 주의' : kimp >= 0 ? '🟢 정상' : '🔵 역프';
    const statusBg = kimp > 3 ? 'rgba(239,68,68,.15)' : kimp > 1 ? 'rgba(234,179,8,.15)' : kimp >= 0 ? 'rgba(34,197,94,.15)' : 'rgba(96,165,250,.15)';

    document.getElementById('kimp-wrap').innerHTML = `
      <div class="kimp-top">
        <div>
          <div class="kimp-lbl">BTC 김치 프리미엄</div>
          <div class="kimp-val ${cls(kimp)}">${sign(parseFloat(kp))}%</div>
          <div class="kimp-status" style="background:${statusBg};color:${barColor}">${statusTxt}</div>
        </div>
        <div style="text-align:right;font-size:10px;color:rgba(255,255,255,.3)">실시간<br>${new Date().toLocaleTimeString('ko')}</div>
      </div>
      <div class="kimp-gauge"><div class="kimp-bar" style="width:${w}%;background:${barColor}"></div></div>
      <div class="kimp-lbls"><span>역프 -5%</span><span>0%</span><span>과열 +5%</span></div>
      <div class="kimp-grid">
        <div class="kimp-st"><div class="kimp-st-v">₩${Math.round(upbitKrw/1e6*10)/10}M</div><div class="kimp-st-l">업비트</div></div>
        <div class="kimp-st"><div class="kimp-st-v">$${Math.round(binanceUsd).toLocaleString()}</div><div class="kimp-st-l">바이낸스</div></div>
        <div class="kimp-st"><div class="kimp-st-v">₩${Math.round(rate).toLocaleString()}</div><div class="kimp-st-l">환율</div></div>
      </div>
    `;
  } catch(e) {
    document.getElementById('kimp-wrap').innerHTML = `<div style="font-size:12px;color:rgba(255,255,255,.3);padding:10px">김프 로딩 실패</div>`;
  }
}

async function loadFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    const data = await res.json();
    const val = parseInt(data.data[0].value);
    const classification = data.data[0].value_classification;
    const color = val < 25 ? '#ef4444' : val < 45 ? '#f97316' : val < 55 ? '#eab308' : val < 75 ? '#84cc16' : '#22c55e';
    const left = val;

    document.getElementById('fear-wrap').innerHTML = `
      <div class="fear-top">
        <div>
          <div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:4px">공포·탐욕 지수</div>
          <div class="fear-val" style="color:${color}">${val}</div>
          <div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:3px">${classification}</div>
        </div>
        <div style="font-size:36px">${val < 25 ? '😱' : val < 45 ? '😨' : val < 55 ? '😐' : val < 75 ? '😊' : '🤑'}</div>
      </div>
      <div class="fear-bar">
        <div class="fear-needle" style="left:${left}%"></div>
      </div>
      <div class="fear-lbls"><span>극공포</span><span>공포</span><span>중립</span><span>탐욕</span><span>극탐욕</span></div>
    `;
  } catch(e) {
    document.getElementById('fear-wrap').innerHTML = `<div style="font-size:12px;color:rgba(255,255,255,.3);padding:10px">지수 로딩 실패</div>`;
  }
}

// ════════════════════════════════════════
// 주식
// ════════════════════════════════════════
function initStock() {
  renderMarketGrid();
  renderCharts();
  renderInsiders();
  renderCongress();
}

function renderMarketGrid() {
  const markets = [
    { name: '🇺🇸 S&P500',  val: '5,341', chg: 1.2 },
    { name: '🇺🇸 NASDAQ', val: '18,920', chg: 0.8 },
    { name: '🇰🇷 KOSPI',  val: '2,634',  chg: -0.3 },
    { name: '🇯🇵 Nikkei', val: '38,420', chg: 0.5 },
  ];
  document.getElementById('mkt-grid').innerHTML = markets.map(m => `
    <div class="mkt-card">
      <div class="mkt-nm">${m.name}</div>
      <div class="mkt-val">${m.val}</div>
      <div class="mkt-chg ${cls(m.chg)}">${sign(m.chg)}%</div>
    </div>
  `).join('');
}

function makeChartData(base, points, up) {
  const data = [base];
  for (let i = 1; i < points; i++) {
    const prev = data[i-1];
    const delta = (Math.random() - (up ? 0.4 : 0.6)) * base * 0.005;
    data.push(Math.round((prev + delta) * 100) / 100);
  }
  return data;
}

function renderCharts() {
  const labels = ['1w','2w','3w','1m','6w','2m','10w','3m','4m','5m','6m','오늘'];

  new Chart(document.getElementById('chart-sp'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: makeChartData(5100, 12, true),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: 'rgba(255,255,255,.3)', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,.04)' } },
        y: { ticks: { color: 'rgba(255,255,255,.3)', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,.04)' } }
      }
    }
  });

  new Chart(document.getElementById('chart-kospi'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: makeChartData(2700, 12, false),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: 'rgba(255,255,255,.3)', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,.04)' } },
        y: { ticks: { color: 'rgba(255,255,255,.3)', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,.04)' } }
      }
    }
  });
}

function renderInsiders() {
  const insiders = [
    { initials: 'JH', bg: 'rgba(34,197,94,.15)', color: '#22c55e', name: 'NVIDIA · Jensen Huang', sub: 'CEO 직접 매수 · $2,340,000', badge: '매수', bdg: 'bdg-g' },
    { initials: 'EM', bg: 'rgba(239,68,68,.15)', color: '#ef4444', name: 'Tesla · Elon Musk', sub: '임원 매도 · $890,000', badge: '매도', bdg: 'bdg-r' },
    { initials: 'TK', bg: 'rgba(124,58,237,.15)', color: '#a78bfa', name: 'Apple · Tim Cook', sub: 'CEO 매수 · $4,200,000', badge: '매수', bdg: 'bdg-g' },
  ];
  document.getElementById('insider-list').innerHTML = insiders.map(i => `
    <div class="ins-item">
      <div class="ins-av" style="background:${i.bg};color:${i.color}">${i.initials}</div>
      <div class="ins-info">
        <div class="ins-nm">${i.name}</div>
        <div class="ins-sub">${i.sub}</div>
      </div>
      <span class="bdg ${i.bdg}">${i.badge}</span>
    </div>
  `).join('');
}

function renderCongress() {
  const list = [
    { initials: 'NP', bg: 'rgba(59,130,246,.15)', color: '#60a5fa', name: 'Nancy Pelosi', sub: 'NVDA 콜옵션 · $5M 매수', badge: '하원', bdg: 'bdg-b' },
    { initials: 'DM', bg: 'rgba(124,58,237,.15)', color: '#a78bfa', name: 'Dan Meuser', sub: 'MSFT · $250K 매수', badge: '상원', bdg: 'bdg-p' },
    { initials: 'MS', bg: 'rgba(34,197,94,.15)', color: '#22c55e', name: 'Mark Strange', sub: 'AMZN · $180K 매수', badge: '하원', bdg: 'bdg-b' },
  ];
  document.getElementById('congress-list').innerHTML = list.map(i => `
    <div class="ins-item">
      <div class="ins-av" style="background:${i.bg};color:${i.color}">${i.initials}</div>
      <div class="ins-info">
        <div class="ins-nm">${i.name}</div>
        <div class="ins-sub">${i.sub}</div>
      </div>
      <span class="bdg ${i.bdg}">${i.badge}</span>
    </div>
  `).join('');
}

// ════════════════════════════════════════
// 커뮤니티
// ════════════════════════════════════════
const COMM_CONFIG = {
  dcinside:  { name: '디시인사이드', url: 'https://gall.dcinside.com/board/lists/?id=humor', proxy: 'https://api.allorigins.win/get?url=' },
  bobae:     { name: '보배드림',    url: 'https://www.bobaedream.co.kr/list?code=funny', proxy: 'https://api.allorigins.win/get?url=' },
  etoland:   { name: '이토랜드',   url: 'https://www.etoland.co.kr/plugin/sns/board.php?bo_table=etohumor01', proxy: 'https://api.allorigins.win/get?url=' },
  humoruniv: { name: '웃긴대학',   url: 'https://humoruniv.com/board/humor/list.html', proxy: 'https://api.allorigins.win/get?url=' },
  hackernews: { name: 'Hacker News', url: null, proxy: null }
};

let currentComm = 'dcinside';

async function loadComm(site, btn) {
  currentComm = site;
  document.querySelectorAll('.comm-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  const list = document.getElementById('comm-list');
  list.innerHTML = `<div class="loading-box"><div class="spin"></div><span>베스트글 불러오는 중...</span></div>`;

  if (site === 'hackernews') {
    await loadHN();
    return;
  }

  // 국내 커뮤니티는 allorigins 프록시로 스크래핑
  const cfg = COMM_CONFIG[site];
  try {
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(cfg.url)}`);
    const data = await res.json();
    const html = data.contents;
    const posts = parseCommPosts(site, html, cfg.url);

    if (posts.length === 0) {
      list.innerHTML = `<div class="loading-box" style="gap:6px"><div style="font-size:24px">😅</div><div>게시글을 불러올 수 없어요<br>직접 방문해 볼까요?</div><button onclick="openViewer('${cfg.url}','${cfg.name}')" style="margin-top:8px;padding:8px 16px;background:#7c3aed;border:none;border-radius:8px;color:#fff;font-size:12px;cursor:pointer">🔗 ${cfg.name} 바로가기</button></div>`;
      return;
    }

    list.innerHTML = posts.map(p => `
      <div class="post-card" onclick="openViewer('${p.url}','${p.title.replace(/'/g,"\\'")}')">
        <div class="post-site">${cfg.name}</div>
        <div class="post-title">${p.title}</div>
        <div class="post-meta">
          ${p.views ? `<span class="post-stat">👁 ${p.views}</span>` : ''}
          ${p.comments ? `<span class="post-stat">💬 ${p.comments}</span>` : ''}
          ${p.hot ? `<span class="post-hot">🔥 HOT</span>` : ''}
        </div>
      </div>
    `).join('');
  } catch(e) {
    const cfg2 = COMM_CONFIG[site];
    list.innerHTML = `<div class="loading-box"><div style="font-size:12px;color:rgba(255,255,255,.3);text-align:center">불러오기 실패 😅<br><br><button onclick="openViewer('${cfg2.url}','${cfg2.name}')" style="padding:8px 16px;background:#7c3aed;border:none;border-radius:8px;color:#fff;font-size:12px;cursor:pointer">🔗 ${cfg2.name} 바로가기</button></div></div>`;
  }
}

function parseCommPosts(site, html, baseUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const posts = [];

  try {
    if (site === 'dcinside') {
      doc.querySelectorAll('.ub-content tr.us-post, tr[data-no]').forEach(row => {
        const title = row.querySelector('.gall-tit a, .t-tcatls')?.textContent?.trim();
        const views = row.querySelector('.gall-count')?.textContent?.trim();
        const link = row.querySelector('.gall-tit a')?.getAttribute('href');
        if (title && title.length > 2) {
          posts.push({ title, views, url: link ? (link.startsWith('http') ? link : 'https://gall.dcinside.com' + link) : baseUrl, hot: parseInt(views?.replace(/,/g,'')) > 10000 });
        }
      });
    } else if (site === 'bobae') {
      doc.querySelectorAll('.list_body tr, .bbs_list tr').forEach(row => {
        const title = row.querySelector('a.bTitle, td.title a')?.textContent?.trim();
        const link = row.querySelector('a.bTitle, td.title a')?.getAttribute('href');
        const views = row.querySelector('.count')?.textContent?.trim();
        if (title && title.length > 2) {
          posts.push({ title, views, url: link ? (link.startsWith('http') ? link : 'https://www.bobaedream.co.kr' + link) : baseUrl });
        }
      });
    } else {
      // 일반 파싱 - a 태그 중 긴 텍스트
      const links = Array.from(doc.querySelectorAll('a')).filter(a => {
        const txt = a.textContent.trim();
        return txt.length > 10 && txt.length < 100 && !txt.includes('로그인') && !txt.includes('회원');
      }).slice(0, 20);
      links.forEach(a => {
        const title = a.textContent.trim();
        const href = a.getAttribute('href');
        const url = href ? (href.startsWith('http') ? href : new URL(href, baseUrl).href) : baseUrl;
        posts.push({ title, url });
      });
    }
  } catch(e) {}

  return posts.slice(0, 15);
}

async function loadHN() {
  try {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = await res.json();
    const top15 = ids.slice(0, 15);
    const stories = await Promise.all(
      top15.map(id => fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json()).catch(() => null))
    );
    const valid = stories.filter(s => s && s.title);
    document.getElementById('comm-list').innerHTML = valid.map(s => `
      <div class="post-card" onclick="openViewer('${s.url || `https://news.ycombinator.com/item?id=${s.id}`}','${s.title.replace(/'/g,"\\'")}')">
        <div class="post-site">Hacker News</div>
        <div class="post-title">${s.title}</div>
        <div class="post-meta">
          <span class="post-stat">⬆️ ${s.score}</span>
          <span class="post-stat">💬 ${s.descendants||0}</span>
          ${s.score > 300 ? '<span class="post-hot">🔥 HOT</span>' : ''}
        </div>
      </div>
    `).join('');
  } catch(e) {
    document.getElementById('comm-list').innerHTML = `<div class="loading-box">로딩 실패 😅</div>`;
  }
}

// ─── 게시글 뷰어 (미니앱 내부) ───
function openViewer(url, title) {
  document.getElementById('viewer-title').textContent = title;
  document.getElementById('viewer-frame').src = url;
  document.getElementById('viewer').classList.add('open');
}

function closeViewer() {
  document.getElementById('viewer').classList.remove('open');
  document.getElementById('viewer-frame').src = 'about:blank';
}

// ─── 코인 변환기 ───
let btcKrwPrice = 0;
let trxKrwPrice = 0;

async function convertCoin() {
  try {
    const amount = parseFloat(document.getElementById('conv-input')?.value) || 0;
    if (btcKrwPrice === 0) {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tron&vs_currencies=krw');
      const d = await res.json();
      btcKrwPrice = d.bitcoin.krw;
      trxKrwPrice = d.tron.krw;
    }
    const krw = btcKrwPrice * amount;
    const el = document.getElementById('conv-result');
    if (el) el.textContent = '₩' + Math.round(krw).toLocaleString();
  } catch(e) {}
}

async function convertTrx() {
  try {
    const amount = parseFloat(document.getElementById('trx-input')?.value) || 0;
    if (trxKrwPrice === 0) {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tron&vs_currencies=krw');
      const d = await res.json();
      btcKrwPrice = d.bitcoin.krw;
      trxKrwPrice = d.tron.krw;
    }
    const krw = trxKrwPrice * amount;
    const el = document.getElementById('trx-result');
    if (el) el.textContent = '₩' + Math.round(krw).toLocaleString();
  } catch(e) {}
}

// ─── 초기 로딩 ───
initShorts();

// 30초마다 코인 갱신
setInterval(() => {
  if (currentPage === 'coin') {
    loadCoinPrices(); loadKimp();
    btcKrwPrice = 0; trxKrwPrice = 0;
    convertCoin(); convertTrx();
  }
}, 10000);
