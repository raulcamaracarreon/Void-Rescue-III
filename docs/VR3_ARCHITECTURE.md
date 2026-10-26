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

- `src/landscape/LandscapeConfig.ts`: `DecorBitmap` v1 (96 × 32, filas binarias), `kind:'drawing'`, validación estricta, datos opcionales y copia profunda por plano/paisaje. No importa HTML ni scripts.
- `src/landscape/DecorDrawing.ts`: operaciones puras para pincel, borrador, línea Bresenham y rectángulo; independientes del DOM, Three.js y simulación.
- `src/ui/DecorPaintEditor.ts`: diálogo Paint con lienzo pixelado, puntero, vista previa, 30 estados máximos de deshacer y rehacer, aplicar y cancelar. No altera el estado del juego hasta aplicar.
- `src/ui/LandscapePanel.ts`: botones de edición separados para primero y tercero. Al aplicar, guarda la máscara en el estilo personalizado y activa `kind:'drawing'`; los motivos procedurales se preservan como alternativas.
- `src/render/ForegroundDecor.ts`: convierte tramos horizontales de píxeles pintados en rectángulos Three.js en z=19 / z=-18. Colorea todo mediante los parámetros del plano (manual/gradiente/inversión/opacidad 10–100 %, paralaje y longitud). El bitmap escala lateralmente al ancho de la franja en esta versión; el escalado no destructivo se desarrollará después.
- Conserva los 2400 puntos del mundo circular; ningún píxel crea colisión. Los datos guardados anteriores no tienen `bitmap` y siguen usando los motivos de antes.
- **Pendientes:** selección, polígonos, formas compuestas y transformables, escala editable, resolución configurable, importación/exportación JSON de dibujos, pruebas de rendimiento y aceptación visual. Esta implementación inicia pero no completa toda la fase.


## Revisión cromática — extensión del gradiente automático (rama de fase 3)

- `buildAutomaticLandscape` reserva **N+2 pasos** desde `skyColor` hasta `frontColor` cuando una capa decorativa *habilitada* usa `colorMode:'gradient'`. Las N capas del fondo pasan a muestrearse en `i/(N+2)` y las dos reservas posteriores se dedican a tercer plano y primer plano.
- `decorColorForStyle` toma las dos últimas capas **reales** del fondo y deriva un paso de RGB por canal. El tercer plano progresa un paso hacia mayor contraste y el primer plano dos. Se fuerza una progresión hacia tonos más oscuros en modo normal y hacia más claros en inverso; pasos fraccionarios evitan igualar la penúltima capa cuando se invierte la pendiente del fondo.
- Los colores generados por el modo automático permanecen dentro de los **dos extremos escogidos**. Si los colores son iguales, no existe rango cromático del que extraer tonos distintos. En estilos avanzados, las capas dibujadas manualmente no se reescriben.
- La vista previa en `LandscapePanel.paintSwatches` utiliza la resolución cromática compartida por `WorldScene`, de modo que muestra N colores de fondo más los tonos de los planos activos.
- El esquema persistido `LandscapeStyle` **no cambia**. `colorMode`, `invertGradient`, los tonos manuales y los mapas de bits permanecen iguales.
- Estado: cambios implementados y pruebas adaptadas, **pendientes de ejecución y aceptación visual local**. No fusionar a `main` sin comprobación.
