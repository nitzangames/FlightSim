// Derive wingtip contrail emit points from a plane's ACTUAL geometry, so they
// can never drift from the wings the way a hand-maintained table does (the
// SR-71 and F-22 entries had silently gone stale after wing rebuilds).
//
// Returns the mid-chord / mid-thickness tip of each wing side, in PLANE-LOCAL
// (pre-scale) coords — the same space the shell samples with `tip * scale`.
//
// How it isolates wings from the rest of the model:
//   • Only the widest vertices count (within SPAN_FRAC of the overall max |x|),
//     which excludes the fuselage, fins, nacelles and the (narrower) stabilators.
//   • Per side (±x) those are split into wings by GAPS in height: a real
//     vertical gap (> GAP_M, e.g. between a biplane's decks) starts a new wing,
//     but a single thick/dihedral wing stays one cluster. So a single-wing jet
//     yields one pair, a biplane two pairs, a triplane three.
//   • Within each wing the tip is the average of the vertices nearest that
//     wing's own outboard edge (mid-chord, mid-thickness).
const SPAN_FRAC = 0.8;    // wing candidates: |x| within 80% of the widest point
const GAP_M     = 0.6;    // vertical gap that separates stacked wings (m)
const TIP_M     = 0.3;    // how close to a wing's outboard edge counts as "tip"

export function computeContrailTips(THREE, mesh) {
  mesh.updateWorldMatrix(true, true);
  // Collect every vertex in plane-local (pre-scale) coords.
  const xs = [], ys = [], zs = [];
  const v = new THREE.Vector3();
  mesh.traverse((n) => {
    const pos = n.isMesh && n.geometry && n.geometry.attributes && n.geometry.attributes.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      n.localToWorld(v);     // → world
      mesh.worldToLocal(v);  // → plane-local (undoes the world-plane scale/pos)
      xs.push(v.x); ys.push(v.y); zs.push(v.z);
    }
  });
  const N = xs.length;
  if (!N) return [];

  let maxAbsX = 0;
  for (let i = 0; i < N; i++) maxAbsX = Math.max(maxAbsX, Math.abs(xs[i]));
  if (maxAbsX < 1) return [];   // nothing wing-like

  // Collect the outer-span vertex indices per side.
  const spanMin = SPAN_FRAC * maxAbsX;
  const sides = { L: [], R: [] };
  for (let i = 0; i < N; i++) {
    if (Math.abs(xs[i]) < spanMin) continue;
    sides[xs[i] < 0 ? 'L' : 'R'].push(i);
  }

  // Per side: sort by height, split into wings at vertical gaps, emit one tip
  // (mid-chord/thickness near the outboard edge) per wing.
  const tips = [];
  for (const key of ['L', 'R']) {
    const idx = sides[key];
    if (!idx.length) continue;
    idx.sort((a, b) => ys[a] - ys[b]);
    let start = 0;
    for (let k = 1; k <= idx.length; k++) {
      if (k === idx.length || ys[idx[k]] - ys[idx[k - 1]] > GAP_M) {
        const cluster = idx.slice(start, k);   // one wing
        let maxAbs = 0;
        for (const i of cluster) maxAbs = Math.max(maxAbs, Math.abs(xs[i]));
        let sx = 0, sy = 0, sz = 0, c = 0;
        for (const i of cluster) {
          if (Math.abs(xs[i]) > maxAbs - TIP_M) { sx += xs[i]; sy += ys[i]; sz += zs[i]; c++; }
        }
        if (c) tips.push({ x: sx / c, y: sy / c, z: sz / c });
        start = k;
      }
    }
  }
  return tips;
}
