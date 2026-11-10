(function () {
  var C = window.SOP_CONFIG || {};
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var norm = function (s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d"); };

  var TREE = [], SEARCH = [], DOCS = {};
  var state = { view: "map", dep: null, open: {}, sel: null, zoom: 1, px: 40, py: 30 };

  /* ---------- đăng nhập nhẹ ---------- */
  function start(name) {
    $("#gate").hidden = true; $("#app").hidden = false;
    $("#userLabel").textContent = "👤 " + name;
    window.SOP_WM && window.SOP_WM(name);
    load();
  }
  var saved = sessionStorage.getItem("sop_user");
  if (!C.accessCode) { start(saved || "Khách"); }
  else if (saved) { start(saved); }
  else {
    $("#gate").hidden = false;
    $("#gateForm").onsubmit = function (e) {
      e.preventDefault();
      if ($("#gateCode").value !== C.accessCode) { $("#gateErr").textContent = "Sai mã truy cập"; return; }
      var n = $("#gateName").value.trim(); sessionStorage.setItem("sop_user", n); start(n);
    };
  }

  /* ---------- tải dữ liệu ---------- */
  function load() {
    Promise.all([fetch("data/tree.json").then(r => r.json()), fetch("data/search.json").then(r => r.json())]).then(function (r) {
      TREE = r[0]; SEARCH = r[1].map(function (d) { d.n = norm(d.t + " " + d.c + " " + d.p); d.nx = norm(d.x); return d; });
      TREE.forEach(function (d) { d.folders.forEach(function (f) { f.files.forEach(function (x) { x.code = f.code; x.folder = f.title; DOCS[x.id] = x; }); }); });
      state.dep = TREE[0] && TREE[0].name;
      renderTree(); render();
      if (!SEARCH.length) showErr("Không có văn bản nào trong dữ liệu. Hãy chạy lại CHAY.bat (bước build) và xem cửa sổ đen có báo lỗi không.");
    }).catch(function (e) {
      showErr("Không tải được dữ liệu (data/tree.json). Nếu bạn mở file index.html trực tiếp thì không chạy được — hãy mở bằng CHAY.bat (http://localhost:8000). Chi tiết: " + e);
    });
  }

  function showErr(m) { var d = document.createElement("div"); d.style.cssText = "margin:16px;padding:14px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:8px;font-size:14px"; d.textContent = m; var s = $("#stage"); s.insertBefore(d, s.firstChild); d.style.position = "relative"; d.style.zIndex = 5; }

  /* ---------- cây thư mục ---------- */
  var treeOpen = {};
  function renderTree() {
    var flt = norm($("#treeFilter").value), h = "";
    TREE.forEach(function (d) {
      var total = d.folders.reduce(function (a, f) { return a + f.files.length; }, 0);
      var fh = "";
      d.folders.forEach(function (f) {
        var key = d.name + "/" + f.title;
        var files = f.files.filter(function (x) { return !flt || norm(x.title + f.title + f.code).indexOf(flt) > -1; });
        if (flt && !files.length) return;
        var op = treeOpen[key] || !!flt;
        var inner = "";
        if (op) files.forEach(function (x) {
          inner += '<div class="tn' + (state.sel === x.id ? " sel" : "") + '" data-doc="' + x.id + '">📄 <span class="tt">' + (x.num ? "<span class='chip'>" + x.num + "</span>" : "") + esc(x.title) + "</span></div>";
        });
        fh += '<div class="tn" data-fold="' + esc(key) + '" data-dep="' + esc(d.name) + '"><span class="ar">' + (op ? "▼" : "▶") + '</span>📁 <span class="tt">' + (f.code ? "<span class='chip'>" + esc(f.code) + "</span>" : "") + esc(f.title) + '</span><span class="cnt">' + f.files.length + "</span></div>" + (op ? '<div class="kids">' + inner + "</div>" : "");
      });
      if (flt && !fh) return;
      var dop = treeOpen[d.name] !== false;
      h += '<div class="tn" data-depn="' + esc(d.name) + '"><span class="ar">' + (dop ? "▼" : "▶") + '</span>📂 <b class="tt">' + esc(d.name) + '</b><span class="cnt">' + total + "</span></div>" + (dop ? '<div class="kids">' + fh + "</div>" : "");
    });
    $("#tree").innerHTML = h;
  }
  $("#treeFilter").oninput = renderTree;
  $("#tree").onclick = function (e) {
    var t = e.target.closest(".tn"); if (!t) return;
    if (t.dataset.doc) return openDoc(t.dataset.doc);
    if (t.dataset.depn) { treeOpen[t.dataset.depn] = treeOpen[t.dataset.depn] === false; state.dep = t.dataset.depn; renderTree(); return render(); }
    if (t.dataset.fold) {
      treeOpen[t.dataset.fold] = !treeOpen[t.dataset.fold]; state.dep = t.dataset.dep;
      state.open[t.dataset.fold] = treeOpen[t.dataset.fold]; renderTree(); render();
    }
  };

  /* ---------- chuyển chế độ xem ---------- */
  document.querySelectorAll("nav button").forEach(function (b) {
    b.onclick = function () { state.view = b.dataset.view; render(); };
  });
  function render() {
    document.querySelectorAll("nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.view === state.view); });
    ["Map", "Table", "Search"].forEach(function (n) { $("#view" + n).hidden = state.view !== n.toLowerCase(); });
    $("#mapTools").style.visibility = state.view === "map" ? "visible" : "hidden";
    var total = SEARCH.length;
    if (state.view === "map") { $("#viewTitle").textContent = "Sơ đồ hệ thống văn bản"; $("#viewSub").textContent = TREE.length + " phòng ban · " + total + " văn bản · " + (state.dep || ""); drawMap(); }
    if (state.view === "table") { $("#viewTitle").textContent = "Bảng tổng văn bản"; $("#viewSub").textContent = total + " văn bản"; drawTable(); }
    if (state.view === "search") { $("#viewTitle").textContent = "Kết quả tra cứu"; doSearch(); }
  }

  /* ---------- sơ đồ ---------- */
  function drawMap() {
    var dep = TREE.filter(function (d) { return d.name === state.dep; })[0]; if (!dep) return;
    var nodes = "", links = "", NH = 52, GAP = 16, FX = 40, FLX = 430, y = 0;
    // cột 1: phòng ban gốc
    var folderPos = [];
    var flt = dep.folders;
    // tính chiều cao từng thư mục (nếu mở thì cao theo số file)
    flt.forEach(function (f) {
      var key = dep.name + "/" + f.title, op = !!state.open[key];
      var h = op ? Math.max(NH, f.files.length * (NH - 8) + (f.files.length - 1) * 10) : NH;
      folderPos.push({ f: f, key: key, op: op, y: y, h: h, cy: y + h / 2 });
      y += h + GAP + (op ? 10 : 0);
    });
    var rootY = y / 2 - 20;
    nodes += '<div class="node" style="left:-300px;top:' + (rootY - 6) + 'px;width:240px"><span class="ic">🏢</span><div class="tx"><b>' + esc(dep.name) + '</b></div><span class="n">' + dep.folders.length + "</span></div>";
    folderPos.forEach(function (p) {
      var f = p.f;
      nodes += '<div class="node" data-fold="' + esc(p.key) + '" style="left:' + FX + "px;top:" + (p.cy - NH / 2 + 6) + 'px"><span class="ic">📁</span><div class="tx">' + (f.code ? '<span class="chip">' + esc(f.code) + "</span>" : "") + esc(f.title) + '</div><span class="n">' + f.files.length + "</span>" +
        (p.op ? '<span class="badge">−</span>' : "") + "</div>";
      links += curve(-60, rootY + 20, FX, p.cy + 6);
      if (p.op) {
        var fy = p.y;
        f.files.forEach(function (x, i) {
          var ty = fy + i * (NH - 8 + 10);
          nodes += '<div class="node file' + (state.sel === x.id ? " sel" : "") + '" data-doc="' + x.id + '" style="left:' + FLX + "px;top:" + (ty + 6) + 'px"><span class="ic">📄</span><div class="tx">' + (x.num ? '<span class="chip">' + x.num + "</span>" : '<span class="chip">SOP</span>') + esc(x.title) + "</div></div>";
          links += curve(FX + 260, p.cy + 6, FLX, ty + 6 + 20);
        });
      }
    });
    $("#nodes").innerHTML = nodes;
    $("#links").innerHTML = links; $("#links").setAttribute("width", 1000); $("#links").setAttribute("height", Math.max(y, 100) + 100);
    applyT();
  }
  function curve(x1, y1, x2, y2) {
    var mx = (x1 + x2) / 2;
    return '<path d="M' + x1 + "," + y1 + " C" + mx + "," + y1 + " " + mx + "," + y2 + " " + x2 + "," + y2 + '"/>';
  }
  $("#nodes").onclick = function (e) {
    var n = e.target.closest(".node"); if (!n) return;
    if (n.dataset.doc) return openDoc(n.dataset.doc);
    if (n.dataset.fold) { state.open[n.dataset.fold] = !state.open[n.dataset.fold]; treeOpen[n.dataset.fold] = state.open[n.dataset.fold]; renderTree(); drawMap(); }
  };
  $("#expandAll").onclick = function () { var dep = TREE.filter(function (d) { return d.name === state.dep; })[0]; dep.folders.forEach(function (f) { state.open[dep.name + "/" + f.title] = true; }); drawMap(); };
  $("#collapseAll").onclick = function () { state.open = {}; drawMap(); };

  // pan & zoom
  function applyT() { $("#canvas").style.transform = "translate(" + (state.px + 300) + "px," + state.py + "px) scale(" + state.zoom + ")"; $("#zLbl").textContent = Math.round(state.zoom * 100) + "%"; }
  function zoomBy(f) { state.zoom = Math.min(2, Math.max(.3, state.zoom * f)); applyT(); }
  $("#zIn").onclick = function () { zoomBy(1.15); }; $("#zOut").onclick = function () { zoomBy(1 / 1.15); };
  $("#zFit").onclick = function () { state.zoom = 1; state.px = 40; state.py = 30; applyT(); };
  var vm = $("#viewMap"), drag = null;
  vm.onmousedown = function (e) { if (e.target.closest(".node")) return; drag = { x: e.clientX - state.px, y: e.clientY - state.py }; vm.classList.add("drag"); };
  window.addEventListener("mousemove", function (e) { if (!drag) return; state.px = e.clientX - drag.x; state.py = e.clientY - drag.y; applyT(); });
  window.addEventListener("mouseup", function () { drag = null; vm.classList.remove("drag"); });
  vm.addEventListener("wheel", function (e) { e.preventDefault(); if (e.ctrlKey) zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); else { state.px -= e.deltaX; state.py -= e.deltaY; applyT(); } }, { passive: false });

  /* ---------- bảng tổng ---------- */
  function drawTable() {
    var h = "<table><tr><th>Mã</th><th>STT</th><th>Tên văn bản</th><th>Thư mục</th><th>Cập nhật</th></tr>";
    Object.keys(DOCS).forEach(function (id) {
      var d = DOCS[id];
      h += '<tr class="r" data-doc="' + id + '"><td>' + esc(d.code || "") + "</td><td>" + esc(d.num) + "</td><td>" + esc(d.title) + "</td><td>" + esc(d.path) + "</td><td>" + esc(d.updated) + "</td></tr>";
    });
    $("#viewTable").innerHTML = h + "</table>";
  }
  $("#viewTable").onclick = function (e) { var r = e.target.closest("tr.r"); if (r) openDoc(r.dataset.doc); };

  /* ---------- tìm kiếm ---------- */
  function doSearch() {
    var q = norm($("#q").value.trim()), box = $("#viewSearch");
    if (!q) { box.innerHTML = '<div class="res">Nhập từ khoá vào ô tìm kiếm phía trên.</div>'; $("#viewSub").textContent = ""; return; }
    var words = q.split(/\s+/), inC = $("#inContent").checked, out = [];
    SEARCH.forEach(function (d) {
      var hay = inC ? d.n + " " + d.nx : d.n;
      if (words.every(function (w) { return hay.indexOf(w) > -1; })) out.push(d);
    });
    $("#viewSub").textContent = out.length + " kết quả cho “" + $("#q").value + "”";
    box.innerHTML = out.slice(0, 200).map(function (d) {
      var snip = "";
      if (inC) { var i = d.nx.indexOf(words[0]); if (i > -1 && d.n.indexOf(words[0]) === -1) snip = "…" + esc(d.x.substr(Math.max(0, i - 40), 120)) + "…"; }
      return '<div class="res" data-doc="' + d.id + '"><b>' + esc(d.t) + "</b> " + (d.c ? '<span class="chip">' + esc(d.c) + "</span>" : "") + "<small>" + esc(d.p) + "</small>" + (snip ? "<small>" + snip + "</small>" : "") + "</div>";
    }).join("") || '<div class="res">Không tìm thấy.</div>';
  }
  $("#viewSearch").onclick = function (e) { var r = e.target.closest(".res"); if (r && r.dataset.doc) openDoc(r.dataset.doc); };
  var tm;
  $("#q").oninput = function () { clearTimeout(tm); tm = setTimeout(function () { state.view = "search"; render(); }, 200); };
  $("#inContent").onchange = function () { if (state.view === "search") doSearch(); };
  document.addEventListener("keydown", function (e) { if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); $("#q").focus(); } });

  /* ---------- xem trước ---------- */
  function openDoc(id) {
    var d = DOCS[id]; if (!d) return;
    state.sel = id;
    $("#preview").hidden = false;
    $("#pCode").textContent = d.code || "SOP"; $("#pTitle").textContent = d.title;
    $("#pMeta").textContent = d.type + " · " + d.size + " KB · cập nhật " + d.updated;
    $("#pPath").textContent = d.path;
    $("#docPage").innerHTML = "Đang tải…";
    fetch("data/docs/" + id + ".html").then(function (r) { return r.text(); }).then(function (h) { $("#docPage").innerHTML = h; $("#pBody").scrollTop = 0; });
    renderTree(); if (state.view === "map") drawMap();
  }
  $("#pClose").onclick = function () { $("#preview").hidden = true; state.sel = null; renderTree(); if (state.view === "map") drawMap(); };
})();
