# Préparation GitHub

Le dépôt est le dossier `kipcity-app`, pas le dossier parent LUIGI. Les règles de `.gitignore` protègent la configuration privée, les données locales et les fichiers générés. Elles ne suppriment aucun fichier du disque.

## À conserver uniquement en local

- `.env` et ses variantes : clé Resend, secret Better Auth et configuration réelle.
- `data/` : base SQLite, pièces privées et sauvegardes. Les bases et journaux SQLite sont également exclus par extension.
- `.demo-access.json` : liens d’invitation locaux.
- Clés privées, identifiants de services, sessions de navigateur et captures réseau HAR.
- Dépendances, compilation, client Prisma généré, caches, logs et résultats de tests.

`.env.example` reste versionné : aucun secret réel, messagerie désactivée par défaut. Les mots de passe présents dans les scripts de préparation et le README sont ceux des comptes fictifs de démonstration ; ne pas les réutiliser pour de vrais comptes.

## À publier avec le code

Sources, schéma Prisma et migrations, tests, scripts, `package.json`, `bun.lock`, configuration shadcn, documentation technique et fichiers explicitement fictifs de `demo/`. Les captures actuellement présentes dans `docs/` illustrent les comptes fictifs ; ne pas y ajouter de captures de vrais dossiers.

Après un clone : copier `.env.example` vers `.env`, renseigner les secrets localement, installer les dépendances, puis exécuter `bun run db:generate` et `bun run db:migrate`. Les données et sauvegardes privées se transmettent séparément de GitHub.

## Vérification avant le push

Depuis `kipcity-app` :

```sh
git status --short
git check-ignore .env .demo-access.json data/development.db
git ls-files -ci --exclude-standard
git diff --cached --stat
```

`git ls-files -ci --exclude-standard` doit être vide : il détecte les fichiers déjà suivis malgré les exclusions. `.gitignore` ne retire pas un secret des commits passés. Si un secret est un jour commité, le révoquer et traiter l’historique avant publication.

Vérification du 5 octobre 2026 : les valeurs locales `BETTER_AUTH_SECRET` et `RESEND_API_KEY` n’ont pas été retrouvées dans les 328 fichiers candidats examinés ni dans les 328 blobs du commit existant. Une recherche ciblée de formats de clés privées, Resend, GitHub et AWS n’a rien détecté. Ce contrôle ciblé n’est pas une garantie exhaustive d’absence de données confidentielles.

La préparation initiale n’effectuait aucun commit ni push. L’utilisateur a ensuite demandé la finalisation et le push de `kipcity-app`, incluant Docker et le scénario réaliste. Le fichier privé `showcase-access.json` est également exclu du dépôt et du contexte Docker.
