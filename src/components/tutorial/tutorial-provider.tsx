'use client';

import { useState, useEffect } from 'react';
import { TutorialModal } from './tutorial-modal';
import { useTutorial } from '@/hooks/use-tutorial';

interface TutorialProviderProps {
  children: React.ReactNode;
}

export function TutorialProvider({ children }: TutorialProviderProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { hasActiveTutorial } = useTutorial();

  useEffect(() => {
    // Show tutorial modal when there's an active tutorial
    if (hasActiveTutorial) {
      setIsModalOpen(true);
    }
  }, [hasActiveTutorial]);

  const handleClose = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      {children}
      <TutorialModal
        isOpen={isModalOpen}
        onClose={handleClose}
      />
    </>
  );
}