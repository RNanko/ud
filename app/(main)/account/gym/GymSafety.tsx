import { ShieldCheck } from "lucide-react";
export default function GymSafety({compact = false}: {compact?: boolean}) {
  return <aside className="gym-blue rounded-2xl border p-4 text-sm" aria-label="Training guidance">
    <div className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 shrink-0" /><div>
      <p className="font-semibold">Your routine. A trainer’s guidance.</p>
      <p className="mt-1 text-muted-foreground">Choose your own exercises and training targets. Consult a qualified trainer for technique, equipment setup and personal working weights. Consult a clinician or physiotherapist for injury, pain, health conditions or specialist needs. Stop an exercise that causes pain.</p>
      {!compact && <details className="mt-3"><summary className="cursor-pointer font-medium">About exercise illustrations and tracking</summary><div className="mt-2 space-y-2 text-muted-foreground">
        <p>Icons identify movements; they cannot teach technique or establish suitability. The app records the targets and results you enter.</p>
        <p>Reserve means your estimate of how many more controlled repetitions you could perform. “Not sure” is valid. You do not need to test failure. Timed holds use a controlled position and ordinary breathing.</p>
      </div></details>}
    </div></div>
  </aside>;
}
