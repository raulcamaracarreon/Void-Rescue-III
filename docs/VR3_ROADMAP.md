# VOID RESCUE III — visión y ruta de desarrollo

## Norte del proyecto

Evolucionar Void Rescue II hacia un arcade de rescate 2.5D donde el usuario pueda combinar vehículos, familias de enemigos, reglas de misión y ambientes. Conservar primero la experiencia jugable actual; ampliar con cambios aislados, reversibles y probables.

## Principios acordados

1. VR2 se conserva publicado como v1.0.5, independiente. VR3 utiliza un repositorio propio después de validar su prototipo.
2. Mantener en la base la simulación, navegación, colisiones, comportamiento de enemigos, controles y oleadas; no copiar sólo los gráficos.
3. El editor permitirá ordenar rápidamente ambientes y leerlos en dos columnas **de arriba abajo en la izquierda, luego de arriba abajo en la derecha**.
4. Las capas de primer plano serán **opcionales**; podrán mostrar siluetas de árboles, rejas, cercas, edificios y otros objetos y podrán tapar visualmente al vehículo sin alterar las reglas del mundo físico.
5. Se podrá editar el contenido visual sin programar: figuras geométricas, trazos, polígonos y siluetas, selección, copia, reordenamiento, color, opacidad, posición, escala y control de paralaje.
6. Reservar JSON versionado para diseños exportables y portables; mantener datos de VR3 separados de las claves locales de VR2.

## Corte ejecutivo de continuidad — 26/10/2026

**Situación:** prototipo Void Rescue III **v0.1.0, no publicado**, separado de VR2. La base de combate, rescate, oleadas y puntuación procede de VR2 y se conserva sin reescritura. El trabajo reciente se concentró en escenarios y edición gráfica, no en los futuros perfiles de vehículos.

| Fase | Avance comprobable | Estado al corte |
| --- | --- | --- |
| 0. Arranque independiente | Repositorio, identificador y almacenamiento propios, workflows manuales | **Completada** |
| 1. Rotación de ambientes | Dos columnas, orden, arrastrar, posición exacta; pruebas funcionales previas | **Funcional**, quedan QA de teclado, pantallas estrechas y bibliotecas extensas |
| 2. Motor por capas | Primer/tercer plano, gradiente, edificios, longitud lateral, opacidad, paralaje y serialización | **Implementada**, con QA visual de vuelo/oclusión y no-colisión por cerrar |
| 3. Editor de elementos y exportación | Paint panorámico, máscaras compatibles, figuras, selección y manipulación reversible | **Incremento principal cerrado y aceptado**; JSON portable y transformación avanzada se conservan en backlog |
| 4. Vehículos y perfiles | Contrato de vehículo, helicóptero alternativo y paridad de jugabilidad | **No iniciada** |
| 5. Entidades y escenarios jugables | Nuevas amenazas, rescatables y ambientes temáticos | **No iniciada** |

**Cierre de selección (Entrega A+B):** el usuario confirmó visualmente el 26/10/2026 que tras implementar copias flotantes independientes y resolver la superposición «ahora sí funcionan correctamente las herramientas de selección». Se acepta **funcionalmente** este incremento y se considera resuelto el defecto de arrastrar píxeles del dibujo original. Antes de esa corrección, Playwright aprobó **20/20** escenarios E2E (44.7 s; Chromium automático y WebGL2). **Validación final aportada por el usuario:** después de corregir copias flotantes, `npm run build` aprobó (TypeScript y Vite), Vitest de `decor-paint` aprobó **16/16** y Playwright focalizado aprobó **8/8 (20.3 s)** en Chromium automático y WebGL2. Los **20/20 E2E (44.7 s)** corresponden a la revisión anterior. El usuario **autorizó la fusión de la rama a `main` mediante Pull Request** antes de iniciar la fase 4.

**Decisión aprobada de cierre:** se concluye el **incremento funcional principal de la fase 3** con Paint y herramientas de selección aceptados. Exportación/importación JSON, escalado/transformación avanzada y QA adicionales permanecen como backlog explícito, sin bloquear la fase 4. Tras la fusión autorizada, el próximo hito es **perfiles de vehículos**, conservando la nave de VR2 como referencia; antes de codificar el helicóptero decidir variantes dentro de la misma partida frente a modos/episodios.

