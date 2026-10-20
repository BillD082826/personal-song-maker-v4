
let captionData = null;
let hashtagData = null;
let selectedCaptionId = "1";

async function initializeCaptions() {
  try {
    const [captionsResponse, hashtagsResponse] = await Promise.all([
      fetch("captions.json", {cache:"no-store"}),
      fetch("hashtags.json", {cache:"no-store"})
    ]);

    if (!captionsResponse.ok || !hashtagsResponse.ok) {
      throw new Error("Could not load caption data.");
    }

    captionData = await captionsResponse.json();
    hashtagData = await hashtagsResponse.json();

    showAdCaptions(selectedCaptionId);
  } catch (error) {
    document.getElementById("facebook-caption").textContent =
      error.message;
  }
}

function showAdCaptions(id) {
  selectedCaptionId = String(id);

  showPinterestCaption(id);
  if (!captionData || !hashtagData) return;

  document.getElementById("facebook-caption").textContent =
    captionData.facebook[selectedCaptionId] || "";

  document.getElementById("instagram-caption").textContent =
    captionData.instagram[selectedCaptionId] || "";

  document.getElementById("ad-hashtags").textContent =
    hashtagData[selectedCaptionId] || "";
}

async function copyCaptionText(text, button) {
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied!";
    setTimeout(() => {
      button.textContent = button.id === "copy-hashtags"
        ? "Copy Hashtags"
        : "Copy All";
    }, 1500);
  } catch (error) {
    button.textContent = "Copy failed";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initializeCaptions();

  ["facebook", "instagram"].forEach(platform => {
    const button = document.getElementById("copy-" + platform);

    button.addEventListener("click", () => {
      const caption = document.getElementById(platform + "-caption").textContent;
      const hashtags = document.getElementById("ad-hashtags").textContent;
      copyCaptionText(
        [caption, caption.includes("#") ? "" : hashtags].filter(Boolean).join("\n\n"),
        button
      );
    });
  });

  const hashtagButton = document.getElementById("copy-hashtags");

  hashtagButton.addEventListener("click", () => {
    copyCaptionText(
      document.getElementById("ad-hashtags").textContent,
      hashtagButton
    );
  });
});

let videoCaptionData = null;

async function showVideoCaptions(id) {
  showPinterestCaption(null);
  try {
    if (!videoCaptionData) {
      const response = await fetch("video-captions.json", {cache:"no-store"});
      if (!response.ok) throw new Error("Could not load video captions");
      videoCaptionData = await response.json();
    }

    selectedCaptionId = String(id);
    captionData = await (await fetch("captions.json", {cache:"no-store"})).json();
    const tagsResponse = await fetch("video-hashtags.json");
    if (!tagsResponse.ok) throw new Error("Could not load video hashtags");
    const videoHashtags = await tagsResponse.json();

    document.getElementById("facebook-caption").textContent =
      videoCaptionData.facebook[selectedCaptionId] || "";

    document.getElementById("instagram-caption").textContent =
      videoCaptionData.instagram[selectedCaptionId] || "";

    document.getElementById("ad-hashtags").textContent =
      videoHashtags[selectedCaptionId] || "";
    showPinterestCaption(id, videoCaptionData);
  } catch (error) {
    console.error("Video caption error:", error);
  }
}


function showPinterestCaption(id, source = captionData) {
  const card = document.getElementById("pinterest-caption-card");
  if (!card) return;
  const pin = source?.pinterest?.[String(id)];
  card.hidden = !pin;
  for (const field of ["title", "description", "link"]) {
    document.getElementById("pinterest-" + field).textContent = pin?.[field] || "";
  }
}
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-pinterest-copy]").forEach(button => {
    const label = button.textContent;
    button.addEventListener("click", async () => {
      const text = document.getElementById("pinterest-" + button.dataset.pinterestCopy).textContent;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "Copied!";
      } catch {
        button.textContent = "Select text to copy";
      }
      setTimeout(() => { button.textContent = label; }, 1500);
    });
  });
});
