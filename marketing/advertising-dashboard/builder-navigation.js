window.addEventListener('load', async () => {
  await Promise.allSettled([window.staticCatalogReady, window.videoCatalogReady]);
  const routes = { ready: showReadyToPost, all: showAllAds, static: loadAdvertisements, video: () => window.showLyriBopVideos(), captions: showCaptionsSection, hashtags: showHashtagsSection, archive: showArchivedAds, history: showPostingHistory };
  const route = location.hash.slice(1);
  if (routes[route]) {
    const labels = { ready: 'Ready to Post', all: 'All Ads', static: 'Static Ads', video: 'Video Ads', captions: 'Captions', hashtags: 'Hashtags', archive: 'Archive', history: 'Posting History' };
    document.querySelectorAll('.sidebar nav a').forEach(link => link.classList.toggle('active', link.textContent.trim() === labels[route]));
    routes[route]();
  }
});
