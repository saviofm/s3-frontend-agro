import Controller from "sap/ui/core/mvc/Controller"
import JSONModel from "sap/ui/model/json/JSONModel"
import MessageToast from "sap/m/MessageToast"
import MessageBox from "sap/m/MessageBox"
import BusyIndicator from "sap/ui/core/BusyIndicator"
import Fragment from "sap/ui/core/Fragment"
import Dialog from "sap/m/Dialog"
import Table from "sap/m/Table"
import ColumnListItem from "sap/m/ColumnListItem"
import Breadcrumbs from "sap/m/Breadcrumbs"
import Link from "sap/m/Link"
import SearchField from "sap/m/SearchField"
import type { SearchField$SearchEvent } from "sap/m/SearchField"
import type { SearchField$LiveChangeEvent } from "sap/m/SearchField"
import type { Table$SelectionChangeEvent } from "sap/m/Table"
import type { ColumnListItem$PressEvent } from "sap/m/ColumnListItem"
import type { Link$PressEvent } from "sap/m/Link"
import type { SegmentedButton$SelectionChangeEvent } from "sap/m/SegmentedButton"
import type { FileItem, BreadcrumbItem } from "../model/types"
import * as FileService from "../model/FileService"

export default class HomeController extends Controller {
  private _filesModel!: JSONModel
  private _renameDialog: Dialog | null = null
  private _folderDialog: Dialog | null = null
  private _moveDialog: Dialog | null = null

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  public onInit(): void {
    this._filesModel = this.getOwnerComponent()!.getModel("files") as JSONModel
    this._loadFiles("")
  }

  // ── Data loading ──────────────────────────────────────────────────────────────
  private async _loadFiles(prefix: string): Promise<void> {
    this._filesModel.setProperty("/busy", true)
    try {
      const items = await FileService.listFiles(prefix)
      this._filesModel.setProperty("/items", items)
      this._filesModel.setProperty("/currentPrefix", prefix)
      this._applyFilter()
    } catch (err) {
      this._showError(err)
    } finally {
      this._filesModel.setProperty("/busy", false)
    }
  }

  private _applyFilter(): void {
    const items: FileItem[] = this._filesModel.getProperty("/items") || []
    const query: string     = (this._filesModel.getProperty("/searchQuery") || "").toLowerCase()
    const typeFilter: string = this._filesModel.getProperty("/typeFilter") || "all"

    const filtered = items.filter((item) => {
      const matchesSearch = !query || item.name.toLowerCase().includes(query)
      const matchesType   = typeFilter === "all" || item.itemType === typeFilter
      return matchesSearch && matchesType
    })
    this._filesModel.setProperty("/filteredItems", filtered)
  }

  // ── Breadcrumb ────────────────────────────────────────────────────────────────
  private _updateBreadcrumb(prefix: string): void {
    const crumbs: BreadcrumbItem[] = [{ text: "Root", prefix: "" }]
    if (prefix) {
      const parts = prefix.replace(/\/$/, "").split("/").filter(Boolean)
      let accumulated = ""
      for (const part of parts) {
        accumulated += `${part}/`
        crumbs.push({ text: part, prefix: accumulated })
      }
    }

    const breadcrumbs = this.byId("breadcrumbs") as Breadcrumbs
    breadcrumbs.destroyLinks()
    for (let i = 0; i < crumbs.length - 1; i++) {
      const crumb = crumbs[i]
      const link  = new Link({ text: crumb.text, press: () => this._navigateTo(crumb.prefix) })
      breadcrumbs.addLink(link)
    }
    breadcrumbs.setCurrentLocationText(crumbs[crumbs.length - 1].text)
  }

  private _navigateTo(prefix: string): void {
    this._loadFiles(prefix)
    this._updateBreadcrumb(prefix)
  }

  // ── Event handlers ─────────────────────────────────────────────────────────────
  public formatItemType(isFolder: boolean, folderLabel: string, fileLabel: string): string {
    return isFolder ? folderLabel : fileLabel
  }

  public formatItemCount(items: unknown[], label: string): string {
    return `${(items || []).length} ${label}`
  }

  public onRefresh(): void {
    const prefix: string = this._filesModel.getProperty("/currentPrefix") || ""
    this._loadFiles(prefix)
  }

  public onItemPress(event: ColumnListItem$PressEvent | Link$PressEvent): void {
    const source = event.getSource() as ColumnListItem
    const ctx = source.getBindingContext("files")
    if (!ctx) return

    const item = ctx.getObject() as FileItem
    if (item.isFolder) {
      this._navigateTo(item.objectKey)
    } else {
      window.open(FileService.buildDownloadUrl(item.objectKey), "_blank")
    }
  }

