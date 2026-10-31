import { COMPARISON_ROWS } from '../../content/pricing.js';

/**
 * Renders the plan comparison table for the standalone compare page.
 */
export function PricingCompareTable() {
  return (
    <div className="table-wrap widget-table">
      <table className="data-table">
        <caption>Plan comparison</caption>
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Developer</th>
            <th scope="col">Scale</th>
            <th scope="col">Dedicated</th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.developer}</td>
              <td>{row.scale}</td>
              <td>{row.dedicated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
