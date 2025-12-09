export type SubscriptionTestCard = {
  id: string;
  title: string;
  description?: string;
  numberLabel: string;
  number: string;
  expiryLabel: string;
  expiry: string;
  cvcLabel: string;
  cvc: string;
  extra?: Array<{ label: string; value: string }>;
};

export type SubscriptionTestInfo = {
  heading?: string;
  description?: string;
  note?: string;
  cards?: SubscriptionTestCard[];
  paypalInstructions?: string[];
};
