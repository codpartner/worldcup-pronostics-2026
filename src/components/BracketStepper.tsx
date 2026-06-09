"use client";

type BracketStep = "groups" | "knockout";

interface BracketStepperProps {
  step: BracketStep;
  onStepChange: (step: BracketStep) => void;
  knockoutEnabled: boolean;
}

const STEPS: { id: BracketStep; label: string; number: number }[] = [
  { id: "groups", label: "Groups", number: 1 },
  { id: "knockout", label: "Bracket", number: 2 },
];

export function BracketStepper({
  step,
  onStepChange,
  knockoutEnabled,
}: BracketStepperProps) {
  return (
    <nav className="bracket-stepper" aria-label="Bracket progress">
      {STEPS.map((item) => {
        const active = step === item.id;
        const completed =
          item.id === "groups" && knockoutEnabled && step === "knockout";
        const disabled = item.id === "knockout" && !knockoutEnabled;

        return (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onStepChange(item.id)}
            className={`bracket-step ${active ? "bracket-step-active" : ""} ${completed ? "bracket-step-complete" : ""}`}
          >
            <span className="bracket-step-number">
              {completed ? "✓" : item.number}
            </span>
            <span className="bracket-step-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
