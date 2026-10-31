import { MODELS } from '../../content/catalog/models.js';

/**
 * Renders the model catalog comparison table.
 */
export function ModelCompareTable() {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>Model catalog</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col">Family</th>
            <th scope="col">Context</th>
            <th scope="col">Input</th>
            <th scope="col">Output</th>
          </tr>
        </thead>
        <tbody>
          {MODELS.map((model) => (
            <tr key={model.slug}>
              <th scope="row">{model.name}</th>
              <td>{model.family}</td>
              <td className="mono-cell">{model.context}</td>
              <td className="mono-cell">{model.input}</td>
              <td className="mono-cell">{model.output}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Renders the measured benchmark bars for every catalog model.
 */
export function BenchmarkTable() {
  return (
    <div className="benchmark-table">
      {MODELS.map((model) => (
        <article className="benchmark-row" key={model.slug}>
          <div className="benchmark-row__head">
            <h3>{model.name}</h3>
            <span>{model.family}</span>
          </div>
          <div className="benchmark-row__bars">
            {model.benchmarks.map((benchmark) => (
              <div className="benchmark" key={benchmark.label}>
                <span className="benchmark__label">{benchmark.label}</span>
                <span className="benchmark__track" aria-hidden="true">
                  <span
                    className="benchmark__bar"
                    style={{ width: `${(benchmark.value / benchmark.max) * 100}%` }}
                  />
                </span>
                <span className="benchmark__value">{benchmark.value}</span>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * Renders the retirement table for deprecated model aliases.
 */
export function DeprecatedModels() {
  const rows = [
    { alias: 'aether-70b', replacement: 'aether-70b-instruct', retired: '2026-12-31' },
    { alias: 'aether-8x22b-v1', replacement: 'aether-8x22b', retired: '2026-11-15' },
    { alias: 'aether-embed-1024', replacement: 'aether-embed', retired: '2027-01-31' },
    { alias: 'aether-mini-v0', replacement: 'aether-mini', retired: '2026-10-01' },
  ];

  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>Deprecated aliases</caption>
        <thead>
          <tr>
            <th scope="col">Alias</th>
            <th scope="col">Replacement</th>
            <th scope="col">Retires</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.alias}>
              <td className="mono-cell">{row.alias}</td>
              <td className="mono-cell">{row.replacement}</td>
              <td className="mono-cell">{row.retired}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
