onmessage = e => {
  const { type, tileFeatures, spotFeatures } = e.data;
  if (type === "compute") {
    const assignment = computeOptimal(tileFeatures, spotFeatures);
    postMessage({ type: "done", assignment });
  }
};

function computeOptimal(tileFeatures, spotFeatures) {
  const numSpots = spotFeatures.length;
  const numTiles = tileFeatures.length;

  const costMatrix = Array.from({ length: numSpots }, () => new Array(numTiles));

  for (let i = 0; i < numSpots; i++) {
    for (let j = 0; j < numTiles; j++) {
      let diff = 0;
      for (let k = 0; k < 48; k++) { // 8×6 grayscale vector
        diff += Math.abs(spotFeatures[i][k] - tileFeatures[j][k]);
      }
      costMatrix[i][j] = diff;
    }
    if (i % 5 === 0) postMessage({ type: "progress", progress: i / numSpots });
  }

  const assignment = hungarian(costMatrix);
  postMessage({ type: "progress", progress: 1 });
  return assignment;
}

// Simplified Hungarian method (same as before)
function hungarian(costMatrix) {
  const nRows = costMatrix.length;
  const nCols = costMatrix[0].length;
  const n = Math.max(nRows, nCols);
  const C = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i < nRows && j < nCols ? costMatrix[i][j] : 0
    )
  );

  for (let i = 0; i < n; i++) {
    const minVal = Math.min(...C[i]);
    for (let j = 0; j < n; j++) C[i][j] -= minVal;
  }
  for (let j = 0; j < n; j++) {
    let colMin = Infinity;
    for (let i = 0; i < n; i++) colMin = Math.min(colMin, C[i][j]);
    for (let i = 0; i < n; i++) C[i][j] -= colMin;
  }

  const colUsed = new Array(n).fill(false);
  const assignment = new Array(nRows).fill(null);
  for (let i = 0; i < nRows; i++) {
    let bestJ = -1, bestVal = Infinity;
    for (let j = 0; j < nCols; j++) {
      if (!colUsed[j] && C[i][j] < bestVal) {
        bestVal = C[i][j];
        bestJ = j;
      }
    }
    if (bestJ >= 0) { assignment[i] = bestJ; colUsed[bestJ] = true; }
  }
  for (let i = 0; i < nRows; i++) if (assignment[i] === null) assignment[i] = Math.floor(Math.random() * nCols);
  return assignment;
}