## Fase 0 prioritaria — gradiente para los dos planos decorativos

**Decisión nueva (25/10/2026):** antes de ampliar los motivos o desarrollar herramientas de dibujo, los planos de primer y tercer plano deben poder derivar su color de la paleta automática de dos colores, y cada uno debe poder **invertir** ese gradiente para comprobar contrastes.

- [x] Implementado en rama `feat/decor-auto-gradient`: opción de color **manual** o **gradiente automático** para cada plano.
- [x] Implementado: inversión independiente del gradiente por plano (`invertGradient`), sin invertir el cielo ni las montañas.
- [x] Implementado: vista previa cromática al cambiar entre modos, conservando el color manual.
- [x] Implementado: persistencia y saneamiento sin sobrescribir la configuración anterior; archivos antiguos mantienen modo manual.
- [x] Añadidas pruebas unitarias y E2E para inversión, independencia y recarga.
- [x] Revisión en rama `feat/phase3-paint-editor`: reconstruir paleta en `N+2` pasos para producir dos tonos nuevos más allá del último fondo y corregir repeticiones del penúltimo color en modo inverso. Pruebas unitarias y aserciones de swatches actualizadas.
- [x] **Pruebas locales reportadas por el usuario (25/10/2026):** 14 suites / 129 pruebas unitarias aprobadas (`npm run test`) y 12/12 E2E de `tests/e2e/foreground.spec.ts` aprobadas en `chromium-auto` y `chromium-webgl2`, incluidas persistencia, gradiente normal/inverso, edificios y longitud lateral.
- [ ] Confirmar compilación `npm run build` y contraste visual real del gradiente continuado durante el vuelo; las pruebas E2E de `tests/e2e/decor-paint.spec.ts` no se incluyeron en ese último resultado.
- [ ] Revisar efecto al cambiar los dos colores originales, restauración de color manual y configuración guardada.
- [ ] Fusionar solamente cuando todo esté validado; **no usar GitHub Actions** por defecto.

**Regla cromática inicial (superada por la revisión posterior):** la versión anterior tomaba muestras fijas dentro del gradiente (75 % y 95 %), provocando duplicación o ausencia de continuidad cromática. **Regla actual en `feat/phase3-paint-editor`:** el gradiente automático se reconstruye con `N + 2` pasos cuando alguna de las dos capas decorativas utiliza color automático. Se destinan `N` a montañas/edificios y dos tonos posteriores a tercer/primer plano. El tono normal siempre se oscurece hacia delante y el inverso se aclara de forma independiente; si la dirección contradice la pendiente cromática del fondo, se usan pasos fraccionarios para no igualar el color de la penúltima capa. La paleta se mantiene dentro de los dos colores seleccionados; los estilos avanzados y manuales no se recalculan. Si ambos colores elegidos son iguales, matemáticamente no hay gradiente que extender.

**Después de esta fase 0:** cerrar la fase 2 con (1) motivo **edificios** y (2) longitud lateral configurable en ambos planos, desarrollados en `feat/decor-buildings-and-span` y todavía pendientes de verificación local. Solo iniciar la fase 3 de dibujo manual tipo Paint simplificado cuando el usuario valide ambos incrementos.

## Fases e hitos de aceptación

### 0. Arranque independiente (completado y validado para el editor de rotación)

- [x] Crear rama provisional partiendo de la mejora del editor de paisajes.
- [x] Nombre y versión de prototipo propios; claves de almacenamiento nuevas.
- [x] Eliminar el workflow de releases exclusivo de VR2 y hacer manuales los demás workflows.
- [x] Pruebas locales de rotación: 16 Playwright aprobadas y servidor Vite iniciado (confirmación del usuario).
- [x] Repositorio independiente **Void-Rescue-III** creado y copiado a su `main` (push y remotos verificados).

### 1. Editor de rotación (validación funcional confirmada)

