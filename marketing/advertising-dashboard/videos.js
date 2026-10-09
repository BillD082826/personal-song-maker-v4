
async function loadVideos() {
  const selector = document.getElementById("ad-selector");
  const preview = document.getElementById("ad-preview");

  if (!selector || !preview) return;

  try {
    const response = await fetch("videos.json");
    if (!response.ok) throw new Error("Could not load video catalog.");

    const videos = await response.json();

    function selectVideo(ad, button) {
      selector.querySelectorAll(".ad-choice").forEach(item => {
        item.classList.remove("selected");
      });

      button.classList.add("selected");
      if (typeof showVideoCaptions === "function") showVideoCaptions(ad.id);
      preview.replaceChildren();

      const heading = document.createElement("h2");
      heading.textContent = `${String(ad.id).padStart(2, "0")} ${ad.name}`;

      const player = document.createElement("video");
      player.src = encodeURI(ad.video);
      player.controls = true;
      player.playsInline = true;
      player.preload = "metadata";
      player.style.width = "100%";
      player.style.maxHeight = "550px";
      player.style.objectFit = "contain";

      const download = document.createElement("a");
      download.href = encodeURI(ad.video);
      download.download = ad.video.split("/").pop();
      download.textContent = "Download Video";
      download.className = "video-download";

      preview.append(heading, player, download);
    }

    window.showLyriBopVideos = function () {
      selector.replaceChildren();
      preview.replaceChildren();

      videos.forEach((ad, index) => {
        const button = document.createElement("button");
        button.className = "ad-choice";

        const label = document.createElement("span");
        label.textContent =
          `${String(ad.id).padStart(2, "0")} ${ad.name}`;

        button.append(label);
        button.addEventListener("click", () => selectVideo(ad, button));
        selector.append(button);

        if (index === 0) selectVideo(ad, button);
      });
    };

  } catch (error) {
    console.error("LyriBop video error:", error);
  }
}

document.addEventListener("DOMContentLoaded", loadVideos);
