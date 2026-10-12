window.LyriBopDrawSellerCode = function(ctx, code) {
  if (!code) return;
  const label = "Seller Code: " + code;
  ctx.save();
  try {
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    const width = ctx.measureText(label).width;
    window.LyriBopStoreDisplay.validateBounds(1140-width, 1710, width, 40, true);
    ctx.fillText(label, 1140, 1740);
  } finally { ctx.restore(); }
};
