import type { FileItem, FolderItem, UploadResult } from "./types"

// sap.ui.require.toUrl resolves relative to the app's runtime base path,
// which works both standalone (/) and in Work Zone (/<appId>/).
const BASE = (sap.ui.require as unknown as { toUrl(s: string): string })
  .toUrl("com/presales/objectstorefilemanageragro/api")

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: { message: resp.statusText } }))
    throw Object.assign(new Error(err.error?.message || "Request failed"), {
      code: err.error?.code,
      target: err.error?.target,
      status: resp.status,
    })
  }
  return resp.json()
}

export async function listFiles(prefix = ""): Promise<FileItem[]> {
  const encodedPrefix = encodeURIComponent(prefix)
  const data = await request<{ value: FileItem[] }>(`/listFiles(prefix='${encodedPrefix}')`)
  return data.value ?? (data as unknown as FileItem[])
}

export async function getFolderTree(): Promise<FolderItem[]> {
  const data = await request<{ value: FolderItem[] }>("/getFolderTree()")
  return data.value ?? (data as unknown as FolderItem[])
}

export async function createFolder(prefix: string, folderName: string): Promise<void> {
  await request("/createFolder", {
    method: "POST",
    body: JSON.stringify({ prefix, folderName }),
  })
}

export async function renameItem(sourceKey: string, newName: string, itemType: "file" | "folder"): Promise<void> {
  await request("/renameItem", {
    method: "POST",
    body: JSON.stringify({ sourceKey, newName, itemType }),
  })
}

export async function moveItem(sourceKey: string, targetPrefix: string, itemType: "file" | "folder"): Promise<void> {
  await request("/moveItem", {
    method: "POST",
    body: JSON.stringify({ sourceKey, targetPrefix, itemType }),
  })
}

export async function deleteItem(objectKey: string, itemType: "file" | "folder", recursive: boolean): Promise<void> {
  await request("/deleteItem", {
    method: "POST",
    body: JSON.stringify({ objectKey, itemType, recursive }),
  })
}

export async function uploadFiles(files: File[], prefix: string): Promise<UploadResult[]> {
  const form = new FormData()
  form.append("prefix", prefix)
  files.forEach((f) => form.append("files", f, f.name))

  const resp = await fetch(`${BASE}/files/upload`, { method: "POST", body: form })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: { message: resp.statusText } }))
    throw Object.assign(new Error(err.error?.message || "Upload failed"), { status: resp.status })
  }
  const data = await resp.json()
  return data.results as UploadResult[]
}

export function buildDownloadUrl(key: string): string {
  return `${BASE}/files/download?key=${encodeURIComponent(key)}`
}
