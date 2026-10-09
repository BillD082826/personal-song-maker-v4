async function showAllAds() {
  document.querySelector(".caption-section").style.display = "";
  document.getElementById("section-title").textContent = "All Ads";
  const selector = document.getElementById("ad-selector");
  const preview = document.getElementById("ad-preview");
  const response = await fetch("all-ads.json");
  const ads = await response.json();
  selector.replaceChildren();
  preview.replaceChildren();
  for (const ad of ads) {
    const button = document.createElement("button");
    button.className = "ad-choice";
    button.textContent = (ad.type === "video" ? "Video: " : "Static: ") + ad.name;
    button.onclick = () => {
      selector.querySelectorAll("button").forEach(b => b.classList.remove("selected"));
      button.classList.add("selected");
      preview.replaceChildren();
      const heading = document.createElement("h2");
      heading.textContent = ad.name;
      const media = document.createElement(ad.type === "video" ? "video" : "img");
      media.src = encodeURI(ad.type === "video" ? ad.video : ad.image);
      media.style.width = "100%";
      media.style.maxHeight = "550px";
      media.style.objectFit = "contain";
      if (ad.type === "video") {
        media.controls = true;
        showVideoCaptions(ad.id);
      } else {
        showAdCaptions(ad.id);
      }
      const statusControls = document.createElement("div");
      statusControls.className = "ad-status-controls";
      const statusKey = ad.type + "-" + ad.id;
      const statuses = ["Draft", "Ready to Post", "Archive", "Record Posting"];
      const currentStatus = localStorage.getItem("lyribop-status-" + statusKey) || "Ready to Post";
      for (const status of statuses) {
        const statusButton = document.createElement("button");
        statusButton.textContent = status;
        statusButton.className = "ad-choice";
        statusButton.style.marginRight = "8px";
        statusButton.style.marginBottom = "12px";
        statusButton.style.opacity = status === currentStatus ? "1" : "0.5";
        statusButton.onclick = () => {
          if (status === "Record Posting") {
            recordPosting(ad);
            return;
          }
          localStorage.setItem("lyribop-status-" + statusKey, status);
          statusControls.querySelectorAll("button").forEach(b => b.style.opacity = b === statusButton ? "1" : "0.5");
        };
        statusControls.append(statusButton);
      }
      preview.append(heading, statusControls, media);
    };
    selector.append(button);
  }
  selector.firstElementChild?.click();
}

async function showReadyToPost() {
  await showAllAds();
  document.getElementById("section-title").textContent = "Ready to Post";
  const response = await fetch("ad-status.json");
  const statuses = await response.json();
  const selector = document.getElementById("ad-selector");
  const ads = await (await fetch("all-ads.json")).json();
  const buttons = Array.from(selector.children);
  ads.forEach((ad, i) => {
    if ((localStorage.getItem("lyribop-status-" + ad.type + "-" + ad.id) || statuses[ad.type + "-" + ad.id]) !== "Ready to Post") buttons[i].remove();
  });
  selector.firstElementChild?.click();
}

async function showArchivedAds() {
  await showAllAds();
  document.getElementById("section-title").textContent = "Archive";
  const selector = document.getElementById("ad-selector");
  const ads = await (await fetch("all-ads.json")).json();
  const buttons = Array.from(selector.children);
  ads.forEach((ad, i) => {
    const key = "lyribop-status-" + ad.type + "-" + ad.id;
    if (localStorage.getItem(key) !== "Archive") buttons[i].remove();
  });
  document.querySelector(".caption-section").style.display = "none";
  selector.firstElementChild?.click();
  if (!selector.children.length) {
    document.getElementById("ad-preview").textContent = "No archived advertisements.";
  }
}

async function showCaptionsSection() {
  await showAllAds();
  document.getElementById("section-title").textContent = "Captions";
}

async function showHashtagsSection() {
  await showAllAds();
  document.getElementById("section-title").textContent = "Hashtags";
}
