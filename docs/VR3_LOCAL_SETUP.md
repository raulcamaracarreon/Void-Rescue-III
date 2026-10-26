# Void Rescue III — pruebas locales (repositorio propio)

Void Rescue III reside en el repositorio [raulcamaracarreon/Void-Rescue-III](https://github.com/raulcamaracarreon/Void-Rescue-III). VR2 permanece independiente.

## Carpeta local del proyecto

`E:\Proyectos\JUEGOS\VoidRescue-III`

La rama `main` es la base que el usuario comprobó con 16 pruebas Playwright aprobadas. Las mejoras nuevas se preparan en ramas específicas y se validan antes de fusionar. El antiguo remoto `vr2-base` es sólo referencia histórica; **no subir VR3 a VR2**.

## Probar el ajuste de gradientes, edificios y longitud lateral

En PowerShell, cerrar antes cualquier servidor Vite en esa carpeta con Ctrl+C. Comprobar que no existan cambios versionados pendientes:

```powershell
cd "E:\Proyectos\JUEGOS\VoidRescue-III"
git status --short --branch
git fetch origin
git switch --track origin/feat/decor-buildings-and-span
npm ci
npm run build
npm run test
npx playwright test tests/e2e/landscape.spec.ts tests/e2e/foreground.spec.ts
npm run dev
```

En caso de que la rama local ya exista, usar `git switch feat/decor-buildings-and-span` en lugar del comando con `--track`. No borrar capturas locales `docs/screenshots/*.png`; son archivos no versionados generados por Playwright.

Abre `http://127.0.0.1:5173/`; entra en Personalizar paisaje. Verás **Tercer plano** (detrás de vehículos, paralaje 40–100%) y **Primer plano** (delante de vehículos, paralaje 100–135%). Activa ambos y elige **Edificios** en los dos. Prueba **Longitud lateral (%)** = 25 en el tercero y 65 en el primero, luego 100 % para comparar. Las franjas empiezan en x=0 del mundo y se repiten cada vuelta; debería haber tramos sin decoración, sin que los edificios cambien de proporción. Prueba también gradiente automático normal/inverso, los motivos anteriores, guardado, recarga, `?backend=webgl2` y, finalmente, combate/rescate en vuelo. No hay editor de dibujo libre todavía.

No anunciar pruebas aprobadas hasta ejecutar realmente estos comandos. Si falla alguna, conservar la salida completa.

## Publicación

La rama de ampliación de fase 2 no se fusiona a `main` ni se despliega automáticamente. Pages y el pipeline CI continúan manuales hasta autorización expresa del usuario.
