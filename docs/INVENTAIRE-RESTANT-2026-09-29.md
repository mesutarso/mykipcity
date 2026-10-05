# Inventaire restant — MyKipCity et Finance

État actualisé au 5 octobre 2026 après la reprise des comptes actifs et la recette technique MyKipCity. Le backlog initial contient 56 tickets : ses mentions « À faire » sont historiques. Le présent inventaire tient compte des livraisons successives consignées dans AVANCEMENT.md. Aucun lot complet ni pilote client n’est déclaré réceptionné.

## Périmètre actif demandé par l’utilisateur

MyKipCity : comptes, e-mails/rappels, Contact, dossiers/registre ; demande de finalisation du 5 octobre. Deux comptes actifs d’une même personne : regroupement des dossiers après vérification et validation par deux agents distincts. Représentants : consultation des informations autorisées de la parcelle, sans actes sur le dossier d’autrui. La recette technique ciblée de cette livraison est réalisée. Antivirus, optimisation documentaire, conservation, hébergement et sauvegardes automatisées restent hors de ce lot. Finance/Juridique conserve son périmètre séparé ; DocuSign reste différé.

Livraison du 30 septembre : récupération du mot de passe, double authentification interne, vérification et changement d’e-mail ; file d’e-mails chiffrée et connecteur Resend désactivé ; rappels quotidiens ; affectation Contact ; corrections du registre et d’identité ; regroupement des fiches sans compte ; réexamen de qualité. Finance : remplacement du contrôleur ; Cabinet, sept formulaires juridiques en deux parties, versions et visas indépendants ; simulation interne.

La reprise des comptes/dossiers actifs et le remplacement de l’accès du titulaire sont livrés le 5 octobre, avec double contrôle et conservation des archives. Resend est configuré depuis `my@kip-city.com` ; le message réel de test a été confirmé en boîte principale. Restent le pilote client et ses scénarios d’e-mails, ainsi que les circuits Finance/Juridique détaillés ci-dessous. Les pouvoirs étendus des représentants ne sont pas demandés. Les formulaires juridiques ne remplacent pas ces circuits.

## Déjà fonctionnel en préproduction locale

- Invitation acquéreur, activation du compte, dossier, dépôt privé local des contrats, décisions par parcelle et dashboard.
- Registre acquéreurs/parcelles, recherche, messagerie privée, administration des collaborateurs et affectations Finance.
- Demande et budget Finance, pièces et contrôles, institutions et offres versionnées.
- Circuit préparateur/contrôleur/validateur, préparation des autorisations FIN-F05, incidents et réclamations internes.
- Accompagnement financier publié au membre, avec éléments demandés, rendez-vous et contact.
- Publications textuelles membres/acquéreur/parcelle, relecture distincte, publication/retrait, articles et filtre par parcelle.
- 152 tests automatisés réussis ; TypeScript, lint et compilation réussis. Regroupement et parcours membre vérifiés dans le navigateur sur copie isolée. Ces contrôles ne remplacent pas une recette client ni l’ouverture en production.

## 1. MyKipCity à compléter

