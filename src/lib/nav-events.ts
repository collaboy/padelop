export function startNavLoad() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("padelop:nav-start"));
  }
}

export function startPlusOne() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("padelop:plus-one", { detail: { delay: 2500 } }));
  }
}

export function startPlusOneFast() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("padelop:plus-one", { detail: { delay: 300 } }));
  }
}
