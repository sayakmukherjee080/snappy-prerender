import { CONTACT, JOBS, TEAM } from '../../content/site.js';

/**
 * Renders the founding-team grid used on the team index.
 */
export function TeamGrid() {
  return (
    <div className="team-grid widget-team">
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
  );
}

/**
 * Renders the open-roles list with mailto application links.
 */
export function JobsList() {
  return (
    <div className="jobs widget-jobs">
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
  );
}