- [x] Separar ambientes activos y excluidos.
- [x] Numerar y distribuir activos en dos columnas de flujo vertical.
- [x] Permitir arrastrar y colocar entre columnas; conservar ↑ ↓ y ofrecer posición exacta/inicio/final.
- [ ] Comprobar vista estrecha, teclado, puntero y casos de biblioteca extensa.
- [ ] Probar recarga, selección secuencial vs aleatoria y preservación de paisajes personalizados.

### 2. Motor visual por capas (edificios y longitud implementados en rama; falta validación)

- [x] Capa **opcional** visual de primer plano en `ForegroundDecor.ts`, con motivos de árboles, cercas y rejas.
- [x] Geometría procedural repetible en mundo circular; desplazamiento configurable por paralaje; recursos compartidos para tres copias contiguas.
- [x] Control de activación, motivo, color, opacidad y factor de paralaje desde el editor existente. Datos almacenados dentro de cada estilo personalizado; presets sin modificación.
- [x] Conservar `Terrain`, las colisiones y la simulación sin cambios: sólo `WorldScene` vincula la capa visual.
- [x] Añadir pruebas unitarias de serialización/saneamiento y generación determinista; E2E de persistencia y biblioteca.
- [x] Usuario confirmó pruebas de primer plano aprobadas y visualización correcta (rama `feat/foreground-layers`).
- [x] Añadir **tercer plano** con profundidad entre el vehículo (z=0) y la montaña/edificio más próximo (z=-31); reutiliza los motivos con configuración y semilla independientes.
- [x] Mantener primer plano en z=19, tercer plano en z=-18; mezcla transparente por orden explícito sin cambiar colisiones.
- [x] Extender persistencia, saneamiento y pruebas para ambos planos; antiguo campo `foreground` permanece válido y `midground` se inicializa desactivado en guardados anteriores.
- [x] Compilación `npm run build` correcta (TypeScript + Vite), 118/118 pruebas unitarias y 24/24 E2E Playwright completadas en `chromium-auto` y `chromium-webgl2` (resultados de la terminal del usuario, 25/10/2026).
- [ ] Revisión visual manual de ambos planos durante el vuelo: superposición delante/detrás de los vehículos, fondo, paralaje, oclusión y rendimiento. El proyecto de navegador `chromium-auto` no confirma por sí solo que se utilizara WebGPU.
- [x] **Código en rama `feat/decor-buildings-and-span`**: motivo «Edificios» procedurales y deterministas para ambos planos. No son elementos jugables ni colisionables.
- [x] **Código en la misma rama**: «Longitud lateral (%)» independiente (5–100 %) para cada plano. El porcentaje define la franja ocupada en cada vuelta del mundo circular, partiendo de x=0; el resto permanece sin decoración. Los motivos se distribuyen sin deformarse ni estirarse.
- [x] Persistencia y migración: los paisajes guardados sin `spanPercent` mantienen un ancho del 100 %; los controles manuales e inversión de gradiente no cambian.
- [x] Pruebas unitarias y E2E añadidas para edificios, franja truncada, valores inválidos, independencia y recarga.
- [ ] Validación local: `npm run build`, `npm run test` y Playwright en `feat/decor-buildings-and-span`; vuelo visual para confirmar tramos vacíos, transición al recorrer el mundo y color/oclusiones.
- [ ] Editor de trazos, polígonos, siluetas y objetos individuales: fase 3. Por ahora «editable» significa controles de motivo, color, longitud, opacidad y paralaje por plano.
- **Aceptación pendiente:** probar que activar y desactivar las rejas/árboles no altera impactos, rescates ni avance de oleada en una partida real.

### 3. Editor de elementos y exportación (primer incremento con pruebas automatizadas aprobadas)

