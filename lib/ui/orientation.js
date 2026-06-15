// Pure orientation decision shared by the shell. Driven by the actual drawable
// box shape (canvas client size), NOT PlaySDK.getOrientation(): on narrow
// phones the platform keeps the iframe a portrait strip even when the device is
// landscape, so the box shape is what the UI must match. `landscape` only when
// the box is genuinely wider than tall.
export function pickOrientation(w, h) {
  return w > h ? 'landscape' : 'portrait';
}
