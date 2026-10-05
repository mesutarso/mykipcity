# MyKipCity — première démonstration locale

## Livraison du 5 octobre 2026

Gestion → **Regroupements et titulaires** permet de réunir les dossiers de deux comptes actifs appartenant à la même personne, après examen de preuves et validation par deux agents distincts. Le compte conservé dispose d’un sélecteur de dossier ; contrats, échanges et accès Finance autorisés sont conservés. Le compte d’origine est désactivé et les sessions des deux comptes sont fermées. Le remplacement de l’accès d’un titulaire à une parcelle utilise également deux agents, sans transfert des documents privés entre personnes. Les représentants restent en consultation des informations autorisées de la parcelle, sans pouvoir sur le dossier d’autrui.

La migration est appliquée à la base locale après sauvegarde vérifiée. 152 tests réussis, TypeScript, lint et compilation vérifiés. Le regroupement et le parcours du membre ont été exercés dans le navigateur sur une copie isolée. Voir [la recette technique](docs/RECETTE-MYKIPCITY-2026-10-05.md).

`bun run mail status` affiche uniquement la présence de la configuration Resend. L’expéditeur `my@kip-city.com` est configuré ; le test réel a été reçu en boîte principale et confirmé par l’utilisateur. Le traitement automatique est activé pendant que le serveur tourne ; les adresses fictives ne sont pas envoyées au fournisseur. Le pilote client reste nécessaire avant clôture métier. Le menu mobile utilise le composant Sheet de shadcn ; les menus n’ont plus de bordure colorée à gauche. Les sections historiques ci-dessous décrivent les tranches précédentes ; le journal et l’inventaire actualisé font foi pour l’état courant.

Application privée séparée des sites publics existants. Stack : Next.js, Prisma, SQLite locale et Better Auth. Cette tranche permet de montrer le parcours acquéreur demandé par le client, avec des données fictives uniquement. Finance dispose désormais de dossiers, demandes et budgets en brouillon, pièces privées, fiches institutions et offres reçues. Signatures, contrôles et Juridique restent à implémenter.

## Déploiement Docker / Coolify et démonstration réaliste

Voir [DOCKER-COOLIFY.md](docs/DOCKER-COOLIFY.md). L’image fixe Node 24.20.0 et Bun 1.4.2, applique les migrations et initialise le scénario avec `SEED_SHOWCASE=true`. Celui-ci comporte dix comptes, trois dossiers acquéreurs et Finance, des pièces privées, messages et publications. Les accès aléatoires sont conservés dans le volume privé ; aucune donnée réelle ni mot de passe n’est committé. L’interface adopte une présentation d’espace personnel, tandis que le périmètre de recette reste documenté et `DEMO_MODE=true` reste requis.

## Démarrage

La préparation du pilote distant sur `my.kip-city.com` est décrite dans [PILOTE.md](docs/PILOTE.md). `bun run check:environment` contrôle la configuration locale ; ajouter `--hosted` pour le futur serveur. Le modèle sans secrets se trouve dans `deploy/pilot.env.example`.

Prérequis : Node.js 24 et Bun. Depuis ce dossier :

```sh
bun install --frozen-lockfile
cp .env.example .env
# Générer BETTER_AUTH_SECRET, par exemple : openssl rand -hex 32
bun run db:generate
bun run db:migrate
bun run db:seed
bun run db:seed:finance
bun run db:seed:admin
bun run db:seed:controls
bun run dev
```

Adresse : http://127.0.0.1:3200. Garder cette adresse exacte, également configurée dans BETTER_AUTH_URL.

Compte agent fictif : **agent@demo.kipcity.test** — **Demo-KipCity-2026!**. Le script de préparation conserve les comptes existants ; il renouvelle uniquement les invitations des acquéreurs sans compte. Les liens sont conservés dans `.demo-access.json`, exclu du dépôt. Le mot de passe agent connu est réservé à cette démonstration locale.

Compte Finance fictif : **finance@demo.kipcity.test** — **Demo-Finance-2026!**. Après connexion : demandes, budgets, pièces, institutions, offres et historiques. Seuls les dossiers du référent connecté sont visibles.