**Primera entrega en `feat/phase3-paint-editor`:**
- [x] Opacidad de ambos planos ampliada de 85 % a **100 %**, con validación y prueba explícita.
- [x] Motivo `drawing` con máscara de bits monocroma v1, independiente por plano y guardado dentro de cada paisaje. Cuatro resoluciones válidas: 96 × 32, 192 × 64, **288 × 96 inicial** y 384 × 128; lectura retrocompatible de máscaras antiguas de 96 × 32.
- [x] Ventana de edición estilo Paint: pincel, borrador, línea, rectángulo, limpiar, deshacer/rehacer y cancelar/aplicar.
- [x] Geometría visual 2.5D a partir de píxeles, con color/opacidad/paralaje existentes; sin interacción con colisiones.
- [x] **Corrección de repetición (25/10/2026):** tamaño del motivo fijo en el mundo (150 × 50 unidades), repetición horizontal dentro de `spanPercent`, recorte geométrico únicamente de la última copia. Geometría compartida entre repeticiones y las tres copias del mundo; no se estira la imagen.
- [x] Selector de cuatro resoluciones con **288 × 96 por defecto**, redimensionado vecino más cercano para dibujos existentes y cambios de resolución reversibles en el historial. Sin migraciones destructivas de paisajes guardados.
- [x] Pruebas de tamaños, compatibilidad, mosaicos geométricos, recorte de borde y cambios de resolución en editor añadidas y **aprobadas localmente** (26/10/2026).
- [x] Saneamiento acotado de máscaras y copia profunda entre paisajes; tests unitarios + Playwright añadidos.
- [x] **Validación local reportada por el usuario (26/10/2026):** `npm run build` correcto (TypeScript y Vite); `npm run test`: 14 archivos y **131/131 pruebas** aprobadas; `npx playwright test tests/e2e/decor-paint.spec.ts`: **6/6 pruebas** aprobadas en `chromium-auto` y `chromium-webgl2`, incluyendo resolución predeterminada 288×96, cambio de resolución, cancelación, deshacer/rehacer, opacidad 100 %, persistencia y dos planos.
- [ ] Inspección visual manual en una partida: repetición sin estiramiento, unión entre motivos, recorte del último mosaico, paralaje y oclusión, al 100 % y 23 % de longitud lateral. Las pruebas automatizadas no sustituyen este paso.
- [x] **Ampliación del lienzo panorámico (26/10/2026):** se agregan tamaños 512 × 64, 1024 × 128 y **2048 × 256 inicial** (formato 8:1). Las cuatro resoluciones antiguas 3:1 se conservan. Los motivos panorámicos miden 400 × 50 unidades del mundo; se repiten al terminar su ancho, no cada 150 unidades, y conservan su proporción durante el vuelo.
- [x] **Herramientas nuevas codificadas:** círculo/elipse, triángulo, polígono por vértices con cierre y relleno, rellenar rectángulos y formas, grosor de pincel/borrador de 1 a 32 píxeles, zoom de 1× a 8× y lienzo desplazable.
- [x] **Persistencia compacta codificada:** máscaras v1 con filas de texto siguen cargándose; se serializan como bitset Base64 v2 (1 bit por píxel), con saneamiento del tamaño máximo al recuperar datos. Deshacer/rehacer y redimensionar mantienen compatibilidad. El remuestreo conserva proporciones al cambiar entre lienzos 3:1 y 8:1.
- [x] Pruebas unitarias de formas, resolución panorámica, tiling, conversión de arte anterior, bitset compacto y navegación del lienzo añadidas al código.
- [x] **Ampliación panorámica validada en Playwright (26/10/2026):** tras corregir el selector de estado ambiguo y el zoom inicial, el usuario ejecutó `npx playwright test tests/e2e/decor-paint.spec.ts` y obtuvo **10/10 pruebas aprobadas (24.1 s)** en `chromium-auto` y `chromium-webgl2`. Confirma opacidad 100 %, edición y persistencia de los dos planos, cancelar, deshacer/rehacer, resolución inicial 2048 × 256, cambios de resolución, dibujo en el extremo derecho, zoom, grosor, elipse, triángulo y polígono relleno.
- [x] **Corrección de círculo/triángulo (26/10/2026):** tras la aceptación de las 10 E2E anteriores, la inspección manual reveló que círculo y triángulo actuaban como pincel. La causa se confirmó en `DecorPaintEditor.extend()`: solo `line` y `rectangle` usaban la instantánea original. Ahora únicamente pincel/borrador acumulan tramos; todas las figuras geométricas (incluidas círculo/triángulo) se reconstruyen desde la instantánea inicial. Se añadió una prueba E2E de relleno real fuera de la diagonal. **Validado localmente el 26/10/2026:** el usuario ejecutó dos veces `npx playwright test tests/e2e/decor-paint.spec.ts -g "círculo y triángulo rellenos"`; en cada ejecución **2/2 pruebas aprobadas** (`chromium-auto` y `chromium-webgl2`, 7.2 s y 6.8 s). **Validación visual manual del editor confirmada por el usuario el 26/10/2026:** «Perfecto, ahora todo funciona bien». El fallo específico de círculo/triángulo se considera cerrado.
- [x] **Aceptación manual del editor Paint (26/10/2026):** el usuario confirmó que las herramientas revisadas funcionan después del parche de círculo/triángulo. Se autoriza integrar el incremento a `main` y retomar el desarrollo, sin declarar finalizada toda la fase 3.
- [ ] **Vigilancia de integración posterior:** costuras del mundo circular, oclusión/paralaje en todos los ajustes y rendimiento con bibliotecas grandes. No implica bloquear la integración aceptada; anotar incidencias concretas si aparecen.
**Incremento siguiente en desarrollo — rama `feat/phase3-selection-tools` creada desde el merge de Paint en `main` (`6ae999a`, 26/10/2026): selección y manipulación 2D de máscaras, sin modificar combate o rescate.**

