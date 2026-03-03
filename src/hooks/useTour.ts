"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getStepsForRole,
  type TourStep,
} from "@/lib/onboardingSteps";

export type TourState = {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  targetRect: DOMRect | null;
  showTooltip: boolean;
};

export type UseTourReturn = {
  state: TourState;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => Promise<void>;
  finishTour: () => Promise<void>;
  restartTour: () => void;
};

function findElement(target: string): Element | null {
  return document.querySelector(`[data-tour="${target}"]`);
}

async function updateProfile(userId: string, data: { onboarding_completed?: boolean; onboarding_step?: number }) {
  const supabase = createClient();
  await supabase.from("profiles").update(data).eq("id", userId);
}

export function useTour(
  role: string,
  isEnabled: boolean,
  userId: string | undefined,
  initialStep: number,
  persistChanges: boolean
): UseTourReturn {
  const steps = getStepsForRole(role);
  const [currentStep, setCurrentStep] = useState(
    Math.min(Math.max(0, initialStep), Math.max(0, steps.length - 1))
  );
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const updateTargetRect = useCallback(() => {
    if (steps.length === 0 || currentStep >= steps.length) {
      setTargetRect(null);
      setShowTooltip(false);
      return;
    }
    const step = steps[currentStep];
    const el = findElement(step.target);
    if (!el) {
      setTargetRect(null);
      setShowTooltip(true);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const rect = el.getBoundingClientRect();
    setTargetRect(rect);
    setShowTooltip(true);
  }, [currentStep, steps]);

  useEffect(() => {
    if (!isEnabled || (role !== "owner" && role !== "instructor") || steps.length === 0) {
      return;
    }
    let step = Math.min(Math.max(0, initialStep), Math.max(0, steps.length - 1));
    if (step >= steps.length) {
      if (persistChanges && userId) {
        void updateProfile(userId, { onboarding_completed: true });
      }
      return;
    }
    setIsActive(true);
    setCurrentStep(step);
  }, [isEnabled, role, steps.length, initialStep, userId, persistChanges]);

  useEffect(() => {
    if (!isActive) return;
    updateTargetRect();
    const timer = setTimeout(updateTargetRect, 100);
    const handleResize = () => updateTargetRect();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", updateTargetRect, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", updateTargetRect, true);
    };
  }, [isActive, currentStep, updateTargetRect]);

  const finishTour = useCallback(async () => {
    if (persistChanges && userId) {
      await updateProfile(userId, { onboarding_completed: true, onboarding_step: 0 });
    }
    setIsActive(false);
    setCurrentStep(0);
    setTargetRect(null);
    setShowTooltip(false);
  }, [userId, persistChanges]);

  const nextStep = useCallback(async () => {
    if (currentStep >= steps.length - 1) {
      void finishTour();
      return;
    }
    const next = currentStep + 1;
    if (persistChanges && userId) {
      await updateProfile(userId, { onboarding_step: next });
    }
    setCurrentStep(next);
  }, [currentStep, steps.length, userId, persistChanges, finishTour]);

  const prevStep = useCallback(async () => {
    const prev = Math.max(0, currentStep - 1);
    if (persistChanges && userId) {
      await updateProfile(userId, { onboarding_step: prev });
    }
    setCurrentStep(prev);
  }, [currentStep, userId, persistChanges]);

  const skipTour = useCallback(async () => {
    if (persistChanges && userId) {
      await updateProfile(userId, { onboarding_completed: true });
    }
    setIsActive(false);
    setCurrentStep(0);
    setTargetRect(null);
    setShowTooltip(false);
  }, [userId, persistChanges]);

  const restartTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    updateTargetRect();
  }, [updateTargetRect]);

  return {
    state: {
      isActive,
      currentStep,
      steps,
      targetRect,
      showTooltip,
    },
    nextStep,
    prevStep,
    skipTour,
    finishTour,
    restartTour,
  };
}
