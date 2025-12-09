export const getPlanValidationMessage = (path: string, dict?: any): string => {
  const messages: Record<string, string> = {
    'slug': dict?.admin?.planForm?.validation?.slug || 'Enter a valid slug for the plan.',
    'name_en': dict?.admin?.planForm?.validation?.nameEn || 'Enter the plan name in English.',
    'name_es': dict?.admin?.planForm?.validation?.nameEs || 'Enter the plan name in Spanish.',
    'description_en': dict?.admin?.planForm?.validation?.descriptionEn || 'Enter the plan description in English.',
    'description_es': dict?.admin?.planForm?.validation?.descriptionEs || 'Enter the plan description in Spanish.',
    'features_en': dict?.admin?.planForm?.validation?.featuresEn || 'Add at least one feature in English.',
    'features_es': dict?.admin?.planForm?.validation?.featuresEs || 'Add at least one feature in Spanish.',
    'price': dict?.admin?.planForm?.validation?.price || 'Enter a valid price for the plan.',
  };

  return messages[path] || (dict?.admin?.planForm?.validation?.default || 'Please review the required fields.');
};
