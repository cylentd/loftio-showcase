export type RoomLayout = "desktop" | "portrait";

const registrations: Array<(layout: RoomLayout) => void> = [];
export let activeRoom: RoomLayout = "desktop";

function replaceData(target: object, source: object): void {
  for (const [key, value] of Object.entries(source)) {
    const current = Reflect.get(target, key);
    if (value !== null && typeof value === "object" && current !== null && typeof current === "object") replaceData(current, value);
    else Reflect.set(target, key, structuredClone(value));
  }
  if (Array.isArray(target) && Array.isArray(source)) target.length = source.length;
}

export function roomData<Value extends object>(desktop: Value, portrait: Partial<Value>): Value {
  const variants = { desktop: structuredClone(desktop), portrait: structuredClone({ ...desktop, ...portrait }) };
  if (Array.isArray(desktop)) variants.portrait = structuredClone(portrait) as Value;
  const apply = (layout: RoomLayout) => replaceData(desktop, variants[layout]);
  registrations.push(apply);
  apply(activeRoom);
  return desktop;
}

export function setRoomLayout(layout: RoomLayout): void {
  activeRoom = layout;
  for (const apply of registrations) apply(layout);
}

export const roomLayoutFor = (width: number, height: number): RoomLayout => height > width ? "portrait" : "desktop";

export function roomFrame(width: number, height: number, world: { width: number; height: number }, overscan: number) {
  const heightScale = height / world.height;
  const scale = Math.max(width / world.width, heightScale) * overscan;
  return { scale, offsetY: scale === heightScale ? 0 : (height - world.height * scale) / 2, width: world.width * scale };
}
