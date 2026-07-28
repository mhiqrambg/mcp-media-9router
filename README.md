# mcp-media-9router

MCP (Model Context Protocol) server untuk memberi AI agent akses web intelligence terstruktur melalui API 9router. Server ini dapat digunakan oleh OpenCode, Claude Desktop, Cursor, dan client MCP lain yang mendukung transport `stdio`.

`mcp-media-9router` bertindak sebagai adapter: AI agent memanggil tool MCP, lalu server meneruskan request ke 9router. Kredensial provider seperti Exa, Firecrawl, Jina Reader, Tavily, Brave, GPSE, dan OpenAI tetap dikelola di 9router.

## Fitur

- **`web_search`**: mencari informasi web dengan hasil terstruktur untuk AI agent.
- **`web_fetch`**: mengambil URL publik dan mengembalikan konten Markdown yang disediakan 9router.
- **Multi-provider search**: dukungan konfigurasi Exa, GPSE, Brave, OpenAI, dan provider lain yang tersedia di 9router.
- **Multi-provider fetch**: dukungan konfigurasi Exa, Firecrawl, Jina Reader, Tavily, dan provider lain yang tersedia di 9router.
- **Provider default**: pengguna menentukan provider default search dan fetch secara terpisah.
- **Provider allowlist**: agent hanya dapat menggunakan provider yang diizinkan pengguna.
- **Fallback `auto`**: provider fallback hanya dipakai saat timeout, rate limit, atau upstream tidak tersedia.
- **Output aman untuk LLM**: hasil fetch dapat dibatasi oleh `MCP_MEDIA_MAX_OUTPUT_CHARS` agar context agent tidak penuh.
- **Keamanan dasar**: menolak URL dengan scheme non-HTTP(S), credentials URL, localhost, private IPv4, dan private IPv6 sebelum request diteruskan.
- **Error terstruktur**: error proxy dinormalisasi menjadi kode seperti `UPSTREAM_TIMEOUT`, `UPSTREAM_RATE_LIMITED`, dan `CONTENT_NOT_FOUND`.
- **Tidak menyimpan data**: server tidak menyimpan API key, query, atau konten hasil fetch.

## Arsitektur

```text
OpenCode / Claude Desktop / Cursor
                |
                | MCP over stdio
                v
      mcp-media-9router
                |
                | HTTPS + Bearer API key
                v
            9router API
                |
                v
Exa / Firecrawl / Jina Reader / Tavily / Brave / GPSE / OpenAI
```

## Persyaratan

- Node.js 22 atau lebih baru.
- Akses ke endpoint 9router yang kompatibel.
- API key 9router yang aktif.

Periksa versi Node.js:

```bash
node --version
```

## Instalasi Lokal Sebelum Publish

Gunakan metode ini untuk menguji project dari source code di Mac Anda. Tidak perlu publish ke npm.

```bash
git clone https://github.com/YOUR_GITHUB_ORG/mcp-media-9router.git
cd mcp-media-9router
npm install
npm run build
```

Jika source sudah berada di komputer Anda, cukup jalankan dari folder project:

```bash
npm install
npm run build
```

## Konfigurasi Lokal

Jangan menyimpan API key ke Git. Salin contoh environment file:

```bash
cp .env.example .env
```

Lalu isi `.env` dengan API key yang sudah di-rotate. File `.env` sudah diabaikan oleh Git.

```dotenv
NINE_ROUTER_BASE_URL=https://9router.mibp.me
NINE_ROUTER_API_KEY=replace-with-a-new-api-key

# Provider default jika tool call tidak memiliki field model.
NINE_ROUTER_FETCH_MODEL=exa
NINE_ROUTER_SEARCH_MODEL=exa

# Provider yang boleh dipilih oleh AI agent.
NINE_ROUTER_FETCH_MODELS=exa,firecrawl,jina-reader,tavily
NINE_ROUTER_SEARCH_MODELS=exa,gpse,brave,openai

# Urutan provider ketika tool call memakai model: auto.
NINE_ROUTER_FETCH_FALLBACK_MODELS=exa,firecrawl,jina-reader,tavily
NINE_ROUTER_SEARCH_FALLBACK_MODELS=exa,gpse,brave,openai

# Batas operasi MCP.
MCP_MEDIA_LOG_LEVEL=info
MCP_MEDIA_REQUEST_TIMEOUT_MS=30000
MCP_MEDIA_MAX_RETRIES=0
MCP_MEDIA_MAX_OUTPUT_CHARS=100000
```

Server Node.js saat ini membaca environment dari shell, bukan file `.env` secara otomatis. Untuk menjalankannya dari terminal, ekspor variabel berikut atau gunakan environment variables di konfigurasi MCP client:

```bash
export NINE_ROUTER_BASE_URL="https://9router.mibp.me"
export NINE_ROUTER_API_KEY="replace-with-a-new-api-key"
export NINE_ROUTER_FETCH_MODEL="exa"
export NINE_ROUTER_SEARCH_MODEL="exa"
```

