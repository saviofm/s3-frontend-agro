import JSONModel from "sap/ui/model/json/JSONModel"

export default {
  createFilesModel(): JSONModel {
    return new JSONModel({
      items:         [],
      filteredItems: [],
      currentPrefix: "",
      breadcrumbs:   [{ text: "Root", prefix: "" }],
      busy:          false,
      searchQuery:   "",
      typeFilter:    "all",
      selectedItems: [],
      canManage:     false,
      folderTree:    [],
    })
  },
}