**Entrega A — selección segura:** herramienta «Seleccionar» con arrastre de rectángulo visible, coordenadas fieles al zoom y al desplazamiento del lienzo; «Cancelar selección» no modifica el dibujo. La selección no se persiste como parte del paisaje.

**Entrega B — manipulación reversible:** mover zona, copiar, pegar, duplicar, cortar y borrar, con clipping en límites del bitmap, transparencia y un paso de deshacer por operación. El portapapeles es del editor (sin permisos del sistema) y los datos de cada plano siguen aislados.

**Criterio de aceptación:** probar selección, movimiento, duplicación, cancelación y deshacer en resolución panorámica 2048×256 y antigua 96×32; Playwright tanto en Chromium automático como WebGL2. No ejecutar GitHub Actions ni fusionar esta rama sin pruebas locales y aceptación del usuario.
- [x] **Entrega A codificada en `feat/phase3-selection-tools`:** opción «Seleccionar región», arrastre en ambas direcciones, cuadro delimitador amarillo semitransparente (no se guarda en bitmap), cancelación por botón/Escape, lectura de coordenadas y dimensiones, saneamiento de límites para 96×32 y 2048×256 y conservación de máscara e historial. Al cambiar de herramienta o resolución se descarta la selección visual para evitar interpretaciones erróneas.
- [x] **Entrega B codificada en la rama (pendiente de pruebas locales):** portapapeles interno por sesión/plano; copiar, cortar, pegar, duplicar y borrar una región; mover arrastrando dentro de la selección o con flechas/botones; deshacer/rehacer para cada operación, clipping/control de límites y transparencia de píxeles vacíos al pegar. Los desplazamientos usan la imagen anterior para evitar estelas o pérdida de tinta al superponerse.
- [x] Las operaciones de píxeles quedan registradas de forma reversible; cancelar selección sigue siendo una operación visual sin modificar píxeles. La selección se limpia al cambiar de herramienta o resolución y tras deshacer; el portapapeles no se comparte entre planos.
- [x] Se agregaron pruebas unitarias de límites, selección invertida, píxel individual e inmutabilidad y pruebas E2E de selección en panorama, cancelación, zoom/scroll en 96×32 y Escape.
- [x] **Resultados locales de primera validación (26/10/2026):** `npm run build` completó TypeScript y Vite; Vitest confirmó **1 archivo de pruebas aprobado** para `decor-paint`; Playwright completó **12/16 pruebas**, con cuatro fallos en dos escenarios duplicados entre `chromium-auto` y `chromium-webgl2`: selector ambiguo de botón «Cancelar» y Escape sin cancelar la selección después de cambiar el zoom. El historial mostraba correctamente 1 paso por cambio de resolución.
- [x] **Correcciones subidas a la rama:** botón «Cancelar» con `exact: true` en E2E; interceptación de Escape en fase de captura para evitar que el `<select>` activo consuma la tecla; prueba que conserva el paso de deshacer generado por resolución y no exige que quede deshabilitado.
- [x] **Correcciones E2E validadas localmente (26/10/2026):** el usuario actualizó la rama por fast-forward y ejecutó `npx playwright test tests/e2e/decor-paint.spec.ts -g "cancelar no cambia|la selección conserva"`: **4/4 pruebas aprobadas (9.3 s)**, dos escenarios en `chromium-auto` y `chromium-webgl2`. Se consideran resueltos el selector ambiguo de «Cancelar» y el manejo de Escape tras zoom. La primera ejecución general fue 12/16; no afirmar que la batería completa se haya reejecutado tras el parche.
- [x] **Entrega A aceptada visualmente por el usuario (26/10/2026):** «ok funciona conforme lo esperado» tras comprobar la selección rectangular y cancelación. Se cierra A y se pasa a B.
- [x] **Pruebas añadidas para Entrega B:** casos unitarios de copia, borrado/corte, pegado transparente, movimiento con solapamiento, inmovilidad de origen y límites tanto en 96×32 como en 2048×256; E2E para copiar/duplicar/cortar/pegar/borrar en dibujo antiguo y arrastre de región en panorama.
- [x] **Validación automatizada de la Entrega B previa a la corrección (26/10/2026):** el usuario confirmó `20 passed (44.7s)` en Playwright (10 escenarios en `chromium-auto` y 10 en `chromium-webgl2`), así como la aprobación de compilación y pruebas unitarias de la ejecución solicitada.
- [x] **Defecto detectado en revisión manual:** una copia duplicada quedaba fusionada con píxeles existentes al superponerse; mover la selección arrastraba también partes del dibujo anterior. Las 20 E2E anteriores no verificaban este caso.
- [x] **Corrección codificada y validada:** copia/pegado ahora conserva temporalmente un fragmento **flotante** y la máscara de fondo previa. Cada traslado recompone desde ese fondo en vez de recoger lo que quedó debajo de la copia; al cancelar selección, cambiar herramienta o aplicar dibujo se consolida el bitmap. Deshacer/rehacer preservan la procedencia de la copia flotante y la posición seleccionada. Añadida indicación «copia flotante» en el editor.
- [x] **Regresión añadida:** pruebas unitarias en lienzos 96×32 y 2048×256 para restaurar fondo y evitar copias fantasma, y dos escenarios E2E nuevos para duplicado superpuesto y movimiento posterior a deshacer/rehacer (ambos backends).
- [x] **Aceptación visual posterior al parche (26/10/2026):** el usuario confirmó que las herramientas de selección funcionan correctamente después de corregir el duplicado flotante superpuesto. Se cierra funcionalmente la Entrega B y se retoma el plan general.
- [x] **Evidencia automatizada del parche final (26/10/2026):** build TypeScript/Vite aprobado; **16/16** pruebas unitarias de `decor-paint`; **8/8** E2E focalizadas (20.3 s), incluidas copia superpuesta, restauración del fondo y undo/redo en Chromium automático y WebGL2. No atribuir las 20/20 E2E anteriores a este parche.
- [ ] **Después:** escala/rotación física de objetos, ajustes de dimensiones independientes del raster y exportación/importación JSON versionada.

