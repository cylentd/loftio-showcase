const LEAVES = [
  { root: [-1.9, -.7], spread: [1.25, .46], tip: [-3.7, -1.2], height: .60 },
  { root: [.4, .5], spread: [.42, 1.35], tip: [1.15, 2.3], height: .81 },
  { root: [1.65, -.3], spread: [.92, -1.05], tip: [3.2, -1.9], height: .68 },
];
const TIP_WIDTH = .22;

export function ringTuftGeometry(width) {
  const positions = [], indices = [];
  for (const { root: [rootX, rootZ], spread: [spreadX, spreadZ], tip: [tipX, tipZ], height } of LEAVES) {
    const base = positions.length / 3;
    positions.push(
      (rootX - spreadX) * width, 0, (rootZ - spreadZ) * width,
      (rootX + spreadX) * width, 0, (rootZ + spreadZ) * width,
      (tipX - spreadX * TIP_WIDTH) * width, height, (tipZ - spreadZ * TIP_WIDTH) * width,
      (tipX + spreadX * TIP_WIDTH) * width, height, (tipZ + spreadZ * TIP_WIDTH) * width,
    );
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  return { positions, indices };
}
