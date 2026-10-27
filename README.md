# VOID RESCUE III — prototipo de evolución 2.5D

**Estado: fase inicial (v0.1.0, NO publicada).** Base heredada de [Void Rescue II](https://github.com/raulcamaracarreon/Void-Rescue-II), bajo licencia MIT. La versión oficial de Void Rescue II permanece independiente e inalterada.

> **Aún no es el juego nuevo completo.** Se conserva la jugabilidad espacial de VR2 y se ha validado localmente el editor de rotación (16 pruebas E2E aprobadas por el usuario). La primera capa visual de primer plano (árboles, cercas y rejas) ya fue probada localmente por el usuario. En `feat/dual-decor-layers` se añade un **tercer plano** independiente entre los vehículos y las montañas/edificios. Ambos permiten activar/desactivar, escoger motivo, color, opacidad y paralaje. La primera herramienta de dibujo manual ya está implementada en una rama de la fase 3, pendiente de pruebas. Los helicópteros y los nuevos enemigos siguen pendientes.

## Fase 0 prioritaria: color automático e inversión de gradiente

Desarrollo en [`feat/decor-auto-gradient`](https://github.com/raulcamaracarreon/Void-Rescue-III/tree/feat/decor-auto-gradient), **pendiente de compilación y pruebas locales**. Ambos planos decorativos ofrecen color manual o color derivado del gradiente automático de dos extremos, con inversión independiente por plano. El color manual se conserva al alternar; la franja de vista previa incluye los planos habilitados y se actualiza al modificar la paleta. No se altera la simulación ni el gradiente de las montañas/edificios de fondo.

**Orden de trabajo:** fases 0 y 2 implementadas en sus ramas; el usuario confirmó funcionalmente edificios y longitud lateral. La fase 3 se inicia en `feat/phase3-paint-editor` sin alterar `main`. El ajuste de opacidad 100 % y el primer lienzo Paint requieren validación local. No ampliar alcance fuera de la hoja de ruta.

### Revisión del gradiente — continuación por profundidad

En `feat/phase3-paint-editor` se corrigió la lógica que tomaba muestras internas del gradiente (75 % y 95 %). Ahora, cuando está activado el color automático de alguno de los planos decorativos, la paleta de los **dos colores seleccionados** se recalcula en `N + 2` pasos: `N` para las montañas/edificios y **dos tonos adicionales** para los planos. El tercer plano es más oscuro que el fondo cercano y el primer plano más oscuro que el tercero; cada inversión independiente genera tonos más claros sin repetir exactamente la penúltima capa de fondo. La interpolación se mantiene limitada a los extremos de color seleccionados. Al desactivar el color automático de ambos planos, los paisajes recuperan la paleta anterior (`N` pasos), y los colores manuales no se modifican.

Se añadieron pruebas unitarias de continuidad de color y de inversión, y aserciones visuales de los swatches en Playwright. **Pendiente de ejecutar build y pruebas locales; no está fusionado con `main`.**

## Fase 2 — edificios y longitud lateral de ambos planos

En [`feat/decor-buildings-and-span`](https://github.com/raulcamaracarreon/Void-Rescue-III/tree/feat/decor-buildings-and-span) se añadió el motivo **Edificios**, disponible en primer y tercer plano, y un campo **Longitud lateral (%)** independiente para ambos (5–100 %). La longitud define qué porcentaje del ancho circular (2400 unidades de juego) estará cubierto por la franja decorativa. Los elementos no se estiran, la zona restante queda vacía y el patrón se repite por mundo. No modifica la geometría colisionable ni el núcleo de simulación. Falta validación local de esta nueva rama.

## Fase 3 — primer incremento: editor Paint de siluetas

La rama [`feat/phase3-paint-editor`](https://github.com/raulcamaracarreon/Void-Rescue-III/tree/feat/phase3-paint-editor) contiene un editor de **máscaras binarias con resoluciones seleccionables 96 × 32, 192 × 64, 288 × 96 (inicial) y 384 × 128**, independiente para el primer y tercer plano. Herramientas: pincel, borrador, línea, rectángulo, limpiar, deshacer y rehacer. **Aplicar dibujo** guarda el diseño en el ambiente personalizado y selecciona el motivo `Dibujo propio`; **Cancelar** descarta el borrador. Se conserva el color manual o automático/inverso, el paralaje y la longitud lateral. El dibujo ocupa un motivo de proporción 3:1, representado en 150 unidades de mundo por 50 de altura. **No se estira al variar la longitud lateral**: el motor repite la misma geometría dentro de la franja y recorta solo la última copia. El editor permite cambiar resolución y preservar dibujos anteriores (96 × 32), con remuestreo vecino más cercano y deshacer/rehacer. Todavía no incluye escalado independiente, capas internas u objetos seleccionables.

El mismo incremento permite opacidad máxima de **100 %** en ambos planos, incluidas máscaras propias. Las pruebas nuevas de modelo, geometría y navegador fueron ejecutadas y aprobadas localmente el 26/10/2026 (build correcto, 131/131 unitarias, 6/6 E2E del editor en Chromium automático y WebGL2).

**Corrección de fase 3 (25/10/2026):** a partir de la prueba manual se resolvió el estiramiento horizontal y se amplió el lienzo. Cambios guardados en GitHub y pruebas nuevas añadidas, **validados por ejecución local de pruebas automatizadas el 26/10/2026; pendiente de revisión visual manual durante el vuelo**. El dibujo nuevo usa 288 × 96; los guardados antiguos de 96 × 32 mantienen intacta su resolución.

### Ampliación panorámica y herramientas (26/10/2026)

Para evitar la repetición prematura de figuras observada en la captura del juego, el editor ahora admite lienzos panorámicos **512×64, 1024×128 y 2048×256** (nuevo valor inicial). Sus motivos miden **400×50 unidades del mundo**, en lugar de 150×50 de los antiguos lienzos 3:1, y no se estiran. A 16:9, ese ancho supera el recorrido visible de una sola pantalla.

Se agregaron **círculo, triángulo, polígonos rellenos por vértices, rellenar figuras, grosor del pincel 1–32 px y zoom 1–8×** con desplazamiento horizontal. El guardado convierte internamente las filas binarias a un bitset Base64 compacto (formato v2), con lectura compatible de los dibujos v1. El cambio de proporción al variar resolución conserva el tamaño de la figura agregando espacio vacío; no deforma el árbol viejo.

**Implementado en GitHub, pendiente de validación con build, Vitest, Playwright y prueba visual del usuario.**

**Hitos siguientes de fase 3:** herramientas de selección y transformación de objetos, ajustes de dimensiones/escala sin distorsión, formatos de exportación/importación JSON validados y opciones de diseño más avanzadas. No confundir el editor básico implementado con la fase 3 completa.

## Qué funciona como base

- Simulación 2.5D existente: mundo horizontal circular, cámara, controles, combate, recogida y rescate, oleadas, récords y modos de dificultad.
- Editor de paisajes procedurales (13 estilos incluidos y biblioteca personal de hasta 100 ambientes).
- Propuesta de mejora de rotación: ambientes activos primero; dos columnas leídas de arriba hacia abajo; numeración, arrastrar, subir/bajar y mover al inicio, final o a una posición determinada.
- Almacenamiento exclusivo para VR3: `void-rescue-iii.landscape.v1`, `void-rescue-iii.preferences.v1`, `void-rescue-iii.records.v1` y `void-rescue-iii.pilot.v1`.
- Nombre, metadatos HTML y paquete npm renombrados para distinguir el prototipo.

El editor de rotación ya fue probado localmente con 16 recorridos E2E aprobados. **La rama de dos planos ya compiló y superó 118 pruebas unitarias y 24 E2E Playwright en la computadora del usuario. Queda pendiente la revisión visual manual de profundidad, paralaje y oclusión durante el vuelo.** No hay publicación de VR3 en Pages ni lanzamiento oficial.

## Ejecución local

Requiere Node.js 22.12 o superior.

```powershell
npm ci
npm run build
npm run test
npx playwright test tests/e2e/landscape.spec.ts tests/e2e/foreground.spec.ts tests/e2e/decor-paint.spec.ts
npm run dev
```

Acceso local: http://127.0.0.1:5173/

La prueba Playwright requiere tener instalado su navegador. Si no está disponible: `npx playwright install chromium`.

## Dirección del nuevo juego

VR3 evolucionará hacia un **arcade de rescate con vehículos y mundos configurables**. Un helicóptero de rescate y soldados, amenazas como drones, helicópteros y aviones, terrenos de selva/desierto/ciudad y capas decorativas opcionales que pueden superponerse al vehículo son ejemplos priorizados para los siguientes incrementos.

No se sustituirán el núcleo de simulación, la física ni las reglas probadas sin una migración incremental. Los elementos gráficos con oclusión de primer plano estarán separados del terreno y sus colisiones.

## Documentación VR3

- [Visión y ruta de desarrollo](docs/VR3_ROADMAP.md).
- [Arquitectura objetivo](docs/VR3_ARCHITECTURE.md).
- [Pruebas locales del repositorio independiente](docs/VR3_LOCAL_SETUP.md).
- [README histórico de la base VR2](docs/README_VR2_BASE.md).

**Automatizaciones:** los workflows de validación y Pages quedan manuales durante la etapa de prototipo; el workflow de releases exclusivo de VR2 no se incluye. No crear tags de versión VR2 desde esta rama.

**Repositorio independiente creado:** [Void-Rescue-III](https://github.com/raulcamaracarreon/Void-Rescue-III). La rama `feat/dual-decor-layers` parte de `feat/foreground-layers`; ambas se mantienen separadas de `main` hasta validación. El remoto `vr2-base` es sólo una referencia histórica.
