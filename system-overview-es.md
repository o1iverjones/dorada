# Pulpito — Descripción General del Sistema

Pulpito es una plataforma de gestión de interpretación médica para programar y coordinar intérpretes de idiomas profesionales en citas clínicas. Es un producto SaaS multi-inquilino que cuenta con un portal de administración web, una aplicación móvil para intérpretes y un servidor REST API.

---

## Tabla de Contenidos

1. [Estructura del Monorepo](#estructura-del-monorepo)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Modelos de Base de Datos](#modelos-de-base-de-datos)
4. [Servidor API](#servidor-api)
5. [Portal de Administración Web — Páginas](#portal-de-administración-web--páginas)
6. [Portal de Administración Web — Componentes y Widgets Compartidos](#portal-de-administración-web--componentes-y-widgets-compartidos)
7. [Portal de Administración Web — Hooks y Estado](#portal-de-administración-web--hooks-y-estado)
8. [Aplicación Móvil — Pantallas](#aplicación-móvil--pantallas)
9. [Paquetes Compartidos](#paquetes-compartidos)
10. [Autenticación y Seguridad](#autenticación-y-seguridad)
11. [Tiempo Real y Trabajos en Segundo Plano](#tiempo-real-y-trabajos-en-segundo-plano)

---

## Estructura del Monorepo

```
Dev/
├── apps/
│   ├── api/          # Fastify REST API + Prisma ORM
│   ├── web/          # React SPA (portal de administración)
│   └── mobile/       # React Native / Expo (app para intérpretes)
├── packages/
│   ├── types/        # Esquemas Zod y tipos TypeScript compartidos
│   └── i18n/         # Archivos de traducción compartidos (en, es)
```

---

## Stack Tecnológico

### API (`apps/api`)
| Capa | Tecnología |
|---|---|
| Runtime | Node.js (ESM) |
| Framework | Fastify |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| Autenticación | JWT (tokens de acceso + refresco), TOTP 2FA |
| Trabajos en segundo plano | BullMQ + Redis |
| Subida de archivos | Sistema de archivos local (`/uploads`) vía `@fastify/multipart` |
| Tiempo real | Socket.io |

### Portal de Administración Web (`apps/web`)
| Capa | Tecnología |
|---|---|
| Framework | React 18 |
| Enrutamiento | React Router v6 |
| Obtención de datos | TanStack Query (React Query) v5 |
| Formularios | React Hook Form + Zod |
| Estado global | Zustand |
| Internacionalización | react-i18next |
| Íconos | lucide-react |
| Primitivas de UI | shadcn/ui (Radix UI + Tailwind CSS) |
| Tiempo real | socket.io-client |

### Aplicación Móvil (`apps/mobile`)
| Capa | Tecnología |
|---|---|
| Framework | React Native + Expo |
| Enrutador | Expo Router (basado en archivos) |
| Autenticación | JWT almacenado en AsyncStorage |
| Estilos | React Native StyleSheet (tema personalizado en `src/theme.ts`) |
| Notificaciones | Indicador local en la barra de pestañas mediante polling |

---

## Modelos de Base de Datos

Los siguientes modelos de Prisma conforman la capa de datos:

| Modelo | Propósito |
|---|---|
| `Organization` | Inquilino raíz; todos los datos están acotados a una organización |
| `User` (Usuario Admin) | Usuarios del portal de administración con permisos basados en roles |
| `Role` / `RolePermission` | RBAC — roles con nombre y arreglos de indicadores de permisos |
| `UserPreferences` | Secreto MFA y preferencias por usuario |
| `RefreshToken` | Almacén persistente de tokens de refresco para rotación |
| `Interpreter` | Perfil del intérprete, incluyendo tarifa, idiomas y foto |
| `AvailabilityBlock` | Ventanas de disponibilidad declaradas por el intérprete |
| `Clinic` | Entidad de clínica médica con configuración de facturación e información de contacto |
| `ClinicInterpreterBlock` | Pares intérprete-clínica bloqueados |
| `InsuranceAgency` | Entidad de aseguradora con configuración de correo y confirmaciones |
| `Patient` | Perfil del paciente (nombre, fecha de nacimiento, MRN, idioma preferido) |
| `AppointmentType` | Categorías configurables de cita (ej. "Evaluación médica") |
| `Appointment` | Registro central de programación que vincula paciente, clínica, agencia e intérprete |
| `AppointmentActivity` | Registro de eventos inmutable por cita |
| `ActivityLog` | Bitácora de auditoría a nivel organizacional para todos los tipos de entidad |
| `AppointmentNote` | Notas administrativas de texto libre sobre una cita |
| `AppointmentOffer` | Registros de oferta enviados a intérpretes para una cita determinada |
| `FollowUpDraft` / `FollowUpResponse` / `FollowUpMedia` | Borradores de seguimiento post-cita generados automáticamente |
| `EmailIntakeLog` | Correos electrónicos entrantes recibidos para su procesamiento |
| `EmailIntakeExtraction` | Campos extraídos por IA del cuerpo del correo |
| `EmailIntakeDraft` | Cita borrador creada a partir de un correo, pendiente de revisión administrativa |
| `ReportJob` | Trabajo de generación de reporte asíncrono con estado, URL de archivo y filtros |
| `Message` | Mensajes de chat entre el administrador y el intérprete |
| `OrganizationLanguage` | Idiomas disponibles dentro de una organización |
| `LocaleString` | Traducciones de cadenas de UI sobreescribibles por organización |
| `SystemSettings` | Configuración a nivel de organización (zona horaria, tarifas, recordatorios) |
| `InterpreterRate` | Niveles de tarifa personalizados para facturación y compensación |

---

## Servidor API

Todas las rutas están montadas bajo `/api/v1`. La autenticación se aplica por ruta mediante hooks `preHandler` de Fastify.

### Autenticación (`/api/v1/auth`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/admin/login` | Inicio de sesión con correo + contraseña; devuelve token MFA o tokens de acceso/refresco |
| POST | `/auth/admin/mfa` | Envía código TOTP; devuelve tokens de acceso/refresco |
| POST | `/auth/admin/mfa-setup` | Genera el secreto TOTP y la URI del código QR |
| POST | `/auth/admin/mfa-confirm` | Confirma y activa el 2FA |
| POST | `/auth/refresh` | Intercambia token de refresco por nuevo token de acceso |
| POST | `/auth/interpreter/login` | Inicio de sesión con teléfono + PIN para la app móvil |

### Citas (`/api/v1/appointments`)
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/appointments` | manage_appointments | Lista con filtros (estado, rango de fechas, intérprete, clínica, paciente) |
| POST | `/appointments` | manage_appointments | Crear cita |
| GET | `/appointments/:id` | manage_appointments | Obtener una cita con sus relaciones |
| PATCH | `/appointments/:id` | manage_appointments | Actualizar campos de una cita |
| POST | `/appointments/:id/cancel` | manage_appointments | Cancelar cita |
| POST | `/appointments/:id/offers` | manage_appointments | Enviar oferta a uno o más intérpretes |
| GET | `/appointments/:id/activity` | manage_appointments | Registro de actividad por cita |
| GET | `/appointments/:id/admin-notes` | manage_appointments | Lista de notas administrativas |
| POST | `/appointments/:id/admin-notes` | manage_appointments | Agregar nota administrativa |
| GET | `/appointments/activity` | manage_appointments | Bitácora de actividad global de la org (tabla `ActivityLog`) |
| GET | `/appointments/follow-up-drafts` | manage_appointments | Listar borradores de seguimiento |
| PATCH | `/appointments/follow-up-drafts/:id` | manage_appointments | Aprobar o descartar borrador de seguimiento |
| POST | `/appointments/:id/clock-in` | interpreter | Registro de entrada del intérprete (móvil) |
| POST | `/appointments/:id/patient-arrived` | manage_appointments | Marcar llegada del paciente |
| GET | `/appointments/me/appointments` | interpreter | Lista de citas propias del intérprete (móvil) |

### Intérpretes (`/api/v1/interpreters`)
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/interpreters` | manage_interpreters | Listar todos los intérpretes de la organización |
| POST | `/interpreters` | manage_interpreters | Crear intérprete |
| GET | `/interpreters/:id` | manage_interpreters | Obtener perfil del intérprete |
| PATCH | `/interpreters/:id` | manage_interpreters | Actualizar campos del intérprete |
| DELETE | `/interpreters/:id` | manage_interpreters | Desactivar intérprete |
| POST | `/interpreters/:id/photo` | manage_interpreters | Subir foto de perfil (multipart) |
| GET | `/interpreters/availability-blocks` | manage_interpreters | Todos los bloques de disponibilidad (con filtros de fecha/intérprete) |
| GET | `/interpreters/me` | interpreter | Perfil propio del intérprete (móvil) |
| PATCH | `/interpreters/me` | interpreter | Actualizar perfil propio (móvil) |
| GET | `/interpreters/me/availability` | interpreter | Bloques de disponibilidad propios |
| POST | `/interpreters/me/availability` | interpreter | Agregar bloque de disponibilidad |
| DELETE | `/interpreters/me/availability/:block_id` | interpreter | Eliminar bloque de disponibilidad |

### Clínicas (`/api/v1/clinics`)
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/clinics` | manage_clinics | Listar clínicas |
| POST | `/clinics` | manage_clinics | Crear clínica |
| GET | `/clinics/:id` | manage_clinics | Obtener detalle de clínica |
| PATCH | `/clinics/:id` | manage_clinics | Actualizar clínica |
| DELETE | `/clinics/:id` | manage_clinics | Desactivar clínica |

### Aseguradoras (`/api/v1/insurance-agencies`)
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/insurance-agencies` | manage_clinics | Listar aseguradoras |
| POST | `/insurance-agencies` | manage_clinics | Crear aseguradora |
| GET | `/insurance-agencies/:id` | manage_clinics | Obtener detalle de aseguradora |
| PATCH | `/insurance-agencies/:id` | manage_clinics | Actualizar aseguradora |
| DELETE | `/insurance-agencies/:id` | manage_clinics | Desactivar aseguradora |

### Pacientes (`/api/v1/patients`)
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/patients` | manage_appointments | Listar pacientes (búsqueda, paginación) |
| POST | `/patients` | manage_appointments | Crear paciente |
| GET | `/patients/:id` | manage_appointments | Obtener detalle del paciente |
| PATCH | `/patients/:id` | manage_appointments | Actualizar paciente |

### Usuarios Administradores y Roles (`/api/v1`)
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/admin-users` | autenticado | Listar usuarios administradores de la organización |
| POST | `/admin-users` | manage_admin_users | Crear usuario administrador |
| PATCH | `/admin-users/:id` | manage_admin_users | Actualizar usuario administrador |
| GET | `/roles` | autenticado | Listar roles de la organización |
| POST | `/roles` | manage_admin_users | Crear rol con permisos |

### Reportes (`/api/v1/reports`)
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/reports` | view_reports | Listar reportes generados |
| POST | `/reports` | view_reports | Encolar trabajo de generación de reporte |
| GET | `/reports/:job_id` | view_reports | Consultar estado del trabajo / obtener URL de descarga |

### Mensajes (`/api/v1/messages`)
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/messages/conversations` | autenticado | Listar todas las conversaciones |
| GET | `/messages/conversations/:interpreterId` | autenticado | Obtener hilo de mensajes |
| POST | `/messages/conversations/:interpreterId` | autenticado | Enviar mensaje |
| POST | `/messages/conversations/:interpreterId/read` | autenticado | Marcar mensajes como leídos |

### Recepción de Correos (`/api/v1/email-intake`)
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/email-intake/logs` | manage_appointments | Lista de registros de correos entrantes |
| GET | `/email-intake/drafts` | manage_appointments | Citas borrador creadas desde correos |
| PATCH | `/email-intake/drafts/:id` | manage_appointments | Aprobar o descartar borrador |
| POST | `/email-intake/logs/:id/retry-confirmation` | manage_appointments | Reintentar envío de confirmación |

### Configuración (`/api/v1/settings`)
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/settings` | manage_system_settings | Obtener configuración del sistema de la organización |
| PATCH | `/settings` | manage_system_settings | Actualizar configuración del sistema |
| GET/PATCH | `/settings/languages` | manage_system_settings | Gestionar idiomas disponibles |
| GET/POST | `/settings/appointment-types` | manage_system_settings | Configuración de tipos de cita |
| GET/POST/DELETE | `/settings/interpreter-rates` | manage_system_settings | Niveles de tarifa personalizados |
| GET | `/settings/locale-strings` | manage_system_settings | Traducciones de UI sobreescribibles |

### Importación (`/api/v1/import`)
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/import/interpreters` | manage_interpreters | Importación masiva de intérpretes desde CSV |
| POST | `/import/clinics` | manage_clinics | Importación masiva de clínicas desde CSV |
| POST | `/import/agencies` | manage_clinics | Importación masiva de aseguradoras desde CSV |

---

## Portal de Administración Web — Páginas

Todas las páginas se encuentran en `apps/web/src/pages/`. La aplicación requiere autenticación (JWT almacenado en localStorage) y la mayoría de las rutas exigen permisos específicos aplicados por `PermissionGuard`.

---

### Página de Inicio de Sesión
**Archivo:** `pages/auth/LoginPage.tsx`  
**Ruta:** `/login` (pública)

Permite a los administradores iniciar sesión con correo electrónico y contraseña. Redirige a `/mfa` si la cuenta tiene 2FA activado; de lo contrario, emite tokens y redirige a `/dashboard`.

**Funcionalidades:**
- Formulario de correo + contraseña con validación
- Alternar visibilidad de contraseña
- Casilla "Recordarme" — persiste el correo en `localStorage` (`pulpito_remembered_email`) para autocompletar en la siguiente visita (la contraseña nunca se almacena)
- Autocompleta el correo recordado al montar el componente vía `useEffect`

**Llamadas a la API:**
- `POST /auth/admin/login`

**Dependencias:** react-hook-form, zod, react-i18next, useAuthStore (Zustand)

---

### Página MFA
**Archivo:** `pages/auth/MfaPage.tsx`  
**Ruta:** `/mfa`

Acepta un código TOTP de 6 dígitos después del inicio de sesión inicial cuando el 2FA está activo.

**Llamadas a la API:**
- `POST /auth/admin/mfa`

**Dependencias:** react-hook-form, useAuthStore

---

### Página de Configuración MFA
**Archivo:** `pages/auth/MfaSetupPage.tsx`  
**Ruta:** `/mfa-setup`

Guía al administrador en el proceso de activar el 2FA: muestra un código QR y confirma un código TOTP para activarlo.

**Llamadas a la API:**
- `POST /auth/admin/mfa-setup`
- `POST /auth/admin/mfa-confirm`

---

### Panel de Control (Dashboard)
**Archivo:** `pages/dashboard/DashboardPage.tsx`  
**Ruta:** `/dashboard`

Pantalla de inicio mostrada después del inicio de sesión. Ofrece un resumen en tiempo real de la actividad del día.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Reloj en Vivo | Muestra la hora y fecha actuales en la zona horaria configurada de la organización. Se actualiza cada 30 segundos. |
| Tarjetas de Estadísticas (×4) | Citas de hoy, Ofertas pendientes, Borradores de seguimiento, Borradores de correo. Cada una es un enlace a la página de lista correspondiente. |
| Agenda de Hoy | Lista desplazable de las citas del día con nombre del paciente, horario, clínica, agencia, intérprete e indicadores de estado para registro de entrada y llegada del paciente. |
| Bitácora de Actividad | Flujo cronológico a nivel de organización de todas las acciones administrativas (creaciones, actualizaciones, desactivaciones, generación de reportes). Renderiza enlaces clicables a las entidades. Proviene de la tabla `ActivityLog`. |
| Cola de Recepción de Correos | Vista previa de los borradores de correo pendientes de revisión, mostrando nombre del paciente y número de orden (PO). |

**Llamadas a la API:**
- `GET /appointments?date_from={today}&date_to={today}&limit=20`
- `GET /appointments?status=pending_offer&limit=5`
- `GET /appointments/follow-up-drafts?status=pending_review&limit=5`
- `GET /email-intake/drafts?status=pending_review&limit=5`
- `GET /appointments/activity?limit=50`

**Dependencias:** TanStack Query, react-i18next, lucide-react, useAuthStore, useOrgTimezone, formatInTz

---

### Página de Calendario
**Archivo:** `pages/appointments/CalendarPage.tsx`  
**Ruta:** `/calendar`  
**Permiso:** `manage_appointments`

Vista de calendario mensual y semanal de todas las citas. Las citas se muestran como bloques de colores en la cuadrícula y se pueden clicar para navegar a la página de detalle.

**Llamadas a la API:**
- `GET /appointments` (filtrado por el rango de fechas visible)

**Dependencias:** TanStack Query, react-i18next, lucide-react

---

### Página de Lista de Citas
**Archivo:** `pages/appointments/AppointmentsPage.tsx`  
**Ruta:** `/appointments`  
**Permiso:** `manage_appointments`

Tabla paginada y filtrable de todas las citas.

**Filtros:** Estado, rango de fechas, intérprete, clínica, paciente

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Barra de Filtros | Menús desplegables y selectores de fecha para acotar la lista |
| DataTable | Columnas: fecha/hora, paciente, intérprete, clínica, agencia, estado, duración |
| StatusBadge | Insignia de color según el estado de la cita |

**Llamadas a la API:**
- `GET /appointments` (con parámetros status, date_from, date_to, interpreter_id, clinic_id, patient_id)

**Dependencias:** TanStack Query, DataTable, StatusBadge, react-i18next

---

### Página de Nueva Cita
**Archivo:** `pages/appointments/NewAppointmentPage.tsx`  
**Ruta:** `/appointments/new`  
**Permiso:** `manage_appointments`

Formulario para crear una nueva cita. Admite autocompletado en los campos de paciente, clínica, aseguradora e intérprete.

**Llamadas a la API:**
- `POST /appointments`
- `GET /clinics` (para el menú desplegable)
- `GET /insurance-agencies` (para el menú desplegable)
- `GET /interpreters` (para el menú desplegable)
- `GET /patients` (para autocompletado)

**Dependencias:** react-hook-form, zod, AutocompleteInput, TanStack Query

---

### Página de Detalle de Cita
**Archivo:** `pages/appointments/AppointmentDetailPage.tsx`  
**Ruta:** `/appointments/:id`  
**Permiso:** `manage_appointments`

Vista completa de una sola cita con todos los datos relacionados, acciones e historial.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Tarjeta de Información de la Cita | Fecha/hora, duración, tipo, idioma, estado, paciente, clínica, agencia, intérprete |
| Botones de Acción por Estado | Acciones según el contexto: Cancelar, Marcar llegada del paciente, Enviar oferta, etc. |
| Notas Administrativas | Lista de notas administrativas con marca de tiempo y formulario para agregar nuevas |
| Línea de Tiempo de Actividad | Registro de eventos por cita desde `AppointmentActivity` |
| Panel de Ofertas al Intérprete | Muestra a qué intérpretes se les hizo una oferta y su estado de aceptación/rechazo |
| Tarjeta de Borrador de Seguimiento | Si existe un borrador de seguimiento, muestra los datos extraídos y controles de revisión |

**Llamadas a la API:**
- `GET /appointments/:id`
- `GET /appointments/:id/activity`
- `GET /appointments/:id/admin-notes`
- `POST /appointments/:id/admin-notes`
- `POST /appointments/:id/cancel`
- `POST /appointments/:id/offers`
- `POST /appointments/:id/patient-arrived`
- `PATCH /appointments/:id`

**Dependencias:** TanStack Query, react-hook-form, StatusBadge, lucide-react

---

### Página de Edición de Cita
**Archivo:** `pages/appointments/EditAppointmentPage.tsx`  
**Ruta:** `/appointments/:id/edit`  
**Permiso:** `manage_appointments`

Formulario de edición completo para una cita existente. Prellenado con todos los campos del registro actual.

**Llamadas a la API:**
- `GET /appointments/:id`
- `PATCH /appointments/:id`
- `GET /clinics`, `GET /insurance-agencies`, `GET /interpreters`, `GET /patients`

**Dependencias:** react-hook-form, zod, AutocompleteInput, TanStack Query

---

### Página de Borradores de Seguimiento
**Archivo:** `pages/appointments/FollowUpDraftsPage.tsx`  
**Ruta:** `/appointments/follow-up-drafts`  
**Permiso:** `manage_appointments`

Cola de borradores de seguimiento generados automáticamente que esperan revisión administrativa. Cada borrador se crea después de que un intérprete envía una respuesta de seguimiento.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Tarjeta de Borrador | Muestra paciente, cita, intérprete, notas extraídas y archivos adjuntos multimedia |
| Controles de Aprobar / Descartar | Botones de acción en línea para resolver cada borrador |

**Llamadas a la API:**
- `GET /appointments/follow-up-drafts?status=pending_review`
- `PATCH /appointments/follow-up-drafts/:id`

**Dependencias:** TanStack Query, StatusBadge, react-i18next

---

### Página de Lista de Intérpretes
**Archivo:** `pages/interpreters/InterpretersPage.tsx`  
**Ruta:** `/interpreters`  
**Permiso:** `manage_interpreters`

Tabla de todos los intérpretes de la organización con controles de búsqueda y filtrado.

**Filtros:** Búsqueda por nombre, tipo (certificado/calificado), idioma, activo/inactivo

**Llamadas a la API:**
- `GET /interpreters`

**Dependencias:** TanStack Query, DataTable, StatusBadge

---

### Página de Nuevo Intérprete
**Archivo:** `pages/interpreters/NewInterpreterPage.tsx`  
**Ruta:** `/interpreters/new`  
**Permiso:** `manage_interpreters`

Formulario para crear un nuevo perfil de intérprete.

**Campos:** Nombre, correo, teléfono, tipo, idiomas hablados, tarifa, contacto de emergencia, notas

**Llamadas a la API:**
- `POST /interpreters`

**Dependencias:** react-hook-form, zod, TanStack Query

---

### Página de Detalle del Intérprete
**Archivo:** `pages/interpreters/InterpreterDetailPage.tsx`  
**Ruta:** `/interpreters/:id`  
**Permiso:** `manage_interpreters`

Perfil completo del intérprete con edición en línea y datos asociados.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Tarjeta de Perfil | Foto, nombre, tipo, idiomas, información de contacto, tarifa. Modo de edición en línea. |
| InterpreterAvatar | Foto de perfil con botón de subida opcional |
| Bloques de Disponibilidad | Lista de ventanas de disponibilidad declaradas con controles para agregar y eliminar |
| Historial de Citas | Citas recientes asignadas a este intérprete |
| Botón de Desactivar | Desactivación lógica del intérprete tras confirmación |

**Llamadas a la API:**
- `GET /interpreters/:id`
- `PATCH /interpreters/:id`
- `DELETE /interpreters/:id`
- `POST /interpreters/:id/photo`
- `GET /appointments?interpreter_id=:id`

**Dependencias:** TanStack Query, react-hook-form, InterpreterAvatar

---

### Página de Lista de Clínicas
**Archivo:** `pages/clinics/ClinicsPage.tsx`  
**Ruta:** `/clinics`  
**Permiso:** `manage_clinics`

Tabla de todas las clínicas con un formulario de creación en línea accesible mediante un botón.

**Llamadas a la API:**
- `GET /clinics`
- `POST /clinics`

**Dependencias:** TanStack Query, DataTable

---

### Página de Detalle de Clínica
**Archivo:** `pages/clinics/ClinicDetailPage.tsx`  
**Ruta:** `/clinics/:id`  
**Permiso:** `manage_clinics`

Registro completo de la clínica con edición en línea.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Tarjeta de Información | Nombre, dirección, teléfono, nombre y correo del contacto principal. Modo de edición en línea. |
| Tarjeta de Configuración de Facturación | Tipo de facturación (por hora/tarifa fija), valor de la tarifa |
| Tarjeta de Estacionamiento / Notas | Instrucciones de estacionamiento en texto libre y notas administrativas |
| Botón de Desactivar | Desactivación lógica de la clínica tras confirmación |

**Llamadas a la API:**
- `GET /clinics/:id`
- `PATCH /clinics/:id`
- `DELETE /clinics/:id`

**Dependencias:** TanStack Query, react-hook-form

---

### Página de Lista de Aseguradoras
**Archivo:** `pages/insurance-agencies/InsuranceAgenciesPage.tsx`  
**Ruta:** `/insurance-agencies`  
**Permiso:** `manage_clinics`

Tabla de todas las aseguradoras.

**Llamadas a la API:**
- `GET /insurance-agencies`
- `POST /insurance-agencies`

**Dependencias:** TanStack Query, DataTable

---

### Página de Detalle de Aseguradora
**Archivo:** `pages/insurance-agencies/InsuranceAgencyDetailPage.tsx`  
**Ruta:** `/insurance-agencies/:id`  
**Permiso:** `manage_clinics`

Registro completo de la aseguradora con edición en línea.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Tarjeta de Información | Nombre, teléfono, correo, dirección. Modo de edición en línea. |
| Tarjeta de Configuración de Correo | Dirección de respuesta, dominio del remitente, anulación del método de confirmación, plantilla de respuesta personalizada |
| Botón de Desactivar | Desactivación lógica de la aseguradora |

**Llamadas a la API:**
- `GET /insurance-agencies/:id`
- `PATCH /insurance-agencies/:id`
- `DELETE /insurance-agencies/:id`

**Dependencias:** TanStack Query, react-hook-form

---

### Página de Lista de Pacientes
**Archivo:** `pages/patients/PatientsPage.tsx`  
**Ruta:** `/patients`  
**Permiso:** `manage_appointments`

Tabla paginada y con búsqueda de todos los registros de pacientes. Incluye un formulario de creación en línea.

**Llamadas a la API:**
- `GET /patients?search={q}&page={n}&limit={n}`
- `POST /patients`

**Dependencias:** TanStack Query, DataTable

---

### Página de Detalle del Paciente
**Archivo:** `pages/patients/PatientDetailPage.tsx`  
**Ruta:** `/patients/:id`  
**Permiso:** `manage_appointments`

Registro completo del paciente con edición en línea e historial de citas.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Tarjeta de Información | Nombre, fecha de nacimiento, MRN, teléfono, correo, idioma preferido. Modo de edición en línea. |
| Historial de Citas | Tabla de todas las citas de este paciente |

**Llamadas a la API:**
- `GET /patients/:id`
- `PATCH /patients/:id`
- `GET /appointments?patient_id=:id`

**Dependencias:** TanStack Query, react-hook-form, DataTable

---

### Página de Reportes
**Archivo:** `pages/reports/ReportsPage.tsx`  
**Ruta:** `/reports`  
**Permiso:** `view_reports`

Interfaz de generación de reportes con seguimiento del estado del trabajo y enlaces de descarga.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Formulario de Generación de Reporte | Selector de tipo de reporte, formato (PDF/CSV), rango de fechas y filtros opcionales de intérprete/agencia |
| Tarjeta de Estado del Trabajo | Muestra el estado actual del trabajo (en cola → procesando → completado/fallido) con consulta cada 3 segundos |
| Tabla de Historial de Reportes | Lista de reportes generados anteriormente con enlaces de descarga |

**Tipos de Reporte:**
- R1: Compensación de Intérpretes
- R2: Facturación de Aseguradoras
- R3: Historial de Citas
- R4: Desempeño de Intérpretes

**Llamadas a la API:**
- `POST /reports` — encolar un trabajo de reporte
- `GET /reports/:job_id` — consultar estado del trabajo (reintento cada 3s hasta estado terminal)
- `GET /reports` — historial de reportes

**Dependencias:** TanStack Query (con polling), react-hook-form, react-i18next

---

### Página de Mensajes
**Archivo:** `pages/messages/MessagesPage.tsx`  
**Ruta:** `/messages`

Interfaz de mensajería de dos paneles entre administradores e intérpretes.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Lista de Conversaciones | Panel izquierdo con todas las conversaciones de intérpretes ordenadas por actividad más reciente. Una sección "Recientes" eleva las conversaciones con actividad en los últimos 7 días. Muestra punto de no leído y vista previa del último mensaje. |
| Hilo de Mensajes | Panel derecho con el historial completo del chat, marcas de tiempo y campo de envío |
| Indicador de Escritura | Muestra "…" cuando la otra parte está escribiendo (vía Socket.io) |
| Insignia de No Leído | Punto naranja en los elementos de la lista de conversaciones y el ícono de navegación lateral |

**Llamadas a la API:**
- `GET /messages/conversations` (reintento cada 30s)
- `GET /messages/conversations/:interpreterId` (reintento cada 8s)
- `POST /messages/conversations/:interpreterId`
- `POST /messages/conversations/:interpreterId/read`

**Tiempo real:** Conexión Socket.io en sala `org:{organizationId}`. Eventos: `message`, `typing`.

**Dependencias:** socket.io-client, TanStack Query, hook useMessages, react-i18next

---

### Página de Recepción de Correos
**Archivo:** `pages/email-intake/EmailIntakePage.tsx`  
**Ruta:** `/email-intake`  
**Permiso:** `manage_appointments`

Registro de todos los correos entrantes recibidos por el sistema con su estado de procesamiento.

**Filtros:** Estado (pendiente, procesado, fallido)

**Llamadas a la API:**
- `GET /email-intake/logs`
- `POST /email-intake/logs/:id/retry-confirmation`

**Dependencias:** TanStack Query, DataTable, StatusBadge

---

### Página de Borradores de Recepción de Correos
**Archivo:** `pages/email-intake/EmailIntakeDraftsPage.tsx`  
**Ruta:** `/email-intake/drafts`  
**Permiso:** `manage_appointments`

Cola de revisión para borradores de citas extraídos automáticamente de correos entrantes.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Tarjeta de Revisión de Borrador | Muestra campos extraídos: nombre del paciente, número de orden (PO), fecha/hora, clínica, médico, idiomas. Resalta campos no resueltos o en conflicto. |
| Insignia de Campos No Resueltos | Insignia de advertencia cuando los campos extraídos tienen conflictos o valores faltantes |
| Advertencia de PO Duplicado | Alerta cuando el número de orden coincide con una cita existente |
| Controles de Aprobar / Descartar | Convertir borrador en cita activa o descartarlo |

**Llamadas a la API:**
- `GET /email-intake/drafts?status=pending_review`
- `PATCH /email-intake/drafts/:id`

**Dependencias:** TanStack Query, StatusBadge, react-i18next

---

### Página de Usuarios Administradores
**Archivo:** `pages/admin-users/AdminUsersPage.tsx`  
**Ruta:** `/admin-users`  
**Permiso:** `manage_admin_users`

Gestión de usuarios del portal de administración para la organización.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Tabla de Usuarios | Nombre, correo, rol, estado 2FA, activo/inactivo, último inicio de sesión |
| Formulario de Crear Usuario | Formulario en diálogo o en línea: nombre, correo, contraseña, asignación de rol |
| Controles de Edición de Usuario | Cambio de rol en línea, alternador de activar/desactivar |

**Llamadas a la API:**
- `GET /admin-users`
- `POST /admin-users`
- `PATCH /admin-users/:id`
- `GET /roles`

**Dependencias:** TanStack Query, react-hook-form, DataTable

---

### Página de Roles
**Archivo:** `pages/admin-users/RolesPage.tsx`  
**Ruta:** `/admin-users/roles`  
**Permiso:** `manage_admin_users`

Crear y gestionar roles con conjuntos de permisos específicos.

**Permisos Disponibles:**
- `manage_appointments`
- `manage_interpreters`
- `manage_clinics`
- `manage_admin_users`
- `view_reports`
- `manage_system_settings`

**Llamadas a la API:**
- `GET /roles`
- `POST /roles`

**Dependencias:** TanStack Query, react-hook-form

---

### Página de Configuración
**Archivo:** `pages/settings/SettingsPage.tsx`  
**Ruta:** `/settings`  
**Permiso:** `manage_system_settings`

Configuración a nivel de toda la organización.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Tarjeta de Configuración General | Selector de zona horaria de la organización, tarifas de pago predeterminadas (intérpretes certificados / calificados) |
| Tarjeta de Recordatorio de Seguimiento | Ventana de recordatorio (horas después de la cita), cantidad máxima de recordatorios |
| Tarjeta de Idiomas | Agregar o eliminar opciones de idioma disponibles para la organización |
| Tarjeta de Tipos de Cita | Crear y gestionar categorías de tipos de cita con mínimos de minutos facturables |
| Tarjeta de Tarifas de Intérpretes | Niveles de tarifa personalizados (nombre, tarifa por minuto/hora) para facturación y compensación |

**Llamadas a la API:**
- `GET /settings`
- `PATCH /settings`
- `GET/PATCH /settings/languages`
- `GET/POST /settings/appointment-types`
- `GET/POST/DELETE /settings/interpreter-rates`

**Dependencias:** TanStack Query, react-hook-form, react-i18next

---

### Página de Localización
**Archivo:** `pages/settings/LocalizationPage.tsx`  
**Ruta:** `/settings/localization`  
**Permiso:** `manage_system_settings`

Sobreescribir traducciones de cadenas de UI por organización.

**Llamadas a la API:**
- `GET /settings/locale-strings`
- `PATCH /settings/locale-strings`

---

### Página de Importación
**Archivo:** `pages/import/ImportPage.tsx`  
**Ruta:** `/import`  
**Permiso:** `manage_interpreters`

Herramienta de importación masiva por CSV para intérpretes, clínicas y aseguradoras.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Área de Subida de Archivos | Selector de archivo CSV por tipo de entidad con arrastrar y soltar o exploración |
| Vista Previa de Importación | Vista previa de filas analizadas antes de confirmar |
| Resumen de Resultado | Conteo de filas exitosas y fallidas después de la importación |

**Llamadas a la API:**
- `POST /import/interpreters`
- `POST /import/clinics`
- `POST /import/agencies`

**Dependencias:** TanStack Query, react-hook-form

---

### Página de Cuenta
**Archivo:** `pages/account/AccountPage.tsx`  
**Ruta:** `/account`

Configuración personal de cuenta para el usuario administrador actualmente conectado.

**Funcionalidades:** Cambiar nombre, cambiar contraseña, configurar/desactivar 2FA

**Llamadas a la API:**
- `PATCH /admin-users/:id` (cuenta propia)
- `POST /auth/admin/mfa-setup`
- `POST /auth/admin/mfa-confirm`

---

## Portal de Administración Web — Componentes y Widgets Compartidos

Ubicados en `apps/web/src/components/`.

---

### Layout: AppLayout
**Archivo:** `components/layout/AppLayout.tsx`

Envoltorio de layout raíz renderizado para todas las páginas autenticadas. Compone `Sidebar`, `TopBar` y un área de contenido `<main>`. No se renderiza en las páginas de autenticación (`/login`, `/mfa`, `/mfa-setup`).

---

### Layout: Sidebar
**Archivo:** `components/layout/Sidebar.tsx`

Barra de navegación lateral visible en todas las páginas autenticadas.

**Funcionalidades:**
- Logo y nombre de Pulpito en la parte superior
- Vínculos de navegación filtrados por permiso (los vínculos inaccesibles para el rol del usuario actual se ocultan completamente)
- Indicador de punto de mensaje no leído en el elemento de navegación de Mensajes (obtenido del hook `useUnreadMessageCount`, con polling cada 30s)
- Enlace de cuenta en la parte inferior

**Elementos de Navegación:**
Dashboard, Calendario, Citas, Intérpretes, Clínicas, Aseguradoras, Pacientes, Reportes, Mensajes, Recepción de Correos, Usuarios Admin, Configuración, Importación CSV

**Dependencias:** react-router-dom (NavLink), useAuthStore, useUnreadMessageCount, lucide-react

---

### Layout: TopBar
**Archivo:** `components/layout/TopBar.tsx`

Barra horizontal en la parte superior del área de contenido. Muestra el título de la página actual e información del usuario / botón de cierre de sesión.

---

### Layout: AuthGuard
**Archivo:** `components/layout/AuthGuard.tsx`

Envoltorio de ruta que redirige a usuarios no autenticados a `/login`. Lee el estado de autenticación desde `useAuthStore`.

---

### Layout: PermissionGuard
**Archivo:** `components/layout/PermissionGuard.tsx`

Envoltorio de ruta que verifica si el usuario conectado tiene el permiso requerido. Muestra un mensaje de "No autorizado" o redirige si la verificación falla.

**Props:** `permission: string`

---

### Compartido: DataTable
**Archivo:** `components/shared/DataTable.tsx`

Componente de tabla genérico y reutilizable utilizado en la mayoría de las páginas de lista.

**Props:**
- `columns` — definiciones de columna (etiqueta del encabezado, clave de acceso o función de renderizado)
- `data` — arreglo de objetos de fila
- `onRowClick` — manejador opcional de clic en fila
- `isLoading` — muestra filas de esqueleto mientras carga
- `emptyMessage` — texto mostrado cuando no hay datos

**Usado en:** AppointmentsPage, InterpretersPage, ClinicsPage, InsuranceAgenciesPage, PatientsPage, AdminUsersPage, EmailIntakePage, ReportsPage

---

### Compartido: StatusBadge
**Archivo:** `components/shared/StatusBadge.tsx`

Renderiza un `Badge` de color para cualquier cadena de estado. Convierte guiones bajos en espacios para la visualización.

**Mapeo de Estado → Color:**

| Estado | Color |
|---|---|
| `confirmed` | Verde (success) |
| `completed` | Gris (secondary) |
| `pending_offer` | Amarillo (warning) |
| `in_progress` | Azul (default) |
| `cancelled` | Rojo (destructive) |
| `no_show` | Rojo (destructive) |
| `pending_review` | Amarillo (warning) |
| `approved` | Verde (success) |
| `failed` | Rojo (destructive) |
| `active` | Verde (success) |
| `inactive` | Gris (secondary) |

**Usado en:** AppointmentsPage, AppointmentDetailPage, EmailIntakePage, ReportsPage

---

### Compartido: AutocompleteInput
**Archivo:** `components/shared/AutocompleteInput.tsx`

Menú desplegable con búsqueda que filtra una lista de opciones proporcionada mientras el usuario escribe. Admite modos de búsqueda por valor (búsqueda por ID) y de texto libre.

**Props:**
- `options: { value: string; label: string }[]`
- `value: string` — valor actualmente seleccionado
- `onChange: (value: string) => void`
- `placeholder?: string`
- `freeText?: boolean` — cuando es verdadero, almacena la etiqueta escrita directamente en lugar de buscar un ID

**Usado en:** NewAppointmentPage, EditAppointmentPage (campos de paciente, clínica, agencia, intérprete, médico referente)

**Dependencias:** Estado de React (abrir/cerrar desplegable), detección de clic externo vía `useEffect`

---

### Compartido: InterpreterAvatar
**Archivo:** `components/shared/InterpreterAvatar.tsx`

Muestra la foto de perfil de un intérprete. Vuelve a las iniciales si no hay foto. Opcionalmente muestra un botón de subida en contextos de administración.

**Props:**
- `interpreter: { name: string; profile_picture_url?: string | null }`
- `size?: "sm" | "md" | "lg"`
- `editable?: boolean`
- `onUpload?: (file: File) => void`

**Usado en:** InterpreterDetailPage, paneles de detalle de cita

---

### Compartido: PageHeader
**Archivo:** `components/shared/PageHeader.tsx`

Layout de encabezado de página estándar con título, descripción opcional y espacio para acciones opcional (ej. botón "Nuevo +").

**Props:**
- `title: string`
- `description?: string`
- `actions?: React.ReactNode`

**Usado en:** La mayoría de las páginas de lista y detalle

---

### Compartido: LoadingSpinner
**Archivo:** `components/shared/LoadingSpinner.tsx`

Indicador de carga animado centrado, mostrado mientras los datos están cargando.

**Usado en:** DashboardPage, páginas de detalle durante la carga inicial

---

### Primitivas de UI (`components/ui/`)

Envoltorios delgados alrededor de componentes de Radix UI / shadcn. No son específicos de la aplicación pero se usan en toda ella:

| Componente | Descripción |
|---|---|
| `Badge` | Etiqueta de estado en forma de píldora con prop `variant` (default, success, warning, destructive, outline, secondary) |
| `Button` | Botón estándar con variantes y tamaños |
| `Card` / `CardHeader` / `CardContent` / `CardTitle` | Tarjeta contenedora con secciones de encabezado y contenido |
| `Dialog` / `DialogContent` / `DialogHeader` | Envoltorio de diálogo modal |
| `Input` | Campo de texto con estilos |
| `Label` | Etiqueta de campo de formulario |
| `Select` / `SelectTrigger` / `SelectContent` / `SelectItem` | Menú desplegable con estilos |
| `Toast` / `Toaster` | Sistema de notificaciones toast (mostradas en éxito/fallo de mutaciones) |

---

## Portal de Administración Web — Hooks y Estado

### Zustand Auth Store
**Archivo:** `src/store/auth.ts`  
**Persistencia:** clave `pulpito_auth` en `localStorage`

| Campo / Método | Descripción |
|---|---|
| `user` | Objeto `AdminUser` del usuario conectado (id, nombre, correo, permisos, organización) |
| `mfaToken` | Token MFA temporal mantenido entre el inicio de sesión y la confirmación MFA |
| `setUser(user)` | Establece el usuario autenticado |
| `setMfaToken(token)` | Establece el token de sesión MFA |
| `hasPermission(permission)` | Devuelve verdadero si el rol del usuario incluye el permiso dado |
| `logout()` | Limpia el estado y los tokens de localStorage |

---

### TanStack Query Client
**Archivo:** `src/lib/queryClient.ts`

Cliente de consulta global. El caché de consultas se invalida en las mutaciones. Estrategias de reconsulta por hook:

| Hook / Consulta | Intervalo de reconsulta |
|---|---|
| Lista de conversaciones | 30 segundos |
| Hilo de mensajes | 8 segundos |
| Estado del trabajo de reporte | 3 segundos (hasta estado terminal) |
| Todos los demás | Al montar + al enfocar la ventana (predeterminado) |

---

### `useMessages`
**Archivo:** `src/hooks/useMessages.ts`

Encapsula todas las llamadas a la API de mensajería y la integración con Socket.io.

- `useConversations()` — lista todas las conversaciones de intérpretes
- `useThread(interpreterId)` — hilo de una sola conversación
- `useSendMessage(interpreterId)` — mutación para enviar un mensaje
- `useMarkRead(interpreterId)` — mutación para marcar el hilo como leído
- `useUnreadMessageCount()` — conteo de conversaciones con mensajes no leídos (usado por el punto del Sidebar)

Eventos de Socket.io manejados: `message` (nuevo mensaje entrante), `typing` (indicador de escritura)

---

### `useSettings` / `useOrgTimezone`
**Archivo:** `src/hooks/useSettings.ts`

- `useSystemSettings()` — objeto completo de configuración de la organización
- `useOrgTimezone()` — extrae solo la cadena de zona horaria; se usa en toda la app para las llamadas a `formatInTz`
- `useLanguages()` — idiomas habilitados de la organización
- `useAppointmentTypes()` — tipos de cita configurados
- `useInterpreterRates()` — niveles de tarifa personalizados

---

### Cliente API
**Archivo:** `src/lib/api.ts`

Envoltorio delgado alrededor de `fetch`. Adjunta `Authorization: Bearer {token}` a cada solicitud. Ante una respuesta 401, intenta un refresco automático de token vía `POST /auth/refresh`. Si el refresco falla, llama a `useAuthStore.logout()`.

Métodos: `api.get<T>()`, `api.post<T>()`, `api.patch<T>()`, `api.put<T>()`, `api.delete<T>()`, `api.uploadFile<T>()`

---

### Utilidades de Zona Horaria
**Archivo:** `src/lib/timezone.ts`

- `formatInTz(date, options, tz)` — formatea una fecha/hora en la zona horaria de la organización usando `Intl.DateTimeFormat`
- `fromTzDateTimeInput(localString, tz)` — convierte un valor de entrada `datetime-local` (en la zona horaria de la org) a una cadena ISO UTC para la API
- `toTzDateTimeInput(isoString, tz)` — convierte una cadena ISO UTC de la API a un valor `datetime-local` para mostrar en los campos de formulario

---

## Aplicación Móvil — Pantallas

La aplicación móvil es exclusiva para intérpretes. Utiliza Expo Router con navegación basada en pestañas. Todas las pantallas requieren autenticación JWT a nivel de intérprete. El esquema de colores refleja el del portal web (verde bosque profundo `#0e402d` / acento lima `#9fcc2e`) definido en `src/theme.ts`.

### Pantalla de Inicio de Sesión
**Archivo:** `app/login.tsx`  
**Ruta:** `/login`

Formulario de inicio de sesión con número de teléfono + PIN. Muestra el logo y nombre de Pulpito.

**Funcionalidades:**
- El prefijo `+` del código de país es opcional — se normaliza automáticamente antes de enviar
- El número de teléfono se persiste en `AsyncStorage` para autocompletar en la siguiente apertura ("recordar teléfono")
- Entrada de PIN con teclado numérico

**Llamadas a la API:**
- `POST /auth/interpreter/login`

---

### Pestaña de Citas
**Archivo:** `app/(tabs)/appointments.tsx`  
**Ruta:** `/` (pestaña predeterminada)

Lista de las citas asignadas al intérprete, agrupadas por fecha.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Tarjeta de Cita | Fecha/hora, nombre del paciente, clínica, idioma, insignia de estado |
| Insignia de Estado | Con código de color según el estado de la cita |
| Actualizar al Bajar (Pull-to-Refresh) | Reconsulta al deslizar hacia abajo |

**Llamadas a la API:**
- `GET /interpreters/me/appointments`

---

### Pantalla de Detalle de Cita
**Archivo:** `app/appointment/[id].tsx`  
**Ruta:** `/appointment/:id`

Detalle completo de la cita para el intérprete.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Tarjeta de Información | Fecha/hora, dirección de la clínica, idioma del paciente, duración |
| Botón de Registro de Entrada | Marca al intérprete como llegado a la cita |
| Visualización de Estado | Estado actual de la cita |

**Llamadas a la API:**
- `GET /appointments/:id` (con alcance de intérprete)
- `POST /appointments/:id/clock-in`

---

### Pestaña de Disponibilidad
**Archivo:** `app/(tabs)/availability.tsx`

Bloques de disponibilidad autogestionados por el intérprete — ventanas de tiempo en las que está disponible para asignaciones.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Lista de Bloques de Disponibilidad | Cada bloque muestra el día de la semana y el horario de inicio/fin |
| Formulario para Agregar Bloque | Selectores de día, hora de inicio y hora de fin |
| Botón de Eliminar | Elimina un bloque |

**Llamadas a la API:**
- `GET /interpreters/me/availability`
- `POST /interpreters/me/availability`
- `DELETE /interpreters/me/availability/:block_id`

---

### Pestaña de Mensajes
**Archivo:** `app/(tabs)/messages.tsx`

Interfaz de chat para que el intérprete se comunique con los administradores.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Hilo de Mensajes | Lista desplazable de mensajes con marcas de tiempo |
| Campo de Envío | Campo de texto + botón de enviar |
| Punto No Leído | Punto naranja en el ícono de la pestaña cuando hay mensajes no leídos del administrador |

**Llamadas a la API:** Polling cada 1 segundo (sin Socket.io en móvil)
- `GET /messages/conversations/me` (o equivalente)
- `POST /messages/conversations/:adminId`
- `POST /messages/conversations/:adminId/read`

---

### Pestaña de Perfil
**Archivo:** `app/(tabs)/profile.tsx`

Visor y editor del perfil propio del intérprete.

**Tarjetas y Widgets:**

| Widget | Descripción |
|---|---|
| Tarjeta de Perfil | Nombre, teléfono, correo, idiomas, tipo |
| Modo de Edición | Alternar para editar nombre, correo y preferencias de notificación |
| Botón de Cerrar Sesión | Limpia los tokens de AsyncStorage y regresa a la pantalla de inicio de sesión |

**Llamadas a la API:**
- `GET /interpreters/me`
- `PATCH /interpreters/me`

---

### Layout de la Barra de Pestañas
**Archivo:** `app/(tabs)/_layout.tsx`

Configura la barra de pestañas inferior y las opciones de encabezado compartidas para todas las pestañas.

**Funcionalidades:**
- Color de pestaña activa: `#0e402d` (verde bosque)
- Barra de encabezado verde con texto blanco en todas las pestañas
- Logo de Pulpito en la esquina superior derecha de cada pantalla (componente `HeaderLogo`)
- Polling de mensajes no leídos cada 5 segundos → muestra punto de notificación naranja en el ícono de la pestaña de Mensajes

---

## Paquetes Compartidos

### `@pulpito/types`
**Ubicación:** `packages/types/`

Esquemas Zod compartidos entre la API y la aplicación web para validación de solicitudes/respuestas.

Los esquemas clave incluyen:
- `CreateAppointmentBodySchema`, `UpdateAppointmentBodySchema`
- `CreateInterpreterBodySchema`, `UpdateInterpreterBodySchema`, `UpdateSelfInterpreterBodySchema`
- `CreateClinicBodySchema`, `UpdateClinicBodySchema`
- `CreateInsuranceAgencyBodySchema`, `UpdateInsuranceAgencyBodySchema`
- `CreatePatientBodySchema`, `UpdatePatientBodySchema`
- `InterpreterListQuerySchema`, `ClinicListQuerySchema`, `InsuranceAgencyListQuerySchema`
- `GenerateReportBodySchema`, `ReportListQuerySchema`
- `CreateAvailabilityBlockBodySchema`

Todos los esquemas se usan en la API para el análisis de `req.body` y en la web para la validación de formularios vía `@hookform/resolvers/zod`.

---

### `@pulpito/i18n`
**Ubicación:** `packages/i18n/`

Archivos de traducción para el portal de administración web en inglés (`en.json`) y español (`es.json`).

Espacios de nombres clave dentro del archivo JSON plano único:
- `nav.*` — etiquetas de navegación lateral
- `auth.*` — cadenas de pantallas de autenticación
- `dashboard.*` — etiquetas del panel de control
- `appointments.*` — cadenas del módulo de citas
- `interpreters.*` — cadenas del módulo de intérpretes
- `clinics.*` — cadenas del módulo de clínicas
- `insurance_agencies.*` — cadenas de aseguradoras
- `patients.*` — cadenas del módulo de pacientes
- `reports.*` — cadenas de reportes
- `messages.*` — cadenas de mensajería
- `email_intake.*` — cadenas de recepción de correos
- `admin_users.*` — cadenas de gestión de usuarios administradores
- `settings.*` — cadenas del módulo de configuración
- `common.*` — etiquetas genéricas (guardar, cancelar, editar, confirmar, etc.)

---

## Autenticación y Seguridad

### Flujo de Token JWT (Portal Web de Administración)
1. `POST /auth/admin/login` → devuelve `mfa_token` (si 2FA está activado) o `access_token` + `refresh_token`
2. Si 2FA: `POST /auth/admin/mfa` con `mfa_token` + código TOTP → devuelve `access_token` + `refresh_token`
3. Tokens almacenados en `localStorage` (`pulpito_access_token`, `pulpito_refresh_token`)
4. Encabezado `Authorization: Bearer {access_token}` enviado con cada solicitud a la API
5. Ante 401: el cliente API llama automáticamente a `POST /auth/refresh` → almacena nuevos tokens → reintenta la solicitud original
6. Si el refresco falla: se llama a `logout()`, el usuario es redirigido a `/login`

### RBAC (Control de Acceso Basado en Roles)
- A cada usuario administrador se le asigna un `Role`
- Cada `Role` tiene un arreglo de cadenas de permisos
- Los permisos se verifican en dos lugares:
  - **API**: el preHandler `requirePermission(perm)` de Fastify devuelve 403 si no coincide
  - **Web**: el componente `PermissionGuard` oculta rutas; `Sidebar` oculta vínculos de navegación; `hasPermission()` del store de Zustand controla las acciones de la UI

### Flujo de Token JWT (Móvil / Intérprete)
1. `POST /auth/interpreter/login` con teléfono + PIN → devuelve `access_token` + `refresh_token`
2. Tokens almacenados en `AsyncStorage`
3. Token Bearer enviado con cada solicitud

---

## Tiempo Real y Trabajos en Segundo Plano

### Socket.io (Mensajería Web)
- El servidor emite eventos a la sala `org:{organizationId}` al recibir nuevos mensajes
- El cliente web se une a la sala al montar `MessagesPage`
- Eventos: `message` (nuevo mensaje recibido), `typing` (indicador de escritura)
- La aplicación móvil no usa Socket.io — en su lugar consulta la API de mensajes cada 1 segundo

### Cola de Reportes BullMQ
- `POST /reports` encola un trabajo en la `reportQueue` (respaldada por Redis vía BullMQ)
- Un trabajador en segundo plano recoge el trabajo, ejecuta las consultas, genera el archivo PDF/CSV y actualiza el estado de `ReportJob` en la base de datos
- El cliente web consulta `GET /reports/:job_id` cada 3 segundos hasta que el estado es `completed` o `failed`
- Los trabajos completados incluyen una URL de descarga que apunta al archivo generado

### Bitácora de Actividad (tabla `ActivityLog`)
Todas las mutaciones administrativas se escriben en el `ActivityLog` global de la organización mediante el helper compartido `src/lib/activityLog.ts`. El panel de control lee las 50 entradas más recientes. Tipos de entidad cubiertos:

| Tipo de Entidad | Acciones Registradas |
|---|---|
| `appointment` | created, updated, cancelled, cambios de estado |
| `clinic` | created, updated, deactivated |
| `interpreter` | created, updated, deactivated |
| `agency` | created, updated, deactivated |
| `admin_user` | created, updated, role_created |
| `report` | generated |
