export default function ExportButton({ containerSelector }) {
  const handleExport = async () => {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const svg = container.querySelector("svg");
    if (!svg) return;

    const clone = svg.cloneNode(true);
    const width = svg.getAttribute("width") || svg.clientWidth;
    const height = svg.getAttribute("height") || svg.clientHeight;

    // Inline computed styles for export
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.style.background = "#08081a";

    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const canvas = document.createElement("canvas");
    const scale = 2; // retina
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#08081a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      canvas.toBlob((pngBlob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(pngBlob);
        a.download = "mortgage-viz.png";
        a.click();
        URL.revokeObjectURL(a.href);
      }, "image/png");
    };
    img.src = url;
  };

  return (
    <button className="export-btn" onClick={handleExport} title="Export heatmap as PNG">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 11v3h12v-3" />
        <path d="M8 2v8" />
        <path d="M5 7l3 3 3-3" />
      </svg>
      PNG
    </button>
  );
}
