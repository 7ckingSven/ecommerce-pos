// ─── Variant Price/Image Resolution ──────────────────────
// Mirrors the admin/staff web dashboard's resolveVariantPricing (staff.js)
// and the same 3-layer override resolution documented there:
//   1. exact variant_overrides combo match
//   2. first option_group (in selection order) whose chosen choice has its
//      own price/image override
//   3. base product.price / product.image_urls[0] (or image_url)
// Overrides only ever affect resale price, never cost/base_price.
//
// A "choice" in option_groups can be either a plain string (legacy data) or
// an object { value, price, image } (current shape) — always unwrap through
// _choiceVal before comparing/rendering it.

export function _choiceVal(c) {
  return (typeof c === 'object' && c !== null) ? c.value : c;
}

export function resolveVariantPricing(product, selectedOptions) {
  const basePrice = Number(product?.price) || 0;
  const baseImage = (product?.image_urls && product.image_urls[0]) || product?.image_url || null;

  if (!selectedOptions || !Object.keys(selectedOptions).length) {
    return { price: basePrice, image: baseImage };
  }

  const overrides = product?.variant_overrides || [];
  const comboMatch = overrides.find(o => o.options
    && Object.keys(o.options).length === Object.keys(selectedOptions).length
    && Object.keys(selectedOptions).every(k => o.options[k] === selectedOptions[k]));
  if (comboMatch) {
    const hasPrice = comboMatch.price !== undefined && comboMatch.price !== null && comboMatch.price !== '';
    return { price: hasPrice ? Number(comboMatch.price) : basePrice, image: comboMatch.image || baseImage };
  }

  const groups = product?.option_groups || [];
  for (const g of groups) {
    const chosenVal = selectedOptions[g.label];
    if (chosenVal == null) continue;
    const choice = (g.choices || []).find(c => _choiceVal(c) === chosenVal);
    if (choice && typeof choice === 'object') {
      const hasPrice = choice.price !== undefined && choice.price !== null && choice.price !== '';
      const hasImage = !!choice.image;
      if (hasPrice || hasImage) {
        return { price: hasPrice ? Number(choice.price) : basePrice, image: choice.image || baseImage };
      }
    }
  }

  return { price: basePrice, image: baseImage };
}

// Applies a product discount (if any) on top of an already-resolved variant
// price — same order of operations as the staff POS's confirmPosVariant:
// resolve the variant price first, apply the discount second. Returns null
// when there's no active discount, so callers can tell "no discount" apart
// from "discounted down to 0".
export function getDiscountedVariantPrice(product, variantPrice) {
  const disc = Array.isArray(product?.discount) ? product.discount[0] : product?.discount;
  if (!disc || !disc.percentage) return null;
  const pct = Number(disc.percentage);
  if (!pct || pct <= 0 || pct > 100) return null;
  return variantPrice * (1 - pct / 100);
}