- Profil : téléphone, ville et pays modifiables avec historique, après vérification comme en préparation. Vérification d’e-mail, changement avec double confirmation et correction d’identité par l’équipe livrés. La vérification du téléphone reste à définir.
- Notifications internes : fil et lu/non lu livrés (100 événements récents). Rappels quotidiens et invitations/liens de compte en file persistante livrés ; Resend et expéditeur configurés, test reçu en boîte principale. Restent validation des rythmes de rappel et vérification des liens de compte dans le pilote.
- Dossier : identité contractuelle, coordonnées, titulaires, références, types de pièces et association multi-parcelles ajoutés. Le contrat manquant permet une transmission incomplète, sans validation automatique. Dépôt multipage ordonné, versions groupées et nouvel essai sans doublon livrés. Cotitularité et représentation vérifiées individuellement par parcelle ajoutées, avec mandat, expiration, retrait et renouvellement. Réexamen de qualité et remplacement d’accès du titulaire avec deux agents livrés. Reste la reprise partielle des gros fichiers après interruption réseau, hors lot actif. Les invitations acquéreurs passent à 72 h ; les invitations internes restent à 48 h.
- Documents : demandes, remises, filtres par parcelle/type, versions et contrôles désormais disponibles pour l’équipe acquéreurs. Dépôt membre Finance, classement des contrats initiaux, annulation/retrait et pagination ajoutés. Versionnement groupé des contrats initiaux livré. Restent optimisation des requêtes des listes documentaires et politique de conservation.
- Informations : photos et PDF privés, légendes, date de prise de vue facultative et relecture sont désormais disponibles. Programmation après relecture, consultation côte à côte des deux derniers textes, archivage et restauration en brouillon ajoutés. Comparaison libre de toutes les versions livrée : texte, destinataires, statut et fichiers, avec téléchargement privé des pièces historiques réservé à l’équipe. Reste la politique de conservation approuvée.
- Contact : objet, parcelle, pièce jointe depuis le dossier, accusés après marquage explicite, pagination et notifications livrés. Dépôt direct PDF/JPEG/PNG dans la conversation livré, côté acquéreur et équipe. Routage vers des interlocuteurs désignés livré, avec file partagée et reprise des affectations inactives.
- Habilitations : cotitulaires et représentants sur comptes distincts, preuve du mandat, expiration serveur, retrait ciblé et renouvellement livrés. Portée limitée aux informations de parcelle et au dossier personnel. Rapprochement manuel sur preuves et remplacement d’accès du titulaire livrés avec double contrôle. Les délégations autorisant des actes sur le dossier d’autrui sont exclues du choix utilisateur actuel ; aucun transfert de propriété automatisé.
- Registre : import CSV acquéreurs/parcelles avec aperçu, contrôle des doublons, confirmation et historique livré. Corrections tracées, regroupement des doublons sans compte et reprise des comptes/dossiers actifs avec double contrôle livrés. L’import ne modifie aucune fiche existante.
- Validation des écrans et du parcours par le client, pilote acquéreur et procès-verbal de recette.

## 2. Finance initiale à compléter

- Validation métier des modèles et dictionnaires, champs manquants, règles de calcul et pièces obligatoires.
- FIN-F03 complet : contrôles métier adoptés, visas et dossier de transmission autorisé avec preuve.
- FIN-F05 : notice approuvée, contrôle des représentants, signature et consentement réels, pièces finales figées, transmission ciblée et traçable.
- Institutions/offres : vérification du statut des institutions, mandats et conditions ; critères de comparaison et barèmes seulement après approbation.
- Accompagnement membre : dépôt de pièces explicitement demandées par Finance ajouté. Restent offres autorisées à communiquer, signatures et rappels automatiques.
- Réclamations : canal membre/public, pièces privées, accusé de réception, calendrier ouvré, suppléants, escalades et notifications ; reprise lorsque le responsable devient indisponible.
- Dossiers validés : réouverture motivée par le référent, décision indépendante du validateur, retrait des préparations non signées et nouveau contrôle livrés. Remplacement motivé du validateur par l’administration livré pour les validations et réouvertures en attente, avec contrôle d’indépendance. Remplacement du contrôleur en cours d’examen livré. Restent délégations temporaires et transferts groupés si retenus.
- Recette Finance par les responsables désignés.

DocuSign reste explicitement en attente à la demande de l’utilisateur. Aucun consentement signé ni envoi bancaire n’est déclaré opérationnel.

## 3. Finance avancée et Juridique à développer

Les sept formulaires JUR-J01/J07 sont maintenant disponibles au Cabinet : deux parties par fiche, saisie, pièces de référence Finance, historique, relecture indépendante et visa par partie. Les montants, inventaires et obligations restent des rubriques documentaires ; les registres structurés et contrôles spécialisés ci-dessous ne sont pas déclarés livrés.

- FIN-F06 : interface au référentiel commercial unique des mouvements constatés, preuves, affectations, rapprochements et confirmation indépendante. Ne pas créer un registre concurrent ; raccordement à définir avec le client. Aucun paiement ou virement exécuté.
- Suivi des prêts livré : décisions du prêteur, contrats signés documentés, conditions, tranches par bénéficiaire, échéanciers et avenants, remboursements constatés et clôture confirmée. Preuves privées, contrôle indépendant, corrections conservées, notifications internes et calculs en centimes. Restent recette métier, gestion de reprise après clôture, échéanciers à effet futur, réaffectation du contrôleur après validation et raccordement aux relevés externes ; aucune clôture de garantie automatique.
- JUR-J01/J07 : personnes, pouvoirs, droits, actes, avis et information du membre.
- JUR-J02 : exposition, plafonds, ressources et liquidité.
- JUR-J04 : décisions habilitées, engagements, actes et formalités.
- JUR-J03 : registre des originaux livré. Inventaire par pièce, garde, sorties et retours, transmission autorisée, perte/détérioration, pièce retrouvée et restitution ; preuves privées, contrôle indépendant, historique et corrections du dernier fait. Restent recette métier du Cabinet, mouvements groupés, correction de faits anciens après mouvements ultérieurs et rapprochement des fiches documentaires JUR-J03 antérieures.
- JUR-J05/J06 : appels, recours, récupérations, mainlevées et clôtures distinctes.
- FIN-F07 : formulaire d’étude livré (projet, montage, emplois, ressources, gouvernance, avis et visas), preuves contrôlées, versions et gel dans le contrôle interne. Restent approbation du modèle V2 par le client, recette métier et circuit des décisions compétentes du Cabinet ; aucune décision juridique automatique.
- Simulation déterministe interne livrée, avec cas à taux nul et arrondis testés. Restent approbation des résultats de référence, archivage des scénarios et communication éventuelle au membre.
- Tableaux de bord, exports autorisés, échéances et alertes métier.
- Recette des trente scénarios Finance/Juridique avec Finance et le Cabinet.

