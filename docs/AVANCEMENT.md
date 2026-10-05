# Avancement — première tranche locale

## Docker et démonstration réaliste — 5 octobre 2026

Dockerfile avec Node 24.20.0 et Bun 1.4.2, compilation Linux de SQLite, migrations au démarrage, compte système non privilégié et stockage privé dans `/app/data`. Secrets réels exclus de la compilation. `SEED_SHOWCASE=true` initialise dix comptes, trois dossiers et budgets Finance, pièces PDF privées, messages, deux suivis membres et deux publications. Les opérations utilisent les circuits métier ; les données restent inventées pour la recette. Les accès aléatoires sont dans le volume privé, jamais dans Git. L’interface affiche « Espace privé » sans les anciens bandeaux de préproduction.

Validation : 157 tests réussis, TypeScript et lint réussis, image Docker construite, démarrage sur volume vierge avec les 28 migrations et seed automatique, connexion HTTP effective du membre et consultation de son tableau de bord, Finance, informations et documents. Le test du seed vérifie son caractère rejouable, les permissions du fichier d’accès et le cloisonnement des pièces. Guide dans [DOCKER-COOLIFY.md](DOCKER-COOLIFY.md). Le périmètre reste une démonstration réaliste, sans signature ni opération bancaire réelle.

## Préparation du pilote distant — 5 octobre 2026

Domaine retenu : `https://my.kip-city.com` ; hébergement encore à identifier. Modèle sans secrets dans `deploy/pilot.env.example`, commande `bun run check:environment` et variante `--hosted`, grille de 13 scénarios dans [PILOTE.md](PILOTE.md). Le contrôle n’affiche aucune valeur secrète et ne modifie pas les données. Il impose au pilote distant HTTPS, chemins privés absolus, MFA et messagerie configurée.

Vérification : 156 tests réussis, dont quatre nouveaux contrôles de configuration. Les 12 contrôles locaux passent ; le mode distant refuse correctement la configuration locale (URL et chemins relatifs). Aucun déploiement ni changement DNS effectué. Le code reste limité aux données fictives ; les conditions d’ouverture réelle demeurent distinctes.

## Dernier ajout — MyKipCity, 5 octobre 2026

- Décisions utilisateur appliquées : deux comptes actifs d’une même personne peuvent être regroupés après vérification et décision par deux personnes de l’équipe. Les représentants restent limités à la consultation des informations de la parcelle et à leur propre dossier.
- Gestion → Regroupements et titulaires : demande motivée, preuves actuelles téléchargeables, vérification de toutes les pages et empreintes, copie de l’état examiné, refus/retrait et seconde décision indépendante. Toute modification des comptes, dossiers ou preuves impose un nouvel examen.
- Regroupement atomique : tous les dossiers accessibles depuis le compte conservé, désactivation du compte d’origine, fermeture des sessions, annulation des changements d’adresse et invitations obsolètes. Références, contrats, conversations, auteurs, pièces et audiences Finance conservés. Sélecteur de dossier, formulaires ciblés, informations et notifications adaptés.
- Remplacement d’accès du titulaire : retrait de l’ancien rattachement et validation du nouveau dans la même transaction, deux preuves contractuelles et deux personnes obligatoires. Blocage si d’autres droits actifs nécessitent examen. Aucune mutation foncière ni transmission des archives personnelles à un autre titulaire.
- Diagnostic Resend sans exposition de secrets ; configuration absente : aucun envoi ni tentative consommée. Commandes de messagerie corrigées pour l’exécution Node/tsx. Clé fournie par l’utilisateur, variable normalisée et expéditeur `my@kip-city.com` configuré. Test réel accepté par Resend et réception en boîte Gmail principale confirmée par l’utilisateur. Traitement automatique activé ; destinataires fictifs réservés annulés sans appel fournisseur.
- Validation : 152 tests réussis, TypeScript, lint et compilation réussis. Recette navigateur sur copie restaurée : préparation agent, approbation relecteur, connexion du compte conservé, sélection des deux dossiers, documents et Contact. Contraste corrigé ; aucun échec axe WCAG A/AA sur les écrans examinés (décision et dashboard mobile/bureau). Cela ne vaut pas audit complet d’accessibilité.
- Migration `20261005090000_acquirer_changes` appliquée à la base locale après vérification de `data/backups/2026-10-05-before-mykipcity-completion` (six fichiers). Les regroupements fictifs ont été exécutés uniquement sur la copie de recette. Un seul e-mail réel de test envoyé à l’adresse désignée par l’utilisateur.
- Navigation : bordure colorée de sélection supprimée ; menu mobile dans le Sheet officiel shadcn, rubriques et compte accessibles, fermeture à la navigation et par Échap, focus confiné puis rendu au bouton. Recette visuelle et clavier réussie.

Version compilée démarrée sur `http://127.0.0.1:3200`. Contrôles HTTP réussis ; le script accepte la redirection Next en streaming sans contenu de dossier.

Détail : [recette technique](RECETTE-MYKIPCITY-2026-10-05.md). Restent le pilote et le procès-verbal client, incluant les liens de compte et rappels avec les destinataires du pilote. Finance/Juridique ne sont pas déclarés terminés par cette livraison.

## Livraison précédente — registre des originaux JUR-J03

Le registre se trouve dans Cabinet juridique → Originaux. La remise initiale est créée depuis le dossier attribué ; chaque pièce reçoit une référence d’inventaire unique et reste liée à ce dossier.

- Inventaire contradictoire : nature, émetteur, référence, date, parcelle, pages, état, remettant, dépositaire, fondement de garde, accès, restitution et procédure d’incident.
- Mouvements datés : sortie temporaire, retour, transmission autorisée, restitution définitive, perte, détérioration et pièce retrouvée. Détenteur, localisation, état, pouvoirs, reçu, signatures papier référencées et écarts sont enregistrés.
- Contrôle par une autre personne du Cabinet, pièces privées et empreintes vérifiées ; aucun mouvement ne modifie la situation confirmée avant acceptation. Les pertes et détériorations déclarées restent visibles pendant le contrôle.
- Historique conservé, y compris refus et retraits. Seul le dernier fait contrôlé peut être corrigé ; sa version initiale demeure consultable. Aucun reclassement dans un autre dossier, aucune suppression des reçus.
- Retour attendu visible dans le registre, notifications internes, référence FIN-F08 facultative vérifiée sur le dossier lorsqu’elle est fournie. Un signalement urgent peut être consigné sans attendre la création de FIN-F08.
- Le référent et les contrôleurs Finance du dossier consultent le registre. Le contrôleur Cabinet ponctuel n’y accède que pendant son contrôle. Les accès acquéreurs et administrateurs sont refusés.

Validation : 140 tests automatisés passent, lint, TypeScript et compilation Next réussis. La sauvegarde/restauration des reçus a été exercée sur une base isolée. Pas de serveur démarré ni de test visuel ; la recette du Cabinet reste requise. Aucune signature distante, mainlevée ou clôture de garantie n’est déclenchée.

Les anciennes fiches documentaires JUR-J03 restent consultables, mais ne sont pas importées automatiquement comme faits de garde. Les mouvements groupés et corrections de faits plus anciens restent à traiter.

## Livraison précédente — 30 septembre 2026 : suivi documentaire des prêts

Accès par « Suivi des prêts » dans Finance, Contrôles Finance et Cabinet. Un suivi distinct par dossier, prêteur, référence externe et devise ; création après validation interne.

