/**
 * Minimal resolver for the single-template Aether app. It maps Ember's conventional names to
 * the AMD modules the build already registers, avoiding the addon resolver's module naming
 * differences in Ember 3.22.
 */
export default class Resolver {
  constructor(props) {
    this.namespace = props.namespace;
  }

  static create(props) {
    return new Resolver(props);
  }

  resolve(fullName) {
    const [type, name] = fullName.split(':');
    const moduleName = `${this.namespace}/${type}s/${name}`;
    const registry = typeof requirejs !== 'undefined' ? requirejs.entries : undefined;
    if (!registry || !registry[moduleName]) return undefined;
    if (type === 'template' || type === 'component') {
      return require(moduleName).default;
    }
    return {
      create() {
        return require(moduleName).default;
      },
    };
  }
}
