// Ce test a besoin d'un vrai service compatible S3 (MinIO, s3rver, un bucket R2 de test…). Il est ignoré sinon.
//   STORAGE_DRIVER=s3 S3_ENDPOINT=http://localhost:4568 S3_BUCKET=regispub S3_ACCESS_KEY_ID=… S3_SECRET_ACCESS_KEY=… npx vitest run tests/integration/storage-s3.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { beginDirectUpload, completeDirectUpload, storeAsset } from "@/lib/assets/service";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";

let owner: { id: string; role: "CLIENT" };
beforeAll(async () => {
  if (process.env.STORAGE_DRIVER !== "s3") return;
  const u = await db.user.upsert({ where: { email: "stockage@test.local" }, update: {}, create: { email: "stockage@test.local", name: "Test stockage", passwordHash: "x", referralCode: "TESTS3" } });
  owner = { id: u.id, role: "CLIENT" };
});
afterAll(async () => { await db.$disconnect(); });

const mp4 = (size: number) => { const b = new Uint8Array(size); b.set([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], 0); return b; };

describe.skipIf(process.env.STORAGE_DRIVER !== "s3")("stockage S3", () => {
  it("put / get / delete", async () => {
    const s = await getStorage();
    expect(s.id).toBe("s3");
    await s.put("t/a b-é.txt".replace(/[ é]/g, "_"), new TextEncoder().encode("bonjour"), "text/plain");
    expect(new TextDecoder().decode((await s.get("t/a_b-_.txt"))!)).toBe("bonjour");
    await s.delete("t/a_b-_.txt");
    expect(await s.get("t/a_b-_.txt")).toBeNull();
  });

  it("envoi direct : URL signée, relecture, fiche créée, lecture signée", async () => {
    const bytes = mp4(5 * 1024 * 1024);
    const started = await beginDirectUpload({ owner, mime: "video/mp4", size: bytes.byteLength, name: "Ma vidéo.mp4", source: "UPLOAD" });
    expect(started).not.toBeNull();
    // Avant l'envoi : rien à valider.
    await expect(completeDirectUpload(owner, started!.ticket)).rejects.toThrow(/pas arrivé/);
    const put = await fetch(started!.url, { method: "PUT", body: bytes, headers: { "Content-Type": "video/mp4" } });
    expect(put.status).toBe(200);
    const asset = await completeDirectUpload(owner, started!.ticket);
    expect(asset).toMatchObject({ kind: "VIDEO", mime: "video/mp4", size: bytes.byteLength, name: "Ma vidéo.mp4", ownerId: owner.id });
    // Rejouer « complete » ne crée pas de doublon.
    expect((await completeDirectUpload(owner, started!.ticket)).id).toBe(asset.id);
    const url = await (await getStorage()).direct!.presignGet(asset.storageKey, 300, { contentType: "video/mp4", disposition: "inline; filename*=UTF-8''Ma%20vid%C3%A9o.mp4" });
    const get = await fetch(url, { headers: { Range: "bytes=0-99" } });
    expect(get.status).toBe(206);
    expect(get.headers.get("content-type")).toBe("video/mp4");
    expect(get.headers.get("content-disposition")).toContain("inline");
  });

  it("refuse un ticket falsifié, d'un autre utilisateur, ou un contenu qui ne correspond pas au type annoncé", async () => {
    const started = await beginDirectUpload({ owner, mime: "video/mp4", size: 100, name: "x.mp4", source: "UPLOAD" });
    await expect(completeDirectUpload(owner, started!.ticket.slice(0, -2) + "xx")).rejects.toThrow(/invalide/);
    await expect(completeDirectUpload({ id: "autre", role: "CLIENT" }, started!.ticket)).rejects.toThrow(/expiré/);
    await fetch(started!.url, { method: "PUT", body: new TextEncoder().encode("<html>pas une vidéo</html>"), headers: { "Content-Type": "video/mp4" } });
    await expect(completeDirectUpload(owner, started!.ticket)).rejects.toThrow(/ne correspond pas/);
    // L'objet refusé est supprimé du stockage.
    const key = JSON.parse(Buffer.from(started!.ticket.split(".")[0]!, "base64url").toString()).k as string;
    expect(await (await getStorage()).get(key)).toBeNull();
  });

  it("refuse un objet plus lourd que la limite, même si la taille annoncée était correcte", async () => {
    const started = await beginDirectUpload({ owner, mime: "application/pdf", size: 1000, name: "x.pdf", source: "UPLOAD" });
    const big = new Uint8Array(11 * 1024 * 1024); big.set(new TextEncoder().encode("%PDF-1.7"));
    await fetch(started!.url, { method: "PUT", body: big, headers: { "Content-Type": "application/pdf" } });
    await expect(completeDirectUpload(owner, started!.ticket)).rejects.toThrow(/volumineux/);
  });

  it("refuse dès le départ un type ou une taille hors règles, et garde le chemin classique", async () => {
    await expect(beginDirectUpload({ owner, mime: "application/x-msdownload", size: 10, name: "x.exe", source: "UPLOAD" })).rejects.toThrow(/non accepté/);
    await expect(beginDirectUpload({ owner, mime: "video/mp4", size: 70 * 1024 * 1024, name: "x.mp4", source: "UPLOAD" })).rejects.toThrow(/volumineux/);
    const png = new Uint8Array(64); png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 4, 56, 0, 0, 4, 56]);
    const a = await storeAsset({ bytes: png, mime: "image/png", name: "a.png", owner });
    expect(a).toMatchObject({ width: 1080, height: 1080 });
    expect((await (await getStorage()).get(a.storageKey))!.byteLength).toBe(64);
  });
});
