import { useId, useState } from 'react';
import { CONTACT } from '../../content/site.js';

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
 * Renders the validated contact form that hands a composed message to the visitor's mail client.
 */
export function ContactForm() {
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
    if (!form.message.trim()) nextErrors.message = 'Tell us what you need.';
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
        <p className="form__note">This opens your mail client. Nothing is stored on this site.</p>
      </div>

      <p className="form__status field--full" aria-live="polite">
        {status === 'sent' &&
          `Your mail client should open with the message ready to send. If it does not, email ${CONTACT.general}.`}
      </p>
    </form>
  );
}
