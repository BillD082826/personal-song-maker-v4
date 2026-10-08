
let captionData = null;
let hashtagData = null;
let selectedCaptionId = "1";

async function initializeCaptions() {
  try {
    const [captionsResponse, hashtagsResponse] = await Promise.all([
      fetch("captions.json"),
      fetch("hashtags.json")
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
      const caption = captionData?.[platform]?.[selectedCaptionId] || "";
      const hashtags = hashtagData?.[selectedCaptionId] || "";
      copyCaptionText(
        [caption, hashtags].filter(Boolean).join("\n\n"),
        button
      );
    });
  });

  const hashtagButton = document.getElementById("copy-hashtags");

  hashtagButton.addEventListener("click", () => {
    copyCaptionText(
      hashtagData?.[selectedCaptionId] || "",
      hashtagButton
    );
  });
});
