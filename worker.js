onmessage = e => {
  const { type, tileColors, spotColors } = e.data;
  if (type === "compute") {
    const assignment = computeOptimal(tileColors, spotColors);
    postMessage({ type: "done", assignment });
  }
};

function computeOptimal(tileColors, spotColors) {
  const numSpots = spotColors.length;
  const numTiles = tileColors.length;

  const costMatrix = Array.from({ length: numSpots }, () => new Array(numTiles).fill(0));

  for (let i = 0; i < numSpots; i++) {
    for (let j = 0; j < numTiles; j++) {
      const diff =
        (spotColors[i][0] - tileColors[j][0]) ** 2 +
        (spotColors[i][1] - tileColors[j][1]) ** 2 +
        (spotColors[i][2] - tileColors[j][2]) ** 2;
      costMatrix[i][j] = diff;
    }
    if (i % 5 === 0) postMessage({ type: "progress", progress: i / numSpots });
  }

  const assignment = hungarian(costMatrix);
  postMessage({ type: "progress", progress: 1.0 });
  return assignment;
}

// -----------------------------------------------------------
// Simple Hungarian / Munkres Implementation
// -----------------------------------------------------------
function hungarian(costMatrix) {
  const nRows = costMatrix.length;
  const nCols = costMatrix[0].length;
  const n = Math.max(nRows, nCols);
  const C = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i < nRows && j < nCols ? costMatrix[i][j] : 0
    )
  );

  // Step 1: Row minima
  for (let i = 0; i < n; i++) {
    const minVal = Math.min(...C[i]);
    for (let j = 0; j < n; j++) C[i][j] -= minVal;
  }

  // Step 2: Column minima
  for (let j = 0; j < n; j++) {
    let colMin = Infinity;
    for (let i = 0; i < n; i++) colMin = Math.min(colMin, C[i][j]);
    for (let i = 0; i < n; i++) C[i][j] -= colMin;
  }

  // Simple greedy zero assignment (fast enough for our use)
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
    if (bestJ >= 0) {
      assignment[i] = bestJ;
      colUsed[bestJ] = true;
    }
  }

  // Fill empty spots randomly if fewer tiles than grid cells
  for (let i = 0; i < nRows; i++)
    if (assignment[i] === null) assignment[i] = Math.floor(Math.random() * nCols);

  return assignment;
}
