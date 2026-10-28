# VR3 — arquitectura objetivo (diseño, no implementación)

## Estado de partida

VR3 arranca del código de Void Rescue II: TypeScript estricto, Vite, Three.js, simulación 2D de paso fijo 60 Hz, escena 2.5D, WebGPU con WebGL2 de respaldo, pruebas Vitest y Playwright. El refactor será **incremental**.

El sistema actual usa `src/game/` para simulación y reglas, `src/render/` para la escena, `src/landscape/` para fondos y preferencias, `src/ui/` para controles y `src/audio/` para sonido. No reemplazar sus contratos hasta agregar pruebas de equivalencia.

## Separaciones futuras propuestas

- **Game Core** (sin Three.js): movimiento, físicos, entidades, daño, misiones, rescates, oleadas y puntuación. Conserva determinismo y geometría circular.
- **Perfiles jugables de vehículo:** parámetros de inercia, ascenso, armas, forma de rescate y animaciones. La nave actual es el perfil de referencia.
- **Catálogo de entidades:** geometría/modelos, animaciones, sonidos y lógica específica de amenazas. Evitar una clase monolítica por tipo.
- **World Render**: escena, cámara, capas, materiales, paralaje y oclusión. No convertir objetos decorativos en colisiones salvo opt-in explícito y probado.
- **Editor y serialización:** herramientas simples, formatos versionados, validación de entradas, guardar/cargar/exportar sin acoplar la UI al renderizador.

## Modelo conceptual de escena

```text
Escena 2.5D
├── Cielo y atmósfera
├── Fondos de paralaje (lejanos → cercanos; hasta z=-31)
├── Tercer plano decorativo opcional (z=-18, paralaje más lento)
├── Mundo jugable (vehículos z=0, terreno y personajes)
└── Primer plano decorativo opcional (z=19, paralaje más rápido)
```

Una capa visual debería definir como mínimo: `id`, `name`, `enabled`, `depthOrder`, `parallaxFactor`, `opacity`, `objects` y `schemaVersion`. Son campos propuestos, **no tipos ya codificados**. Un objeto editable podrá ser rectángulo, línea, polígono o trazo. La topología envolvente debe respetar la costura horizontal del mundo circular.

## Requisitos clave

- Mantener rendimiento estable: construir geometría cuando cambia el diseño, no por cada frame; reutilizar materiales cuando sea viable.
- Mantener legibilidad: los primeros planos pueden ocultar parte de la acción; permitir ocultarlos globalmente, regular opacidad y reservar una opción de accesibilidad.
- Identificar y preservar el estado de los mundos creados por el usuario; nunca borrar automáticamente una biblioteca por migración.
- Separar `localStorage` de VR3 del de VR2; futura exportación/importación explícita. Asegurar validación y límites de tamaño.
- Añadir pruebas de occlusion/paralaje, no colisión de decorativos, persistencia y rendimiento tras crear múltiples objetos.

## Primer contrato para el editor (propuesta)

Orden visual de controles: biblioteca → rotación de ambientes → editor de fondo → primer plano → vista previa → exportación. El editor de dibujo debe permitir alternar herramientas sin detener la simulación, pero sus modificaciones se aplicarán como cambios visuales controlados, no como mutaciones directas sobre entidades de juego.

**Dos capas decorativas codificadas, probadas previamente en `feat/dual-decor-layers`, ampliadas en `feat/decor-buildings-and-span` (pendiente de validación nueva):** `src/render/ForegroundDecor.ts` genera siluetas con recursos compartidos en dos instancias independientes de `WorldScene`. `LandscapeStyle.foreground` conserva el primer plano legado y `LandscapeStyle.midground` añade el tercero, con controles independientes de motivo, color, opacidad, paralaje y activación. Ambos se guardan por ambiente. Los presets antiguos heredan un tercer plano desactivado y mantienen el primer plano. El editor de dibujo libre y objetos personalizados permanece planeado para la fase 3.


## Incremento de edificios y longitud lateral — fase 2

