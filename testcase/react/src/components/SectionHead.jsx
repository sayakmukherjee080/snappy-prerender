/**
 * Renders the section number, label, headline, and optional supporting paragraph.
 * @param {{ index: string, label: string, title: unknown, lede?: string }} props
 */
export function SectionHead({ index, label, title, lede }) {
  return (
    <div className="section-head">
      <p className="eyebrow">
        <span className="eyebrow__index">{index}</span>
        {label}
      </p>
      <div className={`section-head__body${lede ? '' : ' section-head__body--single'}`}>
        <h2>{title}</h2>
        {lede && <p className="lede">{lede}</p>}
      </div>
    </div>
  );
}
