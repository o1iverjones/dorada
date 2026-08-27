import type { FastifyInstance } from "fastify";
import { getSignedUrl } from "../../integrations/r2.js";

const DOWNLOAD_KEYS: Record<string, string> = {
  "dorada-beta.apk": "downloads/dorada-beta.apk",
  "dorada-beta.ipa": "downloads/dorada-beta.ipa",
};

export default async function downloadRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { file: string } }>("/:file", async (request, reply) => {
    const key = DOWNLOAD_KEYS[request.params.file];
    if (!key) return reply.code(404).send({ error: "File not found" });

    const url = await getSignedUrl(key, 3600);
    return reply.redirect(302, url);
  });
}