- Décision du prêteur (accord, accord sous conditions, refus), avec référence et version externe, date du fait, réception, source et preuve.
- Contrat signé documenté, offre acceptée, signataires et conditions ; un accord contrôlé est requis. Cette saisie n’effectue aucune signature.
- Tranches avec bénéficiaire effectif client / fournisseur / Plate-Forme ; les montants restent distincts du contrat et des recettes commerciales.
- Échéancier du prêteur avec références stables, amendements conservés et remboursements rattachés. Aucun impayé définitif ni pénalité calculés : « situation à actualiser » quand la preuve ne couvre pas l’échéance.
- Clôture sur décompte et confirmation du prêteur, sans fermer garanties, recours ou dossier juridique.
- Preuve privée obligatoire pour chaque fait, contrôle par une autre personne, vérification d’empreinte, motifs et traces immuables. Une correction remplace le fait effectif sans effacer l’original ; un refus reste consultable.
- Notifications internes aux référents et contrôleurs ; aucune transmission ni opération bancaire.

Validation : 132 tests automatisés réussis, lint, vérification TypeScript et build réussis. La sauvegarde/restauration inclut les nouveaux justificatifs et a été exercée dans une base isolée. Serveur non démarré ; contrôle visuel et recette métier restent à réaliser dans l’application lancée par l’utilisateur.

Limites assumées : une seule saisie en attente par prêt ; pas d’échéancier à effet futur ni reprise autonome d’un prêt clôturé ; le contrôleur doit être celui du dossier. Les totaux de remboursements ne constituent pas un calcul du capital restant dû. Les autres registres spécialisés du Cabinet et FIN-F06 restent à terminer.

Les sections ci-dessous retracent les livraisons antérieures ; leur état initial n’annule pas les ajouts ultérieurs.

Date : 28 septembre 2026. Référence : backlog global MyKipCity / Finance de 56 tickets.

## Résultat livré

Parcours fictif opérationnel : invitation → compte Better Auth → dossier → contrat privé → décision de rattachement → espace acquéreur. Le code est dans `kipcity-app`, séparé des deux sites publics. Aucun déploiement ni compte externe créé.

| Tickets concernés | État réel | Suite nécessaire |
| --- | --- | --- |
| CAD-04 | Compatibilité de la stack démontrée localement | Valider l’hébergement persistant, la volumétrie et les limites de concurrence du pilote |
| SOC-01 / SOC-02 | Application, schéma et migration initiale livrés | Environnements de recette/production, CI et modèle complet des autres modules |
| SOC-03 / SOC-04 | Authentification et deux rôles contrôlés côté serveur | MFA, récupération de compte, invitations internes et matrice des habilitations complète |
| SOC-05 | Invitation locale à usage unique fonctionnelle | E-mails, délivrabilité, modèle validé et contrôles de débit |
| SOC-06 | Dépôt privé local avec contrôle d’accès et empreinte | Stockage cloud privé, antivirus, quarantaine et règles de conservation |
| SOC-07 / SOC-08 | Événements enregistrés et historique des actions du parcours | Worker, reprises, notifications et journal complet avec versions documentaires |
| SOC-09 | À faire | Sauvegardes SQLite cohérentes, documents, copie externe, restauration et exercice de reprise |
| MYK-01 à MYK-05 | Première tranche implémentée | Dictionnaire complet des champs, recette métier détaillée et extensions de gestion |
| MYK-10 | Démonstration locale prête à présenter | Validation du client et corrections issues de la démonstration |
| MYK-06 à MYK-09 / MYK-11 | À faire | Publications, échanges, mandats, imports et pilote réel |
| FIN / JUR / INTG / SVC | À faire | Fonctions métier après validation des modèles, responsables et pilote |

Aucun lot global n’est déclaré réceptionné. Les tickets partiellement couverts restent ouverts : la démonstration ne remplace pas leur recette complète. L’espace Finance/Juridique affiché aux agents est uniquement une page d’attente ; il ne délivre aucune habilitation Finance.

## Vérifications effectuées

- Migration Prisma appliquée à la base locale et à une base temporaire de tests.
- 8 tests automatisés réussis : réglages SQLite, invitations et courses d’activation, Better Auth, dossier et version, accès aux documents, décisions concurrentes et partielles, attribution conflictuelle et compte suspendu.
- Compilation Next.js, contrôle TypeScript et lint réussis.
- Parcours complet exécuté dans le navigateur avec Camille Démo : création, sauvegarde, dépôt du PDF, transmission, validation de DEMO-A01 par l’agent, reconnexion et tableau de bord.
- Vérification HTTP : dossier anonyme redirigé vers la connexion, document anonyme refusé (401), modification provenant d’une autre origine refusée (403).
- Contrôle axe-core du tableau de bord mobile (WCAG 2 A/AA) : zéro violation automatique détectée après correction des contrastes ; ce résultat ne constitue pas un audit complet.
- Contrôle visuel sur ordinateur et écran mobile de 390 px. Captures dans ce dossier.

## État des données après la recette

Camille Démo possède un dossier vérifié, la parcelle DEMO-A01 et le contrat fictif. Connexion : `camille@demo.kipcity.test` / `Demo-Acquereur-2026!` (jeu local préparé lors de la recette, non créé automatiquement par le seed).

Alex Démo reste disponible pour rejouer le parcours depuis le compte agent. Le seed ne réinitialise pas les dossiers existants. Ne pas utiliser les invitations de `.demo-access.json` si elles ont été réémises depuis l’interface ; en générer une nouvelle depuis l’espace agent.

## Prochaine tranche recommandée

1. Faire valider les écrans du parcours et le dictionnaire des champs acquéreurs.
2. Compléter le stockage objet privé et la quarantaine, l’envoi d’invitations et la récupération des comptes.
3. Ajouter MFA, sauvegardes/restauration et habilitations avant tout vrai dossier.
4. Conduire le pilote acquéreur, puis ouvrir Finance initiale avec les modèles et responsables validés.

Ces étapes suivent la demande du client : Finance/Juridique après validation du pilote, sans paiement, portefeuille, virement, crédit automatique ni garantie automatique.

## Mise à jour du 29 septembre 2026 — gestion et échanges

- Écrans simplifiés : titres métier, suppression des slogans de gestion et des commentaires techniques ; une indication « Préproduction » identifie l’environnement.
- MYK-09 partiel : ajout d’acquéreurs, références et e-mails uniques, recherche, filtres et pagination ; ajout et recherche de parcelles avec superficie et référence cadastrale. Import et modifications avancées restent à faire.
- MYK-07 partiel : messages privés persistés entre l’acquéreur et l’équipe, boîte de réception et réponse depuis le dossier. Les messages sont internes à la plateforme ; aucun e-mail externe n’est envoyé. Les 100 derniers messages s’affichent dans chaque conversation et les 50 derniers messages entrants dans la boîte de réception. Pièces jointes aux messages, accusés de lecture et notifications externes restent à développer.
- L’équipe acquéreurs ne voit plus le raccourci vers une page Finance sans fonction disponible. Les modules Finance/Juridique ne sont pas implémentés par cette mise à jour.
- Migration additive `registry_messages`, sans suppression des dossiers précédents.
- 10 tests automatisés réussis, TypeScript, lint et compilation réussis. Ajout et recherche d’un acquéreur et échange acquéreur/agent vérifiés dans le navigateur.

La simplification des textes ne change pas le statut de préproduction. Les prérequis d’ouverture réelle documentés plus haut restent à réaliser.

## Mise à jour du 29 septembre 2026 — demandes et budgets Finance

FIN-01 / FIN-02 partiellement implémentés, en préparation interne. Aucune recette client ni approbation des modèles n’est présumée.

