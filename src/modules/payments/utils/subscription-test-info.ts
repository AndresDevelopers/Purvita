import type {
  SubscriptionTestCard,
  SubscriptionTestInfo,
} from '../domain/models/subscription-test-info';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cloneExtras = (
  input: unknown,
): SubscriptionTestCard['extra'] => {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const extras: SubscriptionTestCard['extra'] = [];
  for (const entry of input) {
    if (!isRecord(entry)) {
      continue;
    }

    const label = typeof entry.label === 'string' ? entry.label : undefined;
    const value = typeof entry.value === 'string' ? entry.value : undefined;

    if (!label || !value) {
      continue;
    }

    extras.push({ label, value });
  }

  return extras.length > 0 ? extras : undefined;
};

const cloneCards = (input: unknown): SubscriptionTestCard[] | undefined => {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const cards: SubscriptionTestCard[] = [];
  for (const entry of input) {
    if (!isRecord(entry)) {
      continue;
    }

    const id = typeof entry.id === 'string' ? entry.id : undefined;
    const title = typeof entry.title === 'string' ? entry.title : undefined;
    const numberLabel = typeof entry.numberLabel === 'string' ? entry.numberLabel : undefined;
    const number = typeof entry.number === 'string' ? entry.number : undefined;
    const expiryLabel = typeof entry.expiryLabel === 'string' ? entry.expiryLabel : undefined;
    const expiry = typeof entry.expiry === 'string' ? entry.expiry : undefined;
    const cvcLabel = typeof entry.cvcLabel === 'string' ? entry.cvcLabel : undefined;
    const cvc = typeof entry.cvc === 'string' ? entry.cvc : undefined;

    if (!id || !title || !numberLabel || !number || !expiryLabel || !expiry || !cvcLabel || !cvc) {
      continue;
    }

    const card: SubscriptionTestCard = {
      id,
      title,
      numberLabel,
      number,
      expiryLabel,
      expiry,
      cvcLabel,
      cvc,
    };

    if (typeof entry.description === 'string') {
      card.description = entry.description;
    }

    const extra = cloneExtras(entry.extra);
    if (extra) {
      card.extra = extra;
    }

    cards.push(card);
  }

  return cards.length > 0 ? cards : undefined;
};

const cloneInstructions = (input: unknown): string[] | undefined => {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const instructions = input.filter((item): item is string => typeof item === 'string');
  return instructions.length > 0 ? [...instructions] : undefined;
};

export const normalizeSubscriptionTestInfo = (
  input?: unknown,
): SubscriptionTestInfo => {
  if (!isRecord(input)) {
    return {};
  }

  const result: SubscriptionTestInfo = {};

  if (typeof input.heading === 'string') {
    result.heading = input.heading;
  }

  if (typeof input.description === 'string') {
    result.description = input.description;
  }

  if (typeof input.note === 'string') {
    result.note = input.note;
  }

  const cards = cloneCards(input.cards);
  if (cards) {
    result.cards = cards;
  }

  const paypalInstructions = cloneInstructions(input.paypalInstructions);
  if (paypalInstructions) {
    result.paypalInstructions = paypalInstructions;
  }

  return result;
};