Compte administrateur fictif : **admin@demo.kipcity.test** — **Demo-Admin-2026!**. Accès : `/administration/equipe`. Administration des collaborateurs uniquement, sans accès aux dossiers Finance ou acquéreurs. Les liens d’invitation sont affichés à leur création ; aucun e-mail n’est envoyé.

Comptes de contrôle fictifs : **controle@demo.kipcity.test** / **Demo-Controle-2026!** et **validation@demo.kipcity.test** / **Demo-Validation-2026!**. Leur espace `/finance/controles` présente uniquement les dossiers attribués. Le référent soumet depuis l’onglet **Validation** du dossier. Un contrôle ou une validation interne ne constitue ni une signature ni une autorisation de transmission bancaire.

## Démonstration en deux fenêtres privées

1. Se connecter comme agent, ouvrir « Acquéreurs », puis créer une invitation pour Camille ou Alex Démo.
2. Copier le lien dans une autre fenêtre privée. Créer le compte et choisir son mot de passe.
3. Compléter nom, téléphone, ville, pays et une parcelle **DEMO-A01**, **DEMO-A02** ou **DEMO-B01**. Enregistrer avant de déposer un fichier.
4. Déposer le PDF fictif `demo/contrat-fictif.pdf`. Confirmer la déclaration et transmettre le dossier.
5. Dans la fenêtre agent, ouvrir le dossier, télécharger et examiner la pièce fictive, puis valider la parcelle avec un motif.
6. Dans la fenêtre acquéreur, ouvrir « Mon espace Kip-City ». Seules les parcelles validées ont accès aux informations du registre de démonstration.

Une décision peut demander un complément ou refuser un rattachement. Plusieurs parcelles sont possibles ; une validation partielle ouvre les informations des seules parcelles approuvées. Aucun rattachement ne constitue ici une preuve de propriété. La gestion des cotitulaires et des mandats reste à développer.

## Ce qui fonctionne

- Finance : circuit préparation → contrôle → validation interne, retour pour correction, copies soumises conservées et décisions motivées.
- Incidents FIN-F08 : réception interne sans signature, responsable distinct de la personne mise en cause, urgences, échéances, historique, résolution, clôture et contestation.
- Autorisations FIN-F05 : brouillons ciblés par institution, informations et pièces choisies, périodes, notice référencée, aperçu, versions, gel pour signature et retrait. Aucun consentement signé ni envoi bancaire n’est simulé.
- Finance : liste interne des pièces attendues, dépôts privés, versions et contrôles documentaires motivés.
- Institutions : fiches et interlocuteurs propres au référent, recherche et modification.
- Administration : réattribution motivée des dossiers et des fiches institutions dans `/administration/affectations`, avec historique et contrôle des accès.
- Offres reçues : conditions, montants, validité, pièce justificative contrôlée facultative et historique des versions. Les coordonnées de l’institution sont conservées à la création de l’offre.

- Ajout d’acquéreurs, recherche, filtres par état et pagination.
- Registre des parcelles : création, recherche et consultation des rattachements validés.
- Contact : messagerie interne acquéreur/équipe, boîte de réception et réponses dans le dossier.

- Authentification Better Auth et sessions en base, inscription libre fermée.
- Invitations de 48 heures, liées à l’adresse prévue, révocables et utilisables une seule fois. Activation, compte et dossier créés dans une transaction.
- Dossier sauvegardé, déclarations de parcelles et transmission explicite.
- Dépôts privés locaux PDF/JPEG/PNG, maximum 8 Mo, noms physiques aléatoires, empreinte d’intégrité et téléchargement contrôlé.
- Décisions motivées par parcelle, contrôle des modifications concurrentes et historique des principales actions.
- Tableau de bord acquéreur, navigation en quatre rubriques et espace agent distinct.
- Événements de notification enregistrés, sans émission d’e-mails.
- Accompagnement financier dans MyKipCity : avancement, éléments demandés, rendez-vous et contact, publiés explicitement depuis l’onglet « Suivi acquéreur » du dossier Finance. Brouillon, aperçu, publication, retrait et historique ; les notes internes ne sont pas exposées. La consultation exige le compte acquéreur lié au dossier et une parcelle validée.

## Architecture et limites de cette tranche