  public onSelectionChange(event: Table$SelectionChangeEvent): void {
    const table = this.byId("filesTable") as Table
    const selected = table.getSelectedItems().map((li) => li.getBindingContext("files")!.getObject() as FileItem)
    this._filesModel.setProperty("/selectedItems", selected)
  }

  public onSearch(event: SearchField$SearchEvent | SearchField$LiveChangeEvent): void {
    const query = (event.getSource() as SearchField).getValue() || ""
    this._filesModel.setProperty("/searchQuery", query)
    this._applyFilter()
  }

  public onTypeFilterChange(event: SegmentedButton$SelectionChangeEvent): void {
    const key = event.getParameter("key") as string
    this._filesModel.setProperty("/typeFilter", key)
    this._applyFilter()
  }

  // ── Upload ────────────────────────────────────────────────────────────────────
  public onUploadPress(): void {
    const input = document.createElement("input")
    input.type  = "file"
    input.multiple = true
    input.onchange = async () => {
      if (!input.files?.length) return
      const files   = Array.from(input.files)
      const prefix: string = this._filesModel.getProperty("/currentPrefix") || ""
      BusyIndicator.show(0)
      try {
        const results = await FileService.uploadFiles(files, prefix)
        const failed  = results.filter((r) => !r.success)
        if (failed.length) {
          MessageBox.warning(this._i18n("uploadPartial", [results.length - failed.length, failed.length]))
        } else {
          MessageToast.show(this._i18n("uploadSuccess", [results.length]))
        }
        this.onRefresh()
      } catch (err) {
        this._showError(err)
      } finally {
        BusyIndicator.hide()
      }
    }
    input.click()
  }

  // ── Download ──────────────────────────────────────────────────────────────────
  public onDownloadPress(): void {
    const selected: FileItem[] = this._filesModel.getProperty("/selectedItems") || []
    if (!selected.length || selected[0].isFolder) return
    const url = FileService.buildDownloadUrl(selected[0].objectKey)
    const a   = document.createElement("a")
    a.href    = url
    a.download = selected[0].name
    a.click()
  }

  // ── Create folder ─────────────────────────────────────────────────────────────
  public async onCreateFolderPress(): Promise<void> {
    if (!this._folderDialog) {
      this._folderDialog = (await Fragment.load({
        id:         this.getView()!.getId(),
        name:       "com.presales.objectstorefilemanageragro.fragment.CreateFolder",
        controller: this,
      })) as Dialog
      this.getView()!.addDependent(this._folderDialog)
    }
    (this._filesModel as JSONModel).setProperty("/newFolderName", "")
    this._folderDialog.open()
  }

  public async onCreateFolderConfirm(): Promise<void> {
    const name: string   = this._filesModel.getProperty("/newFolderName") || ""
    const prefix: string = this._filesModel.getProperty("/currentPrefix") || ""

    if (!name.trim()) {
      MessageToast.show(this._i18n("errorEmptyName"))
      return
    }

    BusyIndicator.show(0)
    try {
      await FileService.createFolder(prefix, name.trim())
      MessageToast.show(this._i18n("folderCreated", [name]))
      this._folderDialog?.close()
      this.onRefresh()
    } catch (err) {
      this._showError(err)
    } finally {
      BusyIndicator.hide()
    }
  }

  public onCreateFolderCancel(): void {
    this._folderDialog?.close()
  }

  // ── Rename ────────────────────────────────────────────────────────────────────
  public async onRenamePress(): Promise<void> {
    const selected: FileItem[] = this._filesModel.getProperty("/selectedItems") || []
    if (!selected.length) return

    if (!this._renameDialog) {
      this._renameDialog = (await Fragment.load({
        id:         this.getView()!.getId(),
        name:       "com.presales.objectstorefilemanageragro.fragment.Rename",
        controller: this,
      })) as Dialog
      this.getView()!.addDependent(this._renameDialog)
    }
    this._filesModel.setProperty("/renameValue", selected[0].name)
    this._renameDialog.open()
  }