- `DecorLayerConfig.kind` incorpora `buildings`: perfiles rectangulares de altura y anchura variadas, coronamientos y antenas, determinados exclusivamente por la semilla visual.
- `DecorLayerConfig.spanPercent` (5–100; por defecto 100) controla el ancho ocupado del mundo circular `CONFIG.worldWidth = 2400`. Se construye geometría sólo en el tramo inicial, empezando por x=0; el área restante queda vacía, sin escalar rectángulos ni árboles.
- El patrón se repite en coordenadas del mundo circular con las tres copias del renderizador. La posición inicial de la franja (desplazamiento lateral) podrá convertirse después en objeto editable de la fase 3; **no está implementada**.
- El valor se serializa en `LandscapeStyle.foreground` o `LandscapeStyle.midground` sin afectar a la simulación ni las colisiones. Los mundos antiguos que no tienen ese campo se recuperan con 100 %.
- Esta edición paramétrica **no equivale** al editor manual tipo Paint, ni permite dibujar elementos individuales. Esas herramientas permanecen exclusivamente en la fase 3.


## Fase 3 — primera entrega de dibujo raster (pendiente de validación local)

- `src/landscape/LandscapeConfig.ts`: `DecorBitmap` v1 (filas binarias; resoluciones 96 × 32, 192 × 64, 288 × 96 por defecto, 384 × 128), `kind:'drawing'`, validación estricta, datos opcionales y copia profunda por plano/paisaje. No importa HTML ni scripts.
- `src/landscape/DecorDrawing.ts`: operaciones puras para pincel, borrador, línea Bresenham y rectángulo; independientes del DOM, Three.js y simulación.
- `src/ui/DecorPaintEditor.ts`: diálogo Paint con lienzo pixelado, puntero, vista previa, 30 estados máximos de deshacer y rehacer, aplicar y cancelar. No altera el estado del juego hasta aplicar.
- `src/ui/LandscapePanel.ts`: botones de edición separados para primero y tercero. Al aplicar, guarda la máscara en el estilo personalizado y activa `kind:'drawing'`; los motivos procedurales se preservan como alternativas.
- `src/render/ForegroundDecor.ts`: convierte tramos horizontales de píxeles pintados en rectángulos Three.js en z=19 / z=-18. Colorea todo mediante los parámetros del plano (manual/gradiente/inversión/opacidad 10–100 %, paralaje y longitud). El motivo tiene 150 × 50 unidades de mundo, repite su geometría compartida por los tres mundos adyacentes y se recorta geométricamente en la última repetición sin escalar horizontalmente la silueta. El cambio de resolución usa vecino más cercano. El escalado físico libre permanece pendiente.
- Conserva los 2400 puntos del mundo circular; ningún píxel crea colisión. Los datos guardados anteriores no tienen `bitmap` y siguen usando los motivos de antes.
- **Pendientes:** selección, polígonos, formas compuestas y transformables, escala física editable, ajuste libre de dimensiones, importación/exportación JSON de dibujos, pruebas de rendimiento y aceptación visual. Esta implementación inicia pero no completa toda la fase.


## Revisión cromática — extensión del gradiente automático (rama de fase 3)

- `buildAutomaticLandscape` reserva **N+2 pasos** desde `skyColor` hasta `frontColor` cuando una capa decorativa *habilitada* usa `colorMode:'gradient'`. Las N capas del fondo pasan a muestrearse en `i/(N+2)` y las dos reservas posteriores se dedican a tercer plano y primer plano.
- `decorColorForStyle` toma las dos últimas capas **reales** del fondo y deriva un paso de RGB por canal. El tercer plano progresa un paso hacia mayor contraste y el primer plano dos. Se fuerza una progresión hacia tonos más oscuros en modo normal y hacia más claros en inverso; pasos fraccionarios evitan igualar la penúltima capa cuando se invierte la pendiente del fondo.
- Los colores generados por el modo automático permanecen dentro de los **dos extremos escogidos**. Si los colores son iguales, no existe rango cromático del que extraer tonos distintos. En estilos avanzados, las capas dibujadas manualmente no se reescriben.
- La vista previa en `LandscapePanel.paintSwatches` utiliza la resolución cromática compartida por `WorldScene`, de modo que muestra N colores de fondo más los tonos de los planos activos.
- El esquema persistido `LandscapeStyle` **no cambia**. `colorMode`, `invertGradient`, los tonos manuales y los mapas de bits permanecen iguales.
- Estado: cambios implementados y pruebas adaptadas, **pendientes de ejecución y aceptación visual local**. No fusionar a `main` sin comprobación.

