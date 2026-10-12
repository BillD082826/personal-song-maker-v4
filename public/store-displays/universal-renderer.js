(function () {
  "use strict";

  const WIDTH = 1200;
  const HEIGHT = 1800;
  const POCKET_TOP = 1500;
  const SAFE_MARGIN = 28;

  function validateCanvas(canvas) {
    if (!canvas || canvas.width !== WIDTH || canvas.height !== HEIGHT) {
      throw new Error("Store Display canvas must be 1200 x 1800.");
    }
  }

  function validateBounds(x, y, width, height, allowPocket = false) {
    const bottomLimit = allowPocket ? HEIGHT : POCKET_TOP;

    if (
      ![x, y, width, height].every(Number.isFinite) ||
      width <= 0 || height <= 0 ||
      x < SAFE_MARGIN || y < SAFE_MARGIN ||
      x + width > WIDTH - SAFE_MARGIN ||
      y + height > bottomLimit
    ) {
      throw new Error("Store Display element exceeds its permitted area.");
    }
  }

  window.LyriBopStoreDisplay = Object.freeze({
    WIDTH,
    HEIGHT,
    POCKET_TOP,
    SAFE_MARGIN,
    validateCanvas,
    validateBounds
  });
})();
