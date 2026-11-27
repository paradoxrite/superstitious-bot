import crypto from "node:crypto";
import http from "node:http";
import { OAuthDatabase } from "../structure/OAuthDatabase";

interface OAuthServerOptions {
  port: number;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  db: OAuthDatabase;
}

interface DiscordTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
  scope: string;
}

interface DiscordUserResponse {
  id: string;
  username: string;
  global_name: string | null;
}

export function startOAuthServer(options: OAuthServerOptions): http.Server {
  const { port, clientId, clientSecret, redirectUri, db } = options;
  const pendingStates = new Map<string, number>();

  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? "/", `http://localhost:${port}`);

      if (requestUrl.pathname === "/auth/discord/login") {
        const state = crypto.randomBytes(24).toString("hex");
        pendingStates.set(state, Date.now() + 10 * 60 * 1000);

        const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
        authorizeUrl.searchParams.set("client_id", clientId);
        authorizeUrl.searchParams.set("redirect_uri", redirectUri);
        authorizeUrl.searchParams.set("response_type", "code");
        authorizeUrl.searchParams.set("scope", "identify");
        authorizeUrl.searchParams.set("state", state);

        res.writeHead(302, { Location: authorizeUrl.toString() });
        res.end();
        return;
      }

      if (requestUrl.pathname === "/auth/discord/callback") {
        const errorParam = requestUrl.searchParams.get("error");
        if (errorParam) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(`Discord OAuth cancelled or denied: ${errorParam}`);
          return;
        }

        const code = requestUrl.searchParams.get("code");
        const state = requestUrl.searchParams.get("state");

        if (!code || !state) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Missing authorization code or state parameter.");
          return;
        }

        const expiresAtState = pendingStates.get(state);
        pendingStates.delete(state);
        if (!expiresAtState || expiresAtState < Date.now()) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Invalid or expired OAuth state token.");
          return;
        }

        const tokenBody = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        });

        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenBody.toString(),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          console.error("Discord token exchange failed:", tokenRes.status, errText);
          res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Failed to exchange OAuth code with Discord.");
          return;
        }

        const tokenData = (await tokenRes.json()) as DiscordTokenResponse;

        const userRes = await fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (!userRes.ok) {
          const errText = await userRes.text();
          console.error("Discord /users/@me failed:", userRes.status, errText);
          res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Failed to fetch Discord user profile.");
          return;
        }

        const userData = (await userRes.json()) as DiscordUserResponse;
        const now = Date.now();

        db.upsertUserToken({
          discordUserId: userData.id,
          username: userData.username,
          globalName: userData.global_name ?? null,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token ?? null,
          expiresAt: now + tokenData.expires_in * 1000,
          updatedAt: now,
        });

        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`Linked Discord account @${userData.username} (${userData.id}). You can return to Discord.`);
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    } catch (err) {
      console.error("Error in OAuth callback handler:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      res.end("Internal server error during OAuth callback.");
    }
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`OAuth HTTP server listening on port ${port}`);
  });

  return server;
}