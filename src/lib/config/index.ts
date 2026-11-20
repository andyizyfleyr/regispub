import "server-only";
// Configuration des services externes (paiement, stockage, e-mails, WhatsApp, API publicitaires).
// Une clé saisie dans l'administration passe avant la variable d'environnement du même nom, qui reste la valeur de secours.
// Les valeurs enregistrées sont chiffrées en base ; elles ne sortent jamais de ce module vers le navigateur.
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { seal, unseal } from "@/lib/vault";
import { buildConfig, checkValue, configIssues, KEYS, keyDef, makeLookup, maskSecret, type KeyDef, type RuntimeConfig } from "./keys";

const log = createLogger("config");

/** Durée pendant laquelle une instance garde les clés en mémoire : une clé modifiée est prise en compte partout dans ce délai. */
const TTL_MS = 10_000;

type Snapshot = { at: number; saved: Map<string, string>; unreadable: Set<string> };
let snapshot: Snapshot | null = null;
let pending: Promise<Snapshot> | null = null;

async function read(): Promise<Snapshot> {
  const rows = await db.appKey.findMany();
  const saved = new Map<string, string>();
  const unreadable = new Set<string>();
  for (const row of rows) {
    if (!keyDef(row.name)) continue;
    const value = unseal(row.value);
    // Valeur illisible (APP_SECRET changé) : on retombe sur la valeur de l'hébergeur, et l'administration demande de la ressaisir.
    if (value === null) unreadable.add(row.name);
    else saved.set(row.name, value);
  }
  return { at: Date.now(), saved, unreadable };
}

async function load(): Promise<Snapshot> {
  if (snapshot && Date.now() - snapshot.at < TTL_MS) return snapshot;
  pending ??= read()
    .then((s) => (snapshot = s))
    .catch((error) => {
      // Base injoignable : on garde les dernières clés connues plutôt que de basculer sur une autre configuration.
      log.error("lecture des clés impossible", { error });
      return (snapshot ??= { at: 0, saved: new Map(), unreadable: new Set() });
    })
    .finally(() => { pending = null; });
  return pending;
}

/** Oublie les clés gardées en mémoire (après un enregistrement, et dans les tests). */
export function resetConfigCache() {
  snapshot = null;
}

/** Configuration en vigueur. À appeler à chaque usage : la lecture est mise en mémoire quelques secondes. */
export async function getConfig(): Promise<RuntimeConfig> {
  const { saved } = await load();
  return buildConfig(makeLookup(saved, process.env));
}

export type KeySource = "admin" | "host" | "none" | "unreadable";

export type KeyView = Pick<KeyDef, "name" | "group" | "label" | "hint" | "placeholder" | "options"> & {
  secret: boolean;
  /** D'où vient la valeur en vigueur. */
  source: KeySource;
  /** Valeur en vigueur d'un champ non confidentiel ; toujours vide pour une clé confidentielle. */
  value: string;
  /** Fin de la clé confidentielle en vigueur (« ••••1a2b »), ou null si elle n'est pas renseignée. */
  masked: string | null;
};

/** Ce que l'administration affiche : jamais une clé confidentielle en clair. */
export async function keysOverview(): Promise<KeyView[]> {
  resetConfigCache();
  const { saved, unreadable } = await load();
  const get = makeLookup(saved, process.env);
  return KEYS.map((def) => {
    const host = process.env[def.name] ?? "";
    const source: KeySource = saved.has(def.name) ? "admin" : unreadable.has(def.name) ? "unreadable" : host !== "" ? "host" : "none";
    const effective = get(def.name);
    return {
      name: def.name, group: def.group, label: def.label, hint: def.hint, placeholder: def.placeholder, options: def.options,
      secret: Boolean(def.secret), source,
      value: def.secret ? "" : effective,
      masked: def.secret && effective ? maskSecret(effective) : null,
    };
  });
}

export type KeysPatch = {
  /** Valeurs saisies. Une clé confidentielle laissée vide n'est pas modifiée. */
  values: Record<string, string>;
  /** Clés confidentielles à effacer de l'administration (la valeur de l'hébergeur, s'il y en a une, reprend la main). */
  clear: string[];
};

const REFUSED = "Rien n'a été enregistré : corrigez les champs signalés en rouge.";

export class KeysError extends DomainError {
  constructor(message: string, readonly fieldErrors: Record<string, string>) { super(message); }
}

/**
 * Enregistre les clés saisies dans l'administration. Renvoie le nom des clés réellement modifiées (jamais leur valeur).
 * Un champ non confidentiel remis à la valeur de l'hébergeur n'est pas stocké : l'hébergeur reste alors la référence.
 */
export async function saveKeys(patch: KeysPatch, actorId: string): Promise<string[]> {
  const current = await read();
  const next = new Map(current.saved);
  const fieldErrors: Record<string, string> = {};
  const touched = new Set<string>();

  for (const name of patch.clear) {
    const def = keyDef(name);
    if (!def?.secret) continue;
    if (next.delete(name) || current.unreadable.has(name)) touched.add(name);
  }
  for (const [name, raw] of Object.entries(patch.values)) {
    const def = keyDef(name);
    if (!def || patch.clear.includes(name)) continue;
    if (def.secret && raw.trim() === "") continue;
    const checked = checkValue(def, raw);
    if (!checked.ok) { fieldErrors[name] = checked.error; continue; }
    const hostValue = (process.env[name] ?? "") === "" ? def.fallback ?? "" : process.env[name]!;
    if (!def.secret && checked.value === hostValue) {
      if (next.delete(name) || current.unreadable.has(name)) touched.add(name);
      continue;
    }
    if (next.get(name) !== checked.value) { next.set(name, checked.value); touched.add(name); }
  }
  if (Object.keys(fieldErrors).length) throw new KeysError(REFUSED, fieldErrors);

  // Cohérence d'ensemble, limitée aux services dont on vient d'envoyer les champs :
  // un défaut déjà présent ailleurs ne doit pas empêcher d'enregistrer celui-ci.
  const groups = new Set([...Object.keys(patch.values), ...patch.clear].map((name) => keyDef(name)?.group));
  const issues = Object.fromEntries(Object.entries(configIssues(buildConfig(makeLookup(next, process.env)))).filter(([name]) => groups.has(keyDef(name)?.group)));
  if (Object.keys(issues).length) throw new KeysError(REFUSED, issues);
  if (!touched.size) return [];

  await db.$transaction(
    [...touched].map((name) =>
      next.has(name)
        ? db.appKey.upsert({ where: { name }, create: { name, value: seal(next.get(name)!), updatedById: actorId }, update: { value: seal(next.get(name)!), updatedById: actorId } })
        : db.appKey.deleteMany({ where: { name } }),
    ),
  );
  resetConfigCache();
  return [...touched].sort();
}
