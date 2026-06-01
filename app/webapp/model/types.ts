export interface FileItem {
  name: string
  objectKey: string
  objectPath: string
  itemType: "file" | "folder"
  size: number
  lastModified: string | null
  contentType: string
  isFolder: boolean
}

export interface FolderItem {
  name: string
  folderPrefix: string
  parentPrefix: string
  level: number
}

export interface UploadResult {
  fileName: string
  objectKey: string
  success: boolean
  message?: string
}

export interface BreadcrumbItem {
  text: string
  prefix: string
}
