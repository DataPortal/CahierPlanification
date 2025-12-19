/* =========================================================
   Column Resize (Drag & Resize) – Vanilla JS
   - Compatible: table-layout: fixed
   - Works on: <th> in <thead>
   - Applies width to both <th> and corresponding <td>
   - Supports multiple tables (ex: #tbl, #riskTbl)
   ========================================================= */

(function () {
  const MIN_PX_DEFAULT = 70;

  function px(n) { return `${Math.max(0, Math.round(n))}px`; }

  function ensureColGroup(table, colCount) {
    // We use <colgroup> to enforce widths across head+body cleanly.
    let cg = table.querySelector("colgroup");
    if (!cg) {
      cg = document.createElement("colgroup");
      table.insertBefore(cg, table.firstChild);
    }
    const existing = cg.querySelectorAll("col").length;
    for (let i = existing; i < colCount; i++) cg.appendChild(document.createElement("col"));
    // If too many cols, trim (rare)
    while (cg.querySelectorAll("col").length > colCount) cg.removeChild(cg.lastChild);
    return cg;
  }

  function getHeaderRow(table) {
    const thead = table.tHead;
    if (!thead) return null;
    // Use the first row of thead
    return thead.rows && thead.rows.length ? thead.rows[0] : null;
  }

  function initTableResize(table, opts = {}) {
    const minPx = Number(opts.minPx || MIN_PX_DEFAULT);

    const row = getHeaderRow(table);
    if (!row) return;

    // Use only actual TH elements (ignore hidden/empty)
    const ths = Array.from(row.cells).filter(c => c.tagName === "TH");
    if (!ths.length) return;

    // Prepare colgroup matching number of header cells
    const colgroup = ensureColGroup(table, ths.length);
    const cols = Array.from(colgroup.querySelectorAll("col"));

    // If there are preset widths on TH (via CSS), we initialize col widths from rendered widths.
    // This ensures col widths persist even after resize.
    ths.forEach((th, i) => {
      const w = th.getBoundingClientRect().width;
      cols[i].style.width = px(w);
      th.style.width = ""; // let colgroup drive width
    });

    // Add handles
    ths.forEach((th, i) => {
      // Don't add handle on last column unless you want it (optional)
      // We'll allow it by default.
      th.style.position = "relative";

      const handle = document.createElement("span");
      handle.className = "col-resizer";
      handle.setAttribute("data-col-index", String(i));
      handle.setAttribute("role", "separator");
      handle.setAttribute("aria-orientation", "vertical");
      handle.setAttribute("title", "Glisser pour redimensionner");
      th.appendChild(handle);

      let startX = 0;
      let startW = 0;
      let dragging = false;

      const onMove = (ev) => {
        if (!dragging) return;
        const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const delta = clientX - startX;
        const newW = Math.max(minPx, startW + delta);
        cols[i].style.width = px(newW);
      };

      const stop = () => {
        if (!dragging) return;
        dragging = false;
        document.documentElement.classList.remove("col-resize-active");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", stop);
        document.removeEventListener("touchmove", onMove, { passive: false });
        document.removeEventListener("touchend", stop);
      };

      const start = (ev) => {
        // prevent text selection while dragging
        ev.preventDefault();

        const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
        startX = clientX;
        startW = cols[i].getBoundingClientRect().width || th.getBoundingClientRect().width;
        dragging = true;

        document.documentElement.classList.add("col-resize-active");
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", stop);
        document.addEventListener("touchmove", onMove, { passive: false });
        document.addEventListener("touchend", stop);
      };

      handle.addEventListener("mousedown", start);
      handle.addEventListener("touchstart", start, { passive: false });
    });
  }

  // Public API
  window.enableColumnResize = function (selectorOrEl, opts = {}) {
    const tables = typeof selectorOrEl === "string"
      ? Array.from(document.querySelectorAll(selectorOrEl))
      : [selectorOrEl].filter(Boolean);

    tables.forEach(t => initTableResize(t, opts));
  };
})();
