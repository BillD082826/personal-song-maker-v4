
async function loadAdvertisements() {
  const selector = document.getElementById("ad-selector");
  const preview = document.getElementById("ad-preview");

  try {
    const response = await fetch("ads.json");
    if (!response.ok) throw new Error("Could not load advertisements");

    const ads = await response.json();

    function selectAd(ad, button) {
      selector.querySelectorAll("button").forEach(item => {
        item.classList.remove("selected");
      });

      button.classList.add("selected");
      if (typeof showAdCaptions === "function") showAdCaptions(ad.id);

      preview.innerHTML = "";

      const heading = document.createElement("h2");
      heading.textContent = `${String(ad.id).padStart(2, "0")} ${ad.name}`;

      const image = document.createElement("img");
      image.src = ad.image;
      image.alt = `LyriBop ${ad.name} advertisement`;
      image.style.width = "100%";
      image.style.maxHeight = "550px";
      image.style.objectFit = "contain";

      preview.append(heading, image);
    }

    selector.replaceChildren();
    preview.replaceChildren();

    ads.forEach((ad, index) => {
      const button = document.createElement("button");
      button.className = "ad-choice";

      const thumbnail = document.createElement("img");
      thumbnail.src = ad.image;
      thumbnail.alt = "";

      const label = document.createElement("span");
      label.textContent = `${String(ad.id).padStart(2, "0")} ${ad.name}`;

      button.append(thumbnail, label);
      selector.appendChild(button);

      button.addEventListener("click", () => selectAd(ad, button));

      if (index === 0) selectAd(ad, button);
    });
  } catch (error) {
    preview.textContent = error.message;
  }
}

document.addEventListener("DOMContentLoaded", loadAdvertisements);
