// Suggestions guidées : modèles rédigés par notre équipe marketing et adaptés aux informations du client.
// Ce n'est PAS de l'intelligence artificielle ; l'interface l'indique clairement lorsque ce moteur est utilisé.
import { getObjective } from "@/lib/catalog/objectives";
import { AD_FORMATS } from "@/lib/catalog/platforms";
import { INTEREST_GROUPS } from "@/lib/catalog/targeting";
import { formatFcfa } from "@/lib/utils";
import type { BusinessContext, CalendarPlan, Captions, Diagnostic, Hashtags, Ideas, Strategy, TargetingAdvice } from "./schemas";

const SECTOR_PROFILES: { match: RegExp; interests: string[]; categories: string[]; gender: "ALL" | "FEMALE" | "MALE"; ages: [number, number]; proof: string }[] = [
  { match: /mode|habillement|pagne|couture/i, interests: ["Mode", "Vêtements pour femmes", "Pagne et tissus", "Chaussures", "Mariage"], categories: ["Jeunes actifs", "Étudiants", "Futurs mariés"], gender: "ALL", ages: [18, 45], proof: "des photos portées par de vraies clientes" },
  { match: /beaut|cosm|coiff|perruque/i, interests: ["Cosmétiques", "Coiffure", "Perruques et mèches", "Mode", "Santé et bien-être"], categories: ["Jeunes actifs", "Étudiants"], gender: "FEMALE", ages: [18, 45], proof: "le résultat filmé en lumière naturelle" },
  { match: /restau|aliment|pâtiss|traiteur|cuisine/i, interests: ["Restauration", "Fast-food", "Livraison de repas", "Cuisine", "Pâtisserie"], categories: ["Jeunes actifs", "Étudiants", "Parents"], gender: "ALL", ages: [18, 45], proof: "le plat filmé au moment du service" },
  { match: /télé|électro|informatique|phone/i, interests: ["Smartphones", "Informatique", "Accessoires téléphone", "Jeux vidéo"], categories: ["Jeunes actifs", "Étudiants", "Commerçants et revendeurs"], gender: "ALL", ages: [18, 45], proof: "le déballage et la garantie remise au client" },
  { match: /immobili/i, interests: ["Immobilier", "Ameublement", "Finance personnelle", "Décoration"], categories: ["Diaspora", "Fonctionnaires", "Entrepreneurs et dirigeants"], gender: "ALL", ages: [25, 55], proof: "une visite filmée et les documents du terrain" },
  { match: /formation|éducation|école/i, interests: ["Formation professionnelle", "Études supérieures", "Entrepreneuriat", "Marketing digital"], categories: ["Étudiants", "Jeunes actifs", "Parents"], gender: "ALL", ages: [18, 35], proof: "le témoignage d'un ancien apprenant" },
  { match: /santé|bien-être|pharma|sport/i, interests: ["Santé et bien-être", "Sport et fitness", "Produits bio"], categories: ["Particuliers", "Parents"], gender: "ALL", ages: [25, 55], proof: "l'avis d'un professionnel et la composition du produit" },
  { match: /événement|mariage|décor/i, interests: ["Événementiel", "Mariage", "Musique", "Décoration"], categories: ["Futurs mariés", "Professionnels et entreprises"], gender: "ALL", ages: [25, 45], proof: "des images d'un événement déjà réalisé" },
  { match: /entreprise|b2b|service|finance|assurance/i, interests: ["Petites entreprises", "Entrepreneuriat", "Finance personnelle", "Marketing digital"], categories: ["Entrepreneurs et dirigeants", "Professionnels et entreprises", "Commerçants et revendeurs"], gender: "ALL", ages: [25, 55], proof: "un cas client chiffré avec son accord" },
  { match: /agri|agro/i, interests: ["Agriculture", "Produits bio", "Petites entreprises", "Cuisine"], categories: ["Commerçants et revendeurs", "Particuliers"], gender: "ALL", ages: [25, 55], proof: "l'origine et la fraîcheur montrées en vidéo" },
  { match: /auto|moto|transport|logisti/i, interests: ["Automobile", "Moto", "Transport et livraison"], categories: ["Jeunes actifs", "Commerçants et revendeurs"], gender: "MALE", ages: [25, 55], proof: "une démonstration du véhicule ou du service" },
];
const DEFAULT_PROFILE = { interests: ["Petites entreprises", "Entrepreneuriat", "Mode", "Restauration"], categories: ["Particuliers", "Jeunes actifs"], gender: "ALL" as const, ages: [18, 45] as [number, number], proof: "des images réelles de votre activité" };
const KNOWN_INTERESTS = new Set(INTEREST_GROUPS.flatMap((g) => g.items));