Livré :
- Compte `FINANCE_OFFICER` séparé des agents acquéreurs et des membres. Un référent accède uniquement aux dossiers dont il est responsable ; aucune promotion depuis l’interface.
- Dossiers financiers indépendants, référence unique, trois parcours (habitat, CVPSC, catalogue), demandeur membre ou candidat interne, prochain contact et recherche paginée.
- Brouillon FIN-F01 : identité, qualité, référence acquéreur éventuelle, besoin, description, calendrier, montants/devises et situation bancaire. Un rattachement validé est exigé pour la qualité « acquéreur vérifié ». Les candidats n’obtiennent ni compte ni droits de membre.
- Brouillon FIN-F02 : lignes revenus/charges/engagements/coûts/ressources/échéance, devise, période, justificatif référencé, stabilité, personnes à charge, risques, scénario et notes internes.
- Montants conservés en chaînes décimales validées dans les formulaires JSON ; calculs en unités mineures entières BigInt, sans nombre flottant ni conversion automatique. Les valeurs absentes restent distinctes de zéro. Les sommes ne mélangent pas les devises ni les périodes.
- Révisions de brouillons conservées en lecture seule, auteur/date, version optimiste et journal. Un enregistrement concurrent obsolète est refusé. Les champs d’état ou de validation injectés sont refusés.

À réaliser pour terminer FIN-01 / FIN-02 : modèles approuvés et dictionnaire complet, pièces Finance privées et preuves, consentements du demandeur, signature DocuSign et PDF figé, visa distinct de l’analyste, workflow de contrôle, délégations et réattribution, lien membre autorisé, exports PDF. Une référence de justificatif saisie n’est pas un contrôle de la pièce. L’historique livré est une archive de brouillons, pas une version signée ni un journal inviolable.

Aucune commande, transmission bancaire, décision de crédit, garantie ou paiement. Les habilitations actuelles n’autorisent aucune de ces actions.

Validation : 17 tests automatisés réussis, lint et compilation Next.js réussis. Connexion Finance, création d’une demande liée à un acquéreur vérifié, ajout de deux lignes de budget, sauvegarde et lecture d’une ancienne version vérifiés dans le navigateur. Base migrée sans supprimer les données précédentes.

Accès de préproduction : `finance@demo.kipcity.test` / `Demo-Finance-2026!`. Création reproductible : `bun run db:seed:finance`. La connexion redirige automatiquement vers `/finance`. Le compte agent acquéreurs conserve son propre espace.

## Mise à jour — pièces justificatives Finance

L’onglet « Pièces » permet au référent du dossier de tenir une liste de pièces attendues (identité, contrat terrain, référence parcellaire, devis, revenus, offre bancaire, autre), de déposer des PDF/JPEG/PNG jusqu’à 8 Mo, de télécharger les fichiers et d’enregistrer un contrôle motivé. Les compteurs distinguent pièces à fournir/remplacer, à examiner et contrôlées.

Chaque nouveau dépôt conserve les versions précédentes et repasse à examiner. Une ancienne version ne peut plus être contrôlée après remplacement. Les décisions concurrentes ou répétées sont refusées. Les accès, dépôts, remplacements et décisions sont journalisés. Les documents Finance restent séparés des documents acquéreurs et accessibles uniquement au référent affecté et actif.

La liste des pièces attendues est interne : aucun e-mail ni message au demandeur n’est envoyé par cette action. Un contrôle documentaire n’est ni un visa FIN-F03, ni une validation juridique, ni une signature ou une autorisation de transmission. Le stockage privé est toujours local en préproduction ; antivirus, quarantaine et stockage cloud restent à raccorder avant ouverture réelle.

Migration additive `finance_documents`. 18 tests réussis, lint et compilation réussis. Tests supplémentaires : accès croisé refusé, ancien dépôt conservé, fichier concurrent obsolète nettoyé, remplacement réinitialisant le contrôle, décisions concurrentes et vérification d’intégrité. Dépôt et contrôle vérifiés dans le navigateur.

## Mise à jour — institutions et offres reçues

Première couverture de FIN-F04 : registre des institutions et de leurs interlocuteurs, recherche paginée, création et modification avec contrôle des versions. Chaque référent voit ses propres fiches. Dans un dossier, l’onglet « Offres » permet de saisir les montants, devises, durées, méthodes de taux, dates de validité, références et conditions communiquées, puis de consulter les offres côte à côte.

Les coordonnées de l’institution sont conservées telles qu’elles étaient à la création de l’offre. Chaque modification de l’offre produit une version datée, attribuée à son auteur et consultable en lecture seule. Une pièce privée peut être liée uniquement si elle appartient au dossier et si sa dernière version est contrôlée. Le remplacement ultérieur de cette pièce est signalé ; l’ancienne référence reste conservée dans l’historique.

Les montants restent des décimaux exacts. Les dates dépassées sont signalées, sans score, classement automatique, décision de crédit ni transmission bancaire. Restent à réaliser : vérification du statut des institutions, mandats, modèles approuvés, visas et responsabilités distinctes, scoring validé, signatures et raccordements. Cette livraison ne vaut pas validation de FIN-F04 complet.

Migration additive `institutions_offers`. 20 tests automatisés réussis, lint et compilation avec TypeScript réussis. Recette navigateur avec données fictives : création d’une institution et de deux offres, modification de montant, conservation de l’ancienne version et remise à zéro du formulaire après création. À 390 px : aucun débordement horizontal et zéro violation détectée par axe-core WCAG 2 A/AA sur l’onglet Offres ; cela ne remplace pas un audit complet.

## Mise à jour — équipe et habilitations internes

SOC-03 / SOC-04 / SOC-05 partiellement complétés : espace ADMIN distinct, liste et recherche des collaborateurs, invitations nominatives de 48 h, renouvellement et révocation, activation à usage unique avec choix du mot de passe. Les jetons sont conservés sous forme d’empreinte ; aucun mot de passe ni jeton brut dans le journal. L’adresse n’est pas déclarée vérifiée par e-mail lors de cette activation locale.

Trois rôles internes disponibles : administrateur des accès, gestionnaire acquéreurs, référent Finance. L’administrateur n’obtient aucun accès métier implicite. Les changements de rôle, suspensions et réactivations exigent un motif, contrôlent la version et suppriment les sessions du collaborateur. L’auteur et le changement avant/après restent consultables. Les modifications du propre compte administrateur sont refusées ; les comptes acquéreurs ne sont pas transformables en collaborateurs. Un référent possédant des dossiers ou institutions ne peut changer de rôle avant réattribution.

Cette tranche ne comprend pas encore la réattribution des dossiers/institutions, les délégations temporaires, les rôles de contrôleur/validateur, la gestion des cotitulaires, la MFA ni la récupération de compte. Chaque invitation crée une nouvelle identité interne ; le rapprochement de plusieurs comptes d’une même personne devra précéder les workflows exigeant une séparation des pouvoirs. Les invitations restent à remettre manuellement : aucun e-mail envoyé.

Migration additive `staff_access`, sans effacement des données existantes. Compte de recette créé par `bun run db:seed:admin` (identifiants dans README). 26 tests réussis, lint, TypeScript et compilation réussis. Tests couvrant accès administrateur, exclusion métier, renouvellement/révocation/expiration des invitations, activation concurrente, collision acquéreur, suspension, sessions, auto-modification, concurrence et protection des affectations Finance. Navigateur : connexion ADMIN, invitation, activation d’un compte fictif, suspension motivée et historique vérifiés. Fiche mobile à 390 px sans débordement ; axe-core WCAG 2 A/AA : zéro violation automatique détectée. Le compte `equipe.essai@demo.kipcity.test` reste suspendu après recette.

## Mise à jour — réattributions Finance

L’administrateur peut désormais réattribuer un dossier ou une fiche institution à un autre référent Finance actif. Recherche et filtre par responsable, y compris les responsables suspendus. L’écran expose les références de dossiers et les libellés d’institutions nécessaires à l’affectation, sans requêtes sur les budgets, demandes ou fichiers privés. Les transferts sont unitaires et motivés ; les conflits de version, même responsable, rôle incompatible, destination suspendue et doublons d’institutions sont refusés.

