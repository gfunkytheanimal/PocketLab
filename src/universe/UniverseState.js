import { FieldMemory } from '../memory/FieldMemory.js';
import { RecursiveScaleController } from '../recursion/RecursiveScaleController.js';
import { StructureAnalyzer } from '../analysis/StructureAnalyzer.js';
import { MegaStructureSystem } from '../structures/MegaStructureSystem.js';
import { AudioReactiveSystem } from '../audio/AudioReactiveSystem.js';
import { ProceduralCosmicAudio } from '../audio/ProceduralCosmicAudio.js';
import { loadUniverseSeed, seedNumber } from './seed.js';
import { HarmonicEngine } from './HarmonicEngine.js';
import { BiomeSystem } from './BiomeSystem.js';
import { TemporalEchoSystem } from './TemporalEchoSystem.js';
import { FieldEntitySystem } from './FieldEntitySystem.js';
import { EventHorizonSystem } from './EventHorizonSystem.js';
import { DiscoveryDirector } from './DiscoveryDirector.js';
import { CosmicEncounterSystem } from '../encounters/CosmicEncounterSystem.js';
import { SongUniverseLayout } from './SongUniverseLayout.js';

export class UniverseState {
  constructor(params) {
    this.params = params;
    this.seed = loadUniverseSeed();
    this.seedValue = seedNumber(this.seed);
    this.memory = new FieldMemory(params);
    this.recursion = new RecursiveScaleController(params);
    this.analysis = new StructureAnalyzer(params);
    this.megastructures = new MegaStructureSystem(params);
    this.audio = new AudioReactiveSystem(params);
    this.cosmicAudio = new ProceduralCosmicAudio(params);
    this.harmonics = new HarmonicEngine(params, this.seedValue);
    this.biomes = new BiomeSystem(params, this.seed);
    this.echoes = new TemporalEchoSystem(params);
    this.entities = new FieldEntitySystem(params);
    this.horizons = new EventHorizonSystem(params, this.seed);
    this.discovery = new DiscoveryDirector(params);
    this.encounters = new CosmicEncounterSystem(params, this.seed);
    this.songLayout = new SongUniverseLayout(params, this.seedValue);
    this.structures = [];
    this.params.universeSeed = this.seed;
  }

  reset(cameraPosition) {
    if (this.params.universeSeed && this.params.universeSeed !== this.seed) {
      this.reseed(this.params.universeSeed);
    }
    this.memory.reset(cameraPosition);
    this.echoes.reset();
    this.entities.reset();
    this.encounters.reset();
    this.songLayout.reset();
  }

  reseed(seed) {
    this.seed = seed;
    this.seedValue = seedNumber(seed);
    this.harmonics = new HarmonicEngine(this.params, this.seedValue);
    this.biomes = new BiomeSystem(this.params, this.seed);
    this.horizons = new EventHorizonSystem(this.params, this.seed);
    this.encounters = new CosmicEncounterSystem(this.params, this.seed);
    this.songLayout = new SongUniverseLayout(this.params, this.seedValue);
    this.params.universeSeed = seed;
  }

  beginFrame(camera, dt, time) {
    this.audio.update();
    this.songLayout.update(dt, time);
    this.harmonics.update(dt, time, this.audio);
    this.recursion.update(camera, dt, this.audio);
    this.memory.beginFrame(camera.position, dt);
    this.params.audioLevel = this.audio.level;
    this.params.audioBass = this.audio.bass;
    this.params.audioMid = this.audio.mid;
    this.params.audioTreble = this.audio.treble;
    this.params.audioEnabled = this.audio.enabled;
    this.biomes.update(camera.position, this.memory, this.recursion, this.harmonics);
    this.horizons.update(camera.position, time, this.harmonics);
    this.encounters.update(camera, time);
    const analysis = this.analysis.update(this.memory, time);
    this.structures = this.megastructures.update(analysis, camera.position, time);
    this.entities.update(dt, time, this.memory, this.biomes.primary, this.harmonics);
    this.echoes.update(dt, time, this.memory, this.structures, this.harmonics);
    this.discovery.update(dt, this);
    this.cosmicAudio.update(this);
  }
}
