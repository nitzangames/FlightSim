import { VERSION } from '../lib/version.js';
import { buildMenu } from '../lib/ui/menu.js';
console.log('[flight-sim] ' + VERSION);

const THREE = window.THREE;
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const menuScene = new THREE.Scene();
menuScene.background = new THREE.Color(0x0a0e14);
menuScene.add(new THREE.HemisphereLight(0xcfd8e0, 0x202428, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(8, 12, 8); menuScene.add(sun);

const menuCam = new THREE.PerspectiveCamera(30, 9/16, 0.1, 100);
menuCam.position.set(13, 5, 13); menuCam.lookAt(0, 0.3, 0);

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  menuCam.aspect = w / h;
  menuCam.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

const uiRoot = document.getElementById('ui-root');
const menu = buildMenu({
  THREE, root: uiRoot, menuScene, version: VERSION,
  currentPlane: 'biplane', currentStyle: 'cartograph',
  onPlaneChange: (k) => console.log('plane →', k),
  onStyleChange: (s) => console.log('style →', s),
  onPlay: (k) => console.log('FLY:', k),
});

document.getElementById('boot').classList.add('hidden');
setTimeout(() => document.getElementById('boot').remove(), 600);

let last = performance.now();
(function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  menu.update(dt);
  renderer.render(menuScene, menuCam);
  requestAnimationFrame(frame);
})();
