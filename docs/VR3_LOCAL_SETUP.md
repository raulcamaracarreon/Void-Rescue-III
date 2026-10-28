# Void Rescue III — pruebas locales (repositorio propio)

Void Rescue III reside en el repositorio [raulcamaracarreon/Void-Rescue-III](https://github.com/raulcamaracarreon/Void-Rescue-III). VR2 permanece independiente.

## Carpeta local del proyecto

`E:\Proyectos\JUEGOS\VoidRescue-III`

La rama `main` es la base que el usuario comprobó con 16 pruebas Playwright aprobadas. Las mejoras nuevas se preparan en ramas específicas y se validan antes de fusionar. El antiguo remoto `vr2-base` es sólo referencia histórica; **no subir VR3 a VR2**.

## Probar la fase 3: dibujo Paint y opacidad al 100 %

En PowerShell, cerrar antes cualquier servidor Vite en esa carpeta con Ctrl+C. Comprobar que no existan cambios versionados pendientes:

```powershell
cd "E:\Proyectos\JUEGOS\VoidRescue-III"
git status --short --branch
git fetch origin
git switch feat/phase3-paint-editor
git pull --ff-only
npm ci
npm run build
npm run test
npx playwright test tests/e2e/landscape.spec.ts tests/e2e/foreground.spec.ts tests/e2e/decor-paint.spec.ts
npm run dev
```

La rama local **ya existe** en el entorno del usuario (confirmado por `fatal: a branch named 'feat/phase3-paint-editor' already exists`, 25/10/2026). **No volver a ejecutar** `git switch --track` para crearla. Si se trabaja en un clon nuevo sin rama local, entonces usar el comando con `--track`. No borrar capturas locales `docs/screenshots/*.png`; son archivos no versionados generados por Playwright.

Abre `http://127.0.0.1:5173/`; entra en Personalizar paisaje. Verás **Tercer plano** (detrás de vehículos, paralaje 40–100%) y **Primer plano** (delante de vehículos, paralaje 100–135%). Activa ambos y elige **Edificios** en los dos. Prueba **Longitud lateral (%)** = 25 en el tercero y 65 en el primero, luego 100 % para comparar. Las franjas empiezan en x=0 del mundo y se repiten cada vuelta; debería haber tramos sin decoración, sin que los edificios cambien de proporción. Prueba también gradiente automático normal/inverso, los motivos anteriores, guardado, recarga, `?backend=webgl2` y, finalmente, combate/rescate en vuelo. El primer editor raster tipo Paint está implementado en esta rama, y sus **6 pruebas E2E se aprobaron el 26/10/2026**. Queda pendiente la inspección visual manual de los mosaicos en partida.

**Validación específica del gradiente extendido:** usa un paisaje automático con dos colores de contraste fuerte (por ejemplo, cielo claro y frente oscuro). Activa **Tercer plano → Gradiente automático** y **Primer plano → Gradiente automático** y comprueba la secuencia cielo → N fondos → tercero más oscuro → primero aún más oscuro. Invierte primero solo el tercero: su tono debe hacerse más claro sin igualar la penúltima montaña y el primero no debe cambiar. Invierte luego el primero y compara. Prueba también una paleta con cielo oscuro y frente claro, los paisajes avanzados y el cambio a manual. Al desactivar ambos planos del modo gradiente deben restaurarse los colores tradicionales de las montañas. Verifica la franja de vista previa y `?backend=webgl2`.

**Corrección del editor de dibujo (25/10/2026):** al iniciar un dibujo nuevo debe aparecer **288 × 96**. El selector permite 96 × 32, 192 × 64, 288 × 96 y 384 × 128. Cambia la resolución después de trazar y comprueba que el dibujo se conserva; deshaz el cambio y vuelve a hacerlo. En el vuelo, con la franja a 100 %, el dibujo debe conservar proporciones y repetirse en lugar de estirarse. Con 23 % de longitud lateral deben aparecer tres motivos completos y un cuarto recortado. Abre un dibujo guardado anteriormente a 96 × 32 para confirmar que no se cambia de resolución automáticamente.

**Corrección posterior a ejecución E2E (26/10/2026):** el usuario reportó 4 pruebas Playwright aprobadas y 4 fallidas. Los fallos fueron (a) conflicto de dos elementos `status`, y (b) rectángulo fuera del área visible con zoom predeterminado 2×, lo que dejaba vacío el bitmap del tercer plano. Corregido en `src/ui/DecorPaintEditor.ts` y `tests/e2e/decor-paint.spec.ts`: indicador de grosor como `span`, localización específica del estado del lienzo, zoom inicial **1×** para mostrar el panorama completo, restablecimiento del desplazamiento al abrir y prueba nueva de dibujo en la zona derecha. **Segunda ejecución E2E confirmada el 26/10/2026: 10/10 aprobadas en Chromium automático y WebGL2 (24.1 s).** Sin cambios posteriores al código funcional en esa ejecución.

**Ampliación panorámica de Paint (26/10/2026; 10/10 E2E aprobadas, inspección visual pendiente):** el selector incluye 96×32, 192×64, 288×96, 384×128 (heredadas) y 512×64, 1024×128, **2048×256 predeterminada**. Prueba «Grosor del pincel», círculo, triángulo, la casilla «Rellenar figura», «Polígono por vértices» con tres o más clics y el botón «Cerrar polígono». Prueba zoom 1×, 2×, 4× y 8× y desplazamiento horizontal. Guarda un dibujo, cierra y recarga para validar la máscara serializada en formato compacto. Comprueba que un motivo panorámico aparece una sola vez a lo largo del ancho habitual de pantalla y se repite después, sin deformarse; con longitud lateral reducida, debe terminar en el tramo configurado. Comprueba también que dibujos antiguos 96×32 y 288×96 sigan abriéndose sin alterar su aspecto.

**Para el primer incremento de fase 3:** cambia la opacidad a 100 % en ambos planos. Pulsa **Dibujar primer plano (Paint)** o **Dibujar tercer plano (Paint)** y prueba pincel, borrador, línea, rectángulo, limpiar, deshacer/rehacer y cancelar. Solo **Aplicar dibujo** debe guardar el bitmap, activar la capa y elegir `Dibujo propio`. Después, guarda un paisaje con nombre, cierra, recarga y verifica ambos dibujos. Confirma que los elementos siguen por delante y detrás de los vehículos respectivamente, que el gradiente invertido funciona y que las antiguas máscaras no se pierden al cambiar de motivo.

**Resultados confirmados por consola:** el 25/10/2026, 129/129 unitarias y 12/12 E2E de `foreground.spec.ts` aprobadas en dos proyectos de navegador. El **26/10/2026**, tras la corrección de estiramiento y resolución: **build Vite + TypeScript correcto**, 14 archivos / **131/131 pruebas unitarias** y **6/6 E2E de `decor-paint.spec.ts`** aprobadas en `chromium-auto` y `chromium-webgl2`. El aviso de bundle de más de 900 kB es informativo y no impidió la compilación. No repetir pruebas ya aprobadas sin cambios funcionales. Falta revisión visual durante una partida.

**Última ejecución reportada por el usuario (26/10/2026):** `git pull --ff-only` actualizado correctamente; `npx playwright test tests/e2e/decor-paint.spec.ts` — **10 passed (24.1s)**, cinco escenarios en cada backend `chromium-auto` y `chromium-webgl2`. Las **131 unitarias** y compilación completas pertenecen a una iteración previa de la fase 3; no afirmar que toda la suite se reejecutó tras la ampliación panorámica. No hace falta repetir las E2E ya aprobadas sin cambios funcionales. **Siguiente validación:** jugar y observar visualmente la repetición panorámica, zoom, rendimiento y guardado.

**Parche posterior (26/10/2026):** el usuario detectó manualmente que Círculo y Triángulo trazaban como Pincel, pese a las E2E previas aprobadas. Corregido en GitHub `src/ui/DecorPaintEditor.ts`: solo `brush` y `eraser` usan trazos acumulativos, mientras que `line`, `rectangle`, `circle` y `triangle` regeneran la figura desde el estado inicial. Añadida una E2E explícita para píxeles interiores lejos de la diagonal del arrastre. **Validación local confirmada el 26/10/2026:** `npx playwright test tests/e2e/decor-paint.spec.ts -g "círculo y triángulo rellenos"` aprobó **2/2** pruebas en dos ejecuciones consecutivas (7.2 s y 6.8 s); cubre Chromium automático y WebGL2. El usuario confirmó además que `HEAD` y `origin/feat/phase3-paint-editor` coincidían exactamente en `5eadc1a22591ed0f5b724a38f370fac912a9b125` antes de estos commits documentales. **Aceptación visual confirmada el 26/10/2026:** «Perfecto, ahora todo funciona bien». No repetir las pruebas sin cambios funcionales.

**Observación de Git local (26/10/2026):** el `git pull --ff-only` terminó en fast-forward y Playwright se ejecutó correctamente, pero una limpieza automática de packs produjo avisos `Unlink of file .git/objects/pack/... failed` en Windows. No ejecutar `git gc` ni borrar archivos del directorio `.git` manualmente; revisar bloqueo de procesos solo si reaparece como problema operativo. `git status -sb` mostraba `MD_Continuidad/` y cuatro capturas en `docs/screenshots/` como archivos no rastreados; deben conservarse, no borrarse ni incorporarse de forma automática.

No anunciar pruebas aprobadas hasta ejecutar realmente estos comandos. Si falla alguna, conservar la salida completa.

## Publicación

El usuario **autorizó fusionar el incremento Paint a `main` el 26/10/2026** después de la aceptación visual. La integración se hará mediante Pull Request, conservando la historia; la rama de trabajo se mantiene para consulta y no debe eliminarse automáticamente. Pages y los pipelines CI continúan **manuales**; no habilitar GitHub Actions.

## Resultados y correcciones de la Entrega A (26/10/2026)

El usuario ejecutó build, Vitest y los 16 E2E de Paint/selección en la rama `feat/phase3-selection-tools`. **Build aprobado y suite unitaria específica aprobada**. Playwright terminó **12/16 aprobadas**, cuatro fallidas por dos causas repetidas en ambos backends:

1. El localizador `getByRole('button', { name: 'Cancelar' })` coincide con los botones «Cancelar» y «Cancelar selección». Corrección: usar `exact: true` para el botón de cerrar.
2. Después de usar un control de zoom, Escape no quitaba la selección (el navegador podía consumir la pulsación antes de disparar `dialog.cancel`). Corrección: manejar Escape en la fase de captura del `keydown` del diálogo; primera pulsación cancela selección, segunda cierra el editor. La prueba además suponía erróneamente que deshacer estaría deshabilitado, aunque cambiar resolución de 2048×256 a 96×32 genera legítimamente un paso; ahora comprueba la conservación de ese paso.

**Parches validados en el equipo del usuario el 26/10/2026:** `npx playwright test tests/e2e/decor-paint.spec.ts -g "cancelar no cambia|la selección conserva"`: **4/4 pruebas aprobadas (9.3 s)**, dos en Chromium automático y dos en WebGL2. La sincronización `git -c gc.auto=0 fetch origin` y `git merge --ff-only origin/feat/phase3-selection-tools` también fue correcta. Comandos ejecutados (registro histórico):

```powershell
cd "E:\Proyectos\JUEGOS\VoidRescue-III"
git -c gc.auto=0 fetch origin
git merge --ff-only origin/feat/phase3-selection-tools
npx playwright test tests/e2e/decor-paint.spec.ts -g "cancelar no cambia|la selección conserva"
```

No volver a ejecutar toda la batería salvo que esta corrección provoque otro defecto.

## Entrega A de selección rectangular — rama aislada (26/10/2026)

**Estado:** implementada en GitHub en `feat/phase3-selection-tools`; **compilación y unitarias aprobadas en la primera ejecución, 12/16 E2E generales inicialmente y las 4/4 regresiones corregidas después aprobadas**. El usuario **aceptó visualmente la Entrega A el 26/10/2026** («ok funciona conforme lo esperado»). La batería completa de 16 no se repitió tras el parche, pero los cuatro casos afectados sí quedaron aprobados. La rama parte de `main` ya fusionado (PR #1, commit `6ae999a`); `main` permanece estable. No activar GitHub Actions.

Para revisar esta primera entrega:

```powershell
cd "E:\Proyectos\JUEGOS\VoidRescue-III"
git -c gc.auto=0 fetch origin
git switch feat/phase3-selection-tools
git merge --ff-only origin/feat/phase3-selection-tools
npm run build
npx vitest run tests/unit/decor-paint.test.ts
npx playwright test tests/e2e/decor-paint.spec.ts
npm run dev
```

En el editor Paint, elegir «Seleccionar región», arrastrar desde cualquier esquina y observar un recuadro de puntos amarillo con dimensiones y posición en el estado del lienzo. Comprobar que «Cancelar selección» borra solo el recuadro y que Escape lo cancela antes de cerrar el diálogo. Usar zoom 4× y desplazamiento de la zona visible: la selección debe corresponder a los píxeles bajo el cursor. Seleccionar por sí solo no altera la máscara, ni añade pasos al historial. Al cambiar de herramienta o resolución se cancela la selección. La edición de la región (cortar, copiar, mover, etc.) se incorporará en una **Entrega B** tras validar este comportamiento.

## Continuación posterior a la integración (26/10/2026)

- `main` **ya recibió** las capas decorativas, gradientes y el editor Paint probados mediante Pull Request #1, merge commit `6ae999a5d46947b9717a8e5d074512fc1fe0f0ec` (26/10/2026). El usuario confirmó fast-forward local de `main` a ese commit.
- Siguiente incremento en rama aislada: herramienta de selección rectangular de píxeles, mover, copiar/pegar, duplicar y borrar selecciones, con historial reversible; después escalar/rotar e importar/exportar JSON versionado.
- Archivos locales no rastreados `MD_Continuidad/` y capturas en `docs/screenshots/` deben conservarse al cambiar ramas. No ejecutar `git clean` sobre ellos.
- Si reaparecen avisos de mantenimiento de Git `Unlink ... .idx/.pack failed`, no borrar packs manualmente; no bloquean por sí mismos el resultado de Playwright.

## Corte actual — aceptación de selección y continuidad (26/10/2026)

- **Entrega A:** selección rectangular, zoom/scroll, cancelación y delimitación: pruebas focalizadas **4/4** tras el primer parche y aceptación visual del usuario.
- **Entrega B:** mover, duplicar, cortar, copiar, pegar, borrar y deshacer/rehacer. La revisión anterior pasó **20/20 E2E** en Chromium automático/WebGL2 (44.7 s), pero el usuario descubrió un defecto de duplicación superpuesta. Se corrigió mediante una **copia flotante independiente** que preserva el fondo original; el usuario acaba de confirmar visualmente que **las herramientas ahora funcionan correctamente**.
- **Validación final tras corregir copias flotantes:** build aprobado, **16/16** unitarias específicas y **8/8** E2E focalizadas (20.3 s) en ambos backends. Los 20/20 E2E históricos (44.7 s) son anteriores al parche y no se presentarán como reejecutados.
- **Git:** fusión de la entrega A+B a `main` **autorizada expresamente** por el usuario mediante Pull Request, después de aceptación manual y pruebas. Preservar el historial, sin activar workflows ni publicar Pages.
- **Ruta futura:** decidir si VR3 ofrecerá variantes de vehículo en una misma partida o modos/episodios; **fase 4:** contrato de vehículos y primer helicóptero, preservando nave y reglas actuales; **fase 5:** nuevas amenazas, entidades y ambientes. Exportación/importación JSON, transformación/escalado y QA visual pendiente de fases 1/2/3 quedan registradas, no declaradas completadas.

## Entrega B — manipulación de regiones (26/10/2026)

**Estado:** la Entrega B completó las pruebas anteriores con **20/20 E2E aprobadas en 44.7 s** (Chromium automático y WebGL2). Sin embargo, la revisión manual detectó un defecto de duplicación superpuesta que motivó una corrección posterior, **aprobada en build, 16/16 unitarias y 8/8 E2E focalizadas**. La entrega A ya fue aceptada visualmente. Continúa aislada de `main` y no se habilitará CI automático.

La barra de operaciones **Región** aparece debajo del lienzo. Selecciona con la herramienta «Seleccionar región» y utiliza **Copiar, Cortar, Pegar, Duplicar o Borrar selección**. Pegar y duplicar desplazan por defecto la región 16 píxeles a la derecha y 8 hacia abajo (sin salirse del lienzo); el color vacío del fragmento se considera transparente. Para **mover** un fragmento, arrastra desde dentro del rectángulo amarillo hacia la nueva posición; también hay botones de flechas para cambios de un píxel. Cada movimiento por arrastre y cada operación de edición debe generar como máximo un paso de deshacer. Copiar y cancelar selección no modifican el bitmap. El portapapeles es interno y se descarta al cambiar de plano/abrir sesión nueva. No usa portapapeles del sistema.

**Validación nueva necesaria** (cambios funcionales desde las E2E ya aprobadas):

```powershell
cd "E:\Proyectos\JUEGOS\VoidRescue-III"
git -c gc.auto=0 fetch origin
git merge --ff-only origin/feat/phase3-selection-tools
npm run build
npx vitest run tests/unit/decor-paint.test.ts
npx playwright test tests/e2e/decor-paint.spec.ts
```

**Corrección de copias superpuestas (26/10/2026):** antes, «Duplicar» pegaba inmediatamente la máscara monocroma en el bitmap y el siguiente arrastre movía el rectángulo ya fusionado, incluyendo la tinta original. El editor ahora mantiene la copia como **selección flotante** (bitmap de fondo previo + fragmento binario + posición). Al desplazarla restaura la zona que tenía debajo, incluso si la copia se solapó con el original. Deshacer/rehacer conservan ese estado. La copia se incorpora definitivamente cuando se cancela la selección, se cambia de herramienta o se aplica el dibujo. En el estado del editor aparece «copia flotante» mientras es independiente. No se añade persistencia de capas ni se modifica el formato de los paisajes.

**Pruebas del parche ya aprobadas** (comando histórico; no repetir sin nuevos cambios):

```powershell
cd "E:\Proyectos\JUEGOS\VoidRescue-III"
git -c gc.auto=0 fetch origin
git merge --ff-only origin/feat/phase3-selection-tools
npm run build
npx vitest run tests/unit/decor-paint.test.ts
npx playwright test tests/e2e/decor-paint.spec.ts -g "duplicado superpuesto|independencia del duplicado flotante|regiones antiguas|panorama: arrastrar"
```

Playwright aprobó **8/8 casos focalizados en 20.3 s** (cuatro escenarios por backend); el usuario confirmó visualmente que la copia ya no arrastra el original. Las 20 E2E generales corresponden a la versión anterior.


## Fase 4 — primera validación del contrato de vehículos (27/10/2026)

Los cambios de esta fase están únicamente en la rama `feat/phase4-vehicle-profiles`. `main` contiene ya el incremento Paint/selección fusionado mediante PR #2, sin cambios de vehículos. Todavía **no hay helicóptero habilitado** en el juego ni selector visible: primero se comprueba que el perfil de la nave mantiene idénticos controles y dinámica en los 60 pasos por segundo.

```powershell
cd "E:\Proyectos\JUEGOS\VoidRescue-III"
git -c gc.auto=0 fetch origin
git switch --track origin/feat/phase4-vehicle-profiles
npm run build
npx vitest run tests/unit/core.test.ts tests/unit/vehicle-profiles.test.ts
npx playwright test tests/e2e/flight.spec.ts
```

**Resultados recibidos del usuario (27/10/2026):** compilación correcta (`tsc --noEmit && vite build`), **15/15** unitarias de `core.test.ts`, **3/4** unitarias de perfiles, **12/12** Playwright de vuelo en ambos backends. La única falla fue un error en `vehicle-profiles.test.ts`: esperaba un disparo en `CONFIG.startX + 5`, pero en el primer tick se mueve primero la nave y luego también avanza el proyectil, dejando `x = 368.0516896151257`. Se corrigió la aserción **en GitHub**, sin cambiar la simulación (commit `b9010b88`). No interpretar esta falla de test como regresión del juego.

**Revalidación mínima del caso corregido:**

```powershell
cd "E:\Proyectos\JUEGOS\VoidRescue-III"
git -c gc.auto=0 fetch origin
git merge --ff-only origin/feat/phase4-vehicle-profiles
npx vitest run tests/unit/vehicle-profiles.test.ts -t "calcula el primer paso"
```

La rama ya existe localmente, por lo que no repetir `git switch --track`. No ejecutar de nuevo toda la batería ni activar GitHub Actions. El incremento continúa en desarrollo y pendiente de aceptación.

Si la rama ya existe localmente, usar `git switch feat/phase4-vehicle-profiles` y `git merge --ff-only origin/feat/phase4-vehicle-profiles` en vez de `--track`. No se han ejecutado estas pruebas desde el conector GitHub. No activar GitHub Actions ni publicar Pages. La fase 4 no se considera completada.


## Fase 4 — segundo incremento: modelo de helicóptero (27/10/2026)

**Primer incremento validado:** build correcto, 15/15 unitarias de núcleo y 12/12 E2E de vuelo; la prueba de primer tick corregida pasó **1/1** (3 omitidas solo por el filtro). No repetir sus pruebas sin cambios funcionales.

**Incremento 2 subido a `feat/phase4-vehicle-profiles` y todavía NO validado localmente:** geometría del helicóptero y rotores animados, `Renderer` capaz de representar `vehicleId: 'helicopter'` y volver a la nave, métricas de modelo visible y ruta de diagnóstico DEV. El menú, las preferencias y las partidas normales usan exclusivamente `ship`.

Validación acotada (hay cambios de render, por eso sí se incluye una regresión del vuelo antiguo):

```powershell
cd "E:\Proyectos\JUEGOS\VoidRescue-III"
git -c gc.auto=0 fetch origin
git merge --ff-only origin/feat/phase4-vehicle-profiles
npm run build
npx vitest run tests/unit/helicopter-model.test.ts tests/unit/vehicle-profiles.test.ts
npx playwright test tests/e2e/vehicle-visual.spec.ts tests/e2e/flight.spec.ts
```

Se esperan **7 pruebas unitarias** (3 de modelo + 4 perfiles) y **16 E2E** (4 nuevas de vehículo visual más 12 de vuelo en ambos backends). Las cifras son previstas, **no resultados**. La comprobación visual manual debe abrir `npm run dev`, usar herramientas de diagnóstico solo en modo desarrollo y corroborar que el modelo parece helicóptero, que los rotores giran y que la nave clásica reaparece al cargar un escenario sin seleccionar vehículo. No usar `main` para estas pruebas; no ejecutar GitHub Actions ni publicar.


## Fase 4 — rediseño solicitado tras primera prueba visual (27/10/2026)

El usuario comprobó el primer helicóptero con `window.__VOID_RESCUE__.loadScenario('flight-basic', 8042, 'helicopter')` y detectó tres problemas: aspecto de juguete, lentitud y altura mínima demasiado elevada. El **tercer incremento** ya está corregido en `feat/phase4-vehicle-profiles`: geometría utilitaria angular semejante a un helicóptero de rescate tipo Black Hawk, con ventanas, turbinas, tren de ruedas y mayor escala; velocidad tope 90 y ascenso/descenso ágil; suelo del helicóptero `Terrain.height(x)+3.8` incluso en `flight-basic`. La nave clásica no cambia.

**No se han ejecutado pruebas contra este rediseño.** Ejecutar únicamente:

```powershell
cd "E:\Proyectos\JUEGOS\VoidRescue-III"
git -c gc.auto=0 fetch origin
git merge --ff-only origin/feat/phase4-vehicle-profiles
npm run build
npx vitest run tests/unit/vehicle-profiles.test.ts tests/unit/helicopter-model.test.ts
npx playwright test tests/e2e/vehicle-visual.spec.ts
npm run dev
```

Vitest debe encontrar **10 casos** (6 perfiles + 4 modelos) y Playwright **6** (3 escenarios × 2 backends). Los números son expectativas, no aprobaciones. En el navegador DEV, usar la API diagnóstica existente para cargar `loadScenario('flight-basic', 8042, 'helicopter')`, volar manteniendo D/A, y bajar manteniendo S: las ruedas deben acercarse al terreno; la velocidad debe superar la de la nave normal. Validar silueta, tamaño y rotores también en pantalla real. `main` y el sistema de récords permanecen intactos; no ejecutar CI ni fusionar sin nueva aprobación.


## Fase 4 — corrección puntual de la animación de subida y bajada (27/10/2026)

**Petición exacta del usuario:** conservar las animaciones previas del helicóptero, e invertir exclusivamente el comportamiento al pulsar arriba/abajo. El intento previo cambió los ejes y tipos de inclinación, lo cual fue rechazado. No debe utilizarse su función `helicopterAttitude`; sus tests asociados también se retiraron. El usuario confirmó que el sonido ya funciona: **no modificar AudioEngine**.

**Implementación vigente en `Renderer.ts`:**
- Antes: `rotation.x = reducedMotion ? 0 : p.vy * 0.004`.
- Ahora: `rotation.x = reducedMotion ? 0 : -p.vy * 0.004`. **Solo se invirtió el signo.**
- Sin cambio: `rotation.z = reducedMotion ? 0 : -p.vx * 0.0015`.
- Sin cambio: `rotation.y = 0`, escala/modelo del helicóptero, rotores, velocidad, límite al terreno, motor de sonido y nave clásica.

La compilación y pruebas E2E anteriores correspondían a la **animación sustituta rechazada**, no a esta rectificación. Para este ajuste, confirmar únicamente compilación, modelo/rotores y evaluación visual real:

```powershell
cd "E:\Proyectos\JUEGOS\VoidRescue-III"
git -c gc.auto=0 fetch origin
git merge --ff-only origin/feat/phase4-vehicle-profiles
npm run build
npx vitest run tests/unit/helicopter-model.test.ts
npm run dev
```

El archivo de modelo contiene **4 pruebas** (no 6). Con `window.__VOID_RESCUE__.loadScenario('flight-basic', 8042, 'helicopter')`, verificar que **las mismas inclinaciones de antes** responden al revés a W/S o arriba/abajo. No repetir E2E por una inversión local del signo, salvo síntoma nuevo. Esperar confirmación visual, sin fusionar `main`.


## Fase 4 — prueba focalizada de sonido de helicóptero (27/10/2026)

El usuario aceptó la inversión puntual de arriba/abajo: **no cambiar la animación de nuevo**. El nuevo asunto es distinto: motor del helicóptero idéntico al zumbido de nave. El audio del helicóptero ya tiene dos capas procedurales nuevas (rotor pulsante y turbina) que entran por `vehicleId`, con pausa, volumen y silencio en el bus compartido. Se preservó el perfil sonoro de la nave.

En la rama `feat/phase4-vehicle-profiles`, ejecutar únicamente las pruebas relevantes a audio:

```powershell
cd "E:\Proyectos\JUEGOS\VoidRescue-III"
git -c gc.auto=0 fetch origin
git merge --ff-only origin/feat/phase4-vehicle-profiles
npm run build
npx vitest run tests/unit/helicopter-sound.test.ts tests/unit/engine-pitch.test.ts
npx playwright test tests/e2e/vehicle-visual.spec.ts tests/e2e/engine-pitch.spec.ts
npm run dev
```

Esperados **8 unitarias y 10 E2E** (cada una de las 5 pruebas E2E se ejecuta en Chromium automático y WebGL2). Estos no son resultados. Para oírlo, **primero pulsar INICIAR VUELO en el juego** (habilita AudioContext por interacción del navegador) y luego, en la consola de DevTools, ejecutar:

```javascript
window.__VOID_RESCUE__.loadScenario('flight-basic', 8042, 'helicopter')
```

Comprobar pulsación de palas más grave y grave de turbina, volumen/silencio y pausa; al volver a `'ship'` debe regresar exactamente el motor sonoro de la nave. No usar el menú de selección de vehículos (todavía no existe) ni fusionar a `main` sin autorización. Si no suena desde una sesión nueva de consola, comprobar primero que el usuario inició vuelo mediante clic real, antes de diagnosticar un fallo del sintetizador.


## Fase 4 — ajuste de escala tras aceptar el sonido (27/10/2026)

El usuario confirmó que el sonido propio del helicóptero **funciona, es distinto y adecuado**, y pidió reducir el tamaño que era desproporcionado frente a la nave clásica. Se cambió **solo la escala de render** de `1.18` a `0.56` (constante `HELICOPTER_GAME_SCALE`). Se ajustó la única cota física asociada, `groundClearance`, de `3.8` a `2.0` para mantener las ruedas visualmente próximas al terreno. No se han cambiado geometría, rotaciones, sonido ni velocidades. No hay nueva colisión 3D ni nuevos parámetros de dificultad.

**Verificación focalizada todavía pendiente:**

```powershell
cd "E:\Proyectos\JUEGOS\VoidRescue-III"
git -c gc.auto=0 fetch origin
git merge --ff-only origin/feat/phase4-vehicle-profiles
npm run build
npx vitest run tests/unit/helicopter-model.test.ts tests/unit/vehicle-profiles.test.ts
npx playwright test tests/e2e/vehicle-visual.spec.ts
npm run dev
```

Se esperan **11 unitarias** (5 del modelo y 6 de perfiles) y **8 E2E** (4 escenarios × dos backends); no son resultados. Iniciar vuelo para desbloquear audio y luego `window.__VOID_RESCUE__.loadScenario('flight-basic', 8042, 'helicopter')` en la consola. Comparar visualmente `'ship'` frente a `'helicopter'`: ancho total comparable, rotores y ventanas legibles, y ruedas aproximadamente al ras del suelo. Si la nueva escala reduce demasiado detalles, ajustar **solo** `HELICOPTER_GAME_SCALE`, preservando los demás elementos aceptados. No fusionar a `main` sin permiso.


## Fase 4 — habilitar selector y recogida propia del helicóptero (27/10/2026)

El selector de vehículo está en **pantalla de inicio**, antes de elegir `INICIAR VUELO`, junto a un texto que describe las reglas de rescate. La elección se conserva entre sesiones y `start()` carga el vehículo elegido en una **partida real**, no solo en diagnóstico. El helicóptero admite dos pasajeros y requiere mantener `E` (teclado) / `Y` (mando) estando a baja altura y menos de 20 unidades/s, luego entregarlos despacio en `FORTALEZA 01` en misión Rescatista. La nave mantiene su extracción y capacidad originales. Los récords se separan por vehículo y los previos se atribuyen a nave sin perderlos.

**Primera ejecución local:** las **16 unitarias pasaron** (6 rescate, 4 récords, 6 perfiles). `npm run build` se detuvo por `TS2300: Duplicate identifier 'VehicleId'` en `src/app/GameApp.ts`, y Playwright no pudo cargar la aplicación por el mismo error de parseo. La segunda importación del tipo fue eliminada en GitHub (commit `36d87ea4`). **El usuario revalidó `npm run build`: éxito, 59 módulos Vite compilados en 326 ms** tras fast-forward a `2a34a9f`. La advertencia de bundle mayor de 900 KB no bloquea. Ya están aprobadas las 16 unitarias y el build; **las E2E también se aprobaron: 12/12 en 26.2 s** (6 en Chromium automático + 6 en WebGL2). Ya no hay que repetir pruebas automáticas para este incremento. **Siguiente paso: prueba de juego manual.**

```powershell
cd "E:\Proyectos\JUEGOS\VoidRescue-III"
# Con la versión ya actualizada y comprobada:
npm run dev
```

Para prueba manual, elegir `Vehículo: Helicóptero de rescate` y `MISIÓN: Rescatista` en el **menú inicial** y pulsar `INICIAR VUELO`. No se requiere consola. Descender al ras del terreno, frenar, mantener E/Y junto a un colono hasta recogerlo; el HUD debe indicar `A BORDO 1/2`. Al recoger dos debe indicar cabina llena y exigir entrega en Fortaleza 01 para obtener plazas libres. Probar luego `Vehículo: Nave de rescate` con el haz clásico y comprobar que el audio e inclinaciones siguen como estaban. En récords, verificar selector `Récords: vehículo` y que los registros antiguos sigan en Nave.

No se ha cambiado `main`; no fusionar/deploy ni afirmar tests aprobados antes de resultados reales. Si surge un fallo, corregirlo **en la rama**, sin alterar sonidos/animaciones/tamaños ya aprobados.


**Git for Windows:** durante `git fetch`/compactación de objetos, se informaron advertencias `Unlink of file '.git/objects/pack/*.idx' failed` antes de que `git merge --ff-only` confirmara `Fast-forward` de `79ed3dc` a `ae3f283`. Probablemente archivos temporalmente bloqueados por un proceso en Windows; es **independiente** del error de TypeScript. No eliminar archivos `.idx` a mano. Si se repite, cerrar editores y procesos que inspeccionan el repositorio y continuar con verificación no destructiva (p. ej. `git status --short`, `git fsck --no-reflogs`) antes de considerar mantenimiento.
