// Garde-fous publicitaires : repère dans un texte les formulations refusées par Meta et TikTok. Module pur.
const POLICY_RULES: { pattern: RegExp; message: string }[] = [
  { pattern: /\bgaranti(e|s|es)?\b|\b100\s?%/i, message: "Évitez les promesses de résultat garanti : les plateformes les refusent et nous ne pouvons pas les tenir." },
  { pattern: /\b(perd(re|ez)|maigri(r|ssez))\b.{0,30}\b\d+\s?(kg|kilos)/i, message: "Les promesses chiffrées de perte de poids sont interdites." },
  { pattern: /avant\s*\/?\s*apr[eè]s/i, message: "Les comparaisons « avant / après » sont refusées pour la santé, la beauté et la minceur." },
  { pattern: /\b(gagne[zr]?|devene[zr]?\s+riche|revenus?)\b.{0,40}\b(facile(ment)?|rapide(ment)?|sans effort)/i, message: "Les promesses de gains faciles ou rapides sont interdites." },
  { pattern: /\b(guéri[tr]?|soigne|traite)\b.{0,40}\b(diabète|cancer|sida|vih|hypertension|stérilité)/i, message: "Les allégations de guérison de maladies sont interdites." },
  { pattern: /\b(êtes-vous|tu es|vous êtes|souffrez-vous)\b.{0,40}\b(gros|grosse|obèse|malade|endetté|pauvre|célibataire|diabétique|stérile)/i, message: "N'évoquez pas directement une caractéristique personnelle du lecteur (santé, finances, situation)." },
  { pattern: /\b(abonnés|followers|vues|likes)\b.{0,20}\b(garantis?|assurés?)|\b\d+\s?(k|000)?\s?(abonnés|followers|vues)\s+(en|sous)\s+\d+/i, message: "Ne promettez pas un nombre d'abonnés ou de vues." },
];

export function policyWarnings(text: string): string[] {
  return Array.from(new Set(POLICY_RULES.filter((r) => r.pattern.test(text)).map((r) => r.message)));
}
