import { contextBridge, ipcRenderer } from "electron";

type Query = Record<string, unknown>;

contextBridge.exposeInMainWorld("displayAPI", {
  FolderInfo: (query: Query) => ipcRenderer.invoke("display/folderinfo", query),
});

contextBridge.exposeInMainWorld("builderAPI", {
  CompileToJson: (query: Query) =>
    ipcRenderer.invoke("builder/compile-to-json", query),
  GetRemoteModules: (query: Query) =>
    ipcRenderer.invoke("builder/get-remote-modules", query),
});

contextBridge.exposeInMainWorld("runnerAPI", {
  Build: (query: Query) => ipcRenderer.invoke("runner/build", query),
  DeleteResults: (query: Query) =>
    ipcRenderer.invoke("runner/deleteresults", query),
  Lint: (query: Query) => ipcRenderer.invoke("runner/lint", query),
  LoadWorkflow: (query: Query) =>
    ipcRenderer.invoke("runner/loadworkflow", query),
  Tokenize: (query: Query) => ipcRenderer.invoke("runner/tokenize", query),
  TokenizeLoad: (query: Query) =>
    ipcRenderer.invoke("runner/tokenize_load", query),
  JobStatus: (query: Query) => ipcRenderer.invoke("runner/jobstatus", query),
  Launch: (query: Query) => ipcRenderer.invoke("runner/launch", query),
  CheckNodeDependencies: (query: Query) =>
    ipcRenderer.invoke("runner/check-node-dependencies", query),
});
