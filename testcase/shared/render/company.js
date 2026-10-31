import { COMPANY_TIMELINE, CONTACT, INVESTORS, JOBS, SECTION_IDS, TEAM } from '../content/site.js';
import { pageHero, sectionHead } from './base.js';
import { widgetMarkup } from './widgets.js';

/**
 * Renders the company thesis, timeline, team, open roles, press contact, and contact form.
 * @returns {string}
 */
export function companyPage() {
  return `${pageHero({
    index: '05',
    label: 'Company',
    title: 'Small team.<br />Long orbit.',
    lede: 'We are infrastructure engineers, flight-software engineers, and one former launch director. We think compute belongs where the power is.',
    meta: [
      { label: 'Founded', value: '2023 · Denver' },
      { label: 'Team', value: '38 people' },
      { label: 'Financing', value: 'Series B · $84M' },
    ],
  })}

<section class="section"><div class="shell">
  <div class="manifesto">
    <div class="manifesto__intro">
      <p class="eyebrow"><span class="eyebrow__index">01</span>Our thesis</p>
      <h2>Intelligence should not be bottlenecked by real estate.</h2>
    </div>
    <div class="manifesto__body">
      <p>Terrestrial compute is running into physics of its own: interconnection queues measured in years, water rights in drought regions, and land that costs more than the servers. Orbit inverts the constraint. Solar is abundant, radiators point at 3 K, and the only permit you need is a launch licence.</p>
      <p>We are not a space company that does AI. We are an AI infrastructure company that happens to be in space. The interface is an API. The product is latency, uptime, and capacity that can be scheduled.</p>
      <dl class="manifesto__stats"><div><dt>Per node</dt><dd>42 kW</dd></div><div><dt>Water used</dt><dd>0 L</dd></div><div><dt>Altitude</dt><dd>550 km</dd></div></dl>
    </div>
  </div>
</div></section>

<section class="section"><div class="shell">
  ${sectionHead({
    index: '02',
    label: 'Timeline',
    title: 'From test chamber<br />to orbit.',
    lede: 'Three years from a vacuum chamber in Denver to commercial tokens over Svalbard.',
  })}
  <ol class="timeline">${COMPANY_TIMELINE.map(
    (item) => `<li class="timeline__item${item.current ? ' timeline__item--current' : ''}">
    <div class="timeline__meta"><span class="timeline__year">${item.year}</span><span class="timeline__status">${item.status}</span></div>
    <h3>${item.title}</h3><p>${item.copy}</p>
  </li>`,
  ).join('')}</ol>
</div></section>

<section class="section"><div class="shell">
  ${sectionHead({
    index: '03',
    label: 'Team',
    title: 'Four people,<br />one launch director.',
    lede: 'The founding team has shipped orbital hardware, inference runtimes, and ground networks. The rest of the company is thirty-four specialists across Denver, Svalbard, and Awarua.',
  })}
  <div class="team-grid">${TEAM.map(
    (person) =>
      `<article class="person"><div class="person__portrait" aria-hidden="true"><span>${person.initials}</span></div><h3>${person.name}</h3><p class="person__role">${person.role}</p><p class="person__bio">${person.bio}</p></article>`,
  ).join('')}</div>
  <div class="investor-band"><span class="mono-label">Backed by</span><div class="logo-row">${INVESTORS.map(
    (investor) => `<span>${investor}</span>`,
  ).join('')}</div></div>
</div></section>

<section class="section" id="${SECTION_IDS.careers}"><div class="shell">
  ${sectionHead({
    index: '04',
    label: 'Careers',
    title: 'Work where the horizon<br />is a schedule.',
    lede: 'We hire people who are comfortable with hard deadlines, vacuum tests, and the occasional 04:00 UTC anomaly call.',
  })}
  <div class="jobs">${JOBS.map(
    (job) =>
      `<a class="job" href="mailto:${CONTACT.careers}?subject=${encodeURIComponent(
        job.subject,
      )}"><h3>${job.title}</h3><span class="job__meta">${job.location}</span><span class="job__meta">${
        job.type
      }</span><span class="job__arrow" aria-hidden="true">↗</span></a>`,
  ).join('')}</div>
</div></section>

<section class="section" id="${SECTION_IDS.press}"><div class="shell">
  <div class="press-panel">
    <div><p class="eyebrow"><span class="eyebrow__index">05</span>Press</p><h2>For the record.</h2></div>
    <div><p>Launch imagery, executive interviews, and the press kit are available on request. We answer press queries within one business day.</p><a class="text-link" href="mailto:${CONTACT.press}">${CONTACT.press} <span aria-hidden="true">↗</span></a></div>
  </div>
</div></section>

<section class="section" id="${SECTION_IDS.contact}"><div class="shell">
  ${sectionHead({
    index: '06',
    label: 'Contact',
    title: 'Open<br />a channel.',
    lede: 'Tell us your region, your monthly token volume, and when you need to be live. We will map the route and reply within two business days.',
  })}
  <div class="contact-grid">
    <div class="contact-details"><dl class="contact-list">
      <div><dt>Capacity</dt><dd><a href="mailto:${CONTACT.capacity}">${CONTACT.capacity}</a></dd></div>
      <div><dt>General</dt><dd><a href="mailto:${CONTACT.general}">${CONTACT.general}</a></dd></div>
      <div><dt>Press</dt><dd><a href="mailto:${CONTACT.press}">${CONTACT.press}</a></dd></div>
      <div><dt>Headquarters</dt><dd>${CONTACT.hq}</dd></div>
      <div><dt>Ground operations</dt><dd>${CONTACT.groundOps}</dd></div>
    </dl></div>
    ${widgetMarkup('contact-form')}
  </div>
</div></section>`;
}