## Corrección de fase 3 — resolución y repetición sin estiramiento (25/10/2026)

- `DECOR_BITMAP_WIDTHS` admite exactamente `[96,192,288,384]`, con alturas correspondientes `[32,64,96,128]` en formato 3:1. `blankDecorBitmap()` devuelve 288 × 96, mientras que `sanitizeDecorBitmap()` admite también los tres tamaños alternativos y preserva el formato v1.
- `resizeDecorBitmap` hace remuestreo *nearest-neighbor* sin tocar la fuente; un cambio de resolución cuenta como paso para deshacer/rehacer. `Limpiar` conserva la resolución elegida.
- `drawingMotifWidth` equivale a 150 unidades del mundo para las cuatro resoluciones, con altura constante de 50 unidades. `ForegroundDecor` crea una geometría por motivo (compartida), una geometría secundaria solo si el último mosaico requiere recorte, y tres grupos del mundo circular que contienen copias ligeras del motivo.
- `spanPercent` define la franja **ocupada por repeticiones**, no el ancho del motivo. Esto mantiene los objetos sin deformaciones y permite que un dibujo de 288 × 96 tenga el mismo tamaño físico que uno de 96 × 32, pero mayor detalle.
- Limitación actual: no hay control de escalado físico del motivo ni importación/exportación; los dibujos grandes en muchas bibliotecas podrían alcanzar el límite de almacenamiento del navegador. Conservar y no sobrescribir la biblioteca en migraciones.
- Pruebas añadidas para los cuatro tamaños, máscaras v1 antiguas, tesselación, recorte final y recuperación desde la UI; pendientes de verificación local.


## Incremento panorámico y herramientas Paint (26/10/2026)

- El alto físico del motivo sigue siendo 50 unidades del juego. Los dibujos antiguos 3:1 usan 150 unidades de ancho, mientras que los nuevos dibujos **8:1** (512×64, 1024×128 o 2048×256) miden **400 unidades**. La vista habitual de juego tiene alrededor de 200 unidades de ancho (112 de alto × relación de aspecto aproximadamente 16:9); por ello, un árbol al inicio del motivo no se repite dentro de esa misma pantalla típica.
- El renderizador mantiene geometría compartida, recorte de la última repetición y tres instancias para la topología circular de 2400 unidades, sin colisiones nuevas. La longitud lateral sigue definiendo el tramo del mundo que se decora.
- `DecorDrawing.ts`: dibujo de líneas, círculos/elipses, triángulos, rectángulos, polígonos cerrados y rellenos por scanline; grosor configurable para pincel y trazos. El usuario coloca vértices sucesivos y pulsa «Cerrar polígono».
- `DecorPaintEditor.ts`: selector 8:1 (2048×256 predeterminado para dibujos nuevos), zoom 1/2/4/8×, controles de grosor/relleno y área desplazable con el contenido de mayor resolución. Los dibujos guardados conservan su dimensión al reabrirse.
- `LandscapeConfig.ts`: representación interna v1 (`rows` binarias) con serialización JSON v2 compacta por bitset Base64; no se fuerza migración al abrir los archivos antiguos. Se valida explícitamente longitud, caracteres y dimensiones antes de descomprimir datos.
- Al transformar entre formatos de proporción 3:1 y 8:1, el dibujo se mantiene en escala proporcional: se agrega espacio transparente lateral cuando corresponde y se alinean verticalmente los motivos más pequeños hacia el suelo. El remuestreo de reducción conserva los píxeles pintados para evitar pérdida de líneas finas.
- Límite deliberado de 2048×256 para evitar lienzos demasiado grandes antes de una evaluación de rendimiento y de almacenamiento en bibliotecas extensas.
- **Estado:** código implementado, pruebas nuevas añadidas y **pendiente de ejecución local**; no declarar la ampliación validada ni fusionar todavía.


## Cierre de las herramientas de selección — fase 3 (26/10/2026)