function profileFor(ctx: BusinessContext) {
  const p = SECTOR_PROFILES.find((s) => s.match.test(`${ctx.sector} ${ctx.description ?? ""}`)) ?? DEFAULT_PROFILE;
  return { ...p, interests: p.interests.filter((i) => KNOWN_INTERESTS.has(i)) };
}

const offerOf = (ctx: BusinessContext) => ctx.productName?.trim() || ctx.businessName;
const placeOf = (ctx: BusinessContext) => ctx.city?.trim() || "votre ville";
const priceOf = (ctx: BusinessContext) => (ctx.productPrice ? formatFcfa(ctx.productPrice) : null);
const firstSentence = (text?: string) => (text ?? "").split(/(?<=[.!?])\s/)[0]?.trim() ?? "";

export function rulesStrategy(ctx: BusinessContext): Strategy {
  const objective = getObjective(ctx.objectiveCode);
  const profile = profileFor(ctx);
  const offer = offerOf(ctx), place = placeOf(ctx), price = priceOf(ctx);
  const pitch = firstSentence(ctx.productDescription) || `${offer}, proposé par ${ctx.businessName}`;
  const cta = objective?.config.ctas[0] ?? "En savoir plus";
  const priceLine = price ? ` À partir de ${price}.` : "";
  const contact = cta.includes("WhatsApp") ? "Écrivez-nous sur WhatsApp, nous répondons rapidement." : `Cliquez sur « ${cta} ».`;

  const variants: Strategy["variants"] = [
    {
      name: "Bénéfice direct", angle: "Dire en une phrase ce que le client y gagne, sans détour.", audience: `${profile.categories[0] ?? "Particuliers"} à ${place}`,
      headline: `${offer} à ${place}`.slice(0, 90),
      body: `${pitch}${pitch.endsWith(".") ? "" : "."}${priceLine}\n\nDisponible à ${place}. ${contact}`, cta,
    },
    {
      name: "Preuve et confiance", angle: `Rassurer avant de vendre : montrer ${profile.proof}.`, audience: `Personnes qui comparent avant d'acheter, ${profile.ages[0]}–${profile.ages[1]} ans`,
      headline: `Pourquoi nos clients choisissent ${ctx.businessName}`.slice(0, 90),
      body: `Chez ${ctx.businessName}, vous voyez ce que vous achetez : ${profile.proof}.\n\n${pitch}${pitch.endsWith(".") ? "" : "."}${priceLine}\n\n${contact}`, cta,
    },
    {
      name: "Offre limitée", angle: "Donner une raison d'agir maintenant (stock, date, places) — uniquement si elle est réelle.", audience: `Personnes ayant déjà interagi avec votre page, à ${place}`,
      headline: `${offer} : offre valable cette semaine`.slice(0, 90),
      body: `Cette semaine seulement chez ${ctx.businessName} : ${offer}.${priceLine}\n\nQuantité limitée, premiers arrivés, premiers servis. ${contact}`, cta,
    },
  ];

  return {
    analysis: `Proposition construite à partir de vos informations : ${ctx.businessName} (${ctx.sector || "secteur non précisé"}) souhaite ${objective ? objective.label.toLowerCase() : "communiquer"} à ${place}. ${objective?.recommendation ?? ""} Ces suggestions sont des modèles à adapter : relisez-les et corrigez tout ce qui ne correspond pas exactement à votre offre.`,
    sellingPoints: [
      pitch,
      price ? `Prix annoncé clairement : ${price}` : "Annoncez votre prix ou une fourchette : cela filtre les demandes peu sérieuses",
      `Proximité : présent à ${place}, joignable sur WhatsApp`,
      `Confiance : ${profile.proof}`,
    ],
    audiences: [
      { name: "Cœur de cible", description: `${profile.categories.join(", ")} de ${profile.ages[0]} à ${profile.ages[1]} ans, à ${place} et environs.`, interests: profile.interests.slice(0, 4) },
      { name: "Audience élargie", description: `Même zone, tranche d'âge élargie, pour laisser l'algorithme trouver de nouveaux profils une fois les premiers résultats obtenus.`, interests: profile.interests.slice(0, 2) },
      { name: "Proches de votre page", description: "Personnes ayant déjà aimé, commenté ou écrit à votre page. Disponible lorsque votre page a un historique suffisant.", interests: [] },
    ],
    hooks: [
      `${offer} à ${place} : voici ce qu'il faut savoir.`,
      price ? `${offer} à ${price}. Oui, vraiment.` : `Vous cherchez ${offer} ? Regardez ceci.`,
      `Ce que nos clients de ${place} préfèrent chez ${ctx.businessName}.`,
      "Avant de commander ailleurs, comparez.",
    ],
    texts: variants.map((v) => ({ headline: v.headline, body: v.body, cta: v.cta })),
    ctas: objective?.config.ctas.length ? objective.config.ctas : ["En savoir plus", "Envoyer un message WhatsApp"],
    videoIdeas: [
      { title: "Le produit en action (15 s)", script: `0–3 s : gros plan sur ${offer}, texte à l'écran « ${offer} à ${place} ».\n3–10 s : montrez l'utilisation ou le résultat, sans coupure.\n10–15 s : ${price ? `prix (${price}) et ` : ""}moyen de contact à l'écran.` },
      { title: "Question fréquente", script: `Face caméra : « On nous demande souvent… » puis répondez en 20 secondes à la question que vos clients posent le plus. Terminez par : « ${contact} »` },
      { title: "Dans les coulisses", script: `Filmez la préparation, l'emballage ou l'atelier de ${ctx.businessName}. Montrer le travail réel rassure plus qu'un discours.` },
    ],
    visualConcepts: [
      { title: "Produit plein cadre", description: `Photo nette de ${offer} sur fond uni, nom du produit en grand${price ? `, prix ${price} dans une pastille` : ""}. Une seule idée par visuel.` },
      { title: "En situation", description: `${offer} utilisé par une personne, en lumière naturelle. Ajoutez une phrase courte : le bénéfice principal.` },
      { title: "Bandeau d'offre", description: "Fond de votre couleur, titre de l'offre, date de fin et bouton de contact. Idéal pour une promotion réelle et datée." },
    ],
    formats: (objective?.config.formats ?? ["square", "story"]).map((id) => {
      const f = AD_FORMATS.find((x) => x.id === id)!;
      return { format: `${f.label} (${f.ratio})`, reason: f.usage };
    }),
    variants,
  };
}

