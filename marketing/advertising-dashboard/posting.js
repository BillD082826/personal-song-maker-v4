function recordPosting(ad) {
  const choice = prompt("Record posting for " + ad.name + "\n1 = Facebook\n2 = Instagram\n3 = Both");
  if (choice === null) return;
  const platforms = {"1":["Facebook"],"2":["Instagram"],"3":["Facebook","Instagram"]}[choice.trim()];
  if (!platforms) { alert("Choose 1, 2, or 3."); return; }
  if (!confirm("Record " + ad.name + " on " + platforms.join(" and ") + "?")) return;
  fetch("/api/posting-history", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({type: ad.type, id: ad.id, platforms})
  }).then(response => {
    if (!response.ok) throw new Error("Save failed");
    alert("Posting recorded successfully.");
  }).catch(() => alert("Posting could not be saved."));

}
