# AFI Frontend

Next.js App Router, React, TypeScript, Tailwind CSS, componentes shadcn/ui (Button/Radix/CVA), Lucide, React Hook Form, Zod, Recharts y Luxon. Repositorio independiente: todas las operaciones, incluida la autenticación, se realizan por HTTP contra AFIBACK. El navegador no consulta Supabase ni proveedores de IA directamente y no incluye su SDK.

## Desarrollo

```powershell
Copy-Item .env.example .env.local
npm.cmd ci
npm.cmd run dev
```

Abre `http://localhost:3000`.

- `NEXT_PUBLIC_API_URL`: URL pública del backend, incluyendo `/api/v1`.

Para el despliegue actual: `NEXT_PUBLIC_API_URL=https://afiback.vercel.app/api/v1`.
Usa el dominio estable de producción, no un hostname temporal de Preview.
Si omites el protocolo o el prefijo de API, el cliente los completa; todas las
rutas, incluidas las de recuperación, comparten esa normalización.
Después de cambiar el valor en Vercel, crea un nuevo despliegue del frontend.

Esta es la única variable necesaria. No configures claves de Supabase, credenciales de PostgreSQL ni claves de IA en este proyecto. En desarrollo se usa `http://localhost:4000/api/v1` si no se define la URL. No hay modo demo que simule persistencia financiera.

Aplica primero las migraciones del backend y configura las URL de Auth allí. La aplicación admite registro, confirmación por correo, inicio/cierre de sesión, recuperación y actualización de contraseña. El perfil inicial usa PEN y America/Lima. El navegador conserva la sesión en `afi-auth-session-v1` y solicita su renovación al backend, serializada entre pestañas. Solo se guardan los tokens de sesión y un resumen del usuario; nunca la contraseña. No hay cookies SSR ni datos financieros prerenderizados. Después de esta actualización, los usuarios con sesiones del cliente anterior deben volver a iniciar sesión.

El inicio de sesión y la recuperación aceptan usuarios cortos: `mramirez` se envía al backend como `mramirez@afi.com` y `ealva` como `ealva@afi.com`. El backend también normaliza y valida la identidad. Se admiten correos completos, conservando su dominio. El registro continúa solicitando un correo completo y al menos 12 caracteres de contraseña. El frontend no guarda ni comprueba contraseñas por su cuenta.

## Cambiar o recuperar contraseña

- Con sesión iniciada: abre **Configuración → Seguridad · Cambiar contraseña**. Ingresa la contraseña actual, una nueva de al menos 12 caracteres y su confirmación. Supabase valida y actualiza la clave; la aplicación limpia los campos al terminar. Hay un botón para mostrar u ocultar las contraseñas y mensajes de error específicos.
- Sin recordar la clave y sin buzón: pulsa **Olvidé mi contraseña**, escribe tu usuario y pulsa **Ver mi pregunta**. Responde tu pregunta de seguridad y elige una nueva clave con confirmación. Después del cambio vuelves al login. Tras cinco respuestas incorrectas debes esperar treinta minutos.
- Para configurarla por primera vez: desde tu sesión abre **Configuración → Pregunta de seguridad** y confirma con tu contraseña actual. Si aún no puedes entrar, **Configurar por primera vez** permite usar un código privado del administrador una sola vez. Define tú la pregunta y la respuesta; no hay respuestas preconfiguradas. Mayúsculas y espacios repetidos no afectan a la comparación; los acentos sí.
- Como alternativa, **Usar código de recuperación** permite cambiar directamente la clave con el código privado de treinta minutos y un solo uso, sin correo.
- Si tienes un buzón real, el botón **Recuperar por correo** mantiene disponible el enlace de Supabase. Un enlace válido permite definir la nueva clave; un enlace vencido indica cómo solicitar otro.
- Si Supabase solicita reautenticación adicional, el formulario permite enviar e ingresar el código de verificación del correo.

Usar el dominio `@afi.com` en la base de datos no crea un buzón. Para esas cuentas puedes usar la pregunta configurada o un código emitido desde el servidor con `npm run recovery:issue -- ealva mramirez` en el backend. La aplicación no permite cambiar claves únicamente conociendo el nombre de usuario. La respuesta se guarda únicamente como hash en el backend. Los datos secretos se limpian del formulario al completar la operación y no se incluyen en la URL.

