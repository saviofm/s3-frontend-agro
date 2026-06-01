# Object Store File Manager

Interface web para gerenciar arquivos no **SAP BTP Object Store** (S3-compatible), construída com **SAPUI5 TypeScript** (frontend) e **SAP CAP Node.js** (backend).

---

## Arquitetura

```
┌────────────────────────────────────────────────────────────┐
│  SAP Build Work Zone                                        │
│   └── HTML5 App (ui5 build artifact)                        │
│         │  XSUAA Token                                      │
│         ▼                                                    │
│  Approuter / xs-app.json                                    │
│         │  route /api/* → Destination                       │
│         ▼                                                    │
│  CAP Node.js (REST @protocol)                               │
│         │  VCAP_SERVICES.objectstore credentials            │
│         ▼                                                    │
│  SAP BTP Object Store (S3-compatible)                       │
└────────────────────────────────────────────────────────────┘
```

**Componentes BTP:**
- `object-store-file-manager-agro-xsuaa` — XSUAA (autenticação/autorização, roles FileViewer/FileManager)
- `object-store-file-manager-agro-objectstore` — Object Store service instance (s3-standard)
- `object-store-file-manager-agro-html5repo` — HTML5 Application Repository (host do frontend)
- `object-store-file-manager-agro-dest` — Destination Service (roteamento UI → backend)

---

## Estrutura do Projeto

```
├── app/                         # SAPUI5 TypeScript frontend
│   ├── webapp/
│   │   ├── controller/          # Controllers (Home, App)
│   │   ├── view/                # Views XML (App, Home)
│   │   ├── fragment/            # Diálogos (CreateFolder, Rename, Move)
│   │   ├── model/               # FileService.ts, types.ts, models.ts
│   │   ├── i18n/                # Traduções PT-BR e EN
│   │   ├── css/app.css
│   │   ├── Component.ts
│   │   ├── manifest.json
│   │   └── index.html
│   ├── ui5.yaml
│   ├── xs-app.json
│   └── package.json
├── srv/                         # CAP Node.js backend
│   ├── lib/
│   │   ├── s3-client.js         # AWS SDK v3 wrapper (Object Store)
│   │   └── path-utils.js        # Sanitização de paths
│   ├── file-manager-service.cds # Definição do serviço REST
│   ├── file-manager-service.js  # Handlers CAP + Express routes
│   ├── server.js
│   └── package.json
├── xs-security.json             # Roles: FileViewer, FileManager
├── mta.yaml                     # MTA build descriptor
└── package.json
```

---

## Como Rodar Localmente

### Pré-requisitos

```bash
node --version   # >= 20
npm --version    # >= 10
npm i -g @sap/cds-dk @ui5/cli mbt
```

### 1. Instalar dependências

```bash
npm install
npm install --prefix srv
npm install --prefix app
```

### 2. Configurar Object Store local

```bash
cp default-env.json.example default-env.json
```

Edite `default-env.json` com credenciais reais do seu bucket S3 (ou Object Store). **Nunca comite este arquivo.**

### 3. Rodar o backend

```bash
cd srv
cds watch
# Servidor em http://localhost:4004
# Autenticação: dummy (usuário alice, roles simuladas)
```

### 4. Rodar o frontend

Em outro terminal:

```bash
cd app
npm start
# Abre http://localhost:8080/index.html
# Proxy /api/* → http://localhost:4004
```

---

## Configurar Object Store no SAP BTP

1. Acesse o **SAP BTP Cockpit** → subaccount → **Service Marketplace**
2. Crie uma instância de **Object Store** com plano `s3-standard`:
   ```
   Nome: object-store-file-manager-agro-objectstore
   ```
3. Após criar, o service binding via `mta.yaml` injeta as credenciais em `VCAP_SERVICES` automaticamente no CF.

Para uso local, exporte as credenciais manualmente via **Service Keys** e coloque em `default-env.json`.

---

## Build e Deploy MTA

### Pré-requisitos de Deploy

```bash
npm i -g mbt
cf login --sso
cf target -o <ORG> -s <SPACE>
```

### Build

```bash
mbt build
# Gera: mta_archives/object-store-file-manager-agro_1.0.0.mtar
```

### Deploy

```bash
cf deploy mta_archives/object-store-file-manager-agro_1.0.0.mtar
```

Ou em um único comando:

```bash
npm run deploy
```

---

## Publicar no SAP Build Work Zone

1. Após o deploy, vá ao **SAP BTP Cockpit** → **HTML5 Applications**
2. Confirme que `com.sap.objectstorefilemanageragro` aparece na lista
3. No **SAP Build Work Zone**, crie um **Content Provider** apontando para o subaccount
4. No Launchpad, adicione o tile com:
   - App ID: `com.sap.objectstorefilemanageragro`
   - Intent: `ObjectStoreFileManagerAgro-manage`
5. Atribua as **Role Collections** aos usuários:
   - `Object Store File Viewer` — visualização e download
   - `Object Store File Manager` — gestão completa

---

## Testar Upload / Listagem / Download

Com o backend rodando localmente (`cds watch`):

```bash
# Listar raiz
curl http://localhost:4004/api/listFiles

# Listar prefixo
curl "http://localhost:4004/api/listFiles?prefix=minha-pasta/"

# Upload (curl multipart)
curl -X POST http://localhost:4004/api/files/upload \
  -F "prefix=" \
  -F "files=@/caminho/para/arquivo.pdf"

# Download
curl "http://localhost:4004/api/files/download?key=arquivo.pdf" -o arquivo.pdf
```

---

## Segurança

- Credenciais S3 nunca chegam ao frontend — estão apenas no `VCAP_SERVICES` do CF
- Prefixos e nomes são sanitizados no backend (`path-utils.js`) — sem path traversal
- XSUAA valida JWT em produção; roles `FileViewer`/`FileManager` controlam operações de escrita
- `default-env.json` está no `.gitignore`
- Deleção recursiva requer confirmação dupla na UI

---

## Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| `MISSING_CREDS` no log | `default-env.json` ausente ou errado | Verifique `OBJECTSTORE_ACCESS_KEY_ID` e bucket |
| 401 no frontend | Token XSUAA expirado | Re-login no Work Zone |
| Upload 413 | Arquivo > 100 MB | Aumente `limits.fileSize` em `file-manager-service.js` |
| `NoSuchBucket` | Bucket errado nas credenciais | Confirme o nome do bucket no Object Store binding |
| CORS error local | Frontend não usa o proxy | Confirme que `ui5.yaml` tem `fiori-tools-proxy` configurado |
| Blank page no Work Zone | `manifest.json` com ID errado | O `sap.app.id` deve ser `com.sap.objectstorefilemanageragro` |
