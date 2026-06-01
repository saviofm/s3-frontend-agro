import UIComponent from "sap/ui/core/UIComponent"
import models from "./model/models"

export default class Component extends UIComponent {
  public static metadata = {
    manifest: "json",
  }

  public init(): void {
    super.init()
    this.setModel(models.createFilesModel(), "files")
    this.getRouter().initialize()
  }
}
