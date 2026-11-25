const KEY = "bokuao-blog-show-jp";

export function readShowJp(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function writeShowJp(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}
