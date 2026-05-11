export class StructureAnalyzer {
  constructor(params) {
    this.params = params;
    this.structures = [];
    this.frame = 0;
  }

  update(memory, time) {
    this.frame++;
    if (this.frame % 3 !== 0) return this.structures;
    const hot = memory.collectHotCells(64);
    const structures = [];
    for (const cell of hot) {
      const speed = Math.hypot(cell.flow[0], cell.flow[1], cell.flow[2]);
      const score = cell.energy * 0.65 + cell.coherence * 0.35 + speed * 0.2;
      if (score < 0.11) continue;
      const type = speed > 0.18 ? 'filament' : cell.coherence > 0.25 ? 'shell' : 'nebula';
      structures.push({
        ...cell,
        type,
        radius: 5 + score * 28,
        phase: Math.sin(time * 0.31 + cell.x * 0.07 + cell.z * 0.03),
        score
      });
    }
    this.structures = structures.slice(0, 18);
    return this.structures;
  }
}