- `DecorDrawing.ts` incorpora funciones puras para seleccionar, copiar, borrar, pegar y mover regiones, limitadas al lienzo y con pegado transparente.
- `DecorPaintEditor.ts` incorpora seleccionar, cortar, pegar, duplicar, mover con arrastre/flechas y deshacer/rehacer. El portapapeles es interno a cada sesión/plano.
- Para evitar que una copia solapada arrastre píxeles antiguos, el editor conserva temporalmente una **copia flotante**: bitmap base anterior, máscara del fragmento y posición. Al moverla, recompone desde esa base. Se consolida al deseleccionar, cambiar herramienta o aplicar; no se persiste como una capa nueva ni cambia la serialización.
- **Validación:** aceptación visual; `npm run build` aprobado; **16/16** Vitest y **8/8** E2E focalizadas tras el último parche, en ambos backends. Las **20/20** E2E generales pertenecen a la iteración previa a la corrección.
- Se cierra el incremento funcional de Paint/selección. Permanecen en backlog escalado/transformación avanzada, exportación/importación JSON versionada y QA de accesibilidad, oclusión y rendimiento. Próximo hito: **fase 4, perfiles jugables de vehículos**, sin reescribir física, rescate o puntuación.


## Fase 4 — contrato de perfiles de movimiento (primer incremento, 27/10/2026)

**Inventario de dependencias reales:** `src/game/Simulation.ts` implementa dinámica horizontal/vertical y disparo usando constantes de `src/game/config.ts`. `GameApp.ts` crea las simulaciones al entrar al menú, iniciar, reiniciar y cargar un escenario de diagnóstico. `src/render/Renderer.ts` usa `createShip()` de `models/Ship.ts` como representación visual independiente. `src/game/combat` mantiene combate, daño, rescate, puntuación y oleadas; `InputManager` entrega los mismos ejes y acciones para cualquier perfil.

**Contrato introducido:** `src/game/VehicleProfile.ts` define identificadores `ship` y `helicopter`, con parámetros `flight` (`acceleration`, `drag`, `maxSpeed`, `verticalSpeed`, `verticalResponse`) y `weapon` (`projectileSpeed`, `muzzleOffset`). `Simulation` recibe opcionalmente `selectedVehicle` en la posición final de su constructor, predeterminada a `ship`. `FlightState.vehicleId` registra la identidad. La nave conserva literalmente los valores y cálculos de la versión anterior para no alterar jugabilidad ni clasificación.

El helicóptero **solo es una propuesta de dinámica simulable en pruebas unitarias**. No existe todavía modelo 3D, HUD de selección, sonidos específicos, mecánica diferenciada de rescate ni compatibilidad jugable demostrada; el jugador sigue viendo y controlando la nave predeterminada. No introducirlo como opción visible antes de integrar y probar la representación coherente. Los sistemas de rescate/oleadas y colisiones todavía no diferencian vehículos; la fase 4 debe abstraerlos de manera incremental y conservar la nave como referencia. La decisión variantes dentro de un juego frente a episodios independientes permanece abierta.

**Pruebas incorporadas pero aún no ejecutadas localmente:** `tests/unit/vehicle-profiles.test.ts` y regresión `core.test.ts`. Compilación y E2E de vuelo pendientes.


## Fase 4 — incremento 2: helicóptero 3D experimental (27/10/2026)

`src/render/models/Helicopter.ts` crea un helicóptero 2.5D de geometría Three.js: fuselaje, cabina, puerta lateral, rotor principal horizontal (grupo independiente con giro Y), rotor de cola (giro Z), patines y detalles de rescate. `animateHelicopter` limita el avance por fotograma y respeta `reducedMotion`. No cambia la física ni crea colisiones nuevas. `FlightRenderer` carga el modelo **de manera diferida** solo al seleccionar `vehicleId: 'helicopter'` en el estado de la simulación, posiciona/orienta el modelo elegido en el mundo circular y oculta la nave clásica durante su uso. `reset` restaura rotor y visibilidad sin mostrar ambos modelos.

El acceso experimental se limita a la API diagnóstica DEV: `window.__VOID_RESCUE__.loadScenario('flight-basic', seed, 'helicopter')`. El menú normal sigue creando `Simulation` con vehículo `ship`; no se permite selección por jugadores ni se registran puntuaciones clasificadas en el diagnóstico. `FlightRenderer.metrics()` diferencia identidad de perfil (`vehicleId`) y modelo realmente visible (`renderedModel`). La API pública de partida, entrada y guardado permanece intacta.

