// 텔레그램 Web App 초기화
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const BACKEND_URL = "https://your-backend-url.railway.app"; // 배포 후 교체

// 탭 전환
function switchTab(tabName) {
  document.querySelectorAll(".content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
  document.getElementById(`tab-${tabName}`).classList.add("active");
  event.target.classList.add("active");
  loadTabData(tabName);
}

// 탭별 데이터 로딩
function loadTabData(tab) {
  if (tab === "coin") loadCoinData();
  else if (tab === "stock") loadStockData();
  else if (tab === "video") loadVideoData();
  else if (tab === "news") loadNewsData();
}

// 숫자 포맷
function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function sign(v) { return v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2); }
function arrow(v) { return v >= 0 ? "📈" : "📉"; }
function updown(v) { return v >= 0 ? "up" : "down"; }

// 스파크라인 생성
function sparkline(values, color) {
  const max = Math.max(...values);
  return values.map(v => {
    const h = max > 0 ? Math.round((v / max) * 100) : 10;
    return `<div class="spark-bar" style="height:${h}%;background:${color}"></div>`;
  }).join("");
}

// ─── 코인 데이터 ───
async function loadCoinData() {
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple&vs_currencies=usd,krw&include_24hr_change=true`);
    const data = await res.json();

    const coins = [
      { key: "bitcoin",  symbol: "₿ BTC", emoji: "₿" },
      { key: "ethereum", symbol: "Ξ ETH", emoji: "Ξ" },
      { key: "solana",   symbol: "◎ SOL", emoji: "◎" },
      { key: "ripple",   symbol: "✕ XRP", emoji: "✕" }
    ];

    let html = "";
    coins.forEach((c, i) => {
      const d = data[c.key];
      if (!d) return;
      const chg = d.usd_24h_change || 0;
      html += `
        <div class="row" style="margin-bottom:${i < coins.length-1 ? '10px' : '0'}">
          <span class="ticker">${c.symbol}</span>
          <span class="price">$${d.usd.toLocaleString()}</span>
          <span class="${updown(chg)}">${sign(chg)}%</span>
        </div>
      `;
      if (i < coins.length - 1) html += `<div class="divider"></div>`;
    });
    document.getElementById("coin-prices").innerHTML = html;

    // 김프 계산
    await loadKimpData(data.bitcoin);
    loadWhaleData();
    loadOIData();
  } catch (e) {
    document.getElementById("coin-prices").innerHTML = `<div class="loading">데이터 로딩 실패 😅</div>`;
  }
}

async function loadKimpData(btcData) {
  try {
    const upbitRes = await fetch("https://api.upbit.com/v1/ticker?markets=KRW-BTC");
    const upbitData = await upbitRes.json();
    const upbitKrw = upbitData[0].trade_price;

    const binanceRes = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT");
    const binanceData = await binanceRes.json();
    const binanceUsd = parseFloat(binanceData.price);

    const exchangeRate = btcData.krw / btcData.usd;
    const binanceKrw = binanceUsd * exchangeRate;
    const kimp = ((upbitKrw - binanceKrw) / binanceKrw) * 100;
    const kimpFixed = kimp.toFixed(2);
    const kimpWidth = Math.min(Math.max(((kimp + 5) / 10) * 100, 0), 100);
    const status = kimp > 3 ? "🔴 과열" : kimp > 1 ? "🟡 주의" : kimp >= 0 ? "🟢 정상" : "🔵 역프";
    const barColor = kimp > 3 ? "#ef4444" : kimp > 1 ? "#eab308" : kimp >= 0 ? "#22c55e" : "#60a5fa";

    document.getElementById("kimp-card").innerHTML = `
      <div class="row" style="margin-bottom:8px">
        <span class="main-text">BTC 김치 프리미엄</span>
        <span class="${kimp >= 0 ? 'up' : 'down'}" style="font-size:16px;font-weight:700">${sign(parseFloat(kimpFixed))}%</span>
        <span class="badge badge-yellow">${status}</span>
      </div>
      <div class="progress-wrap">
        <div class="progress-bar" style="width:${kimpWidth}%;background:${barColor}"></div>
      </div>
      <div class="progress-labels"><span>역프 -5%</span><span>0%</span><span>과열 +5%</span></div>
      <div class="divider"></div>
      <div class="stat-grid">
        <div class="stat-item"><div class="stat-value" style="font-size:11px">₩${Math.round(upbitKrw/1_000_000*100)/100}M</div><div class="stat-label">업비트</div></div>
        <div class="stat-item"><div class="stat-value" style="font-size:11px">$${Math.round(binanceUsd).toLocaleString()}</div><div class="stat-label">바이낸스</div></div>
        <div class="stat-item"><div class="stat-value" style="font-size:11px">₩${Math.round(exchangeRate).toLocaleString()}</div><div class="stat-label">환율</div></div>
      </div>
    `;
  } catch (e) {
    document.getElementById("kimp-card").innerHTML = `<div class="loading">김프 로딩 실패 😅</div>`;
  }
}

function loadWhaleData() {
  // 정적 예시 데이터 (Whale Alert 유료 API 대체)
  const whales = [
    { icon: "🐋", title: "BTC 대량 이동 감지", sub: "익명지갑 → 바이낸스", amount: "$179M", badge: "badge-red", label: "매도?" },
    { icon: "🏦", title: "ETH 거래소 잔고 감소", sub: "장기보유 신호 감지", amount: "강세", badge: "badge-green", label: "강세" },
  ];
  document.getElementById("whale-cards").innerHTML = whales.map(w => `
    <div class="card ${w.badge === 'badge-red' ? 'alert-red' : 'alert-green'}" style="margin-bottom:8px">
      <div class="alert-row">
        <div class="alert-icon" style="background:rgba(255,255,255,.05)">${w.icon}</div>
        <div style="flex:1">
          <div class="main-text">${w.title}</div>
          <div class="sub-text">${w.sub} · <span class="${w.badge === 'badge-red' ? 'down' : 'up'}">${w.amount}</span></div>
        </div>
        <span class="badge ${w.badge}">${w.label}</span>
      </div>
    </div>
  `).join("");
}

function loadOIData() {
  document.getElementById("oi-card").innerHTML = `
    <div class="row" style="margin-bottom:8px">
      <span class="sub-text">BTC 포지션 비율</span>
      <span class="badge badge-red">롱 과다</span>
    </div>
    <div class="stat-grid">
      <div class="stat-item"><div class="stat-value up">$4.2B</div><div class="stat-label">롱</div></div>
      <div class="stat-item"><div class="stat-value down">$1.8B</div><div class="stat-label">숏</div></div>
      <div class="stat-item"><div class="stat-value neutral">2.3x</div><div class="stat-label">비율</div></div>
    </div>
  `;
}

// ─── 주식 데이터 ───
async function loadStockData() {
  try {
    const indices = [
      { name: "🇺🇸 S&P500", change: 1.2 },
      { name: "🇺🇸 NASDAQ", change: 0.8 },
      { name: "🇰🇷 KOSPI",  change: -0.3 },
      { name: "🇯🇵 Nikkei", change: 0.5 },
      { name: "🇨🇳 상해종합", change: -0.1 },
    ];
    document.getElementById("stock-indices").innerHTML = indices.map((idx, i) => `
      <div class="row" style="margin:${i > 0 ? '8px' : '0'} 0">
        <span class="ticker">${idx.name}</span>
        <span class="${updown(idx.change)}">${sign(idx.change)}%  ${arrow(idx.change)}</span>
      </div>
      ${i < indices.length - 1 ? '<div class="divider"></div>' : ''}
    `).join("");

    // 내부자 거래
    document.getElementById("insider-cards").innerHTML = [
      { initials: "JH", name: "NVIDIA · Jensen Huang", action: "CEO 직접 매수", amount: "$2,340,000", type: "매수", cls: "badge-green" },
      { initials: "EM", name: "Tesla · Elon Musk", action: "임원 매도", amount: "$890,000", type: "매도", cls: "badge-red" },
    ].map(item => `
      <div class="card" style="margin-bottom:8px">
        <div class="alert-row">
          <div class="alert-icon" style="background:rgba(255,255,255,.06);font-size:11px;font-weight:600;color:#a78bfa">${item.initials}</div>
          <div style="flex:1">
            <div class="main-text">${item.name}</div>
            <div class="sub-text">${item.action} · <span class="${item.cls === 'badge-green' ? 'up' : 'down'}">${item.amount}</span></div>
          </div>
          <span class="badge ${item.cls}">${item.type}</span>
        </div>
      </div>
    `).join("");

    // 의원 거래
    document.getElementById("congress-cards").innerHTML = [
      { initials: "NP", name: "Nancy Pelosi", action: "NVDA 콜옵션 매수", amount: "$5M", type: "하원", cls: "badge-blue" },
      { initials: "DM", name: "Dan Meuser", action: "MSFT 매수", amount: "$250K", type: "상원", cls: "badge-purple" },
    ].map(item => `
      <div class="card" style="margin-bottom:8px">
        <div class="alert-row">
          <div class="alert-icon" style="background:rgba(255,255,255,.06);font-size:11px;font-weight:600;color:#60a5fa">${item.initials}</div>
          <div style="flex:1">
            <div class="main-text">${item.name}</div>
            <div class="sub-text">${item.action} · <span class="up">${item.amount}</span></div>
          </div>
          <span class="badge ${item.cls}">${item.type}</span>
        </div>
      </div>
    `).join("");
  } catch(e) {
    console.error("주식 로딩 실패", e);
  }
}

// ─── 영상 데이터 ───
async function loadVideoData() {
  try {
    // YouTube Data API로 실제 급상승 영상 수집
    const ytRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=KR&maxResults=3&key=${YT_API_KEY}`
    );
    const ytData = await ytRes.json();
    const ytVideos = (ytData.items || []).map(item => ({
      platform: "YouTube",
      badge: "badge-red",
      videoId: item.id,
      title: item.snippet.title,
      views: parseInt(item.statistics.viewCount || 0).toLocaleString(),
      likes: parseInt(item.statistics.likeCount || 0).toLocaleString(),
      hot: parseInt(item.statistics.viewCount || 0) > 1_000_000
    }));

    const allVideos = ytVideos.length > 0 ? ytVideos : [
      { platform: "YouTube", badge: "badge-red", videoId: "dQw4w9WgXcQ", title: "유튜브 급상승 영상", views: "1,000,000+", likes: "50,000+", hot: true },
    ];

    document.getElementById("video-cards").innerHTML = allVideos.map(v => `
      <div class="card" style="margin-bottom:10px">
        <div id="player-${v.videoId}" class="yt-thumb" onclick="playVideo('${v.videoId}', this)" style="cursor:pointer">
          <img src="https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg"
               style="width:100%;height:100%;object-fit:cover;border-radius:10px;position:absolute;top:0;left:0">
          <div class="play-btn" style="position:relative;z-index:1;background:rgba(0,0,0,.5)">▶</div>
        </div>
        <div class="row" style="margin:8px 0 6px">
          <span class="badge ${v.badge}">${v.platform}</span>
          ${v.hot ? '<span class="badge badge-yellow">🔥 핫</span>' : ''}
        </div>
        <div class="main-text" style="margin-bottom:6px">${v.title}</div>
        <div class="sub-text">👁 ${v.views} · ❤️ ${v.likes}</div>
      </div>
    `).join("");
  } catch(e) {
    console.error("영상 로딩 실패", e);
    document.getElementById("video-cards").innerHTML = `<div class="loading">영상 로딩 실패 😅</div>`;
  }
}

