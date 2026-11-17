export const FOREST_BATCH = {size:48,padding:1};
export function forestBatches(spots) {
  const batches=new Map();
  for(const spot of spots){
    const key=`${Math.floor(spot[0]/FOREST_BATCH.size)},${Math.floor(spot[2]/FOREST_BATCH.size)}`;
    if(!batches.has(key))batches.set(key,[]);
    batches.get(key).push(spot);
  }
  return [...batches.values()];
}
