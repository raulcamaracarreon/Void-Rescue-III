import { CONTROL_LABELS, PAD_CONTROL_LABELS } from '../input/bindings';
import { signedWrappedDeltaX } from '../core/WorldWrap';
import { CONFIG, SAFE_BASE } from '../game/config';
import type { GameEvent } from '../game/combat/types';
import type { FlightState } from '../game/Simulation';
import type { RenderMetrics } from '../render/Renderer';
import { Radar } from './Radar';
import { DIFFICULTIES } from '../game/Difficulty';
import type { Difficulty } from '../game/Difficulty';
import { INITIALS } from '../game/Records';
import { MISSION_MODES } from '../game/MissionMode';
import type { MissionMode } from '../game/MissionMode';
import { SPAWN_MODES } from '../game/SpawnMode';
import type { SpawnMode } from '../game/SpawnMode';
import { RESCUE_PROTOCOLS } from '../game/RescueProtocol';
import type { RescueProtocol } from '../game/RescueProtocol';
import { defenseGoal } from '../game/combat/DynamicDirector';
import { adaptivePalette } from '../landscape/AdaptivePalette';
import type { LandscapeStyle } from '../landscape/LandscapeConfig';
import { ENGINE_PITCH_MIN, ENGINE_PITCH_MAX } from '../audio/AudioEngine';
import { VEHICLE_PROFILES } from '../game/VehicleProfile';
import type { VehicleId } from '../game/VehicleProfile';

export type AppMode = 'title' | 'playing' | 'paused' | 'result';
export interface Preferences { muted: boolean; volume: number; reducedMotion: boolean; difficulty: Difficulty; missionMode: MissionMode; spawnMode: SpawnMode; rescueProtocol: RescueProtocol; enginePitchHz: number }
export interface UiActions {
  start(): void; resume(): void; restart(): void; menu(): void; pause(): void;
  mute(): void; fullscreen(): void; controller(): void; landscape(): void; preferences(value: Preferences): void;
  result(): void; records(): void; pilot(value: string): void; vehicle(value: VehicleId): void;
}

export class Interface {
  private readonly title: HTMLElement;
  private readonly hud: HTMLElement;
  private readonly pause: HTMLDialogElement;
  private readonly result: HTMLDialogElement;
  private readonly radar: Radar;
  private readonly diagnostics: HTMLElement;
  private readonly speed: HTMLElement;
  private readonly altitude: HTMLElement;
  private readonly coordinate: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly distance: HTMLElement;
  private readonly throttle: HTMLElement;
  private readonly device: HTMLElement;
  private readonly muteButton: HTMLButtonElement;
  private readonly backend: HTMLElement;
  private readonly reduced: HTMLInputElement;
  private readonly volume: HTMLInputElement;
  private readonly muteCheck: HTMLInputElement;
  private debugVisible = false;
  private lastMode: AppMode = 'title';

