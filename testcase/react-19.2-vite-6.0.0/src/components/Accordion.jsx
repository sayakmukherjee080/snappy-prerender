import { useId, useState } from 'react';

/**
 * Renders an accessible single-open FAQ list.
 * @param {{ items: Array<{ question: string, answer: string }> }} props
 */
export function Accordion({ items }) {
  const [openIndex, setOpenIndex] = useState(0);
  const generatedId = useId();
  const baseId = `accordion-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <div className="accordion">
      {items.map((item, index) => {
        const isOpen = index === openIndex;
        const buttonId = `${baseId}-button-${index}`;
        const panelId = `${baseId}-panel-${index}`;

        return (
          <div className="accordion__item" key={item.question}>
            <h3 className="accordion__heading">
              <button
                type="button"
                className="accordion__button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
              >
                <span className="accordion__index">{String(index + 1).padStart(2, '0')}</span>
                <span className="accordion__question">{item.question}</span>
                <span className="accordion__icon" aria-hidden="true">
                  {isOpen ? '−' : '+'}
                </span>
              </button>
            </h3>
            <section
              className="accordion__panel"
              id={panelId}
              aria-labelledby={buttonId}
              hidden={!isOpen}
            >
              <p>{item.answer}</p>
            </section>
          </div>
        );
      })}
    </div>
  );
}
