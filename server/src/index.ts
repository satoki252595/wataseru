import { serve } from "@hono/node-server";
import { env } from "./env";
import { createAppFromPath } from "./app";

const app = createAppFromPath();

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`ワタセル http://127.0.0.1:${info.port}`);
});
