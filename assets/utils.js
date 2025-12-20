// assets/utils.js
(function () {
  "use strict";

  // Échappement HTML (sécurité)
  window.escHTML = function (v) {
    return (v == null ? "" : String(v))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  /**
   * Drag & resize des colonnes du tableau
   * - Ajoute des poignées dans chaque TH
   * - Ajuste la width du TH (et laisse le navigateur appliquer aux TD)
   * - Compatible avec scroll horizontal
   */
  window.enableColumnResize = function (tableSelector, opts) {
    const cfg = Object.assign({ minPx: 80 }, opts || {});
    const table = document.querySelector(tableSelector);
    if (!table) return;

    const thead = table.querySelector("thead");
    if (!thead) return;

    const ths = Array.from(thead.querySelectorAll("th"));
    if (!ths.length) return;

    // Important : table-layout: fixed aide la stabilité mais pas obligatoire.
    // Ici on force surtout des widths de TH.
    ths.forEach((th) => {
      // Éviter doublons
      if (th.querySelector(".col-resizer")) return;

      // S'assurer que TH a une position relative (CSS le fait déjà mais on sécurise)
      th.style.position = th.style.position || "relative";

      // Si pas de width explicit, on fixe la largeur actuelle en px
      const rect = th.getBoundingClientRect();
      if (!th.style.width) th.style.width = Math.max(cfg.minPx, Math.round(rect.width)) + "px";

      const handle = document.createElement("div");
      handle.className = "col-resizer";
      handle.setAttribute("aria-hidden", "true");
      th.appendChild(handle);

      let startX = 0;
      let startW = 0;

      function onMove(e) {
        const dx = e.clientX - startX;
        const newW = Math.max(cfg.minPx, startW + dx);
        th.style.width = newW + "px";
      }

      function onUp() {
        document.documentElement.classList.remove("col-resize-active");
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }

      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startX = e.clientX;
        startW = parseFloat(th.style.width) || th.getBoundingClientRect().width;

        document.documentElement.classList.add("col-resize-active");
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
    });
  };
})();