- [ ] Herramientas posteriores: selección de objetos/píxeles, copiar/duplicar, desplazar y escala física independiente del motivo; todavía no hay editor de vectores ni lienzo de tamaño libre.
- [ ] Exportación e importación JSON versionada y validada, separada de nombres HTML y datos ejecutables.
- [ ] Validar visualmente edición en dos planos, mundo circular, transparencia 100 %, opacidad, gradiente normal/inverso y restauración por oleada.

**Aceptación del primer incremento:** crear dibujos distintos para primero y tercero, cancelar sin cambios, deshacer y rehacer, aplicar, guardar en la biblioteca y recuperar después de recargar. La fase 3 completa se cerrará solamente tras terminar los puntos restantes.

### 4. Vehículos y perfiles de movimiento (iniciada en rama `feat/phase4-vehicle-profiles`)

**Primer incremento técnico — contratos de vuelo (27/10/2026):**
- [x] Inspección de `Simulation.ts`, `config.ts`, `models/Ship.ts`, `Renderer.ts`, `GameApp.ts` e integración de combate/rescate. El núcleo ya separa simulación, render y entradas.
- [x] `src/game/VehicleProfile.ts` define `VehicleId`, `VehicleProfile`, navegación del perfil actual, parámetros de vuelo (aceleración, resistencia, velocidad horizontal/vertical y respuesta vertical) y parámetros de proyectil (velocidad y posición de salida).
- [x] **Nave heredada:** `SHIP_PROFILE` utiliza exactamente las constantes de `CONFIG`, mantiene las fórmulas, y sigue siendo la selección predeterminada en todas las instancias de `GameApp` y pruebas anteriores.
- [x] **Helicóptero experimental sin selección en interfaz:** `HELICOPTER_PROFILE` propone dinámica horizontal más lenta, mayor resistencia y respuesta vertical más progresiva. Únicamente se puede usar al instanciar explícitamente `Simulation` con el séptimo argumento; `Renderer.ts` todavía dibuja la nave. No es un helicóptero jugable final ni un vehículo habilitado para usuarios.
- [x] `Simulation.ts` consume el perfil en las ecuaciones de movimiento y lanzamiento de proyectiles, sin tocar sistemas de puntuación, enemigos, rescate, oleadas, controles ni el modelo 3D.
- [x] Añadidas cuatro pruebas unitarias específicas: paridad del perfil nave con las constantes heredadas, primer paso matemático idéntico, dinámica alternativa y determinismo del prototipo.
- [ ] **Validación local pendiente:** `npm run build`, `npx vitest run tests/unit/core.test.ts tests/unit/vehicle-profiles.test.ts` y regresión mínima de vuelo. No se ejecutaron pruebas locales desde GitHub; no dar el incremento por validado.
- [ ] **Próxima entrega:** modelo visual 3D del helicóptero, contrato de render compartido, parámetros de interacción/rescate y entrada de selección antes de partida. No activar el helicóptero para jugadores ni alterar récords/comparabilidad hasta verificar paridad.
- [ ] **Decisión de producto pendiente de confirmar:** variantes elegibles dentro del mismo juego (propuesta preferida para reutilizar reglas) frente a modos/episodios separados. El incremento técnico es compatible con ambas y no impone la decisión.