export function rulesTargeting(ctx: BusinessContext): TargetingAdvice {
  const p = profileFor(ctx);
  return {
    cities: ctx.city ? [ctx.city] : [],
    ageMin: p.ages[0], ageMax: p.ages[1], gender: p.gender, interests: p.interests.slice(0, 5), categories: p.categories.slice(0, 3),
    rationale: `Réglage de départ pour le secteur « ${ctx.sector || "général"} » : zone resserrée autour de ${placeOf(ctx)}, ${p.ages[0]}–${p.ages[1]} ans. Gardez une audience assez large (quelques centres d'intérêt seulement) : un ciblage trop étroit augmente le coût de diffusion. Votre gestionnaire l'ajustera après les premiers jours.`,
  };
}

const yes = (v?: string) => v === "oui";

export function rulesDiagnostic(ctx: BusinessContext): Diagnostic {
  const x = ctx.extra ?? {};
  const strengths: string[] = [], weaknesses: string[] = [], priorities: Diagnostic["priorities"] = [];
  const check = (ok: boolean, good: string, bad: string, fix?: { title: string; action: string }) => {
    if (ok) strengths.push(good); else { weaknesses.push(bad); if (fix) priorities.push(fix); }
  };
  check(yes(x.hasFacebook) || yes(x.hasInstagram) || yes(x.hasTiktok), "Vous êtes présent sur au moins un réseau social.", "Aucune page active sur les réseaux sociaux.", { title: "Créer une page professionnelle", action: "Ouvrez une page Facebook et un compte Instagram professionnels au nom de l'entreprise : c'est indispensable pour diffuser de la publicité." });
  check(yes(x.hasWhatsappBusiness), "WhatsApp Business est en place pour répondre aux clients.", "Pas de WhatsApp Business : les demandes risquent de se perdre.", { title: "Passer à WhatsApp Business", action: "Installez WhatsApp Business, ajoutez un catalogue, vos horaires et un message d'accueil automatique." });
  check(Number(x.postsPerWeek ?? 0) >= 2, "Vous publiez régulièrement.", "Moins de deux publications par semaine : la page paraît inactive.", { title: "Publier 3 fois par semaine", action: "Utilisez le calendrier éditorial pour planifier un mois de publications : produit, preuve client, coulisses." });
  check(yes(x.hasLogo), "Votre identité visuelle (logo, couleurs) existe.", "Pas d'identité visuelle stable.", { title: "Fixer un logo et deux couleurs", action: "Choisissez un logo simple et deux couleurs, puis réutilisez-les sur tous vos visuels dans le studio créatif." });
  check(yes(x.hasPhotos), "Vous disposez de photos ou vidéos de vos produits.", "Peu de photos ou vidéos réelles de vos produits.", { title: "Constituer une banque d'images", action: "Photographiez vos 5 meilleurs produits en lumière naturelle, sur fond uni, au format vertical." });
  check(yes(x.showsPrices), "Vos prix sont affichés.", "Prix non affichés : beaucoup de messages « c'est combien ? » sans suite.", { title: "Afficher les prix", action: "Indiquez le prix ou une fourchette sur vos visuels et dans votre catalogue WhatsApp." });
  check(yes(x.repliesFast), "Vous répondez rapidement aux messages.", "Délais de réponse longs aux messages.", { title: "Répondre en moins de 15 minutes", action: "Désignez une personne responsable des messages pendant les campagnes et préparez des réponses types." });
  const advertised = yes(x.alreadyAdvertised);
  return {
    summary: `Diagnostic établi à partir de vos réponses pour ${ctx.businessName} : ${strengths.length} point${strengths.length > 1 ? "s" : ""} acquis, ${weaknesses.length} à travailler. ${weaknesses.length <= 2 ? "Vos bases sont solides : la publicité peut amplifier ce qui fonctionne déjà." : "Corrigez d'abord les priorités ci-dessous : la publicité amène du monde, mais ce sont vos pages et vos réponses qui transforment les visiteurs en clients."}`,
    strengths, weaknesses, priorities: priorities.slice(0, 5),
    campaignSuggestions: [
      weaknesses.length > 3
        ? { objective: "Faire connaître une page ou une marque", why: "Commencez par une petite campagne de visibilité locale pendant que vous consolidez vos pages." }
        : { objective: "Obtenir des commandes WhatsApp", why: "Vos bases sont en place : dirigez directement les personnes intéressées vers une conversation." },
      advertised
        ? { objective: "Augmenter les ventes", why: "Vous avez déjà testé la publicité : structurez maintenant une campagne orientée commandes, avec plusieurs variantes de visuels." }
        : { objective: "Augmenter l'engagement", why: "Pour une première campagne, l'engagement permet d'apprendre à faible coût quels messages intéressent votre audience." },
    ],
  };
}