SQLite et les documents sont stockés dans `data/`, hors du répertoire public. Prisma conserve uniquement les métadonnées des documents. L’accès aux fichiers passe par une route qui recharge le compte actif et vérifie le propriétaire ou le rôle d’agent. Les modifications métier vérifient aussi l’origine des requêtes. Les mots de passe utilisent le hachage de Better Auth.

La connexion SQLite active WAL, les clés étrangères, une attente de verrou de 5 secondes et la synchronisation FULL. Le fichier de base doit rester sur un disque local persistant ; ce montage ne convient pas à des instances indépendantes partageant un disque réseau ou à un hébergement éphémère. Prisma initialise ses chemins depuis la racine de l’application.

**Cette version n’est pas prête à recevoir de vrais dossiers.** `DEMO_MODE=true` est requis. À compléter avant ouverture réelle : MFA des équipes, récupération de compte, matrice détaillée des droits, limitations de débit des routes métier, analyse antivirus et quarantaine, stockage objet privé pour les fichiers lourds, sauvegardes externes et restauration testée, supervision, envoi d’e-mails, politique de conservation et revue de sécurité. La détection du format par signature n’est pas une validation exhaustive du fichier. Les pièces restent signalées « examen manuel requis ». Le journal applicatif n’est pas un journal inviolable.

La validation d’un document dans cette démo est une confirmation humaine au moment de la décision ; elle ne fournit ni signature électronique ni contrôle juridique automatisé. Les brouillons Finance sont disponibles ; leur mise en service, les signatures, les contrôles complets, Juridique, Terr/API, DocuSign, GreenCity et PMV restent à réaliser selon les lots et validations du client. Aucun paiement en ligne, portefeuille, virement, crédit automatique ou garantie automatique.

## Vérifications

```sh
bun run typecheck
bun run lint
bun run test
bun run build
# Après démarrage du serveur local :
node scripts/check-http.mjs
```

Les tests créent une base SQLite temporaire via les migrations réelles. Ils vérifient invitations expirées/révoquées/réutilisées, activation concurrente, connexion Better Auth, inscription libre interdite, dossier incomplet, documents entre acquéreurs, validation partielle et décisions concurrentes. Ils ne remplacent pas une recette client ni un audit de production.

## Livraison et suite

Le code, la migration, le jeu fictif, les tests et cette documentation sont livrés dans ce dossier. Aucun service payant, compte cloud ni déploiement n’a été créé. Les sites publics existants ne sont pas modifiés par cette tranche.

Backlog de référence : `../output/backlog/MyKipCity-Finance-Backlog-2026-09-28.md` et sa version CSV. Voir `docs/AVANCEMENT.md` pour distinguer la démonstration des tickets complets.

## Informations et actualités MyKipCity

L’équipe acquéreurs dispose de `/gestion/publications` : rédaction, choix des destinataires (tous les membres, référence acquéreur ou parcelle), soumission, relecture par une autre personne, publication, retrait motivé et historique. Un contenu publié doit être retiré, repris puis relu pour être corrigé. L’aperçu du contenu enregistré est disponible avant soumission.

Le tableau de bord affiche séparément les dernières informations personnelles et les nouvelles générales. Le filtre de parcelle ne masque pas les actualités générales ni les informations destinées directement à l’acquéreur. La liste complète est accessible à `/mykipcity/informations`. Les accès sont recalculés à chaque lecture, y compris pour les liens directs.

Compte supplémentaire de recette créé par `bun run db:seed:publications` : `relecture@demo.kipcity.test` / `Demo-Relecture-2026!`. Il représente une seconde personne fictive de l’équipe acquéreurs, uniquement pour la démonstration de la relecture. L’auteur habituel reste `agent@demo.kipcity.test`.

Les publications acceptent désormais des photos JPEG/PNG et des rapports PDF privés, avec légende et date de prise de vue facultative. Programmation et synchronisation avec le site public restent à réaliser. Aucun e-mail n’est envoyé.

## Documents MyKipCity : stockage local

Les fichiers restent dans le dossier privé `data/documents/` (configurable avec `DOCUMENTS_DIR`), jamais dans `public/`. Les nouveaux documents MyKipCity sont rangés sous `mykipcity/<dossier>/<document>/<identifiant de fichier>`. Les contrats initiaux et les fichiers Finance conservent leurs chemins existants. Chaque version possède son propre fichier ; les téléchargements passent par une route authentifiée avec contrôle du dossier et de l’empreinte du fichier. Formats : PDF, JPEG, PNG ; limite : 8 Mo.

