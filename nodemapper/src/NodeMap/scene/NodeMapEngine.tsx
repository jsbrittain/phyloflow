import NodeScene from "./NodeScene";

import { keys } from "lodash";
import { NodeModel } from "@projectstorm/react-diagrams";
import { DiagramEngine } from "@projectstorm/react-diagrams";

import { DefaultLinkModel } from "NodeMap";
import { DefaultPortModel } from "NodeMap";
import { DefaultNodeModel } from "NodeMap";
import { DefaultNodeFactory } from "NodeMap";
import { DefaultPortFactory } from "NodeMap";

// TODO: Replace with webpack proxy (problems getting this to work)
const API_ENDPOINT = "http://127.0.0.1:5000/api";

interface IPayload {
  id: string;
}

export default class NodeMapEngine {
  nodeScene: NodeScene = null;
  engine: DiagramEngine = null;

  constructor() {
    this.nodeScene = new NodeScene();
    this.engine = this.nodeScene.engine;
    // Register custom factories
    this.engine.getNodeFactories().clearFactories();
    this.engine.getNodeFactories().registerFactory(new DefaultNodeFactory());
    this.engine.getPortFactories().clearFactories();
    this.engine.getPortFactories().registerFactory(new DefaultPortFactory());
  }

  public NodesSelectNone() {
    this.engine
      .getModel()
      .getNodes()
      .forEach((item) => {
        item.setSelected(false);
      });
  }

