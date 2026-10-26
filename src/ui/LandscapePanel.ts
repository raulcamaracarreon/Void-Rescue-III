import {
  allLandscapeChoices, copyLandscape, decorColorForStyle, DEFAULT_FOREGROUND, DEFAULT_MIDGROUND,
  defaultLandscapePreferences, LANDSCAPE_PRESETS,
  landscapeForWave,
  resolveLandscape, sanitizeLandscapePreferences,
} from '../landscape/LandscapeConfig';
import type {
  AutomaticLandscape, LandscapeEditorMode, LandscapeLayer, LandscapePreferences,
  LandscapeSelection, LandscapeStyle,
} from '../landscape/LandscapeConfig';

/** Two editing modes: a derived RGB gradient and complete per-layer controls. */
export class LandscapePanel {
  private readonly dialog: HTMLDialogElement;
  private readonly selection: HTMLSelectElement;
  private readonly mode: HTMLSelectElement;
  private readonly layers: HTMLElement;
  private readonly description: HTMLElement;
  private readonly swatches: HTMLElement;
  private preferences: LandscapePreferences;
  private editingId: string | null = null;
  private readonly nameInput: HTMLInputElement;
  private readonly rotationList: HTMLElement;

  constructor(root: HTMLElement, initial: LandscapePreferences,
    private readonly onChange: (value: LandscapePreferences) => void,
    private readonly currentWave: () => number,
    private readonly currentSeed: () => number = () => 0) {
    this.preferences = sanitizeLandscapePreferences(initial);
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'pause-dialog landscape-dialog';
    this.dialog.setAttribute('aria-label', 'Personalizar paisaje');
    this.dialog.innerHTML = `
      <p class="eyebrow">VOID RESCUE III / MUNDO PROCEDURAL</p>
      <h2>Personalizar paisaje<span>.</span></h2>
      <p class="landscape-help">Un gradiente automático entre el color del cielo y el primer plano, o control individual de cada capa. Los cambios se aplican al instante.</p>
      <div class="landscape-selection-row">
        <label class="landscape-label">Estilo visual
          <select id="landscape-selection" aria-label="Estilo de paisaje">
            <option value="cycle">Automático por oleada</option>
            ${Object.entries(LANDSCAPE_PRESETS).map(([key, preset]) => `<option value="${key}">${preset.label}</option>`).join('')}
            <option value="custom">Personalizado</option>
          </select>
        </label>
        <label class="landscape-label">Edición de capas
          <select id="landscape-mode" aria-label="Modo de edición">
            <option value="automatic">Automático · dos colores</option>
            <option value="advanced">Avanzado · por capa</option>
          </select>
        </label>
      </div>
      <p class="landscape-description" role="status"></p>
      <section class="landscape-library">
        <h3>Mis paisajes</h3>
        <p class="landscape-help">Guarda tantos paisajes como quieras. Los estilos incluidos no se sobrescriben.</p>
        <label class="landscape-label">Nombre del paisaje
          <input type="text" maxlength="60" class="landscape-name" aria-label="Nombre del paisaje" placeholder="Mi nuevo mundo">
        </label>
        <div class="landscape-buttons landscape-library-actions">
          <button type="button" data-landscape="save-new">Guardar nuevo</button>
          <button type="button" data-landscape="save-changes">Guardar cambios</button>
          <button type="button" data-landscape="duplicate">Duplicar</button>
          <button type="button" data-landscape="rename">Renombrar</button>
          <button type="button" data-landscape="delete">Eliminar</button>
        </div>
        <h3>Ambientes de las oleadas</h3>
        <label class="landscape-label">Orden de aparición
          <select class="landscape-rotation" aria-label="Rotación de ambientes">
            <option value="sequential">Secuencial</option>
            <option value="shuffle">Aleatorio sin repeticiones</option>
          </select>
        </label>
        <p class="landscape-help">Orden secuencial: primero la columna izquierda de arriba abajo y después la derecha. Arrastra un ambiente para reorganizarlo, o elige una posición exacta.</p>
        <div class="landscape-order-tools">
          <label>Ambiente <select class="landscape-order-target" aria-label="Ambiente que quieres mover"></select></label>
          <label>Posición <input class="landscape-order-position" type="number" min="1" step="1" aria-label="Nueva posición del ambiente"></label>
          <button type="button" data-landscape-order="position">Mover</button>
          <button type="button" data-landscape-order="first">Al inicio</button>
          <button type="button" data-landscape-order="last">Al final</button>
        </div>
        <div class="landscape-rotation-list" aria-label="Ambientes de las oleadas ordenados por columnas"></div>
      </section>
      <div class="landscape-automatic">
        <p class="landscape-help">Elige únicamente dos colores. El juego interpola los tonos de las capas, de lejos a cerca.</p>
        <div class="landscape-global">
          <label>Color del cielo <input type="color" data-auto="skyColor" aria-label="Color del cielo"></label>
          <label>Capa más cercana <input type="color" data-auto="frontColor" aria-label="Color de la capa más cercana"></label>
          <label>Número de capas <input type="number" min="2" max="10" step="1" data-auto="layerCount" aria-label="Número de capas"></label>
          <label>Composición <select data-auto="composition" aria-label="Tipo de paisaje">
            <option value="mountains">Montañas</option><option value="buildings">Edificios</option><option value="mixed">Mixto</option>
          </select></label>
        </div>
        <p class="landscape-swatches-label">GRADIENTE GENERADO · DE LEJOS A CERCA</p>
        <div class="landscape-swatches" aria-label="Vista previa de colores por capa"></div>
      </div>
      <div class="landscape-advanced" hidden>
        <div class="landscape-global">
          <label>Cielo superior <input type="color" data-sky="skyTop" aria-label="Color superior del cielo"></label>
          <label>Horizonte <input type="color" data-sky="skyBottom" aria-label="Color del horizonte"></label>
        </div>
        <div class="landscape-layers-title"><strong>CAPAS · DE LEJOS A CERCA</strong><span>2–10</span></div>
        <div class="landscape-layers"></div>
        <div class="landscape-buttons">
          <button type="button" data-landscape="add">+ Capa</button>
          <button type="button" data-landscape="remove">− Capa</button>
        </div>
      </div>
      <section class="landscape-foreground" aria-label="Elementos de tercer plano">
        <h3>Tercer plano · detrás de vehículos</h3>
        <p class="landscape-help">Elementos opcionales entre los vehículos y los fondos de montañas o edificios. Se editan por separado del primer plano y no tienen colisiones.</p>
        <div class="landscape-foreground-controls">
          <label class="landscape-foreground-toggle">Activar tercer plano
            <input type="checkbox" data-midground="enabled" aria-label="Activar tercer plano">
          </label>
          <label>Motivo
            <select data-midground="kind" aria-label="Motivo de tercer plano">
              <option value="trees">Árboles</option>
              <option value="fence">Cercas</option>
              <option value="grille">Rejas</option>
            </select>
          </label>
          <label>Modo de color
            <select data-midground="colorMode" aria-label="Modo de color de tercer plano">
              <option value="manual">Manual</option>
              <option value="gradient">Gradiente automático</option>
            </select>
          </label>
          <label>Invertir gradiente
            <input type="checkbox" data-midground="invertGradient" aria-label="Invertir gradiente de tercer plano">
          </label>
          <label>Color / vista previa <input type="color" data-midground="color" aria-label="Color de tercer plano"></label>
          <label>Opacidad (%) <input type="number" min="10" max="85" step="1" data-midground="opacity" aria-label="Opacidad de tercer plano"></label>
          <label>Paralaje (%) <input type="number" min="40" max="100" step="1" data-midground="parallax" aria-label="Paralaje de tercer plano"></label>
        </div>
      </section>
      <section class="landscape-foreground" aria-label="Elementos de primer plano">
        <h3>Primer plano · elementos decorativos</h3>
        <p class="landscape-help">Opcional. Las siluetas pasan delante de la nave y no provocan colisiones. Para conservar los cambios en un ambiente, utiliza Guardar nuevo o Guardar cambios en Mis paisajes.</p>
        <div class="landscape-foreground-controls">
          <label class="landscape-foreground-toggle">Activar primer plano
            <input type="checkbox" data-foreground="enabled" aria-label="Activar primer plano">
          </label>
          <label>Motivo
            <select data-foreground="kind" aria-label="Motivo de primer plano">
              <option value="trees">Árboles</option>
              <option value="fence">Cercas</option>
              <option value="grille">Rejas</option>
            </select>
          </label>
          <label>Modo de color
            <select data-foreground="colorMode" aria-label="Modo de color de primer plano">
              <option value="manual">Manual</option>
              <option value="gradient">Gradiente automático</option>
            </select>
          </label>
          <label>Invertir gradiente
            <input type="checkbox" data-foreground="invertGradient" aria-label="Invertir gradiente de primer plano">
          </label>
          <label>Color / vista previa <input type="color" data-foreground="color" aria-label="Color de primer plano"></label>
          <label>Opacidad (%) <input type="number" min="10" max="85" step="1" data-foreground="opacity" aria-label="Opacidad de primer plano"></label>
          <label>Paralaje (%) <input type="number" min="100" max="135" step="1" data-foreground="parallax" aria-label="Paralaje de primer plano"></label>
        </div>
      </section>
      <div class="landscape-common">
        <label>Estrellas <input type="checkbox" data-common="stars" aria-label="Mostrar estrellas"></label>
        <label>Luna <input type="checkbox" data-common="moon" aria-label="Mostrar luna"></label>
        <label>Semilla <input type="number" min="0" max="999999999" data-common="seed" aria-label="Semilla de paisaje"></label>
      </div>
      <div class="landscape-buttons">
        <button type="button" data-landscape="customize">Editar estilo actual</button>
        <button type="button" data-landscape="restore">Restablecer</button>
      </div>
      <button type="button" class="primary" data-landscape="close">LISTO / VOLVER ↗</button>
      <p class="landscape-help">Las siluetas cambian de semilla al avanzar de oleada. El modo Automático por oleada cambia también de paleta.</p>
    `;
    root.append(this.dialog);
    this.selection = this.dialog.querySelector<HTMLSelectElement>('#landscape-selection')!;
    this.mode = this.dialog.querySelector<HTMLSelectElement>('#landscape-mode')!;
    this.layers = this.dialog.querySelector<HTMLElement>('.landscape-layers')!;
    this.description = this.dialog.querySelector<HTMLElement>('.landscape-description')!;
    this.swatches = this.dialog.querySelector<HTMLElement>('.landscape-swatches')!;
    this.nameInput = this.dialog.querySelector<HTMLInputElement>('.landscape-name')!;
    this.rotationList = this.dialog.querySelector<HTMLElement>('.landscape-rotation-list')!;

    this.selection.addEventListener('change', () => {
      this.preferences.selection = this.selection.value as LandscapeSelection;
      this.editingId = null;
      const saved = this.currentSaved();
      if (saved) this.preferences.mode = saved.mode;
      this.commit();
      this.render();
    });
    this.mode.addEventListener('change', () => {
      this.switchMode(this.mode.value as LandscapeEditorMode);
    });
    for (const input of this.dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-auto]')) {
      const apply = () => {
        const style = this.mutableStyle();
        const settings = style.automatic!;
        const key = input.dataset.auto as keyof AutomaticLandscape;
        if (key === 'layerCount') settings.layerCount = Math.max(2, Math.min(10, Math.round(Number(input.value) || 2)));
        else if (key === 'composition') settings.composition = input.value === 'buildings' || input.value === 'mixed' ? input.value : 'mountains';
        else if (key === 'skyColor' || key === 'frontColor') settings[key] = input.value;
        this.commit();
      };
      // The number field publishes immediately, without forcing a focus-losing rerender mid-typing.
      if (input.dataset.auto === 'layerCount') input.addEventListener('input', () => { apply(); this.paintSwatches(); });
      input.addEventListener('change', () => { apply(); this.render(); });
    }
    for (const input of this.dialog.querySelectorAll<HTMLInputElement>('[data-sky]')) {
      input.addEventListener('change', () => {
        const style = this.mutableStyle();
        const key = input.dataset.sky as 'skyTop' | 'skyBottom';
        style[key] = input.value;
        style.advancedEdited = true;
        this.commit();
      });
    }
    for (const input of this.dialog.querySelectorAll<HTMLInputElement>('[data-common]')) {
      input.addEventListener('change', () => {
        const style = this.mutableStyle();
        const key = input.dataset.common;
        if (key === 'stars') style.stars = input.checked;
        else if (key === 'moon') style.moon = input.checked;
        else if (key === 'seed') style.seed = Math.max(0, Math.min(999999999, Math.round(Number(input.value) || 0)));
        this.commit();
      });
    }
    for (const input of this.dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-foreground], [data-midground]')) {
      input.addEventListener('change', () => {
        const style = this.mutableStyle();
        const isMiddle = input.hasAttribute('data-midground');
        const key = isMiddle ? input.dataset.midground : input.dataset.foreground;
        const decor = isMiddle
          ? (style.midground ?? { ...DEFAULT_MIDGROUND })
          : (style.foreground ?? { ...DEFAULT_FOREGROUND });
        switch (key) {
          case 'enabled': decor.enabled = (input as HTMLInputElement).checked; break;
          case 'colorMode': decor.colorMode = input.value === 'gradient' ? 'gradient' : 'manual'; break;
          case 'invertGradient': decor.invertGradient = (input as HTMLInputElement).checked; break;
          case 'kind':
            decor.kind = input.value === 'fence' || input.value === 'grille' ? input.value : 'trees';
            break;
          case 'color': decor.color = input.value; break;
          case 'opacity':
            decor.opacity = Math.max(0.1, Math.min(0.85, Number(input.value) / 100));
            break;
          case 'parallax':
            decor.parallax = Math.max(isMiddle ? 0.4 : 1,
              Math.min(isMiddle ? 1 : 1.35, Number(input.value) / 100));
            break;
        }
        if (isMiddle) style.midground = decor;
        else style.foreground = decor;
        this.commit();
        this.render();
      });
    }
    this.layers.addEventListener('change', event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
      const row = input.closest<HTMLElement>('[data-layer]');
      if (!row) return;
      const index = Number(row.dataset.layer);
      const style = this.mutableStyle();
      const layer = style.layers[index];
      if (!layer) return;
      const key = input.dataset.field as keyof LandscapeLayer | undefined;
      if (key === 'type') layer.type = input.value === 'buildings' ? 'buildings' : 'mountains';
      else if (key === 'color') layer.color = input.value;
      else if (key === 'amplitude') layer.amplitude = Math.max(2, Math.min(35, Math.round(Number(input.value) || 2)));
      else if (key === 'detail') layer.detail = Math.max(1, Math.min(100, Math.round(Number(input.value) || 1)));
      style.advancedEdited = true;
      this.commit();
    });

    this.dialog.querySelector<HTMLButtonElement>('[data-landscape="customize"]')!.addEventListener('click', () => {
      if (this.preferences.mode === 'automatic') this.switchMode('advanced');
      else { this.mutableStyle(); this.render(); this.commit(); }
    });
    this.dialog.querySelector<HTMLButtonElement>('[data-landscape="add"]')!.addEventListener('click', () => {
      const style = this.mutableStyle();
      if (style.layers.length < 10) style.layers.push({ ...style.layers[style.layers.length - 1]! });
      style.advancedEdited = true;
      this.commit(); this.render();
    });
    this.dialog.querySelector<HTMLButtonElement>('[data-landscape="remove"]')!.addEventListener('click', () => {
      const style = this.mutableStyle();
      if (style.layers.length > 2) style.layers.pop();
      style.advancedEdited = true;
      this.commit(); this.render();
    });
    this.dialog.querySelector<HTMLButtonElement>('[data-landscape="restore"]')!.addEventListener('click', () => {
      // Presets are restored, but personal library and its pool must never be wiped.
      const previous = this.preferences;
      this.preferences = { ...defaultLandscapePreferences(), library: previous.library,
        cyclePool: previous.cyclePool, rotation: previous.rotation };
      this.editingId = null;
      this.commit(); this.render();
    });
    this.dialog.querySelector<HTMLSelectElement>('.landscape-rotation')!.addEventListener('change', event => {
      this.preferences.rotation = (event.target as HTMLSelectElement).value === 'shuffle'
        ? 'shuffle' : 'sequential';
      this.commit(); this.render();
    });
    this.rotationList.addEventListener('change', event => {
      const checkbox = event.target;
      if (!(checkbox instanceof HTMLInputElement) || !checkbox.dataset.landscapeId) return;
      const id = checkbox.dataset.landscapeId;
      if (!checkbox.checked && this.preferences.cyclePool.length === 1) {
        checkbox.checked = true; // Keep at least one environment available.
        return;
      }
      if (checkbox.checked && !this.preferences.cyclePool.includes(id)) this.preferences.cyclePool.push(id);
      if (!checkbox.checked) this.preferences.cyclePool = this.preferences.cyclePool.filter(item => item !== id);
      this.commit(); this.renderRotationList();
    });
    this.rotationList.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const id = target.dataset.landscapeId, direction = target.dataset.move;
      if (!id || !direction) return;
      const from = this.preferences.cyclePool.indexOf(id);
      if (direction === 'up' || direction === 'down') {
        this.moveEnvironment(id, from + (direction === 'up' ? -1 : 1));
      }
    });
    const orderTarget = this.dialog.querySelector<HTMLSelectElement>('.landscape-order-target')!;
    const orderPosition = this.dialog.querySelector<HTMLInputElement>('.landscape-order-position')!;
    orderTarget.addEventListener('change', () => {
      const index = this.preferences.cyclePool.indexOf(orderTarget.value);
      orderPosition.value = index < 0 ? '' : String(index + 1);
    });
    for (const button of this.dialog.querySelectorAll<HTMLButtonElement>('[data-landscape-order]')) {
      button.addEventListener('click', () => {
        const id = orderTarget.value;
        if (!id) return;
        const action = button.dataset.landscapeOrder;
        const position = Number(orderPosition.value);
        if (action === 'position' && (!Number.isInteger(position) || position < 1
          || position > this.preferences.cyclePool.length)) {
          orderPosition.setCustomValidity('Elige una posición válida');
          orderPosition.reportValidity();
          return;
        }
        orderPosition.setCustomValidity('');
        const to = action === 'first' ? 0
          : action === 'last' ? this.preferences.cyclePool.length - 1 : position - 1;
        this.moveEnvironment(id, to);
      });
    }
    orderPosition.addEventListener('input', () => orderPosition.setCustomValidity(''));
    let draggedId: string | null = null;
    const clearDropMarker = () => {
      for (const row of this.rotationList.querySelectorAll('.landscape-drop-before, .landscape-drop-after')) {
        row.classList.remove('landscape-drop-before', 'landscape-drop-after');
      }
    };
    this.rotationList.addEventListener('dragstart', event => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches('.landscape-drag-handle')) return;
      const id = target.dataset.landscapeId;
      if (!id || !this.preferences.cyclePool.includes(id)) return;
      draggedId = id;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
      }
    });
    this.rotationList.addEventListener('dragover', event => {
      if (!draggedId) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const row = target.closest<HTMLElement>('.landscape-rotation-row[data-active="true"]');
      if (!row) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      clearDropMarker();
      const rect = row.getBoundingClientRect();
      row.classList.add(event.clientY < rect.top + rect.height / 2
        ? 'landscape-drop-before' : 'landscape-drop-after');
    });
    this.rotationList.addEventListener('drop', event => {
      if (!draggedId) return;
      const target = event.target;
      const row = target instanceof Element
        ? target.closest<HTMLElement>('.landscape-rotation-row[data-active="true"]') : null;
      if (!row) return;
      event.preventDefault();
      const from = this.preferences.cyclePool.indexOf(draggedId);
      const targetIndex = this.preferences.cyclePool.indexOf(row.dataset.landscapeId ?? '');
      if (from < 0 || targetIndex < 0) return;
      const rect = row.getBoundingClientRect();
      const after = event.clientY >= rect.top + rect.height / 2;
      const insertionIndex = targetIndex + (after ? 1 : 0);
      const newIndex = insertionIndex - (from < insertionIndex ? 1 : 0);
      const movedId = draggedId;
      draggedId = null;
      clearDropMarker();
      orderTarget.value = movedId;
      this.moveEnvironment(movedId, newIndex);
    });
    this.rotationList.addEventListener('dragend', () => {
      draggedId = null;
      clearDropMarker();
    });
    this.dialog.querySelector<HTMLButtonElement>('[data-landscape="save-new"]')!.addEventListener('click', () => {
      const name = this.nameInput.value.trim().slice(0, 60) || `Mi paisaje ${this.preferences.library.length + 1}`;
      const id = crypto.randomUUID();
      if (this.preferences.library.length >= 100) { this.description.textContent = 'Máximo de 100 paisajes guardados'; return; }
      this.preferences.library.push({
        id, name, mode: this.effectiveMode(),
        style: copyLandscape(resolveLandscape(this.preferences, this.currentWave(), this.currentSeed()).style),
      });
      this.preferences.selection = `user:${id}`;
      this.editingId = null;
      this.commit(); this.render();
    });
    this.dialog.querySelector<HTMLButtonElement>('[data-landscape="save-changes"]')!.addEventListener('click', () => {
      const entry = this.currentSaved() ?? this.preferences.library.find(item => item.id === this.editingId);
      if (!entry) return;
      entry.style = copyLandscape(this.preferences.selection === 'custom'
        ? this.preferences.custom : resolveLandscape(this.preferences, this.currentWave(), this.currentSeed()).style);
      entry.mode = this.preferences.mode;
      this.preferences.selection = `user:${entry.id}`;
      this.editingId = null;
      this.commit(); this.render();
    });
    this.dialog.querySelector<HTMLButtonElement>('[data-landscape="duplicate"]')!.addEventListener('click', () => {
      if (this.preferences.library.length >= 100) return;
      const source = this.currentSaved();
      const name = `${source?.name ?? resolveLandscape(this.preferences, this.currentWave(), this.currentSeed()).name} (copia)`;
      const id = crypto.randomUUID();
      this.preferences.library.push({ id, name, mode: this.effectiveMode(),
        style: copyLandscape(resolveLandscape(this.preferences, this.currentWave(), this.currentSeed()).style) });
      this.preferences.selection = `user:${id}`;
      this.editingId = null;
      this.commit(); this.render();
    });
    this.dialog.querySelector<HTMLButtonElement>('[data-landscape="rename"]')!.addEventListener('click', () => {
      const entry = this.currentSaved() ?? this.preferences.library.find(item => item.id === this.editingId);
      if (!entry || !this.nameInput.value.trim()) return;
      entry.name = this.nameInput.value.trim().slice(0, 60);
      this.commit(); this.render();
    });
    this.dialog.querySelector<HTMLButtonElement>('[data-landscape="delete"]')!.addEventListener('click', () => {
      const entry = this.currentSaved() ?? this.preferences.library.find(item => item.id === this.editingId);
      if (!entry || !confirm(`¿Eliminar el paisaje "${entry.name}"?`)) return;
      this.preferences.library = this.preferences.library.filter(item => item.id !== entry.id);
      this.preferences.cyclePool = this.preferences.cyclePool.filter(item => item !== `user:${entry.id}`);
      this.preferences.selection = 'cycle';
      this.editingId = null;
      this.commit(); this.render();
    });
    this.dialog.querySelector<HTMLButtonElement>('[data-landscape="close"]')!.addEventListener('click', () => this.close());
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.render();
  }

  get open(): boolean { return this.dialog.open; }
  show(): void {
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
    this.selection.focus({ preventScroll: true });
  }
  close(): void { if (this.dialog.open) this.dialog.close(); }

  navigatePad(command: { x: number; y: number; confirm: boolean; back: boolean }): void {
    if (command.back) { this.close(); return; }
    const controls = [...this.dialog.querySelectorAll<HTMLElement>('input, select, button')]
      .filter(element => element.getBoundingClientRect().width > 0);
    if (!controls.length) return;
    let index = controls.indexOf(document.activeElement as HTMLElement);
    if (index < 0) index = 0;
    let selected = controls[index]!;
    if (command.x && selected instanceof HTMLSelectElement) {
      selected.selectedIndex = Math.max(0, Math.min(selected.options.length - 1, selected.selectedIndex + command.x));
      selected.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (command.x && selected instanceof HTMLInputElement && selected.type === 'number') {
      selected.value = String(Math.max(Number(selected.min), Math.min(Number(selected.max), Number(selected.value) + command.x)));
      selected.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (command.x || command.y) {
      index = (index + (command.y || command.x) + controls.length) % controls.length;
      selected = controls[index]!;
    }
    if (command.x || command.y || command.confirm) {
      this.dialog.querySelectorAll('.joypad-focus').forEach(e => e.classList.remove('joypad-focus'));
      selected.classList.add('joypad-focus');
      selected.focus({ preventScroll: true });
      if (command.confirm) selected.click();
    }
  }

  private currentSaved() {
    return this.preferences.library.find(item => `user:${item.id}` === this.preferences.selection);
  }

  private effectiveMode(): LandscapeEditorMode {
    const id = this.preferences.selection === 'cycle'
      ? landscapeForWave(this.preferences, this.currentWave(), this.currentSeed())
      : this.preferences.selection;
    return this.preferences.library.find(item => `user:${item.id}` === id)?.mode
      ?? this.preferences.mode;
  }

  private switchMode(mode: LandscapeEditorMode): void {
    if (mode === 'advanced' && this.effectiveMode() === 'automatic') {
      // First switch copies the visible gradient; subsequent switches preserve hand-made layers.
      const visible = resolveLandscape(this.preferences, this.currentWave(), this.currentSeed()).style;
      const style = this.mutableStyle();
      if (!style.advancedEdited) style.layers = visible.layers.map(layer => ({ ...layer }));
      if (!style.advancedEdited) {
        style.skyTop = visible.skyTop;
        style.skyBottom = visible.skyBottom;
      }
    }
    this.preferences.mode = mode;
    this.commit();
    this.render();
  }

  private mutableStyle(): LandscapeStyle {
    if (this.preferences.selection !== 'custom') {
      const originalMode = this.effectiveMode();
      const current = resolveLandscape(this.preferences, this.currentWave(), this.currentSeed()).style;
      this.editingId = this.currentSaved()?.id ?? null;
      this.preferences.mode = originalMode;
      this.preferences.custom = copyLandscape(current);
      this.preferences.custom.advancedEdited = false;
      this.preferences.selection = 'custom';
      this.selection.value = 'custom';
    }
    return this.preferences.custom;
  }

  private commit(): void {
    this.preferences = sanitizeLandscapePreferences(this.preferences);
    this.updateDescription();
    this.onChange(sanitizeLandscapePreferences(this.preferences));
  }

  private updateDescription(): void {
    const { name, style } = resolveLandscape(this.preferences, this.currentWave(), this.currentSeed());
    const suffix = this.preferences.selection === 'cycle' ? ' · cambia en la siguiente oleada' : '';
    this.description.textContent = `${name} · ${style.layers.length} capas · ${this.effectiveMode() === 'automatic' ? 'gradiente automático' : 'edición avanzada'}${suffix}`;
  }

  private paintSwatches(): void {
    this.swatches.replaceChildren();
    if (this.effectiveMode() !== 'automatic') return;
    const style = resolveLandscape(this.preferences, this.currentWave(), this.currentSeed()).style;
    const colors = [
      { color: style.automatic!.skyColor, label: 'Cielo' },
      ...style.layers.map((layer, i) => ({ color: layer.color, label: `Capa de fondo ${i + 1}` })),
      ...(style.midground?.enabled ? [{
        color: decorColorForStyle(style, 'midground'), label: 'Tercer plano',
      }] : []),
      ...(style.foreground?.enabled ? [{
        color: decorColorForStyle(style, 'foreground'), label: 'Primer plano',
      }] : []),
    ];
    for (const item of colors) {
      const swatch = document.createElement('span');
      swatch.style.backgroundColor = item.color;
      swatch.title = item.label;
      swatch.setAttribute('aria-label', swatch.title);
      this.swatches.append(swatch);
    }
  }

  private moveEnvironment(id: string, to: number): void {
    const pool = this.preferences.cyclePool;
    const from = pool.indexOf(id);
    if (from < 0 || !Number.isInteger(to) || to < 0 || to >= pool.length || from === to) return;
    pool.splice(from, 1);
    pool.splice(to, 0, id);
    this.commit();
    this.renderRotationList();
  }

  private renderRotationList(): void {
    this.rotationList.replaceChildren();
    const all = allLandscapeChoices(this.preferences);
    const order = new Map(this.preferences.cyclePool.map((id, index) => [id, index]));
    const active = this.preferences.cyclePool.flatMap(id => all.filter(item => item.id === id));
    const inactive = all.filter(item => !order.has(item.id));
    const selection = this.dialog.querySelector<HTMLSelectElement>('.landscape-order-target')!;
    const position = this.dialog.querySelector<HTMLInputElement>('.landscape-order-position')!;
    const previousSelection = selection.value;
    selection.replaceChildren(...active.map(item => new Option(item.label, item.id)));
    selection.value = active.some(item => item.id === previousSelection)
      ? previousSelection : (active[0]?.id ?? '');
    position.max = String(active.length);
    position.value = selection.value ? String((order.get(selection.value) ?? 0) + 1) : '';
    for (const button of this.dialog.querySelectorAll<HTMLButtonElement>('[data-landscape-order]')) {
      button.disabled = active.length < 2;
    }
    position.disabled = active.length < 2;
    selection.disabled = active.length < 2;

    const addGroup = (items: typeof all, isActive: boolean): void => {
      if (!items.length) return;
      const section = document.createElement('section');
      section.className = 'landscape-rotation-group';
      section.dataset.group = isActive ? 'active' : 'inactive';
      const heading = document.createElement('h4');
      heading.textContent = isActive
        ? `En rotación (${items.length}) · izquierda ↓ y después derecha ↓`
        : `Fuera de la rotación (${items.length})`;
      section.append(heading);
      const columns = document.createElement('div');
      columns.className = 'landscape-rotation-columns';
      const split = Math.ceil(items.length / 2);
      for (const portion of [items.slice(0, split), items.slice(split)]) {
        const column = document.createElement('div');
        column.className = 'landscape-rotation-column';
        for (const item of portion) {
          const row = document.createElement('div');
          row.className = 'landscape-rotation-row';
          row.dataset.landscapeId = item.id;
          row.dataset.active = String(isActive);
          const label = document.createElement('label');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.dataset.landscapeId = item.id;
          checkbox.checked = isActive;
          checkbox.setAttribute('aria-label', `Incluir ${item.label} en oleadas`);
          const index = order.get(item.id);
          if (index !== undefined) {
            const number = document.createElement('span');
            number.className = 'landscape-rotation-index';
            number.textContent = String(index + 1).padStart(2, '0');
            label.append(checkbox, number);
          } else label.append(checkbox);
          const style = resolveLandscape({
            ...this.preferences, selection: item.id as LandscapeSelection,
          }, this.currentWave(), this.currentSeed()).style;
          const swatch = document.createElement('span');
          swatch.className = 'landscape-tiny-swatch';
          swatch.style.background = `linear-gradient(${style.skyTop}, ${style.layers.at(-1)!.color})`;
          label.append(swatch, document.createTextNode(item.label));
          row.append(label);
          if (index !== undefined) {
            const handle = document.createElement('button');
            handle.type = 'button';
            handle.draggable = true;
            handle.className = 'landscape-drag-handle';
            handle.dataset.landscapeId = item.id;
            handle.textContent = '⠿';
            handle.title = 'Arrastra para cambiar el orden';
            handle.setAttribute('aria-label', `Arrastrar ${item.label}`);
            row.prepend(handle);
            for (const [direction, symbol] of [['up', '↑'], ['down', '↓']] as const) {
              const button = document.createElement('button');
              button.type = 'button';
              button.textContent = symbol;
              button.dataset.move = direction;
              button.dataset.landscapeId = item.id;
              button.setAttribute('aria-label', `${direction === 'up' ? 'Subir' : 'Bajar'} ${item.label}`);
              button.disabled = direction === 'up' ? index === 0
                : index === this.preferences.cyclePool.length - 1;
              row.append(button);
            }
          }
          column.append(row);
        }
        columns.append(column);
      }
      section.append(columns);
      this.rotationList.append(section);
    };
    addGroup(active, true);
    addGroup(inactive, false);
  }

  private render(): void {
    // Never inject user-provided names as HTML; construct text-only select options.
    this.selection.replaceChildren(new Option('Rotación por oleada', 'cycle'));
    for (const item of allLandscapeChoices(this.preferences))
      this.selection.add(new Option(item.label, item.id));
    this.selection.add(new Option('Personalizado (sin guardar)', 'custom'));
    const style = resolveLandscape(this.preferences, this.currentWave(), this.currentSeed()).style;
    const automatic = style.automatic!;
    this.selection.value = this.preferences.selection;
    const effectiveMode = this.effectiveMode();
    this.mode.value = effectiveMode;
    const saved = this.currentSaved() ?? this.preferences.library.find(item => item.id === this.editingId);
    this.nameInput.value = saved?.name ?? '';
    for (const id of ['save-changes', 'rename', 'delete']) {
      this.dialog.querySelector<HTMLButtonElement>(`[data-landscape="${id}"]`)!.disabled = !saved;
    }
    this.dialog.querySelector<HTMLSelectElement>('.landscape-rotation')!.value = this.preferences.rotation;
    this.renderRotationList();
    this.dialog.querySelector<HTMLElement>('.landscape-automatic')!.hidden = effectiveMode !== 'automatic';
    this.dialog.querySelector<HTMLElement>('.landscape-advanced')!.hidden = effectiveMode !== 'advanced';

    for (const input of this.dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-auto]')) {
      const key = input.dataset.auto as keyof AutomaticLandscape;
      input.value = String(automatic[key]);
    }
    this.paintSwatches();
    for (const [plane, decor] of [
      ['foreground', style.foreground ?? DEFAULT_FOREGROUND],
      ['midground', style.midground ?? DEFAULT_MIDGROUND],
    ] as const) {
      for (const input of this.dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-${plane}]`)) {
        switch (input.dataset[plane]) {
          case 'enabled': (input as HTMLInputElement).checked = decor.enabled; break;
          case 'kind': input.value = decor.kind; break;
          case 'colorMode': input.value = decor.colorMode; break;
          case 'invertGradient':
            (input as HTMLInputElement).checked = decor.invertGradient;
            input.disabled = decor.colorMode !== 'gradient';
            break;
          case 'color':
            input.value = decorColorForStyle(style, plane);
            input.disabled = decor.colorMode === 'gradient';
            break;
          case 'opacity': input.value = String(Math.round(decor.opacity * 100)); break;
          case 'parallax': input.value = String(Math.round(decor.parallax * 100)); break;
        }
      }
    }
    for (const input of this.dialog.querySelectorAll<HTMLInputElement>('[data-sky]')) {
      const key = input.dataset.sky;
      if (key === 'skyTop') input.value = style.skyTop;
      else if (key === 'skyBottom') input.value = style.skyBottom;
    }
    for (const input of this.dialog.querySelectorAll<HTMLInputElement>('[data-common]')) {
      if (input.dataset.common === 'stars') input.checked = style.stars;
      else if (input.dataset.common === 'moon') input.checked = style.moon;
      else input.value = String(style.seed);
    }

    this.layers.innerHTML = style.layers.map((layer, i) => `
      <div class="landscape-layer" data-layer="${i}">
        <span class="landscape-layer-index">${String(i + 1).padStart(2, '0')}</span>
        <label>Tipo <select data-field="type" aria-label="Tipo de capa ${i + 1}">
          <option value="mountains" ${layer.type === 'mountains' ? 'selected' : ''}>Montañas</option>
          <option value="buildings" ${layer.type === 'buildings' ? 'selected' : ''}>Edificios</option>
        </select></label>
        <label>Color <input data-field="color" type="color" value="${layer.color}" aria-label="Color de capa ${i + 1}"></label>
        <label>Amplitud <input data-field="amplitude" type="number" min="2" max="35" value="${layer.amplitude}" aria-label="Amplitud de capa ${i + 1}"></label>
        <label>Detalle <input data-field="detail" type="number" min="1" max="100" value="${layer.detail}" aria-label="Detalle de capa ${i + 1}"></label>
      </div>`).join('');
    const count = style.layers.length;
    this.dialog.querySelector<HTMLButtonElement>('[data-landscape="add"]')!.disabled = count >= 10;
    this.dialog.querySelector<HTMLButtonElement>('[data-landscape="remove"]')!.disabled = count <= 2;
    this.updateDescription();
  }
}
