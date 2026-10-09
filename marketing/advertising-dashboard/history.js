async function showPostingHistory() {
  document.getElementById("section-title").textContent = "Posting History";
  document.querySelector(".caption-section").style.display = "none";
  const selector = document.getElementById("ad-selector");
  const preview = document.getElementById("ad-preview");
  try {
    const response = await fetch("posting-history.json", {cache:"no-store"});
    if (!response.ok) throw new Error("History unavailable");
    const records = await response.json();
    selector.replaceChildren();
    preview.replaceChildren();
    if (records.length) {
      const table = document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";
      const header = table.createTHead().insertRow();
      for (const title of ["Advertisement","Platform","Date","Time"]) {
        const cell = document.createElement("th");
        cell.textContent = title;
        cell.style.textAlign = "left";
        cell.style.padding = "12px";
        header.append(cell);
      }
      for (const record of records.slice().reverse()) {
        const date = new Date(record.posted_at);
        const row = table.insertRow();
        const values = [record.advertisement,record.platforms.join(" & "),date.toLocaleDateString(),date.toLocaleTimeString()];
        for (const value of values) {
          const cell = row.insertCell();
          cell.textContent = value;
          cell.style.padding = "12px";
          cell.style.borderTop = "1px solid #e5e3f0";
        }
      }
      preview.append(table);
    }
    if (!records.length) selector.textContent = "No postings recorded yet.";
  } catch (error) {
    selector.textContent = "Unable to load Posting History.";
  }
}
