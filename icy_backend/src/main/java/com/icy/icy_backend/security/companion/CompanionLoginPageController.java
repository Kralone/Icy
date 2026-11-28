package com.icy.icy_backend.security.companion;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

/**
 * Page de connexion ouverte dans le navigateur par Icy Companion. Le mot de passe n'est tapé qu'ici, sur iceforge.fr ;
 * l'app ne reçoit qu'un code à usage unique, qu'elle échange contre ses jetons avec son secret PKCE.
 */
@RestController
@ConditionalOnProperty(prefix = "icy.companion-auth", name = "enabled", havingValue = "true")
class CompanionLoginPageController {

    @GetMapping(value = CompanionAuthServerConfig.LOGIN_PATH, produces = MediaType.TEXT_HTML_VALUE)
    String loginPage(HttpServletRequest request) {
        CsrfToken csrf = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        String message = "";
        if (request.getParameter("error") != null) {
            message = "<p class=\"error\">Identifiant ou mot de passe incorrect, compte inactif, ou trop de tentatives. "
                    + "Si ton mot de passe est temporaire, change-le d'abord sur le site.</p>";
        } else if (request.getParameter("logout") != null) {
            message = "<p class=\"info\">Tu es déconnecté.</p>";
        }
        String csrfField = csrf == null ? "" : "<input type=\"hidden\" name=\"" + HtmlUtils.htmlEscape(csrf.getParameterName())
                + "\" value=\"" + HtmlUtils.htmlEscape(csrf.getToken()) + "\">";
        return """
                <!doctype html>
                <html lang="fr">
                <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <meta name="robots" content="noindex">
                <title>Connexion à Icy Companion · IceForge</title>
                <style>
                  :root { color-scheme: dark; }
                  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b1220;
                         font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #e6edf7; }
                  main { width: min(360px, calc(100vw - 32px)); padding: 32px 28px; border-radius: 12px;
                         background: #121b2e; border: 1px solid #23324f; }
                  h1 { font-size: 20px; margin: 0 0 4px; }
                  p.lead { margin: 0 0 24px; color: #9fb0cc; font-size: 14px; }
                  label { display: block; font-size: 13px; margin: 16px 0 6px; color: #c4d1e6; }
                  input[type=text], input[type=password] { width: 100%%; box-sizing: border-box; padding: 10px 12px;
                         border-radius: 8px; border: 1px solid #2c3d5e; background: #0b1220; color: inherit; font-size: 15px; }
                  button { width: 100%%; margin-top: 24px; padding: 11px; border: 0; border-radius: 8px;
                           background: #5aa9ff; color: #04101f; font-weight: 600; font-size: 15px; cursor: pointer; }
                  .error { color: #ff9a9a; font-size: 14px; } .info { color: #9fe0b4; font-size: 14px; }
                </style>
                </head>
                <body>
                <main>
                  <h1>Icy Companion</h1>
                  <p class="lead">Connecte-toi avec ton compte IceForge. Tu reviendras ensuite automatiquement dans l'app.</p>
                  %s
                  <form method="post" action="%s">
                    <label for="username">Identifiant</label>
                    <input id="username" name="username" type="text" autocomplete="username" required autofocus>
                    <label for="password">Mot de passe</label>
                    <input id="password" name="password" type="password" autocomplete="current-password" required>
                    %s
                    <button type="submit">Se connecter</button>
                  </form>
                </main>
                </body>
                </html>
                """.formatted(message, CompanionAuthServerConfig.LOGIN_PATH, csrfField);
    }
}