## 4. Conditions techniques avant de vrais dossiers — hors de la demande actuelle

- Hébergement persistant et environnements séparés, procédure de livraison et supervision.
- Stockage local privé retenu par l’utilisateur : volume persistant, sauvegardes, antivirus et quarantaine à finaliser. Le stockage cloud est différé.
- Sauvegarde cohérente SQLite + fichiers, vérification des empreintes et restauration indépendante livrées et exercées. Restent planification, copie externe chiffrée, rétention et validation sur l’hébergement cible.
- Changement de mot de passe et fermeture des autres sessions livrés. MFA interne, récupération de compte et vérification d’adresse livrées. Restent matrice détaillée des habilitations et configuration des limitations de débit derrière le proxy de production.
- Traitement fiable des tâches et e-mails : reprises, erreurs, suivi de délivrabilité et absence de doublons.
- Conservation/archivage, journalisation complète, revue de sécurité et essais de charge/concurrence SQLite.

Les fichiers sont encore stockés localement. L’environnement reste une préproduction à données fictives.

## 5. Raccordements et services futurs

- Référentiels et API CRM1/CRM2 : responsabilités, identifiants, accès de test, synchronisation et traitement des erreurs.
- Terr privé : aide limitée, base approuvée, permissions serveur et relais vers Contact.
- DocuSign : compte et intégration de test, puis production lorsque disponible et approuvée.
- GreenCity et PMV : catalogues, tarifs, conditions et ouverture par service approuvé ; demandes, devis, souscriptions, interventions et suivi.
- Aucun faux bouton de service : l’absence actuelle de services ouverts est volontaire.

## 6. Client et livraison

- Confirmer les modèles et champs, contenus, responsables, pouvoirs, délégations, règles et délais métier.
- Obtenir les contenus autorisés, données de référence nettoyées et accès fournisseurs/API nécessaires.
- Créer les comptes d’hébergement, stockage, messagerie et fournisseurs au nom de l’entité retenue ; confirmer propriété et remise des accès, clés, code et base.
- Finaliser/faire approuver chiffrage, périmètre des lots, délais, coûts récurrents et maintenance.
- Préparer formation administrateurs, documentation d’exploitation, procédures de sauvegarde/restauration et remise par lot.
- Réceptionner le pilote acquéreur, puis Finance/Juridique, et autoriser explicitement l’ouverture réelle.

## Ordre de travail dans le périmètre demandé

1. Réceptionner les scénarios d’invitation, récupération et rappels du pilote ; le raccordement Resend et un envoi réel reçu sont vérifiés. Le suivi automatique des événements de délivrabilité reste à raccorder si retenu.
2. Faire réceptionner le pilote MyKipCity : comptes regroupés, remplacement d’accès, documents et Contact ; conserver la portée de consultation choisie pour les représentants.
3. Finaliser FIN-F03/FIN-F05, réclamations, extensions du suivi des financements et interface FIN-F06 à partir des modèles approuvés.
4. Transformer les annexes juridiques en registres et circuits spécialisés : exposition, pouvoirs, engagements, appels, recours et libérations, avec décisions compétentes et preuves séparées.
5. Compléter les indicateurs, exports et scénarios Finance/Juridique ; remettre les résultats pour recette métier lorsque les responsables sont désignés.

Les autres travaux MyKipCity ne sont pas engagés. Les paiements en ligne, portefeuilles, virements, crédits et garanties automatiques restent exclus. Aucun lot client n’est déclaré réceptionné.
