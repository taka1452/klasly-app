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
  skipTour: () => void;
  finishTour: () => Promise<void>;
  restartTour: () => void;
};

function findElement(target: string): Element | null {
  return document.querySelector(`[data-tour="${target}"]`);
}

export function useTour(
  role: string,
  isEnabled: boolean,
  userId: string | undefined,
  persistOnFinish = true
): UseTourReturn {
  const steps = getStepsForRole(role);
  const [currentStep, setCurrentStep] = useState(0);
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
    if (!isEnabled || role !== "owner" && role !== "instructor" || steps.length === 0) {
      return;
    }
    setIsActive(true);
    setCurrentStep(0);
  }, [isEnabled, role, steps.length]);

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
    if (persistOnFinish && userId) {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", userId);
    }
    setIsActive(false);
    setCurrentStep(0);
    setTargetRect(null);
    setShowTooltip(false);
  }, [userId, persistOnFinish]);

  const nextStep = useCallback(() => {
    if (currentStep >= steps.length - 1) {
      void finishTour();
      return;
    }
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  }, [currentStep, steps.length, finishTour]);

  const prevStep = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const skipTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    setTargetRect(null);
    setShowTooltip(false);
  }, []);

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
