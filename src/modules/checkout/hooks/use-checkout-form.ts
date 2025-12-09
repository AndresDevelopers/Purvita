/**
 * Custom hook for checkout form state management
 * Handles form values, validation, and field errors
 */

import { useState, useCallback } from 'react';

export type FormField = 'fullName' | 'addressLine1' | 'city' | 'state' | 'postalCode' | 'country' | 'phone';

const INITIAL_FORM_ERRORS: Record<FormField, boolean> = {
  fullName: false,
  addressLine1: false,
  city: false,
  state: false,
  postalCode: false,
  country: false,
  phone: false,
};

const REQUIRED_FIELDS: FormField[] = ['fullName', 'addressLine1', 'city', 'postalCode', 'country'];

export function useCheckoutForm(initialValues?: Partial<Record<FormField, string>>) {
  const [formValues, setFormValues] = useState<Record<FormField, string>>({
    fullName: initialValues?.fullName || '',
    addressLine1: initialValues?.addressLine1 || '',
    city: initialValues?.city || '',
    state: initialValues?.state || '',
    postalCode: initialValues?.postalCode || '',
    country: initialValues?.country || '',
    phone: initialValues?.phone || '',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<FormField, boolean>>(INITIAL_FORM_ERRORS);

  const updateField = useCallback((field: FormField, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: false }));
  }, []);

  const validateForm = useCallback(() => {
    const nextErrors: Record<FormField, boolean> = { ...INITIAL_FORM_ERRORS };

    REQUIRED_FIELDS.forEach((field) => {
      nextErrors[field] = formValues[field].trim().length === 0;
    });

    setFieldErrors(nextErrors);
    return !Object.values(nextErrors).some((value) => value);
  }, [formValues]);

  const resetErrors = useCallback(() => {
    setFieldErrors(INITIAL_FORM_ERRORS);
  }, []);

  const setValues = useCallback((values: Partial<Record<FormField, string>>) => {
    setFormValues((prev) => ({ ...prev, ...values }));
  }, []);

  return {
    formValues,
    fieldErrors,
    updateField,
    validateForm,
    resetErrors,
    setValues,
  };
}
