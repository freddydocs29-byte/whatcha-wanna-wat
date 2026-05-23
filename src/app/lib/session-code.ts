const WORDS = [
  "EATS", "TACO", "BOWL", "BITE", "CHEF", "FORK", "MEAL", "DISH",
  "NOSH", "GRUB", "FEAST", "PICK", "DINE", "FOOD", "COOK", "RICE",
  "SPUD", "STEW", "SOUP", "GRILL", "BAKE", "CHOP", "MISO", "RAMEN",
];

export function generateSessionCode(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = String(Math.floor(Math.random() * 90) + 10);
  return `${word}-${num}`;
}