Le dossier conserve ses pièces, offres et anciennes versions. Les contrôles d’accès suivent le responsable actuel. Une offre existante reste modifiable par le nouveau responsable du dossier, même si la fiche institution appartient encore au précédent. Son écran reprend uniquement les coordonnées figées dans l’offre. La création d’une nouvelle offre nécessite toujours une institution du répertoire du référent connecté. Le transfert d’une institution n’affecte pas les responsables des dossiers liés.

Chaque réattribution est journalisée avec auteur, date, ancien/nouveau référent et motif. L’historique est visible dans l’administration et dans le dossier pour son responsable courant. Le compteur de version du dossier ou de l’institution augmente pour invalider les formulaires obsolètes ; aucun contenu financier n’est modifié et aucune fausse révision de formulaire n’est créée (la numérotation des révisions de formulaires peut donc présenter un intervalle).

27 tests réussis, lint, TypeScript et compilation réussis. Tests de concurrence, refus d’accès, conservation des pièces et versions, reprise des offres et collisions de répertoire. Navigateur : transfert du dossier fictif de Camille, connexion du nouveau référent, consultation du dossier et formulaire d’offre vérifiés ; retour au référent initial effectué et journalisé. La collaboratrice de recette dispose maintenant d’un rôle Finance actif pour rejouer ce parcours. Page mobile de 390 px sans débordement ; axe-core WCAG 2 A/AA sur page stabilisée : zéro violation automatique. Aucune migration nécessaire.

Restent à réaliser : transferts groupés, résolution/fusion contrôlée des doublons d’institutions, délégations temporaires et circuit préparateur/contrôleur/validateur. Les téléchargements déjà effectués ne sont pas retirés du poste du précédent référent.

## Mise à jour — circuit de contrôle et validation interne Finance

Première tranche du workflow interne : préparation (référent), contrôle (FINANCE_REVIEWER), validation (FINANCE_VALIDATOR). Ces deux nouveaux rôles sont administrables dans Équipe et accès et n’accèdent qu’aux dossiers qui leur sont attribués. Le référent choisit les intervenants au moment de soumettre. Un projet, un montant recherché, un budget valide et au moins une pièce contrôlée sont exigés ; toutes les pièces attendues doivent avoir leur dernière version contrôlée et les justificatifs d’offres doivent être à jour.

La soumission fige une copie de la demande, du budget, des offres et des références/empreintes des pièces. Elle verrouille les mutations du dossier, des offres et des pièces. La réattribution est bloquée pendant l’examen et après validation. Un contrôle favorable exige trois confirmations explicites (identité/qualité, budget, pièces) et un motif ; le validateur intervient ensuite avec un motif. Les décisions concurrentes, les étapes sautées et les auto-validations sont refusées. La séparation utilise personId et les auteurs des formulaires, offres, dépôts et contrôles documentaires, y compris les contributions antérieures. Le rapprochement fiable des identités physiques et les délégations restent à formaliser avant usage réel : créer deux identités distinctes pour une même personne n’est pas détecté automatiquement.

Contrôleur ou validateur peuvent demander des corrections ; le référent peut retirer un dossier en cours d’examen, notamment si un intervenant devient indisponible. Le retour rouvre la préparation, conserve la copie et les décisions, puis une nouvelle soumission crée un nouvel examen. Les comptes de contrôle n’accèdent plus aux pièces d’un dossier retourné. Une décision finale conserve le dossier en lecture seule. La réouverture d’un dossier validé et le changement d’intervenant sans retrait ne sont pas encore proposés.

Chaque événement conserve acteur, identité, date, étape et motif dans FinanceReviewEvent. Les copies FinanceReview sont archivées séparément des versions de brouillons. Ces archives applicatives ne sont pas un journal inviolable. Le présent circuit reste une préparation de FIN-F03 : modèle métier complet, visas juridiquement admis, signatures, PDF signés et consentement FIN-F05 ne sont pas déclarés réalisés. Aucune transmission, décision bancaire ou garantie automatique n’en résulte.

Migration additive `finance_reviews` appliquée après arrêt du serveur local (première tentative bloquée par un verrou SQLite, sans modification destructive). 33 tests réussis, lint, TypeScript et build réussis. Recette navigateur : dossier Camille soumis, contrôlé et validé par trois comptes fictifs distincts ; il reste au statut « Validation interne enregistrée », sans effet bancaire. Tests couvrant retour/correction/nouveau cycle, archives inchangées, accès privés, comptes suspendus et concurrence. Mobile 390 px sans débordement ; axe-core WCAG 2 A/AA : zéro violation automatique sur le dossier contrôlé. Les files de contrôle affichent les 100 derniers dossiers attribués.

Comptes de démonstration créés par `bun run db:seed:controls` ; identifiants dans README. Restent notamment les signatures, les consentements, le contrôle complet des quinze modèles et le module Juridique.

## Mise à jour — préparation FIN-F05 des autorisations ciblées

L’onglet Autorisations permet au référent d’un dossier validé en interne de préparer une autorisation pour une institution de son répertoire. Champs repris de FIN-F05 : entité responsable, service/personne destinataire, finalité, choix explicite des informations sans case précochée à la création, pièces et versions, période et événement de fin, contact de correction/arrêt, référence de notice. Le formulaire et la déclaration restent des modèles à approuver juridiquement.

Chaque brouillon conserve les coordonnées de l’institution à l’enregistrement, le numéro d’examen interne et une annexe issue de la copie contrôlée. Les pièces sélectionnées doivent appartenir à cette copie. Les informations sont projetées par rubrique choisie : identité, projet, revenus/charges et financement ; les notes internes d’analyste/institution et évaluations d’offres ne sont pas incluses. Les lignes de revenus ne sont pas ajoutées par la seule sélection du plan de financement. Les références de justificatifs restent des données déclaratives dans l’annexe ; les documents sélectionnés sont listés distinctement.

L’aperçu est consultable par le référent du dossier. Modifications avec version optimiste et anciennes versions en lecture seule, puis gel motivé dans l’état READY_FOR_SIGNATURE. À ce stade, aucun envoi vers DocuSign n’est effectué et aucun consentement du demandeur n’est enregistré. Le retrait motivé est définitif pour cette autorisation ; les versions restent disponibles. Une période expirée bloque le gel ; une période à venir est affichée comme telle, sans autoriser un partage. La signature réelle, le contrôle des représentants, la notice réellement remise, le PDF final, la preuve d’enveloppe DocuSign et les règles de transmission FIN-F03/F05 restent à raccorder. Aucune route de transmission bancaire n’a été créée.

Migration additive `finance_authorizations` appliquée serveur arrêté, sans suppression des dossiers. 34 tests réussis, lint, TypeScript et compilation réussis. Tests : isolation des rôles/dossiers, pièces hors périmètre, choix vides, injection d’état signé, anciens cycles, dates, conservation du destinataire, absence de notes internes, édition concurrente, gel, retrait et expiration. Recette navigateur : préparation pour Camille avec identité/projet/contrat seulement, aperçu et gel pour signature vérifiés. Les dates natives ont été remplies via le DOM pendant la recette, le pilote navigateur ne conservant pas sa saisie segmentée. Mobile à 390 px sans débordement ; axe-core WCAG 2 A/AA : zéro violation automatique détectée. L’autorisation fictive reste préparée, non signée.

Le compte de test DocuSign au nom de Kip-City a été demandé à l’utilisateur ; aucun secret n’a été demandé dans le chat, aucun compte externe ni signature n’a été créé. Le raccordement sera traité séparément selon les accès disponibles.

## Mise à jour — incidents et réclamations FIN-F08

DocuSign est explicitement mis en attente à la demande de l’utilisateur. La suite de cette tranche porte sur la réception et le suivi internes des réclamations, indépendamment d’une signature ou d’un compte du déclarant. Un référent connecté peut enregistrer un signalement reçu par téléphone, e-mail, sur place ou en interne, avec ou sans dossier existant.

