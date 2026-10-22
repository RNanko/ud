import { createRoot } from "react-dom/client";
import { useState } from "react";
import FinancePlayground from "../../app/(main)/account/finance/FinancePlayground";
import AccountPreferencesProvider from "../../app/components/shared/account/AccountPreferencesProvider";
import { defaultNotifications, defaultPreferences } from "../../lib/account/preferences";
import { categoryKey, type FinanceCategory } from "../../lib/finance-playground";

function App() {
  const [categories, setCategories] = useState<FinanceCategory[]>([
    { name: "Salary", type: "+", icon: "revenue:document_payment" },
    ...["Study", "Transport", "Food", "Investment", "Services", "Payments", "Clothes", "Eat", "Smoke", "Out"].map(name => ({ name, type: "-" as const })),
  ]);
  return <AccountPreferencesProvider initial={{ preferences: { ...defaultPreferences, financeDefaultCurrency: "PLN" }, notifications: defaultNotifications, revision: 0 }}>
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="mb-2 text-3xl font-semibold">Finance</h1>
      <p className="mb-6 text-sm text-muted-foreground">Local sample-data preview. Category saves are simulated; no account records are changed.</p>
      <FinancePlayground userId="finance-layout-fixture" entries={[]} categories={categories} busy={false}
        onAdd={() => {}} onSave={async () => {}}
        onCreateCategory={async category => { setCategories(current => [...current, category]); return 1; }}
        onRemoveCategory={async category => { await new Promise(resolve => setTimeout(resolve, 1500)); setCategories(current => current.filter(item => categoryKey(item) !== categoryKey(category))); }}
        onReorderCategory={() => {}} />
    </main>
  </AccountPreferencesProvider>;
}

createRoot(document.getElementById("root")!).render(<App />);
