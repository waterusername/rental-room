const SUFFIX: Record<string, string> = {
  st: "street",
  street: "street",
  ave: "avenue",
  avenue: "avenue",
  av: "avenue",
  pl: "place",
  place: "place",
  ct: "court",
  court: "court",
  blvd: "boulevard",
  boulevard: "boulevard",
  rd: "road",
  road: "road",
  ln: "lane",
  lane: "lane",
  dr: "drive",
  drive: "drive",
  pkwy: "parkway",
  parkway: "parkway",
};

export function addressKey(value: string): string {
  const parts = value
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
  const last = parts[parts.length - 1];
  if (last && SUFFIX[last]) parts[parts.length - 1] = SUFFIX[last];
  return parts.join(" ");
}

export function unitKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/^unit\s+/, "")
    .replace(/[^a-z0-9]+/g, "");
}
