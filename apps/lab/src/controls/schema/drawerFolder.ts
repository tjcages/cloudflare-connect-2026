import { folder } from "leva";
import { loadLabSettings } from "../../persistence";
import { loadControlDrawerOpen } from "../drawerState";

export function drawerFolder<S extends Parameters<typeof folder>[0]>(id: string, schema: S) {
  return folder(schema, { collapsed: !loadControlDrawerOpen(id, loadLabSettings().drawerOpen[id] ?? false) });
}
