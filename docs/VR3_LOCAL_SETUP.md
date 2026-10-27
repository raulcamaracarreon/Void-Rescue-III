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

## Entrega A de selección rectangular — rama aislada (26/10/2026)

**Estado:** implementada en GitHub en `feat/phase3-selection-tools`, **pendiente de ejecutar build y pruebas locales**. La rama parte de `main` ya fusionado (PR #1, commit `6ae999a`); `main` permanece estable. No activar GitHub Actions.

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
