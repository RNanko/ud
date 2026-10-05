"use client";
import { brand } from "@/lib/brand";
import { useEffect, useRef, useState } from "react";
import {
  UserRound,
  SlidersHorizontal,
  ShieldCheck,
  Bell,
  CreditCard,
  LifeBuoy,
  BookOpen,
} from "lucide-react";
import { Field, GymButton } from "./gym/GymUI";
import FinanceSelect from "./finance/FinanceSelect";
import { useAccountPreferences } from "@/app/components/shared/account/AccountPreferencesProvider";
import {
  saveAccountNameResult,
  saveAccountSettingsResult,
} from "@/lib/actions/account.actions";
import { formatAccountTimestamp } from "@/lib/account/format";
import type {
  AccountPreferences,
  NotificationPreferences,
} from "@/lib/account/preferences";
import EmailProofForm from "@/app/components/shared/account/EmailProofForm";
import SecuritySettings from "@/app/components/shared/account/SecuritySettings";
import MembershipSettings from "@/app/components/shared/account/MembershipSettings";
import MembershipAccessSummary from "@/app/components/shared/account/MembershipAccessSummary";
import PrivacySettings from "@/app/components/shared/account/PrivacySettings";
import AppGuide from "@/app/components/shared/account/AppGuide";
import type { membershipStatus } from "@/lib/actions/billing.actions";
import type { LegalBundle } from "@/lib/legal/types";
const sections = [
  { key: "account", name: "Account", icon: UserRound },
  { key: "preferences", name: "Preferences", icon: SlidersHorizontal },
  { key: "security", name: "Security", icon: ShieldCheck },
  { key: "notifications", name: "Notifications", icon: Bell },
  { key: "membership", name: "Membership & billing", icon: CreditCard },
  { key: "privacy", name: "Privacy & Legal", icon: LifeBuoy },
  { key: "guide", name: "App guide", icon: BookOpen },
] as const;
type Section = (typeof sections)[number]["key"];
type Membership = Extract<
  Awaited<ReturnType<typeof membershipStatus>>,
  { ok: true }
