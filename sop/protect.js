// Chống copy / chọn text / chuột phải / in / lưu / chụp màn hình (mức trình duyệt)
(function () {
  var C = window.SOP_CONFIG || {};
  var stop = function (e) { e.preventDefault(); e.stopPropagation(); return false; };
  var isField = function (e) { var t = e.target; return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA"); };

  ["contextmenu", "dragstart", "selectstart", "copy", "cut", "paste"].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (!isField(e)) return stop(e); }, true);
  });
  // copy trong ô tìm kiếm cũng chặn cut/copy, vẫn cho gõ & dán
  ["copy", "cut"].forEach(function (ev) { document.addEventListener(ev, stop, true); });

  function blank() { document.getElementById("shield").classList.add("on"); }
  function unblank() { document.getElementById("shield").classList.remove("on"); }

  document.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase();
    var mod = e.ctrlKey || e.metaKey;
    if (k === "printscreen") {
      try { navigator.clipboard.writeText(" "); } catch (_) {}
      blank(); setTimeout(unblank, 1500); return stop(e);
    }
    if (k === "f12") return stop(e);
    if (mod && ["s", "p", "u", "c", "x", "a"].indexOf(k) > -1 && !isField(e)) return stop(e);
    if (mod && e.shiftKey && ["i", "j", "c", "s"].indexOf(k) > -1) { // devtools, Win+Shift+S không bắt được ở đây
      if (k === "s") { blank(); setTimeout(unblank, 1500); }
      return stop(e);
    }
  }, true);
  document.addEventListener("keyup", function (e) {
    if ((e.key || "").toLowerCase() === "printscreen") { try { navigator.clipboard.writeText(" "); } catch (_) {} }
  }, true);

  // Ẩn nội dung khi rời cửa sổ (công cụ chụp thường làm mất focus)
  if (C.blurOnLoseFocus !== false) {
    window.addEventListener("blur", blank);
    window.addEventListener("focus", unblank);
    document.addEventListener("visibilitychange", function () { document.hidden ? blank() : unblank(); });
  }

  // Phát hiện mở DevTools (ước lượng theo kích thước cửa sổ)
  setInterval(function () {
    var open = (window.outerWidth - window.innerWidth > 200) || (window.outerHeight - window.innerHeight > 220);
    if (open) blank(); else if (document.hasFocus()) unblank();
  }, 1000);

  // Watermark chữ chìm
  window.SOP_WM = function (name) {
    if (C.watermark === false) return;
    var wm = document.getElementById("wm"); wm.innerHTML = "";
    var d = new Date(), txt = name + " · " + d.toLocaleString("vi-VN");
    for (var y = -100; y < screen.height + 200; y += 130)
      for (var x = -200; x < screen.width + 200; x += 330) {
        var s = document.createElement("span"); s.textContent = txt;
        s.style.left = x + "px"; s.style.top = y + "px"; wm.appendChild(s);
      }
  };
})();
