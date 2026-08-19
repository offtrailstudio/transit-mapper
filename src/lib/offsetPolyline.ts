type Coordinate = [number, number];

function normalize(v: Coordinate): Coordinate {
  const length = Math.hypot(v[0], v[1]);
  return length === 0 ? [0, 0] : [v[0] / length, v[1] / length];
}

// Rotating a direction vector 90° gives a normal — consistently applying the
// same rotation to every segment is what makes a positive offset move the
// whole polyline to one consistent side rather than flip-flopping.
function perpendicular(direction: Coordinate): Coordinate {
  return [-direction[1], direction[0]];
}

function movePoint(point: Coordinate, direction: Coordinate, distance: number): Coordinate {
  return [point[0] + direction[0] * distance, point[1] + direction[1] * distance];
}

/**
 * Offsets a polyline sideways by a constant perpendicular distance. Interior
 * bend vertices are miter-joined (averaging the two adjacent segments'
 * normals, then scaling along that average so the perpendicular distance to
 * both original segments stays exactly `offsetPixels`) so the result reads
 * as a true parallel line rather than pinching or ballooning at a bend.
 * Generic over any 2D coordinate space — the caller decides what a "pixel"
 * means in it.
 */
export function offsetPolyline(points: Coordinate[], offsetPixels: number): Coordinate[] {
  if (points.length < 2 || offsetPixels === 0) {
    return points;
  }

  const segmentNormals: Coordinate[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const direction = normalize([
      points[i + 1][0] - points[i][0],
      points[i + 1][1] - points[i][1],
    ]);
    segmentNormals.push(perpendicular(direction));
  }

  return points.map((point, i) => {
    if (i === 0) {
      return movePoint(point, segmentNormals[0], offsetPixels);
    }
    if (i === points.length - 1) {
      return movePoint(point, segmentNormals[segmentNormals.length - 1], offsetPixels);
    }

    const n1 = segmentNormals[i - 1];
    const n2 = segmentNormals[i];
    const miter = normalize([n1[0] + n2[0], n1[1] + n2[1]]);
    const cosHalfAngle = miter[0] * n1[0] + miter[1] * n1[1];
    // Segments doubling back on themselves (~180°) make the miter direction
    // degenerate — fall back to a plain offset rather than dividing by ~0.
    const miterLength = Math.abs(cosHalfAngle) < 0.1 ? offsetPixels : offsetPixels / cosHalfAngle;
    return movePoint(point, miter, miterLength);
  });
}
