/* 부산 홍보 대사 - 앱 동작
   설정은 js/config.js, 기사는 data/articles.js, 알리는 방법은 data/methods.js 에서 바꿉니다. */
(function () {
  "use strict";

  var CFG = window.APP_CONFIG || {};
  var ARTICLES = window.ARTICLES || [];
  var METHODS = window.METHODS || [];
  var EXTRA_QUIZ = window.EXTRA_QUIZ || [];
  var EX = CFG.examples || {};
  var SCRAP_MIN = CFG.scrapMin || 3;
  var QUIZ_COUNT = CFG.quizCount || 10;
  var STORAGE_KEY = CFG.storageKey || "busanPR_v1";

  var CATS = {
    nature: { name: "자연환경", emoji: "🌊", why: "자연이 만든 모습이에요." },
    culture: { name: "역사·문화", emoji: "🏯", why: "사람들이 만들고 지켜 온 역사와 문화예요." },
    product: { name: "생산물", emoji: "🐟", why: "부산에서 나거나 부산에서 만든 것이에요." }
  };
  var CAT_KEYS = ["nature", "culture", "product"];
  var STEP_NAMES = ["시작", "알리는 방법", "기사 스크랩", "소개할 내용", "퀴즈", "계획하기", "설계도", "마무리"];
  var PLAN_PARTS = [
    { key: "title", label: "제목", cls: "p-title" },
    { key: "intro", label: "처음", cls: "p-intro" },
    { key: "middle", label: "중간", cls: "p-middle" },
    { key: "ending", label: "마무리", cls: "p-ending" }
  ];
  var CHECKS = ["제목을 정했나요?", "부산의 특징이 들어 있나요?", "좋은 점을 강조했나요?", "사진과 글의 출처를 적었나요?"];

  /* ---------------- 상태 ---------------- */
  function defaults() {
    return {
      step: 0, maxStep: 0,
      student: { num: "", name: "" },
      sub: {},
      flipped: [], matchDone: false,
      scraps: [], custom: [],
      topicId: null,
      content: { topic: "", feature: "", story: "", good: "", memo: "" },
      quiz: null,
      plan: { method: null, title: "", intro: "", middle1: "", middle2: "", ending: "", photos: "" },
      checklist: [false, false, false, false],
      wrap: { best: "", reason: "", feeling: "" }
    };
  }
  function load() {
    var d = defaults();
    try {
      var s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (s && typeof s === "object") {
        Object.keys(d).forEach(function (k) {
          if (s[k] === undefined || s[k] === null) return;
          if (d[k] && typeof d[k] === "object" && !Array.isArray(d[k])) d[k] = Object.assign(d[k], s[k]);
          else d[k] = s[k];
        });
      }
    } catch (e) { /* 저장된 기록을 읽지 못하면 새로 시작 */ }
    return d;
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 저장 공간이 없으면 넘어감 */ }
  }
  var state = load();
  var ui = { tab: "nature", match: null, lastScreen: "" };

  /* ---------------- 도구 ---------------- */
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function has(v) { return String(v || "").trim().length > 0; }
  function getPath(path) {
    return path.split(".").reduce(function (o, k) { return o ? o[k] : undefined; }, state);
  }
  function setPath(path, val) {
    var ks = path.split("."), o = state;
    for (var i = 0; i < ks.length - 1; i++) o = o[ks[i]];
    o[ks[ks.length - 1]] = val;
  }
  function josa(word, a, b) { // 받침 있으면 a, 없으면 b
    var c = String(word).charCodeAt(String(word).length - 1);
    if (c < 0xac00 || c > 0xd7a3) return b;
    return (c - 0xac00) % 28 ? a : b;
  }
  var CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  function chosung(s) {
    return String(s).split("").map(function (ch) {
      var c = ch.charCodeAt(0);
      return c >= 0xac00 && c <= 0xd7a3 ? CHO[Math.floor((c - 0xac00) / 588)] : ch;
    }).join("");
  }
  function getArticle(id) {
    return ARTICLES.concat(state.custom).filter(function (a) { return a.id === id; })[0] || null;
  }
  function getMethod(id) {
    return METHODS.filter(function (m) { return m.id === id; })[0] || null;
  }
  function planName(m) { return m ? m.name.replace("전시회", "전시") : ""; }
  function whoText() {
    return has(state.student.name) ? state.student.num + "번 " + state.student.name : "";
  }
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }
  function copyText(text, msg) {
    function done() { toast(msg || "복사했어요!"); }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { toast("복사하지 못했어요. 글을 직접 골라서 복사해요."); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  /* ---------------- 다음 단계 조건 ---------------- */
  function canNext(step) {
    var c = state.content, p = state.plan;
    switch (step) {
      case 0: return has(state.student.num) && has(state.student.name) ? ok() : no("번호와 이름을 써요.");
      case 1: return state.matchDone ? ok() : no("카드 6장을 보고 짝 맞추기를 끝내요.");
      case 2:
        return state.scraps.length >= SCRAP_MIN ? ok()
          : no("기사를 " + SCRAP_MIN + "개 이상 스크랩해요. (지금 " + state.scraps.length + "개)");
      case 3:
        if (!state.topicId || !getArticle(state.topicId)) return no("소개할 주제를 하나 골라요.");
        return has(c.topic) && has(c.feature) && has(c.story) && has(c.good) ? ok() : no("표의 네 칸을 모두 써요.");
      case 4: return state.quiz && state.quiz.done ? ok() : no("퀴즈를 끝까지 풀어요.");
      case 5:
        if (!p.method) return no("알리는 방법을 하나 골라요.");
        return has(p.title) && has(p.intro) && has(p.middle1) && has(p.middle2) && has(p.ending)
          ? ok() : no("구성표의 네 칸을 모두 써요.");
      default: return ok();
    }
    function ok() { return { ok: true, hint: "" }; }
    function no(h) { return { ok: false, hint: h }; }
  }

  /* ---------------- 화면 그리기 ---------------- */
  function render() {
    $("who").textContent = whoText();
    renderProgress();
    var views = [view0, view1, view2, view3, view4, view5, view6, view7];
    $("main").innerHTML = views[state.step]();
    renderNav();
    var screen = state.step + ":" + (state.sub[state.step] || "") + ":" + (state.quiz ? state.quiz.pos + "-" + state.quiz.round : "");
    if (screen !== ui.lastScreen) { window.scrollTo(0, 0); ui.lastScreen = screen; }
  }
  function renderProgress() {
    var html = "";
    for (var i = 1; i <= 7; i++) {
      var cls = i === state.step ? "is-now" : (i <= state.maxStep ? "is-done" : "");
      var dis = i <= state.maxStep && state.step !== 0 ? "" : " disabled";
      html += '<button type="button" class="pstep ' + cls + '" data-act="goto" data-step="' + i + '"' + dis +
        (i === state.step ? ' aria-current="step"' : "") + '><span class="pnum">' + i + '</span><span class="pname">' +
        STEP_NAMES[i] + "</span></button>";
    }
    $("progress").innerHTML = html;
    $("progress").hidden = state.step === 0;
  }
  function renderNav() {
    var nav = $("nav");
    if (state.step === 0) { nav.innerHTML = ""; nav.hidden = true; return; }
    nav.hidden = false;
    var html = '<button type="button" class="btn btn-ghost" data-act="prev">← 이전</button>';
    if (state.step < 7) {
      html += '<span id="nav-hint" class="nav-hint"></span>' +
        '<button type="button" id="next-btn" class="btn btn-primary" data-act="next">다음 →</button>';
    }
    nav.innerHTML = html;
    updateNav();
  }
  function updateNav() {
    var btn = $("next-btn");
    if (!btn) return;
    var r = canNext(state.step);
    btn.disabled = !r.ok;
    $("nav-hint").textContent = r.ok ? "잘했어요! 다음으로 가요." : r.hint;
    $("nav-hint").classList.toggle("is-ok", r.ok);
  }
  function go(step) {
    state.step = Math.max(0, Math.min(7, step));
    state.maxStep = Math.max(state.maxStep, state.step);
    save(); render();
  }
  function head(n, title, todo) {
    return '<div class="step-head"><p class="step-no">' + n + "단계</p><h1>" + title + '</h1><p class="todo">👉 ' + todo + "</p></div>";
  }

  /* ---------------- 0. 시작 ---------------- */
  function view0() {
    var missions = [
      "지역을 알리는 방법 알아보기", "부산 기사 스크랩하기", "소개할 내용 정하기", "퀴즈 풀기",
      "발표자료 계획하기", "나의 제작 설계도 만들기", "친구 발표 듣고 마무리하기"
    ];
    return '<section class="hero">' +
      '<div class="hero-card pinned">' +
      '<p class="eyebrow">사회 4학년 · 지역을 알리는 자료를 만들어 볼까요?</p>' +
      '<h1 class="hero-title">부산 홍보 대사</h1>' +
      '<p class="hero-lead">내가 부산을 알리는 홍보 대사가 되어 보아요.<br>부산을 대표하는 것을 찾아 알리는 자료를 계획해요.</p>' +
      '<div class="start-form">' +
      '<label>번호<input type="text" inputmode="numeric" maxlength="2" data-bind="student.num" value="' + esc(state.student.num) + '" placeholder="예: 7"></label>' +
      '<label>이름<input type="text" maxlength="10" data-bind="student.name" value="' + esc(state.student.name) + '" placeholder="이름을 써요"></label>' +
      "</div>" +
      '<p id="start-hint" class="form-hint"></p>' +
      '<button type="button" class="btn btn-primary btn-big" data-act="start">홍보 대사 출발 🚀</button>' +
      "</div>" +
      '<div class="mission-card pinned"><h2>오늘의 미션</h2><ol class="missions">' +
      missions.map(function (m) { return "<li>" + m + "</li>"; }).join("") +
      '</ol><p class="note">혼자서 처음부터 끝까지 해 보아요. 쓴 내용은 이 기기에 저장돼요.</p></div>' +
      "</section>";
  }

  /* ---------------- 1. 알리는 방법 ---------------- */
  function view1() {
    return state.sub[1] === "match" ? view1Match() : view1Cards();
  }
  function flipStatus() {
    var n = state.flipped.length;
    if (n < METHODS.length) return '<p class="count-pill">확인한 카드 <b>' + n + "</b> / " + METHODS.length + "</p>";
    return '<p class="count-pill is-ok">카드를 모두 확인했어요!</p>' +
      '<button type="button" class="btn btn-primary btn-big" data-act="sub" data-sub="match">' +
      (state.matchDone ? "짝 맞추기 다시 하기" : "짝 맞추기 하러 가기 →") + "</button>";
  }
  function view1Cards() {
    return head(1, "지역을 알리는 방법 알아보기", "카드를 눌러 뒤집어 보세요. 6장을 모두 확인해요.") +
      '<div class="flip-grid">' + METHODS.map(function (m) {
        var f = state.flipped.indexOf(m.id) >= 0;
        return '<button type="button" class="flip' + (f ? " is-flipped" : "") + '" data-act="flip" data-id="' + m.id + '" aria-pressed="' + f + '">' +
          '<span class="flip-inner">' +
          '<span class="flip-face flip-front"><span class="big-emoji">' + m.emoji + "</span><b>" + esc(m.name) + "</b><small>눌러서 뒤집기</small></span>" +
          '<span class="flip-face flip-back"><b>' + esc(m.name) + "</b><span>" + esc(m.feature) + "</span></span>" +
          "</span></button>";
      }).join("") + "</div>" +
      '<div id="flip-status" class="center-box">' + flipStatus() + "</div>";
  }
  function view1Match() {
    if (!ui.match) ui.match = { order: shuffle(METHODS.map(function (m) { return m.id; })), sel: null, done: [], wrong: null };
    var mt = ui.match;
    var all = mt.done.length === METHODS.length;
    var html = head(1, "방법과 특징 짝 맞추기", "왼쪽에서 방법을 누르고, 오른쪽에서 알맞은 특징을 눌러요.");
    html += '<div class="match"><div class="match-col">' + METHODS.map(function (m) {
      var d = mt.done.indexOf(m.id) >= 0;
      return '<button type="button" class="match-item' + (d ? " is-done" : "") + (mt.sel === m.id ? " is-sel" : "") +
        '" data-act="match-name" data-id="' + m.id + '"' + (d ? " disabled" : "") + ">" + m.emoji + " " + esc(m.name) + (d ? " ✓" : "") + "</button>";
    }).join("") + '</div><div class="match-col">' + mt.order.map(function (id) {
      var m = getMethod(id), d = mt.done.indexOf(id) >= 0;
      return '<button type="button" class="match-item match-feature' + (d ? " is-done" : "") + (mt.wrong === id ? " is-wrong" : "") +
        '" data-act="match-feature" data-id="' + id + '"' + (d ? " disabled" : "") + ">" + esc(m.feature) + "</button>";
    }).join("") + "</div></div>";
    html += '<div class="center-box">';
    if (all) html += '<p class="count-pill is-ok">🎉 모두 맞혔어요! 아래의 "다음"을 눌러요.</p>';
    else if (mt.wrong) html += '<p class="count-pill is-warn">다시 생각해 보아요.</p>';
    else html += '<p class="count-pill">맞힌 짝 <b>' + mt.done.length + "</b> / " + METHODS.length + "</p>";
    html += '<button type="button" class="btn btn-ghost" data-act="sub" data-sub="cards">카드 다시 보기</button></div>';
    return html;
  }

  /* ---------------- 2. 기사 스크랩 ---------------- */
  function artImage(a) {
    if (a.imageUrl) return '<div class="art-img"><img src="' + esc(a.imageUrl) + '" alt="' + esc(a.title) + ' 사진" loading="lazy"></div>';
    return '<div class="art-img art-illust" aria-hidden="true">' + (a.emoji || CATS[a.category].emoji) + "</div>";
  }
  function artCard(a, opts) {
    opts = opts || {};
    var scrapped = state.scraps.indexOf(a.id) >= 0;
    var html = '<article class="art cat-' + a.category + '">' +
      '<div class="art-band">' + CATS[a.category].name + "</div>" + artImage(a) +
      '<div class="art-body">' +
      '<span class="badge">' + (a.custom ? "내가 찾은 기사" : "학습용 기사") + "</span>" +
      "<h3>" + esc(a.title) + "</h3>" +
      '<p class="art-text">' + esc(a.custom ? a.summary : a.body) + "</p>" +
      '<p class="art-meta">' + (a.district ? "📍 " + esc(a.district) : "") +
      (a.custom ? "출처: " + esc(a.sourceName) : "") + "</p>";
    if (a.sourceUrl) {
      html += '<a class="src-link" href="' + esc(a.sourceUrl) + '" target="_blank" rel="noopener noreferrer">원문 보기' +
        (a.sourceName ? " (" + esc(a.sourceName) + ")" : "") + " ↗</a>";
    }
    if (!opts.readonly) {
      html += '<div class="art-actions"><button type="button" class="btn ' + (scrapped ? "btn-done" : "btn-scrap") +
        '" data-act="scrap" data-id="' + a.id + '" aria-pressed="' + scrapped + '">' + (scrapped ? "✓ 스크랩했어요" : "＋ 스크랩") + "</button>";
      if (a.custom) html += '<button type="button" class="btn btn-ghost btn-small" data-act="custom-del" data-id="' + a.id + '">지우기</button>';
      html += "</div>";
    }
    return html + "</div></article>";
  }
  function scrapCounts() {
    var c = { nature: 0, culture: 0, product: 0 };
    state.scraps.forEach(function (id) { var a = getArticle(id); if (a) c[a.category]++; });
    return c;
  }
  function view2() {
    var c = scrapCounts(), total = state.scraps.length, okGoal = total >= SCRAP_MIN;
    var list = ARTICLES.concat(state.custom).filter(function (a) { return a.category === ui.tab; });
    var html = head(2, "부산 기사 스크랩하기", "기사를 읽고, 마음에 드는 것을 " + SCRAP_MIN + "개 이상 스크랩해요.");
    html += '<div class="split"><aside class="side scrap-status" aria-label="내 스크랩 현황">' +
      "<h2>내 스크랩</h2>" +
      '<div class="counts">' + CAT_KEYS.map(function (k) {
        return '<span class="count cat-' + k + '">' + CATS[k].name + " <b>" + c[k] + "</b></span>";
      }).join("") + "</div>" +
      '<p class="goal' + (okGoal ? " is-ok" : "") + '">모두 <b>' + total + "</b>개 " + (okGoal ? "✓ 다 모았어요!" : "/ " + SCRAP_MIN + "개 이상") + "</p>" +
      '<ul class="scrap-list">' + state.scraps.map(function (id) {
        var a = getArticle(id);
        return a ? '<li class="cat-' + a.category + '"><span>' + esc(a.title) + "</span></li>" : "";
      }).join("") + "</ul>" +
      '<button type="button" class="btn btn-ghost btn-add" data-act="add-open">＋ 내가 찾은 기사 추가</button>' +
      "</aside><div class=\"split-main\">" +
      '<div class="tabs" role="tablist">' + CAT_KEYS.map(function (k) {
        return '<button type="button" role="tab" class="tab cat-' + k + (ui.tab === k ? " is-on" : "") + '" data-act="tab" data-tab="' + k +
          '" aria-selected="' + (ui.tab === k) + '">' + CATS[k].emoji + " " + CATS[k].name + "</button>";
      }).join("") + "</div>" +
      '<div class="art-grid">' + list.map(function (a) { return artCard(a); }).join("") + "</div></div></div>";
    return html;
  }
  function addDialog() {
    return '<h2>내가 찾은 기사 추가</h2><p class="dlg-lead">책이나 인터넷에서 내가 찾은 부산 기사를 적어요.</p>' +
      '<label class="field"><span>제목</span><input id="f-title" type="text" maxlength="40" placeholder="예: 다대포 해수욕장"></label>' +
      '<fieldset class="field"><legend>분류</legend><div class="radio-row">' + CAT_KEYS.map(function (k, i) {
        return '<label class="radio cat-' + k + '"><input type="radio" name="f-cat" value="' + k + '"' + (k === ui.tab ? " checked" : "") + "> " + CATS[k].name + "</label>";
      }).join("") + "</div></fieldset>" +
      '<label class="field"><span>한 줄 요약</span><textarea id="f-summary" rows="2" maxlength="120" placeholder="어떤 내용인지 한 줄로 써요."></textarea></label>' +
      '<label class="field"><span>출처 (꼭 써요)</span><input id="f-source" type="text" maxlength="80" placeholder="예: ○○ 누리집, 책 이름"></label>' +
      '<p id="f-hint" class="form-hint"></p>' +
      '<div class="dlg-actions"><button type="button" class="btn btn-ghost" data-act="dlg-close">닫기</button>' +
      '<button type="button" class="btn btn-primary" data-act="add-save">추가하기</button></div>';
  }

  /* ---------------- 3. 소개할 내용 ---------------- */
  var CONTENT_ROWS = [
    { key: "topic", label: "주제", ex: "topic", ph: "내가 소개할 것의 이름을 써요.", starters: [], rows: 1 },
    { key: "feature", label: "지역의 특징", ex: "feature", ph: "이 주제와 관련된 부산의 특징을 써요.", starters: ["부산은 ", "이곳은 ", "부산에는 "], rows: 3 },
    { key: "story", label: "역사 또는 이야기", ex: "story", ph: "언제부터, 어떻게 알려졌는지 써요.", starters: ["옛날부터 ", "처음에는 ", "~라고 전해진다."], rows: 3 },
    { key: "good", label: "좋은 점 (자랑할 점)", ex: "good", ph: "자랑하고 싶은 점을 써요.", starters: ["가장 좋은 점은 ", "이곳에 가면 ", "~해서 좋다."], rows: 3 }
  ];
  function view3() {
    var a = state.topicId ? getArticle(state.topicId) : null;
    if (!a || state.sub[3] !== "table") return view3Pick(a);
    var html = head(3, "소개할 내용 정하기", "옆의 기사를 읽고, 내 말로 표를 채워요.");
    html += '<div class="split"><aside class="side"><details class="ref" open><summary>참고할 기사</summary>' +
      artCard(a, { readonly: true }) + "</details>" +
      '<button type="button" class="btn btn-ghost btn-small" data-act="sub" data-sub="pick">주제 바꾸기</button></aside>' +
      '<div class="split-main"><div class="sheet">' + CONTENT_ROWS.map(function (r) {
        return '<div class="sheet-row"><div class="sheet-label">' + r.label + '</div><div class="sheet-cell">' +
          inputFor("content." + r.key, r.rows, r.ph) + starterHtml("content." + r.key, r.starters) +
          '<details class="example"><summary>예시 보기</summary><p>' + esc(EX[r.ex] || "") + "</p></details></div></div>";
      }).join("") + "</div>" +
      '<div class="memo"><label for="memo">🔎 더 조사할 것</label><p>모르는 내용은 여기에 적어 두어요.</p>' +
      '<textarea id="memo" rows="2" data-bind="content.memo" placeholder="예: 언제 처음 만들어졌는지 더 찾아보기">' + esc(state.content.memo) + "</textarea></div>" +
      "</div></div>";
    return html;
  }
  function view3Pick(cur) {
    var html = head(3, "소개할 내용 정하기", "스크랩한 것 중에서 내가 소개할 주제를 하나 골라요.");
    html += '<div class="pick-grid">' + state.scraps.map(function (id) {
      var a = getArticle(id);
      if (!a) return "";
      var on = cur && cur.id === id;
      return '<button type="button" class="pick cat-' + a.category + (on ? " is-on" : "") + '" data-act="topic" data-id="' + id + '" aria-pressed="' + !!on + '">' +
        '<span class="pick-emoji">' + (a.emoji || CATS[a.category].emoji) + '</span><span class="pick-cat">' + CATS[a.category].name +
        "</span><b>" + esc(a.title) + "</b>" + (on ? '<span class="pick-on">✓ 골랐어요</span>' : "") + "</button>";
    }).join("") + "</div>";
    if (cur) html += '<div class="center-box"><button type="button" class="btn btn-primary btn-big" data-act="sub" data-sub="table">표 쓰러 가기 →</button></div>';
    return html;
  }
  function inputFor(path, rows, ph) {
    var v = esc(getPath(path));
    if (rows === 1) return '<input type="text" maxlength="40" data-bind="' + path + '" value="' + v + '" placeholder="' + esc(ph) + '">';
    return '<textarea rows="' + rows + '" maxlength="300" data-bind="' + path + '" placeholder="' + esc(ph) + '">' + v + "</textarea>";
  }
  function starterHtml(path, starters) {
    if (!starters || !starters.length) return "";
    return '<div class="starters"><span>이렇게 시작해요:</span>' + starters.map(function (s) {
      return '<button type="button" class="chip" data-act="starter" data-target="' + path + '" data-text="' + esc(s) + '">' + esc(s.trim()) + "</button>";
    }).join("") + "</div>";
  }

  /* ---------------- 4. 퀴즈 ---------------- */
  function maskText(a, text) {
    var words = [a.title].concat(a.aliases || []).sort(function (x, y) { return y.length - x.length; });
    words.forEach(function (w) { if (w) text = text.split(w).join("○○○"); });
    return text.replace(/(○○○\s*)+/g, "○○○");
  }
  function otherTitles(a, n) {
    var same = shuffle(ARTICLES.filter(function (x) { return x.id !== a.id && x.category === a.category; }));
    var diff = shuffle(ARTICLES.filter(function (x) { return x.category !== a.category; }));
    return same.slice(0, 2).concat(diff).slice(0, n).map(function (x) { return x.title; });
  }
  function choiceQ(label, q, passage, correct, wrongs, explain) {
    var options = shuffle([correct].concat(wrongs));
    return { label: label, q: q, passage: passage, options: options, answer: options.indexOf(correct), explain: explain };
  }
  function articleQ(a, kind) {
    if (kind === "what") {
      return choiceQ("부산을 대표하는 것", "기사를 읽고, ○○○에 들어갈 말을 골라요.", maskText(a, a.body), a.title, otherTitles(a, 3),
        "정답은 '" + a.title + "'. " + a.feature);
    }
    if (kind === "category") {
      return {
        label: "분류 맞히기", q: "'" + a.title + "'" + josa(a.title, "은", "는") + " 어떤 분류에 들어갈까요?", passage: "",
        options: CAT_KEYS.map(function (k) { return CATS[k].name; }), answer: CAT_KEYS.indexOf(a.category),
        explain: a.title + josa(a.title, "은", "는") + " " + CATS[a.category].name + "이에요. " + CATS[a.category].why
      };
    }
    return choiceQ("초성 퀴즈", "초성을 보고 무엇인지 맞혀요.", chosung(a.title) + "\n도움말: " + CATS[a.category].name + " · " + maskText(a, a.feature),
      a.title, otherTitles(a, 3), "정답은 '" + a.title + "'. " + a.feature);
  }
  function methodQ(m) {
    var wrongs = shuffle(METHODS.filter(function (x) { return x.id !== m.id; })).slice(0, 3).map(function (x) { return x.name; });
    return choiceQ("알리는 방법", "설명을 읽고, 어떤 방법인지 골라요.", m.quizText, m.name, wrongs, m.name + ": " + m.feature);
  }
  function oxQ(m) {
    var truth = Math.random() < 0.5;
    var other = shuffle(METHODS.filter(function (x) { return x.id !== m.id; }))[0];
    var src = truth ? m : other;
    return {
      label: "OX 퀴즈", q: "'" + m.name + "'에 대한 설명이 맞으면 O, 틀리면 X를 골라요.", passage: m.name + " → " + src.quizText,
      options: ["O", "X"], answer: truth ? 0 : 1, ox: true,
      explain: truth ? "맞아요. " + m.name + "의 특징이에요." : "이것은 '" + other.name + "'의 특징이에요. " + m.name + ": " + m.feature
    };
  }
  function customQ(q, label) {
    if (!q || !q.question) return null;
    if (typeof q.ox === "boolean") {
      return { label: "OX 퀴즈", q: "맞으면 O, 틀리면 X를 골라요.", passage: q.question, options: ["O", "X"], answer: q.ox ? 0 : 1, ox: true, explain: q.explain || "" };
    }
    if (!Array.isArray(q.options) || q.options[q.answer] === undefined) return null;
    var correct = q.options[q.answer];
    return choiceQ(label, q.question, "", correct, q.options.filter(function (o, i) { return i !== q.answer; }), q.explain || "");
  }
  function buildQuiz() {
    var nA = Math.ceil(QUIZ_COUNT / 2), nM = QUIZ_COUNT - nA;
    var kinds = ["what", "category", "chosung"];
    var arts = shuffle(ARTICLES);
    var aCustom = [], mCustom = [];
    ARTICLES.forEach(function (a) { (a.quiz || []).forEach(function (q) { var x = customQ(q, "부산을 대표하는 것"); if (x) aCustom.push(x); }); });
    METHODS.forEach(function (m) { (m.quiz || []).forEach(function (q) { var x = customQ(q, "알리는 방법"); if (x) mCustom.push(x); }); });
    EXTRA_QUIZ.forEach(function (q) { var x = customQ(q, "알리는 방법"); if (x) mCustom.push(x); });

    var aPool = shuffle(aCustom).slice(0, 2).concat(arts.map(function (a, i) { return articleQ(a, kinds[i % 3]); }));
    var aRest = arts.map(function (a, i) { return articleQ(a, kinds[(i + 1) % 3]); });
    var ms = shuffle(METHODS);
    var mGen = ms.map(function (m, i) { return i % 2 ? oxQ(m) : methodQ(m); });
    var mPool = shuffle(mCustom).slice(0, 2).concat(shuffle(mGen));
    var mRest = ms.map(function (m, i) { return i % 2 ? methodQ(m) : oxQ(m); });

    var items = aPool.slice(0, nA).concat(mPool.slice(0, nM));
    var rest = aPool.slice(nA).concat(mPool.slice(nM), aRest, mRest);
    while (items.length < QUIZ_COUNT && rest.length) items.push(rest.shift());
    items = shuffle(items);
    return { items: items, queue: items.map(function (x, i) { return i; }), pos: 0, round: 1, retry: [], answered: null, firstWrong: [], done: false };
  }
  function quizScore(qz) { return qz.items.length - qz.firstWrong.length; }
  function badgeFor(qz) {
    var r = quizScore(qz) / qz.items.length;
    if (r >= 0.9) return { icon: "🏆", name: "으뜸 홍보 대사" };
    if (r >= 0.7) return { icon: "🥇", name: "멋진 홍보 대사" };
    return { icon: "🌱", name: "새싹 홍보 대사" };
  }
  function view4() {
    var qz = state.quiz;
    if (!qz) {
      return head(4, "퀴즈 풀기", "퀴즈 " + QUIZ_COUNT + "문제를 풀어요.") +
        '<div class="quiz-card pinned center"><p class="big-emoji">🧠</p><p class="quiz-intro">부산을 대표하는 것과 지역을 알리는 방법에 대한 퀴즈예요.<br>틀린 문제는 마지막에 다시 풀어요.</p>' +
        '<button type="button" class="btn btn-primary btn-big" data-act="quiz-start">퀴즈 시작</button></div>';
    }
    if (qz.done) {
      var b = badgeFor(qz);
      return head(4, "퀴즈 풀기", "퀴즈를 모두 풀었어요. 배지를 확인해요.") +
        '<div class="quiz-card pinned center"><p class="badge-icon">' + b.icon + '</p><h2 class="badge-name">' + b.name + "</h2>" +
        '<p class="quiz-intro">처음에 맞힌 문제: <b>' + quizScore(qz) + "</b> / " + qz.items.length + "<br>틀린 문제도 다시 풀어서 모두 맞혔어요!</p>" +
        '<button type="button" class="btn btn-ghost" data-act="quiz-start">새 문제로 한 번 더</button></div>';
    }
    var item = qz.items[qz.queue[qz.pos]], ans = qz.answered;
    var html = head(4, "퀴즈 풀기", qz.round > 1 ? "틀린 문제를 다시 풀어요." : "알맞은 답을 하나 골라요.");
    html += '<div class="quiz-card pinned"><div class="quiz-top"><span class="badge">' + esc(item.label) + "</span>" +
      '<span class="quiz-count">' + (qz.round > 1 ? "다시 풀기 " : "") + (qz.pos + 1) + " / " + qz.queue.length + "</span></div>" +
      '<h2 class="quiz-q">' + esc(item.q) + "</h2>" +
      (item.passage ? '<p class="quiz-passage">' + esc(item.passage) + "</p>" : "") +
      '<div class="options' + (item.ox ? " options-ox" : "") + '">' + item.options.map(function (o, i) {
        var cls = "";
        if (ans) cls = i === item.answer ? " is-right" : (i === ans.choice ? " is-wrong" : "");
        return '<button type="button" class="option' + cls + '" data-act="quiz-answer" data-i="' + i + '"' + (ans ? " disabled" : "") + ">" + esc(o) + "</button>";
      }).join("") + "</div>";
    if (ans) {
      html += '<div class="feedback ' + (ans.correct ? "is-right" : "is-wrong") + '"><b>' + (ans.correct ? "⭕ 정답이에요!" : "❌ 아쉬워요. 마지막에 다시 풀어요.") +
        "</b><p>" + esc(item.explain) + "</p></div>" +
        '<div class="center-box"><button type="button" class="btn btn-primary btn-big" data-act="quiz-next">' +
        (qz.pos + 1 < qz.queue.length ? "다음 문제 →" : (qz.retry.length ? "틀린 문제 다시 풀기 →" : "결과 보기 →")) + "</button></div>";
    }
    return html + "</div>";
  }

  /* ---------------- 5. 계획하기 ---------------- */
  function contentTable() {
    var c = state.content;
    return '<table class="mini-table"><tbody>' +
      [["주제", c.topic], ["지역의 특징", c.feature], ["역사 또는 이야기", c.story], ["좋은 점", c.good]].map(function (r) {
        return "<tr><th>" + r[0] + '</th><td class="pre">' + esc(r[1]) + "</td></tr>";
      }).join("") + "</tbody></table>" +
      (has(c.memo) ? '<p class="mini-memo">🔎 더 조사할 것: <span class="pre">' + esc(c.memo) + "</span></p>" : "");
  }
  function view5() {
    var m = getMethod(state.plan.method);
    if (!m || state.sub[5] !== "table") return view5Pick(m);
    var g = m.guide || {};
    var html = head(5, "발표자료 계획하기", "'" + planName(m) + "'" + josa(planName(m), "으로", "로") + " 알릴 내용을 구성표에 써요.");
    html += '<div class="split"><aside class="side"><details class="ref" open><summary>내가 쓴 소개할 내용</summary>' + contentTable() + "</details>" +
      '<button type="button" class="btn btn-ghost btn-small" data-act="sub" data-sub="pick">방법 바꾸기</button></aside>' +
      '<div class="split-main">' +
      '<div class="tips"><b>' + m.emoji + " " + esc(planName(m)) + " 도움말</b><ul>" + (m.tips || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></div>" +
      '<div class="plan-sheet">' +
      planRow("p-title", "제목", "", inputFor("plan.title", 1, "눈에 띄는 제목을 써요."), EX.planTitle) +
      planRow("p-intro", "처음", g.intro || "무엇을 보여 주며 어떤 말로 시작할까요?", inputFor("plan.intro", 3, "예: 사진을 보여 주며 질문하기"), EX.planIntro) +
      planRow("p-middle", "중간", g.middle || "설명할 내용 2가지를 써요.",
        '<label class="num-label">①' + inputFor("plan.middle1", 2, "설명할 내용 하나") + "</label>" +
        '<label class="num-label">②' + inputFor("plan.middle2", 2, "설명할 내용 둘") + "</label>",
        "① " + (EX.planMiddle1 || "") + "\n② " + (EX.planMiddle2 || "")) +
      planRow("p-ending", "마무리", g.ending || "좋은 점을 강조하는 한 문장을 써요.", inputFor("plan.ending", 2, "좋은 점을 강조하는 한 문장"), EX.planEnding) +
      "</div>" +
      '<div class="memo"><label for="photos">🖼️ 필요한 사진·그림 목록</label><p>자료에 넣을 사진이나 그림을 적어요.</p>' +
      '<textarea id="photos" rows="3" data-bind="plan.photos" placeholder="예: 바닷가 사진, 지도 그림">' + esc(state.plan.photos) + "</textarea></div>" +
      "</div></div>";
    return html;
  }
  function planRow(cls, label, guide, inner, example) {
    return '<div class="plan-row ' + cls + '"><div class="plan-label">' + label + '</div><div class="plan-cell">' +
      (guide ? '<p class="plan-guide">' + esc(guide) + "</p>" : "") + inner +
      '<details class="example"><summary>예시 보기</summary><p class="pre">' + esc(example || "") + "</p></details></div></div>";
  }
  function view5Pick(cur) {
    var html = head(5, "발표자료 계획하기", "부산을 어떤 방법으로 알릴지 하나 골라요.");
    html += '<div class="pick-grid">' + METHODS.filter(function (m) { return m.canPlan; }).map(function (m) {
      var on = cur && cur.id === m.id;
      return '<button type="button" class="pick pick-method' + (on ? " is-on" : "") + '" data-act="method" data-id="' + m.id + '" aria-pressed="' + !!on + '">' +
        '<span class="pick-emoji">' + m.emoji + "</span><b>" + esc(planName(m)) + '</b><span class="pick-desc">' + esc(m.feature) + "</span>" +
        (on ? '<span class="pick-on">✓ 골랐어요</span>' : "") + "</button>";
    }).join("") + "</div>";
    if (cur) html += '<div class="center-box"><button type="button" class="btn btn-primary btn-big" data-act="sub" data-sub="table">구성표 쓰러 가기 →</button></div>';
    return html;
  }

  /* ---------------- 6. 제작 설계도 ---------------- */
  function partText(key) {
    var p = state.plan;
    if (key === "middle") return "① " + p.middle1 + "\n② " + p.middle2;
    return p[key] || "";
  }
  function searchWords(key) {
    var a = getArticle(state.topicId);
    var t = has(state.content.topic) ? state.content.topic.trim() : (a ? a.title : "부산");
    var cat = a ? a.category : "nature";
    var d = a && a.district ? a.district : "";
    var byCat = {
      nature: { intro: [t + " 풍경", "부산 바다"], middle: [t + " 모습", t + " 자연"], ending: [t + " 여행", "부산 여행"] },
      culture: { intro: [t + " 전경", "부산 " + d], middle: [t + " 역사", t + " 옛 모습"], ending: [t + " 사람들", "부산 여행"] },
      product: { intro: [t + " 사진", "부산 " + d], middle: [t + " 만드는 모습", t + " 나는 곳"], ending: [t + " 음식", "부산 맛"] }
    };
    var words = key === "title" ? ["부산 " + t, t] : byCat[cat][key];
    return words.map(function (w) { return w.trim(); }).filter(function (w, i, arr) { return w && w !== "부산" && arr.indexOf(w) === i; });
  }
  function blueprintText() {
    var m = getMethod(state.plan.method);
    var lines = ["[나의 제작 설계도] " + whoText(), "알리는 방법: " + planName(m), ""];
    PLAN_PARTS.forEach(function (p) { lines.push("■ " + p.label, partText(p.key), ""); });
    if (has(state.plan.photos)) lines.push("■ 필요한 사진·그림", state.plan.photos);
    return lines.join("\n").trim();
  }
  function blueprintCards(withTools) {
    return '<div class="bp-grid">' + PLAN_PARTS.map(function (p, i) {
      var text = partText(p.key);
      var html = '<div class="bp-card ' + p.cls + '"><div class="bp-head"><span class="bp-no">' + (i + 1) + "</span><b>" + p.label + "</b></div>" +
        '<p class="bp-text pre">' + esc(text) + "</p>";
      if (withTools) {
        html += '<button type="button" class="btn btn-ghost btn-small" data-act="copy" data-text="' + esc(text) + '">글 복사</button>' +
          '<div class="bp-search"><span>어울리는 사진 검색어</span>' + searchWords(p.key).map(function (w) {
            return '<button type="button" class="chip" data-act="copy" data-text="' + esc(w) + '" data-msg="검색어를 복사했어요!">' + esc(w) + "</button>";
          }).join("") + "</div>";
      }
      return html + "</div>";
    }).join("") + "</div>";
  }
  function view6() {
    var m = getMethod(state.plan.method);
    var html = head(6, "나의 제작 설계도", "설계도를 살펴보고, 만들기 전 준비를 확인해요.");
    html += '<div class="bp pinned"><p class="bp-meta">' + (m ? m.emoji + " 알리는 방법: <b>" + esc(planName(m)) + "</b>" : "") + "</p>" +
      blueprintCards(true) +
      (has(state.plan.photos) ? '<div class="bp-photos"><b>🖼️ 필요한 사진·그림</b><p class="pre">' + esc(state.plan.photos) + "</p></div>" : "") +
      '<div class="bp-actions"><button type="button" class="btn btn-primary" data-act="copy-all">설계도 전체 복사</button>' +
      '<button type="button" class="btn btn-primary" data-act="img-blueprint">설계도 이미지 저장</button></div></div>';
    html += '<div class="checklist pinned"><h2>만들기 전 체크리스트</h2>' + CHECKS.map(function (c, i) {
      return '<label class="check"><input type="checkbox" data-act="check" data-i="' + i + '"' + (state.checklist[i] ? " checked" : "") + "><span>" + c + "</span></label>";
    }).join("") + "</div>";
    html += '<p class="finish-note">설계도가 완성되었어요. 선생님이 알려 주시는 방법으로 발표자료를 만들어 보세요.</p>';
    return html;
  }

  /* ---------------- 7. 마무리 ---------------- */
  function view7() {
    return state.sub[7] === "record" ? view7Record() : view7Write();
  }
  function view7Write() {
    var w = state.wrap;
    var feel = ["~을 알았어.", "~에 대해 알게 되었어.", "나도 우리 지역을 알리기 위해 ~"];
    return head(7, "마무리", "친구들의 발표를 듣고, 느낀 점을 써요.") +
      '<div class="sheet">' +
      '<div class="sheet-row"><div class="sheet-label">가장 기억에 남는 주제</div><div class="sheet-cell">' + inputFor("wrap.best", 1, "친구가 발표한 주제를 써요.") + "</div></div>" +
      '<div class="sheet-row"><div class="sheet-label">그 까닭</div><div class="sheet-cell">' + inputFor("wrap.reason", 3, "왜 기억에 남았는지 써요.") +
      starterHtml("wrap.reason", ["왜냐하면 "]) + "</div></div>" +
      '<div class="sheet-row"><div class="sheet-label">활동 후 느낀 점</div><div class="sheet-cell">' + inputFor("wrap.feeling", 2, "한 줄로 써요.") +
      '<div class="starters"><span>도움 문장:</span>' + feel.map(function (s) {
        return '<button type="button" class="chip" data-act="starter" data-target="wrap.feeling" data-text="' + esc(s) + '">' + esc(s) + "</button>";
      }).join("") + "</div></div></div></div>" +
      '<div class="center-box"><button type="button" class="btn btn-primary btn-big" data-act="sub" data-sub="record">나의 기록 모아 보기 →</button></div>';
  }
  function view7Record() {
    var qz = state.quiz, w = state.wrap, m = getMethod(state.plan.method);
    var b = qz && qz.done ? badgeFor(qz) : null;
    var html = '<div class="no-print">' + head(7, "나의 기록 모아 보기", "내가 한 활동을 살펴보고, 인쇄하거나 저장해요.") +
      '<div class="bp-actions"><button type="button" class="btn btn-primary" data-act="print">전체 기록 인쇄</button>' +
      '<button type="button" class="btn btn-primary" data-act="img-record">이미지 저장</button>' +
      '<button type="button" class="btn btn-ghost" data-act="sub" data-sub="write">느낀 점 고치기</button></div></div>';
    html += '<div class="record">' +
      '<div class="record-head pinned"><h1>부산 홍보 대사 활동 기록</h1><p>' + esc(whoText()) + "</p>" +
      (b ? '<div class="record-badge"><span>' + b.icon + "</span><b>" + b.name + "</b><small>퀴즈 " + quizScore(qz) + " / " + qz.items.length + "</small></div>" : "") + "</div>" +
      '<section class="record-sec pinned"><h2>① 소개할 내용</h2>' + contentTable() + "</section>" +
      '<section class="record-sec pinned"><h2>② 자료 구성표 · 제작 설계도</h2><p class="bp-meta">' + (m ? m.emoji + " 알리는 방법: <b>" + esc(planName(m)) + "</b>" : "") + "</p>" +
      blueprintCards(false) +
      (has(state.plan.photos) ? '<div class="bp-photos"><b>🖼️ 필요한 사진·그림</b><p class="pre">' + esc(state.plan.photos) + "</p></div>" : "") + "</section>" +
      '<section class="record-sec pinned"><h2>③ 발표를 듣고</h2><table class="mini-table"><tbody>' +
      "<tr><th>가장 기억에 남는 주제</th><td class=\"pre\">" + esc(w.best) + "</td></tr>" +
      "<tr><th>그 까닭</th><td class=\"pre\">" + esc(w.reason) + "</td></tr>" +
      "<tr><th>활동 후 느낀 점</th><td class=\"pre\">" + esc(w.feeling) + "</td></tr></tbody></table></section></div>";
    return html;
  }

  /* ---------------- 이미지 저장 (캔버스에 직접 그리기) ---------------- */
  var COLORS = { "p-title": "#ffd9e6", "p-intro": "#d3edff", "p-middle": "#def3c6", "p-ending": "#fff0ad", plain: "#ffffff", head: "#0b6fa8" };
  var FONT_T = "SchoolSafetyRoundedSmile, Pretendard, sans-serif";
  var FONT_B = "Pretendard, sans-serif";
  function wrapLines(ctx, text, maxW) {
    var out = [];
    String(text || "").split("\n").forEach(function (para) {
      var line = "";
      para.split("").forEach(function (ch) {
        if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; }
        else line += ch;
      });
      out.push(line);
    });
    return out;
  }
  function drawDoc(blocks, filename) {
    var W = 1200, PAD = 60, INNER = W - PAD * 2;
    var canvas = document.createElement("canvas");
    function pass(ctx, draw) {
      var y = PAD;
      blocks.forEach(function (b) {
        if (b.type === "h1") {
          ctx.font = "700 60px " + FONT_T;
          if (draw) { ctx.fillStyle = COLORS.head; ctx.fillText(b.text, PAD, y + 56); }
          y += 84;
        } else if (b.type === "sub") {
          ctx.font = "500 30px " + FONT_B;
          if (draw) { ctx.fillStyle = "#3d5567"; ctx.fillText(b.text, PAD, y + 30); }
          y += 60;
        } else if (b.type === "h2") {
          ctx.font = "700 38px " + FONT_T;
          y += 16;
          if (draw) { ctx.fillStyle = "#1f3447"; ctx.fillText(b.text, PAD, y + 36); }
          y += 60;
        } else {
          ctx.font = "400 30px " + FONT_B;
          var lines = wrapLines(ctx, has(b.text) ? b.text : "(아직 쓰지 않았어요)", INNER - 56);
          var h = 28 + 44 + lines.length * 44 + 20;
          if (draw) {
            ctx.fillStyle = COLORS[b.color] || COLORS.plain;
            ctx.strokeStyle = "#c5d9e6"; ctx.lineWidth = 2;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(PAD, y, INNER, h, 20); else ctx.rect(PAD, y, INNER, h);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#1f3447";
            ctx.font = "700 28px " + FONT_B;
            ctx.fillText(b.label, PAD + 28, y + 50);
            ctx.font = "400 30px " + FONT_B;
            lines.forEach(function (ln, i) { ctx.fillText(ln, PAD + 28, y + 100 + i * 44); });
          }
          y += h + 18;
        }
      });
      return y + PAD - 18;
    }
    var ctx = canvas.getContext("2d");
    canvas.width = W;
    canvas.height = pass(ctx, false);
    ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f3fbff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = "alphabetic";
    pass(ctx, true);
    canvas.toBlob(function (blob) {
      if (!blob) { toast("이미지를 만들지 못했어요."); return; }
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
      toast("이미지를 저장했어요!");
    }, "image/png");
    return canvas;
  }
  function saveImage(blocks, filename) {
    var fonts = document.fonts;
    var wait = fonts && fonts.load
      ? Promise.all([fonts.load("700 60px SchoolSafetyRoundedSmile", "가"), fonts.load("400 30px Pretendard", "가"), fonts.load("700 28px Pretendard", "가")])
      : Promise.resolve();
    var timeout = new Promise(function (res) { setTimeout(res, 2500); });
    Promise.race([wait, timeout]).then(function () { drawDoc(blocks, filename); }, function () { drawDoc(blocks, filename); });
  }
  function planBlocks() {
    var m = getMethod(state.plan.method);
    var blocks = [{ type: "sub", text: "알리는 방법: " + planName(m) }];
    PLAN_PARTS.forEach(function (p) { blocks.push({ type: "box", label: p.label, text: partText(p.key), color: p.cls }); });
    if (has(state.plan.photos)) blocks.push({ type: "box", label: "필요한 사진·그림", text: state.plan.photos, color: "plain" });
    return blocks;
  }
  function fileName(kind) {
    return "부산홍보대사_" + kind + "_" + (whoText().replace(/\s+/g, "") || "기록") + ".png";
  }
  function blueprintBlocks() {
    return [{ type: "h1", text: "나의 제작 설계도" }, { type: "sub", text: whoText() }].concat(planBlocks());
  }
  function recordBlocks() {
    var c = state.content, w = state.wrap, qz = state.quiz;
    var blocks = [{ type: "h1", text: "부산 홍보 대사 활동 기록" }, { type: "sub", text: whoText() }];
    if (qz && qz.done) blocks.push({ type: "box", label: "퀴즈와 배지", text: badgeFor(qz).name + " (퀴즈 " + quizScore(qz) + " / " + qz.items.length + ")", color: "plain" });
    blocks.push({ type: "h2", text: "① 소개할 내용" },
      { type: "box", label: "주제", text: c.topic }, { type: "box", label: "지역의 특징", text: c.feature },
      { type: "box", label: "역사 또는 이야기", text: c.story }, { type: "box", label: "좋은 점", text: c.good });
    blocks.push({ type: "h2", text: "② 자료 구성표 · 제작 설계도" });
    blocks = blocks.concat(planBlocks());
    blocks.push({ type: "h2", text: "③ 발표를 듣고" },
      { type: "box", label: "가장 기억에 남는 주제", text: w.best }, { type: "box", label: "그 까닭", text: w.reason },
      { type: "box", label: "활동 후 느낀 점", text: w.feeling });
    return blocks;
  }

  /* ---------------- 대화 상자 ---------------- */
  function openDialog(html) {
    var d = $("dlg");
    d.innerHTML = html;
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  }
  function closeDialog() {
    var d = $("dlg");
    if (d.close) d.close(); else d.removeAttribute("open");
  }

  /* ---------------- 누르기 동작 ---------------- */
  var ACTIONS = {
    start: function () {
      var r = canNext(0);
      if (!r.ok) { $("start-hint").textContent = r.hint; return; }
      go(Math.max(1, state.maxStep));
    },
    goto: function (el) {
      var s = Number(el.dataset.step);
      if (s <= state.maxStep) go(s);
    },
    prev: function () { go(state.step - 1); },
    next: function () { if (canNext(state.step).ok) go(state.step + 1); },
    sub: function (el) {
      state.sub[state.step] = el.dataset.sub;
      if (state.step === 1 && el.dataset.sub === "match") ui.match = null;
      save(); render();
    },
    reset: function () {
      openDialog('<h2>처음부터 다시 할까요?</h2><p class="dlg-lead">지금까지 쓴 내용이 모두 지워져요.</p>' +
        '<div class="dlg-actions"><button type="button" class="btn btn-primary" data-act="dlg-close">아니요, 계속할래요</button>' +
        '<button type="button" class="btn btn-danger" data-act="reset-yes">네, 모두 지워요</button></div>');
    },
    "reset-yes": function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 넘어감 */ }
      state = defaults(); ui = { tab: "nature", match: null, lastScreen: "" };
      closeDialog(); render();
    },
    "dlg-close": closeDialog,

    flip: function (el) {
      var id = el.dataset.id;
      var on = el.classList.toggle("is-flipped");
      el.setAttribute("aria-pressed", on);
      if (state.flipped.indexOf(id) < 0) { state.flipped.push(id); save(); }
      $("flip-status").innerHTML = flipStatus();
    },
    "match-name": function (el) { ui.match.sel = el.dataset.id; ui.match.wrong = null; render(); },
    "match-feature": function (el) {
      var mt = ui.match, id = el.dataset.id;
      if (!mt.sel) { toast("먼저 왼쪽에서 방법을 골라요."); return; }
      if (mt.sel === id) {
        mt.done.push(id); mt.wrong = null;
        if (mt.done.length === METHODS.length) { state.matchDone = true; save(); }
      } else mt.wrong = id;
      mt.sel = null;
      render();
    },

    tab: function (el) { ui.tab = el.dataset.tab; render(); },
    scrap: function (el) {
      var id = el.dataset.id, i = state.scraps.indexOf(id);
      if (i >= 0) state.scraps.splice(i, 1); else state.scraps.push(id);
      if (state.topicId === id && i >= 0) state.topicId = null;
      save(); render();
    },
    "add-open": function () { openDialog(addDialog()); },
    "add-save": function () {
      var title = $("f-title").value.trim(), summary = $("f-summary").value.trim(), source = $("f-source").value.trim();
      var cat = document.querySelector('input[name="f-cat"]:checked');
      var hint = !title ? "제목을 써요." : !cat ? "분류를 골라요." : !summary ? "한 줄 요약을 써요." : !source ? "출처를 꼭 써요." : "";
      if (hint) { $("f-hint").textContent = hint; return; }
      var a = { id: "my-" + Date.now(), category: cat.value, title: title, summary: summary, sourceName: source, district: "", custom: true };
      state.custom.push(a); state.scraps.push(a.id); ui.tab = a.category;
      save(); closeDialog(); render(); toast("기사를 추가하고 스크랩했어요!");
    },
    "custom-del": function (el) {
      var id = el.dataset.id;
      state.custom = state.custom.filter(function (a) { return a.id !== id; });
      state.scraps = state.scraps.filter(function (x) { return x !== id; });
      if (state.topicId === id) state.topicId = null;
      save(); render();
    },

    topic: function (el) { state.topicId = el.dataset.id; save(); render(); },
    starter: function (el) {
      var input = document.querySelector('[data-bind="' + el.dataset.target + '"]');
      if (!input) return;
      // "~"는 내가 채울 자리: 글자는 넣지 않고 그 자리에 커서를 둔다
      var parts = el.dataset.text.split("~");
      var base = input.value + (input.value && !/\s$/.test(input.value) ? " " : "");
      var before = parts.length > 1 ? parts[0] : el.dataset.text;
      var after = parts.length > 1 ? parts.slice(1).join("") : "";
      input.value = base + before + after;
      setPath(el.dataset.target, input.value); save(); updateNav();
      input.focus();
      var pos = (base + before).length;
      try { input.setSelectionRange(pos, pos); } catch (e) { /* 넘어감 */ }
    },

    "quiz-start": function () { state.quiz = buildQuiz(); save(); render(); },
    "quiz-answer": function (el) {
      var qz = state.quiz;
      if (!qz || qz.answered) return;
      var idx = qz.queue[qz.pos], choice = Number(el.dataset.i), correct = choice === qz.items[idx].answer;
      qz.answered = { choice: choice, correct: correct };
      if (!correct) {
        qz.retry.push(idx);
        if (qz.round === 1) qz.firstWrong.push(idx);
      }
      save(); render();
    },
    "quiz-next": function () {
      var qz = state.quiz;
      qz.answered = null;
      if (qz.pos + 1 < qz.queue.length) qz.pos++;
      else if (qz.retry.length) {
        qz.queue = qz.retry; qz.retry = []; qz.pos = 0; qz.round++;
        qz.queue.forEach(function (i) { // 다시 풀 때는 보기 순서를 바꾼다
          var it = qz.items[i];
          if (it.ox) return;
          var correct = it.options[it.answer];
          it.options = shuffle(it.options); it.answer = it.options.indexOf(correct);
        });
      } else qz.done = true;
      save(); render();
    },

    method: function (el) { state.plan.method = el.dataset.id; save(); render(); },
    copy: function (el) {
      if (!has(el.dataset.text)) { toast("아직 쓴 글이 없어요."); return; }
      copyText(el.dataset.text, el.dataset.msg);
    },
    "copy-all": function () { copyText(blueprintText(), "설계도를 모두 복사했어요!"); },
    check: function (el) { state.checklist[Number(el.dataset.i)] = el.checked; save(); },
    "img-blueprint": function () { saveImage(blueprintBlocks(), fileName("설계도")); },
    "img-record": function () { saveImage(recordBlocks(), fileName("활동기록")); },
    print: function () { window.print(); }
  };

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    var fn = ACTIONS[el.dataset.act];
    if (fn) fn(el, e);
  });
  document.addEventListener("input", function (e) {
    var path = e.target.dataset && e.target.dataset.bind;
    if (!path) return;
    setPath(path, e.target.value);
    save(); updateNav();
    if (path.indexOf("student.") === 0) {
      $("who").textContent = whoText();
      if ($("start-hint")) $("start-hint").textContent = "";
    }
  });

  // 시험·점검용 (학생 화면에는 영향 없음)
  window.__app = { getState: function () { return state; }, blueprintBlocks: blueprintBlocks, recordBlocks: recordBlocks, drawDoc: drawDoc };

  render();
})();
