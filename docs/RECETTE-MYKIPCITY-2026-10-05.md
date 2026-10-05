# MyKipCity — recette technique du 5 octobre 2026

La reprise des comptes actifs et le remplacement d’accès d’un titulaire sont livrés localement. Le raccordement Resend et la réception d’un e-mail réel sont vérifiés. La clôture métier reste conditionnée au pilote client.

## Règles retenues

Un agent examine les deux dossiers et les preuves, confirme l’identité commune et le compte à conserver avec la personne, puis soumet sa demande. Un autre agent, identifié comme une autre personne, vérifie et décide. Le préparateur ne peut pas approuver avec un second compte rattaché à sa propre identité.

Le regroupement conserve les références de chaque dossier et leurs archives. Il ne fusionne pas les contrats ni les conversations. Le compte d’origine est désactivé ; les deux comptes doivent se reconnecter. Les pièces Finance déposées depuis l’ancien compte restent accessibles à la même personne via le compte conservé, sous les conditions habituelles de partage du dossier. Les pièces internes Finance restent privées.

Le remplacement d’accès concerne deux titulaires distincts, une même parcelle, un ancien rattachement actif et un nouveau dossier transmis. Les autres cotitularités ou mandats actifs bloquent l’opération jusqu’à examen. L’ancien titulaire conserve ses archives mais perd l’accès aux informations de parcelle. Cette opération ne constitue pas un transfert de propriété.

Les représentants consultent uniquement les informations de parcelle autorisées et leur dossier personnel. Aucun pouvoir de signature ni d’action sur le dossier représenté n’est ajouté.

## Contrôles réalisés

| Contrôle | Résultat |
| --- | --- |
| Suite automatisée complète, bases temporaires et migrations réelles | 152 tests réussis, aucun échec |
| Types, lint, compilation Next | Réussis |
| Droits des rôles, preuves étrangères, séparation des personnes | Refus vérifiés |
| Approbations concurrentes | Une seule opération appliquée |
| Dossier modifié ou preuve altérée entre préparation et décision | Opération refusée sans changement des droits |
| Dossiers, documents, échanges, informations et suivi Finance après regroupement | Conservés ; tiers et ancien compte refusés |
| Pièces Finance historiques et changement d’adresse du compte conservé | Vérifiés sans exposition des pièces internes ni collision des fiches |
| Remplacement du titulaire et tentative de restaurer l’ancien accès | Nouveau droit accordé, ancien retiré, restauration concurrente refusée |
| Formulaires avec plusieurs dossiers | Cible explicite exigée ; autre dossier préservé |
| Diagnostic Resend sans configuration | Zéro envoi et zéro tentative |
| Envoi réel après configuration utilisateur | Accepté par Resend, reçu en boîte principale et confirmé par l’utilisateur |
| Destinataires fictifs réservés | Annulés sans appel fournisseur |

Recette navigateur sur une copie restaurée : un agent prépare le regroupement fictif, le compte Relecture l’approuve, puis Camille se reconnecte et retrouve ACQ-DEMO-001 et RECETTE-DOUBLE. La sélection de RECETTE-DOUBLE affiche DEMO-A02, son contrat et sa conversation. Contrôle visuel bureau 1440 × 1000 et mobile 390 × 844. Axe : zéro violation sur la décision et le tableau de bord ; aucun élément à examiner manuellement sur le tableau de bord après correction de contraste. Le remplacement de titulaire est couvert par les tests d’intégration ; il n’a pas été rejoué dans le navigateur.

La version compilée est démarrée sur `http://127.0.0.1:3200`, avec la configuration MFA interne normale. Contrôle HTTP : dossier anonyme redirigé vers la connexion, document anonyme refusé, origine étrangère refusée.

## Base locale et retour arrière

Sauvegarde préalable : `data/backups/2026-10-05-before-mykipcity-completion`, base SQLite et six fichiers vérifiés. Restauration exercée dans un répertoire temporaire, puis migration et parcours sur cette copie. La migration `20261005090000_acquirer_changes` est ensuite appliquée à `data/development.db`. Aucun compte de recette supplémentaire ni regroupement n’est créé dans cette base principale.

Pour revenir à l’état préalable, arrêter le serveur et restaurer la sauvegarde dans un répertoire distinct avec le code compatible précédent ; ne pas écraser une base en service. Consulter EXPLOITATION.md pour les commandes de restauration.

## E-mails et réception restante

`bun run mail status` indique uniquement des booléens : clé, expéditeur, activation et traitement automatique configurés. La clé fournie sous `RESEND_API` a été normalisée en `RESEND_API_KEY`, sans être affichée. Expéditeur : `my@kip-city.com`.

Le 5 octobre, un e-mail unique « MyKipCity — vérification de la messagerie » a été envoyé au destinataire désigné par l’utilisateur. Resend l’a accepté et l’utilisateur a confirmé sa réception dans la boîte principale Gmail. La clé restreinte ne permet pas de consulter les domaines ; l’autorisation de cet expéditeur a été vérifiée par cet envoi réel. Les messages fictifs vers les domaines réservés `.test`, `.invalid`, `.example` ou `localhost` sont annulés avant transport.

`MAIL_ENABLED=true` et `MAIL_AUTORUN=true` activent le traitement toutes les minutes pendant que le serveur Next.js tourne. Aucun planificateur externe n’est créé. Les liens utilisent encore l’adresse locale de l’application ; le pilote hébergé devra configurer son URL réelle. Les événements de délivrabilité du fournisseur ne sont pas encore raccordés : le statut « accepté » dans la file ne vaut pas preuve de réception.

## Navigation mobile et bureau

Le composant officiel Sheet shadcn (Radix) remplace le menu mobile affiché en permanence. Il comprend les rubriques du rôle, les notifications, le profil membre, la sécurité, le site public et la déconnexion. Les états sélectionnés n’utilisent plus de bordure colorée à gauche, sur bureau et mobile.

Recette : ouverture et fermeture, navigation vers Contact avec fermeture, Échap et retour du focus au bouton, Tab depuis le dernier contrôle revenant au premier lien, aucune largeur dépassant l’écran à 390 px. Axe ne signale aucune violation ; sa vérification manuelle du focus masqué a été complétée au clavier. Le bureau conserve sa navigation latérale. Captures : [menu ouvert](mykipcity-menu-mobile-open.png), [menu fermé](mykipcity-menu-mobile-closed.png), [bureau](mykipcity-menu-desktop.png).

Le pilote acquéreur et son procès-verbal restent à effectuer avec le client, notamment les scénarios de liens de compte et de rappels. Les prérequis d’hébergement et d’exploitation du déploiement réel restent ceux de l’inventaire. Aucune ouverture à de vrais dossiers n’est déclarée.
