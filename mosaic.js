let targetImg = null;
let tileImgs = [];
let mosaic;
let scaleFactor = 10;
let generating = false;

function setup() {
  let c = createCanvas(800, 600);
  c.parent(document.body);
  noLoop();
  background(220);
  textAlign(CENTER, CENTER);
  text("Upload images to begin", width / 2, height / 2);

  setupDropZones();
  setupControls();
}

function setupDropZones() {
  const targetDrop = document.getElementById("targetDrop");
  const tileDrop = document.getElementById("tileDrop");

  function handleDrop(e, isTarget) {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (isTarget) {
      if (files.length > 0) {
        loadImage(URL.createObjectURL(files[0]), img => {
          targetImg = img;
          targetDrop.textContent = "✅ Target Loaded";
          enableGenerateIfReady();
        });
      }
    } else {
      tileImgs = [];
      for (let f of files) {
        loadImage(URL.createObjectURL(f), img => {
          tileImgs.push(img);
          if (tileImgs.length === files.length) {
            tileDrop.textContent = `✅ ${tileImgs.length} Tiles Loaded`;
            enableGenerateIfReady();
          }
        });
      }
    }
  }

  for (let dz of [targetDrop, tileDrop]) {
    dz.addEventListener("dragover", e => {
      e.preventDefault();
      dz.classList.add("dragover");
    });
    dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
  }

  targetDrop.addEventListener("drop", e => {
    targetDrop.classList.remove("dragover");
    handleDrop(e, true);
  });
  tileDrop.addEventListener("drop", e => {
    tileDrop.classList.remove("dragover");
    handleDrop(e, false);
  });
}

function setupControls() {
  const slider = document.getElementById("gridSlider");
  const label = document.getElementById("gridValue");
  slider.oninput = () => {
    scaleFactor = int(slider.value);
    label.textContent = scaleFactor;
  };

  document.getElementById("generateBtn").onclick = generateMosaic;
  document.getElementById("downloadBtn").onclick = () => {
    saveCanvas(mosaic, "mosaic_output", "png");
  };
}

function enableGenerateIfReady() {
  const btn = document.getElementById("generateBtn");
  if (targetImg && tileImgs.length > 0) btn.disabled = false;
}

function draw() {
  if (generating) {
    text("Generating mosaic...", width / 2, height / 2);
  } else if (mosaic) {
    image(mosaic, 0, 0, width, height);
  }
}
