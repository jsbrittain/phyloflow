import {
  LinkModel,
  PortModel,
  PortModelAlignment,
  PortModelGenerics,
  PortModelOptions,
} from "@projectstorm/react-diagrams-core";
import { DefaultLinkModel } from "../link/DefaultLinkModel";
import {
  AbstractModelFactory,
  DeserializeEvent,
} from "@projectstorm/react-canvas-core";

export interface DefaultPortModelOptions extends PortModelOptions {
  label?: string;
  in?: boolean;
  type?: string;
}

export interface DefaultPortModelGenerics extends PortModelGenerics {
  OPTIONS: DefaultPortModelOptions;
}

export class DefaultPortModel extends PortModel<DefaultPortModelGenerics> {
  constructor(isIn: boolean, name?: string, label?: string);
  constructor(options: DefaultPortModelOptions);
  constructor(
    options: DefaultPortModelOptions | boolean,
    name?: string,
    label?: string
  ) {
    if (name) {
      options = {
        in: !!options,
        name: name,
        label: label,
      };
    }
    options = options as DefaultPortModelOptions;
    super({
      label: options.label || options.name,
      alignment: options.in
        ? PortModelAlignment.TOP
        : PortModelAlignment.BOTTOM,
      type: "default",
      ...options,
    });
  }

  deserialize(event: DeserializeEvent<this>) {
    super.deserialize(event);
    this.options.in = event.data.in;
    this.options.label = event.data.label;
  }

  serialize() {
    return {
      ...super.serialize(),
      in: this.options.in,
      label: this.options.label,
    };
  }

  link<T extends LinkModel>(
    port: PortModel,
    factory?: AbstractModelFactory<T>
  ): T {
    const link = this.createLinkModel(factory);
    link.setSourcePort(this);
    link.setTargetPort(port);
    return link as T;
  }

  isIn(): boolean {
    return this.options.in;
  }

  isOut(): boolean {
    return !this.isIn();
  }

  canLinkToPort(port: PortModel): boolean {
    if (port instanceof DefaultPortModel) {
      return this.options.in !== port.getOptions().in;
    }
    return true;
  }

  createLinkModel(factory?: AbstractModelFactory<LinkModel>): LinkModel {
    const link = super.createLinkModel();
    if (!link && factory) {
      return factory.generateModel({});
    }
    return link || new DefaultLinkModel();
  }
}