Pruebas codificadas y **pendientes de ejecución local**: `tests/unit/helicopter-model.test.ts` (3 escenarios), `tests/e2e/vehicle-visual.spec.ts` (2 escenarios por backend), además de regresión `tests/e2e/flight.spec.ts`. El próximo incremento de producto requiere contrato de rescate/armas, modelos comparables, selección previa a partida y revisión visual.


## Fase 4 — corrección visual y física del helicóptero (27/10/2026)

La validación visual del usuario mostró que el primer helicóptero experimental era demasiado pequeño/ovoide, lento y no podía bajar hasta el terreno en `flight-basic`. Las primeras pruebas de vuelo de la nave no detectaban estas diferencias porque comprobaban la ruta heredada.

Se sustituyó el modelo de `models/Helicopter.ts` por un modelo 2.5D **utilitario facetado** (silueta inspirada en helicópteros tipo Black Hawk, con geometría propia): fuselaje angular en vez de esferas, cristales laterales y parabrisas inclinados, turbinas superiores, puerta deslizante, cola larga, rotor de cola y **ruedas** en lugar de patines. `Renderer.ts` aplica escala visual 1.18× solo al helicóptero; la nave de VR2 no se altera.

`VehicleProfile.ts` añade `flight.groundClearance` y acelera el helicóptero (175 impulso horizontal, resistencia 1.7, límite de velocidad 90; 42 velocidad vertical, respuesta 9). `Simulation.ts` conserva la regla heredada de la nave y usa **solo para el helicóptero** el suelo dinámico `Terrain.height(x) + 3.8` en todo escenario: puede descender cerca de la topografía en reconocimiento sin atravesarla por su centro. La diferencia entre centro/ruedas se apoya en el nuevo modelo y la escala; sigue siendo un suelo arcade, sin colisión volumétrica con toda la silueta ni simulación aerodinámica completa.

Pruebas específicas codificadas: `tests/unit/vehicle-profiles.test.ts` (6 casos), `tests/unit/helicopter-model.test.ts` (4) y `tests/e2e/vehicle-visual.spec.ts` (3 escenarios por backend). **No validadas localmente en esta versión**. Helicóptero sigue disponible solamente en diagnóstico DEV, no en partidas con récords.


## Fase 4 — sonido propio del helicóptero (27/10/2026, pendiente de escuchar y probar)

El audio existente en `src/audio/AudioEngine.ts` crea dos osciladores de la **nave** (triangular filtrado + seno agudo) y ajusta sus ganancias y tono por velocidad/empuje. No conocía la identidad de vehículo; por eso el helicóptero experimental heredaba el zumbido de la nave.

`src/audio/HelicopterSound.ts` implementa un sintetizador aislado con una fuente continua de ruido determinista en búfer circular, filtro paso bajo, modulación de amplitud por oscilador de 17–20 Hz para golpes de palas, y un oscilador de turbina tipo sierra filtrado a baja frecuencia. Las tres fuentes se crean **una sola vez y bajo demanda** después del desbloqueo de Web Audio. Los parámetros del rotor se calculan de forma pura mediante `helicopterSoundProfile(speed, thrust)`. Las ganancias decaen a cero al pausar o cambiar a nave, en lugar de recrear fuentes en cada fotograma.

`AudioEngine.update(thrust, speed, active, vehicle='ship')` acepta un cuarto argumento opcional, por lo que las llamadas previas mantienen el sonido clásico. La nave conserva literalmente sus fórmulas de frecuencia y ganancia y el control `enginePitchHz` sigue siendo de la nave; el helicóptero usa su perfil sonoro independiente. Ambos pasan por `masterBus`, con los controles existentes de volumen y silencio. `GameApp` transmite `state.vehicleId`. `getState().audio` expone `vehicle` y `helicopterSoundInitialized` solo para diagnóstico. `dispose()` detiene fuentes y cierra el contexto.

La ruta de diagnóstico sigue siendo `loadScenario('flight-basic', 8042, 'helicopter')` **en desarrollo**. Para que se oiga, primero iniciar una partida pulsando el botón del juego, habilitando Web Audio mediante gesto del usuario; después cargar el helicóptero en consola. El navegador puede impedir el audio iniciado exclusivamente desde consola sin un gesto previo. La nueva salida necesita pruebas locales y aceptación auditiva.


