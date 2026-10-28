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