const ROTATION: { title: (o: string, b: string) => string; caption: (ctx: BusinessContext) => string }[] = [
  { title: (o) => `Présentation : ${o}`, caption: (c) => `${firstSentence(c.productDescription) || `Découvrez ${offerOf(c)}`}${priceOf(c) ? ` — ${priceOf(c)}` : ""}. Disponible à ${placeOf(c)}. Écrivez-nous pour commander.` },
  { title: () => "Avis d'un client", caption: (c) => `Merci à nos clients de ${placeOf(c)} pour leur confiance. (Publiez ici un vrai message reçu, avec l'accord de son auteur.)` },
  { title: (_o, b) => `Les coulisses de ${b}`, caption: (c) => `Voici comment nous préparons vos commandes chez ${c.businessName}. Du sérieux à chaque étape.` },
  { title: () => "Conseil pratique", caption: (c) => `Un conseil de ${c.businessName} : (partagez une astuce utile liée à ${c.sector.toLowerCase() || "votre métier"}). Enregistrez cette publication pour la retrouver.` },
  { title: () => "Question à la communauté", caption: (c) => `On a besoin de votre avis : que préférez-vous chez ${c.businessName} ? Répondez en commentaire.` },
  { title: (o) => `Offre de la semaine : ${o}`, caption: (c) => `Cette semaine chez ${c.businessName} : ${offerOf(c)}${priceOf(c) ? ` à ${priceOf(c)}` : ""}. Offre valable jusqu'à dimanche, dans la limite des stocks.` },
];

function slug(v: string) {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, " ").trim().split(" ").filter((w) => w.length > 2).slice(0, 3)
    .map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join("");
}

