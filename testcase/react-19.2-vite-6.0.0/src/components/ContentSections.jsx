import { slugify } from '../lib/slug.js';

/**
 * Decides whether a data section should render for the current record and preferences.
 * @param {{ when?: string, flag?: string, variant?: string }} section
 * @param {Record<string, unknown>} record
 * @param {{ flags: Record<string, boolean>, variant: string }} preferences
 * @returns {boolean}
 */
function isSectionVisible(section, record, preferences) {
  if (section.when === 'active' && record.telemetry !== true) return false;
  if (section.when === 'planned' && record.telemetry === true) return false;
  if (section.flag && !preferences.flags[section.flag]) return false;
  if (section.variant && preferences.variant !== section.variant) return false;
  return true;
}

/**
 * Renders a list of compact content sections with optional lists, stats, code, and callouts.
 * @param {{ sections?: Array<object>, record?: Record<string, unknown>, preferences: { flags: Record<string, boolean>, variant: string } }} props
 */
export function ContentSections({ sections = [], record = {}, preferences }) {
  const visible = sections.filter((section) => isSectionVisible(section, record, preferences));
  if (visible.length === 0) return null;

  return (
    <div className="content-sections">
      {visible.map((section) => {
        const id = section.id ?? slugify(section.title);
        const paragraphs = Array.isArray(section.body)
          ? section.body
          : section.body
            ? [section.body]
            : [];

        return (
          <section className="content-section" key={id} id={id}>
            <h2>{section.title}</h2>
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}

            {section.list && (
              <ul className="content-list">
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}

            {section.stats && (
              <dl className="stat-strip">
                {section.stats.map((stat) => (
                  <div key={stat.label}>
                    <dt>{stat.label}</dt>
                    <dd>{stat.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {section.code && <pre className="inline-code">{section.code}</pre>}

            {section.callout && <aside className="callout">{section.callout}</aside>}
          </section>
        );
      })}
    </div>
  );
}
