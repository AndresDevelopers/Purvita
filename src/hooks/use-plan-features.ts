import { useState } from 'react';

export function usePlanFeatures(initialFeatures: string[] = ['']) {
  const [features, setFeatures] = useState<string[]>(initialFeatures);

  const handleChange = (index: number, value: string) => {
    const newFeatures = [...features];
    newFeatures[index] = value;
    setFeatures(newFeatures);
  };

  const add = () => {
    setFeatures([...features, '']);
  };

  const remove = (index: number) => {
    if (features.length > 1) {
      setFeatures(features.filter((_, i) => i !== index));
    }
  };

  const getSanitized = () => {
    return features
      .map(feature => feature.trim())
      .filter(feature => feature !== '');
  };

  return {
    features,
    handleChange,
    add,
    remove,
    getSanitized,
  };
}
