// Renders remote players as their planes broadcast their state. Pure
// presence — no collision, no scoring, no input. The goal is just "I can
// see other people flying around".
//
// Wire protocol (sent at BROADCAST_HZ via room.send):
//   { plane: 'biplane', x, y, z, qx, qy, qz, qw }
//
// Each packet promotes the previous target to "prev" and stores the new
// one as "target"; per-frame we lerp/slerp from prev → target over
// INTERP_MS so the remote plane glides between packets rather than
// teleporting at the receive rate.
//
// Peers that go quiet for STALE_MS (network drop, tab closed without
// clean leave) are evicted client-side so we don't keep rendering ghosts.

import { PLANES } from '../game/planes.js';

const BROADCAST_HZ = 10;
const INTERP_MS    = 200;
const STALE_MS     = 5000;
// Must match shell/main.js's WORLD_PLANE_SCALE so remote planes are sized
// the same as the local plane in the shared world.
const SCALE        = 0.875;

export class RemotePlayers {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.peers = new Map();   // userId → peer state
    this._sendAccum = 0;
  }

  // Called for every 'game' event from the multiplayer SDK.
  onPeerState(userId, data) {
    if (!userId || !data || typeof data.x !== 'number') return;
    let peer = this.peers.get(userId);
    if (!peer) {
      peer = this._createPeer(userId, data.plane || 'biplane');
      this.peers.set(userId, peer);
      // First packet — snap to position with no interp window (otherwise
      // the peer would glide from origin to its spawn over 200ms).
      peer.prev.set(data.x, data.y, data.z);
      peer.target.set(data.x, data.y, data.z);
      peer.prevQuat.set(data.qx, data.qy, data.qz, data.qw);
      peer.targetQuat.set(data.qx, data.qy, data.qz, data.qw);
      const now = performance.now();
      peer.lastUpdateMs  = now;
      peer.interpStartMs = now;
      return;
    }
    if (peer.planeKey !== data.plane && PLANES[data.plane]) {
      // Player swapped planes between updates — rebuild the mesh.
      this._disposeMesh(peer);
      peer.planeKey = data.plane;
      peer.mesh = this._buildMesh(peer.planeKey);
      this.scene.add(peer.mesh);
    }
    peer.prev.copy(peer.target);
    peer.prevQuat.copy(peer.targetQuat);
    peer.target.set(data.x, data.y, data.z);
    peer.targetQuat.set(data.qx, data.qy, data.qz, data.qw);
    const now = performance.now();
    peer.lastUpdateMs  = now;
    peer.interpStartMs = now;
  }

  // Called for every 'playerLeft' event from the multiplayer SDK.
  onPeerLeft(userId) {
    const peer = this.peers.get(userId);
    if (!peer) return;
    this._disposeMesh(peer);
    this.peers.delete(userId);
  }

  // Per-frame: interpolate every peer toward its target and prune anyone
  // who hasn't sent in STALE_MS.
  update() {
    const now = performance.now();
    for (const [userId, peer] of this.peers) {
      if (now - peer.lastUpdateMs > STALE_MS) {
        this._disposeMesh(peer);
        this.peers.delete(userId);
        continue;
      }
      const t = Math.min(1, (now - peer.interpStartMs) / INTERP_MS);
      peer.mesh.position.lerpVectors(peer.prev, peer.target, t);
      peer.mesh.quaternion.copy(peer.prevQuat).slerp(peer.targetQuat, t);
    }
  }

  // Returns true at ~BROADCAST_HZ — accumulate dt and emit a tick when
  // enough has elapsed. Decouples the network rate from the frame rate.
  shouldBroadcast(dt) {
    this._sendAccum += dt;
    const period = 1 / BROADCAST_HZ;
    if (this._sendAccum >= period) {
      // Subtract instead of zero so we don't accumulate drift on slow frames.
      this._sendAccum -= period;
      return true;
    }
    return false;
  }

  count() { return this.peers.size; }

  _buildMesh(planeKey) {
    const plane = PLANES[planeKey] || PLANES.biplane;
    const mesh  = plane.build(this.THREE);
    mesh.scale.setScalar(SCALE);
    return mesh;
  }

  _createPeer(userId, planeKey) {
    const T = this.THREE;
    const mesh = this._buildMesh(planeKey);
    this.scene.add(mesh);
    return {
      userId, planeKey, mesh,
      prev:       new T.Vector3(),
      target:     new T.Vector3(),
      prevQuat:   new T.Quaternion(),
      targetQuat: new T.Quaternion(),
      lastUpdateMs:  0,
      interpStartMs: 0,
    };
  }

  _disposeMesh(peer) {
    this.scene.remove(peer.mesh);
    peer.mesh.traverse((n) => {
      if (n.isMesh) {
        n.geometry && n.geometry.dispose();
        if (n.material) {
          if (Array.isArray(n.material)) n.material.forEach(m => m.dispose());
          else n.material.dispose();
        }
      }
    });
  }

  dispose() {
    for (const peer of this.peers.values()) this._disposeMesh(peer);
    this.peers.clear();
  }
}