Depuis un dossier acquéreur, l’équipe ouvre « Demandes et documents remis » pour demander une pièce ou remettre un document. Le client retrouve les demandes dans « Mes documents », avec type, parcelles et consignes ; il peut déposer et corriger une pièce, sauf après acceptation. L’équipe peut demander une nouvelle correction motivée. Les pièces remises par l’équipe sont visibles après dépôt effectif du fichier.

La rubrique propose des filtres par type, parcelle et documents attendus/reçus, ainsi que les anciennes versions. Les contrats du dossier initial sont conservés dans une section distincte. Ce circuit ne modifie pas rétroactivement une validation parcellaire et ne remplace pas le dépôt initial exigé pour transmettre le dossier. Les pièces Finance restent dans leur propre circuit.

## Photos et rapports des publications

L’auteur ajoute jusqu’à 12 fichiers de 8 Mo maximum à un brouillon, depuis « Photos et rapports ». Les fichiers restent dans `data/documents/publications/<publicationId>/`, avec des noms physiques aléatoires. Leur ajout ou retrait incrémente la version de la publication. Le retrait d’une pièce est motivé et conserve le fichier archivé ; pour remplacer une pièce, la retirer puis ajouter sa nouvelle version avant relecture.

Les fichiers sont figés pendant la relecture et la publication. L’approbation par une autre personne conserve un manifeste des identifiants, légendes, dates et empreintes. Le retrait de la publication coupe les nouveaux accès membres aux images et téléchargements. Les images sont servies directement par une route authentifiée, sans optimisation ni cache partagé ; les PDF sont proposés en téléchargement. Les fichiers déjà téléchargés ne peuvent pas être effacés du poste du membre.

La date de prise de vue est saisie par l’auteur et reste inconnue si elle n’est pas fournie. Aucun constat de travaux, date EXIF ou validation juridique n’est déduit du fichier. Les originaux sont conservés sans suppression automatique de leurs métadonnées ; le relecteur doit vérifier les pièces avant publication. Antivirus et politique de conservation restent à réaliser.

## Profil acquéreur

Le lien « Mon profil » dans l’en-tête ouvre `/mykipcity/profil`. L’acquéreur actif peut mettre à jour son téléphone, sa ville et son pays, y compris après vérification du dossier. Ces coordonnées restent déclaratives. Le nom au registre, l’adresse de connexion, les contrats et les rattachements ne sont pas modifiables par ce formulaire ; les demandes de correction passent par Contact.

L’enregistrement utilise la version du dossier pour empêcher un écrasement concurrent, conserve avant/après dans le journal et affiche les dix dernières mises à jour du profil. Les formulaires de dossier ouverts avant une modification devront être rechargés. Les copies Finance déjà figées ne sont pas réécrites.

## Connexion locale : localhost et 127.0.0.1

En démonstration locale, `http://localhost:3200` et `http://127.0.0.1:3200` sont autorisés pour l’authentification et les formulaires. La liste est dérivée de `BETTER_AUTH_URL`, avec uniquement son alias loopback et son port, lorsque `DEMO_MODE=true`. Aucune origine supplémentaire n’est autorisée pour un domaine externe ou hors démonstration. Les cookies sont propres à chaque hôte : se reconnecter lors du passage de localhost à 127.0.0.1.

Démarrage manuel depuis `kipcity-app` : `bun run dev`. Le diagnostic du 29 septembre a arrêté le serveur de l’agent et laissé le port 3200 libre. Les erreurs de configuration d’origine ou de limite de tentatives ne sont plus affichées comme un mot de passe erroné.

## Parcours et sauvegardes

Les notifications internes, échanges détaillés, pièces Finance déposées par le membre, dossier contractuel détaillé, classement des pièces, programmation/archivage des publications et changement de mot de passe sont disponibles. Voir [le guide d’exploitation](docs/EXPLOITATION.md) pour les parcours et les commandes `bun run backup create`, `verify` et `restore`. L’[inventaire restant](docs/INVENTAIRE-RESTANT-2026-09-29.md) distingue les livraisons des développements et raccordements encore nécessaires.
