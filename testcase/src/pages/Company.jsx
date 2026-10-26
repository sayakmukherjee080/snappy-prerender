import { useId, useState } from 'react';
import { PageHero, SectionHead } from '../components/index.js';
import { COMPANY_TIMELINE, CONTACT, INVESTORS, JOBS, SECTION_IDS, TEAM } from '../content/site.js';
import { usePageMeta } from '../hooks/usePageMeta.js';

const TOPICS = ['Capacity', 'Partnership', 'Press', 'Careers'];
const TOPIC_RECIPIENTS = {
  Capacity: CONTACT.capacity,
  Partnership: CONTACT.capacity,
  Press: CONTACT.press,
  Careers: CONTACT.careers,
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INITIAL_FORM = {
  name: '',
  email: '',
  company: '',
  topic: 'Capacity',
  message: '',
};

/**
 * Renders the company thesis, timeline, team, open roles, press contact, and contact form.
 */
export default function Company() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const generatedId = useId();
  const fieldPrefix = `contact-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const nameId = `${fieldPrefix}-name`;
  const emailId = `${fieldPrefix}-email`;
  const companyId = `${fieldPrefix}-company`;
  const topicId = `${fieldPrefix}-topic`;
  const messageId = `${fieldPrefix}-message`;

  usePageMeta({
    title: 'Company',
    description:
      'Aether Compute is building the infrastructure layer for intelligence off Earth. Meet the team, read the timeline, and open a channel.',
  });

  /**
   * Copies a field value into form state and clears that field's validation message.
   * @param {{ target: { name: string, value: string } }} event
   */
  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    if (status === 'sent') setStatus('idle');
  }

  /**
   * Validates the contact fields and hands the message to the visitor's mail client.
   * @param {{ preventDefault: Function }} event
   */
  function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Enter your name.';
    if (!EMAIL_PATTERN.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!form.message.trim()) {
      nextErrors.message = 'Tell us what you need.';
    }
    if (form.message.length > 2000) {
      nextErrors.message = 'Keep the message under 2,000 characters.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setStatus('idle');
      const firstError = Object.keys(nextErrors)[0];
      document.getElementById(`${fieldPrefix}-${firstError}`)?.focus();
      return;
    }

    const recipient = TOPIC_RECIPIENTS[form.topic] ?? CONTACT.capacity;
    const subject = `[${form.topic}] Inquiry from ${form.name.trim()}`;
    const body = [
      `Name: ${form.name.trim()}`,
      `Email: ${form.email.trim()}`,
      `Company: ${form.company.trim() || 'Not provided'}`,
      `Topic: ${form.topic}`,
      '',
      form.message.trim(),
    ].join('\n');

    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    setStatus('sent');
  }

  return (
    <>
      <PageHero
        index="05"
        label="Company"
        title={
          <>
            Small team.
            <br />
            Long orbit.
          </>
        }
        lede="We are infrastructure engineers, flight-software engineers, and one former launch director. We think compute belongs where the power is."
        meta={[
          { label: 'Founded', value: '2023 · Denver' },
          { label: 'Team', value: '38 people' },
          { label: 'Financing', value: 'Series B · $84M' },
        ]}
      />

      <section className="section">
        <div className="shell">
          <div className="manifesto">
            <div className="manifesto__intro">
              <p className="eyebrow">
                <span className="eyebrow__index">01</span>
                Our thesis
              </p>
              <h2>Intelligence should not be bottlenecked by real estate.</h2>
            </div>

            <div className="manifesto__body">
              <p>
                Terrestrial compute is running into physics of its own: interconnection queues
                measured in years, water rights in drought regions, and land that costs more than
                the servers. Orbit inverts the constraint. Solar is abundant, radiators point at 3
                K, and the only permit you need is a launch licence.
              </p>
              <p>
                We are not a space company that does AI. We are an AI infrastructure company that
                happens to be in space. The interface is an API. The product is latency, uptime, and
                capacity that can be scheduled.
              </p>

              <dl className="manifesto__stats">
                <div>
                  <dt>Per node</dt>
                  <dd>42 kW</dd>
                </div>
                <div>
                  <dt>Water used</dt>
                  <dd>0 L</dd>
                </div>
                <div>
                  <dt>Altitude</dt>
                  <dd>550 km</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHead
            index="02"
            label="Timeline"
            title={
              <>
                From test chamber
                <br />
                to orbit.
              </>
            }
            lede="Three years from a vacuum chamber in Denver to commercial tokens over Svalbard."
          />

          <ol className="timeline">
            {COMPANY_TIMELINE.map((item) => (
              <li
                className={`timeline__item${item.current ? ' timeline__item--current' : ''}`}
                key={item.year}
              >
                <div className="timeline__meta">
                  <span className="timeline__year">{item.year}</span>
                  <span className="timeline__status">{item.status}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHead
            index="03"
            label="Team"
            title={
              <>
                Four people,
                <br />
                one launch director.
              </>
            }
            lede="The founding team has shipped orbital hardware, inference runtimes, and ground networks. The rest of the company is thirty-four specialists across Denver, Svalbard, and Awarua."
          />

          <div className="team-grid">
            {TEAM.map((person) => (
              <article className="person" key={person.name}>
                <div className="person__portrait" aria-hidden="true">
                  <span>{person.initials}</span>
                </div>
                <h3>{person.name}</h3>
                <p className="person__role">{person.role}</p>
                <p className="person__bio">{person.bio}</p>
              </article>
            ))}
          </div>

          <div className="investor-band">
            <span className="mono-label">Backed by</span>
            <div className="logo-row">
              {INVESTORS.map((investor) => (
                <span key={investor}>{investor}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id={SECTION_IDS.careers}>
        <div className="shell">
          <SectionHead
            index="04"
            label="Careers"
            title={
              <>
                Work where the horizon
                <br />
                is a schedule.
              </>
            }
            lede="We hire people who are comfortable with hard deadlines, vacuum tests, and the occasional 04:00 UTC anomaly call."
          />

          <div className="jobs">
            {JOBS.map((job) => (
              <a
                className="job"
                key={job.title}
                href={`mailto:${CONTACT.careers}?subject=${encodeURIComponent(job.subject)}`}
              >
                <h3>{job.title}</h3>
                <span className="job__meta">{job.location}</span>
                <span className="job__meta">{job.type}</span>
                <span className="job__arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id={SECTION_IDS.press}>
        <div className="shell">
          <div className="press-panel">
            <div>
              <p className="eyebrow">
                <span className="eyebrow__index">05</span>
                Press
              </p>
              <h2>For the record.</h2>
            </div>
            <div>
              <p>
                Launch imagery, executive interviews, and the press kit are available on request. We
                answer press queries within one business day.
              </p>
              <a className="text-link" href={`mailto:${CONTACT.press}`}>
                {CONTACT.press} <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id={SECTION_IDS.contact}>
        <div className="shell">
          <SectionHead
            index="06"
            label="Contact"
            title={
              <>
                Open
                <br />a channel.
              </>
            }
            lede="Tell us your region, your monthly token volume, and when you need to be live. We will map the route and reply within two business days."
          />

          <div className="contact-grid">
            <div className="contact-details">
              <dl className="contact-list">
                <div>
                  <dt>Capacity</dt>
                  <dd>
                    <a href={`mailto:${CONTACT.capacity}`}>{CONTACT.capacity}</a>
                  </dd>
                </div>
                <div>
                  <dt>General</dt>
                  <dd>
                    <a href={`mailto:${CONTACT.general}`}>{CONTACT.general}</a>
                  </dd>
                </div>
                <div>
                  <dt>Press</dt>
                  <dd>
                    <a href={`mailto:${CONTACT.press}`}>{CONTACT.press}</a>
                  </dd>
                </div>
                <div>
                  <dt>Headquarters</dt>
                  <dd>{CONTACT.hq}</dd>
                </div>
                <div>
                  <dt>Ground operations</dt>
                  <dd>{CONTACT.groundOps}</dd>
                </div>
              </dl>
            </div>

            <form className="form" onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor={nameId}>Name</label>
                <input
                  id={nameId}
                  name="name"
                  type="text"
                  autoComplete="name"
                  maxLength={80}
                  required
                  value={form.name}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? `${nameId}-error` : undefined}
                />
                {errors.name && (
                  <span className="field__error" id={`${nameId}-error`}>
                    {errors.name}
                  </span>
                )}
              </div>

              <div className="field">
                <label htmlFor={emailId}>Work email</label>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={120}
                  required
                  value={form.email}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? `${emailId}-error` : undefined}
                />
                {errors.email && (
                  <span className="field__error" id={`${emailId}-error`}>
                    {errors.email}
                  </span>
                )}
              </div>

              <div className="field">
                <label htmlFor={companyId}>Company</label>
                <input
                  id={companyId}
                  name="company"
                  type="text"
                  autoComplete="organization"
                  maxLength={100}
                  value={form.company}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label htmlFor={topicId}>Topic</label>
                <select id={topicId} name="topic" value={form.topic} onChange={handleChange}>
                  {TOPICS.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field field--full">
                <label htmlFor={messageId}>Message</label>
                <textarea
                  id={messageId}
                  name="message"
                  rows="5"
                  maxLength={2000}
                  required
                  value={form.message}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? `${messageId}-error` : undefined}
                />
                {errors.message && (
                  <span className="field__error" id={`${messageId}-error`}>
                    {errors.message}
                  </span>
                )}
              </div>

              <div className="form__actions field--full">
                <button type="submit" className="button button--orange">
                  Compose message <span aria-hidden="true">↗</span>
                </button>
                <p className="form__note">
                  This opens your mail client. Nothing is stored on this site.
                </p>
              </div>

              <p className="form__status field--full" aria-live="polite">
                {status === 'sent' &&
                  `Your mail client should open with the message ready to send. If it does not, email ${CONTACT.general}.`}
              </p>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
