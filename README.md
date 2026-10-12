# Kitameraki Task API

Back-end untuk aplikasi Task Management. Ini adalah REST API yang dibuat dengan **TypeScript**, **Azure Functions v4** (Node.js), dan **Azure Cosmos DB** (NoSQL).

Fitur utama:

- Membuat, membaca, mengubah, dan menghapus task
- Mencari, memfilter, mengurutkan, dan membagi task per halaman (pagination)
- Menyimpan form task yang bisa dikustomisasi (field tambahan, layout 2 kolom) untuk tiap organisasi
- Memvalidasi semua input dan mengembalikan pesan error yang jelas

---

## Daftar isi

1. [Yang perlu disiapkan](#1-yang-perlu-disiapkan)
2. [Menyiapkan database](#2-menyiapkan-database)
3. [Instalasi dan konfigurasi](#3-instalasi-dan-konfigurasi)
4. [Menjalankan API](#4-menjalankan-api)
5. [Menguji API](#5-menguji-api)
   - [Opsi A: Terminal](#opsi-a-terminal)
   - [Opsi B: Postman](#opsi-b-postman)
   - [Hasil yang diharapkan](#hasil-yang-diharapkan)
6. [Referensi API](#6-referensi-api)
7. [Cara kerja form settings](#7-cara-kerja-form-settings)
8. [Struktur proyek](#8-struktur-proyek)
9. [Troubleshooting](#9-troubleshooting)
10. [Model keamanan](#10-model-keamanan)

---

## 1. Yang perlu disiapkan

| Tool                       | Versi                              | Cek dengan         |
| -------------------------- | ---------------------------------- | ------------------ |
| Node.js                    | 18 atau lebih baru (disarankan 20) | `node -v`          |
| npm                        | ikut terpasang bersama Node.js     | `npm -v`           |
| Azure Functions Core Tools | v4                                 | `func --version`   |
| Database Cosmos DB         | emulator **atau** akun Azure       | lihat langkah 2    |
| Postman (opsional)         | versi terbaru                      | hanya untuk Opsi B |

Kalau perintah `func` tidak dikenali, pasang Core Tools:

```bash
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

Setelah itu tutup dan buka lagi terminal Anda.

---

## 2. Menyiapkan database

API ini membutuhkan database Cosmos DB bernama `TaskApp` dengan **dua container**. Keduanya memakai partition key **`/organizationId`**.

| Container      | Isinya                                           |
| -------------- | ------------------------------------------------ |
| `Tasks`        | data task                                        |
| `FormSettings` | satu dokumen form settings untuk tiap organisasi |

Pilih **salah satu** cara berikut untuk mendapatkan database.

### Opsi 1: Cosmos DB Emulator (gratis, berjalan di komputer sendiri)

1. Pasang dan jalankan [Azure Cosmos DB Emulator](https://learn.microsoft.com/azure/cosmos-db/emulator) (installer Windows atau Docker).
2. Buka <https://localhost:8081/_explorer/index.html> di browser.
3. Klik **Explorer** → **New Container**, lalu buat:
   - Database id: `TaskApp` (Create new), container id: `Tasks`, partition key: `/organizationId`
   - Klik **New Container** lagi: database `TaskApp` (Use existing), container id: `FormSettings`, partition key: `/organizationId`
4. Di halaman **Quickstart**, salin **Primary Connection String**. Nilai ini dipakai di langkah 3.

### Opsi 2: Akun Azure Cosmos DB

1. Di Azure Portal, buat akun **Azure Cosmos DB for NoSQL** (free tier atau serverless cukup untuk testing).
2. Di **Data Explorer**, buat database dan dua container seperti di atas.
3. Di **Settings → Keys**, salin **Primary Connection String**.

---

## 3. Instalasi dan konfigurasi

```bash
npm install
```

Buat file pengaturan lokal dari contohnya:

```bash
# macOS / Linux / Git Bash / PowerShell
cp local.settings.json.example local.settings.json

# Windows CMD
copy local.settings.json.example local.settings.json
```

Buka `local.settings.json`, lalu ganti isi `COSMOS_CONNECTION_STRING` dengan connection string yang tadi Anda salin. Pastikan tetap **satu baris di dalam tanda kutip**.

| Setting                          | Wajib | Default        | Keterangan                                                                  |
| -------------------------------- | ----- | -------------- | --------------------------------------------------------------------------- |
| `COSMOS_CONNECTION_STRING`       | ya    | tidak ada      | Connection string Cosmos DB                                                 |
| `COSMOS_DATABASE`                | tidak | `TaskApp`      | Nama database                                                               |
| `COSMOS_TASKS_CONTAINER`         | tidak | `Tasks`        | Nama container task                                                         |
| `COSMOS_FORM_SETTINGS_CONTAINER` | tidak | `FormSettings` | Nama container form settings                                                |
| `Host.CORS`                      | tidak | tidak ada      | Alamat front-end yang boleh memanggil API (contoh: `http://localhost:5173`) |

> `local.settings.json` sudah masuk `.gitignore`. Jangan pernah meng-commit connection string asli.

---

## 4. Menjalankan API

Kalau memakai **emulator**, sertifikatnya self-signed sehingga Node akan menolaknya. Izinkan **di terminal yang sama** dengan tempat Anda menjalankan API (hanya untuk testing lokal, jangan dipakai di produksi):

```powershell
# PowerShell
$env:NODE_TLS_REJECT_UNAUTHORIZED=0
```

```bash
# macOS / Linux / Git Bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

```bat
:: Windows CMD
set NODE_TLS_REJECT_UNAUTHORIZED=0
```

Lalu jalankan API:

```bash
npm start
```

Perintah ini membersihkan, mem-build, dan menjalankan Functions host. Kalau sudah siap, akan muncul daftar function:

```
Functions:
        BulkDeleteTasks: [POST] http://localhost:7071/api/tasks/bulk-delete
        DeleteTask: [DELETE] http://localhost:7071/api/tasks/{id}
        GetTask: [GET] http://localhost:7071/api/tasks/{id}
        GetTasks: [GET] http://localhost:7071/api/tasks
        InsertTask: [POST] http://localhost:7071/api/tasks
        UpdateTask: [PATCH] http://localhost:7071/api/tasks/{id}
        GetFormSettings / SaveFormSettings / ResetFormSettings: .../api/form-settings
```

Base URL-nya adalah **`http://localhost:7071/api`**. Biarkan terminal ini tetap berjalan, lalu buka **terminal baru** untuk testing.

> Peringatan seperti `Process reporting unhealthy ... AzureWebJobsStorage` tidak berbahaya. API ini hanya memakai HTTP trigger yang tidak membutuhkan storage tersebut.

Script lain:

| Script              | Fungsi                                     |
| ------------------- | ------------------------------------------ |
| `npm run build`     | Compile TypeScript ke folder `dist/`       |
| `npm run typecheck` | Cek tipe tanpa build                       |
| `npm test`          | Build, lalu jalankan unit test (`test/`, tanpa perlu Cosmos DB) |
| `npm run clean`     | Hapus folder `dist/`                       |
| `npm start`         | Clean, build, lalu jalankan Functions host |

---

## 5. Menguji API

Setiap request membutuhkan header **`x-organization-id`** berupa UUID. Anda boleh membuatnya sendiri (disarankan UUID v4 yang acak). Semua task dan form settings dimiliki oleh satu organisasi, jadi pakai nilai yang sama selama satu sesi testing. Nilai ini **tidak** dikirim lewat URL maupun body.

### Opsi A: Terminal

#### A1. PowerShell (Windows)

Pakai jendela PowerShell **baru** saat API sedang berjalan.

```powershell
$base = "http://localhost:7071/api"
$org  = [guid]::NewGuid().ToString()
$org                      # simpan nilai ini, akan dipakai terus
$h = @{ "x-organization-id" = $org }   # header yang dikirim di setiap request
```

**Membuat task** (`status: todo` akan terisi otomatis):

```powershell
$task = Invoke-RestMethod -Method Post -Uri "$base/tasks" -Headers $h -ContentType "application/json" `
  -Body (@{ title = "Task pertama"; priority = "high" } | ConvertTo-Json)
$task
$id = $task.id
```

**Melihat daftar task** (pagination, search, dan filter):

```powershell
Invoke-RestMethod "$base/tasks" -Headers $h
Invoke-RestMethod "$base/tasks?page=1&pageSize=5&search=pertama&status=todo&sortBy=title&sortOrder=asc" -Headers $h
```

**Mengambil satu task:**

```powershell
Invoke-RestMethod "$base/tasks/${id}" -Headers $h
```

**Mengubah task** (hanya field yang dikirim yang berubah):

```powershell
Invoke-RestMethod -Method Patch -Uri "$base/tasks/${id}" -Headers $h `
  -ContentType "application/json" -Body '{"status":"completed"}'
```

**Menghapus task** (tanpa output berarti berhasil, status 204):

```powershell
Invoke-RestMethod -Method Delete -Uri "$base/tasks/${id}" -Headers $h
```

**Menghapus banyak task sekaligus:**

```powershell
Invoke-RestMethod -Method Post -Uri "$base/tasks/bulk-delete" -Headers $h -ContentType "application/json" `
  -Body (@{ ids = @($id) } | ConvertTo-Json)
```

**Form settings: baca, lalu simpan dengan satu field kustom bertipe email:**

```powershell
Invoke-RestMethod "$base/form-settings" -Headers $h     # layout default

$fieldId = [guid]::NewGuid().ToString()
$json = '{"fields":[{"kind":"builtIn","id":"title","label":"Nama task"},{"kind":"builtIn","id":"description","label":"Deskripsi"},{"kind":"builtIn","id":"dueDate","label":"Tenggat"},{"kind":"builtIn","id":"priority","label":"Prioritas"},{"kind":"builtIn","id":"status","label":"Status"},{"kind":"builtIn","id":"tags","label":"Tag"},{"kind":"custom","id":"FIELD","label":"Email kontak","type":"email"}],"rows":[["title"],["description"],["dueDate","priority"],["status","tags"],["FIELD"]]}'
$body = $json.Replace("FIELD", $fieldId)
Invoke-RestMethod -Method Put -Uri "$base/form-settings" -Headers $h -ContentType "application/json" -Body $body
```

**Membuat task yang memakai field kustom:**

```powershell
$json = '{"title":"Task dengan field kustom","customFields":{"FIELD":"seseorang@example.com"}}'
Invoke-RestMethod -Method Post -Uri "$base/tasks" -Headers $h -ContentType "application/json" -Body ($json.Replace("FIELD", $fieldId))
```

**Mengembalikan form ke layout default:**

```powershell
Invoke-RestMethod -Method Delete -Uri "$base/form-settings" -Headers $h
```

> **Melihat pesan error:** Di Windows PowerShell 5.1, `Invoke-RestMethod` hanya menampilkan "(400) Bad Request" dan menyembunyikan isi JSON-nya. `curl.exe` juga merusak tanda kutip JSON di PowerShell. Tempel fungsi satu baris ini sekali di terminal untuk melihat status code beserta isi error:
>
> ```powershell
> function Try-Api($method, $uri, $body) { try { Invoke-RestMethod -Method $method -Uri $uri -Headers $h -ContentType "application/json" -Body $body } catch { $r = $_.Exception.Response; $t = $_.ErrorDetails.Message; if (-not $t) { $t = (New-Object System.IO.StreamReader($r.GetResponseStream())).ReadToEnd() }; "$([int]$r.StatusCode) -> $t" } }
> ```
>
> Contoh pemakaian (harapannya `400 -> {"error":"Validation failed", ...}`):
>
> ```powershell
> Try-Api Post "$base/tasks" '{"title":""}'
> ```

#### A2. curl (macOS, Linux, Git Bash)

```bash
BASE="http://localhost:7071/api"
ORG=$(uuidgen | tr 'A-Z' 'a-z')      # atau tempel UUID apa saja
echo $ORG
H="x-organization-id: $ORG"   # header yang dikirim di setiap request
```

```bash
# Membuat task (simpan id dari respons)
curl -i -X POST "$BASE/tasks" -H "$H" -H "Content-Type: application/json" \
  -d '{"title":"Task pertama","priority":"high"}'

ID=<tempel id dari respons>

# List, search, dan filter
curl -H "$H" "$BASE/tasks?page=1&pageSize=5&search=pertama&status=todo"

# Ambil satu task
curl -H "$H" "$BASE/tasks/$ID"

# Ubah
curl -i -X PATCH "$BASE/tasks/$ID" -H "$H" -H "Content-Type: application/json" \
  -d '{"status":"completed"}'

# Hapus (harapannya 204)
curl -i -X DELETE -H "$H" "$BASE/tasks/$ID"

# Hapus banyak
curl -i -X POST "$BASE/tasks/bulk-delete" -H "$H" -H "Content-Type: application/json" \
  -d "{\"ids\":[\"$ID\"]}"

# Form settings
curl -H "$H" "$BASE/form-settings"
curl -i -X DELETE -H "$H" "$BASE/form-settings"
```

(Untuk `PUT /form-settings`, salin body JSON dari contoh PowerShell di atas, atau pakai Postman.)

### Opsi B: Postman

#### B1. Pengaturan awal (sekali saja)

1. Buka Postman → **Environments** → **+** → beri nama `Kitameraki local`.
2. Tambahkan variabel berikut lalu klik **Save**:

   | Variabel  | Nilai                                                                                                    |
   | --------- | -------------------------------------------------------------------------------------------------------- |
   | `baseUrl` | `http://localhost:7071/api`                                                                              |
   | `orgId`   | UUID apa saja (buat di <https://www.uuidgenerator.net/> atau jalankan `[guid]::NewGuid()` di PowerShell) |
   | `taskId`  | kosongkan dulu                                                                                           |

3. Pilih `Kitameraki local` di dropdown environment (pojok kanan atas).
4. Buat **Collection** bernama `Kitameraki Task API` untuk menyimpan semua request.
5. Di collection tersebut, buka tab **Authorization**: **Type** = `API Key`, **Key** = `x-organization-id`, **Value** = `{{orgId}}`, **Add to** = `Header`. Semua request di dalamnya akan mewarisi header ini (pastikan tiap request memakai *Inherit auth from parent*).

#### B2. Buat request berikut

Untuk request yang punya body: **Body** → **raw** → pilih **JSON** (Postman akan mengatur `Content-Type` otomatis).

| #   | Nama                | Method | URL                             | Body                                                                                                                                          |
| --- | ------------------- | ------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Create task         | POST   | `{{baseUrl}}/tasks`             | `{ "title": "Task pertama", "priority": "high" }`                                                              |
| 2   | List tasks          | GET    | `{{baseUrl}}/tasks`             | tanpa body; Params: `page=1`, `pageSize=5`, opsional `search`, `status`, `priority`, `tag`, `sortBy`, `sortOrder` |
| 3   | Get task            | GET    | `{{baseUrl}}/tasks/{{taskId}}`  | tanpa body                                                                                                                                   |
| 4   | Update task         | PATCH  | `{{baseUrl}}/tasks/{{taskId}}`  | `{ "status": "completed" }`                                                                                |
| 5   | Delete task         | DELETE | `{{baseUrl}}/tasks/{{taskId}}`  | tanpa body                                                                                                                                   |
| 6   | Bulk delete         | POST   | `{{baseUrl}}/tasks/bulk-delete` | `{ "ids": ["{{taskId}}"] }`                                                                                    |
| 7   | Get form settings   | GET    | `{{baseUrl}}/form-settings`     | tanpa body                                                                                                                                   |
| 8   | Save form settings  | PUT    | `{{baseUrl}}/form-settings`     | lihat di bawah                                                                                                                                |
| 9   | Reset form settings | DELETE | `{{baseUrl}}/form-settings`     | tanpa body                                                                                                                                   |

**Menyimpan id task secara otomatis.** Di request 1, buka tab **Scripts** (di Postman versi lama namanya **Tests**) lalu tambahkan:

```javascript
pm.environment.set("taskId", pm.response.json().id);
```

Setelah "Create task" dikirim, `{{taskId}}` terisi sendiri sehingga request 3 sampai 6 langsung bisa dipakai.

**Body untuk request 8** (ganti `ISI-UUID-BARU-DI-SINI` dengan UUID baru, di kedua tempat):

```json
{
  "fields": [
    { "kind": "builtIn", "id": "title", "label": "Nama task" },
    { "kind": "builtIn", "id": "description", "label": "Deskripsi" },
    { "kind": "builtIn", "id": "dueDate", "label": "Tenggat" },
    { "kind": "builtIn", "id": "priority", "label": "Prioritas" },
    { "kind": "builtIn", "id": "status", "label": "Status" },
    { "kind": "builtIn", "id": "tags", "label": "Tag" },
    {
      "kind": "custom",
      "id": "ISI-UUID-BARU-DI-SINI",
      "label": "Email kontak",
      "type": "email"
    }
  ],
  "rows": [
    ["title"],
    ["description"],
    ["dueDate", "priority"],
    ["status", "tags"],
    ["ISI-UUID-BARU-DI-SINI"]
  ]
}
```

Untuk memakai field kustom itu di sebuah task, kirim lewat request 1:

```json
{
  "title": "Task dengan field kustom",
  "customFields": { "ISI-UUID-BARU-DI-SINI": "seseorang@example.com" }
}
```

> **API sudah di-deploy?** Tambahkan header `x-functions-key` berisi function key pada setiap request. Untuk lokal tidak diperlukan.

### Hasil yang diharapkan

Pakai daftar ini sebagai checklist untuk memastikan semuanya berjalan:

| Request                                         | Hasil yang diharapkan                                 |
| ----------------------------------------------- | ----------------------------------------------------- |
| Membuat task                                    | `201`, JSON dengan `id` baru dan `status: "todo"`     |
| List task                                       | `200`, `{ items, page, pageSize, total, totalPages }` |
| Search / filter                                 | `200`, hanya task yang cocok di `items`               |
| Ambil satu task                                 | `200`, task tersebut                                  |
| Ubah task                                       | `200`, task dengan perubahan Anda                     |
| Hapus task                                      | `204`, body kosong                                    |
| Ambil task yang sudah dihapus                   | `404`, `{ "error": "Task not found" }`                |
| Membuat task dengan body `{}`                   | `400`, `Validation failed` beserta detail per field   |
| Ubah task dengan `{ "id": "..." }`              | `400` (id tidak boleh diubah)                         |
| Header `x-organization-id` kosong atau bukan UUID | `400`                                               |
| Body memuat `organizationId` (harus di header)  | `400` (`Unrecognized key`)                            |
| Body lebih dari 256 KB                          | `413`                                                 |
| Ambil form settings (belum pernah disimpan)     | `200`, layout default (6 field bawaan)                |
| Simpan form settings                            | `200`, layout Anda beserta `updatedAt`                |
| Simpan layout dengan 3 field dalam satu baris   | `400`                                                 |
| Membuat task dengan email salah di field kustom | `400`                                                 |

Anda juga bisa membuka Explorer Cosmos DB dan melihat isi container `Tasks` dan `FormSettings` untuk memastikan data tersimpan.

---

## 6. Referensi API

Base URL: `http://localhost:7071/api`. Request dan respons berformat JSON.

### Task

| Method | Route                | Fungsi                                         | Sukses |
| ------ | -------------------- | ---------------------------------------------- | ------ |
| GET    | `/tasks`             | Daftar task (pagination, filter, search, sort) | 200    |
| GET    | `/tasks/{id}`        | Ambil satu task                                | 200    |
| POST   | `/tasks`             | Buat task                                      | 201    |
| PATCH  | `/tasks/{id}`        | Ubah sebagian field task                       | 200    |
| DELETE | `/tasks/{id}`        | Hapus task                                     | 204    |
| POST   | `/tasks/bulk-delete` | Hapus banyak task                              | 200    |

`organizationId` dikirim lewat header **`x-organization-id`** pada setiap request (task maupun form settings). Nilainya tidak boleh ada di URL atau body. Request tanpa header ini ditolak dengan `400`.

**Field task**

| Field            | Tipe     | Aturan                                                                 |
| ---------------- | -------- | ---------------------------------------------------------------------- |
| `id`             | UUID     | opsional saat membuat (dibuat otomatis jika kosong), tidak bisa diubah |
| `organizationId` | UUID     | diambil dari header `x-organization-id`, tidak boleh ada di body       |
| `title`          | string   | wajib, 1 sampai 100 karakter                                           |
| `description`    | string   | opsional, maksimal 1000 karakter                                       |
| `dueDate`        | string   | opsional, ISO date-time, contoh `2026-10-20T09:00:00Z`. Di PATCH, `null` menghapusnya |
| `priority`       | string   | opsional: `low`, `medium`, `high`. Di PATCH, `null` menghapusnya        |
| `status`         | string   | `todo` (default), `in-progress`, `completed`                           |
| `tags`           | string[] | opsional, maksimal 20 tag, masing-masing maksimal 50 karakter          |
| `customFields`   | object   | opsional, lihat [bagian 7](#7-cara-kerja-form-settings)                |

**Query parameter untuk list**

| Parameter        | Default     | Keterangan                                                     |
| ---------------- | ----------- | -------------------------------------------------------------- |
| `page`           | `1`         |                                                                |
| `pageSize`       | `10`        | maksimal `100`                                                 |
| `status`         | tidak ada   | `todo`, `in-progress`, `completed`                             |
| `priority`       | tidak ada   | `low`, `medium`, `high`                                        |
| `tag`            | tidak ada   | task yang memuat tag ini                                       |
| `search`         | tidak ada   | mencari di title dan description, tidak peka huruf besar/kecil |
| `sortBy`         | `createdAt` | `title`, `dueDate`, `priority`, `status`, `createdAt` (aturan di bawah) |
| `sortOrder`      | `desc`      | `asc` atau `desc`                                              |

**Aturan pengurutan (`sortBy`)**

- Task yang tidak punya nilai pada field itu (misalnya tanpa `dueDate` atau `priority`) **selalu di bagian akhir**, baik `asc` maupun `desc`. Tidak ada task yang hilang dari hasil.
- `priority` diurutkan secara logis: `low`, `medium`, `high`. `status`: `todo`, `in-progress`, `completed`. `title`: tidak peka huruf besar/kecil dan angka dibandingkan secara natural ("Task 2" sebelum "Task 10"). `dueDate`: berdasarkan waktu sebenarnya, jadi zona waktu yang berbeda tetap benar.
- Task dengan nilai sama diurutkan dari yang terbaru, lalu berdasarkan id, sehingga satu task tidak berpindah-pindah antar halaman.
- Penjelasan teknis: `ORDER BY` di Cosmos DB membuang dokumen yang propertinya tidak ada dan hanya mengurutkan string secara abjad. Karena itu `createdAt` (default, selalu ada) diurutkan langsung oleh Cosmos DB, sedangkan field lain diurutkan di aplikasi: hanya kunci sort yang kecil yang dimuat, lalu dokumen lengkap untuk halaman yang diminta saja.
- Batas: mengurutkan dengan field selain `createdAt` hanya diizinkan sampai **2000 task** yang cocok dengan filter (kalau lebih, `400` dengan petunjuk untuk mempersempit hasil atau memakai `createdAt`).

**Respons list**

```json
{ "items": [], "page": 1, "pageSize": 10, "total": 0, "totalPages": 0 }
```

**Respons bulk delete** (setiap id ditunggu sampai selesai, kegagalan dilaporkan, tidak disembunyikan)

```json
{ "deleted": ["id-1"], "failed": [{ "id": "id-2", "reason": "not_found" }] }
```

### Form settings

| Method | Route                               | Fungsi                                       | Sukses |
| ------ | ----------------------------------- | -------------------------------------------- | ------ |
| GET    | `/form-settings`                    | Ambil layout (default jika belum disimpan)   | 200    |
| PUT    | `/form-settings`                    | Simpan seluruh layout (buat baru atau timpa) | 200    |
| DELETE | `/form-settings`                    | Kembalikan ke layout default                 | 204    |

### Error

Semua error memakai bentuk yang sama:

```json
{
  "error": "Validation failed",
  "details": [{ "path": "title", "message": "Required" }]
}
```

| Status | Arti                                                                    |
| ------ | ----------------------------------------------------------------------- |
| 400    | Input tidak valid (`details` menunjukkan field dan masalahnya)          |
| 404    | Task tidak ditemukan (update, hapus, atau ambil satu task)              |
| 409    | Task dengan id tersebut sudah ada                                       |
| 500    | Error server yang tidak terduga (detailnya hanya ditulis di log server) |

---

## 7. Cara kerja form settings

Layout form disimpan **per organisasi** dan berlaku untuk semua task milik organisasi itu.

```json
{
  "organizationId": "...",
  "fields": [
    { "kind": "builtIn", "id": "title", "label": "Title" },
    {
      "kind": "custom",
      "id": "<uuid>",
      "label": "Email kontak",
      "type": "email"
    }
  ],
  "rows": [
    ["title"],
    ["description"],
    ["dueDate", "priority"],
    ["status", "tags"],
    ["<uuid>"]
  ],
  "updatedAt": "2026-10-10T03:00:00.000Z"
}
```

- **`fields`** adalah daftar seluruh field.
  - Field bawaan: `title`, `description`, `dueDate`, `priority`, `status`, `tags`. Bisa **di-rename dan dipindah, tapi tidak bisa dihapus**.
  - Field kustom punya `type`: `text`, `date`, `datetime`, atau `email`, dan `id` berupa UUID yang dibuat oleh client.
- **`rows`** adalah layout. Setiap baris berisi **1 atau 2 id field** (maksimal 2 kolom), ditampilkan dari kiri ke kanan. Field kustom baru ditambahkan sebagai baris terakhir.
- **`PUT /form-settings`** mengganti seluruh dokumen. API mengembalikan `400` jika ada id ganda, field bawaan hilang, satu baris berisi lebih dari 2 kolom, atau ada field yang tidak ditempatkan tepat di satu baris.
- Soal tidak membatasi jumlah baris. API hanya membatasi total 100 field supaya database tidak disalahgunakan.

**Nilai field kustom pada task**

Task dapat menyimpan nilai field kustom di `customFields`, dengan id field sebagai key:

```json
{
  "title": "Telepon klien",
  "customFields": { "<uuid>": "seseorang@example.com" }
}
```

Saat membuat dan mengubah task, API memeriksa bahwa:

- id field ada di form settings organisasi tersebut (field yang tidak dikenal menghasilkan `400`)
- nilainya sesuai tipe: `email` harus email valid, `date` berformat `YYYY-MM-DD`, `datetime` berupa ISO date-time, `text` maksimal 1000 karakter
- string kosong `""` berarti nilainya dikosongkan

`PATCH /tasks/{id}` mengosongkan `dueDate` atau `priority` bila dikirim `null` (contoh `{ "dueDate": null }`). Mengirim key tersebut tanpa nilai tidak mengubahnya.

`PATCH /tasks/{id}` akan mengganti **seluruh** objek `customFields` jika dikirim. Nilai dari field kustom yang sudah dihapus dari form tetap ada di task lama, dan front-end cukup mengabaikannya.

---

## 8. Struktur proyek

```
src/
  index.ts                      pengaturan awal aplikasi
  functions/                    HTTP handler, satu file per endpoint (dibuat tipis)
  models/
    task.ts                     tipe task + validasi (zod)
    formSettings.ts             tipe layout form + aturan validasi
  services/
    customFields.ts             memeriksa nilai field kustom terhadap form settings
  repositories/
    taskRepository.ts           semua query task ke Cosmos DB
    formSettingsRepository.ts   semua query form settings ke Cosmos DB
  lib/
    config.ts                   membaca dan memvalidasi environment variable
    cosmos.ts                   satu Cosmos client yang dipakai bersama
    http.ts                     header organisasi, parsing input (batas 256 KB), satu error handler + header respons
    errors.ts                   AppError + helper badRequest, notFound, conflict
    taskPatch.ts                menyusun operasi patch Cosmos (set, dan remove untuk nilai `null`)
    cosmosDocument.ts           membuang field sistem Cosmos (_rid, _ts, ...) dari respons
    taskSort.ts                 aturan pengurutan task (nilai kosong di akhir, urutan logis)
test/                           unit test (node:test): pengurutan, skema task, form settings, custom field, patch
task.schema.json                JSON schema task (dokumentasi)
local.settings.json.example     template pengaturan lokal
```

Idenya: **handler** menerima request, **model** memvalidasi, **service/repository** mengerjakan logikanya, dan **lib** berisi helper bersama. Dengan begitu tiap file kecil dan mudah diuji.

---

## 9. Troubleshooting

| Masalah                                                    | Solusi                                                                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'func' is not recognized`                                 | Pasang Core Tools (lihat langkah 1), lalu buka ulang terminal                                                                                                  |
| `500` dan log menyebut `self-signed certificate`           | Set `NODE_TLS_REJECT_UNAUTHORIZED=0` di terminal yang **sama**, lalu jalankan `npm start` lagi (hanya untuk emulator)                                          |
| `500` dan log menyebut `Invalid environment configuration` | `local.settings.json` belum ada, atau `COSMOS_CONNECTION_STRING` kosong. Restart setelah mengeditnya                                                           |
| `500` dan log menyebut `ECONNREFUSED`                      | Cosmos emulator tidak berjalan (cek <https://localhost:8081/_explorer/index.html>)                                                                             |
| `404` di semua request                                     | Pastikan URL diawali `/api`, serta nama container dan partition key sesuai langkah 2                                                                           |
| `400` dan pesan `Header "x-organization-id" is required...` | Kirim header `x-organization-id` berisi UUID di setiap request (bukan lewat query atau body)                                                                    |
| `400 Validation failed`                                    | Baca `details`, di sana tertulis field dan masalahnya                                                                                                          |
| Port 7071 sudah dipakai                                    | Hentikan proses `func` yang lain, atau jalankan `func start --port 7072`                                                                                       |
| `Process reporting unhealthy ... AzureWebJobsStorage`      | Aman diabaikan, function HTTP tidak membutuhkannya                                                                                                             |
| VS Code: `Cannot find name 'process'`                      | Tambahkan `"types": ["node"]` di dalam `compilerOptions` pada `tsconfig.json`, pastikan `npm install` sudah dijalankan, lalu **TypeScript: Restart TS Server** |
| Sudah mengubah `local.settings.json` tapi tidak ada efek   | Pengaturan hanya dibaca saat start, jadi restart `npm start`                                                                                                   |

---

## 10. Model keamanan

API ini sengaja **tanpa login** (di luar cakupan soal). Karena itu `organizationId` diperlakukan sebagai **kunci rahasia**: siapa pun yang tahu UUID-nya dapat mengakses data organisasi tersebut, dan tidak ada yang bisa mengakses data organisasi lain tanpa mengetahuinya.

**Yang sudah diterapkan**

| Lapisan | Penerapan |
| ------- | --------- |
| Kunci organisasi | Wajib berupa UUID di header `x-organization-id`, bukan di URL, sehingga tidak tercatat di log akses, riwayat browser, atau log proxy. Dinormalisasi ke huruf kecil. Tidak ada endpoint yang menampilkan daftar organisasi. |
| Isolasi data | Setiap query dan operasi dibatasi ke partition key organisasi dari header. `organizationId` di body ditolak, jadi data tidak bisa "dipindahkan" ke organisasi lain. |
| Validasi input | Semua input divalidasi dengan zod (skema `strict`, batas panjang, batas jumlah field, maksimal 100 field per form). Query ke Cosmos DB selalu berparameter. |
| Ukuran request | Body maksimal 256 KB, selebihnya `413`. |
| Header respons | `Cache-Control: no-store` dan `X-Content-Type-Options: nosniff`. Error `500` tidak membocorkan detail internal. |
| Pembatasan beban | `host.json` membatasi `maxConcurrentRequests` (100) dan `maxOutstandingRequests` (200). |
| Rahasia | Connection string hanya di `local.settings.json` (sudah di `.gitignore`) atau app settings Azure. |

**CORS.** Batasi hanya ke domain front-end, jangan memakai `*`. Lokal diatur lewat `Host.CORS` di `local.settings.json`. Di Azure:

```bash
az functionapp cors add --name <nama-function-app> --resource-group <resource-group> --allowed-origins https://<domain-frontend>
```

CORS hanya melindungi lewat browser, bukan dari klien lain seperti curl.

**Function key.** Semua endpoint memakai `authLevel: "function"`. Key ini tidak boleh dianggap rahasia kalau ditaruh di aplikasi front-end (SPA), karena terlihat oleh siapa saja di browser. Untuk produksi, panggil API lewat proxy yang menyimpan key di server (misalnya Azure Static Web Apps dengan linked backend, atau API Management).

**Keterbatasan dan langkah untuk produksi**

- Rate limiting per klien tidak ada di kode. Gunakan API Management atau Azure Front Door/WAF.
- Siapa pun yang mengetahui UUID organisasi punya akses penuh. Untuk produksi, tambahkan autentikasi (misalnya Microsoft Entra ID / JWT) dan ambil organisasi dari klaim token, bukan dari header.
- Gunakan Managed Identity dan Key Vault untuk akses Cosmos DB, sebagai pengganti connection string.
- Jalankan `npm audit` secara berkala.
