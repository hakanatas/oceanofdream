/* Hayaller Okyanusu · FTC
 * Kuma yazılan hayaller, dalgalarla okyanusa taşınır.
 * Bağımlılık yok: tek bir 2D canvas üzerinde kum, yazı ve dalga çizilir.
 */
(() => {
  "use strict";

  // ------------------------------------------------------------------
  // Ayarlar — etkinliğine göre burayı düzenle.
  // ------------------------------------------------------------------
  const CONFIG = {
    eventName: "FTC Türkiye",
    // Google E-Tablolar bağlantısı (README → "Hayalleri tabloda topla").
    // Boş bırakılırsa hayaller yalnızca bu tarayıcıda saklanır.
    sheetUrl: "",
    kioskResetSeconds: 60,
    firstQuestion: "Robotum dünyada tek bir şeyi değiştirebilseydi, ...",
    giveQuestion: "Sıra sende... sıradaki katılımcıya ne sormak istersin?",
    // Zincir henüz başlamadığında kullanılan sorular.
    seedQuestions: [
      "Takım arkadaşlarından öğrendiğin en değerli şey neydi?",
      "On yıl sonra hangi sorunu çözen bir mühendis olmak isterdin?",
      "Bir sonraki robotuna hangi süper gücü eklerdin?",
      "Geleceğin şehrinde robotlar insanlara nasıl yardım etmeli?",
      "Rakip bir takıma yardım ettiğin bir anı anlatır mısın?",
      "Bir çocuğa robotik hakkında ilk ne öğretirdin?",
    ],
    // Okyanusta süzülen örnek hayaller.
    seedDreams: [
      "Denizleri temizleyen robotlar",
      "Her okulda bir robotik takımı",
      "Kimse geride kalmasın",
      "Birlikte uzaya gideceğiz!",
      "Depremde enkaz altında kimse kalmasın",
      "Kızlar da mühendis olur, hem de en iyisi",
      "Açlığı bitiren akıllı tarlalar",
      "Rakip değil, yol arkadaşıyız",
      "Engelleri kaldıran protezler",
      "Dünya barışı!!!",
    ],
  };

  const STORE_KEY = "hayaller-okyanusu:v1";
  const QUESTION_KEY = "hayaller-okyanusu:sorular:v1";
  const params = new URLSearchParams(location.search);
  const KIOSK = params.has("kiosk");
  const OCEAN_ONLY = params.has("okyanus");
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Türkçe I/İ doğru küçülsün; aynı kural tablo tarafında da var (backend/Code.gs).
  const trLower = (s) => String(s).trim().replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
  const sigKey = (words) => words.map(trLower).sort().join("|");
  // ?tablo= ile adres denenebilir; hayaller başka bir sunucuya kaçmasın diye yalnızca Apps Script (veya yerel test).
  const tabloParam = params.get("tablo") || "";
  const SHEET_URL = /^(https:\/\/script\.google\.com\/|http:\/\/localhost[:/])/.test(tabloParam)
    ? tabloParam
    : CONFIG.sheetUrl;

  // ------------------------------------------------------------------
  // Depolama. Tablo bağlıysa hayaller oraya gönderilir; bağlantı yoksa
  // veya koparsa bu tarayıcıda kuyruğa alınıp sonra yeniden denenir.
  // ------------------------------------------------------------------
  const QUEUE_KEY = "hayaller-okyanusu:kuyruk:v1";
  const remote = { dreams: null, question: null };

  const store = {
    read(key, fallback) {
      try {
        const v = JSON.parse(localStorage.getItem(key));
        return v ?? fallback;
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* gizli sekme vb. — deneyim yine de çalışır */
      }
    },
    dreams() {
      return this.read(STORE_KEY, []);
    },
    addDream(entry) {
      const all = this.dreams();
      all.push(entry);
      this.write(STORE_KEY, all.slice(-500));
      if (entry.nextQuestion) {
        const pool = this.read(QUESTION_KEY, []);
        pool.push(entry.nextQuestion);
        this.write(QUESTION_KEY, pool.slice(-50));
      }
      if (SHEET_URL) {
        const queue = this.read(QUEUE_KEY, []);
        queue.push(entry);
        this.write(QUEUE_KEY, queue);
        this.flush();
      }
    },
    // Kuyruktaki hayalleri tabloya sırayla gönder.
    async flush() {
      if (!SHEET_URL || this.flushing) return;
      this.flushing = true;
      try {
        let queue = this.read(QUEUE_KEY, []);
        while (queue.length) {
          const res = await fetch(SHEET_URL, {
            method: "POST",
            // text/plain: Apps Script CORS ön isteği desteklemez
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "add", dream: queue[0] }),
          });
          const data = await res.json();
          if (!data.ok && data.error !== "eksik") break;
          queue = this.read(QUEUE_KEY, []).slice(1);
          this.write(QUEUE_KEY, queue);
        }
      } catch {
        /* çevrimdışı: bir sonraki denemede gider */
      } finally {
        this.flushing = false;
      }
    },
    // Okyanustaki hayalleri ve soru zincirini tablodan çek.
    async refresh() {
      if (!SHEET_URL) return;
      try {
        const res = await fetch(SHEET_URL + (SHEET_URL.includes("?") ? "&" : "?") + "action=list");
        const data = await res.json();
        if (data.ok) {
          remote.dreams = data.dreams || [];
          remote.question = data.question || null;
        }
      } catch {
        /* son bilinen liste kullanılmaya devam eder */
      }
    },
    async findBySignature(words) {
      const key = sigKey(words);
      if (SHEET_URL) {
        try {
          const url = SHEET_URL + (SHEET_URL.includes("?") ? "&" : "?") + "action=find&sig=" + encodeURIComponent(key);
          const data = await (await fetch(url)).json();
          if (data.ok) return data.dream;
        } catch {
          /* tabloya ulaşılamazsa bu cihazdakilere bak */
        }
      }
      return this.dreams()
        .reverse()
        .find((d) => sigKey(d.signature) === key);
    },
    dreamTexts() {
      if (remote.dreams) return remote.dreams;
      return this.dreams().map((d) => d.answers[0]).filter(Boolean);
    },
    nextQuestion() {
      if (SHEET_URL && remote.question) return { text: remote.question, fromVisitor: true };
      const pool = this.read(QUESTION_KEY, []);
      if (pool.length) return { text: pool[pool.length - 1], fromVisitor: true };
      const seeds = CONFIG.seedQuestions;
      return { text: seeds[Math.floor(Math.random() * seeds.length)], fromVisitor: false };
    },
  };

  // ------------------------------------------------------------------
  // Simgeler (24×24, yalnızca çizgi)
  // ------------------------------------------------------------------
  function gearPath() {
    const teeth = 8, ro = 10, ri = 7.6, cx = 12, cy = 12;
    let d = "";
    for (let i = 0; i < teeth * 4; i++) {
      const a = (i / (teeth * 4)) * Math.PI * 2;
      const r = i % 4 < 2 ? ro : ri;
      d += (i ? "L" : "M") + (cx + r * Math.cos(a)).toFixed(2) + " " + (cy + r * Math.sin(a)).toFixed(2);
    }
    return d + "Z M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0Z";
  }
  function starPath() {
    let d = "";
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 4.2 : 10;
      d += (i ? "L" : "M") + (12 + r * Math.cos(a)).toFixed(2) + " " + (12.5 + r * Math.sin(a)).toFixed(2);
    }
    return d + "Z";
  }
  const ICONS = {
    dişli: gearPath(),
    robot:
      "M5 8h14v11H5Z M9 12.5h.01 M15 12.5h.01 M9 16h6 M12 8V4.5 M12 4.5h.01 M5 12H3 M19 12h2",
    yıldız: starPath(),
    dalga: "M2 10c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2.5 5-1.5 M2 16c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2.5 5-1.5",
    kalp: "M12 20s-7.5-4.6-9.2-9.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 9.2 3.8C19.5 15.4 12 20 12 20Z",
    roket: "M12 2.5c3.8 2.8 5 7.5 3 12.5H9C7 10 8.2 5.3 12 2.5Z M9 15l-3 4h4 M15 15l3 4h-4 M12 21v-3 M13.5 9a1.5 1.5 0 1 1-3 0a1.5 1.5 0 1 1 3 0Z",
    ampul: "M9 18h6 M10 21h4 M12 3a6 6 0 0 0-4 10.5c1 1 1 2 1 3h6c0-1 0-2 1-3A6 6 0 0 0 12 3Z",
    kupa: "M7 4h10v5a5 5 0 0 1-10 0Z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4 M12 14v4 M8 21h8 M9 18h6",
  };
  const ICON_PATHS = Object.fromEntries(Object.entries(ICONS).map(([k, d]) => [k, new Path2D(d)]));

  // ------------------------------------------------------------------
  // Durum
  // ------------------------------------------------------------------
  const state = {
    step: "intro",
    qIndex: 0,
    questions: [],
    answers: ["", "", ""],
    signature: [],
    stickers: [],
    selected: -1,
    shownDream: null, // "Hayalimi bul" ile gösterilen kayıt
  };

  // ------------------------------------------------------------------
  // Canvas
  // ------------------------------------------------------------------
  const canvas = document.getElementById("sand");
  const ctx = canvas.getContext("2d");
  const ink = document.createElement("canvas");
  const inkCtx = ink.getContext("2d");
  let sandTex = document.createElement("canvas");
  let W = 0, H = 0, DPR = 1;
  let writeRect = { x: 0, y: 0, w: 0, h: 0 };

  const sea = {
    surge: 0, // 0 = sakin, 1 = tüm kumu kaplıyor
    surgeAnim: null,
    wet: [], // her sütun için ıslak kum sınırı
    floaters: [],
  };

  function resize() {
    const r = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    W = Math.round(r.width);
    H = Math.round(r.height);
    for (const c of [canvas, ink]) {
      c.width = Math.round(W * DPR);
      c.height = Math.round(H * DPR);
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    inkCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildSand();
    sea.wet = new Array(Math.ceil(W / 8) + 2).fill(0);
    layout();
  }

  // Kum dokusu: taneler + rüzgâr dalgacıkları, bir kez üretilir.
  function buildSand() {
    const s = 1.25; // doku için biraz düşük çözünürlük yeterli
    const tw = Math.max(1, Math.round(W * s));
    const th = Math.max(1, Math.round(H * s));
    sandTex = document.createElement("canvas");
    sandTex.width = tw;
    sandTex.height = th;
    const c = sandTex.getContext("2d");
    const img = c.createImageData(tw, th);
    const d = img.data;
    let seed = 1337;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const ripple =
          Math.sin(x * 0.045 + Math.sin(y * 0.013) * 2.4 + y * 0.012) * 0.55 +
          Math.sin(x * 0.011 - y * 0.021) * 0.45;
        const g = (rnd() - 0.5) * 26;
        const sparkle = rnd() > 0.9985 ? 40 : 0;
        const shade = ripple * 9 + g + sparkle;
        const i = (y * tw + x) * 4;
        d[i] = 222 + shade;
        d[i + 1] = 200 + shade * 0.95;
        d[i + 2] = 160 + shade * 0.85;
        d[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    // hafif kenar gölgesi
    const v = c.createRadialGradient(tw / 2, th * 0.6, Math.min(tw, th) * 0.2, tw / 2, th * 0.6, Math.max(tw, th) * 0.8);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(60,40,20,0.22)");
    c.fillStyle = v;
    c.fillRect(0, 0, tw, th);
  }

  const isMobile = () => W < 720;

  function ambientLevel(t) {
    const base = isMobile() ? 0.13 : 0.17;
    const amp = REDUCED ? 0.01 : 0.035;
    return base + amp * Math.sin(t * 0.33) + amp * 0.6 * Math.sin(t * 0.81 + 1.3);
  }

  function waterline(x, t, level) {
    const m = REDUCED ? 0.3 : 1;
    return (
      level * H +
      m * (16 * Math.sin(x * 0.007 + t * 0.7) + 9 * Math.sin(x * 0.019 - t * 1.1) + 4 * Math.sin(x * 0.047 + t * 1.9))
    );
  }

  function seaLevel(t) {
    const a = ambientLevel(t);
    const e = sea.surge;
    return a + (1.12 - a) * e;
  }

  // Yazı alanı: panelin kapatmadığı kum.
  function layout() {
    const panel = document.getElementById("panel");
    const pr = panel.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    const top = H * (isMobile() ? 0.21 : 0.3);
    if (OCEAN_ONLY || panel.offsetParent === null) {
      writeRect = { x: W * 0.1, y: top, w: W * 0.8, h: H - top - 40 };
    } else if (isMobile()) {
      writeRect = { x: 20, y: top, w: W - 40, h: Math.max(80, pr.top - cr.top - top - 16) };
    } else {
      const right = pr.left - cr.left - 40;
      writeRect = { x: Math.max(32, W * 0.06), y: top, w: right - Math.max(32, W * 0.06), h: H - top - 70 };
    }
    renderInk();
  }

  // ------------------------------------------------------------------
  // Kuma yazı
  // ------------------------------------------------------------------
  function engrave(c, draw) {
    // Oluk: koyu gölge + açık kenar + gövde
    c.save();
    c.translate(1.2, 1.6);
    draw("rgba(74,50,26,0.55)");
    c.restore();
    c.save();
    c.translate(-1, -1);
    draw("rgba(255,247,228,0.6)");
    c.restore();
    draw("rgba(150,110,66,0.78)");
  }

  function wrapLines(c, text, maxW) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (c.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function messageBlocks() {
    const src = state.shownDream || {
      answers: state.answers,
      signature: state.signature,
    };
    const blocks = [];
    src.answers.slice(0, 2).forEach((a, i) => {
      if (a && a.trim()) blocks.push({ text: a.trim(), size: i === 0 ? 1 : 0.78 });
    });
    if (src.signature && src.signature.length === 3) {
      blocks.push({ text: "— " + src.signature.join(" · "), size: 0.6, sig: true });
    }
    return blocks;
  }

  // Kuma yazma: parmak harf harf ilerler. `shown`, yazılmış karakter sayısı.
  const writing = { shown: 0, total: 0, tip: null, speed: 16 };
  const grains = [];

  function renderInk() {
    if (sea.surgeAnim) return; // dalga yazıyı silerken yeniden çizme
    inkCtx.clearRect(0, 0, W, H);
    const blocks = messageBlocks();
    const r = writeRect;
    writing.tip = null;
    if (r.w < 60 || r.h < 40) return;

    let total = 0;
    if (blocks.length) {
      // En büyük yazı boyutunu, her şey alana sığana kadar küçült.
      let base = Math.min(64, r.w / 8, isMobile() ? 40 : 64);
      let laid;
      for (let tries = 0; tries < 30; tries++) {
        laid = [];
        let y = 0;
        for (const b of blocks) {
          const size = base * b.size;
          inkCtx.font = `700 ${size}px Caveat, cursive`;
          const lines = wrapLines(inkCtx, b.text, r.w);
          laid.push({ ...b, px: size, lines, y });
          y += lines.length * size * 1.02 + size * 0.45;
        }
        if (y <= r.h || base < 18) {
          laid.total = y;
          break;
        }
        base *= 0.92;
      }
      for (const b of laid) for (const ln of b.lines) total += ln.length;
      if (REDUCED) writing.shown = total;
      writing.shown = Math.min(writing.shown, total);

      let budget = writing.shown;
      let oy = r.y + Math.max(0, (r.h - laid.total) / 2);
      inkCtx.textBaseline = "top";
      for (const b of laid) {
        inkCtx.font = `700 ${b.px}px Caveat, cursive`;
        b.lines.forEach((ln, i) => {
          if (budget <= 0) return;
          const tx = r.x;
          const ty = oy + b.y + i * b.px * 1.02;
          const k = Math.min(ln.length, budget);
          budget -= k;
          const done = k >= ln.length;
          let clipW;
          if (done) clipW = inkCtx.measureText(ln).width + b.px;
          else {
            const whole = Math.floor(k);
            clipW =
              inkCtx.measureText(ln.slice(0, whole)).width +
              inkCtx.measureText(ln[whole]).width * (k - whole);
            writing.tip = { x: tx + clipW, y: ty + b.px * 0.62, size: b.px };
          }
          inkCtx.save();
          inkCtx.beginPath();
          inkCtx.rect(tx - b.px * 0.4, ty - b.px * 0.4, clipW + b.px * 0.4, b.px * 1.8);
          inkCtx.clip();
          engrave(inkCtx, (col) => {
            inkCtx.fillStyle = col;
            inkCtx.fillText(ln, tx, ty);
          });
          inkCtx.restore();
        });
      }
    }
    writing.total = total;

    for (const s of state.stickers) drawSticker(inkCtx, s);

    const txt = blocks.map((b) => b.text).join(". ");
    document.getElementById("sandText").textContent = txt ? "Kuma yazılan: " + txt : "";
  }

  // Yazıyı baştan, yeniden yazdır.
  function rewrite() {
    writing.shown = 0;
    renderInk();
  }
  // Animasyonu atla (kartpostal, dalga öncesi).
  function finishWriting() {
    writing.shown = Infinity;
    renderInk();
  }

  // Parmağın ucundan savrulan kum taneleri.
  function stepWriting(dt) {
    if (writing.shown < writing.total && !sea.surgeAnim) {
      writing.shown = Math.min(writing.total, writing.shown + dt * writing.speed * (0.7 + Math.random() * 0.6));
      renderInk();
      const tip = writing.tip;
      if (tip) {
        for (let i = 0; i < 3; i++) {
          grains.push({
            x: tip.x + (Math.random() - 0.5) * 4,
            y: tip.y + (Math.random() - 0.5) * tip.size * 0.5,
            vx: (Math.random() - 0.2) * 70,
            vy: (Math.random() - 0.5) * 70,
            life: 0.35 + Math.random() * 0.45,
            r: 0.7 + Math.random() * 1.5,
          });
        }
      }
    }
    for (let i = grains.length - 1; i >= 0; i--) {
      const g = grains[i];
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.vx *= 0.9;
      g.vy *= 0.9;
      g.life -= dt;
      if (g.life <= 0) grains.splice(i, 1);
    }
  }

  function drawWriting() {
    for (const g of grains) {
      const a = Math.min(1, g.life * 2.5);
      ctx.fillStyle = `rgba(118,86,50,${0.75 * a})`;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,244,220,${0.6 * a})`;
      ctx.beginPath();
      ctx.arc(g.x - 0.5, g.y - 0.5, g.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const tip = writing.tip;
    if (tip && writing.shown < writing.total) {
      // parmak ucunun kumdaki gölgesi
      const rr = Math.max(8, tip.size * 0.22);
      const g = ctx.createRadialGradient(tip.x + 2, tip.y + 3, 0, tip.x + 2, tip.y + 3, rr);
      g.addColorStop(0, "rgba(60,40,20,0.35)");
      g.addColorStop(1, "rgba(60,40,20,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(tip.x + 2, tip.y + 3, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSticker(c, s) {
    const p = ICON_PATHS[s.type];
    engrave(c, (col) => {
      c.save();
      c.translate(s.x, s.y);
      c.scale(s.size / 24, s.size / 24);
      c.translate(-12, -12);
      c.strokeStyle = col;
      c.lineWidth = 2.1;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.stroke(p);
      c.restore();
    });
  }

  // ------------------------------------------------------------------
  // Okyanus çizimi
  // ------------------------------------------------------------------
  function allDreamTexts() {
    return [...CONFIG.seedDreams, ...store.dreamTexts()];
  }

  // Her şeride tek bir hayal: yazılar üst üste binmez.
  const LANES = 14;
  function spawnFloater(fresh, lane) {
    const texts = allDreamTexts();
    const dir = lane % 2 ? -1 : 1;
    return {
      lane,
      text: texts[Math.floor(Math.random() * texts.length)],
      x: fresh ? Math.random() * W * 0.8 : dir > 0 ? -W * (0.2 + Math.random() * 0.6) : W + W * Math.random() * 0.6,
      speed: dir * (10 + Math.random() * 14),
      size: 20 + Math.random() * 8,
      alpha: 0.3 + Math.random() * 0.3,
    };
  }

  function drawOcean(t, dt) {
    const level = seaLevel(t);
    const step = 8;
    const pts = [];
    for (let x = -step, i = 0; x <= W + step; x += step, i++) {
      const y = waterline(x, t, level);
      pts.push([x, y]);
      // ıslak kum: suyun ulaştığı en uç çizgi yavaşça kurur
      const prev = sea.wet[i] || 0;
      sea.wet[i] = Math.max(y, prev - dt * 20);
    }

    // Islak kum bandı
    ctx.beginPath();
    ctx.moveTo(-step, 0);
    pts.forEach(([x], i) => ctx.lineTo(x, sea.wet[i] + 18));
    ctx.lineTo(W + step, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(92,70,42,0.2)";
    ctx.fill();

    // Su gövdesi
    const lineY = level * H;
    const grad = ctx.createLinearGradient(0, 0, 0, Math.max(lineY + 20, 40));
    grad.addColorStop(0, "rgba(10,31,38,0.98)");
    grad.addColorStop(0.55, "rgba(19,71,80,0.9)");
    grad.addColorStop(0.9, "rgba(54,140,140,0.55)");
    grad.addColorStop(1, "rgba(120,200,190,0.28)");
    ctx.beginPath();
    ctx.moveTo(-step, -10);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(W + step, -10);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Işık kırılmaları
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "rgba(200,240,235,0.06)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 7; k++) {
      ctx.beginPath();
      const yy = (k / 7) * lineY;
      for (let x = 0; x <= W; x += 24) {
        const y = yy + 6 * Math.sin(x * 0.02 + t * 0.9 + k) + 4 * Math.sin(x * 0.051 - t * 1.4 + k * 2);
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }

    // Süzülen hayaller
    if (!sea.floaters.length) for (let i = 0; i < LANES; i++) sea.floaters.push(spawnFloater(true, i));
    ctx.textBaseline = "middle";
    const laneH = Math.max(44, H / LANES);
    sea.floaters.forEach((f, i) => {
      f.x += f.speed * dt;
      ctx.font = `600 ${f.size}px Caveat, cursive`;
      const w = ctx.measureText(f.text).width;
      if ((f.speed > 0 && f.x > W + 40) || (f.speed < 0 && f.x + w < -60)) sea.floaters[i] = spawnFloater(false, f.lane);
      const y = 64 + f.lane * laneH + 4 * Math.sin(t * 0.8 + i);
      if (y > lineY - 24) return;
      ctx.fillStyle = `rgba(232,244,240,${f.alpha})`;
      ctx.fillText(f.text, f.x, y);
    });
    ctx.restore();

    // Köpük
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const foam = (off, width, alpha) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + off) : ctx.moveTo(x, y + off)));
      ctx.strokeStyle = `rgba(250,253,250,${alpha})`;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    foam(0, 7, 0.55);
    foam(-2, 2.5, 0.85);
    foam(-14 - 4 * Math.sin(t * 1.3), 2, 0.25);
    // köpük kabarcıkları
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let i = 0; i < pts.length; i += 2) {
      const [x, y] = pts[i];
      const n = Math.sin(i * 12.9898 + Math.floor(t * 3) * 0.7) * 43758.5453;
      const f = n - Math.floor(n);
      if (f > 0.55) {
        ctx.beginPath();
        ctx.arc(x + f * 6, y + 3 + f * 7, 1 + f * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return pts;
  }

  // Suyun altında kalan yazıyı yavaşça sil.
  function erodeInk(pts) {
    inkCtx.save();
    inkCtx.globalCompositeOperation = "destination-out";
    inkCtx.beginPath();
    inkCtx.moveTo(-10, -10);
    pts.forEach(([x, y]) => inkCtx.lineTo(x, y));
    inkCtx.lineTo(W + 10, -10);
    inkCtx.closePath();
    inkCtx.fillStyle = "rgba(0,0,0,0.07)";
    inkCtx.fill();
    inkCtx.restore();
  }

  function drawSelection() {
    const s = state.stickers[state.selected];
    if (!s || state.step !== "review") return;
    const r = s.size * 0.7;
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(10,31,38,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const [hx, hy] = handlePos(s);
    const [dx, dy] = deletePos(s);
    ctx.fillStyle = "#0a1f26";
    ctx.beginPath();
    ctx.arc(hx, hy, 11, 0, Math.PI * 2);
    ctx.arc(dx, dy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e9c46a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - 4, hy + 4); ctx.lineTo(hx + 4, hy - 4);
    ctx.moveTo(hx + 1, hy - 4); ctx.lineTo(hx + 4, hy - 4); ctx.lineTo(hx + 4, hy - 1);
    ctx.moveTo(dx - 4, dy - 4); ctx.lineTo(dx + 4, dy + 4);
    ctx.moveTo(dx + 4, dy - 4); ctx.lineTo(dx - 4, dy + 4);
    ctx.stroke();
    ctx.restore();
  }
  const handlePos = (s) => [s.x + s.size * 0.5, s.y + s.size * 0.5];
  const deletePos = (s) => [s.x + s.size * 0.5, s.y - s.size * 0.5];

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    if (sea.surgeAnim) sea.surgeAnim(now);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(sandTex, 0, 0, W, H);
    ctx.drawImage(ink, 0, 0, W, H);
    const pts = drawOcean(t, dt);
    if (sea.surge > 0.05) erodeInk(pts);
    stepWriting(dt);
    drawWriting();
    drawSelection();
    requestAnimationFrame(frame);
  }

  // Büyük dalga: yükselir, bekler, çekilir.
  function surge() {
    return new Promise((resolve) => {
      const start = performance.now();
      const up = REDUCED ? 1200 : 2400, hold = 900, down = REDUCED ? 1400 : 3000;
      const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));
      sea.surgeAnim = (now) => {
        const e = now - start;
        if (e < up) sea.surge = ease(e / up);
        else if (e < up + hold) sea.surge = 1;
        else if (e < up + hold + down) sea.surge = 1 - ease((e - up - hold) / down);
        else {
          sea.surge = 0;
          sea.surgeAnim = null;
          resolve();
        }
      };
    });
  }

  // ------------------------------------------------------------------
  // Adımlar
  // ------------------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function go(step) {
    state.step = step;
    $$(".step").forEach((el) => (el.hidden = el.dataset.step !== step));
    if (step !== "review") state.selected = -1;
    // Kum yalnızca süsleme adımında dokunuşu yakalar; diğer adımlarda sayfa kaydırılabilir.
    canvas.classList.toggle("grab", step === "review");
    const first = $(`.step[data-step="${step}"] textarea, .step[data-step="${step}"] input:not([type=checkbox])`);
    if (first && !KIOSK_TOUCH) setTimeout(() => first.focus({ preventScroll: true }), 50);
    requestAnimationFrame(layout);
    bumpIdle();
  }
  const KIOSK_TOUCH = matchMedia("(pointer: coarse)").matches;

  function resetJourney() {
    Object.assign(state, {
      qIndex: 0,
      questions: [],
      answers: ["", "", ""],
      signature: [],
      stickers: [],
      selected: -1,
      shownDream: null,
    });
    $("#consentBox").checked = false;
    $("#consentGo").disabled = true;
    $$("#sigForm input, #findForm input").forEach((i) => (i.value = ""));
    $("#shareStatus").textContent = "";
    $("#findStatus").textContent = "";
    renderInk();
  }

  function showQuestion(i) {
    state.qIndex = i;
    const q = state.questions[i];
    $("#qIndex").textContent = String(i + 1);
    $("#qText").textContent = q.text;
    $("#qFrom").hidden = !q.fromVisitor;
    const input = $("#qInput");
    input.value = state.answers[i] || "";
    $("#qCount").textContent = String(input.value.length);
    input.placeholder = i === 2 ? "Sıradaki katılımcıya bir soru bırak..." : "Hayallerinin dünyasına adım at...";
    go("question");
  }

  function fillConfigText() {
    const line = $('[data-config="eventLine"]');
    line.textContent = `${CONFIG.eventName} · FIRST Tech Challenge`;
    $('[data-config="releasedBody"]').textContent =
      "Sözlerin artık Hayaller Okyanusu'nun bir parçası ve dalgalarla birlikte süzülecek. " +
      "Hayalini yeniden bulmak için bu siteye dön ve üç kelimelik imzanı gir.";
  }

  // ------------------------------------------------------------------
  // Etkileşimler
  // ------------------------------------------------------------------
  function bind() {
    $$("[data-go]").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.go === "intro" || b.dataset.go === "find") resetJourney();
        go(b.dataset.go);
      })
    );

    $("#consentBox").addEventListener("change", (e) => ($("#consentGo").disabled = !e.target.checked));
    $("#consentGo").addEventListener("click", () => {
      const q2 = store.nextQuestion();
      state.questions = [
        { text: CONFIG.firstQuestion, fromVisitor: false },
        q2,
        { text: CONFIG.giveQuestion, fromVisitor: false },
      ];
      showQuestion(0);
    });

    const qInput = $("#qInput");
    qInput.addEventListener("input", () => {
      $("#qCount").textContent = String(qInput.value.length);
      bumpIdle();
    });
    qInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        $("#qForm").requestSubmit();
      }
    });
    $("#qForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = qInput.value.replace(/\s+/g, " ").trim();
      if (!v) return;
      state.answers[state.qIndex] = v;
      if (state.qIndex < 2) renderInk(); // 3. cevap kuma değil, sıradakine gider
      if (state.qIndex < 2) showQuestion(state.qIndex + 1);
      else go("signature");
    });

    $("#sigForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const words = $$("#sigForm input").map((i) => i.value.replace(/\s+/g, "").trim());
      if (words.some((w) => !w)) return;
      state.signature = words;
      go("review");
      renderInk();
    });

    // Simge tepsisi
    const tray = $("#tray");
    Object.entries(ICONS).forEach(([name, d]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", name + " simgesi ekle");
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
      b.addEventListener("click", () => {
        const r = writeRect;
        const size = Math.min(72, Math.max(44, r.w / 8));
        state.stickers.push({
          type: name,
          x: r.x + r.w * (0.25 + Math.random() * 0.5),
          y: r.y + r.h * (0.2 + Math.random() * 0.6),
          size,
        });
        state.selected = state.stickers.length - 1;
        renderInk();
      });
      tray.appendChild(b);
    });

    // Cevap düzenleme
    $("#editBtn").addEventListener("click", () => {
      const list = $("#editList");
      list.innerHTML = "";
      [0, 1].forEach((i) => {
        const wrap = document.createElement("div");
        const label = document.createElement("label");
        label.textContent = state.questions[i].text;
        label.htmlFor = "edit" + i;
        const ta = document.createElement("textarea");
        ta.id = "edit" + i;
        ta.rows = 2;
        ta.maxLength = 120;
        ta.value = state.answers[i];
        wrap.append(label, ta);
        list.appendChild(wrap);
      });
      go("edit");
    });
    $("#editSave").addEventListener("click", () => {
      [0, 1].forEach((i) => {
        const v = $("#edit" + i).value.replace(/\s+/g, " ").trim();
        if (v) state.answers[i] = v;
      });
      go("review");
      rewrite();
    });

    $("#releaseBtn").addEventListener("click", release);
    $("#postcardBtn").addEventListener("click", downloadPostcard);
    $("#shareBtn").addEventListener("click", share);
    $("#againBtn").addEventListener("click", () => {
      resetJourney();
      go("consent");
    });

    $("#findForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const words = $$("#findForm input").map((i) => i.value.trim());
      const status = $("#findStatus");
      status.textContent = "Kumda aranıyor...";
      const hit = await store.findBySignature(words);
      if (!hit) {
        status.textContent = SHEET_URL
          ? "Bu imzayla bir hayal bulamadık. Kelimeleri kontrol et."
          : "Bu imzayla bir hayal bulamadık. Kelimeleri kontrol et — hayaller yalnızca gönderildikleri cihazda saklanır.";
        return;
      }
      status.textContent = "Hayalin kıyıya vurdu!";
      state.shownDream = hit;
      state.stickers = (hit.stickers || []).map(fromRelative).filter(Boolean);
      rewrite();
    });

    bindStickerPointer();

    new ResizeObserver(() => requestAnimationFrame(layout)).observe($("#panel"));
    addEventListener("resize", () => {
      clearTimeout(resize.t);
      resize.t = setTimeout(resize, 120);
    });
  }

  function bindStickerPointer() {
    let drag = null;
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const near = (a, b, d) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= d;

    canvas.addEventListener("pointerdown", (e) => {
      if (state.step !== "review") return;
      const p = pos(e);
      const sel = state.stickers[state.selected];
      if (sel && near(p, deletePos(sel), 16)) {
        state.stickers.splice(state.selected, 1);
        state.selected = -1;
        renderInk();
        return;
      }
      if (sel && near(p, handlePos(sel), 16)) {
        drag = { mode: "resize", s: sel, start: p, size: sel.size };
      } else {
        const i = state.stickers.findLastIndex((s) => near(p, [s.x, s.y], s.size * 0.6));
        state.selected = i;
        if (i < 0) return;
        const s = state.stickers[i];
        drag = { mode: "move", s, dx: p[0] - s.x, dy: p[1] - s.y };
      }
      canvas.setPointerCapture(e.pointerId);
      bumpIdle();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const p = pos(e);
      if (drag.mode === "move") {
        drag.s.x = p[0] - drag.dx;
        drag.s.y = p[1] - drag.dy;
      } else {
        const d = (p[0] - drag.start[0] + p[1] - drag.start[1]) / 2;
        drag.s.size = Math.max(24, Math.min(220, drag.size + d * 2));
      }
      renderInk();
    });
    const end = () => (drag = null);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener(
      "wheel",
      (e) => {
        const s = state.stickers[state.selected];
        if (state.step !== "review" || !s) return;
        e.preventDefault();
        s.size = Math.max(24, Math.min(220, s.size * (e.deltaY < 0 ? 1.08 : 0.93)));
        renderInk();
      },
      { passive: false }
    );
  }

  // ------------------------------------------------------------------
  // Bırakma, kartpostal, paylaşım
  // ------------------------------------------------------------------
  let postcard = null;

  // Simgeler yazı alanına göre oransal saklanır; başka ekranda da yerini bulur.
  const round = (n) => Math.round(n * 1000) / 1000;
  function toRelative(s) {
    const r = writeRect;
    return { type: s.type, fx: round((s.x - r.x) / r.w), fy: round((s.y - r.y) / r.h), fs: round(s.size / r.w) };
  }
  function fromRelative(s) {
    if (!s || !ICON_PATHS[s.type]) return null;
    if (s.fx === undefined) return s; // eski kayıt: mutlak konum
    const r = writeRect;
    return { type: s.type, x: r.x + s.fx * r.w, y: r.y + s.fy * r.h, size: Math.max(24, s.fs * r.w) };
  }

  async function release() {
    state.selected = -1;
    // Dalgadan önce kumun anlık görüntüsünü kartpostal için al.
    finishWriting();
    postcard = makePostcard();
    const entry = {
      answers: state.answers.slice(0, 2),
      question2: state.questions[1] ? state.questions[1].text : "",
      nextQuestion: state.answers[2] || "",
      signature: state.signature,
      stickers: state.stickers.map(toRelative),
      at: new Date().toISOString(),
    };
    store.addDream(entry);
    // yeni hayal hemen okyanusta süzülsün
    const lane = Math.floor(Math.random() * 3);
    sea.floaters[lane] = { ...spawnFloater(false, lane), text: entry.answers[0], x: W * 0.3, alpha: 0.7 };

    $("#releaseBtn").disabled = true;
    $("#panel").style.opacity = "0";
    $("#panel").style.pointerEvents = "none";
    await surge();
    $("#panel").style.opacity = "";
    $("#panel").style.pointerEvents = "";
    $("#releaseBtn").disabled = false;
    $("#sigOut").textContent = state.signature.join(" · ");
    state.stickers = [];
    state.answers = ["", "", ""];
    state.signature = [];
    go("released");
  }

  function makePostcard() {
    const pw = 1200, ph = 800;
    const c = document.createElement("canvas");
    c.width = pw;
    c.height = ph;
    const p = c.getContext("2d");
    // Yazı alanının etrafını kırp
    const r = writeRect;
    const pad = 40;
    const sx = Math.max(0, r.x - pad), sy = Math.max(0, r.y - pad * 2);
    const sw = Math.min(W - sx, r.w + pad * 2), sh = Math.min(H - sy, r.h + pad * 3);
    const scale = Math.max(pw / sw, (ph - 110) / sh);
    const dw = sw * scale, dh = sh * scale;
    const dx = (pw - dw) / 2, dy = (ph - 110 - dh) / 2;
    p.drawImage(sandTex, (sx / W) * sandTex.width, (sy / H) * sandTex.height, (sw / W) * sandTex.width, (sh / H) * sandTex.height, dx, dy, dw, dh);
    p.drawImage(ink, sx * DPR, sy * DPR, sw * DPR, sh * DPR, dx, dy, dw, dh);
    // Alt bant
    p.fillStyle = "#0a1f26";
    p.fillRect(0, ph - 110, pw, 110);
    p.fillStyle = "#e9c46a";
    p.font = "600 34px Fraunces, Georgia, serif";
    p.textBaseline = "middle";
    p.fillText("Hayaller Okyanusu", 44, ph - 68);
    p.fillStyle = "#b9c6c4";
    p.font = "400 20px Inter, sans-serif";
    p.fillText(`${CONFIG.eventName} · FIRST Tech Challenge · ${location.host || "hayaller-okyanusu"}`, 44, ph - 34);
    p.fillStyle = "#f4efe4";
    p.font = "700 34px Caveat, cursive";
    p.textAlign = "right";
    p.fillText(state.signature.join(" · "), pw - 44, ph - 55);
    return c;
  }

  function downloadPostcard() {
    if (!postcard) return;
    const a = document.createElement("a");
    a.href = postcard.toDataURL("image/png");
    a.download = "hayaller-okyanusu-kartpostal.png";
    a.click();
  }

  async function share() {
    const status = $("#shareStatus");
    const text = "Hayaller Okyanusu'na bir hayal bıraktım. Sen de kendi hayalini ekle!";
    const url = location.origin + location.pathname;
    try {
      if (postcard && navigator.canShare) {
        const blob = await new Promise((r) => postcard.toBlob(r, "image/png"));
        const file = new File([blob], "hayaller-okyanusu.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text, url });
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ title: "Hayaller Okyanusu", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      status.textContent = "Paylaşım bağlantısı kopyalandı.";
    } catch (err) {
      if (err && err.name === "AbortError") return;
      downloadPostcard();
      status.textContent = "Sistem paylaşımı burada kullanılamıyor; kartpostalın indirildi.";
    }
  }

  // ------------------------------------------------------------------
  // Kiosk: hareketsiz kalınca başa dön
  // ------------------------------------------------------------------
  let idleTimer = 0;
  function bumpIdle() {
    if (!KIOSK) return;
    clearTimeout(idleTimer);
    if (state.step === "intro") return;
    idleTimer = setTimeout(() => {
      resetJourney();
      go("intro");
    }, CONFIG.kioskResetSeconds * 1000);
  }

  // ------------------------------------------------------------------
  // Başlat
  // ------------------------------------------------------------------
  function start() {
    if (KIOSK) document.body.classList.add("kiosk");
    if (OCEAN_ONLY) document.body.classList.add("ocean-only");
    fillConfigText();
    bind();
    resize();
    if (KIOSK) addEventListener("pointerdown", bumpIdle, { passive: true });
    // Yazı tipi yüklenince kumu yeniden yaz
    if (document.fonts) {
      document.fonts.load("700 40px Caveat").then(renderInk, () => {});
      document.fonts.ready.then(renderInk);
    }
    requestAnimationFrame(frame);
    // Tablodan okyanusu ve soru zincirini düzenli olarak tazele.
    if (SHEET_URL) {
      store.flush();
      store.refresh();
      setInterval(() => {
        store.flush();
        store.refresh();
      }, (OCEAN_ONLY ? 20 : 60) * 1000);
    }
  }

  start();
})();
