import type { EditableStripe } from "./stripeAdapter";

export function reverseStripeColors(stripes: readonly EditableStripe[]): EditableStripe[] {
  const reversedColors = stripes.map((stripe) => stripe.hex).reverse();
  return stripes.map((stripe, index) => ({ ...stripe, hex: reversedColors[index] ?? stripe.hex }));
}