Livré : liste paginée, recherche, filtre d’état et d’urgence ; catégorie, déclarant/contact, objet, faits, références des preuves, montant/devise, urgence, mesure immédiate, responsable et collaborateur mis en cause. États Reçu → Analyse → Attente externe/Résolu/Escaladé, puis Clôturé ou Contesté ; une clôture peut être contestée pour rouvrir le traitement. Chaque suivi conserve une copie, son auteur, la date, le motif et le responsable. Les mises à jour obsolètes sont refusées. Résolution et clôture exigent les éléments de traitement ; la clôture nécessite une réponse datée et une mesure de prévention. Les dates de réponses futures sont refusées.

Lecture limitée au créateur et au responsable, sauf si leur personId est celui du collaborateur mis en cause. Celui-ci est exclu même avec un autre compte ayant la même identité interne. Seul le responsable actif modifie ou réattribue ; le nouveau responsable doit être actif et distinct de la personne mise en cause. Un signalement dirigé contre son créateur peut être reçu puis transmis au responsable sans conserver l’accès du créateur. Le lien à un dossier ne confère aucun accès au budget, aux offres ou aux fichiers de ce dossier. Un administrateur des accès ne lit pas les signalements. Le changement de rôle d’un responsable ayant des incidents ouverts est bloqué ; un responsable suspendu doit être réactivé par l’administration avant reprise/transfert dans cette tranche.

Les échéances sont saisies manuellement et signalées lorsqu’elles sont dépassées. Les preuves sont des références textuelles, sans nouveau dépôt de fichiers. Les réponses, mesures, saisines et escalades sont consignées ; aucune notification, aucun e-mail, aucune saisine externe ne sont exécutés. Restent à réaliser : canal public/membre, accusé sous deux jours ouvrés avec calendrier validé, suppléants et escalade automatique avec reprise sur échec, pièces privées dédiées, contrôle de l’identité et gestion des conflits déclarés ultérieurement, intégration à la messagerie et modèle métier approuvé. FIN-F08 / FIN-06 restent partiels.

Migration additive `finance_incidents`, sans suppression des données. 40 tests réussis, lint, TypeScript et build réussis. Tests sur réception sans signature, isolation des comptes, exclusion de personne liée, transfert de responsabilité, concurrence, résolution/clôture incomplète, dates futures et contestation. Recette navigateur : réclamation fictive de clarification des frais créée, analysée, résolue puis clôturée avec réponse fictive datée ; aucun message n’a été envoyé. Le signalement est conservé pour démonstration. La date native de réponse a été saisie via le DOM du navigateur de recette. Liste à 390 px sans débordement, zéro violation automatique axe-core WCAG 2 A/AA. Capture `incidents-mobile.png`.

## Mise à jour — accompagnement financier publié dans MyKipCity

Première tranche de FIN-07 : le référent du dossier prépare un titre, un avancement, un message, les éléments à fournir avec échéances facultatives, un rendez-vous et un contact. Il enregistre un brouillon, vérifie l’aperçu puis publie explicitement ou retire le suivi. Modifier le brouillon ne modifie pas la version visible. Chaque action est journalisée avec son auteur ; les modifications concurrentes sont refusées. La communication reste distincte du circuit de validation interne et ne modifie pas les formulaires financiers figés.

La page « Mon accompagnement financier » ne lit que les contenus publiés. Elle exige un compte acquéreur actif, lié au dossier et disposant d’une parcelle validée. Le destinataire est fixé lors de la publication : changer le rattachement du dossier ne transfère pas l’ancienne publication au nouvel acquéreur. Budget, notes internes, offres et pièces privées ne sont pas exposés par cette page.

Les éléments demandés sont des consignes, sans nouveau dépôt de pièces Finance par l’acquéreur. Le rendez-vous est une information publiée, sans réservation, notification ni rappel automatique. Offres communicables et signatures restent à compléter ; DocuSign reste en attente. FIN-07 demeure partiel et aucun lot complet n’est déclaré réceptionné.

Migration additive `member_finance` appliquée, sans suppression des données. 45 tests réussis, lint et compilation réussis. Tests sur brouillons invisibles, isolation des acquéreurs, accès suspendus, parcelles non validées, changement de destinataire, concurrence, retrait et republication, contenu strict et rendez-vous incomplets. Recette navigateur : brouillon fictif enregistré puis publié par Finance et consulté avec le compte Camille ; élément demandé, rendez-vous du 05/10/2026 à 10:30 (Kinshasa) et contact affichés. Les champs natifs de rendez-vous ont été renseignés via le DOM du navigateur de recette. À 390 px : aucun débordement horizontal, zéro violation automatique axe-core WCAG 2 A/AA ; capture `member-finance-mobile.png`.

## Mise à jour — informations privées et actualités MyKipCity

MYK-05 / MYK-06 partiellement complétés : gestion des publications textuelles pour tous les membres, un acquéreur identifié par sa référence ou une parcelle du registre. L’auteur crée et modifie son brouillon puis le soumet. Une autre personne de l’équipe acquéreurs approuve et publie ou demande une correction. La séparation vérifie le compte et les personId connus de l’auteur et du relecteur ; elle ne remplace pas le rapprochement des identités physiques. L’administration technique et Finance n’ont pas accès à ce back-office.

Une publication en relecture est verrouillée. Le retrait motivé supprime l’accès aux prochaines lectures ; un texte déjà consulté ou copié ne peut pas être effacé du poste du lecteur. Pour corriger, l’auteur rouvre la publication retirée, enregistre et repasse par la relecture. Les événements conservent les contenus enregistrés, auteur, version, date et motifs. L’historique de la fiche affiche les 50 derniers événements ; les contenus antérieurs restent conservés dans le journal sans écran de comparaison. Les conflits de version et les doubles décisions concurrentes sont refusés.

Le dashboard expose trois informations personnelles et trois actualités générales indépendamment, afin qu’une série d’informations ciblées ne masque pas les nouvelles générales. Une liste paginée de 12 articles et une page de lecture complète sont disponibles. Le choix d’une parcelle ne propose que les rattachements approuvés et conserve les informations générales et celles du client. Les brouillons, contenus retirés et informations des autres dossiers sont exclus des requêtes de lecture. Un compte sans rattachement approuvé ne reçoit aucun article. Les droits sont recalculés après suspension ou changement d’un rattachement.

Migration additive `member_publications` appliquée après arrêt du serveur, sans suppression des données. 51 tests réussis ; lint et compilation réussis. Les tests couvrent les rôles, références inconnues, états, auteur et alias, concurrence, retrait, reprise, revalidation, ciblage, URL directe, compte suspendu et filtre terrain. Un défaut de composition du filtre d’accès détecté par les tests a été corrigé avant recette : le refus d’accès reste explicite même dans les requêtes composées du dashboard.

Recette navigateur : création et approbation croisée par deux gestionnaires fictifs d’une nouvelle générale et d’une information DEMO-A01, puis consultation par Camille dans MyKipCity. Compte supplémentaire créé avec `bun run db:seed:publications`, identifiants dans README. Mobile 390 px : aucun débordement, zéro violation automatique axe-core WCAG 2 A/AA sur le dashboard. Capture `mykipcity-publications-mobile.png`.

Restent pour MYK-06 : photos privées et leurs dates de prise de vue, rapports et pièces jointes contrôlés, programmation, circuit CentreCom final, comparaison des versions et séparation éditoriale avec les versions publiques. Les textes fictifs de recette restent dans la base locale. Cette livraison ne vaut pas réception du lot ni ouverture aux vrais dossiers.

## Mise à jour — documents MyKipCity et uploads locaux

