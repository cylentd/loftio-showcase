import { RESIDENT_COPY as COPY } from './copy';
import { residentName, suggestedName } from './names';
import type { ResidentEntry } from './registry';

export function arrivalNameField(entry: ResidentEntry) {
  const field = document.createElement('div'); field.className = 'resident-name';
  const label = document.createElement('label'); label.textContent = COPY.nameLabel;
  const input = document.createElement('input'); input.type = 'text'; input.required = true;
  input.id = 'arrival-name'; input.name = 'resident-name'; input.autocomplete = 'off';
  input.value = entry.name ?? suggestedName(entry.id); label.htmlFor = input.id;
  const hint = document.createElement('p'); hint.id = 'arrival-name-hint'; hint.textContent = COPY.nameHint;
  const error = document.createElement('p'); error.id = 'arrival-name-error'; error.setAttribute('role', 'alert');
  input.setAttribute('aria-describedby', hint.id + ' ' + error.id);
  const validate = () => {
    try {
      const name = residentName(input.value);
      input.setCustomValidity(''); input.removeAttribute('aria-invalid'); error.textContent = '';
      return name;
    } catch {
      input.setCustomValidity(COPY.nameInvalid); input.setAttribute('aria-invalid', 'true');
      error.textContent = COPY.nameInvalid; return null;
    }
  };
  input.addEventListener('input', validate);
  input.addEventListener('invalid', validate);
  field.append(label, input, hint, error);
  return { field, input, read() {
    const name = validate(); if (name === null) input.reportValidity(); return name;
  } };
}
