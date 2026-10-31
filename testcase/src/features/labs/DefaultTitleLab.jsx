import { Head } from '../../../../src/head/index.js';
import { Link } from '../../router.jsx';
import { LabShell } from './LabShell.jsx';

/**
 * Proves defaultTitle fills the document title when a route supplies no title, without
 * running the value through a template.
 */
export default function DefaultTitleLab() {
  return (
    <>
      <Head defaultTitle="Aether fallback title" titleAttributes={{ itemProp: 'name' }} />
      <LabShell
        title="Default title"
        summary="No page title is set; the browser tab and document title come from defaultTitle."
        tags={['Head', 'defaultTitle']}
        notes={[
          'The document title is the fallback value, not a templated page title.',
          'The site-wide usePageMeta hook is disabled for this route so Head owns the document.',
        ]}
      >
        <div className="lab-demo">
          <p className="widget-note">
            Open the browser tab: it reads “Aether fallback title” because this route has no title
            of its own.
          </p>
          <div className="lab-controls">
            <Link to="/lab/head-parity">Head parity lab</Link>
            <Link to="/">Leave lab</Link>
          </div>
        </div>
      </LabShell>
    </>
  );
}