>["value"];
function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (string | { value: string; label: string })[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-2 text-sm font-medium">
      <span>{label}</span>
      <FinanceSelect
        icon={SlidersHorizontal}
        label={label}
        title={label}
        value={value}
        options={options.map((option) =>
          typeof option === "string"
            ? { value: option, label: option }
            : option,
        )}
        onValueChange={onChange}
      />
    </div>
  );
}
export default function AccountSettingsClient({
  user,
  initialMembership,
  trialDays,
  stripeAvailable,
  checkoutAvailable,
  version,
  terms,
  privacy,
  retention,
  legalBundle,
}: {
  user: {
    name: string;
    email: string;
    emailVerified: boolean;
    createdAt: string;
  };
  initialMembership: Membership | null;
  trialDays: number;
  stripeAvailable: boolean;
  checkoutAvailable: boolean;
  version: string;
  terms: string | null;
  privacy: string | null;
  retention: string | null;
  legalBundle: LegalBundle | null;
}) {
  const { settings, replace } = useAccountPreferences();
  const [membership, setMembership] = useState(initialMembership);
  const [section, setSection] = useState<Section>("account"),
    [name, setName] = useState(user.name),
    [savedName, setSavedName] = useState(user.name),
    [email, setEmail] = useState(user.email),
    [verified, setVerified] = useState(user.emailVerified),
    [preferences, setPreferences] = useState(settings.preferences),
    [notifications, setNotifications] = useState(settings.notifications),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const submitting = useRef(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("section");
    if (sections.some((item) => item.key === value))
      setSection(value as Section);
    if (new URLSearchParams(window.location.search).has("billing"))
      setSection("membership");
  }, []);
  const dirty =
    name !== savedName ||
    JSON.stringify(preferences) !== JSON.stringify(settings.preferences) ||
    JSON.stringify(notifications) !== JSON.stringify(settings.notifications);
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const navigation = (event: MouseEvent) => {
      const link = (event.target as HTMLElement)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        link &&
        link.target !== "_blank" && !link.hasAttribute("download") && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
        link.href !== window.location.href &&
        !window.confirm("Discard your unsaved account settings?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", protect);
    document.addEventListener("click", navigation, true);
    return () => {
      window.removeEventListener("beforeunload", protect);
      document.removeEventListener("click", navigation, true);
    };
  }, [dirty]);
  function navigate(next: Section) {
    if (busy) return;
    if (dirty && !window.confirm("Discard your unsaved account settings?"))
      return;
    setName(savedName);
    setPreferences(settings.preferences);
    setNotifications(settings.notifications);
    setSection(next);
    setMessage("");
    setError("");
  }
  const patch = <K extends keyof AccountPreferences>(
    key: K,
    value: AccountPreferences[K],
  ) => setPreferences({ ...preferences, [key]: value });
  async function save() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (section === "account") {
        const response = await saveAccountNameResult({ name });
        if (!response.ok) { setError(response.error); return; }
        const result = response.value;
        setSavedName(result.name);
        setName(result.name);
      } else {
        const response = await saveAccountSettingsResult({
          section,
          revision: settings.revision,
          value: section === "preferences" ? preferences : notifications,
        });
        if (!response.ok) { setError(response.error); return; }
        const result = response.value;
        replace(result);
        setPreferences(result.preferences);
        setNotifications(result.notifications);
      }
      setMessage("Saved to your account");
      window.dispatchEvent(new Event("notifications-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed — retry");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  function controls() {
    return (
      <div className="flex flex-wrap gap-3 border-t pt-5">
        <GymButton tone="blue" type="submit" disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save changes"}
        </GymButton>
        <GymButton
          disabled={busy}
          onClick={() => {
            setName(savedName);
            setPreferences(settings.preferences);
            setNotifications(settings.notifications);
            setError("");
            setMessage("");
          }}
        >
          Cancel changes
        </GymButton>
      </div>
    );
  }
  return (
    <section className="gym-scope min-w-0 space-y-6 pb-10">
      <header className="flex flex-wrap items-center gap-4">
        <div
          aria-hidden
          className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary text-2xl font-bold border border-primary/25"
        >
          {savedName
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[.16em] text-primary">
            Your {brand.productName}
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Account & Settings</h1>
          <p className="mt-1 wrap-anywhere text-sm text-muted-foreground">
            {email} ·{" "}
            {verified ? "Verified email" : "Email verification required"}
          </p>
        </div>
      </header>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav
          aria-label="Account settings sections"
          className="account-settings-nav grid grid-cols-2 gap-2 self-start lg:sticky lg:top-5 lg:grid-cols-1"
        >
          {sections.map((item) => (
            <GymButton
              key={item.key}
              className={`justify-start text-left whitespace-normal text-xs sm:text-sm h-auto min-h-11 ${item.key === "guide" ? "col-span-2 lg:col-span-1" : ""}`}
              disabled={busy}
              aria-current={item.key === section ? "page" : undefined}
              onClick={() => navigate(item.key)}
            >
              <item.icon size={18} />
              {item.name}
            </GymButton>
          ))}
        </nav>
        <div className="account-settings-panel min-w-0 space-y-5">
          <h2 id="account-section-title" className="text-xl font-semibold">
            {sections.find((item) => item.key === section)?.name}
          </h2>
          <fieldset disabled={busy} aria-labelledby="account-section-title" className="min-w-0 space-y-5">
          {section === "account" && (
            <>
              <MembershipAccessSummary status={membership} onManage={() => navigate("membership")} />
              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <div className="account-fields-grid">
                  <Field
                    label="Display name"
                    value={name}
                    required
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Login email</dt>
                    <dd className="mt-1 wrap-anywhere">
                      {email} · {verified ? "Verified" : "Not verified"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Account created</dt>
                    <dd className="mt-1">
                      {formatAccountTimestamp(
                        user.createdAt,
                        settings.preferences,
                        false,
                      )}
                    </dd>
                  </div>
                </dl>
                {controls()}
              </form>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
                <div>
                  <h3 className="text-sm font-semibold">Your app at a glance</h3>
                  <p className="mt-1 text-sm text-muted-foreground">A quick guide to every part of ManForth.</p>
                </div>
                <GymButton tone="blue" onClick={() => navigate("guide")}><BookOpen size={18} aria-hidden="true" />Open app guide</GymButton>
              </div>
              {!verified && (
                <div className="border-t pt-5 space-y-3">
                  <h3 className="font-semibold">Verify your current email</h3>
                  <EmailProofForm
                    purpose="verify-account"
                    className="account-half-form space-y-4"
                    initialEmail={email}
                    onVerified={(value) => {
                      setEmail(value);
                      setVerified(true);
                    }}
                  />
                </div>
              )}
            </>
          )}
          {section === "preferences" && (
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <section className="space-y-4">
                <h3 className="font-semibold">Money</h3>
                <div className="account-fields-grid">
                  <Choice
                    label="Default for new expenses & revenue"
                    value={preferences.financeDefaultCurrency}
                    options={["PLN", "EUR", "USD"]}
                    onChange={(value) =>
                      patch(
                        "financeDefaultCurrency",
                        value as AccountPreferences["financeDefaultCurrency"],
                      )
                    }
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Changes apply to new entries without a wallet currency.
                  Existing amounts, currencies and savings goals stay unchanged.
                  No currency conversion is performed.
                </p>
                <p className="rounded-2xl border p-4 text-sm">
                  <strong>Investment currency: USD</strong>
                  <br />
                  <span className="text-muted-foreground">
                    Investments currently support USD only. Billing currency is
                    chosen separately at checkout.
                  </span>
                </p>
              </section>
              <section className="space-y-4 border-t pt-5">
                <h3 className="font-semibold">Gym & body units</h3>
                <div className="account-fields-grid">
                  <Choice
                    label="Exercise load"
                    value={preferences.exerciseLoad}
                    options={["kg", "lb"]}
                    onChange={(value) =>
                      patch("exerciseLoad", value as "kg" | "lb")
                    }
                  />
                  <Choice
                    label="Body weight"
                    value={preferences.bodyWeight}
                    options={["kg", "lb"]}
                    onChange={(value) =>
                      patch("bodyWeight", value as "kg" | "lb")
                    }
                  />
                  <Choice
                    label="Distance"
                    value={preferences.distance}
                    options={[
                      { value: "km", label: "Kilometres (km)" },
                      { value: "mi", label: "Miles (mi)" },
                    ]}
                    onChange={(value) =>
                      patch("distance", value as "km" | "mi")
                    }
                  />
                  <Choice
                    label="Height & body measurements"
                    value={preferences.measurements}
                    options={[
                      { value: "cm", label: "Centimetres (cm)" },
                      { value: "ft-in", label: "Feet & inches" },
                    ]}
                    onChange={(value) =>
                      patch("measurements", value as "cm" | "ft-in")
                    }
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Display and input units only. Historical measurements and
                  their load basis are preserved. No body measurements are
                  invented.
                </p>
              </section>
              <section className="space-y-4 border-t pt-5">
                <h3 className="font-semibold">Calendar & interface</h3>
                <p className="text-sm">
                  Interface language: English · currently available
                </p>
                <div className="account-fields-grid">
                  <Field
                    label="Timezone (IANA name)"
                    required
                    list="account-timezones"
                    value={preferences.timezone}
                    onChange={(e) => patch("timezone", e.target.value)}
                  />
                </div>
                <datalist id="account-timezones">
                  {[
                    "Europe/Warsaw",
                    "Europe/London",
                    "Europe/Berlin",
                    "America/New_York",
                    "America/Los_Angeles",
                    "Asia/Tokyo",
                    "UTC",
                  ].map((zone) => (
                    <option key={zone} value={zone} />
                  ))}
                </datalist>
                <div className="account-fields-grid">
                  <Choice
                    label="Week starts on"
                    value={preferences.weekStart}
                    options={[
                      { value: "monday", label: "Monday" },
                      { value: "sunday", label: "Sunday" },
                    ]}
                    onChange={(value) =>
                      patch("weekStart", value as "monday" | "sunday")
                    }
                  />
                  <Choice
                    label="Clock format"
                    value={preferences.timeFormat}
                    options={[
                      { value: "24", label: "24-hour" },
                      { value: "12", label: "12-hour" },
                    ]}
                    onChange={(value) =>
                      patch("timeFormat", value as "12" | "24")
                    }
                  />
                  <Choice
                    label="Date format"
                    value={preferences.dateFormat}
                    options={[
                      { value: "day-first", label: "DD/MM/YYYY" },
                      { value: "month-first", label: "MM/DD/YYYY" },
                      { value: "iso", label: "YYYY-MM-DD" },
                    ]}
                    onChange={(value) =>
                      patch(
                        "dateFormat",
                        value as AccountPreferences["dateFormat"],
                      )
                    }
                  />
                  <Choice
                    label="Number formatting"
                    value={preferences.numberLocale}
                    options={[
                      { value: "en-GB", label: "1,234.56 · English (UK)" },
                      { value: "en-US", label: "1,234.56 · English (US)" },
                      { value: "pl-PL", label: "1 234,56 · Polish numbers" },
                    ]}
                    onChange={(value) =>
                      patch(
                        "numberLocale",
                        value as AccountPreferences["numberLocale"],
                      )
                    }
                  />
                  <Choice
                    label="Animation preference"
                    value={preferences.reducedMotion}
                    options={[
                      { value: "system", label: "Follow device preference" },
                      { value: "reduce", label: "Reduce motion" },
                    ]}
                    onChange={(value) =>
                      patch("reducedMotion", value as "system" | "reduce")
                    }
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Theme: existing blue/orange accents.
                </p>
              </section>
              {controls()}
            </form>
          )}
          {section === "security" && (
            <SecuritySettings
              onEmailVerified={(value) => {
                setEmail(value);
                setVerified(true);
              }}
            />
          )}
          {section === "notifications" && (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <p className="text-sm text-muted-foreground">
                Messages appear only inside ManForth while you use it. Choose Off,
                10 or 30 minutes before in a timed event or workout. Reminders use
                your timezone and quiet hours; no email, push or closed-browser
                alarm is sent. Authentication and security emails remain independent.
              </p>
              {(
                [
                  { key: "eventReminders", label: "Event / workout reminders" },
                  { key: "workoutCompletion", label: "Workout completion messages" },
                  { key: "goalReminders", label: "Goal reminders / Momentum milestones" },
                  { key: "weeklyReview", label: "Weekly review availability" },
                  { key: "productUpdates", label: "Published product updates" },
                  { key: "quietHours", label: "Use quiet hours" },
                ] as { key: keyof NotificationPreferences; label: string }[]
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-3 rounded-2xl border p-4 text-sm"
                >
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={!!notifications[item.key]}
                    onChange={(e) =>
                      setNotifications({
                        ...notifications,
                        [item.key]: e.target.checked,
                      })
                    }
                  />
                  {item.label}
                </label>
              ))}
              <div className="account-fields-grid">
                <Field
                  label="Quiet hours start"
                  type="time"
                  value={notifications.quietFrom}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      quietFrom: e.target.value,
                    })
                  }
                />
                <Field
                  label="Quiet hours end"
                  type="time"
                  value={notifications.quietTo}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      quietTo: e.target.value,
                    })
                  }
                />
              </div>
              {controls()}
            </form>
          )}
          {section === "membership" && (
            <MembershipSettings
              initial={membership}
              onStatusChange={setMembership}
              trialDays={trialDays}
              stripeAvailable={stripeAvailable}
              checkoutAvailable={checkoutAvailable}
              legalBundle={legalBundle}
            />
          )}
          {section === "privacy" && (
            <PrivacySettings
              version={version}
              terms={terms}
              privacy={privacy}
              retention={retention}
            />
          )}
          {section === "guide" && <AppGuide onOpenSettings={() => navigate("preferences")} />}
          </fieldset>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="gym-error text-sm">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
