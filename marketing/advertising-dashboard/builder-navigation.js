document.addEventListener('DOMContentLoaded', () => {
  const routes = { greetings: showSeasonalGreetings, ready: showReadyToPost, all: showAllAds, static: showStaticFolderCatalog, video: showVideoFolderCatalog, captions: showCaptionsSection, hashtags: showHashtagsSection, archive: showArchivedAds, history: showPostingHistory };
  const requestedRoute = location.hash.slice(1);
  const route = Object.hasOwn(routes, requestedRoute) ? requestedRoute : 'ready';
  const labels = { greetings: 'Seasonal Greetings', ready: 'Ready to Post', all: 'All Ads', static: 'Static Ads', video: 'Video Ads', captions: 'Captions', hashtags: 'Hashtags', archive: 'Archive', history: 'Posting History' };
  document.querySelectorAll('.sidebar nav a').forEach(link => link.classList.toggle('active', link.textContent.trim() === labels[route]));
  catalogStartCollapsed = true;
  routes[route]();
});
