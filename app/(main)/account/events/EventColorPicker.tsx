"use client";

import { useId } from "react";
import { eventTones, type EventTone } from "@/lib/events";

export default function EventColorPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: EventTone;
  onChange: (color: EventTone) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-2 text-sm font-medium">Event color</legend>
      <div className="grid grid-cols-5 gap-2">
        {eventTones.map((tone) => (
          <label
            key={tone}
            className="event-color-option"
            data-event-tone={tone}
            data-selected={tone === value}
          >
            <input
              className="sr-only"
              type="radio"
              aria-label={`${tone[0].toUpperCase()}${tone.slice(1)} event color`}
              name={name}
              value={tone}
              checked={tone === value}
              onChange={() => onChange(tone)}
            />
            <span className="event-color-swatch" aria-hidden="true"></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