export function rulesHashtags(ctx: BusinessContext, topic = ""): Hashtags {
  const tags = new Set<string>();
  const add = (v?: string) => { const sl = v ? slug(v) : ""; if (sl.length > 2) tags.add(`#${sl}`); };
  add(ctx.businessName); add(topic); add(ctx.productName); add(ctx.city); add(ctx.sector.split(/ et |,/)[0]);
  if (ctx.city) add(`${ctx.sector.split(/ et |,/)[0]} ${ctx.city}`);
  const country = ctx.country === "BJ" || !ctx.country ? ["#Benin", "#Benin229", "#TeamBenin", "#MadeInBenin"] : ["#AfriqueDeLOuest"];
  country.forEach((t) => tags.add(t));
  for (const i of profileFor(ctx).interests.slice(0, 4)) add(i);
  ["#PME", "#EntreprendreEnAfrique", "#LivraisonRapide"].forEach((t) => tags.add(t));
  return { hashtags: Array.from(tags).slice(0, 18), note: "Utilisez 5 à 8 hashtags par publication : 2 liés à votre marque, 3 à votre produit, 2 à votre ville. Au-delà, la portée n'augmente pas." };
}

export function rulesCalendar(ctx: BusinessContext, days = 28, perWeek = 3): CalendarPlan {
  const platforms = (ctx.platforms?.length ? ctx.platforms : ["FACEBOOK", "INSTAGRAM"]) as ("FACEBOOK" | "INSTAGRAM" | "TIKTOK")[];
  const tags = rulesHashtags(ctx).hashtags.slice(0, 6);
  const slots = perWeek >= 5 ? [0, 1, 2, 3, 4] : perWeek === 4 ? [0, 1, 3, 5] : perWeek === 2 ? [1, 4] : [0, 2, 4];
  const entries: CalendarPlan["entries"] = [];
  let n = 0;
  for (let week = 0; week * 7 < days; week++) {
    for (const s of slots) {
      const dayOffset = week * 7 + s;
      if (dayOffset >= days) continue;
      const item = ROTATION[n % ROTATION.length]!;
      entries.push({ dayOffset, platform: platforms[n % platforms.length]!, title: item.title(offerOf(ctx), ctx.businessName), caption: item.caption(ctx), hashtags: tags });
      n++;
    }
  }
  return { entries };
}

export function rulesIdeas(ctx: BusinessContext): Ideas {
  const o = offerOf(ctx);
  return {
    ideas: [
      { title: `${o} en 15 secondes`, format: "Vidéo verticale", description: "Montrez le produit en action, sans introduction. Texte à l'écran pour ceux qui regardent sans le son." },
      { title: "Le message d'un client", format: "Capture ou photo", description: "Publiez un vrai retour client avec son accord. C'est la preuve la plus convaincante." },
      { title: "Comment commander", format: "Carrousel", description: "3 images : choisir, payer (Mobile Money, à la livraison…), recevoir. Levez les doutes sur le processus." },
      { title: "Les coulisses", format: "Story", description: `Préparation, emballage, arrivage : montrez le quotidien de ${ctx.businessName}.` },
      { title: "La question de la semaine", format: "Publication texte + image", description: "Posez une question simple à votre communauté pour déclencher des commentaires." },
      { title: "Idée reçue", format: "Vidéo face caméra", description: `« On pense souvent que… » : corrigez une idée fausse sur ${ctx.sector.toLowerCase() || "votre métier"}.` },
      { title: "Nouveauté ou arrivage", format: "Photo produit", description: "Annoncez ce qui vient d'arriver, avec le prix et la quantité disponible." },
      { title: "Où nous trouver", format: "Vidéo courte", description: `Filmez le trajet depuis un repère connu de ${placeOf(ctx)} jusqu'à votre point de vente.` },
    ],
  };
}

export function rulesCaptions(ctx: BusinessContext, topic: string, tone: string): Captions {
  const o = topic.trim() || offerOf(ctx), p = priceOf(ctx), place = placeOf(ctx);
  const warm = tone === "chaleureux";
  return {
    captions: [
      `${o}${p ? ` — ${p}` : ""}\n\nDisponible chez ${ctx.businessName}, à ${place}. ${warm ? "On vous attend avec le sourire !" : "Commandez par message."}`,
      `Vous cherchez ${o} à ${place} ?\n\n${firstSentence(ctx.productDescription) || `${ctx.businessName} s'en occupe.`}\n\nÉcrivez-nous sur WhatsApp pour commander.`,
      `${warm ? "Petite nouvelle du jour" : "Nouveau"} chez ${ctx.businessName} : ${o}.${p ? ` Prix : ${p}.` : ""}\n\nLivraison possible à ${place} et environs.`,
      `Pourquoi choisir ${ctx.businessName} ?\n• Qualité vérifiée\n• Réponse rapide\n• Livraison à ${place}\n\n${o} disponible dès maintenant.`,
    ],
  };
}
