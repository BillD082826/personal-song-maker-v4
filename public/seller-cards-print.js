// Wait for the SVG templates and nested QR images before enabling printing.
window.addEventListener('load', () => {
  const button = document.getElementById('print-cards');
  button.disabled = false;
  button.textContent = 'Print / Save as PDF';
  button.addEventListener('click', () => window.print());
});