`NINE_ROUTER_BASE_URL` wajib memakai HTTPS. API key yang pernah terpapar pada chat, issue, terminal history, atau repository harus segera di-revoke dan di-rotate.

## Menjalankan Server Lokal

Build terlebih dahulu, kemudian jalankan:

```bash
npm run build
npm start
```

Server menggunakan `stdio`, sehingga terminal tampak diam setelah startup. Ini normal: server menunggu request JSON-RPC dari MCP client. Jangan mengetik JSON biasa ke terminal karena protocol MCP memakai framing khusus.

Untuk development tanpa build ulang:

```bash
npm run dev
```

## Test dengan MCP Inspector

MCP Inspector adalah cara paling mudah untuk memastikan tools dapat dipanggil sebelum menghubungkan OpenCode atau Claude Desktop.

```bash
NINE_ROUTER_BASE_URL="https://9router.mibp.me" \
NINE_ROUTER_API_KEY="$NINE_ROUTER_API_KEY" \
NINE_ROUTER_FETCH_MODEL="exa" \
NINE_ROUTER_SEARCH_MODEL="exa" \
npx -y @modelcontextprotocol/inspector node dist/index.js
```

Setelah Inspector terbuka:

1. Sambungkan ke server.
2. Pastikan `web_search` dan `web_fetch` muncul pada daftar tools.
3. Jalankan contoh `web_search` atau `web_fetch` di bagian [Tools](#tools).
4. Pastikan respons memuat `provider`, `attempted_models`, dan hasil yang diharapkan.

## Menghubungkan ke OpenCode

Gunakan path absolut menuju hasil build lokal. Contoh konfigurasi tersedia di [`examples/opencode.json`](./examples/opencode.json).

```json
{
  "mcp": {
    "media-9router-local": {
      "type": "local",
      "command": [
        "node",
        "/Users/your-user/Documents/Projects/mcp-media-9router/dist/index.js"
      ],
      "environment": {
        "NINE_ROUTER_BASE_URL": "https://9router.mibp.me",
        "NINE_ROUTER_API_KEY": "your-new-api-key",
        "NINE_ROUTER_FETCH_MODEL": "exa",
        "NINE_ROUTER_SEARCH_MODEL": "exa"
      },
      "enabled": true
    }
  }
}
```

Masukkan provider allowlist dan fallback environment variables jika Anda ingin menimpa nilai default. Jangan commit konfigurasi yang berisi API key.

## Menghubungkan ke Claude Desktop

Contoh konfigurasi tersedia di [`examples/claude-desktop.json`](./examples/claude-desktop.json).

```json
{
  "mcpServers": {
    "media-9router-local": {
      "command": "node",
      "args": [
        "/Users/your-user/Documents/Projects/mcp-media-9router/dist/index.js"
      ],
      "env": {
        "NINE_ROUTER_BASE_URL": "https://9router.mibp.me",
        "NINE_ROUTER_API_KEY": "your-new-api-key",
        "NINE_ROUTER_FETCH_MODEL": "exa",
        "NINE_ROUTER_SEARCH_MODEL": "exa"
      }
    }
  }
}
```

Restart Claude Desktop setelah menyimpan konfigurasi.

## Instalasi Setelah Publish ke npm

Bagian ini berlaku setelah package sudah dipublish sebagai package public. Sebelum itu, gunakan [Instalasi Lokal Sebelum Publish](#instalasi-lokal-sebelum-publish).

Jalankan tanpa global install:

```bash
npx -y mcp-media-9router
```

Atau pasang secara global:

```bash
npm install -g mcp-media-9router
mcp-media-9router
```

Contoh Claude Desktop setelah publish:

```json
{
  "mcpServers": {
    "media-9router": {
      "command": "npx",
      "args": ["-y", "mcp-media-9router"],
      "env": {
        "NINE_ROUTER_BASE_URL": "https://9router.mibp.me",
        "NINE_ROUTER_API_KEY": "your-new-api-key"
      }
    }
  }
}
```

## Uninstall

Jika dipasang global melalui npm:

```bash
npm uninstall -g mcp-media-9router
```

Jika digunakan melalui `npx`, tidak ada package global yang perlu dihapus. Untuk menghapus cache npm secara opsional:

```bash
npm cache clean --force
```

Untuk menghapus instalasi lokal dari source:

```bash
rm -rf /path/to/mcp-media-9router
```

Sebelum menghapus source, hapus juga entry `media-9router-local` dari konfigurasi OpenCode, Claude Desktop, atau MCP client lain agar client tidak mencoba menjalankan path yang sudah tidak ada.

## Tools

### `web_search`

Mencari informasi melalui 9router. Provider default digunakan jika `model` tidak diisi.

```json
{
  "query": "What is the latest news about AI?",
  "model": "exa",
  "search_type": "web",
  "max_results": 5,
  "country": "indonesia",
  "language": "indonesia"
}
```

| Field | Wajib | Deskripsi |
|---|---:|---|
| `query` | Ya | Kata kunci pencarian, 1-500 karakter. |
| `model` | Tidak | Provider yang ada pada allowlist search, atau `auto`. |
| `search_type` | Tidak | Tipe pencarian untuk 9router. Default: `web`. |
| `max_results` | Tidak | Jumlah hasil, 1-20. Default: `5`. |
| `country` | Tidak | Preferensi negara yang diteruskan ke 9router, contoh `indonesia`. |
| `language` | Tidak | Preferensi bahasa yang diteruskan ke 9router, contoh `indonesia`. |

Contoh auto fallback:

```json
{
  "query": "Berita AI terbaru",
  "model": "auto",
  "search_type": "web",
  "max_results": 5,
  "country": "indonesia",
  "language": "indonesia"
}
```

### `web_fetch`

Mengambil URL publik dan meminta hasil Markdown dari 9router.

```json
{
  "url": "https://example.com",
  "model": "firecrawl",
  "format": "markdown",
  "max_characters": 0
}
```

| Field | Wajib | Deskripsi |
|---|---:|---|
| `url` | Ya | URL publik HTTP atau HTTPS. |
| `model` | Tidak | Provider yang ada pada allowlist fetch, atau `auto`. |
| `format` | Tidak | Saat ini hanya `markdown`. |
| `max_characters` | Tidak | Batas karakter ke 9router. `0` berarti meminta konten penuh. |

`max_characters: 0` tidak melewati batas `MCP_MEDIA_MAX_OUTPUT_CHARS`; server MCP tetap memotong output besar untuk melindungi context window AI agent.

## Pemilihan Provider dan Fallback

Fetch dan search memiliki policy terpisah.

```dotenv
NINE_ROUTER_FETCH_MODEL=exa
NINE_ROUTER_FETCH_MODELS=exa,firecrawl,jina-reader,tavily
NINE_ROUTER_FETCH_FALLBACK_MODELS=exa,firecrawl,jina-reader,tavily

NINE_ROUTER_SEARCH_MODEL=exa
NINE_ROUTER_SEARCH_MODELS=exa,gpse,brave,openai
NINE_ROUTER_SEARCH_FALLBACK_MODELS=exa,gpse,brave,openai
```

| Nilai `model` | Perilaku |
|---|---|
| Tidak dikirim | Memakai provider default sekali dan fail-fast bila gagal. |
| Nama provider | Memakai provider tersebut sekali; harus tercantum dalam `*_MODELS`. |
| `auto` | Mencoba provider pada `*_FALLBACK_MODELS` secara berurutan. |

Fallback hanya terjadi untuk timeout, rate limit, atau upstream tidak tersedia. Fallback tidak dijalankan untuk URL invalid, input invalid, API key salah, permission error, atau konten yang memang tidak ditemukan. Hasil tool menyertakan `provider`, `attempted_models`, dan `fallback_used` agar agent dapat melihat provider yang berhasil dipakai.

## Kontrak API 9router

Server memanggil endpoint berikut:

- `POST /v1/search`
- `POST /v1/web/fetch`

Request dikirim menggunakan `Authorization: Bearer <NINE_ROUTER_API_KEY>`, `Content-Type: application/json`, dan `X-Request-Id`.

Payload search:

```json
{
  "model": "exa",
  "query": "What is the latest news about AI?",
  "search_type": "web",
  "max_results": 5,
  "country": "indonesia",
  "language": "indonesia"
}
```

Payload fetch:

```json
{
  "model": "exa",
  "url": "https://example.com",
  "format": "markdown",
  "max_characters": 0
}
```

Respons provider 9router dinormalisasi ke output MCP yang stabil. Search mengembalikan hasil dengan `title`, `url`, `snippet`, `source`, `author`, dan `rank`. Fetch mengembalikan `markdown`, `title`, bahasa, tanggal publikasi, serta status truncation.

## Security

- Jangan masukkan API key ke repository, README, issue publik, atau chat.
- Gunakan API key baru jika key pernah terpapar.
- Konten hasil fetch adalah data eksternal tidak tepercaya dan dapat memuat prompt injection atau informasi salah. Perlakukan sebagai referensi, bukan instruksi.
- Validasi URL di MCP server adalah pertahanan tambahan. Proxy 9router tetap wajib memvalidasi DNS, redirect, private network, dan metadata endpoint untuk mencegah SSRF secara menyeluruh.

## Development

Jalankan seluruh pemeriksaan sebelum membuka pull request:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
```

## Roadmap

- Phase 1: `web_search`, `web_fetch`, provider policy, proxy authentication, dan stdio transport.
- Phase 2: image, video, dan news search; PDF extraction; document parsing.
- Phase 3: optional Redis cache, rate limiting, OpenTelemetry observability, HTTP transport, dan multi-provider routing lanjutan.

## Contributing and Security

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting changes. Report vulnerabilities following [SECURITY.md](./SECURITY.md).

## License

[Apache-2.0](./LICENSE)
