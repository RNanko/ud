"use client";

import { AnimatePresence, motion } from "motion/react";
import { NumberField } from "../gym/GymUI";
import { TimePicker } from "@/app/components/ui/time-picker";
import { useAccountCalendar } from "@/hooks/use-account-calendar";
import FinanceSelect from "../finance/FinanceSelect";
import { Bell } from "lucide-react";
import {
  clockTime,
  timeMinutes,
  untimed,
  type EventTiming,
} from "@/lib/planner-time";

export default function TimingFields({
  value,
  onChange,
  disabled = false,
}: {
  value: EventTiming;
  onChange: (value: EventTiming) => void;
  disabled?: boolean;
}) {
  const { hour12 } = useAccountCalendar();

  const timed = value.start !== null;

  const end =
    value.start && value.duration !== null
      ? clockTime(timeMinutes(value.start) + value.duration)
      : "";

  return (
    <fieldset
      disabled={disabled}
      className="rounded-2xl border border-primary/20 bg-primary/2.5 px-4"
    >
      <legend className="px-2 text-sm font-medium">
        Optional schedule
      </legend>

      {/* Set a time */}
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="size-5 cursor-pointer accent-(--gym-blue)"
          checked={timed}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? {
                    ...value,
                    start: "18:00",
                  }
                : {
                    ...untimed(),
                    order: value.order,
                  },
            )
          }
        />

        <span>Set a time</span>
      </label>

      <AnimatePresence initial={false}>
        {timed && (
          <motion.div
            initial={{
              opacity: 0,
              height: 0,
              y: -8,
            }}
            animate={{
              opacity: 1,
              height: "auto",
              y: 0,
            }}
            exit={{
              opacity: 0,
              height: 0,
              y: -8,
            }}
            transition={{
              duration: 0.25,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="overflow-hidden"
          >
            <div className="pt-2">
              {/* Time fields */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.05,
                  duration: 0.2,
                }}
                className="grid gap-4 sm:grid-cols-2"
              >
                <TimePicker
                  label="Start time"
                  value={value.start || ""}
                  hour12={hour12}
                  disabled={disabled}
                  onChange={(start) =>
                    onChange({
                      ...value,
                      start,
                    })
                  }
                />

                <TimePicker
                  label="End time (optional)"
                  value={end}
                  hour12={hour12}
                  disabled={disabled}
                  optional
                  defaultValue={clockTime(
                    timeMinutes(value.start!) + 60,
                  )}
                  onChange={(end) =>
                    onChange({
                      ...value,
                      duration:
                        end && value.start
                          ? timeMinutes(end) -
                            timeMinutes(value.start) +
                            (value.overnight ? 1440 : 0)
                          : null,
                    })
                  }
                />

                <NumberField
                  label="Duration (minutes, optional)"
                  min={1}
                  max={1440}
                  step={1}
                  value={value.duration}
                  onChange={(duration) =>
                    onChange({
                      ...value,
                      duration,
                    })
                  }
                />
              </motion.div>

              {/* Overnight */}
              <motion.label
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.1,
                  duration: 0.2,
                }}
                className="flex min-h-11 cursor-pointer items-center gap-3"
              >
                <input
                  type="checkbox"
                  className="size-5 cursor-pointer accent-(--gym-blue)]"
                  checked={value.overnight}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      overnight: event.target.checked,
                      duration: event.target.checked
                        ? Math.min(
                            1440,
                            1440 -
                              timeMinutes(value.start!) +
                              60,
                          )
                        : value.duration === null
                          ? null
                          : Math.min(
                              value.duration,
                              1440 -
                                timeMinutes(value.start!),
                            ),
                    })
                  }
                />

                <span>Ends on the following day</span>
              </motion.label>

              {/* Reminder */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.15,
                  duration: 0.2,
                }}
                className="mb-2 grid gap-2 text-sm"
              >
                <FinanceSelect
                  label="Reminder"
                  title="Reminder"
                  icon={Bell}
                  value={String(
                    value.reminderMinutes ?? "off",
                  )}
                  options={[
                    {
                      value: "off",
                      label: "Off · no reminder",
                    },
                    {
                      value: "10",
                      label: "10 minutes before",
                    },
                    {
                      value: "30",
                      label: "30 minutes before",
                    },
                  ]}
                  onValueChange={(choice) =>
                    onChange({
                      ...value,
                      reminderMinutes:
                        choice === "off"
                          ? null
                          : (Number(choice) as 10 | 30),
                    })
                  }
                />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Untimed message */}
      <AnimatePresence initial={false} mode="wait">
        {!timed && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="text-sm text-muted-foreground"
          >
            Any time · only the date is scheduled.
          </motion.p>
        )}
      </AnimatePresence>
    </fieldset>
  );
}