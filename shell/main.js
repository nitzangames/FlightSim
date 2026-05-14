import { VERSION } from '../lib/version.js';
import { createTerrain } from '../lib/terrain/index.js';
console.log('[flight-sim] ' + VERSION);

const THREE = window.THREE;
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 9/16, 1, 4500);
camera.position.set(0, 120, 0);
camera.lookAt(50, 80, -50);

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

const terrain = createTerrain({ THREE, scene, renderer, style: 'cartograph', perfMode: 'high' });

document.getElementById('boot').classList.add('hidden');
setTimeout(() => document.getElementById('boot').remove(), 600);

(function frame() {
  terrain.update(camera.position);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
})();
