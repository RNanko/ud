import QouteList from "./QouteList";

const quotes = [
  {
    author: "Marcus Aurelius",
    quote:
      "You have power over your mind — not outside events. Realize this, and you will find strength.",
  },
  {
    author: "Epictetus",
    quote:
      "It's not what happens to you, but how you react to it that matters.",
  },
  {
    author: "Seneca",
    quote: "We suffer more often in imagination than in reality.",
  },
  {
    author: "Marcus Aurelius",
    quote:
      "The happiness of your life depends upon the quality of your thoughts.",
  },
  {
    author: "Epictetus",
    quote:
      "First say to yourself what you would be; and then do what you have to do.",
  },
  {
    author: "Seneca",
    quote: "Luck is what happens when preparation meets opportunity.",
  },
  {
    author: "Marcus Aurelius",
    quote:
      "Waste no more time arguing about what a good man should be. Be one.",
  },
  {
    author: "Epictetus",
    quote: "No man is free who is not master of himself.",
  },
  {
    author: "Seneca",
    quote: "He who fears death will never do anything worthy of a living man.",
  },
  {
    author: "Marcus Aurelius",
    quote:
      "If it is not right, do not do it; if it is not true, do not say it.",
  },
  {
    author: "Epictetus",
    quote: "Don't explain your philosophy. Embody it.",
  },
  {
    author: "Seneca",
    quote: "Difficulties strengthen the mind, as labor does the body.",
  },
  {
    author: "Marcus Aurelius",
    quote:
      "The impediment to action advances action. What stands in the way becomes the way.",
  },
  {
    author: "Epictetus",
    quote:
      "Freedom is the only worthy goal in life. It is won by disregarding things that lie beyond our control.",
  },
  {
    author: "Seneca",
    quote: "As long as you live, keep learning how to live.",
  },
];


export default function Page() {
  return (
    <div>
      <QouteList quotes={quotes} />
    </div>
  );
}
