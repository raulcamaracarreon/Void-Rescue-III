import { DIFFICULTIES } from '../game/Difficulty';
import { VEHICLE_PROFILES } from '../game/VehicleProfile';
import type { VehicleId } from '../game/VehicleProfile';
import type { Records } from '../game/Records';
import { MISSION_MODES } from '../game/MissionMode';
import type { MissionMode } from '../game/MissionMode';
import { SPAWN_MODES } from '../game/SpawnMode';
import type { SpawnMode } from '../game/SpawnMode';
import { RESCUE_PROTOCOLS } from '../game/RescueProtocol';
import type { RescueProtocol } from '../game/RescueProtocol';

export class RecordsPanel {
  private readonly dialog: HTMLDialogElement;
  constructor(root: HTMLElement, private readonly records: Records, onClose: () => void,
    private readonly selectedModes: () => { spawnMode: SpawnMode; missionMode: MissionMode; rescueProtocol: RescueProtocol; vehicleId: VehicleId } = () => ({ spawnMode: 'classic', missionMode: 'defense', rescueProtocol: 'realistic', vehicleId: 'ship' })) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'pause-dialog records-dialog';
    this.dialog.setAttribute('aria-labelledby', 'records-title');
    this.dialog.innerHTML = `<p class="eyebrow">ARCHIVO DE VUELO / TOP 10 LOCAL</p><h2 id="records-title">Récords de pilotos<span>.</span></h2>
      <p class="pause-note">Cada combinación de vehículo, enemigos, misión y protocolo de rescate tiene su propio top 10.</p>
      <div class="records-filters"><label>VEHÍCULO <select aria-label="Récords: vehículo" class="records-vehicle"></select></label><label>ENEMIGOS <select aria-label="Récords: sistema de enemigos" class="records-spawn"></select></label><label>MISIÓN <select aria-label="Récords: misión" class="records-mission"></select></label><label>RESCATE <select aria-label="Récords: protocolo de rescate" class="records-protocol"></select></label></div>
      <div class="records-table"><table><thead><tr><th>#</th><th>Piloto</th><th>Puntos</th><th>Oleada</th><th>Modo</th><th>Dificultad</th></tr></thead><tbody></tbody></table></div>
      <p class="records-empty">Aún no hay récords. ¡Inicia un vuelo!</p><p class="records-storage"></p>
      <button class="primary">VOLVER <span>↗</span></button><p class="pad-help">Confirmar / volver: cerrar</p>`;
    root.append(this.dialog);
    const vehicle = this.dialog.querySelector<HTMLSelectElement>('.records-vehicle')!;
    vehicle.innerHTML = Object.entries(VEHICLE_PROFILES).map(([id, info]) => `<option value="${id}">${info.name}</option>`).join('');
    vehicle.addEventListener('change', () => this.render());
    const spawn = this.dialog.querySelector<HTMLSelectElement>('.records-spawn')!;
    spawn.innerHTML = Object.entries(SPAWN_MODES).map(([id, info]) => `<option value="${id}">${info.short}</option>`).join('');
    const mission = this.dialog.querySelector<HTMLSelectElement>('.records-mission')!;
    mission.innerHTML = Object.entries(MISSION_MODES).map(([id, info]) => `<option value="${id}">${info.label}</option>`).join('');
    const protocol = this.dialog.querySelector<HTMLSelectElement>('.records-protocol')!;
    protocol.innerHTML = Object.entries(RESCUE_PROTOCOLS).map(([id, info]) => `<option value="${id}">${info.short}</option>`).join('');
    protocol.addEventListener('change', () => this.render());
    spawn.addEventListener('change', () => this.render());
    mission.addEventListener('change', () => this.render());
    this.dialog.querySelector('button')!.addEventListener('click', () => this.close());
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.dialog.addEventListener('close', onClose);
  }
  get open(): boolean { return this.dialog.open; }
  show(): void {
    const selected = this.selectedModes();
    this.dialog.querySelector<HTMLSelectElement>('.records-vehicle')!.value = selected.vehicleId;
    this.dialog.querySelector<HTMLSelectElement>('.records-spawn')!.value = selected.spawnMode;
    this.dialog.querySelector<HTMLSelectElement>('.records-mission')!.value = selected.missionMode;
    this.dialog.querySelector<HTMLSelectElement>('.records-protocol')!.value = selected.rescueProtocol;
    this.render();
    this.dialog.showModal();
  }
  private render(): void {
    const vehicle = this.dialog.querySelector<HTMLSelectElement>('.records-vehicle')!.value as VehicleId;
    const spawning = this.dialog.querySelector<HTMLSelectElement>('.records-spawn')!.value as SpawnMode;
    const mission = this.dialog.querySelector<HTMLSelectElement>('.records-mission')!.value as MissionMode;
    const protocol = this.dialog.querySelector<HTMLSelectElement>('.records-protocol')!.value as RescueProtocol;
    const entries = this.records.list(spawning, mission, protocol, vehicle);
    const body = this.dialog.querySelector('tbody')!; body.replaceChildren();
    for (const [index, r] of entries.entries()) {
      const row = document.createElement('tr'); row.title = new Date(r.date).toLocaleString();
      for (const value of [index + 1, r.pilot, r.score.toLocaleString(), r.wave, MISSION_MODES[r.missionMode ?? 'defense'].short, DIFFICULTIES[r.difficulty].label]) {
        const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell);
      }
      body.append(row);
    }
    this.dialog.querySelector<HTMLElement>('.records-empty')!.hidden = entries.length > 0;
    this.dialog.querySelector('.records-storage')!.textContent = this.records.persistent
      ? 'Guardado automático al completar oleada, terminar o salir. Solo en este navegador; no reanuda la partida.'
      : 'Almacenamiento no disponible: los récords solo durarán esta sesión.';
  }
  close(): void { this.dialog.close(); }
  navigate(input: { confirm: boolean; back: boolean }): void { if (input.confirm || input.back) this.close(); }
}