Configura SMTP y las Redirect URLs de Supabase para permitir el origen de la aplicación (`http://localhost:3000` en local y el dominio HTTPS en producción). Las pruebas de navegador simulan Auth y no cambian contraseñas de los usuarios reales ni envían correos. Contrato de actualización: [Supabase Auth](https://supabase.com/docs/reference/javascript/auth-updateuser).

## Uso

### Configurar categorías

Abre **Configuración → Categorías de ingresos y egresos**. Verás dos grupos con su explicación: ingresos para dinero recibido y egresos para dinero gastado. Puedes buscar por nombre, crear una categoría eligiendo su tipo y renombrar las existentes con **Editar**. Cada grupo tiene un botón **Agregar categoría** que preselecciona su tipo. El mismo nombre puede existir en tipos distintos; se avisa si ya existe en el mismo tipo.

El tipo de una categoría existente se conserva para mantener la clasificación de los registros; si necesitas otra clasificación, crea una categoría del otro tipo. Los cambios se guardan por la API usando tu identidad, se reflejan en el asistente y los formularios, y no requieren volver a ejecutar SQL. La gestión sigue siendo manual: la IA utiliza las categorías configuradas y no crea otras por su cuenta.

### Asistente como pantalla inicial

Después de iniciar sesión se abre **Asistente AFI**, primero en la navegación. Puedes escribir «Gasté 25 soles en almuerzo» o pulsar **Registrar gasto / Registrar ingreso**. La conversación pregunta por tipo, monto, descripción, cuenta, categoría y fecha cuando faltan; la fecha siempre se revisa antes de confirmar. Las opciones usan cuentas activas de la misma moneda y categorías del tipo correspondiente. Si faltan, ofrece abrir la configuración manual.

Las preguntas de seguimiento, botones y respuestas simples se resuelven mediante reglas con el contexto existente, evitando una llamada al proveedor por cada dato. La interpretación libre inicial usa el backend de IA y su cuota. No se crean cuentas ni categorías desde la conversación.

El resumen se puede editar; solo **Confirmar y registrar** o un «sí/confirmo» explícito en ese paso crea el movimiento. Los ingresos se vinculan a la cuenta de destino y los gastos a la de origen. Los rechazos de negocio se pueden corregir. Si la respuesta de confirmación se pierde, se conserva la misma clave de idempotencia y se bloquean cambios hasta resolver el resultado. Al recargar, se recupera únicamente la referencia del borrador pendiente desde sessionStorage, se verifica su estado con el backend y se evita reenviar un registro ya completado. El chat en curso también se conserva mientras navegas por los otros módulos durante la sesión.

**Resumen general** sigue disponible desde el menú; el registro manual continúa accesible en la cabecera del asistente.

1. Crea cuentas con sus saldos iniciales y moneda.
2. Registra movimientos o utiliza el asistente si está habilitado en el backend.
3. Agrega tarjetas, compras y estados bancarios. Los estados determinan el importe facturado y mínimo reales.
4. Crea préstamos; el backend genera su cronograma y vencimientos.
5. Registra obligaciones recurrentes. La carga genera el mes seleccionado sin duplicar períodos.
6. Desde Pagos registra abonos o ajusta importe/fecha de un período. Leer recordatorios no marca pagos.
7. Configura presupuestos por moneda, período y categoría.
8. Reserva ahorro y luego asígnalo a metas; planificar no confirma dinero.
9. Crea un espacio e invita por enlace. La persona invitada debe registrarse o entrar con el correo indicado y aceptar el enlace. Las invitaciones no envían un correo desde AFI.
10. Para participación compartida y distribución porcentual, selecciona el objetivo y completa los porcentajes por nombre. El formulario muestra la suma; debe ser 100. El destino «Sin asignar» conserva su porcentaje en el fondo. El backend valida membresías y monedas. Reasignación utiliza selectores de origen y destino.

El dashboard consulta datos reales del backend y distingue monedas. Selecciona mes y moneda en las vistas financieras. Las fechas de los formularios se interpretan en la zona del perfil. CSV exporta el historial completo autorizado. Edición de un movimiento conserva el original anulado y crea su reemplazo en una transacción atómica.

Diseño mobile-first: sidebar contraíble, drawer móvil, formularios de una columna, tablas de movimientos convertidas en tarjetas, calendario compacto y modales adaptados al móvil. No se descargan fuentes externas durante el build; usa Inter/Geist si están disponibles y tipografía de sistema como respaldo.

## Verificación

```powershell
npm.cmd run typecheck
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run build
npm.cmd start
```

Playwright arranca en puerto 3100 con variables de prueba e intercepta HTTP/Auth. Verifica navegación de todos los módulos, ausencia de desbordamiento a 390/768/1440 píxeles, formulario de movimiento con clave de idempotencia, confirmación obligatoria de IA y distribución de ahorro por nombres. Las credenciales sintéticas de estas pruebas no acceden a servicios externos. Capturas y trazas quedan en `test-results/`, ignorado por Git. El correo y la conexión real con Supabase necesitan una comprobación adicional en staging.

## Vercel independiente

Importa **solo esta carpeta/repositorio** en Vercel; framework Next.js, build `npm run build`, dependencias `npm ci`, salida predeterminada. Configura únicamente `NEXT_PUBLIC_API_URL=https://TU-BACKEND/api/v1` antes del build. Puedes eliminar las antiguas variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_NAME` y `BACKED_URL`: ya no se usan. Permite el dominio frontend en `FRONTEND_URL` del backend. Cambiar la variable pública requiere reconstruir el frontend. Agrega el dominio Vercel y dominio final a las Redirect URLs de Supabase Auth, configuradas desde el backend/proyecto Supabase.

No hay despliegue automático ejecutado ni cuenta Vercel/Supabase vinculada. Consulta las reglas financieras y límites del backend antes de usar los gráficos como reporte contable.