### 4. Vehículos y perfiles de movimiento

- Un contrato común de vehículo (modelo visual, movimiento, armas, capacidad, sonido, acciones).
- Primer perfil alternativo: helicóptero de rescate con parámetros propios de ascenso, descenso, inercia y recogida.
- Mantener intacta la nave de VR2 como perfil de regresión hasta alcanzar paridad.
- Aceptación: mismo objetivo jugable con una nave o un helicóptero sin duplicar el sistema de puntuación/oleadas.

### 5. Nuevas entidades, familias de enemigos y escenarios (pendiente)

- Helicópteros enemigos, drones, aviones y defensas terrestres como familias configurables.
- Colonos y soldados de rescate como variaciones visuales/funcionales justificadas.
- Ambientes temáticos: selva, desierto, costa, montaña, ciudad, industria y variantes futuristas.
- Aceptación: escenario completo con helicóptero, soldados, tres amenazas distintas y paisaje con primer plano opcional.

## Decisiones abiertas

La edición de primer plano puede comenzar con objetos vectoriales 2D extruidos/representados en Three.js, sin incorporar un editor complejo o un motor externo. Antes de pasar a la fase 4 se validará con el usuario si prefiere *variantes dentro de un mismo juego* o modos/episodios separados.

## Calidad

No declarar una fase terminada por compilar: ejecutar TypeScript, unitarias, E2E Playwright (WebGPU y WebGL2 cuando estén disponibles), comprobar visualmente el panel y confirmar persistencia. Documentar fallos o pruebas no ejecutadas sin suponer resultados.