// 텔레그램 미니앱 안에서 유튜브 재생
function playVideo(videoId, thumbEl) {
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  iframe.style.cssText = "width:100%;height:100%;border:none;border-radius:10px;position:absolute;top:0;left:0";
  iframe.allow = "autoplay; encrypted-media";
  iframe.allowFullscreen = true;
  thumbEl.style.position = "relative";
  thumbEl.innerHTML = "";
  thumbEl.appendChild(iframe);
}

// ─── 핫토픽 데이터 ───
async function loadNewsData() {
  try {
    // Hacker News 실시간 데이터
    const res = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    const ids = await res.json();
    const top10 = ids.slice(0, 10);

    const stories = await Promise.all(
      top10.map(id =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
      )
    );

    const trending = [
      { rank: "1위", flag: "🇺🇸", text: "ChatGPT 5", badge: "badge-yellow", label: "폭발" },
      { rank: "2위", flag: "🇯🇵", text: "AI 자율주행 사고", badge: "badge-red", label: "긴급" },
      { rank: "3위", flag: "🇰🇷", text: "손흥민 해트트릭", badge: "badge-green", label: "화제" },
      { rank: "4위", flag: "🇬🇧", text: "영국 총선 결과", badge: "badge-blue", label: "속보" },
    ];

    document.getElementById("trending-searches").innerHTML = trending.map(t => `
      <div class="row" style="margin:6px 0">
        <span class="sub-text" style="color:#eab308;font-weight:600;min-width:30px">${t.rank}</span>
        <span style="font-size:14px;margin-right:6px">${t.flag}</span>
        <span class="main-text" style="flex:1">${t.text}</span>
        <span class="badge ${t.badge}">${t.label}</span>
      </div>
    `).join('<div class="divider"></div>');

    // HN 실제 데이터
    const validStories = stories.filter(s => s && s.title && s.score > 100).slice(0, 5);
    document.getElementById("news-cards").innerHTML = validStories.map(s => `
      <div class="card" style="margin-bottom:8px">
        <div class="main-text" style="margin-bottom:6px">${s.title}</div>
        <div class="news-meta">
          <span class="badge badge-purple">HN</span>
          <span class="sub-text">⬆️ ${s.score} · 💬 ${s.descendants || 0}</span>
        </div>
        <button class="open-btn" onclick="openLink('${s.url || `https://news.ycombinator.com/item?id=${s.id}`}')">🔗 원문 보기</button>
      </div>
    `).join("");
  } catch(e) {
    document.getElementById("news-cards").innerHTML = `<div class="loading">데이터 로딩 실패 😅</div>`;
  }
}

function openLink(url) {
  // 텔레그램 내부 WebView로 열기 (브라우저 안 열림)
  if (tg) tg.openTelegramLink
    ? window.open(url, "_blank")
    : tg.openLink(url);
  else window.open(url, "_blank");
}

// 초기 로딩
loadCoinData();

// 30초마다 자동 새로고침
setInterval(() => {
  const activeTab = document.querySelector(".content.active");
  if (activeTab?.id === "tab-coin") loadCoinData();
  else if (activeTab?.id === "tab-stock") loadStockData();
}, 30000);