À la demande de l’utilisateur, les uploads restent sur disque dans le dossier privé `data/documents/`. Aucun compte ni stockage cloud créé. Pour les nouveaux documents : sous-dossiers `mykipcity/<fileId>/<documentId>/<UUID>`, permissions demandées 0700 pour les dossiers et 0600 pour les fichiers, création exclusive, empreinte SHA-256, téléchargement authentifié sans cache. Les fichiers existants restent à leur emplacement. PDF/JPEG/PNG, limite 8 Mo ; la détection de signature ne remplace pas un antivirus. Une configuration sous le dossier public est refusée par le nouveau circuit.

MYK-07 partiellement complété : l’équipe demande une pièce ou prépare une remise, avec type, consignes et plusieurs parcelles du dossier. Le client voit les demandes et les documents effectivement remis, dépose des versions et lit les motifs du contrôle. Une pièce acceptée ne peut être remplacée par le client tant que l’équipe n’a pas demandé une correction. Les nouveaux dépôts gardent les anciens fichiers ; les conflits de version et contrôles périmés sont refusés. Les dépôts perdants sont nettoyés lors d’un conflit transactionnel. Chaque demande, dépôt, contrôle et téléchargement est journalisé.

Nouvelle page Mes documents : filtres type/parcelle/attendus/remis, téléchargement et anciennes versions. Les pièces générales restent visibles dans les filtres par parcelle. Les contrats initiaux sont conservés séparément sans attribution de parcelle inventée. Le compteur du dashboard tient compte des nouvelles pièces déposées. Aucun changement automatique du statut d’un rattachement ou du circuit Finance n’est effectué.

Migration additive `member_documents`, sans suppression de données. 57 tests réussis, lint et compilation réussis. Tests sur rôles et dossiers, références de parcelles étrangères, intégrité, formats et tailles, emplacement privé, comptes suspendus, concurrence, fichiers orphelins après conflit, correction, reprise après acceptation, historique et remise par l’équipe. Navigateur : demande de plan DEMO-A01 par l’agent, dépôt par Camille, demande de correction, deuxième dépôt et ancien téléchargement disponible. Mobile 390 px sans débordement ; zéro violation automatique axe-core WCAG 2 A/AA. Capture `member-documents-mobile.png`.

Restent : liaison au circuit des pièces demandées par Finance, classement/versionnement des anciens contrats, annulation/retrait des demandes ou remises, pagination des longues listes, notifications, analyse antivirus, politique de conservation et sauvegarde avec restauration testée. La remise d’un fichier par un agent est immédiate et ne signifie pas signature ou validation juridique. Le stockage local est le choix actuel ; prévoir un disque persistant et sa sauvegarde avant ouverture réelle.

## Mise à jour — photos et rapports privés dans les publications

MYK-06 complété pour les pièces jointes : photos JPEG/PNG et rapports PDF, légende obligatoire, date de prise de vue facultative sans valeur inventée, 12 fichiers maximum par publication et 8 Mo par fichier. Stockage local privé sous `data/documents/publications/<publicationId>/`, sans compte cloud ni exposition dans public. La première image illustre les cartes du dashboard et de la liste ; l’article propose la galerie et les téléchargements.

Ajout/retrait limité à l’auteur d’un brouillon à jour. Les fichiers sont figés pendant relecture/publication ; les changements incrémentent la version et invalident les décisions obsolètes. Un retrait est motivé et logique, avec conservation du fichier pour les archives. Chaque approbation conserve le manifeste des fichiers, empreintes, légendes et dates. Les téléchargements et images appliquent les droits actuels de la publication ; ni URL directe ni vignette ne permet de contourner l’audience. Le retrait coupe les nouvelles lectures membres, sans effacer les copies déjà consultées.

Migration additive `publication_attachments` appliquée serveur arrêté. 58 tests réussis ; lint et compilation réussis. Tests ajoutés sur auteur, formats, date future, dates photo/PDF, concurrence et nettoyage du dépôt perdant, gel, séparation de relecture, destinataires, manifestes, retrait, republication et intégrité. Recette navigateur avec image et PDF fictifs : dépôt, approbation par un deuxième gestionnaire, consultation par Camille, image chargée et PDF téléchargeable avec Cache-Control private/no-store. Mobile 390 px sans débordement ; zéro violation automatique axe-core WCAG 2 A/AA. Capture `publication-media-mobile.png`.

Restent : programmation, politique d’archives/purge, comparaison des versions, antivirus, nettoyage des métadonnées d’images si retenu, circuit éditorial CentreCom final et articulation avec les versions publiques. Les dates sont déclaratives ; les fichiers ne prouvent pas à eux seuls une situation foncière ou des travaux.

## Mise à jour — profil et coordonnées de l’acquéreur

MYK-01/MYK-05 complétés pour l’accès profil dans l’en-tête et la mise à jour téléphone/ville/pays. Consultation du nom au registre, référence acquéreur et e-mail de connexion ; lien Contact pour les corrections d’identité ou de compte. Aucun changement d’e-mail ni réinitialisation de mot de passe n’est fourni par cette tranche.

Le serveur détermine le dossier depuis le compte actif : aucun identifiant de dossier ou champ d’identité n’est accepté dans la requête. La modification ne touche pas les décisions de rattachement, le statut du dossier ni les copies Finance. Elle incrémente la version du dossier et invalide les anciens formulaires pour éviter d’écraser de nouvelles coordonnées. Avant/après et auteur sont journalisés ; les dix dernières modifications sont visibles dans le profil et la dernière démarche remonte au dashboard. Un enregistrement identique ne crée pas de faux événement.

Aucune migration nécessaire. 62 tests réussis, lint et compilation réussis. Tests ajoutés : rôles, injection de champs et de dossier, coordonnées invalides, isolation, conservation des décisions, concurrence, journal, enregistrement identique, suspension et dossier soumis. Recette navigateur : coordonnées fictives de Camille mises à jour, confirmation, historique et persistance après rechargement vérifiés. Mobile 390 px sans débordement ; zéro violation automatique axe-core WCAG 2 A/AA. Capture `profile-mobile.png`.

Restent notamment notifications, vérification des coordonnées déclarées, changement d’adresse de connexion sécurisé et récupération de compte. Le traitement d’une correction d’identité via Contact reste humain.

## Correction — connexion depuis localhost

Symptôme reproduit par requêtes HTTP identiques : origine localhost:3200 → 403 INVALID_ORIGIN ; origine 127.0.0.1:3200 → vérification effective des identifiants. Un seul serveur Next occupait le port 3200, dans kipcity-app : aucune collision de serveurs détectée.

Correction : liste centrale d’origines partagée par Better Auth et les routes métier, ajoutant uniquement l’alias localhost/127.0.0.1 pour le même port lorsque l’URL configurée est locale et DEMO_MODE=true. Les origines externes et ports différents restent refusés. Les erreurs de connexion distinguent mauvais identifiants, origine refusée, limitation de tentatives et indisponibilité.

Régression testée via le véritable handler Better Auth, avec compte temporaire : connexion et récupération de session sur les deux hôtes, puis contrôle des mutations et rejet des autres origines. Test initial rouge (403 au lieu de 200), puis correctif vérifié. Les tests d’origines refusées utilisent la déconnexion pour éviter de confondre le contrôle d’origine avec la limite spécifique des tentatives de connexion. Aucun mot de passe utilisateur modifié, aucune session ou donnée client effacée. Le serveur du projet et le navigateur de recette de l’agent sont arrêtés ; lancement laissé à l’utilisateur.

Validation finale du correctif : 64 tests passent, lint et build réussis. Après arrêt du serveur de l’agent et constat du port libre, un nouveau `bun run dev` a été lancé depuis une autre session pendant les vérifications. Il a été conservé pour respecter le souhait de lancement manuel de l’utilisateur.

## Design « Essentiel + Bureau » — 29 septembre 2026

