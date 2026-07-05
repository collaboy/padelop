export function startNavLoad() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("padelop:nav-start"));
  }
}

export function startPlusOne() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("padelop:plus-one"));
  }
}