  public async onRenameConfirm(): Promise<void> {
    const selected: FileItem[] = this._filesModel.getProperty("/selectedItems") || []
    const newName: string      = this._filesModel.getProperty("/renameValue") || ""

    if (!newName.trim()) {
      MessageToast.show(this._i18n("errorEmptyName"))
      return
    }

    BusyIndicator.show(0)
    try {
      await FileService.renameItem(selected[0].objectKey, newName.trim(), selected[0].itemType)
      MessageToast.show(this._i18n("renameSuccess"))
      this._renameDialog?.close()
      this.onRefresh()
    } catch (err) {
      this._showError(err)
    } finally {
      BusyIndicator.hide()
    }
  }

  public onRenameCancel(): void {
    this._renameDialog?.close()
  }

  // ── Move ──────────────────────────────────────────────────────────────────────
  public async onMovePress(): Promise<void> {
    const selected: FileItem[] = this._filesModel.getProperty("/selectedItems") || []
    if (!selected.length) return

    try {
      const tree = await FileService.getFolderTree()
      this._filesModel.setProperty("/folderTree", [
        { name: "/ (Root)", prefix: "", level: 0 },
        ...tree,
      ])
    } catch (err) {
      this._showError(err)
      return
    }

    if (!this._moveDialog) {
      this._moveDialog = (await Fragment.load({
        id:         this.getView()!.getId(),
        name:       "com.presales.objectstorefilemanageragro.fragment.Move",
        controller: this,
      })) as Dialog
      this.getView()!.addDependent(this._moveDialog)
    }
    this._filesModel.setProperty("/moveTargetPrefix", "")
    this._moveDialog.open()
  }

  public async onMoveConfirm(): Promise<void> {
    const selected: FileItem[]  = this._filesModel.getProperty("/selectedItems") || []
    const targetPrefix: string  = this._filesModel.getProperty("/moveTargetPrefix") || ""

    BusyIndicator.show(0)
    try {
      await FileService.moveItem(selected[0].objectKey, targetPrefix, selected[0].itemType)
      MessageToast.show(this._i18n("moveSuccess"))
      this._moveDialog?.close()
      this.onRefresh()
    } catch (err) {
      this._showError(err)
    } finally {
      BusyIndicator.hide()
    }
  }

  public onMoveFolderSelect(event: import("sap/m/List").List$SelectionChangeEvent): void {
    const ctx = event.getParameter("listItem")?.getBindingContext("files")
    const prefix: string = ctx ? (ctx.getObject() as { folderPrefix: string }).folderPrefix : ""
    this._filesModel.setProperty("/moveTargetPrefix", prefix)
  }

  public onMoveCancel(): void {
    this._moveDialog?.close()
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  public onDeletePress(): void {
    const selected: FileItem[] = this._filesModel.getProperty("/selectedItems") || []
    if (!selected.length) return

    const hasFolder = selected.some((i) => i.isFolder)
    const msg       = hasFolder
      ? this._i18n("confirmDeleteFolder")
      : this._i18n("confirmDeleteFiles", [selected.length])

    MessageBox.confirm(msg, {
      title:   this._i18n("confirmDeleteTitle"),
      onClose: (action: string) => {
        if (action === MessageBox.Action.OK) this._doDelete(selected, false)
      },
    })
  }

  private async _doDelete(items: FileItem[], recursive: boolean): Promise<void> {
    BusyIndicator.show(0)
    try {
      for (const item of items) {
        await FileService.deleteItem(item.objectKey, item.itemType, recursive)
      }
      MessageToast.show(this._i18n("deleteSuccess"))
      const table = this.byId("filesTable") as Table
      table.removeSelections(true)
      this._filesModel.setProperty("/selectedItems", [])
      this.onRefresh()
    } catch (err: unknown) {
      const e = err as { code?: string; target?: string; status?: number }
      if (e?.target === "FOLDER_NOT_EMPTY" || e?.status === 409) {
        MessageBox.confirm(this._i18n("confirmDeleteRecursive"), {
          title:   this._i18n("confirmDeleteTitle"),
          onClose: (action: string) => {
            if (action === MessageBox.Action.OK) this._doDelete(items, true)
          },
        })
      } else {
        this._showError(err)
      }
    } finally {
      BusyIndicator.hide()
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  private _i18n(key: string, args?: unknown[]): string {
    const bundle = (this.getOwnerComponent()!.getModel("i18n") as unknown as { getResourceBundle(): { getText(k: string, a?: unknown[]): string } }).getResourceBundle()
    return bundle.getText(key, args)
  }

  private _showError(err: unknown): void {
    const msg = (err instanceof Error) ? err.message : String(err)
    MessageBox.error(msg, { title: this._i18n("errorTitle") })
  }
}