Intégration de la direction graphique choisie dans l’application réelle : navigation vert foncé avec rubrique active, fond clair, typographie sans empattement, composants et formulaires harmonisés, adaptation mobile. Le menu acquéreur retrouve ses quatre rubriques ; l’accompagnement financier reste accessible depuis « Mes informations ».

Accueil MyKipCity restructuré autour de l’état réel du dossier, des pièces demandées, des parcelles en liste, des publications privées existantes et des démarches connues. Aucun compteur, notification ou document illustratif ajouté. Les photos conservent leurs contrôles d’accès et leur affichage sans recadrage du contenu.

Finance : synthèse des seuls dossiers attribués au référent, liste tabulaire, recherche et pagination existantes. Les nombres viennent de la base et les libellés distinguent l’étude interne. Les accès métier et mutations restent inchangés.

Vérification : lint, TypeScript, compilation et 64 tests réussis. Serveur utilisateur non lancé et laissé arrêté à sa demande ; le contrôle visuel des écrans intégrés avec session connectée reste à effectuer lorsqu’il relancera l’application. Les propositions statiques avaient été vérifiées à 390 px et sur ordinateur ; elles ne remplacent pas cette vérification finale de l’application.

## Parcours connectés et exploitation — 30 septembre 2026

- Notifications internes recalculées selon les droits actuels, lecture personnelle persistée, filtre non lues et compteur d’en-tête.
- Contact : objet, parcelle, lien vers pièce du dossier, pagination, rejeu d’envoi protégé par identifiant et accusé après lecture explicite.
- Finance : partage explicite d’une exigence vers le membre, dépôt local privé et versionné, rejet/remplacement, contrôle, retrait et confidentialité des pièces internes.
- Dossier : champs contractuels et actuels séparés, titulaires et parcelles détaillés, référence inconnue, contrat manquant, classement des pièces et association à plusieurs terrains. Validation normale exige une pièce contractuelle du terrain ; décisions examinées préservées. Les documents historiques non classés restent identifiés comme tels.
- Publications : diffusion programmée après relecture, date contrôlée côté serveur pour les articles et pièces, archivage/restauration et lecture des deux derniers textes.
- Documents membres : annulation/retrait motivé et historique conservé ; pagination des écrans membre et équipe.
- Compte : changement de mot de passe et révocation des autres sessions via Better Auth ; pages d’erreur, chargement et contenu inaccessible.
- Exploitation : commande de sauvegarde/restauration base + documents, contrôle SHA-256, destination neuve obligatoire ; migration additive appliquée après sauvegarde. Sauvegarde locale de six fichiers restaurée en copie indépendante.

Validation : 77 tests réussis, lint et compilation. Aucun serveur démarré. Contrôle visuel connecté et recette client encore nécessaires. Les modules Juridique avancés, les raccordements et les conditions de production restent dans l’inventaire ; aucune conformité complète n’est revendiquée.

## Étude d’opportunité FIN-F07 — 30 septembre 2026

- Onglet Opportunité dans le dossier Finance : projet, opérateur, entité, emplacement, montage et situation déclarée ; emplois détaillés, argent et actifs évalués ; scénario prudent, propriété, rémunération, reporting, intérêts liés, visas et trois pièces d’avis/décision.
- Calculs exacts en centimes par devise. Besoin prévisionnel uniquement lorsque les quatre postes sont renseignés pour la devise ; apports envisagés distincts des fonds disponibles. Confirmation humaine d’absence de doublons.
- Enregistrement réservé au référent Finance actif, dossier en brouillon et version courante. Justificatifs limités aux versions actuellement contrôlées du même dossier. Historique FIN-F07 et audit.
- Toute étude présente doit être complétée avant soumission. Les preuves sont revérifiées, et l’étude est figée dans le cliché du contrôle. Les anciens clichés sans FIN-F07 restent lisibles.
- Migration additive appliquée après sauvegarde locale de la base et de ses six fichiers. Serveur non démarré.

Validation : 79 tests réussis, lint, TypeScript et compilation réussis. Contrôle visuel connecté non effectué. Le modèle client est encore « à approuver avant mise en service » ; les avis joints ne remplacent pas le futur circuit Juridique. FIN-F06 reste une interface au référentiel commercial unique, sans second registre local.

## Correction des dossiers Finance validés — 30 septembre 2026

- Demande motivée dans Validation, annulation par le référent, acceptation ou refus par le validateur attribué. Dossier verrouillé pendant la demande ; séparation des personnes et version courante contrôlées dans la transaction.
- Notifications internes ciblées et indication des réouvertures dans les dossiers attribués.
- Aucune nouvelle préparation FIN-F05 pendant la demande. Acceptation : retour au brouillon, retrait des préparations non signées avec version et motif, conservation des clichés, autorisations et décisions historiques. Nouvelle soumission : nouveau cycle, contrôle et validation distincts obligatoires. Aucun effet sur un acte externe signé.
- Migration additive appliquée après sauvegarde SQLite et six documents.

Vérification : 82 tests réussis, lint, TypeScript et compilation réussis. Serveur non démarré, contrôle visuel connecté restant. Procédure à réceptionner avec Finance ; remplacement d’un validateur indisponible et délégations restent à développer.

## Remplacement d’un validateur — 30 septembre 2026

- Écran Administration → Affectations Finance → Validateurs : recherche par référence, pagination, décideur actuel, remplaçants admissibles, motif et historique des remplacements. Aucun contenu financier ni document n’est exposé à l’administration.
- Remplacement limité à une validation en attente ou une demande de réouverture d’un dossier validé. Contrôle serveur du rôle administrateur, de l’activité, de l’indépendance des personnes, de la version du dossier et de l’étape courante.
- Ancien accès et notification retirés, nouvel accès et notification attribués selon l’affectation actuelle. Copie soumise et décisions antérieures inchangées ; événement et audit du remplacement. Aucune validation automatique.
- 85 tests réussis, lint, TypeScript et compilation réussis. Tests de suspension, alias de personnes, accès aux pièces, concurrence et poursuite du circuit. Aucune migration nécessaire ; aucun serveur démarré. Vérification visuelle connectée et recette métier restent à effectuer.

## MyKipCity — contrats complets et versions — 30 septembre 2026

- Mon dossier : une pièce regroupe un PDF ou plusieurs photos, avec sélection de plusieurs fichiers, ordre modifiable, retrait avant dépôt et classement commun associé aux parcelles. Réglage documentaire : 10 fichiers par pièce, 20 Mo par fichier, 200 Mo au total ; les autres catégories de dépôt conservent leur limite existante.
- Remplacement complet avec nouvelle version, anciennes pages conservées et téléchargeables selon les droits habituels. Dépôts historiques simples compatibles. Liste groupée et historique visibles par l’acquéreur et l’équipe.
- Transaction atomique, contrôle de la version du dossier, empreintes des fichiers, suppression des fichiers préparés si échec et jeton de rejeu empêchant les doublons après une réponse perdue. Aucun téléchargement partiel ou transfert reprenable par blocs à ce stade.
- Classement appliqué à toutes les pages de la version actuelle. Archives non modifiables ; pièces rattachées à une parcelle examinée protégées. Seules les versions actuelles justifient transmission et validation.
- Sauvegarde avant migration additive, six fichiers existants préservés. Tests de sauvegarde/restauration incluant les anciennes versions.

Validation : 91 tests réussis, lint, TypeScript et compilation réussis. Aucun serveur démarré. Vérification visuelle et recette connectées restent à effectuer. Cette livraison clôt le versionnement groupé des pièces ; elle ne termine pas les habilitations avancées ni l’ensemble MyKipCity.

## MyKipCity — cotitularité et représentation — 30 septembre 2026

