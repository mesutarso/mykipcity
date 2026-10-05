# MyKipCity dans Docker et Coolify

L’image fixe Node 24.20.0 et Bun 1.4.2. Elle compile les dépendances SQLite sous Linux et lance Next.js sur `0.0.0.0:3200`. Les migrations s’appliquent avant chaque démarrage ; aucun seed n’est automatique. Cette version exige toujours des données fictives et `DEMO_MODE=true`.

## Coolify

1. Publier ces fichiers dans le dépôt Git utilisé par Coolify.
2. Sélectionner **Build Pack: Dockerfile**.
3. Définir **Base Directory: /** si `package.json` est à la racine du dépôt, sinon `/kipcity-app`.
4. Définir **Dockerfile Location: /Dockerfile** et **Ports Exposes: 3200**. Retirer les anciennes commandes Nixpacks et toute surcharge de démarrage pour laisser agir le Dockerfile.
5. Copier les variables de `deploy/docker.env.example` dans les variables **runtime** de Coolify. Générer un secret avec `openssl rand -hex 32`, puis remplacer le domaine et le secret. Aucun secret réel n’est requis au build : désactiver leur disponibilité au build.
6. Ajouter un volume persistant monté sur `/app/data`. Il doit être accessible en écriture au compte `node` (UID/GID 1000). Un volume Docker neuf reprend les permissions du dossier de l’image ; un montage hôte existant doit avoir les permissions adaptées.
7. Configurer le DNS et le domaine HTTPS identique à `BETTER_AUTH_URL`, puis déployer.

## Démonstration réaliste prête à parcourir

Activer `SEED_SHOWCASE=true` au runtime initialise le scénario une fois, après les migrations. Il comprend dix comptes (sept collaborateurs et trois acquéreurs), trois parcelles, deux rattachements validés et un dossier à examiner, trois demandes Finance avec budgets, deux suivis Finance publiés aux membres autorisés, trois messages de bienvenue, une institution de recette et deux publications relues par une seconde personne. Les pièces PDF sont copiées dans le stockage privé et accessibles via les contrôles habituels. Les calculs et opérations utilisent le code métier réel ; les identités, références, montants et institution sont inventés pour la recette. Aucune signature, offre bancaire ou opération de paiement réelle n’est créée.

Les mots de passe aléatoires sont enregistrés dans `/app/data/showcase-access.json` avec les permissions `0600`. Pour les lire, ouvrir le terminal du conteneur et exécuter `cat /app/data/showcase-access.json`. Ne pas partager ce contenu publiquement. Les adresses utilisent le domaine réservé `recette.kipcity.test` : aucun e-mail n’est envoyé à ces comptes. Les rôles internes conservent le MFA obligatoire. Pour tester l’envoi de mails, créer séparément une invitation vers une adresse autorisée à recevoir les messages.

Le seed conserve les comptes, leurs mots de passe et les modifications métier lors des redémarrages. Après initialisation, `SEED_SHOWCASE=false` permet de désactiver l’appel. Utiliser un volume neuf pour cette démonstration ; les anciennes données ne sont jamais effacées automatiquement. Le seed historique `db:seed` reste disponible pour les anciennes recettes locales, mais n’est pas lancé par le Dockerfile.

Si une sonde HTTP est activée, utiliser `/connexion` sur le port 3200. Conserver une seule instance et désactiver les déploiements avec chevauchement de deux instances pour cette base SQLite locale. Sauvegarder la base et les documents avant une mise à jour avec migrations.

Pour une base existante, conserver les chemins utilisés ou copier la sauvegarde restaurée dans le volume avant le premier démarrage. Ne pas remplacer le stockage existant par un volume vide en espérant retrouver les données.

Dans le terminal du conteneur, initialiser les données fictives une seule fois si nécessaire :

```sh
bun run db:seed
bun run db:seed:finance
bun run db:seed:admin
bun run db:seed:controls
bun run db:seed:publications
```

Les comptes et mots de passe de recette sont documentés dans le README. Pour les e-mails du pilote, configurer Resend, `MAIL_FROM`, `MAIL_ENABLED=true` et `MAIL_AUTORUN=true` selon `docs/PILOTE.md`.

## Initialisation des collaborateurs depuis une source privée

Le nouveau script `bun run db:seed:users` crée uniquement les collaborateurs fournis dans un fichier JSON privé désigné par `SEED_USERS_FILE`. Il n’invente aucun utilisateur ou dossier, ne modifie pas les comptes existants et n’affiche jamais les mots de passe. Chaque entrée contient `name`, `email`, `role` et `password` (16 caractères minimum, unique par personne). Les rôles autorisés sont `ADMIN`, `ACQUIRER_AGENT`, `FINANCE_OFFICER`, `FINANCE_REVIEWER`, `FINANCE_VALIDATOR` et `LEGAL_OFFICER`. Les acquéreurs doivent suivre le circuit d’invitation et de rattachement aux dossiers.

Monter ce fichier en lecture seule hors du répertoire public, puis définir `SEED_USERS_FILE` avec son chemin dans le conteneur. L’entrypoint applique alors les migrations et exécute ce seed avant de démarrer. Il peut être rejoué sans réinitialiser les mots de passe ni les rôles. Retirer cette variable et le fichier privé après l’initialisation. Ne jamais committer ou incorporer le fichier dans l’image. Ce mécanisme ne lève pas à lui seul le périmètre de démonstration de l’application.

## Vérification locale

Depuis `kipcity-app` :

```sh
docker build -t mykipcity:local .
cp deploy/docker.env.example /tmp/mykipcity-docker.env
# Modifier le domaine et le secret dans ce fichier privé.
docker run --rm --name mykipcity -p 127.0.0.1:3200:3200 \
  --env-file /tmp/mykipcity-docker.env \
  --mount source=mykipcity-data,target=/app/data mykipcity:local
```

Pour un test local, mettre `BETTER_AUTH_URL=http://127.0.0.1:3200`. Le Dockerfile utilise uniquement des valeurs fictives lors de la compilation ; `.env`, les données locales et les accès de démonstration sont exclus du contexte Docker.