  constructor(private readonly root: HTMLElement, private readonly actions: UiActions, preferences: Preferences, pilot: string, selectedVehicle: VehicleId = 'ship') {
    root.innerHTML = `
      <section class="title-screen" aria-labelledby="game-title">
        <div class="topline"><span class="brandmark">V<span>R</span></span><span>COLONIAL RESPONSE DIVISION</span><span class="build-tag">VOID RESCUE III · PROTOTIPO</span></div>
        <div class="title-copy">
          <p class="eyebrow"><i></i> SECTOR 07 / PERÍMETRO EXTERIOR</p>
          <h1 id="game-title">VOID<br><span>RESCUE</span><b>↗</b></h1>
          <p class="tagline">La colonia está lejos.<br>Tu nave es su primera respuesta.</p>
          <p class="title-description">Rescata colonos y sobrevive a oleadas cada vez más difíciles.<br>Sin última oleada. ¿Hasta dónde llegará tu récord?</p>
          <div class="mission-settings"><label>ENEMIGOS <select aria-label="Sistema de enemigos" class="spawn-mode-select"></select></label><label>MISIÓN <select aria-label="Modo de juego" class="mission-mode-select"></select></label><label>DIFICULTAD <select aria-label="Dificultad" class="difficulty-select"></select></label><label>RESCATE <select aria-label="Protocolo de rescate" class="rescue-protocol-select"></select></label></div>
          <p class="protocol-help" aria-live="polite"></p>
          <div class="vehicle-setting"><label>VEHÍCULO <select aria-label="Vehículo" class="vehicle-select"></select></label><span class="vehicle-help" aria-live="polite"></span></div>
          <label class="title-engine-pitch engine-pitch-control">TONO MÁXIMO DEL MOTOR <input type="range" class="engine-pitch-slider" min="${ENGINE_PITCH_MIN}" max="${ENGINE_PITCH_MAX}" step="1" aria-label="Tono máximo del motor"><output class="engine-pitch-value">300 Hz</output></label>
          <div class="pilot-setting"><span>PILOTO</span>${[0, 1, 2].map(i => `<select class="pilot-initial" aria-label="Inicial ${i + 1}">${[...INITIALS].map(letter => `<option${pilot[i] === letter ? ' selected' : ''}>${letter}</option>`).join('')}</select>`).join('')}<button class="text-button" data-action="records">VER RÉCORDS ↗</button></div>
          <button class="primary" data-action="start">INICIAR VUELO <span>↗</span></button>
          <button class="text-button landscape-open" data-action="landscape">PERSONALIZAR PAISAJE ↗</button>
          <button class="controller-open text-button" data-action="controller">CONFIGURAR MANDO USB ↗</button><p class="controller-status"></p>
          <div class="title-controls"><span><kbd>W A S D</kbd> Pilotar</span><span><kbd>ESPACIO</kbd> Disparar</span><span><kbd>SHIFT</kbd> Bomba</span></div>
          <p class="gamepad-note">Joypad: sur A/× disparar y confirmar · oeste X/□ bomba · norte Y/△ acción/portal<br>Stick/cruceta navegar · este B/○ volver · Start pausa</p>
        </div>
        <div class="ship-caption"><span class="caption-line"></span><p>VR—01 <b>RESPONDER</b></p><small>NAVE DE RESPUESTA RÁPIDA</small></div>
        <div class="title-footer"><span><i></i> SISTEMAS DE VUELO LISTOS</span><span>SIMULACIÓN LOCAL / SIN CONEXIÓN EXTERNA</span><button data-action="fullscreen" class="text-button">PANTALLA COMPLETA ↗</button></div>
      </section>
      <section class="flight-hud" aria-label="Instrumentos de vuelo" hidden>
        <header class="instrument-panel">
          <div class="hud-identity"><span class="brandmark">V<span>R</span></span><p>VOID RESCUE III<small>VR—01 / RESPONDER</small></p></div>
          <div class="radar-panel"><div class="radar-label"><span>RADAR / PERÍMETRO COMPLETO</span><span>◇ ESTACIÓN <b>▸ NAVE</b></span></div><canvas id="radar" aria-label="Radar panorámico del mundo circular"></canvas><div class="radar-scale"><span>0000</span><span>0600</span><span>1200</span><span>1800</span><span>2400</span></div></div>
          <div class="hud-actions"><button data-action="mute" aria-label="Silenciar audio" title="Silenciar (M)">AUDIO ON</button><button data-action="pause" aria-label="Pausar vuelo" title="Pausa (Esc)">II <span>PAUSA</span></button></div>
        </header>
        <div class="mission"><span class="mission-index">01</span><div><p>RECONOCIMIENTO ORBITAL</p><span>Prueba de vuelo · explora el perímetro circular</span></div><span class="mission-status">VUELO LIBRE</span></div>
        <div class="coordinates"><span>SECTOR <b id="coordinate">0360</b></span><span>TIEMPO <b id="timer">00:00</b></span></div>
        <div class="combat-stats" id="combat-stats"></div>
        <div class="combat-message" id="combat-message" role="status" aria-live="polite"></div>
        <div class="world-labels" id="world-labels"></div>
        <div class="flight-data"><div><span>VELOCIDAD</span><strong id="speed">000</strong><small>u/s</small><div class="throttle"><i id="throttle"></i></div></div><div><span>ALTITUD</span><strong id="altitude">054</strong><small>u</small></div><div class="distance-block"><span>DISTANCIA RECORRIDA</span><b id="distance">0000 u</b><small>◇ 3 estaciones de referencia</small></div></div>
        <footer class="flight-footer"><div>${CONTROL_LABELS.map(([key, label]) => `<span><kbd>${key}</kbd> ${label}</span>`).join('')}</div><span id="device">TECLADO</span></footer>
      </section>
      <dialog class="pause-dialog" aria-labelledby="pause-title">
        <p class="eyebrow">VR—01 / SISTEMAS EN ESPERA</p><h2 id="pause-title">Vuelo en pausa<span>.</span></h2>
        <p class="pause-note">El perímetro puede esperar.</p>
        <label class="setting">Volumen <input id="volume" type="range" min="0" max="100" step="5" aria-label="Volumen"></label>
        <label class="setting pause-engine-pitch engine-pitch-control">Tono máximo del motor <input type="range" class="engine-pitch-slider" min="${ENGINE_PITCH_MIN}" max="${ENGINE_PITCH_MAX}" step="1" aria-label="Tono máximo del motor"><output class="engine-pitch-value">300 Hz</output></label>
        <label class="setting">Silenciar audio <input id="muted" type="checkbox"></label>
        <label class="setting">Reducir movimiento y destellos <input id="reduced" type="checkbox"></label>
        <button class="text-button landscape-open" data-action="landscape">PERSONALIZAR PAISAJE ↗</button>
        <label class="setting">Dificultad <select aria-label="Dificultad" class="difficulty-select"></select></label>
        <p class="pause-note active-protocol"></p>
        <button class="controller-open text-button" data-action="controller">CONFIGURAR MANDO USB ↗</button><p class="controller-status"></p>
        <button class="primary" data-action="resume">CONTINUAR VUELO <span>↗</span></button>
        <div class="pause-secondary"><button data-action="restart">Reiniciar vuelo</button><button data-action="menu">Volver al menú</button></div>
        <div class="pause-secondary"><button class="text-button" data-action="records">VER RÉCORDS</button><button class="text-button pause-fullscreen" data-action="fullscreen">PANTALLA COMPLETA ↗</button></div>
      </dialog>
      <dialog class="pause-dialog result-dialog" aria-labelledby="result-title">
        <p class="eyebrow" id="result-wave">OPERACIÓN / INFORME DE OLEADA</p><h2 id="result-title">Oleada completada</h2>
        <p id="result-note" class="pause-note"></p><div id="result-stats"></div>
        <p id="record-status" class="record-status"></p>
        <button class="primary" data-action="result">SIGUIENTE OLEADA <span>↗</span></button>
        <div class="pause-secondary"><button class="text-button" data-action="records">VER RÉCORDS</button><button class="text-button result-menu" data-action="menu">VOLVER AL MENÚ</button></div>
        <p class="pad-help">Stick / cruceta: elegir · sur A/×: confirmar · este B/○: volver</p>
      </dialog>
      <aside class="diagnostics" hidden aria-label="Diagnóstico"><strong>TELEMETRÍA / F3</strong><pre id="metrics"></pre></aside>
      <span class="backend-tag" id="backend"></span>`;

    const get = <T extends Element>(selector: string) => {
      const element = root.querySelector<T>(selector);
      if (!element) throw new Error(`Falta interfaz ${selector}`);
      return element;
    };
    this.title = get('.title-screen'); this.hud = get('.flight-hud'); this.pause = get('.pause-dialog');
    this.result = get('.result-dialog');
    this.radar = new Radar(get('#radar')); this.diagnostics = get('.diagnostics');
    this.speed = get('#speed'); this.altitude = get('#altitude'); this.coordinate = get('#coordinate');
    this.timer = get('#timer'); this.distance = get('#distance'); this.throttle = get('#throttle');
    this.device = get('#device'); this.muteButton = get('[data-action="mute"]'); this.backend = get('#backend');
    this.volume = get('#volume'); this.reduced = get('#reduced'); this.muteCheck = get('#muted');
    this.volume.value = String(preferences.volume * 100); this.reduced.checked = preferences.reducedMotion; this.muteCheck.checked = preferences.muted;
    this.syncMuted(preferences.muted);
    const pitchSliders = [...root.querySelectorAll<HTMLInputElement>('.engine-pitch-slider')];
    const pitchOutputs = [...root.querySelectorAll<HTMLOutputElement>('.engine-pitch-value')];
    const showPitch = (pitchHz: number) => {
      pitchSliders.forEach(slider => { slider.value = String(pitchHz); });
      pitchOutputs.forEach(output => { output.value = `${pitchHz} Hz`; });
    };
    showPitch(preferences.enginePitchHz);
    const vehicleSelect = get<HTMLSelectElement>('.vehicle-select');
    vehicleSelect.innerHTML = Object.entries(VEHICLE_PROFILES).map(([id, profile]) =>
      `<option value="${id}">${profile.name}</option>`).join('');
    vehicleSelect.value = selectedVehicle;
    const vehicleHelp = get<HTMLElement>('.vehicle-help');
    const updateVehicleHelp = () => {
      vehicleHelp.textContent = vehicleSelect.value === 'helicopter'
        ? 'Helicóptero: 2 pasajeros · descenso próximo al terreno · mantén E/Y para recoger a baja velocidad'
        : 'Nave clásica: extracción habitual · capacidad sin límite · mismo control de vuelo';
    };
    updateVehicleHelp();
    vehicleSelect.addEventListener('change', () => {
      updateVehicleHelp();
      actions.vehicle(vehicleSelect.value as VehicleId);
    });
    const spawnSelect = get<HTMLSelectElement>('.spawn-mode-select');
    spawnSelect.innerHTML = Object.entries(SPAWN_MODES).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('');
    spawnSelect.value = preferences.spawnMode;
    const missionSelect = get<HTMLSelectElement>('.mission-mode-select');
    missionSelect.innerHTML = Object.entries(MISSION_MODES).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('');
    missionSelect.value = preferences.missionMode;
    const rescueSelect = get<HTMLSelectElement>('.rescue-protocol-select');
    rescueSelect.innerHTML = Object.entries(RESCUE_PROTOCOLS).map(([id, item]) => `<option value="${id}">${item.label}</option>`).join('');
    rescueSelect.value = preferences.rescueProtocol;
    const showProtocolHelp = () => {
      this.root.querySelector('.protocol-help')!.textContent = RESCUE_PROTOCOLS[rescueSelect.value as RescueProtocol].description;
    };
    showProtocolHelp();
    rescueSelect.addEventListener('change', () => {
      showProtocolHelp();
      actions.preferences({ volume: Number(this.volume.value) / 100, reducedMotion: this.reduced.checked,
        muted: this.muteCheck.checked, difficulty: difficultySelects[0]!.value as Difficulty,
        missionMode: missionSelect.value as MissionMode, spawnMode: spawnSelect.value as SpawnMode,
        rescueProtocol: rescueSelect.value as RescueProtocol, enginePitchHz: Number(pitchSliders[0]!.value) });
    });
    const difficultySelects = [...root.querySelectorAll<HTMLSelectElement>('.difficulty-select')];
    for (const select of difficultySelects) {
      select.innerHTML = Object.entries(DIFFICULTIES).map(([id, item]) => `<option value="${id}">${item.label} · ${item.speed}× · ${item.startingLives} naves · ${item.enemyHitsToKill} impactos</option>`).join('');
      select.value = preferences.difficulty;
      select.addEventListener('change', () => {
        difficultySelects.forEach(other => { other.value = select.value; });
        actions.preferences({ volume: Number(this.volume.value) / 100, reducedMotion: this.reduced.checked, muted: this.muteCheck.checked, difficulty: select.value as Difficulty, missionMode: missionSelect.value as MissionMode, spawnMode: spawnSelect.value as SpawnMode, rescueProtocol: rescueSelect.value as RescueProtocol, enginePitchHz: Number(pitchSliders[0]!.value) });
      });
    }
    missionSelect.addEventListener('change', () => actions.preferences({ volume: Number(this.volume.value) / 100,
      reducedMotion: this.reduced.checked, muted: this.muteCheck.checked, difficulty: difficultySelects[0]!.value as Difficulty,
      missionMode: missionSelect.value as MissionMode, spawnMode: spawnSelect.value as SpawnMode, rescueProtocol: rescueSelect.value as RescueProtocol, enginePitchHz: Number(pitchSliders[0]!.value) }));
    spawnSelect.addEventListener('change', () => actions.preferences({ volume: Number(this.volume.value) / 100,
      reducedMotion: this.reduced.checked, muted: this.muteCheck.checked,
      difficulty: difficultySelects[0]!.value as Difficulty,
      missionMode: missionSelect.value as MissionMode, spawnMode: spawnSelect.value as SpawnMode, rescueProtocol: rescueSelect.value as RescueProtocol, enginePitchHz: Number(pitchSliders[0]!.value) }));

    pitchSliders.forEach(slider => slider.addEventListener('input', () => {
      const pitchHz = Number(slider.value);
      showPitch(pitchHz);
      actions.preferences({
        volume: Number(this.volume.value) / 100, reducedMotion: this.reduced.checked,
        muted: this.muteCheck.checked, difficulty: difficultySelects[0]!.value as Difficulty,
        missionMode: missionSelect.value as MissionMode, spawnMode: spawnSelect.value as SpawnMode,
        rescueProtocol: rescueSelect.value as RescueProtocol, enginePitchHz: pitchHz,
      });
    }));

    root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.action as Exclude<keyof UiActions, 'preferences' | 'pilot' | 'vehicle'>;
        actions[action]();
      });
    });
    root.querySelectorAll<HTMLSelectElement>('.pilot-initial').forEach(select => select.addEventListener('change', () => {
      actions.pilot([...root.querySelectorAll<HTMLSelectElement>('.pilot-initial')].map(item => item.value).join(''));
    }));
    this.pause.addEventListener('cancel', event => { event.preventDefault(); actions.resume(); });
    this.result.addEventListener('cancel', event => { event.preventDefault(); actions.menu(); });
    for (const input of [this.volume, this.reduced, this.muteCheck]) input.addEventListener('input', () => {
      actions.preferences({ volume: Number(this.volume.value) / 100, reducedMotion: this.reduced.checked, muted: this.muteCheck.checked,
        difficulty: difficultySelects[0]!.value as Difficulty, missionMode: missionSelect.value as MissionMode,
        spawnMode: spawnSelect.value as SpawnMode, rescueProtocol: rescueSelect.value as RescueProtocol, enginePitchHz: Number(pitchSliders[0]!.value) });
    });
  }

  mode(mode: AppMode): void {
    this.title.hidden = mode !== 'title'; this.hud.hidden = mode === 'title';
    if (mode === 'paused' && !this.pause.open) this.pause.showModal();
    if (mode !== 'paused' && this.pause.open) this.pause.close();
    if (mode === 'result' && !this.result.open) this.result.showModal();
    if (mode !== 'result' && this.result.open) this.result.close();
    if (mode === 'title' && this.lastMode !== 'title') this.root.querySelector<HTMLButtonElement>('[data-action="start"]')?.focus();
    this.lastMode = mode;
  }

  syncMuted(muted: boolean): void {
    this.muteCheck.checked = muted;
    this.muteButton.textContent = muted ? 'AUDIO OFF' : 'AUDIO ON';
    this.muteButton.setAttribute('aria-label', muted ? 'Activar audio' : 'Silenciar audio');
    this.muteButton.setAttribute('aria-pressed', String(muted));
  }

  setLandscapeTheme(style: LandscapeStyle): void {
    const theme = adaptivePalette(style);
    this.hud.style.setProperty('--vr-hud-ink', theme.hudInk);

  }

  toggleDiagnostics(): void { this.debugVisible = !this.debugVisible; this.diagnostics.hidden = !this.debugVisible; }

  recordStatus(text: string): void { this.root.querySelector('#record-status')!.textContent = text; }

  navigatePad(command: { x: number; y: number; confirm: boolean; back: boolean }): void {
    if (command.back) { if (this.lastMode === 'paused') this.actions.resume(); else if (this.lastMode === 'result') this.actions.menu(); return; }
    const scope = this.pause.open ? this.pause : this.result.open ? this.result : this.title;
    const controls = [...scope.querySelectorAll<HTMLElement>('button, input, select')].filter(e => e.getBoundingClientRect().width > 0);
    if (!controls.length) return;
    let index = controls.indexOf(document.activeElement as HTMLElement);
    if (index < 0) index = this.lastMode === 'title' ? Math.max(0, controls.findIndex(e => e.dataset.action === 'start')) : 0;
    let selected = controls[index]!;
    if (command.x && selected instanceof HTMLSelectElement) {
      selected.selectedIndex = Math.max(0, Math.min(selected.options.length - 1, selected.selectedIndex + command.x));
      selected.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (command.x && selected instanceof HTMLInputElement && selected.type === 'range') {
      selected.value = String(Math.max(Number(selected.min), Math.min(Number(selected.max), Number(selected.value) + command.x * Number(selected.step))));
      selected.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (command.y || command.x) {
      index = (index + (command.y || command.x) + controls.length) % controls.length;
      selected = controls[index]!;
    }
    if (command.x || command.y || command.confirm) {
      this.root.querySelectorAll('.joypad-focus').forEach(e => e.classList.remove('joypad-focus'));
      selected.classList.add('joypad-focus'); selected.focus({ preventScroll: true });
      if (command.confirm) selected.click();
    }
  }

  disconnected(): void { this.pause.querySelector('.pause-note')!.textContent = 'Joypad desconectado. Reconéctalo o continúa con teclado.'; }

  update(state: FlightState, metrics: RenderMetrics, gamepad: boolean, difficulty: Difficulty = 'normal', padLabels?: readonly (readonly [string, string])[]): void {
    this.hud.classList.toggle('combat', state.enabled);
    this.speed.textContent = String(Math.round(Math.abs(state.player.vx))).padStart(3, '0');
    this.altitude.textContent = String(Math.round(state.player.y)).padStart(3, '0');
    this.coordinate.textContent = String(Math.floor(state.player.x)).padStart(4, '0');
    this.timer.textContent = `${String(Math.floor(state.time / 60)).padStart(2, '0')}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`;
    this.distance.textContent = `${String(Math.floor(state.distance)).padStart(4, '0')} u`;
    this.throttle.style.width = `${Math.min(100, Math.abs(state.player.vx) / VEHICLE_PROFILES[state.vehicleId].flight.maxSpeed * 100)}%`;
    this.device.textContent = gamepad ? 'MANDO CONECTADO' : 'TECLADO';
    const labels = gamepad ? padLabels ?? PAD_CONTROL_LABELS : CONTROL_LABELS;
    const footer = this.root.querySelector('.flight-footer>div')!;
    const deviceKey = labels.map(([key]) => key).join('|');
    if (footer.getAttribute('data-device') !== deviceKey) {
      footer.setAttribute('data-device', deviceKey);
      footer.innerHTML = labels.map(([key, label]) => `<span><kbd>${key}</kbd> ${label}</span>`).join('');
      this.root.querySelector('.gamepad-note')!.textContent = gamepad && padLabels
        ? `Mando USB: ${padLabels.slice(1).map(([key, label]) => `${key} ${label.toLowerCase()}`).join(' · ')}. Puedes cambiarlo en CONFIGURAR MANDO.`
        : 'Joypad: sur A/× disparar y confirmar · oeste X/□ bomba · norte Y/△ acción/portal. Stick/cruceta navegar · este B/○ volver · Start pausa';
      this.root.querySelector('.pad-help')!.textContent = gamepad && padLabels
        ? `Stick / cruceta: elegir · ${padLabels[1]![0]}: confirmar · ${padLabels[5]![0]}: volver`
        : 'Stick / cruceta: elegir · sur A/×: confirmar · este B/○: volver';
    }
    this.root.querySelector('.active-protocol')!.textContent = `Vehículo: ${VEHICLE_PROFILES[state.vehicleId].name} · Protocolo: ${RESCUE_PROTOCOLS[state.rescueProtocol].label} (definidos antes del vuelo).`;
    this.combatHud(state, metrics, gamepad);
    if (gamepad && padLabels && state.portal.ready && this.root.querySelector('#combat-message')!.textContent?.startsWith('PORTAL LISTO')) {
      this.root.querySelector('#combat-message')!.textContent = `PORTAL LISTO · ${padLabels[3]![0]} cerca del anillo para saltar`;
    }
    if (state.enabled) this.root.querySelector('.mission-status')!.textContent = `${state.spawnMode === 'dynamic' ? 'ZONAS' : 'CLÁSICO'} · OLEADA ${String(state.wave).padStart(2, '0')} · ${DIFFICULTIES[difficulty].label.toUpperCase()} ${DIFFICULTIES[difficulty].speed}× · ${state.lives} NAVES`;
    this.backend.textContent = metrics.backend.toUpperCase();
    if (!this.hud.hidden) this.radar.draw(state, metrics.cameraX, metrics.viewWidth);
    if (this.debugVisible) this.root.querySelector('#metrics')!.textContent = [
      `${metrics.backend.toUpperCase()} · ${metrics.width} × ${metrics.height} · DPR ${metrics.pixelRatio}`,
      `${metrics.fps.toFixed(1)} FPS / ${metrics.frameMs.toFixed(2)} ms`,
      `${metrics.drawCalls} draw calls / ${metrics.triangles.toLocaleString()} triángulos`,
      `Geometrías ${metrics.geometries} · Texturas ${metrics.textures}`,
      `Semilla ${state.seed} · Frame ${state.frame}`,
      `Escenario ${state.scenario} · Modo ${MISSION_MODES[state.missionMode].label} · Cruces ${state.laps}`,
      `X ${state.player.x.toFixed(2)} · Y ${state.player.y.toFixed(2)}`,
      `Proyectiles ${state.shots.length} · Cámara ${metrics.cameraX.toFixed(2)}`,
    ].join('\n');
  }

  private combatHud(state: FlightState, metrics: RenderMetrics, gamepad: boolean): void {
    const get = (selector: string) => this.root.querySelector<HTMLElement>(selector)!;
    get('.mission p').textContent = state.enabled ? state.missionMode === 'rescue' ? 'EVACUACIÓN DE LA COLONIA' : 'DEFENSA DE LA COLONIA' : 'RECONOCIMIENTO ORBITAL';
    get('.mission div>span').textContent = !state.enabled ? 'Prueba de vuelo · explora el perímetro circular'
      : state.spawnMode === 'classic'
        ? (state.missionMode === 'rescue' ? 'Extrae colonos · transpórtalos a Fortaleza 01'
          : 'Interrumpe las capturas · atrapa y entrega colonos')
        : state.missionMode === 'rescue'
          ? 'Amenazas recurrentes · entrega colonos hasta resolver su destino'
          : 'Amenazas recurrentes · resiste y protege a la colonia';
    get('.mission-status').textContent = state.enabled ? 'OLEADA 01' : 'VUELO LIBRE';
    get('.mission-index').textContent = String(state.wave).padStart(2, '0');
    if (!state.enabled) { get('#world-labels').innerHTML = ''; return; }
    const live = state.colonists.filter(c => c.status !== 'lost').length;
    const carrying = state.colonists.filter(c => c.status === 'carried').length;
    const passengers = state.colonists.filter(c => c.status === 'carried' && c.onboard).length;
    const extracting = state.colonists.some(c => c.status === 'extracting');
    const helicopter = state.vehicleId === 'helicopter';
    const capacity = VEHICLE_PROFILES[state.vehicleId].rescue.capacity;
    const lifeSlots = Math.max(state.lives, DIFFICULTIES[state.difficulty].lifeCap);
    const dynamic = state.spawnMode === 'dynamic';
    const goal = defenseGoal(state.wave, state.difficulty, state.colonists.length);
    const remaining = Math.max(0, Math.ceil(goal.seconds - (state.time - state.waveStartedAt)));
    const objective = dynamic ? state.missionMode === 'defense'
      ? `<span>RESISTIR <b>${remaining}s</b></span><span>MÍNIMO <b>${goal.minimum}</b></span>`
      : `<span>POR RESOLVER <b>${state.colonists.filter(c => c.status !== 'safe' && c.status !== 'lost').length}</b></span>`
      : '';
    get('#combat-stats').innerHTML = `<span>PUNTOS <b>${String(state.score).padStart(6, '0')}</b></span><span>NAVES <b>${'◆'.repeat(state.lives)}${'◇'.repeat(lifeSlots - state.lives)}</b></span><span>BOMBAS <b>${state.bombs}</b></span><span>COLONOS <b>${live}/${state.colonists.length}</b></span><span>A SALVO <b>${state.delivered}</b></span>${state.missionMode === 'rescue' || helicopter ? `<span>A BORDO <b>${passengers}/${capacity ?? state.colonists.length}</b></span>` : ''}<span>AMENAZAS <b>${state.enemies.length + (dynamic ? 0 : state.schedule.length - state.spawnIndex)}</b></span>${objective}`;
    const event = [...state.events].reverse().find(e => !['spawn', 'impact', 'explosion'].includes(e.kind) && state.time - e.time < 3);
    const messages: Partial<Record<GameEvent['kind'], string>> = {
      capture: '¡CAPTURA DETECTADA! Intercepta al abductor', extraction: helicopter ? 'RECOGIDA EN CURSO · Mantén E/Y, cerca del suelo y a baja velocidad' : 'HAZ ACTIVO · Mantén E / Y pulsado hasta completar el ascenso', falling: 'COLONO EN CAÍDA · Atrápalo antes de llegar al suelo',
      landing: 'COLONO EN TIERRA · Ha sobrevivido a la caída', rescue: 'COLONO A BORDO · Desciende y frena para entregarlo',
      delivery: 'ENTREGA SEGURA · Portal disponible en el radar', lost: 'COLONO PERDIDO', mutation: 'ABDUCCIÓN COMPLETADA · WRAITH ACTIVO',
      'bomb-charge': 'CARGANDO BOMBA', bomb: 'BOMBA DETONADA', portal: 'SALTO COMPLETADO · +1000 por el primer salto',
      'player-hit': 'NAVE DESTRUIDA', respawn: 'REAPARICIÓN · ESCUDO TEMPORAL',
    };
    const message = !state.player.alive ? `REAPARICIÓN EN ${Math.max(0, state.respawnTimer).toFixed(1)} s`
      : extracting ? `${helicopter ? 'RECOGIDA' : 'EXTRACCIÓN'} EN CURSO · Mantén ${gamepad ? 'Y/△' : 'E'} y el vehículo cerca`
      : helicopter && capacity !== null && passengers >= capacity
        ? `CABINA LLENA (${passengers}/${capacity}) · Entrega en ${SAFE_BASE.name} a baja velocidad`
      : passengers > 0 ? `${passengers} A BORDO · Puedes recoger más o aterrizar en ${SAFE_BASE.name}`
      : carrying ? `COLONO A BORDO · Baja al terreno y frena por debajo de 22 u/s`
      : state.colonists.some(c => c.status === 'falling') ? 'COLONO EN CAÍDA · Busca ↓ en el radar y atrápalo'
      : event && messages[event.kind] ? messages[event.kind]!
      : state.missionMode === 'rescue' && state.colonists.some(c => c.status === 'ground')
        ? helicopter
          ? `HELICÓPTERO · Desciende, frena a menos de 20 u/s y mantén ${gamepad ? 'Y/△' : 'E'} para recoger`
          : `MODO RESCATISTA · Mantén ${gamepad ? 'Y/△' : 'E'} sobre los colonos para subirlos a bordo`
      : state.portal.ready ? `PORTAL LISTO · ${gamepad ? 'NORTE Y/△' : 'E'} cerca del anillo para saltar`
      : dynamic && state.missionMode === 'defense' ? `DEFENSA POR ZONAS · ${remaining}s · ${live}/${goal.minimum} supervivientes`
         : 'PROTEGE A LOS COLONOS · Usa el radar para localizar capturas';
    if (get('#combat-message').textContent !== message) get('#combat-message').textContent = message;
    const labels = state.colonists.filter(c => c.status !== 'lost' && !c.onboard && Math.abs(signedWrappedDeltaX(metrics.cameraX, c.x, CONFIG.worldWidth)) < metrics.viewWidth / 2 - 3)
      .map(c => {
        const x = 50 + signedWrappedDeltaX(metrics.cameraX, c.x, CONFIG.worldWidth) / metrics.viewWidth * 100;
        const y = (108 - c.y - (c.status === 'carried' ? 6 : 0)) / CONFIG.viewHeight * 100;
        const text = c.status === 'falling' ? '↓ ATRÁPALO' : c.status === 'captured' ? '↑ CAPTURADO' : c.status === 'extracting' ? '↑ EXTRACCIÓN' : c.status === 'safe' ? '✓ A SALVO' : c.status === 'carried' ? '↓ ENTREGA' : c.status === 'targeted' ? '! EN PELIGRO' : '◇ COLONO';
        return `<span class="world-label ${['falling', 'captured', 'targeted'].includes(c.status) ? 'urgent' : ''}" style="left:${x}%;top:${y}%">${text}</span>`;
      });
    if (state.missionMode === 'rescue' && Math.abs(signedWrappedDeltaX(metrics.cameraX, SAFE_BASE.x, CONFIG.worldWidth)) < metrics.viewWidth / 2 - 3) {
      const baseX = 50 + signedWrappedDeltaX(metrics.cameraX, SAFE_BASE.x, CONFIG.worldWidth) / metrics.viewWidth * 100;
      const baseY = (93 - 15) / CONFIG.viewHeight * 100;
      labels.push(`<span class="world-label safe-base-label" style="left:${baseX}%;top:${baseY}%">▣ ${SAFE_BASE.name}</span>`);
    }
    get('#world-labels').innerHTML = labels.join('');
    if (state.summary) {
      get('#result-title').textContent = state.outcome === 'victory' ? 'Oleada completada.' : 'Misión terminada.';
      get('#result-wave').textContent = `OPERACIÓN / OLEADA ${state.wave}`;
      get('#result-note').textContent = state.outcome === 'victory'
        ? `Siguiente: ${state.wave + 1}. ${state.colonists.length} colonos nuevos · +1 bomba (según dificultad)${state.wave % 3 === 0 ? ' · +1 nave' : ''}. Conservas tus puntos y naves.`
        : state.spawnMode === 'dynamic' ? 'No se cumplió el objetivo de supervivencia o rescate. Puedes volver a intentarlo.'
          : 'No quedan naves de reserva. Puedes volver a intentarlo.';
      get('[data-action="result"]').innerHTML = state.outcome === 'victory' ? 'SIGUIENTE OLEADA <span>↗</span>' : 'VOLVER A JUGAR <span>↗</span>';
      get('#result-stats').innerHTML = `<div>Colonos supervivientes <b>${state.summary.survivors}/${state.colonists.length}</b></div><div>Entregados a salvo <b>${state.summary.rescued}</b></div><div>Bajas <b>${state.summary.lost}</b></div><div>Tiempo <b>${state.summary.time.toFixed(1)} s</b></div><div>Bonificación <b>+${state.summary.bonus}</b></div><div>Puntuación total <b>${state.summary.score}</b></div>`;
    }
  }
}