- Examen individuel du rattachement de chaque compte : qualité déclarée vérifiée, pièce actuelle du même dossier et de la parcelle, confirmation des rattachements existants. Un simple deuxième titulaire reste bloqué ; cotitularité ou mandat exigent une vérification explicite. Aucun compte créé à partir d’un nom déclaré.
- Représentant : pièce classée Mandat, titulaire représenté et date de fin obligatoires. Mandat initial ou nouvelle pièce demandée et contrôlée via Documents. Conservation des identifiants et empreintes de la preuve examinée.
- Portée : informations publiées pour la parcelle et dossier personnel uniquement. Aucun accès au contrat, à la conversation, à la publication personnelle ou au dossier Finance du titulaire représenté. Aucun pouvoir de signature conféré.
- Retrait et renouvellement motivés par l’équipe, versions concurrentes refusées et événements d’audit. Droits arrivés à échéance ou retirés exclus des publications et des accès Finance conditionnés par un rattachement actif. Les archives personnelles restent accessibles.
- Statuts expiré/retiré, échéance et historique visibles. Migration additive appliquée après sauvegarde SQLite et six documents.

Vérification : 97 tests réussis, lint, TypeScript et compilation réussis. Expiration sans tâche planifiée, accès direct refusé, retrait isolé, renouvellement avec pièce contrôlée et indépendance des dossiers testés. Serveur non lancé ; contrôle visuel connecté et recette métier à effectuer. Les transferts de titulaire, changements de qualité et actes réalisés pour le compte d’autrui nécessitent encore leurs propres parcours.

## MyKipCity — import du registre — 30 septembre 2026

- Gestion → Acquéreurs ou Parcelles → Importer un CSV : modèles téléchargeables, UTF-8, virgule/point-virgule, 500 lignes et 256 Ko maximum. Aperçu paginé de 50 lignes et historique des 30 derniers imports de l’auteur.
- Prévisualisation persistée sans ajout au registre, valable une heure. Distinction entre nouvelles fiches, fiches identiques conservées et conflits bloquants ; références, e-mails, comptes existants et références cadastrales vérifiés. Noms similaires signalés pour confirmation humaine, sans fusion automatique.
- Confirmation réservée à l’auteur actif de l’équipe acquéreurs ; contrôle de l’état actuel du registre, transaction complète, aucune écriture partielle et rejeu sans doublon. Audit de chaque fiche créée et du lot. Aucun compte, invitation ou rattachement créé.
- Migration additive après sauvegarde de la base et des six documents.

Validation : 104 tests réussis, lint, TypeScript et compilation réussis. Cas couverts : CSV cité/multiligne, UTF-8, limites, rôles, suspension, conflits, homonymes, changement du registre, expiration, confirmation concurrente et conservation de l’existant. Serveur non lancé et vérification visuelle connectée restante. La fusion ou correction de fiches existantes reste distincte de cet import.

## MyKipCity — pièces jointes dans Contact — 30 septembre 2026

- Contact et conversation de gestion : choix entre message seul, document existant du dossier et fichier local PDF/JPEG/PNG de 8 Mo maximum. Nom, taille et téléchargement dans le fil.
- Message et métadonnées enregistrés ensemble ; contrôle serveur des droits et du rattachement de la conversation, vérification du format, stockage privé sous `data/documents/messages`, empreinte SHA-256 et nettoyage du fichier préparé si l’enregistrement échoue.
- Rejeu fondé sur le jeton d’envoi, le texte et l’identité du fichier : pas de doublon ; même jeton avec fichier modifié refusé. Toute modification du formulaire prépare un nouvel envoi.
- La pièce jointe ne crée ni contrat validé ni demande documentaire. Le téléchargement exige encore l’accès au dossier. Les sauvegardes/restaurations incluent les fichiers des messages ; compatibilité des sauvegardes antérieures conservée.
- Migration additive appliquée après sauvegarde de la base et des six documents existants.

Vérification : 110 tests réussis, lint, TypeScript et compilation réussis. Isolation inter-dossiers, suspension, formats, taille, concurrence, rejeu, nettoyage, altération et sauvegarde/restauration testés. Serveur non démarré ; vérification visuelle connectée restante.

## MyKipCity — comparaison des publications — 30 septembre 2026

- Gestion → Publications → publication → Comparer toutes les versions : choix de deux versions et lecture côte à côte, avec repérage des différences de titre, texte, destinataires, statut et fichiers joints.
- L’historique reconstruit les états à partir des événements versionnés, sans limite aux 50 derniers événements. Les ajouts et retraits de pièces sont représentés dans leur version respective.
- Les pièces retirées se téléchargent depuis l’historique uniquement pour l’équipe acquéreurs active ; les téléchargements habituels et les accès membres restent soumis aux restrictions existantes. Contrôle SHA-256 conservé.

Validation : 111 tests réussis, lint, TypeScript et compilation réussis. Comparaison après 55 versions, sélection arbitraire, versions invalides, pièces retirées, rôles et suspension couverts. Aucune migration et aucun serveur démarré ; vérification visuelle connectée restante.

## Périmètre recentré MyKipCity et poursuite Finance/Juridique — 30 septembre 2026

Périmètre utilisateur : comptes, e-mails/rappels, Contact, dossiers/registre ; les autres travaux MyKipCity ne sont pas engagés. Finance/Juridique demandé, DocuSign toujours différé.

- Comptes : récupération Better Auth avec lien de quinze minutes, fermeture des sessions, vérification d’adresse, changement d’e-mail confirmé sur les deux adresses, synchronisation du registre, révocation des sessions/jetons, limitation des tentatives. TOTP et codes de secours ; obligation pour les accès internes par défaut et accès à la configuration maintenu.
- E-mails : file SQLite chiffrée, idempotence, réservation concurrente, expiration, reprises temporaires et mise en vérification des résultats incertains. Adaptateur Resend désactivé ; invitations, liens de compte et résumé quotidien préparés. Suivi administratif sans liens secrets. Aucun appel réel au fournisseur et aucun courriel réel envoyé. Fournisseur, expéditeur, délivrabilité et rythmes restent à confirmer.
- Contact : interlocuteur actif désigné avec motif et historique, trois files de réception, notifications ciblées et retour en file partagée en cas de suspension. Accès collectif de l’équipe conservé.
- Dossiers/registre : corrections de fiches et d’identité sur preuve, historique consultable, regroupement sans suppression des doublons sans compte ni dossier, invitations révoquées. Réexamen de qualité suspend les droits et conserve l’ancienne décision. Les transferts formels, doublons avec comptes actifs et délégations étendues restent à traiter.
- Finance : remplacement indépendant du contrôleur en cours d’examen ; ancien accès retiré et copie soumise conservée.
- Juridique : rôle Cabinet, affectations administratives, JUR-J01 à JUR-J07 reprenant les deux parties des annexes V2, références de preuves contrôlées, versions, relecture indépendante, visa par partie et reprise avec conservation de l’historique. Ces fiches et visas documentaires ne constituent pas les registres spécialisés d’exposition, de garde des originaux, d’appels, de recours et de clôture : leur développement reste nécessaire, ainsi que les visas Finance et décisions compétentes.
- Simulation interne : capital restant dû, taux nominal annuel divisé par douze, taux nul, arithmétique entière et dernière échéance ajustée. Coût complet non affiché si frais ou assurance inconnus. Archivage et approbation métier encore nécessaires.

Vérification : 124 tests réussis, lint, TypeScript et compilation réussis. Tests nouveaux : affectations et suspension, concurrence, e-mails chiffrés et reprises, changement d’adresse à deux confirmations, reset unique, TOTP et codes de secours, corrections du registre, retrait des droits pour réexamen, isolation du Cabinet, visa par partie et intégrité des versions, simulations à taux nul et avec intérêts.

Cinq migrations appliquées après sauvegarde des six fichiers existants dans `data/backups/2026-09-30T01-49-48.567Z`. Aucun serveur lancé. Aucun lot client ni périmètre Finance/Juridique complet déclaré terminé. Voir l’inventaire actualisé pour le développement restant et les dépendances client.