  public QueryAndLoadTextFile(onLoad: (result) => void) {
    // Opens a file dialog, then executes readerEvent
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files[0];
      const reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = (readerEvent) => onLoad(readerEvent.target.result);
    };
    input.click();
  }

  public ClearScene() {
    this.nodeScene.clearModel();
  }

  public LoadScene() {
    const onLoad = (content) => {
      this.nodeScene.loadModel(content);
    };
    this.QueryAndLoadTextFile(onLoad);
  }

  public SaveScene() {
    const str = this.nodeScene.serializeModel();
    this.Download("model.json", str);
  }

  public Download(filename, text) {
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(text)
    );
    element.setAttribute("download", filename);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  public getNodeById(id: string): NodeModel {
    let returnNode = null;
    this.engine
      .getModel()
      .getNodes()
      .forEach((item) => {
        if (item.getOptions().id === id) returnNode = item;
      });
    return returnNode;
  }

  public getNodeByName(name: string): NodeModel {
    let returnNode = null;
    this.engine
      .getModel()
      .getNodes()
      .forEach((item) => {
        if (this.getProperty(item, "name") === name) returnNode = item;
      });
    return returnNode;
  }

  public getNodePropertiesAsJSON(node: NodeModel): Record<string, undefined> {
    return JSON.parse(node.getOptions().extras);
  }

  public getNodePropertiesAsStr(node: NodeModel): string {
    return node.getOptions().extras;
  }

  public getProperty(node: NodeModel, prop: string): string {
    const json = this.getNodePropertiesAsJSON(node);
    return json[prop];
  }

  public ConstructMapFromBlocks(data: JSON) {
    this.nodeScene.buildMapWithSnippets(data);
  }

  public MarkNodesWithoutConnectionsAsComplete(data: JSON) {
    this.nodeScene.markNodesWithoutConnectionsAsComplete(data);
  }

  public ZoomToFit() {
    this.engine.zoomToFit();
  }

  public RedistributeModel() {
    this.nodeScene.distributeModel(this.engine.getModel());
  }

  public GetModuleListJSON() {
    return this.nodeScene.getModuleListJSON();
  }

  public AddSelectionListeners(
    select_fn: (payload: IPayload) => void,
    deselect_fn: (payload: IPayload) => void,
    addlink_fn: (payload: DefaultLinkModel) => void
  ) {
    // Add listeners, noting the following useful resource:
    // https://github.com/projectstorm/react-diagrams/issues/164
    const model = this.engine.getModel();
    // Clear listeners on base model (link listeners)
    model.clearListeners();
    // New link listener
    model.registerListener({
      linksUpdated: (event) => {
        const link = event.link as DefaultLinkModel;
        link.registerListener({
          targetPortChanged: (event) => {
            addlink_fn(link);
          },
        });
      },
    });
    // Add node selection listeners
    model.getNodes().forEach((node) => {
      node.registerListener({
        selectionChanged: (e) => {
          const payload: IPayload = {
            id: node.getOptions().id,
          };
          if (e.isSelected) {
            select_fn(payload);
          } else {
            deselect_fn(payload);
          }
        },
      });
    });
  }

  public AddNodeToGraph(
    data: Record<string, unknown>,
    point,
    color,
    uniquenames = true
  ): DefaultNodeModel {
    const nodesCount = keys(this.engine.getModel().getNodes()).length;

    let node: DefaultNodeModel = null;
    let node_name = data.name as string;
    if (uniquenames) node_name += "_" + (nodesCount + 1);
    node = new DefaultNodeModel(
      node_name,
      color,
      JSON.stringify({
        id: "idcode", // TODO
        name: node_name,
        type: data.type,
        config: data.config,
      })
    );
    // Determine number (and names of input ports)
    let input_namespace = {};
    const params = (data.config as Record<string, any>).config;
    if (params.input_namespace === undefined) {
      // No input namespace specified - use default unless source
      if (data.type !== "source") {
        input_namespace["In"] = "In";
      }
    } else if (params.input_namespace === null) {
      // Null input namespace specified - no input ports
    } else if (typeof params.input_namespace === "object") {
      // Where the input namespace is an object (probably a dictionary)
      input_namespace = Object.keys(params.input_namespace);
    } else {
      // Where the input namespace is not an object (probably a string)
      input_namespace["In"] = "In";
    }
    // Add input ports
    for (const key in input_namespace) {
      node.addInPort(input_namespace[key]);
    }
    // Add output port (if applicable)
    switch (data.type) {
      case "source":
      case "module":
      case "connector":
        node.addOutPort("Out");
        break;
    }
    node.setPosition(point);
    this.engine.getModel().addNode(node);
    this.engine.repaintCanvas();
    return node;
  }

  public ExpandNodeByName(name: string): DefaultNodeModel[] {
    const node = this.getNodeByName(name);
    if (!node) return null;
    const json = this.getNodePropertiesAsJSON(node);
    if (!json.config) return null;
    if (!json.config["config"]) return null;
    const modules = json.config["config"] as Record<string, unknown>;
    const newnodes: DefaultNodeModel[] = [] as DefaultNodeModel[];
    let offset = 0.0;
    for (const item in modules) {
      if (modules[item] === null || modules[item] === undefined) continue;
      if (modules[item]["config"] === undefined) continue;
      const params = modules[item]["config"] as Record<string, unknown>;
      const config: Record<string, unknown> = {};
      for (const key in modules[item] as Record<string, unknown>) {
        if (key === "name") continue;
        if (key === "type") continue;
        if (key === "config") {
          config["config"] = modules[item][key];
        } else {
          config[key] = modules[item][key];
        }
      }
      const data = {
        name: item,
        type: (modules[item] as Record<string, unknown>).type,
        config: config,
      };
      const newpoint = node.getPosition().clone();
      newpoint.x += offset;
      newpoint.y += offset;
      offset += 5.0;
      // Call AddNodeToGraph with uniquenames = false to prevent node renaming
      // (at least until after the graph is expanded)
      const newnode = this.AddNodeToGraph(
        data,
        newpoint,
        "rgb(192,255,255)",
        false
      );
      newnodes.push(newnode);
    }

    // Connect sub-graph based on namespaces
    newnodes.forEach((node_from) => {
      const config = this.getNodePropertiesAsJSON(node_from)[
        "config"
      ] as Record<string, unknown>;
      const params = config["config"];
      const output_namespace = params["output_namespace"];
      newnodes.forEach((node_to) => {
        const config = this.getNodePropertiesAsJSON(node_to)[
          "config"
        ] as Record<string, unknown>;
        const params = config["config"];
        const input_namespace = params["input_namespace"];
        if (typeof input_namespace === "string") {
          // string = single input port
          if (output_namespace === input_namespace) {
            const link = new DefaultLinkModel();
            link.setSourcePort(node_from.getPort("Out"));
            link.setTargetPort(node_to.getPort("In"));
            this.engine.getModel().addLink(link);
          }
        } else {
          // record = multiple input ports
          for (const key in input_namespace) {
            if (output_namespace === input_namespace[key]) {
              const link = new DefaultLinkModel();
              link.setSourcePort(node_from.getPort("Out"));
              link.setTargetPort(node_to.getPort(key));
              this.engine.getModel().addLink(link);
            }
          }
        }
      });
    });

    // Map input connections to sub-graph
    const ports = this.nodeScene.getNodeInputNodes(node as DefaultNodeModel);
    for (const port_label in ports) {
      const node_name = ports[port_label];
      const node_from = this.getNodeByName(node_name);
      if (!node_from) continue;
      // Lookup target port in sub-graph
      const port_name_list = port_label.split("$");
      const targetnode_name = port_name_list[0];
      let port_name = "";
      if (port_name_list.length == 1) {
        port_name = "In";
      } else if (port_name_list.length == 2) {
        if (port_name_list[1] === "") {
          port_name = "In";
        } else {
          port_name = port_name_list[1];
        }
      } else {
        throw new Error("Recursive port naming not yet supported.");
      }
      const target_node = this.getNodeByName(targetnode_name);
      const target_port = target_node.getPort(port_name);
      // Create link
      const link = new DefaultLinkModel();
      link.setSourcePort(node_from.getPort("Out"));
      link.setTargetPort(target_port);
      this.engine.getModel().addLink(link);
    }

    // Map output connections from sub-graph
    const config = this.getNodePropertiesAsJSON(node)["config"] as Record<
      string,
      unknown
    >;
    const output_namespace = config["config"]["output_namespace"];
    const target_node_and_port = this.nodeScene.getNodeOutputNodes(
      node as DefaultNodeModel
    );
    for (let i = 0; i < target_node_and_port.length; i++) {
      const target_node = target_node_and_port[i][0];
      const target_port = target_node_and_port[i][1];
      // Lookup output port in sub-graph
      newnodes.forEach((node_from) => {
        const config = this.getNodePropertiesAsJSON(node_from)[
          "config"
        ] as Record<string, unknown>;
        const namespace = config["config"]["output_namespace"];
        if (namespace == output_namespace) {
          const source_port = node_from.getPort("Out");
          const link = new DefaultLinkModel();
          link.setSourcePort(source_port);
          link.setTargetPort(target_port);
          this.engine.getModel().addLink(link);
        }
      });
    }

    // Delete expanded node (be sure to delete links first)
    const links = this.engine.getModel().getLinks();
    links.forEach((link) => {
      if (
        link.getSourcePort().getParent() === node ||
        link.getTargetPort().getParent() === node
      ) {
        link.getSourcePort().removeLink(link);
        link.getTargetPort().removeLink(link);
        this.engine.getModel().removeLink(link);
      }
    });
    this.engine.getModel().removeNode(node);

    // TODO: Ensure unique names (subgraph was expanded without renaming so may
    //       clash with existing nodes)

    // Redraw and return new nodes
    this.engine.repaintCanvas();
    return newnodes;
  }
}
