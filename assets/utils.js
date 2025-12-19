function unique(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a,b)=> String(a).localeCompare(String(b)));
}

function fillSelect(select, values, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>` + values.map(v => `<option>${escapeHtml(v)}</option>`).join("");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function norm(v){ return (v||"").toString().trim().toLowerCase(); }

function groupCount(arr, fnKey) {
  return arr.reduce((acc, item) => {
    const k = fnKey(item);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}