## Fase 4 — escala del helicóptero comparable a la nave (27/10/2026)

La nave original tiene fuselaje desde aproximadamente `x=-4.56` a `x=+4.7`, y el helicóptero utilitario desde `x≈-11.65` a `x≈+6.45` (sin escalar). El aumento de escala `1.18` en `FlightRenderer` hacía que su silueta fuese visualmente mucho mayor que la nave. El usuario aceptó previamente modelo, velocidad, animación (con signo vertical invertido) y sonido de helicóptero, pero solicitó **reducir la representación**, preservando la jugabilidad.

Se declara `HELICOPTER_GAME_SCALE = 0.56` en el módulo visual `models/Helicopter.ts`, aplicada uniformemente por `Renderer.ts`. Esto conserva proporciones internas, animación de rotores, ángulos originales y sonido procedural; no modifica la física ni las hitboxes compartidas. Para evitar que las ruedas queden suspendidas sobre el terreno, el único cambio de simulación es `HELICOPTER_PROFILE.flight.groundClearance = 2.0` (antes 3.8). Las ruedas se modelan en y=-2.48 con radio 0.57, por lo que el tren inferior queda aproximadamente 0.29 unidades sobre terreno llano en actitud neutra. El suelo varía por el `Terrain` ya existente; no se añade un sistema de aterrizaje o colisiones tridimensionales.

Se añadió prueba de dimensiones con `Box3` contra `createShip()` y comprobación de separación del suelo. **Pendiente**: ejecución local de build, unitarias y E2E visuales, además de inspección del usuario. Audio aceptado por escucha, pero sus tests automatizados no se han presentado como aprobados.


## Fase 4 — selector de vehículo y contrato de rescate (27/10/2026)

`Interface.ts` incorpora select nativo y accesible `aria-label="Vehículo"`, con descripción dinámica, selección por teclado/mandos y rótulos de nave (`VR—01`) o helicóptero (`HC—02`). `GameApp.ts` maneja `selectedVehicle` como preferencia **solo previa al vuelo** persistida en `localStorage['void-rescue-iii.vehicle.v1']`. El constructor, `start()`, `restart()` y `menu()` conservan la elección. `GameApp.selectVehicle()` restringe cambios a `mode === 'title'`; seleccionar cambia también el modelo de la pantalla inicial mediante `graphics.reset()`. Se pasa como séptimo argumento a `Simulation`. El audio específico previo sigue escogiendo perfil con `state.vehicleId`.

`VehicleProfile.rescue` mantiene la nave con reglas históricas: `capacity=null`, `pickupRange=8`, `minPickupHeight=3`, `maxPickupHeight=17`, `maxPickupSpeed=null`, `extractionSpeed=5.5`, `extractionHorizontalSpeed=11` y `deliverySpeed=22`. El helicóptero tiene `capacity=2`, rango 7, altura relativa al colono de 0.5 a 11, velocidad horizontal de recogida máxima 20, extracción vertical 9, horizontal 13 y entrega con velocidad máxima 15. `ColonistSystem` consulta el perfil durante extracción E/Y, recogida de personas en caída y descarga. En Defensa y Rescate, los pasajeros del helicóptero son guardados en cabina; el estado `carried`, las recompensas, las oleadas y los protocolos de protección después de un choque son comunes. El cable del helicóptero tiene ancho visual 0.32 y color beige, en vez del haz de nave ancho 2.8 y verde azulado. La entrega en misión Rescate sigue limitada a Fortaleza 01.

`Records.ts` añade `vehicleId?: VehicleId` a `PlayerRecord` sin cambiar la clave `RECORDS_KEY`; la ausencia de valor en datos previos se interpreta como `ship`. El top 10 agrupa por modo de enemigos, misión, protocolo **y vehículo**, y `RecordsPanel.ts` incluye filtro para consultar ambas clasificaciones. La selección está inmovilizada durante una partida con récord para evitar cambiar las reglas después de comenzar. No se migran ni eliminan datos.

Pruebas escritas, todavía **no ejecutadas localmente**: 6 unitarias de rescate, 4 de récords, 4 escenarios E2E en dos backends para UI/rescate y regresión de nave. El usuario confirmó visualmente la escala anterior, así como animación y sonido; preservar estos elementos al validar esta integración.
