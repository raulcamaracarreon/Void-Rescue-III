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

Abre `http://127.0.0.1:5173/`; entra en Personalizar paisaje. Verás **Tercer plano** (detrás de vehículos, paralaje 40–100%) y **Primer plano** (delante de vehículos, paralaje 100–135%). Activa ambos y elige **Edificios** en los dos. Prueba **Longitud lateral (%)** = 25 en el tercero y 65 en el primero, luego 100 % para comparar. Las franjas empiezan en x=0 del mundo y se repiten cada vuelta; debería haber tramos sin decoración, sin que los edificios cambien de proporción. Prueba también gradiente automático normal/inverso, los motivos anteriores, guardado, recarga, `?backend=webgl2` y, finalmente, combate/rescate en vuelo. El primer editor raster tipo Paint está implementado en esta rama, pendiente de validar sus propias pruebas E2E.

**Validación específica del gradiente extendido:** usa un paisaje automático con dos colores de contraste fuerte (por ejemplo, cielo claro y frente oscuro). Activa **Tercer plano → Gradiente automático** y **Primer plano → Gradiente automático** y comprueba la secuencia cielo → N fondos → tercero más oscuro → primero aún más oscuro. Invierte primero solo el tercero: su tono debe hacerse más claro sin igualar la penúltima montaña y el primero no debe cambiar. Invierte luego el primero y compara. Prueba también una paleta con cielo oscuro y frente claro, los paisajes avanzados y el cambio a manual. Al desactivar ambos planos del modo gradiente deben restaurarse los colores tradicionales de las montañas. Verifica la franja de vista previa y `?backend=webgl2`.

**Corrección del editor de dibujo (25/10/2026):** al iniciar un dibujo nuevo debe aparecer **288 × 96**. El selector permite 96 × 32, 192 × 64, 288 × 96 y 384 × 128. Cambia la resolución después de trazar y comprueba que el dibujo se conserva; deshaz el cambio y vuelve a hacerlo. En el vuelo, con la franja a 100 %, el dibujo debe conservar proporciones y repetirse en lugar de estirarse. Con 23 % de longitud lateral deben aparecer tres motivos completos y un cuarto recortado. Abre un dibujo guardado anteriormente a 96 × 32 para confirmar que no se cambia de resolución automáticamente.

**Para el primer incremento de fase 3:** cambia la opacidad a 100 % en ambos planos. Pulsa **Dibujar primer plano (Paint)** o **Dibujar tercer plano (Paint)** y prueba pincel, borrador, línea, rectángulo, limpiar, deshacer/rehacer y cancelar. Solo **Aplicar dibujo** debe guardar el bitmap, activar la capa y elegir `Dibujo propio`. Después, guarda un paisaje con nombre, cierra, recarga y verifica ambos dibujos. Confirma que los elementos siguen por delante y detrás de los vehículos respectivamente, que el gradiente invertido funciona y que las antiguas máscaras no se pierden al cambiar de motivo.

**Resultado confirmado por consola (25/10/2026):** 14 suites y 129 pruebas unitarias aprobadas; `tests/e2e/foreground.spec.ts`: 12/12 aprobadas en ambos proyectos de navegador. La suite específica `tests/e2e/decor-paint.spec.ts` todavía no se ha confirmado. No repetir pruebas ya aprobadas sin cambios funcionales.

No anunciar pruebas aprobadas hasta ejecutar realmente estos comandos. Si falla alguna, conservar la salida completa.

## Publicación

La rama de fase 3 no se fusiona a `main` ni se despliega automáticamente. Pages y el pipeline CI continúan manuales hasta autorización expresa del usuario.
