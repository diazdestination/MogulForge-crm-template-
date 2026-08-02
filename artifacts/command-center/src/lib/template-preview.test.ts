import { describe, expect, it } from 'vitest';
import { previewTemplate, SAMPLE_TEMPLATE_VARS } from './template-preview';

describe('previewTemplate', () => {
  it('replaces known placeholders with sample values', () => {
    const { rendered, unknownPlaceholders } = previewTemplate(
      'Hi {{contact.firstName}}, thanks for contacting {{business.name}}! Call {{business.phone}}.',
    );
    expect(rendered).toBe(
      `Hi ${SAMPLE_TEMPLATE_VARS['contact.firstName']}, thanks for contacting ${SAMPLE_TEMPLATE_VARS['business.name']}! Call ${SAMPLE_TEMPLATE_VARS['business.phone']}.`,
    );
    expect(unknownPlaceholders).toEqual([]);
  });

  it('tolerates whitespace inside braces, like the server renderer', () => {
    expect(previewTemplate('Hi {{ contact.firstName }}').rendered).toBe(
      `Hi ${SAMPLE_TEMPLATE_VARS['contact.firstName']}`,
    );
  });

  it('flags unknown placeholders and leaves them visible', () => {
    const { rendered, unknownPlaceholders } = previewTemplate(
      'Hi {{contact.firstname}}, from {{business.name}}',
    );
    expect(unknownPlaceholders).toEqual(['contact.firstname']);
    expect(rendered).toBe(
      `Hi {{contact.firstname}}, from ${SAMPLE_TEMPLATE_VARS['business.name']}`,
    );
  });

  it('deduplicates repeated unknown placeholders', () => {
    const { unknownPlaceholders } = previewTemplate('{{foo.bar}} and {{foo.bar}} and {{baz}}');
    expect(unknownPlaceholders).toEqual(['foo.bar', 'baz']);
  });

  it('ignores text that is not a placeholder', () => {
    expect(previewTemplate('No placeholders here { single } {{ }}').rendered).toBe(
      'No placeholders here { single } {{ }}',
    );
  });
});
