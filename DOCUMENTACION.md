# 📖 Biblioteca Comunitaria Virtual — Documentación Completa

> **Última actualización:** 26 de agosto de 2026  
> **Versión:** 1.3.0  
> **Stack:** Express.js + Vanilla JS SPA + JSON file persistence

---

## 📋 Tabla de Contenidos

1. [Resumen del Proyecto](#1-resumen-del-proyecto)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Instalación y Ejecución](#3-instalación-y-ejecución)
4. [Arquitectura General](#4-arquitectura-general)
5. [Base de Datos (JSON)](#5-base-de-datos-json)
6. [API REST (Backend)](#6-api-rest-backend)
7. [Frontend (SPA Vanilla JS)](#7-frontend-spa-vanilla-js)
8. [Router (SPA Hash-Based)](#8-router-spa-hash-based)
9. [Componentes UI](#9-componentes-ui)
10. [Estilos CSS](#10-estilos-css)
11. [Sesiones y Autenticación](#11-sesiones-y-autenticación)
12. [Guía para Agregar Nuevas Funcionalidades](#12-guía-para-agregar-nuevas-funcionalidades)
13. [Endpoints Pendientes / Ideas](#13-endpoints-pendientes--ideas)
14. [Problemas Conocidos](#14-problemas-conocidos)
15. [Convenciones de Código](#15-convenciones-de-código)

---

## 1. Resumen del Proyecto

**Biblioteca Comunitaria Virtual** es una plataforma web tipo SPA (Single Page Application) donde los usuarios pueden:

- **Explorar** un catálogo de libros y documentos organizados por categorías
- **Buscar** por título, autor o etiquetas
- **Registrarse e iniciar sesión** para acceder a funciones premium
- **Subir documentos** (PDF, EPUB, MOBI, DOC, DOCX) con metadatos
- **Calificar libros** con estrellas (1-5) y ver promedio
- **Comentar** y reseñar documentos, con paginación
- **Compartir libros** vía Web Share API o copiar link al portapapeles
- **Descargar archivos reales** desde el servidor
- **Marcar favoritos** y llevar un historial de lecturas
- **Editar y eliminar** libros propios desde la página de detalle
- **Editar perfil** (nombre, email, contraseña) con validación
- **Navegar por categorías** con conteo de documentos
- **Ver perfiles** de usuarios y sus estanterías
- **Modo oscuro** con toggle persistente
- **Skeleton loading** en todas las páginas principales
- **Panel de administración** con gestión de usuarios y documentos

**Base de datos:** Vacía al iniciar. Los usuarios se registran creando su propia cuenta. El primer usuario registrado puede ser promovido a admin desde la base de datos.

---

## 2. Estructura del Proyecto

```
biblioteca-comunitaria/
├── index.html                  # Punto de entrada HTML (SPA shell)
├── package.json                # Dependencias y scripts
├── package-lock.json
│
├── css/
│   └── styles.css              # Estilos completos (~1500 líneas, incluye dark mode y skeletons)
│
├── js/                         # Frontend vanilla JS
│   ├── store.js                # Cliente API (comunicación con backend)
│   ├── router.js               # Router hash-based para SPA
│   ├── components.js           # Funciones de renderizado de UI
│   └── app.js                  # Controlador principal (lógica de páginas)
│
├── server/                     # Backend Express.js
│   ├── index.js                # Entry point del servidor
│   ├── db.js                   # Capa de persistencia (JSON file)
│   └── routes/
│       ├── auth.js             # Rutas: registro, login, logout, sesión
│       ├── books.js            # Rutas: CRUD libros, búsqueda, favoritos, ratings, comments
│       ├── users.js            # Rutas: perfil, estadísticas, historial
│       └── admin.js            # Rutas: panel de administración (CRUD usuarios/libros)
│
├── data/
│   └── biblioteca.json         # Base de datos JSON (persistencia)
│
├── assets/                     # (Vacío — reservado para imágenes estáticas)
│
└── DOCUMENTACION.md            # Este archivo
```

**Nota:** El usuario Ana García (id: 1) tiene rol `admin` por defecto. Los nuevos usuarios se registran con rol `user`.
```

---

## 3. Instalación y Ejecución

```bash
# 1. Instalar dependencias
cd biblioteca-comunitaria
npm install

# 2. Ejecutar en modo producción
npm start
# → http://localhost:3000

# 3. Ejecutar en modo desarrollo (con auto-reload)
npm run dev
# → http://localhost:3000 (reinicia automáticamente al guardar archivos)
```

**Puerto configurable:** `PORT=8080 npm start`

**Nota:** La base de datos inicia vacía. Para usar el panel de admin, edita `data/biblioteca.json` y cambia el campo `role` de un usuario a `"admin"`, o registra un usuario y Promuevelo manualmente.

---

## 4. Arquitectura General

```
┌─────────────────────────────────────────────┐
│                  BROWSER                     │
│                                              │
│  index.html (SPA shell)                      │
│  ├── store.js    → Llamadas fetch() a API   │
│  ├── router.js   → Manejo de rutas #/path   │
│  ├── components.js → Renderizado HTML        │
│  └── app.js      → Lógica, handlers, init   │
│                                              │
└──────────────────┬──────────────────────────┘
                   │ HTTP (fetch API)
                   ▼
┌─────────────────────────────────────────────┐
│              EXPRESS SERVER                  │
│  server/index.js                             │
│  ├── Middleware: CORS, JSON, Session, Static │
│  ├── /api/auth/*   → Rutas autenticación    │
│  ├── /api/books/*  → Rutas libros           │
│  ├── /api/users/*  → Rutas usuarios         │
│  └── Fallback → index.html (SPA routing)    │
│                                              │
│  server/db.js  → Store (JSON persistence)    │
│  └── data/biblioteca.json                    │
└─────────────────────────────────────────────┘
```

**Patrón:** El frontend es un SPA vanilla sin frameworks. Comunica con el backend vía `fetch()`. El backend sirve la API REST y los archivos estáticos. Las rutas SPA usan hash (`#/path`) para que el servidor las maneje como fallback a `index.html`.

---

## 5. Base de Datos (JSON)

**Archivo:** `data/biblioteca.json`  
**Motor:** Persistencia en archivo JSON plano, leído en memoria al iniciar.  
**Escritura:** Se escribe al disco en cada operación de escritura.

### Colecciones

#### `users` — Usuarios registrados
```json
{
  "id": 1,
  "name": "Ana García",
  "email": "ana@ejemplo.com",
  "password": "$2a$10$...",  // bcrypt hash
  "role": "admin",          // "admin" | "user"
  "created_at": "2026-06-10"
}
```

#### `books` — Documentos/libros
```json
{
  "id": 1,
  "title": "Cien Años de Soledad",
  "author": "Gabriel García Márquez",
  "category": "Ficción",
  "description": "Una obra maestra del realismo mágico...",
  "file_type": "PDF",
  "file_name": "cien-anos.pdf",
  "file_path": "/uploads/1234567890-cien-anos.pdf",
  "uploader_id": 1,
  "created_at": "2026-08-15",
  "downloads": 42
}
```

#### `tags` — Etiquetas por libro
```json
{ "book_id": 1, "tag": "novela" }
```

#### `favorites` — Favoritos de usuarios
```json
{ "user_id": 1, "book_id": 3, "created_at": "2026-08-25T10:30:00.000Z" }
```

#### `reading_history` — Historial de lecturas
```json
{ "user_id": 1, "book_id": 5, "viewed_at": "2026-08-25T10:30:00.000Z" }
```

#### `ratings` — Calificaciones de libros (1-5 estrellas)
```json
{ "user_id": 1, "book_id": 1, "score": 5, "created_at": "2026-08-20T10:00:00.000Z" }
```

#### `comments` — Comentarios/reseñas en libros
```json
{ "id": 1, "user_id": 1, "book_id": 1, "text": "Una obra maestra absoluta.", "created_at": "2026-08-20T10:30:00.000Z" }
```

### Categorías disponibles
| Categoría | Icono |
|-----------|-------|
| Ficción | 📚 |
| Ciencia | 🔬 |
| Historia | 🏛️ |
| Educación | 🎓 |
| Tecnología | 💻 |
| Arte | 🎨 |
| Filosofía | 🧠 |

---

## 6. API REST (Backend)

**Base URL:** `http://localhost:3000/api`

### Autenticación (`/api/auth`)

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/auth/register` | Registrar usuario | ❌ |
| POST | `/auth/login` | Iniciar sesión | ❌ |
| POST | `/auth/logout` | Cerrar sesión | ❌ |
| GET | `/auth/me` | Obtener sesión actual (incluye `role`) | ✅ |

**Register/Login body:**
```json
{ "name": "...", "email": "...", "password": "..." }
```

**Respuesta:**
```json
{ "user": { "id": 1, "name": "Ana García", "email": "ana@ejemplo.com", "role": "admin" } }
```

### Libros (`/api/books`)

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/books` | Listar/buscar libros (query: `q`, `category`) | ❌ |
| GET | `/books?category=Ficción` | Filtrar por categoría | ❌ |
| GET | `/books?q=arte` | Buscar por texto | ❌ |
| GET | `/books?page=1&per_page=12` | Paginado (con `q` y `category`) | ❌ |
| GET | `/books/most-downloaded?limit=6` | Libros más descargados | ❌ |
| GET | `/books/recent?limit=6` | Libros más recientes | ❌ |
| GET | `/books/:id` | Detalle de un libro (incluye rating + comment_count) | ❌ |
| POST | `/books` | Subir nuevo libro | ✅ |
| PUT | `/books/:id` | Actualizar libro (solo propietario) | ✅ |
| DELETE | `/books/:id` | Eliminar libro (solo propietario) | ✅ |
| POST | `/books/:id/download` | Descargar archivo (real si existe en disco) | ❌ |
| POST | `/books/:id/view` | Registrar vista del libro | ❌ |
| POST | `/books/:id/favorite` | Toggle favorito | ✅ |
| POST | `/books/:id/rate` | Calificar libro (1-5 estrellas) | ✅ |
| GET | `/books/:id/rating` | Obtener estadísticas de rating | ❌ |
| GET | `/books/:id/comments` | Listar comentarios (paginado) | ❌ |
| POST | `/books/:id/comments` | Agregar comentario | ✅ |
| DELETE | `/books/:bookId/comments/:commentId` | Eliminar comentario (solo autor) | ✅ |

**POST /books (FormData):**
```
title: string (requerido)
author: string (requerido)
category: string (requerido)
description: string (requerido)
tags: string (JSON array, ej: '["tag1","tag2"]')
file: File (PDF, EPUB, MOBI, DOC, DOCX — máx 200MB)
```

**PUT /books/:id (JSON):**
```json
{ "title": "...", "author": "...", "category": "...", "description": "...", "tags": ["tag1"] }
```

**DELETE /books/:id — Respuesta:**
```json
{ "ok": true }
```

**GET /books/:id — Respuesta (enriquecida):**
```json
{
  "book": {
    "id": 1,
    "title": "Cien Años de Soledad",
    ...
    "rating": { "average": 4.5, "count": 2, "distribution": {"1":0,"2":0,"3":0,"4":1,"5":1} },
    "comment_count": 3,
    "user_rating": 0
  }
}
```

**POST /books/:id/rate (JSON):**
```json
{ "score": 5 }
```
**Respuesta:**
```json
{ "ok": true, "rating": { "average": 4.3, "count": 5, ... }, "userRating": 5 }
```

**POST /books/:id/comments (JSON):**
```json
{ "text": "Excelente libro, muy recomendado." }
```
**Respuesta:**
```json
{ "comment": { "id": 1, "user_id": 1, "book_id": 1, "text": "...", "created_at": "...", "user_name": "Ana García" } }
```

**GET /books/:id/comments?page=1 — Respuesta:**
```json
{
  "comments": [{ "id": 1, "user_name": "Ana García", "text": "...", "created_at": "..." }],
  "total": 5,
  "page": 1,
  "totalPages": 1
}
```

**GET /books (paginado) — Respuesta:**
```json
{
  "books": [...],
  "total": 8,
  "page": 1,
  "totalPages": 3,
  "perPage": 12
}
```

**POST /books/:id/favorite — Respuesta:**
```json
{ "ok": true, "isFavorite": true, "count": 3 }
```

### Usuarios (`/api/users`)

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/users/stats` | Estadísticas globales | ❌ |
| GET | `/users/:id` | Perfil + libros del usuario | ❌ |
| PUT | `/users/:id` | Actualizar perfil (solo propietario) | ✅ |
| GET | `/users/:id/favorites` | Libros favoritos del usuario | ❌ |
| GET | `/users/:id/history` | Historial de lecturas | ❌ |

**GET /users/:id — Respuesta:**
```json
{
  "user": { "id": 1, "name": "Ana García", "email": "ana@ejemplo.com", "role": "admin", "created_at": "..." },
  "books": [...],
  "stats": { "bookCount": 3, "totalDownloads": 104 }
}
```

### Administración (`/api/admin`)

> ⚠️ Todos los endpoints requieren autenticación + rol `admin`.

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/admin/stats` | Estadísticas detalladas del admin | 🔒 Admin |
| GET | `/admin/users` | Listar todos los usuarios con estadísticas | 🔒 Admin |
| GET | `/admin/books` | Listar todos los libros | 🔒 Admin |
| PUT | `/admin/users/:id/role` | Cambiar rol de usuario (`admin`/`user`) | 🔒 Admin |
| DELETE | `/admin/users/:id` | Eliminar usuario + todos sus datos | 🔒 Admin |
| DELETE | `/admin/books/:id` | Eliminar cualquier libro (bypass ownership) | 🔒 Admin |

**GET /admin/stats — Respuesta:**
```json
{
  "totalBooks": 8,
  "totalUsers": 3,
  "totalDownloads": 327,
  "totalComments": 3,
  "totalRatings": 5,
  "totalFavorites": 0,
  "booksThisMonth": 8,
  "usersThisMonth": 3
}
```

**GET /admin/users — Respuesta:**
```json
{
  "users": [
    {
      "id": 1,
      "name": "Ana García",
      "email": "ana@ejemplo.com",
      "role": "admin",
      "created_at": "2026-06-10",
      "bookCount": 3,
      "totalDownloads": 104,
      "favoriteCount": 0,
      "commentCount": 1
    }
  ]
}
```

**PUT /admin/users/:id/role (JSON):**
```json
{ "role": "admin" }
```
**Nota:** No se puede quitar el rol de admin al último administrador.

**DELETE /admin/users/:id — Respuesta:**
```json
{ "ok": true }
```
**Nota:** Elimina el usuario, todos sus libros, favoritos, comentarios, calificaciones e historial. No se puede eliminar a uno mismo desde admin.

**PUT /users/:id (JSON):**
```json
{ "name": "Nuevo Nombre", "email": "nuevo@email.com", "password": "nueva123", "current_password": "123456" }
```
Nota: `password` es opcional pero requiere `current_password` si se envía.

**Respuesta:**
```json
{ "user": { "id": 1, "name": "Nuevo Nombre", "email": "nuevo@email.com", "created_at": "..." } }
```

---

## 7. Frontend (SPA Vanilla JS)

El frontend es una SPA construida sin frameworks. Usa módulos IIFE (Immediately Invoked Function Expressions) expuestos como globales.

### `js/store.js` — Cliente API

Módulo que encapsula todas las llamadas `fetch()` al backend.

**Métodos públicos:**
```javascript
// Auth
Store.registerUser({ name, email, password })    // → { user }
Store.loginUser({ email, password })             // → { user }
Store.logoutUser()                               // → { ok }
Store.getSession()                               // → user | null

// Books
Store.searchBooks({ query, category })           // → [books]
Store.searchBooksPaginated({ query, category, page, perPage }) // → { books, total, page, totalPages }
Store.getBookById(id)                            // → book (con rating, comment_count)
Store.addBook(formData)                          // → { book }
Store.updateBook(bookId, updates)                // → { book }
Store.deleteBook(bookId)                         // → { ok: true }
Store.incrementDownload(bookId)                  // → downloads (descarga real si existe archivo)
Store.getMostDownloaded(limit)                   // → [books]
Store.getRecentBooks(limit)                      // → [books]
Store.trackView(bookId)                          // → void

// Favorites
Store.toggleFavorite(bookId)                     // → { isFavorite, count }
Store.getUserFavorites(userId)                   // → [books]

// History
Store.getUserHistory(userId)                     // → [books]

// Users
Store.getUserProfile(id)                         // → { user, books, stats }
Store.updateUserProfile(id, { name, email, password, current_password }) // → { user }
Store.getStats()                                 // → { totalBooks, totalUsers, totalDownloads }
Store.getCategories()                            // → ['Ficción', 'Ciencia', ...]

// Ratings
Store.rateBook(bookId, score)                    // → { ok, rating, userRating }
Store.getBookRating(bookId)                      // → { rating, userRating }

// Comments
Store.getBookComments(bookId, page)              // → { comments, total, page, totalPages }
Store.addBookComment(bookId, text)               // → { comment }
Store.deleteBookComment(bookId, commentId)       // → { ok: true }

// Admin
Store.getAdminStats()                            // → { totalBooks, totalUsers, ... }
Store.getAdminUsers()                            // → [users with stats]
Store.getAdminBooks()                            // → [books]
Store.adminDeleteUser(userId)                    // → { ok: true }
Store.adminDeleteBook(bookId)                    // → { ok: true }
Store.adminSetUserRole(userId, role)             // → { user }
```

### `js/router.js` — Router SPA

Router basado en hash (`window.location.hash`).

**Métodos:**
```javascript
Router.register(path, handler)       // Registrar ruta: '/book/:id', function(params)
Router.setNotFound(handler)          // Handler para 404
Router.navigate(path)                // Navegar: Router.navigate('/book/1')
Router.getCurrentRoute()             // Retorna hash actual: '/book/1'
Router.init()                        // Iniciar listener de hashchange
```

**Rutas soportadas:** Parámetros con `:param` (ej: `/book/:id`, `/profile/:id`)

### `js/components.js` — Componentes UI

Módulo con funciones que retornan strings HTML.

**Funciones principales:**
```javascript
// Navegación y Layout
Components.renderNavbar(session)                    // Barra de navegación (con dark mode toggle)
Components.renderHero(stats)                        // Sección hero principal
Components.renderFooter()                           // Pie de página
Components.showToast(message, type)                 // Notificación toast

// Catálogo e Home
Components.renderBookCard(book, showFav, isFav)     // Tarjeta de libro
Components.renderMostDownloaded(books)              // Sección "Más Descargados"
Components.renderRecentlyAdded(books)               // Sección "Agregados Recientemente"
Components.renderSearchBar(category, query)         // Barra de búsqueda y filtros
Components.renderCategoryChips(category)            // Chips de categorías
Components.renderPagination(page, totalPages, total) // Paginación
Components.renderBookGrid(books)                    // Grid de libros

// Detalle de Libro (con ratings, comentarios, compartir)
Components.renderDetailPage(book, isFav, favCount, session) // Página de detalle completa
Components.renderComments(comments, session, bookId)       // Lista de comentarios
Components.renderCommentPagination(page, totalPages, total) // Paginación de comentarios

// Formularios
Components.renderAuthForm(type)                     // Formulario login/register
Components.renderUploadForm(session)                // Formulario de subida
Components.renderEditBookForm(book, session)         // Formulario de edición de libro

// Perfil de Usuario
Components.renderProfilePage(data, session, favs, history) // Perfil de usuario
Components.renderProfileEditForm(user, session)       // Formulario de edición de perfil

// Páginas
Components.renderCategoriesPage(categoriesData)     // Página de categorías
Components.renderAboutPage(stats)                   // Página "Sobre Nosotros"
Components.renderAdminPage(session, stats, users, books, tab) // Panel admin

// Skeleton Loading (placeholders de carga)
Components.renderSkeletonBooks(count)               // Skeleton de tarjetas de libros
Components.renderSkeletonHero()                     // Skeleton del hero
Components.renderSkeletonSearchBar()                // Skeleton de barra de búsqueda
Components.renderSkeletonCategoryChips()            // Skeleton de chips de categorías
Components.renderSkeletonDetailPage()               // Skeleton de página de detalle completa
Components.renderSkeletonProfilePage()              // Skeleton de perfil
Components.renderSkeletonCategoriesPage()           // Skeleton de categorías
Components.renderSkeletonAdminPage()                // Skeleton de panel admin
Components.renderSkeletonForm()                     // Skeleton de formulario genérico
```

### `js/app.js` — Controlador Principal

Módulo que orquesta la lógica de la aplicación.

**Flujo de inicialización:**
1. `App.init()` se llama al `DOMContentLoaded`
2. Carga sesión del usuario (`Store.getSession()`)
3. Registra todas las rutas en el `Router`
4. `Router.init()` dispara el handler de la ruta actual

**Manejadores de eventos expuestos globalmente:**
```javascript
// Auth
App.handleAuth(e, type)              // Login/Register
App.logout()                         // Cerrar sesión

// Búsqueda y Navegación
App.executeSearch()                  // Ejecutar búsqueda
App.quickSearch()                    // Búsqueda desde navbar
App.filterByCategory(category)       // Filtrar por categoría
App.goToPage(page)                   // Navegar página (paginación)

// Libros
App.handleUpload(e)                  // Subir libro
App.handleEditBook(e, bookId)        // Editar libro existente
App.confirmDeleteBook(bookId, title) // Confirmar y eliminar libro
App.onDownloadClick(e, bookId)       // Descarga real + tracking
App.shareBook(bookId, title)         // Compartir vía Web Share API / clipboard

// Favoritos
App.toggleFavoriteCard(bookId, btn)  // Toggle favorito en tarjeta
App.toggleFavoriteDetail(bookId)     // Toggle favorito en detalle

// Ratings y Comentarios
App.rateBook(bookId, score)          // Calificar libro (1-5 estrellas)
App.addComment(bookId)               // Agregar comentario
App.deleteComment(bookId, commentId) // Eliminar comentario
App.goToCommentPage(page)            // Navegar páginas de comentarios

// Perfil
App.switchProfileTab(tab, btn)       // Cambiar pestaña en perfil
App.handleProfileEdit(e, userId)     // Actualizar perfil (nombre, email, contraseña)

// Tags y Archivos
App.removeTag(index)                 // Eliminar etiqueta del form
App.clearFile()                      // Limpiar archivo seleccionado

// UI
App.toggleMobileMenu()               // Abrir/cerrar menú móvil
App.toggleDarkMode()                 // Toggle modo oscuro

// Admin
App.switchAdminTab(tab)              // Cambiar pestaña en admin
App.adminConfirmDeleteUser(id, name) // Confirmar eliminar usuario
App.adminConfirmDeleteBook(id, title)// Confirmar eliminar libro
App.adminToggleRole(userId, role)    // Toggle rol admin/user
```

---

## 8. Router (SPA Hash-Based)

Las rutas se registran en `app.js` → `init()`:

```javascript
Router.register('/',              _homePage);           // Página principal + catálogo
Router.register('/login',         _loginPage);          // Login
Router.register('/register',      _registerPage);       // Registro
Router.register('/upload',        _uploadPage);          // Subir documento
Router.register('/book/:id/edit', _editBookPage);       // Editar libro (antes de /:id)
Router.register('/book/:id',      _bookDetailPage);     // Detalle de libro
Router.register('/profile/:id/edit', _profileEditPage); // Editar perfil (antes de /:id)
Router.register('/profile/:id',   _profilePage);        // Perfil de usuario
Router.register('/categories',    _categoriesPage);     // Todas las categorías
Router.register('/about',         _aboutPage);          // Sobre nosotros
Router.register('/admin',         _adminPage);          // Panel de administración
Router.setNotFound(_notFoundPage);                      // 404
```

**URLs del frontend:**
- `http://localhost:3000/#/` → Página principal
- `http://localhost:3000/#/login` → Login
- `http://localhost:3000/#/register` → Registro
- `http://localhost:3000/#/upload` → Subir documento
- `http://localhost:3000/#/book/1` → Detalle del libro 1
- `http://localhost:3000/#/book/1/edit` → Editar libro 1 (solo propietario)
- `http://localhost:3000/#/profile/1` → Perfil del usuario 1
- `http://localhost:3000/#/profile/1/edit` → Editar perfil (solo propio)
- `http://localhost:3000/#/categories` → Categorías
- `http://localhost:3000/#/about` → Sobre nosotros
- `http://localhost:3000/#/admin` → Panel de administración (solo admin)

---

## 9. Componentes UI

### Estructura de Renderizado

Cada página se renderiza así:

```
_renderPage(content)
  ├── Components.renderNavbar(session)   ← Siempre visible
  ├── content                            ← Contenido específico de la página
  └── Components.renderFooter()          ← Siempre visible
```

### Flujo de Datos

```
app.js (handler) 
  → Store.métodoAPI()  → fetch() al backend
  → Components.renderX(data)  → retorna HTML string
  → _renderPage(html)  → inyecta en #app
```

**Importante:** Los componentes NO hacen llamadas async. Reciben datos como parámetros y retornan HTML. Solo `app.js` hace llamadas a la API.

---

## 10. Estilos CSS

**Archivo:** `css/styles.css`  
**Variables CSS:** Definidas en `:root` (colores, radios, fuentes, transiciones)  
**Fuentes:** Inter (sans-serif) + Playfair Display (display/títulos)

### Clases principales

| Clase | Uso |
|-------|-----|
| `.container` | Contenedor centrado max-width: 1200px |
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-accent` | Botones |
| `.navbar`, `.navbar-nav`, `.navbar-actions` | Navegación |
| `.hero` | Sección hero con gradiente |
| `.search-bar`, `.search-form` | Barra de búsqueda |
| `.category-chip` | Chips de categorías |
| `.books-grid` | Grid de tarjetas de libros |
| `.book-card`, `.book-card-cover`, `.book-card-body` | Tarjeta de libro |
| `.book-card-fav` | Botón de favorito en tarjeta |
| `.btn-fav-active` | Botón de favorito activo |
| `.upload-form`, `.drop-zone`, `.form-group` | Formularios |
| `.tags-input-wrapper`, `.tag` | Input de etiquetas |
| `.detail-layout`, `.detail-cover`, `.detail-info` | Página de detalle |
| `.auth-page`, `.auth-card` | Formularios de autenticación |
| `.profile-page`, `.profile-header`, `.profile-tabs` | Perfil de usuario |
| `.categories-grid`, `.category-card` | Página de categorías |
| `.about-*` | Página sobre nosotros |
| `.pagination`, `.pagination-btn` | Paginación |
| `.toast`, `.toast-container` | Notificaciones |
| `.spinner` | Loading spinner (legacy) |
| `.skeleton`, `.skeleton-text`, `.skeleton-circle` | Skeleton loading placeholders |
| `.skeleton-book-card`, `.skeleton-detail-*` | Skeletons específicos por página |
| `.skeleton-comment`, `.skeleton-table-row` | Skeletons de comentarios y tablas |
| `.empty-state` | Estado vacío |
| `.page-enter` | Animación de entrada |
| `.detail-rating`, `.rating-stars`, `.rating-star-btn` | Sistema de calificación por estrellas |
| `.comment-form`, `.comment-item`, `.comment-header` | Sección de comentarios |
| `.detail-owner-actions` | Botones de editar/eliminar para propietario |
| `.profile-edit-card`, `.profile-edit-avatar` | Formulario de edición de perfil |
| `.dark-toggle` | Botón de toggle modo oscuro |
| `body.dark-mode` | Variables CSS alternas para modo oscuro |

### Responsive

- **768px:** Menú hamburger, grid 2 columnas, layout detalle a 1 columna
- **480px:** Grid 2 columnas más pequeño, search se oculta en navbar

---

## 11. Sesiones y Autenticación

**Motor:** `express-session` con cookie httpOnly.

**Cookie:** `bcv.sid` (7 días de duración)

**Flujo:**
1. Usuario se registra o inicia sesión → `req.session.user = { id, name, email }`
2. Cookie se envía automáticamente en requests posteriores
3. Backend lee `req.session.user` para verificar autenticación
4. `Store.getSession()` en el frontend llama a `GET /api/auth/me` para verificar

**Middleware de auth en backend:**
```javascript
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión.' });
  }
  next();
}
```

---

## 12. Guía para Agregar Nuevas Funcionalidades

### Agregar una nueva ruta de API

1. **Crear endpoint** en el archivo correspondiente (`server/routes/books.js`, `auth.js`, o `users.js`)
2. **Agregar método** en `server/db.js` si se necesita lógica de persistencia
3. **Agregar método** en `js/store.js` para que el frontend pueda llamarlo
4. **Agregar componente** en `js/components.js` para renderizar la UI
5. **Agregar handler/ruta** en `js/app.js`

### Agregar una nueva página

1. **Registrar ruta** en `Router.register('/nueva-pagina', _handler)`
2. **Crear función** `_handler(params)` en `app.js` que:
   - Llame a la API si es necesario
   - Renderice con `Components.renderX()`
   - Use `_renderPage(html)` para inyectar
3. **Agregar link** en el navbar (`Components.renderNavbar`)
4. **Agregar estilos** en `css/styles.css`
5. **Crear componente** en `components.js` si es reutilizable

### Agregar una nueva propiedad a un modelo

Ejemplo: agregar campo `rating` a books:

1. **Actualizar seed** en `server/db.js` → `_seedIfEmpty()`
2. **Actualizar `createBook()`** para aceptar el nuevo campo
3. **Actualizar `searchBooks()`** si se puede buscar por ese campo
4. **Actualizar frontend** en los componentes relevantes

### Convenciones importantes

- **NO eliminar** funcionalidad existente. Si algo se reemplaza, que la nueva funcionalidad cubra el caso de uso anterior.
- **Los componentes** solo retornan HTML (síncronos). La lógica async va en `app.js`.
- **El store** encapsula toda la comunicación HTTP. Los componentes y app.js nunca llaman `fetch()` directamente.
- **El router** usa hash (`#/path`). Nunca usar `pushState` (el servidor no lo soporta).
- **El CSS** usa variables CSS personalizadas. Preferir usar `var(--color-*)` en vez de colores hardcoded.
- **Cada operación de escritura** al JSON es síncrona y bloqueante. No es ideal para producción pero funciona para este proyecto.

---

## 13. Endpoints Pendientes / Ideas

### Funcionalidades sin implementar

| Función | Estado | Notas |
|---------|--------|-------|
| **Sistema de ratings/estrellas** | ✅ Implementado | UI interativa en detalle + backend `/:id/rate` y `/:id/rating` |
| **Comentarios en libros** | ✅ Implementado | UI completa con paginación + backend GET/POST/DELETE `/:id/comments` |
| **Descarga real de archivos** | ✅ Implementado | Enlace directo a `GET /:id/download` con tracking |
| **Edición/eliminación de libros** | ✅ Implementado | Página `/#/book/:id/edit` + botones en detalle (solo propietario) |
| **Actualización de perfil** | ✅ Implementado | Página `/#/profile/:id/edit` con cambio de nombre, email y contraseña |
| **Libros recientes** | ✅ Implementado | Sección "Agregados Recientemente" en home + GET `/books/recent` |
| **Vista explícita** | ✅ Implementado | Tracking automático al abrir detalle |
| **Compartir libro** | ✅ Implementado | Web Share API + copiar link al portapapeles |
| **Modo oscuro** | ✅ Implementado | Toggle 🌙/☀️ en navbar + `localStorage` + variables CSS alternas |
| **Skeleton loading** | ✅ Implementado | 9 componentes skeleton para todas las páginas principales |
| **Administración** | ✅ Implementado | Panel completo con dashboard, gestión de usuarios y documentos |
| **Notificaciones** | 💡 Idea | Nuevo libro, nueva descarga |
| **Búsqueda avanzada** | 💡 Idea | Filtros por fecha, autor, rango de descargas |
| **Exportar catálogo** | 💡 Idea | CSV/JSON del catálogo |
| **Rate limiting** | 💡 Idea | Protección contra abuso |
| **CSRF protection** | 💡 Idea | Seguridad adicional |

---

## 14. Problemas Conocidos

1. **JSON file persistence:** Cada operación de escritura reescribe todo el archivo. Con muchos usuarios/libros será lento. Solución: migrar a SQLite o MongoDB.

2. **~~Descarga simulada~~ ✅ Resuelto:** `POST /:id/download` ahora sirve el archivo real con `res.download()` cuando el archivo existe en disco.

3. **Sin validación de sesión expirada:** Si el servidor se reinicia, las cookies quedan pero las sesiones se pierden. El usuario verá "No autenticado" sin aviso.

4. **~~Limpieza de archivos huérfanos~~ ✅ Resuelto:** Al eliminar un libro (`DELETE /:id`), el archivo correspondiente en `server/uploads/` se elimina automáticamente.

5. **Sin testing:** No hay tests unitarios ni de integración.

6. **Sin TypeScript:** Todo es JavaScript vanilla. No hay type checking.

---

## 15. Convenciones de Código

### JavaScript

- **Módulos IIFE:** Cada archivo (`store.js`, `router.js`, `components.js`, `app.js`) es un IIFE que retorna un objeto con métodos públicos.
- **Variables privadas:** Prefijo `_` (ej: `_session`, `_currentQuery`, `_renderPage`).
- **Async/Await:** Para todas las operaciones de API en el frontend.
- **Template literals:** Para generar HTML (retorna strings, no DOM).
- **Manejo de errores:** `try/catch` con `Components.showToast()` para errores al usuario.
- **Event handling:** `onclick="App.method()"` en HTML inline (simplicidad sobre performance).

### CSS

- **Variables CSS** en `:root` para consistencia.
- **BEM-like naming:** `.block-element` (ej: `.book-card-cover`, `.detail-info`).
- **Transiciones:** Todas las transiciones usan `var(--transition)`.
- **Responsive:** `@media` queries con breakpoints 768px y 480px.

### Backend

- **Express Router:** Cada archivo de rutas exporta un `Router()`.
- **Middleware:** `requireAuth` se usa en rutas protegidas.
- **Store pattern:** Toda la lógica de datos está en `server/db.js` exportado como `Store`.
- **Consistencia:** Rutas siguen el patrón REST: `GET` para leer, `POST` para crear/modificar.

---

## 🚀 Resumen Rápido para Desarrolladores

```
# Para correr
cd biblioteca-comunitaria && npm run dev

# Para agregar una página:
1. Crear handler en app.js
2. Registrar ruta: Router.register('/nueva', handler)
3. Crear componente en components.js
4. Agregar link en navbar (components.js → renderNavbar)
5. Agregar estilos en styles.css

# Para agregar un endpoint:
1. Crear ruta en server/routes/archivo.js
2. Crear método en server/db.js → Store
3. Agregar método en js/store.js
4. Llamar desde app.js → Components
```

---

## 📋 Changelog v1.3.0 (Frontend Completo)

### Nuevo: Página de Detalle Completa

- **Sistema de calificación:** Estrellas interactivas (1-5) en la página de detalle. Promedio y conteo de calificaciones visibles. Los usuarios autenticados pueden calificar y actualizar su calificación.
- **Sistema de comentarios:** Formulario de comentarios con contador de caracteres (1000 máx). Lista de comentarios con paginación. Los autores pueden eliminar sus comentarios.
- **Botón de compartir:** Usa Web Share API en móviles. En escritorio, copia el link al portapapeles con notificación toast.
- **Descarga real:** El botón de descarga ahora es un enlace directo a la API (`GET /api/books/:id/download`) que sirve el archivo real. Tracking de descargas automático.
- **Acciones del propietario:** Botones "✏️ Editar" y "🗑️ Eliminar" visibles solo para el propietario del libro.

### Nuevo: Editar Libro (`/#/book/:id/edit`)

- Formulario para actualizar título, autor, categoría y descripción.
- Solo accesible para el propietario del libro.
- Validación de campos obligatorios.

### Nuevo: Editar Perfil (`/#/profile/:id/edit`)

- Formulario para actualizar nombre, email y contraseña.
- Cambio de contraseña opcional (requiere contraseña actual).
- Validación: mínimo 6 caracteres, contraseñas coincidentes.
- Botón "✏️ Editar Perfil" en la página de perfil.
- Sesión se actualiza automáticamente tras guardar.

### Nuevo: Sección "Agregados Recientemente"

- Nueva sección en la página principal mostrando los 6 libros más recientes.
- Ubicada después de la sección "Más Descargados".

### Nuevo: Modo Oscuro

- Toggle 🌙/☀️ en la barra de navegación.
- Variables CSS alternas para todos los colores.
- Persistencia en `localStorage`.
- Compatible con dark mode: navbar, hero, cards, formularios, tablas, admin.

### Nuevo: Skeleton Loading

- 9 componentes skeleton reemplazan los spinners en todas las páginas principales.
- Animación `skeleton-shimmer` con gradiente pulsante.
- Skeletons específicos: hero, search bar, category chips, book cards, detail page, profile, categories grid, admin dashboard, formularios.
- Compatibles con dark mode via CSS custom properties.

### Correcciones

- `Store.updateUserProfile()` ahora usa `PUT /users/:id` (antes llamaba incorrectamente `POST /:id/update`).
- Rutas edit (`/book/:id/edit`, `/profile/:id/edit`) se registran antes de las rutas con parámetro `:id` para evitar conflictos de matching.
- Se eliminó la función duplicada `_homePage` en `app.js`.
- **Eliminados datos de prueba:** base de datos inicia vacía (sin usuarios, libros, ratings ni comentarios de demo).

### Archivos modificados
- `js/components.js` — Nuevos componentes: `renderDetailPage` (con ratings/comments/share), `renderComments`, `renderCommentPagination`, `renderEditBookForm`, `renderProfileEditForm`, `renderRecentlyAdded`, 9 skeleton components, dark mode toggle en navbar
- `js/app.js` — Nuevas rutas (`/book/:id/edit`, `/profile/:id/edit`), handlers (`rateBook`, `addComment`, `deleteComment`, `shareBook`, `confirmDeleteBook`, `handleEditBook`, `handleProfileEdit`, `toggleDarkMode`), skeleton loading, eliminación de spinner/duplicate code
- `js/store.js` — Corrección de `updateUserProfile` para usar PUT
- `css/styles.css` — Estilos para ratings, comentarios, owner actions, profile edit, dark toggle, modo oscuro completo, skeleton loading (~500 líneas nuevas)

---

## 📋 Changelog v1.2.0 (Panel de Administración)

### Nuevo: Panel de Administración (`/#/admin`)

- **Dashboard** con estadísticas detalladas: documentos, usuarios, descargas, comentarios, calificaciones, favoritos, y actividad del mes.
- **Gestión de usuarios:** ver todos los usuarios, cambiar roles (admin/user), eliminar usuarios (borra todos sus datos y libros).
- **Gestión de documentos:** ver todos los libros, eliminar cualquier libro sin restricción de propiedad.
- **Protección:** solo usuarios con rol `admin` pueden acceder. No se puede eliminar al último admin.
- **Campo `role`** agregado a la colección `users` (`"admin"` | `"user"`).
- **Navbar:** link "⚙️ Admin" visible solo para usuarios admin.

### Archivos modificados
- `server/db.js` — Nuevo campo `role`, métodos `isAdmin()`, `getAllUsers()`, `adminDeleteBook()`, `adminDeleteUser()`, `adminSetUserRole()`, `getAdminStats()`
- `server/routes/admin.js` — Nuevo archivo con 6 endpoints protegidos
- `server/index.js` — Registro de rutas admin
- `server/routes/auth.js` — Incluye `role` en la sesión
- `js/store.js` — 6 métodos nuevos de admin
- `js/components.js` — Componente `renderAdminPage()` con dashboard, tabla de usuarios y libros
- `js/app.js` — Ruta `/admin`, handlers de admin
- `css/styles.css` — Estilos completos para el panel admin

---

## 📋 Changelog v1.1.0 (Backend Completo)

### Nuevos endpoints de API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/books/recent` | Libros más recientes (query: `limit`) |
| PUT | `/api/books/:id` | Actualizar libro (solo propietario) |
| DELETE | `/api/books/:id` | Eliminar libro + archivo (solo propietario) |
| POST | `/api/books/:id/view` | Registrar vista del libro |
| POST | `/api/books/:id/rate` | Calificar libro (body: `{score: 1-5}`) |
| GET | `/api/books/:id/rating` | Estadísticas de rating |
| GET | `/api/books/:id/comments` | Comentarios paginados |
| POST | `/api/books/:id/comments` | Agregar comentario |
| DELETE | `/api/books/:bId/comments/:cId` | Eliminar comentario (solo autor) |
| PUT | `/api/users/:id` | Actualizar perfil |

### Cambios en comportamiento
- **Descarga real:** `POST /books/:id/download` ahora sirve el archivo con `res.download()` si existe en disco. Si no, solo incrementa el contador.
- **Detalle enriquecido:** `GET /books/:id` ahora incluye `rating` (stats), `comment_count` y `user_rating`.
- **Seed ampliado:** Se agregaron ratings y comentarios de demo a los datos iniciales.

### Nuevas colecciones en `biblioteca.json`
- `ratings` — Calificaciones de usuarios (1-5 estrellas)
- `comments` — Comentarios/reseñas de usuarios en libros
