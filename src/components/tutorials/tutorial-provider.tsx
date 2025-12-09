'use client';

import { useEffect } from 'react';
import { useTutorial } from '@/hooks/use-tutorial';
import { TutorialModal } from './tutorial-modal';

export function TutorialProvider() {
  const {
    currentTutorial,
    fullTutorial,
    loading,
    getActiveTutorial,
    fetchTutorial,
    markTutorialCompleted,
    markTutorialSkipped,
  } = useTutorial();

  const activeTutorial = getActiveTutorial();

  useEffect(() => {
    if (activeTutorial && !currentTutorial) {
      fetchTutorial(activeTutorial.tutorial_id);
    }
  }, [activeTutorial, currentTutorial, fetchTutorial]);

  if (loading || !activeTutorial || !currentTutorial || !fullTutorial) {
    return null;
  }

  return (
    <TutorialModal
      tutorial={fullTutorial}
      status={activeTutorial}
      onClose={() => {
        // Just close without marking as completed/skipped
      }}
      onComplete={() => {
        markTutorialCompleted(activeTutorial.tutorial_id);
      }}
      onSkip={() => {
        markTutorialSkipped(activeTutorial.tutorial_id);
      }}
    />
  );
}