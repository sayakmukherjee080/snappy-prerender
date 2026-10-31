import { usePreferences } from '../features/preferences/hooks.js';
import { WidgetRenderer } from '../features/widgets/WidgetRenderer.jsx';
import { ContentSections } from './ContentSections.jsx';
import { PageIntro } from './PageIntro.jsx';
import { RelatedLinks } from './RelatedLinks.jsx';

/**
 * Renders a data-driven detail page with shared masthead, sections, widget, and related links.
 * @param {{ record: object, children?: unknown }} props
 */
export function DetailPage({ record, children }) {
  const preferences = usePreferences();

  return (
    <article className="detail-page">
      <PageIntro
        eyebrow={record.eyebrow}
        title={record.title}
        summary={record.summary}
        meta={record.meta}
        badge={record.badge}
        actions={
          record.apply ? (
            <a className="button button--orange" href={record.apply.href}>
              {record.apply.label} <span aria-hidden="true">↗</span>
            </a>
          ) : undefined
        }
      />

      <div className="shell detail-grid">
        <div className="detail-main">
          <ContentSections sections={record.sections} record={record} preferences={preferences} />
          {record.widget && <WidgetRenderer widget={record.widget} record={record} />}
          {children}
        </div>
        <RelatedLinks links={record.related} />
      </div>
    </article>
  );
}
