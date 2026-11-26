# Changelog

## 0.1.0 (non publiée / unreleased)

- `install` / `uninstall` : statusLine dans `~/.claude/settings.json`, avec sauvegarde et restauration.
- statusLine : ligne courte 5 h + semaine, historique local (1 point par minute au plus).
- `claude-jauge` : jauges, heure de remise à zéro, prévision par régression linéaire.
- `rapport` : jetons par jour, semaine et modèle depuis les fichiers de session.
- `web` : tableau de bord local (127.0.0.1), SVG fait main, clair et sombre, style Liquid Glass.
- Thème partagé (`src/theme.ts`) : 3 états normal / attention / limite proche avec icône et libellé, contraste WCAG AA vérifié par les tests sur n'importe quel fond.
- Widget Windows (Tauri 2) : fenêtre toujours visible + icône près de l'horloge, mise à jour en temps réel par
  surveillance des fichiers, jetons du jour lus de façon incrémentale, effet verre au choix (semi-opaque, Mica, Acrylique),
  lancement au démarrage activé par défaut (désactivable depuis l'icône), installeur `.exe` publié par GitHub Actions.
- Prévision hebdomadaire seulement après 3 h de relevés, pour éviter les extrapolations hasardeuses.
- FR / EN, Node 20+, zéro dépendance à l'exécution pour la CLI.
