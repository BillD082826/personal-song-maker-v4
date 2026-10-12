window.drawMemorySongDisplay = function(ctx, design, price, qrImage, sellerCode) {
  const bg = ctx.createLinearGradient(0, 0, 1200, 1800);
  bg.addColorStop(0, "#101b30");
  bg.addColorStop(0.55, "#1c2e4b");
  bg.addColorStop(1, "#101b30");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1200, 1800);

  ctx.strokeStyle = "#c6a45b";
  ctx.lineWidth = 28;
  ctx.strokeRect(14, 14, 1172, 1772);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#c6a45b";
  ctx.fillRect(265, 90, 670, 72);
  ctx.fillStyle = "#101b30";
  ctx.font = "bold 30px Arial";
  ctx.fillText(design.badge, 600, 126);

  ctx.fillStyle = "#ffffff";
  ctx.font = "100px Georgia";
  ctx.fillText("♫ LyriBop", 600, 265);

  ctx.fillStyle = "#e6c987";
  ctx.font = "italic 43px Georgia";
  ctx.fillText(design.tagline, 600, 355);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 104px Georgia";
  ctx.fillText(design.headlineTop, 600, 535);
  ctx.fillStyle = "#e6c987";
  ctx.fillText(design.headlineHighlight, 600, 645);

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "38px Arial";
  ctx.fillText(design.detailLine1, 600, 795);
  ctx.fillText(design.detailLine2, 600, 850);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(335, 920, 530, 190);

  ctx.fillStyle = "#123a63";
  ctx.font = "bold 30px Arial";
  ctx.fillText(design.priceLabel, 600, 970);

  ctx.font = "bold 90px Arial";
  ctx.fillText("$" + price, 600, 1050);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(175, 1140, 355, 355);
  ctx.drawImage(qrImage, 195, 1160, 315, 315);

  ctx.textAlign = "left";
  ctx.fillStyle = "#e6c987";
  ctx.font = "bold 49px Arial";
  ctx.fillText("SCAN TO", 565, 1220);
  ctx.fillText("CREATE YOUR", 565, 1280);
  ctx.fillText("SONG", 565, 1340);

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "27px Arial";
  ctx.fillText(design.scanDetail1, 565, 1420);
  ctx.fillText(design.scanDetail2, 565, 1460);

  ctx.fillStyle = "#182842";
  ctx.fillRect(28, 1500, 1144, 272);

  ctx.strokeStyle = "#a9b3c4";
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 14]);
  ctx.beginPath();
  ctx.moveTo(28, 1500);
  ctx.lineTo(1172, 1500);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = "center";
  ctx.fillStyle = "#a9b3c4";
  ctx.font = "bold 28px Arial";

  if (sellerCode) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.fillText("Seller Code: " + sellerCode, 1140, 1740);
  }
};
