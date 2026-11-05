export function nextCaption(captions: readonly string[], previous: string | null, random: number): string {
  const choices = captions.filter(caption => caption !== previous);
  const pool = choices.length ? choices : captions;
  if (!pool.length) throw new Error("Postcard greetings are required");
  return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random * pool.length)))]!;
}
